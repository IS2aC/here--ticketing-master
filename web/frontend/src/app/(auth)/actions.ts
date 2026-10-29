"use server";

import { redirect } from "next/navigation";
import { apiFetch, clientHeaders, type SessionResponse } from "@/lib/api";
import { clearSessionToken, getSessionToken, setSessionToken } from "@/lib/session";

export type FormState = {
  message?: string;
  errors?: Partial<Record<string, string>>;
  values?: Record<string, string>;
};

const UNAVAILABLE = "Le service est momentanément indisponible. Réessayez dans un instant.";

// Messages affichés quand l'API refuse un champ (422).
const FIELD_MESSAGES: Record<string, string> = {
  first_name: "Indiquez votre prénom.",
  last_name: "Indiquez votre nom.",
  phone: "Ce numéro de téléphone n'est pas valide.",
  email: "Cette adresse e-mail n'est pas valide.",
  password: "Le mot de passe doit contenir au moins 8 caractères.",
};

type ValidationError = { loc: (string | number)[] };

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

async function call(path: string, body: unknown): Promise<Response | null> {
  try {
    return await apiFetch(path, { method: "POST", body: JSON.stringify(body), headers: await clientHeaders() });
  } catch {
    return null;
  }
}

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const values = {
    first_name: text(formData, "first_name"),
    last_name: text(formData, "last_name"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
  };
  const response = await call("/v1/auth/register", {
    ...values,
    email: values.email || null,
    password: String(formData.get("password") ?? ""),
  });

  if (!response) return { message: UNAVAILABLE, values };
  if (response.status === 422) {
    const { detail } = (await response.json()) as { detail: ValidationError[] };
    const errors: FormState["errors"] = {};
    for (const { loc } of detail) {
      const field = String(loc.at(-1));
      if (FIELD_MESSAGES[field]) errors[field] = FIELD_MESSAGES[field];
    }
    return { errors, values };
  }
  if (response.status === 409) {
    const { detail } = (await response.json()) as { detail: { field: string; message: string } };
    return { errors: { [detail.field]: detail.message }, values };
  }
  if (!response.ok) return { message: UNAVAILABLE, values };

  const session = (await response.json()) as SessionResponse;
  await setSessionToken(session.access_token, session.expires_at);
  redirect("/tableau-de-bord");
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const values = { identifier: text(formData, "identifier") };
  const response = await call("/v1/auth/login", { ...values, password: String(formData.get("password") ?? "") });

  if (!response) return { message: UNAVAILABLE, values };
  if (response.status === 429) return { message: await detailMessage(response), values };
  if (response.status === 401 || response.status === 422) {
    return {
      message:
        response.status === 401
          ? "Identifiant ou mot de passe incorrect."
          : "Renseignez votre téléphone ou votre e-mail, et votre mot de passe.",
      values,
    };
  }
  if (!response.ok) return { message: UNAVAILABLE, values };

  const session = (await response.json()) as SessionResponse;
  await setSessionToken(session.access_token, session.expires_at);
  redirect("/tableau-de-bord");
}

async function detailMessage(response: Response): Promise<string> {
  try {
    const { detail } = (await response.json()) as { detail: { message?: string } };
    return detail.message ?? UNAVAILABLE;
  } catch {
    return UNAVAILABLE;
  }
}

export type ResetState = FormState & { step?: "code" };

/** Mot de passe oublié, étape 1 : un code est envoyé par WhatsApp (même réponse si le compte n'existe pas). */
export async function requestReset(_: ResetState, formData: FormData): Promise<ResetState> {
  const values = { identifier: text(formData, "identifier") };
  if (!values.identifier) return { errors: { identifier: "Indiquez votre téléphone ou votre e-mail." }, values };
  const response = await call("/v1/auth/password-reset", values);
  if (!response) return { message: UNAVAILABLE, values };
  if (response.status === 429) return { message: await detailMessage(response), values };
  if (!response.ok) return { message: UNAVAILABLE, values };
  return { step: "code", values };
}

/** Étape 2 : code + nouveau mot de passe. Les autres appareils sont déconnectés, celui-ci est connecté. */
export async function confirmReset(_: ResetState, formData: FormData): Promise<ResetState> {
  const values = { identifier: text(formData, "identifier") };
  const password = String(formData.get("password") ?? "");
  const code = text(formData, "code").replace(/\s/g, "");
  const step = "code" as const;
  if (!/^\d{6}$/.test(code)) return { step, values, errors: { code: "Le code compte 6 chiffres." } };
  if (password.length < 8) return { step, values, errors: { password: FIELD_MESSAGES.password } };
  if (password !== String(formData.get("confirm") ?? "")) {
    return { step, values, errors: { confirm: "Les deux mots de passe ne sont pas identiques." } };
  }
  const response = await call("/v1/auth/password-reset/confirm", { ...values, code, password });
  if (!response) return { step, values, message: UNAVAILABLE };
  if (response.status === 400) return { step, values, errors: { code: await detailMessage(response) } };
  if (!response.ok) return { step, values, message: UNAVAILABLE };
  const session = (await response.json()) as SessionResponse;
  await setSessionToken(session.access_token, session.expires_at);
  redirect("/tableau-de-bord?mot-de-passe=change");
}

export async function logout(): Promise<void> {
  const token = await getSessionToken();
  if (token) {
    try {
      await apiFetch("/v1/auth/logout", { method: "POST", token });
    } catch {
      // La session expirera d'elle-même ; on déconnecte quand même le navigateur.
    }
  }
  await clearSessionToken();
  redirect("/connexion");
}
