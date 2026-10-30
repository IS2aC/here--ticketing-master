"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export type GenerateState = { message?: string };

export async function generateInvitations(eventId: string): Promise<GenerateState> {
  let response: Response;
  try {
    response = await apiFetch(`/v1/events/${encodeURIComponent(eventId)}/invitations`, {
      method: "POST",
      token: await getSessionToken(),
    });
  } catch {
    return { message: "Le service est momentanément indisponible. Aucune invitation n'a été créée." };
  }
  if (response.status === 401) redirect("/connexion");
  if (response.status === 409) {
    const { detail } = (await response.json()) as { detail: { message: string } };
    return { message: detail.message };
  }
  if (!response.ok) return { message: "Le service est momentanément indisponible. Aucune invitation n'a été créée." };
  const { created, total } = (await response.json()) as { created: number; total: number };
  redirect(`/tableau-de-bord/evenements/${eventId}/carte?creees=${created}&total=${total}`);
}

export type CardState = { message?: string; saved?: number };

/** Intitulé et palette de la carte. `reset` : retour à l'intitulé et aux couleurs d'origine. */
export async function saveCard(eventId: string, _: CardState, formData: FormData): Promise<CardState> {
  const reset = formData.get("intent") === "reset";
  const title = String(formData.get("title") ?? "").trim();
  const palette = String(formData.get("palette") ?? "");
  let response: Response;
  try {
    response = await apiFetch(`/v1/events/${encodeURIComponent(eventId)}/card`, {
      method: "PATCH",
      token: await getSessionToken(),
      body: JSON.stringify(reset ? { title: null, palette: null } : { title: title || null, palette: palette || null }),
    });
  } catch {
    return { message: "Le service est momentanément indisponible. Votre carte n'a pas été modifiée." };
  }
  if (response.status === 401) redirect("/connexion");
  if (response.status === 409) {
    const { detail } = (await response.json()) as { detail: { message: string } };
    return { message: detail.message };
  }
  if (response.status === 422) return { message: "L'intitulé est trop long (80 caractères au plus)." };
  if (!response.ok) return { message: "Le service est momentanément indisponible. Votre carte n'a pas été modifiée." };
  revalidatePath(`/tableau-de-bord/evenements/${eventId}/carte`);
  return { saved: Date.now() };
}
