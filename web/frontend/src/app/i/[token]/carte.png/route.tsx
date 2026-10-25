import { apiFetch } from "@/lib/api";
import { fromPublicCard, type PublicCard } from "@/lib/card/data";
import { renderCard } from "@/lib/card/render";

// Image de la carte d'un invité (envoyée sur WhatsApp). Publique : le jeton long et aléatoire est la seule clé.
export async function GET(_: Request, { params }: RouteContext<"/i/[token]/carte.png">) {
  const { token } = await params;
  const response = await apiFetch(`/v1/invitations/${encodeURIComponent(token)}`);
  if (response.status === 404) return new Response("Invitation introuvable", { status: 404 });
  if (!response.ok) return new Response("Carte indisponible", { status: 502 });
  const card = (await response.json()) as PublicCard;
  return renderCard(fromPublicCard(card, token), { "Cache-Control": "private, max-age=60" });
}
