import "server-only";
import { notFound, redirect } from "next/navigation";
import { apiFetch } from "./api";
import { getCurrentUser } from "./auth";
import type { EventType } from "./event-types";
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

async function adminFetch<T>(path: string): Promise<T> {
  const response = await apiFetch(`/v1/admin${path}`, { token: await getSessionToken() });
  if (response.status === 401) redirect("/connexion");
  if (response.status === 403) notFound();
  if (!response.ok) throw new Error(`API /v1/admin${path} : ${response.status}`);
  return response.json();
}

export function getDashboard(days: number): Promise<AdminDashboard> {
  return adminFetch(`/dashboard?days=${days}`);
}

export function getUsers(limit: number): Promise<{ total: number; items: AdminUser[] }> {
  return adminFetch(`/users?limit=${limit}`);
}

export function getEvents(query: { period?: "upcoming" | "past"; limit: number }): Promise<{ total: number; items: AdminEvent[] }> {
  const params = new URLSearchParams({ limit: String(query.limit) });
  if (query.period) params.set("period", query.period);
  return adminFetch(`/events?${params}`);
}
