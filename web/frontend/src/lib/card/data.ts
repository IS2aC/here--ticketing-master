import "server-only";
import type { EventType } from "@/lib/event-types";
import type { CardLayout } from "./layout";
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
  rsvp_status: "pending" | "confirmed" | "declined";
  attending_seats: number | null;
  rsvp_message: string | null;
  responses_open: boolean;
  responses_until: string; // date limite de réponse, sinon début de l'événement
  rsvp_deadline: string | null;
  card_title: string | null; // intitulé choisi par l'organisateur
  card_palette: string | null;
  card_layout: CardLayout | null; // « Mon propre modèle »
};

export function fromPublicCard(card: PublicCard, token: string): CardData {
  return {
    type: card.event_type,
    title: card.card_title ?? card.title,
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
    palette: card.card_palette,
    layout: card.card_layout,
  };
}

// Invité fictif des aperçus, quand la liste est vide.
export const SAMPLE_GUEST = { guestName: "Monsieur et Madame Konan", category: "VIP", seat: "Table 4", seats: 2 };
export const SAMPLE_CODE = "INV-APER-CU00";

/** Fond importé (« Mon propre modèle ») en data: URI pour le rendu de la carte ; null s'il manque. */
export async function backgroundUri(response: Response | null): Promise<string | null> {
  if (!response?.ok) return null;
  return `data:image/jpeg;base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
}

