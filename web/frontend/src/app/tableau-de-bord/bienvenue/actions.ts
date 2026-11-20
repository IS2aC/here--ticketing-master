"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export type PhoneState = { error?: string; phone?: string };

/** Première connexion avec Google : ajoute le numéro WhatsApp (facultatif), puis ouvre le tableau de bord. */
export async function savePhone(_: PhoneState, formData: FormData): Promise<PhoneState> {
  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) return { error: "Indiquez votre numéro, ou choisissez « Plus tard »." };
  let response: Response;
  try {
    response = await apiFetch("/v1/me", { method: "PATCH", token: await getSessionToken(), body: JSON.stringify({ phone }) });
  } catch {
    return { error: "Le service est momentanément indisponible. Réessayez, ou choisissez « Plus tard ».", phone };
  }
  if (response.status === 401) redirect("/connexion");
  if (response.status === 422) return { error: "Ce numéro n'est pas valide. Exemple : 07 07 12 34 56.", phone };
  if (response.status === 409) {
    const { detail } = (await response.json()) as { detail: { message: string } };
    return { error: detail.message, phone };
  }
  if (!response.ok) return { error: "Le service est momentanément indisponible. Réessayez, ou choisissez « Plus tard ».", phone };
  redirect("/tableau-de-bord");
}
