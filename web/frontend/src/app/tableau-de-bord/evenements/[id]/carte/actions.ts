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

export type BackgroundState = { message?: string };

const CARD_UNAVAILABLE = "Le service est momentanément indisponible. Votre carte n'a pas été modifiée.";

async function cardError(response: Response): Promise<string> {
  if (response.status === 409 || response.status === 422) {
    try {
      const { detail } = (await response.json()) as { detail: { message?: string } | unknown[] };
      if (!Array.isArray(detail) && detail.message) return detail.message;
    } catch {
      // réponse illisible : message générique
    }
    return "Cette mise en page n'est pas valable.";
  }
  return CARD_UNAVAILABLE;
}

/** « Mon propre modèle » : envoie le fond (recadré par l'API au format de la carte). */
export async function uploadBackground(eventId: string, _: BackgroundState, formData: FormData): Promise<BackgroundState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "Choisissez une image." };
  if (file.size > 8 * 1024 * 1024) return { message: "Cette image dépasse 8 Mo : choisissez une image plus légère." };
  const body = new FormData();
  body.append("file", file, file.name || "fond.jpg");
  let response: Response;
  try {
    response = await apiFetch(`/v1/events/${encodeURIComponent(eventId)}/card/background`, {
      method: "PUT",
      token: await getSessionToken(),
      body,
    });
  } catch {
    return { message: CARD_UNAVAILABLE };
  }
  if (response.status === 401) redirect("/connexion");
  if (!response.ok) return { message: await cardError(response) };
  const { cropped } = (await response.json()) as { cropped: boolean };
  revalidatePath(`/tableau-de-bord/evenements/${eventId}/carte`);
  redirect(`/tableau-de-bord/evenements/${eventId}/carte?fond=${cropped ? "recadre" : "ok"}`);
}

/** Enregistre la mise en page (nom, table / catégorie, QR code). */
export async function saveLayout(eventId: string, layout: unknown): Promise<{ message?: string; saved?: number }> {
  let response: Response;
  try {
    response = await apiFetch(`/v1/events/${encodeURIComponent(eventId)}/card`, {
      method: "PATCH",
      token: await getSessionToken(),
      body: JSON.stringify({ layout }),
    });
  } catch {
    return { message: CARD_UNAVAILABLE };
  }
  if (response.status === 401) redirect("/connexion");
  if (!response.ok) return { message: await cardError(response) };
  revalidatePath(`/tableau-de-bord/evenements/${eventId}/carte`);
  return { saved: Date.now() };
}

/** Retour à la carte automatique : le fond importé est supprimé. */
export async function removeBackground(eventId: string): Promise<{ message?: string }> {
  let response: Response;
  try {
    response = await apiFetch(`/v1/events/${encodeURIComponent(eventId)}/card/background`, {
      method: "DELETE",
      token: await getSessionToken(),
    });
  } catch {
    return { message: CARD_UNAVAILABLE };
  }
  if (response.status === 401) redirect("/connexion");
  if (!response.ok) return { message: await cardError(response) };
  revalidatePath(`/tableau-de-bord/evenements/${eventId}/carte`);
  return {};
}

export type EditorState = { message?: string };

/** Ouvre la carte dans l'éditeur : la carte en cours, ou une nouvelle (`fresh`) d'après un modèle ou vierge.
 *  Renvoie le lien de connexion à l'éditeur, valable 2 minutes : le navigateur le suit aussitôt. */
export async function openEditor(
  eventId: string,
  options: { template?: string | null; fresh?: boolean },
): Promise<{ url?: string; message?: string }> {
  let response: Response;
  try {
    response = await apiFetch(`/v1/events/${encodeURIComponent(eventId)}/card/editor`, {
      method: "POST",
      token: await getSessionToken(),
      body: JSON.stringify({ template: options.template ?? null, new: Boolean(options.fresh) }),
    });
  } catch {
    return { message: EDITOR_UNAVAILABLE };
  }
  if (response.status === 401) redirect("/connexion");
  if (!response.ok) return { message: await editorError(response) };
  const { url } = (await response.json()) as { url: string };
  return { url };
}

/** Valide la carte dessinée dans l'éditeur : elle devient la carte de chaque invité. */
export async function validateEditorCard(eventId: string): Promise<EditorState> {
  let response: Response;
  try {
    response = await apiFetch(`/v1/events/${encodeURIComponent(eventId)}/card/editor/validate`, {
      method: "POST",
      token: await getSessionToken(),
    });
  } catch {
    return { message: EDITOR_UNAVAILABLE };
  }
  if (response.status === 401) redirect("/connexion");
  if (!response.ok) return { message: await editorError(response) };
  revalidatePath(`/tableau-de-bord/evenements/${eventId}/carte`);
  redirect(`/tableau-de-bord/evenements/${eventId}/carte?editeur=valide`);
}

const EDITOR_UNAVAILABLE = "L'éditeur de cartes est momentanément indisponible. Réessayez dans un instant.";

async function editorError(response: Response): Promise<string> {
  try {
    const { detail } = (await response.json()) as { detail: { message?: string } | unknown[] };
    if (!Array.isArray(detail) && detail.message) return detail.message;
  } catch {
    // réponse illisible : message générique
  }
  return EDITOR_UNAVAILABLE;
}
