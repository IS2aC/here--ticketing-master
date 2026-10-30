"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { EVENT_UTC_OFFSET } from "@/lib/event-types";
import { getSessionToken } from "@/lib/session";

export type EventFormState = {
  message?: string;
  errors?: Partial<Record<string, string>>;
};

const UNAVAILABLE = "Le service est momentanément indisponible. Vos informations n'ont pas été enregistrées.";

// Champ du formulaire concerné par une erreur de l'API, et message affiché.
const FIELD_MESSAGES: Record<string, [string, string]> = {
  title: ["title", "Donnez un nom à votre événement."],
  type: ["type", "Choisissez le type d'événement."],
  starts_at: ["date", "Indiquez une date et une heure à venir."],
  duration_minutes: ["duration", "Indiquez une durée entre 30 minutes et 7 jours."],
  location_name: ["location_name", "Le nom du lieu est trop long (200 caractères maximum)."],
  location_address: ["location_address", "L'adresse est trop longue (300 caractères maximum)."],
  expected_guests: ["expected_guests", "Indiquez un nombre d'invités entre 0 et 100 000."],
  dress_code: ["dress_code", "Le dress code est trop long (100 caractères maximum)."],
  rsvp_deadline: ["rsvp_deadline", "La date limite de réponse doit être avant le début de l'événement."],
  description: ["description", "La description est trop longue (2 000 caractères maximum)."],
  categories: ["categories", "Gardez entre 1 et 10 catégories, de 40 caractères maximum."],
};

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function number(value: string): number | null {
  if (!value) return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function payload(formData: FormData) {
  const date = text(formData, "date");
  const time = text(formData, "time") || "00:00";
  const hours = number(text(formData, "duration"));
  const deadline = text(formData, "rsvp_deadline");
  return {
    title: text(formData, "title"),
    type: text(formData, "type") || null,
    starts_at: date ? `${date}T${time}:00${EVENT_UTC_OFFSET}` : null,
    duration_minutes: hours === null ? null : Math.round(hours * 60),
    location_name: text(formData, "location_name"),
    location_address: text(formData, "location_address"),
    expected_guests: number(text(formData, "expected_guests")),
    dress_code: text(formData, "dress_code"),
    // Date limite : les réponses ferment à la fin de ce jour (heure d'Abidjan).
    rsvp_deadline: deadline ? `${deadline}T23:59:00${EVENT_UTC_OFFSET}` : null,
    description: text(formData, "description"),
    categories: formData.getAll("categories").map(String).filter(Boolean),
  };
}

async function save(method: "POST" | "PATCH", path: string, formData: FormData): Promise<EventFormState | string> {
  const body = payload(formData);
  // Vérifié ici pour signaler toutes les erreurs d'un coup ; l'API refait ces contrôles.
  const errors: EventFormState["errors"] = {};
  if (!body.type) errors.type = FIELD_MESSAGES.type[1];
  if (!body.title) errors.title = FIELD_MESSAGES.title[1];
  if (!body.starts_at || !(new Date(body.starts_at) > new Date())) errors.date = FIELD_MESSAGES.starts_at[1];
  else if (body.rsvp_deadline && body.rsvp_deadline.slice(0, 10) > body.starts_at.slice(0, 10)) {
    errors.rsvp_deadline = FIELD_MESSAGES.rsvp_deadline[1];
  }
  if (Object.keys(errors).length) return { errors };
  let response: Response;
  try {
    response = await apiFetch(path, {
      method,
      token: await getSessionToken(),
      // NaN (saisie non numérique) devient null en JSON : l'API répond alors 422 sur ce champ si besoin.
      body: JSON.stringify(body),
    });
  } catch {
    return { message: UNAVAILABLE };
  }
  if (response.status === 401) redirect("/connexion");
  if (response.status === 422) {
    const { detail } = (await response.json()) as { detail: { loc: (string | number)[] }[] };
    const errors: EventFormState["errors"] = {};
    for (const { loc } of detail) {
      const entry = FIELD_MESSAGES[String(loc[1] ?? loc.at(-1))];
      if (entry) errors[entry[0]] = entry[1];
    }
    return { errors };
  }
  if (response.status === 409) {
    const { detail } = (await response.json()) as { detail: { field: string; message: string } };
    return { errors: { [detail.field]: detail.message } };
  }
  if (!response.ok) return { message: UNAVAILABLE };
  return ((await response.json()) as { id: string }).id;
}

export async function createEvent(_: EventFormState, formData: FormData): Promise<EventFormState> {
  const result = await save("POST", "/v1/events", formData);
  if (typeof result !== "string") return result;
  redirect(`/tableau-de-bord/evenements/${result}`);
}

export async function updateEvent(id: string, _: EventFormState, formData: FormData): Promise<EventFormState> {
  const result = await save("PATCH", `/v1/events/${encodeURIComponent(id)}`, formData);
  if (typeof result !== "string") return result;
  redirect(`/tableau-de-bord/evenements/${result}`);
}

export async function deleteEvent(id: string): Promise<EventFormState> {
  let response: Response;
  try {
    response = await apiFetch(`/v1/events/${encodeURIComponent(id)}`, { method: "DELETE", token: await getSessionToken() });
  } catch {
    return { message: "Le service est momentanément indisponible. L'événement n'a pas été supprimé." };
  }
  if (response.status === 401) redirect("/connexion");
  if (!response.ok && response.status !== 404) {
    return { message: "Le service est momentanément indisponible. L'événement n'a pas été supprimé." };
  }
  redirect("/tableau-de-bord?supprime=1");
}
