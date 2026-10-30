import { apiFetch } from "@/lib/api";
import { SAMPLE_CODE, SAMPLE_GUEST, invitationUrl } from "@/lib/card/data";
import { renderCard } from "@/lib/card/render";
import type { CardSettings, EventOut } from "@/lib/events";
import type { GuestOut } from "@/lib/guests";
import { getSessionToken } from "@/lib/session";

// Aperçu de la carte de l'événement pour l'organisateur : ?invite=<id> pour un invité précis, sinon le premier.
// ?couverture : couverture du tableau de bord, avec un invité fictif (pas de liste à charger) et mise en cache.
export async function GET(request: Request, { params }: RouteContext<"/tableau-de-bord/evenements/[id]/carte.png">) {
  const { id } = await params;
  const token = await getSessionToken();
  const query = new URL(request.url).searchParams;
  const cover = query.has("couverture");
  const [eventResponse, guestsResponse, cardResponse] = await Promise.all([
    apiFetch(`/v1/events/${encodeURIComponent(id)}`, { token }),
    cover ? null : apiFetch(`/v1/events/${encodeURIComponent(id)}/guests`, { token }),
    apiFetch(`/v1/events/${encodeURIComponent(id)}/card`, { token }),
  ]);
  if (!eventResponse.ok || (guestsResponse && !guestsResponse.ok)) return new Response("Événement introuvable", { status: 404 });
  const event = (await eventResponse.json()) as EventOut;
  const guests = guestsResponse ? ((await guestsResponse.json()) as GuestOut[]) : [];
  const saved = cardResponse.ok ? ((await cardResponse.json()) as CardSettings) : null;
  // Essai avant d'enregistrer (?palette=, ?titre=) : aperçu en direct de la page Carte.
  const palette = query.get("palette") ?? saved?.palette ?? null;
  const title = query.get("titre")?.trim() || saved?.title || event.title;
  const wanted = query.get("invite");
  const guest = guests.find((g) => g.id === wanted) ?? guests[0];

  return renderCard(
    {
      type: event.type,
      title,
      palette,
      startsAt: event.starts_at,
      durationMinutes: event.duration_minutes,
      locationName: event.location_name,
      locationAddress: event.location_address,
      dressCode: event.dress_code,
      ...(guest
        ? { guestName: guest.display_name, category: guest.category, seat: guest.seat, seats: 1 }
        : SAMPLE_GUEST),
      code: SAMPLE_CODE,
      qrValue: invitationUrl(guest?.invitation_token ?? "apercu"),
    },
    // Couverture : l'adresse change avec l'événement (?v=<date de modification>), on peut la garder.
    { "Cache-Control": cover ? "private, max-age=86400" : "private, no-store" },
  );
}
