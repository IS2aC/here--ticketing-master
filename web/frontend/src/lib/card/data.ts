import "server-only";
import type { EventType } from "@/lib/event-types";
import type { CardData } from "./render";

// Lien de l'invitation porté par le QR code (page invité).
export function invitationUrl(token: string): string {
  const base = process.env.PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(`/i/${encodeURIComponent(token)}`, base).toString();
}

export type PublicCard = {
  code: string;
  event_type: EventType;
  title: string;
  starts_at: string;
  duration_minutes: number | null;
  location_name: string | null;
  location_address: string | null;
  dress_code: string | null;
  guest_name: string;
  category: string;
  seat: string | null;
  seats: number;
};

export function fromPublicCard(card: PublicCard, token: string): CardData {
  return {
    type: card.event_type,
    title: card.title,
    startsAt: card.starts_at,
    durationMinutes: card.duration_minutes,
    locationName: card.location_name,
    locationAddress: card.location_address,
    dressCode: card.dress_code,
    guestName: card.guest_name,
    category: card.category,
    seat: card.seat,
    seats: card.seats,
    code: card.code,
    qrValue: invitationUrl(token),
  };
}

// Invité fictif des aperçus, quand la liste est vide.
export const SAMPLE_GUEST = { guestName: "Monsieur et Madame Konan", category: "VIP", seat: "Table 4", seats: 2 };
export const SAMPLE_CODE = "INV-APER-CU00";
