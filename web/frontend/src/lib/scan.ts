import type { EventType } from "./event-types";

// Types de l'API de scan (web/api/app/routers/scan.py).

export type ScanEvent = {
  title: string;
  event_type: EventType;
  starts_at: string;
  label: string;
  arrived: number;
  expected: number;
};

export type ScanGuest = {
  guest_id: string;
  name: string;
  category: string;
  seat: string | null;
  seats: number;
  rsvp_status: "pending" | "confirmed" | "declined";
  code: string;
  entered_at: string | null;
};

export type ScanResult = {
  result: "admitted" | "already" | "unknown";
  code: string | null;
  guest: ScanGuest | null;
  entered_at: string | null;
  entered_by: string | null;
  event: ScanEvent;
};

export type ScanLinkOut = {
  id: string;
  label: string;
  token: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  active: boolean;
  checkins: number;
};
