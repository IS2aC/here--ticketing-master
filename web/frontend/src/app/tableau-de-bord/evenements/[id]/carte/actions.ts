"use server";

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
