"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export type SendState = { message?: string };

const UNAVAILABLE = "Le service est momentanément indisponible. Aucun message n'a été mis en file.";

async function queue(eventId: string, what: "invitations" | "reminders"): Promise<SendState> {
  let response: Response;
  try {
    response = await apiFetch(`/v1/events/${encodeURIComponent(eventId)}/whatsapp/${what}`, {
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
  const { queued } = (await response.json()) as { queued: number };
  redirect(`/tableau-de-bord/evenements/${eventId}/relances?${what === "invitations" ? "envoyees" : "relances"}=${queued}`);
}

export async function sendInvitations(eventId: string): Promise<SendState> {
  return queue(eventId, "invitations");
}

export async function sendReminders(eventId: string): Promise<SendState> {
  return queue(eventId, "reminders");
}

export async function updateSettings(eventId: string, formData: FormData): Promise<void> {
  const body = {
    reminders_enabled: formData.get("reminders_enabled") === "on",
    calls_enabled: formData.get("calls_enabled") === "on",
  };
  const response = await apiFetch(`/v1/events/${encodeURIComponent(eventId)}/whatsapp`, {
    method: "PATCH",
    body: JSON.stringify(body),
    token: await getSessionToken(),
  });
  if (response.status === 401) redirect("/connexion");
  revalidatePath(`/tableau-de-bord/evenements/${eventId}/relances`);
}

export type DatesState = { message?: string };

/** Ajoute, retire une date de relance, ou revient au calendrier proposé (bouton « intent » du formulaire). */
export async function updateReminderDates(
  eventId: string,
  dates: string[],
  _previous: DatesState,
  formData: FormData,
): Promise<DatesState> {
  const intent = String(formData.get("intent") ?? "add");
  let reminderDates: string[] | null;
  if (intent === "reset") {
    reminderDates = null;
  } else if (intent.startsWith("remove:")) {
    reminderDates = dates.filter((d) => d !== intent.slice("remove:".length));
  } else {
    const day = String(formData.get("date") ?? "");
    if (!day) return { message: "Choisissez une date." };
    reminderDates = [...dates, day];
  }
  let response: Response;
  try {
    response = await apiFetch(`/v1/events/${encodeURIComponent(eventId)}/whatsapp`, {
      method: "PATCH",
      body: JSON.stringify({ reminder_dates: reminderDates }),
      token: await getSessionToken(),
    });
  } catch {
    return { message: "Le service est momentanément indisponible. Vos dates n'ont pas été modifiées." };
  }
  if (response.status === 401) redirect("/connexion");
  if (response.status === 422) {
    const { detail } = (await response.json()) as { detail: { message?: string } };
    return { message: detail.message ?? "Cette date n'est pas valable." };
  }
  if (!response.ok) return { message: "Le service est momentanément indisponible. Vos dates n'ont pas été modifiées." };
  revalidatePath(`/tableau-de-bord/evenements/${eventId}/relances`);
  return {};
}
