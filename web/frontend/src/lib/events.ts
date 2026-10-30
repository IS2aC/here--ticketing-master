import "server-only";
import { notFound } from "next/navigation";
import { apiFetch } from "./api";
import { getSessionToken } from "./session";
import { EVENT_TIME_ZONE, type EventType } from "./event-types";

export type EventOut = {
  id: string;
  title: string;
  type: EventType;
  status: "draft" | "active" | "done" | "cancelled";
  starts_at: string;
  duration_minutes: number | null;
  location_name: string | null;
  location_address: string | null;
  expected_guests: number | null;
  dress_code: string | null;
  description: string | null;
  categories: { id: string; name: string; guests: number }[];
  stats: { arrived: number; guests: number; confirmed: number; declined: number; pending: number };
  created_at: string;
  updated_at: string;
  rsvp_deadline: string | null;
};

async function get(path: string): Promise<Response> {
  return apiFetch(path, { token: await getSessionToken() });
}

export async function getEvents(): Promise<EventOut[]> {
  const response = await get("/v1/events");
  if (!response.ok) throw new Error(`API /v1/events : ${response.status}`);
  return response.json();
}

export type EventSummary = { months: { month: string; events: number; guests: number }[] };

/** Événements créés et invités ajoutés par mois, sur 6 mois (tableau de bord). */
export async function getEventsSummary(): Promise<EventSummary> {
  const response = await get("/v1/events/summary");
  if (!response.ok) throw new Error(`API /v1/events/summary : ${response.status}`);
  return response.json();
}

export async function getEvent(id: string): Promise<EventOut> {
  const response = await get(`/v1/events/${encodeURIComponent(id)}`);
  if (response.status === 404 || response.status === 422) notFound();
  if (!response.ok) throw new Error(`API /v1/events/${id} : ${response.status}`);
  return response.json();
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: EVENT_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: EVENT_TIME_ZONE, hour: "2-digit", minute: "2-digit" });

export function formatDate(iso: string): string {
  const text = dateFormat.format(new Date(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const shortDateFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: EVENT_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** « 31 oct. 2026 » : pour les espaces étroits (sans le jour, dont la longueur varie). */
export function formatShortDate(iso: string): string {
  return shortDateFormat.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso)).replace(":", " h ");
}

// Valeurs des champs date et heure du formulaire (heure d'Abidjan = UTC).
export function toDateInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function toTimeInput(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
}
