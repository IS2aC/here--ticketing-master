import { apiFetch } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

// Fond importé (« Mon propre modèle »), pour l'éditeur de la page Carte.
export async function GET(_: Request, { params }: RouteContext<"/tableau-de-bord/evenements/[id]/carte/fond.jpg">) {
  const { id } = await params;
  const response = await apiFetch(`/v1/events/${encodeURIComponent(id)}/card/background`, { token: await getSessionToken() });
  if (!response.ok) return new Response("Pas de fond importé", { status: 404 });
  return new Response(await response.arrayBuffer(), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=600" } });
}
