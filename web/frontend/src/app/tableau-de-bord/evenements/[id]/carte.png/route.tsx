import { apiFetch } from "@/lib/api";
import { SAMPLE_CODE, SAMPLE_GUEST, invitationUrl } from "@/lib/card/data";
import { renderCard } from "@/lib/card/render";
import type { EventOut } from "@/lib/events";
import type { GuestOut } from "@/lib/guests";
import { getSessionToken } from "@/lib/session";

// Aperçu de la carte de l'événement pour l'organisateur : ?invite=<id> pour un invité précis, sinon le premier.
export async function GET(request: Request, { params }: RouteContext<"/tableau-de-bord/evenements/[id]/carte.png">) {
  const { id } = await params;
  const token = await getSessionToken();
  const [eventResponse, guestsResponse] = await Promise.all([
    apiFetch(`/v1/events/${encodeURIComponent(id)}`, { token }),
    apiFetch(`/v1/events/${encodeURIComponent(id)}/guests`, { token }),
  ]);
  if (!eventResponse.ok || !guestsResponse.ok) return new Response("Événement introuvable", { status: 404 });
  const event = (await eventResponse.json()) as EventOut;
  const guests = (await guestsResponse.json()) as GuestOut[];
  const wanted = new URL(request.url).searchParams.get("invite");
  const guest = guests.find((g) => g.id === wanted) ?? guests[0];

  return renderCard(
    {
      type: event.type,
      title: event.title,
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
    { "Cache-Control": "private, no-store" },
  );
}
