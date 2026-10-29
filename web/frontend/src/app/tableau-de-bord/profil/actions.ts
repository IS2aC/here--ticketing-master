"use server";

import { redirect } from "next/navigation";
import { apiFetch, clientHeaders } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export type ProfileState = { message?: string; errors?: Partial<Record<string, string>> };

const UNAVAILABLE = "Le service est momentanément indisponible. Vos informations n'ont pas été enregistrées.";

const FIELD_MESSAGES: Record<string, string> = {
  first_name: "Indiquez votre prénom.",
  last_name: "Indiquez votre nom.",
  phone: "Ce numéro de téléphone n'est pas valide.",
  email: "Cette adresse e-mail n'est pas valide.",
  organization: "120 caractères maximum.",
  city: "80 caractères maximum.",
  country: "80 caractères maximum.",
  billing_address: "300 caractères maximum.",
  tax_id: "40 caractères maximum.",
  new_password: "Le nouveau mot de passe doit contenir au moins 8 caractères.",
  current_password: "Indiquez votre mot de passe actuel.",
};

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

async function send(path: string, method: "PATCH" | "POST", body: unknown): Promise<Response | ProfileState> {
  let response: Response;
  try {
    response = await apiFetch(path, { method, token: await getSessionToken(), body: JSON.stringify(body), headers: await clientHeaders() });
  } catch {
    return { message: UNAVAILABLE };
  }
  if (response.status === 401) redirect("/connexion");
  return response;
}

async function problems(response: Response): Promise<ProfileState> {
  if (response.status === 422) {
    const { detail } = (await response.json()) as { detail: { loc: (string | number)[] }[] };
    const errors: ProfileState["errors"] = {};
    for (const { loc } of detail) {
      const field = String(loc.at(-1));
      if (FIELD_MESSAGES[field]) errors[field] = FIELD_MESSAGES[field];
    }
    return { errors };
  }
  if (response.status === 429) {
    const { detail } = (await response.json()) as { detail: { message: string } };
    return { errors: { current_password: detail.message } };
  }
  if (response.status === 409 || response.status === 400) {
    const { detail } = (await response.json()) as { detail: { field: string; message: string } };
    return { errors: { [detail.field]: detail.message } };
  }
  return { message: UNAVAILABLE };
}

export async function updateProfile(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const body = {
    first_name: text(formData, "first_name"),
    last_name: text(formData, "last_name"),
    phone: text(formData, "phone"),
    email: text(formData, "email") || null,
    organization: text(formData, "organization"),
    city: text(formData, "city"),
    country: text(formData, "country"),
    billing_address: text(formData, "billing_address"),
    tax_id: text(formData, "tax_id"),
  };
  const response = await send("/v1/me", "PATCH", body);
  if (!(response instanceof Response)) return response;
  if (!response.ok) return problems(response);
  redirect("/tableau-de-bord/profil?enregistre=profil");
}

export async function changePassword(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const body = {
    current_password: String(formData.get("current_password") ?? ""),
    new_password: String(formData.get("new_password") ?? ""),
  };
  if (body.new_password !== String(formData.get("confirm_password") ?? "")) {
    return { errors: { confirm_password: "Les deux nouveaux mots de passe ne sont pas identiques." } };
  }
  const response = await send("/v1/me/password", "POST", body);
  if (!(response instanceof Response)) return response;
  if (!response.ok) return problems(response);
  redirect("/tableau-de-bord/profil?enregistre=mot-de-passe");
}
