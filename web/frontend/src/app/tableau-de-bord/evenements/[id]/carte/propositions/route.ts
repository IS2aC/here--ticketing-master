import { getEvent } from "@/lib/events";
import { proposeCharters } from "@/lib/card/proposals";

// Cartes proposées pour l'événement (étape C1) : trois chartes, que l'éditeur compose et montre.
// getEvent passe par la session : seul l'organisateur de l'événement obtient une réponse.
export async function POST(request: Request, { params }: RouteContext<"/tableau-de-bord/evenements/[id]/carte/propositions">) {
  const event = await getEvent((await params).id);
  const body = (await request.json().catch(() => ({}))) as { photoColors?: unknown };
  const photoColors = Array.isArray(body.photoColors)
    ? body.photoColors.filter((c): c is string => typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c)).slice(0, 6)
    : [];
  const result = await proposeCharters(event, photoColors);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
