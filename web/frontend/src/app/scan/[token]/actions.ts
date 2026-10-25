"use server";

import { apiFetch } from "@/lib/api";
import type { ScanGuest, ScanResult } from "@/lib/scan";

// Écran de scan des agents d'accueil (public : le jeton du lien est la seule clé).

export type CheckOutcome = { ok: true; data: ScanResult } | { ok: false; message: string };

export async function checkIn(token: string, input: { value?: string; guestId?: string }): Promise<CheckOutcome> {
  try {
    const response = await apiFetch(`/v1/scan/${encodeURIComponent(token)}/check`, {
      method: "POST",
      body: JSON.stringify({ value: input.value ?? null, guest_id: input.guestId ?? null }),
    });
    if (response.status === 404) return { ok: false, message: "Ce lien de scan n'est plus valide. Demandez un nouveau lien à l'organisateur." };
    if (!response.ok) return { ok: false, message: "Vérification impossible. Réessayez." };
    return { ok: true, data: (await response.json()) as ScanResult };
  } catch {
    return { ok: false, message: "Pas de connexion. Réessayez dans un instant." };
  }
}

export async function searchGuests(token: string, query: string): Promise<ScanGuest[]> {
  try {
    const response = await apiFetch(`/v1/scan/${encodeURIComponent(token)}/guests?q=${encodeURIComponent(query)}`);
    return response.ok ? ((await response.json()) as ScanGuest[]) : [];
  } catch {
    return [];
  }
}
