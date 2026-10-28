import "server-only";
import { notFound } from "next/navigation";
import { apiFetch } from "./api";
import { getSessionToken } from "./session";

export type MessageStatus = "scheduled" | "sending" | "sent" | "delivered" | "read" | "failed" | "canceled";

export type MessageCounts = {
  scheduled: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  canceled: number;
};

export type WhatsAppOverview = {
  provider: "wasender" | "console";
  configured: boolean;
  reminders_enabled: boolean;
  reminder_days_before: number[];
  reminder_dates: string[];
  calls_enabled: boolean;
  on_demand_reminders: boolean;
  ready: number;
  without_phone: number;
  without_card: number;
  to_remind: number;
  calls_scheduled: number;
  invitations: MessageCounts;
  reminders: MessageCounts;
  recent: {
    id: string;
    guest_name: string;
    kind: "invitation" | "reminder";
    status: MessageStatus;
    scheduled_at: string;
    sent_at: string | null;
    error: string | null;
  }[];
  inbound: { id: string; guest_name: string | null; body: string; received_at: string }[];
};

export async function getWhatsApp(eventId: string): Promise<WhatsAppOverview> {
  const response = await apiFetch(`/v1/events/${encodeURIComponent(eventId)}/whatsapp`, {
    token: await getSessionToken(),
  });
  if (response.status === 404 || response.status === 422) notFound();
  if (!response.ok) throw new Error(`API /v1/events/${eventId}/whatsapp : ${response.status}`);
  return response.json();
}

// Envoyés = partis, livrés ou lus (les statuts avancent : un message lu a aussi été livré).
export function sentTotal(c: MessageCounts): number {
  return c.sent + c.delivered + c.read;
}
