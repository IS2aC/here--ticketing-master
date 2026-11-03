import { imageGenerationService } from "@/creative-engine/server/imageGeneration/service";
import { cardImagePrompt, MAX_REQUEST_LENGTH } from "@/lib/card/imagePrompt";
import { cardFacts } from "@/lib/card/proposals";
import { getEvent } from "@/lib/events";

// « Créer avec l'IA » (lot D2) : la demande de l'organisateur + les données de l'événement → une illustration
// sans texte, au format de la carte. L'éditeur compose ensuite la carte autour (host/proposals/aiCard.ts).
// getEvent passe par la session : seul l'organisateur de l'événement peut générer.
export async function POST(request: Request, { params }: RouteContext<"/tableau-de-bord/evenements/[id]/carte/generer">) {
  const event = await getEvent((await params).id);
  const body = (await request.json().catch(() => ({}))) as { prompt?: unknown };
  const asked = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!asked || asked.length > MAX_REQUEST_LENGTH)
    return Response.json(
      { error: { code: "invalid_request", message: `Décrivez la carte souhaitée en ${MAX_REQUEST_LENGTH} caractères au plus.` } },
      { status: 400 },
    );
  const service = imageGenerationService();
  const sizes = (service.capabilities().body as { sizes?: string[] }).sizes ?? [];
  // Format portrait 4:5 si le fournisseur le connaît, sinon son format par défaut (le moteur recadre).
  const size = sizes.find((s) => s === "4:5" || s === "1080x1350" || s === "1024x1280") ?? sizes[0];
  const result = await service.generate(
    { prompt: cardImagePrompt(cardFacts(event), asked), size, count: 1, noText: true },
    request.signal,
  );
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
