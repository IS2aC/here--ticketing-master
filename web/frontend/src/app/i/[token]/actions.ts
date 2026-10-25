"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

export type ResponseState = { message?: string };

// Réponse de l'invité (page publique : le jeton est la seule clé).
export async function respond(token: string, _: ResponseState, formData: FormData): Promise<ResponseState> {
  const attending = formData.get("attending") === "oui";
  const seats = Number(formData.get("seats")) || null;
  const message = formData.has("message") ? String(formData.get("message") ?? "").trim() : null;
  let response: Response;
  try {
    response = await apiFetch(`/v1/invitations/${encodeURIComponent(token)}/response`, {
      method: "POST",
      body: JSON.stringify({ attending, seats: attending ? seats : null, message: message || null }),
    });
  } catch {
    return { message: "Votre réponse n'a pas pu être envoyée. Vérifiez votre connexion et réessayez." };
  }
  if (response.status === 409) return { message: "Les réponses sont closes pour cet événement." };
  if (!response.ok) return { message: "Votre réponse n'a pas pu être envoyée. Réessayez dans un instant." };
  redirect(`/i/${encodeURIComponent(token)}${message ? "?message=envoye" : ""}`);
}
