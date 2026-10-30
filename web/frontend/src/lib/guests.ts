import "server-only";
import { notFound } from "next/navigation";
import { apiFetch } from "./api";
import { getSessionToken } from "./session";

export type RowStatus = "ready" | "phone_missing" | "phone_invalid" | "name_missing" | "category_unknown" | "duplicate";

export type ImportOut = {
  id: string;
  event_id: string;
  file_name: string;
  status: "pending" | "processing" | "done" | "failed";
  created_at: string;
  columns: { header: string; field: string | null; label: string | null }[];
  summary: {
    total: number;
    to_import: number;
    to_verify: number;
    not_imported: number;
    duplicates: number;
    by_category: Record<string, number>;
  };
  imported_rows: number;
  rows: {
    line: number;
    display_name: string;
    last_name: string | null;
    first_names: string | null;
    phone: string | null;
    phone_valid: boolean;
    category: string | null;
    raw_category: string | null;
    seat: string | null;
    seats: number;
    status: RowStatus;
  }[];
};

export type GuestOut = {
  id: string;
  invitation_token: string | null;
  display_name: string;
  last_name: string | null;
  first_names: string | null;
  phone: string | null;
  phone_valid: boolean;
  category_id: string;
  category: string;
  seat: string | null;
  seats: number;
  rsvp_status: "pending" | "confirmed" | "declined";
  attending_seats: number | null;
  rsvp_message: string | null;
  contact_status: "none" | "reminded" | "call_scheduled" | "unreachable";
  opened_at: string | null; // page de l'invitation ouverte par l'invité
};

async function getJson<T>(path: string): Promise<T> {
  const response = await apiFetch(path, { token: await getSessionToken() });
  if (response.status === 404 || response.status === 422) notFound();
  if (!response.ok) throw new Error(`API ${path} : ${response.status}`);
  return response.json();
}

export function getGuests(eventId: string): Promise<GuestOut[]> {
  return getJson(`/v1/events/${encodeURIComponent(eventId)}/guests`);
}

export function getImport(eventId: string, importId: string): Promise<ImportOut> {
  return getJson(`/v1/events/${encodeURIComponent(eventId)}/imports/${encodeURIComponent(importId)}`);
}

export function getGuest(guestId: string): Promise<GuestOut> {
  return getJson(`/v1/guests/${encodeURIComponent(guestId)}`);
}
