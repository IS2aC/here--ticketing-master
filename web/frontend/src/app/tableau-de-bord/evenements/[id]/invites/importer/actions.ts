"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export type ImportFormState = { message?: string };

const UNAVAILABLE = "Le service est momentanément indisponible. Votre liste n'a pas été modifiée.";

function base(eventId: string) {
  return `/v1/events/${encodeURIComponent(eventId)}/imports`;
}

export async function uploadImport(eventId: string, _: ImportFormState, formData: FormData): Promise<ImportFormState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "Choisissez votre fichier Excel ou CSV." };
  if (file.size > 5 * 1024 * 1024) return { message: "Ce fichier dépasse 5 Mo. Gardez seulement la liste des invités." };

  const body = new FormData();
  body.append("file", file, file.name);
  let response: Response;
  try {
    response = await apiFetch(base(eventId), { method: "POST", token: await getSessionToken(), body });
  } catch {
    return { message: UNAVAILABLE };
  }
  if (response.status === 401) redirect("/connexion");
  if (response.status === 422) {
    const { detail } = (await response.json()) as { detail: { message?: string } };
    return { message: detail.message ?? "Nous n'arrivons pas à lire ce fichier." };
  }
  if (!response.ok) return { message: UNAVAILABLE };
  const { id } = (await response.json()) as { id: string };
  redirect(`/tableau-de-bord/evenements/${eventId}/invites/importer/${id}`);
}

export async function confirmImport(eventId: string, importId: string): Promise<ImportFormState> {
  let response: Response;
  try {
    response = await apiFetch(`${base(eventId)}/${encodeURIComponent(importId)}/confirm`, {
      method: "POST",
      token: await getSessionToken(),
    });
  } catch {
    return { message: UNAVAILABLE };
  }
  if (response.status === 401) redirect("/connexion");
  if (response.status === 409) {
    const { detail } = (await response.json()) as { detail: { message: string } };
    return { message: detail.message };
  }
  if (!response.ok) return { message: UNAVAILABLE };
  const { imported_rows } = (await response.json()) as { imported_rows: number };
  redirect(`/tableau-de-bord/evenements/${eventId}?importes=${imported_rows}`);
}
