import "server-only";
import { notFound, redirect } from "next/navigation";
import { apiFetch } from "./api";
import { getCurrentUser } from "./auth";
import type { EventType } from "./event-types";
import type { SupportThread } from "./support";
import { getSessionToken } from "./session";

// Portail admin (équipe Here!) : données de /v1/admin, réservées au rôle admin.

export type EventStatus = "draft" | "active" | "done" | "cancelled";
export type RsvpStatus = "pending" | "confirmed" | "declined";

export type Trend = { total: number; new: number; trend_pct: number | null };
export type SendStats = Trend & { delivered: number; read: number };

export type DayPoint = { day: string; organizers: number; guests: number; sent: number; failed: number };

export type Activity = {
  kind: "organizer" | "event" | "invitations" | "responses" | "failures";
  title: string;
  detail: string;
  at: string;
};

export type AdminDashboard = {
  period_days: number;
  organizers: Trend;
  events: Trend;
  events_by_status: Record<EventStatus, number>;
  upcoming_events: number;
  guests: Trend;
  rsvp: Record<RsvpStatus, number>;
  invitations: SendStats;
  reminders: SendStats;
  messages_queued: number;
  messages_failed: Trend;
  checkins: number;
  calls_scheduled: number;
  series: DayPoint[];
  activity: Activity[];
  provider: {
    name: "console" | "wasender";
    configured: boolean;
    min_delay_seconds: number;
    max_delay_seconds: number;
    send_start_hour: number;
    send_end_hour: number;
  };
};

export type AdminUser = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  organization: string | null;
  city: string | null;
  country: string | null;
  role: "organizer" | "support" | "admin";
  on_demand_reminders: boolean;
  day_before_reminders: boolean;
  created_at: string;
  last_login_at: string | null;
  events: number;
};

export type AdminEvent = {
  id: string;
  title: string;
  type: EventType;
  status: EventStatus;
  starts_at: string;
  organizer_id: string;
  organizer_name: string;
  guests: number;
  cards: number;
  invitations_sent: number;
  confirmed: number;
  declined: number;
  pending: number;
  checkins: number;
  messages_failed: number;
};

export const PERIODS = [7, 30, 90] as const;

/** Réservé au rôle admin : sinon, la page n'existe pas (pas d'indice sur le portail). */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (user.role !== "admin") notFound();
  return user;
}

/** Équipe Here! : admin, ou support (la conseillère : seulement l'écran des appels et des messages). */
export async function requireStaff() {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "support") notFound();
  return user;
}

async function adminFetch<T>(path: string): Promise<T> {
  const response = await apiFetch(`/v1/admin${path}`, { token: await getSessionToken() });
  if (response.status === 401) redirect("/connexion");
  if (response.status === 403 || response.status === 404 || response.status === 422) notFound();
  if (!response.ok) throw new Error(`API /v1/admin${path} : ${response.status}`);
  return response.json();
}

export function getDashboard(days: number): Promise<AdminDashboard> {
  return adminFetch(`/dashboard?days=${days}`);
}

export type AdminUserDetail = AdminUser & { billing_address: string | null; tax_id: string | null; event_list: AdminEvent[] };

export type PlatformValues = {
  whatsapp_provider: "console" | "wasender";
  whatsapp_reminder_days_before: number[];
  whatsapp_min_delay_seconds: number;
  whatsapp_max_delay_seconds: number;
  whatsapp_batch_size: number;
  whatsapp_batch_pause_minutes: number;
  whatsapp_send_start_hour: number;
  whatsapp_send_end_hour: number;
  whatsapp_day_before_hour: number;
};

export type PlatformSettings = {
  values: PlatformValues;
  defaults: PlatformValues;
  overridden: (keyof PlatformValues)[];
  providers: { value: string; label: string; available: boolean; configured: boolean }[];
  updated_at: string | null;
};

export const PAGE_SIZE = 50;

export function getUsers(query: { q?: string; limit: number; offset?: number }): Promise<{ total: number; items: AdminUser[] }> {
  const params = new URLSearchParams({ limit: String(query.limit), offset: String(query.offset ?? 0) });
  if (query.q) params.set("q", query.q);
  return adminFetch(`/users?${params}`);
}

export function getUser(id: string): Promise<AdminUserDetail> {
  return adminFetch(`/users/${encodeURIComponent(id)}`);
}

export function getEvents(query: {
  q?: string;
  status?: EventStatus;
  period?: "upcoming" | "past";
  limit: number;
  offset?: number;
}): Promise<{ total: number; items: AdminEvent[] }> {
  const params = new URLSearchParams({ limit: String(query.limit), offset: String(query.offset ?? 0) });
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.period) params.set("period", query.period);
  return adminFetch(`/events?${params}`);
}

export function getSettings(): Promise<PlatformSettings> {
  return adminFetch("/settings");
}

export type CallOutcome = "confirmed" | "declined" | "no_answer" | "wrong_number";

export type StaffCall = {
  id: string;
  guest_id: string;
  guest_name: string;
  phone: string | null;
  phone_valid: boolean;
  category: string;
  seats: number;
  rsvp_status: RsvpStatus;
  event_id: string;
  event_title: string;
  event_type: EventType;
  event_starts_at: string;
  host: string;
  reminders_sent: number;
  scheduled_at: string;
  called_at: string | null;
  outcome: CallOutcome | null;
  notes: string | null;
  agent_name: string | null;
};

export type StaffMessage = {
  id: string;
  body: string;
  phone: string;
  received_at: string;
  handled_at: string | null;
  guest_id: string | null;
  guest_name: string | null;
  rsvp_status: RsvpStatus | null;
  event_title: string | null;
};

export function getCalls(done: boolean): Promise<{ to_do: number; done: number; items: StaffCall[] }> {
  return adminFetch(`/calls?state=${done ? "faits" : "a-faire"}`);
}

export function getInbound(done: boolean): Promise<{ to_do: number; done: number; items: StaffMessage[] }> {
  return adminFetch(`/inbound?state=${done ? "traites" : "a-traiter"}`);
}

export function getQuestions(all: boolean): Promise<{ waiting: number; total: number; items: SupportThread[] }> {
  return adminFetch(`/questions?state=${all ? "toutes" : "a-traiter"}`);
}
