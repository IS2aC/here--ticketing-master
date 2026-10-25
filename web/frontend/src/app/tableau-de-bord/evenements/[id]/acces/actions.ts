"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export type LinkState = { message?: string };

function base(eventId: string) {
  return `/v1/events/${encodeURIComponent(eventId)}/scan-links`;
}

export async function createScanLink(eventId: string, _: LinkState, formData: FormData): Promise<LinkState> {
  const label = String(formData.get("label") ?? "").trim() || "Entrée principale";
  let response: Response;
  try {
    response = await apiFetch(base(eventId), { method: "POST", token: await getSessionToken(), body: JSON.stringify({ label }) });
  } catch {
    return { message: "Le service est momentanément indisponible. Aucun lien n'a été créé." };
  }
  if (response.status === 401) redirect("/connexion");
  if (response.status === 422) return { message: "Donnez un nom au lien (60 caractères maximum)." };
  if (!response.ok) return { message: "Le service est momentanément indisponible. Aucun lien n'a été créé." };
  redirect(`/tableau-de-bord/evenements/${eventId}/acces`);
}

export async function revokeScanLink(eventId: string, linkId: string): Promise<void> {
  const response = await apiFetch(`${base(eventId)}/${encodeURIComponent(linkId)}/revoke`, {
    method: "POST",
    token: await getSessionToken(),
  });
  if (response.status === 401) redirect("/connexion");
  redirect(`/tableau-de-bord/evenements/${eventId}/acces`);
}
