"use server";

import { redirect } from "next/navigation";
import { apiFetch, type SessionResponse } from "@/lib/api";
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
    return await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
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
