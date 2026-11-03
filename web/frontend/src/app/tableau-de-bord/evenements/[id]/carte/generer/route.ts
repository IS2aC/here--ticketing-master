import type { ReferenceImage } from "@/creative-engine/integrations/ai/contract";
import { imageGenerationService } from "@/creative-engine/server/imageGeneration/service";
import { cardImagePrompt, MAX_PHOTOS, MAX_REQUEST_LENGTH } from "@/lib/card/imagePrompt";
import { cardFacts } from "@/lib/card/proposals";
import { getEvent } from "@/lib/events";

// « Créer avec l'IA » (lots D2 et D3) : pré-prompt du type d'événement + demande de l'organisateur + données de
// l'événement + photos de référence → une illustration sans texte, au format de la carte. L'éditeur compose
// ensuite la carte autour (host/proposals/aiCard.ts). getEvent passe par la session : seul l'organisateur de
// l'événement peut générer. Corps : multipart, `prompt` et `photos` (0 à 4 images, réduites par le navigateur).

const invalid = (message: string) => Response.json({ error: { code: "invalid_request", message } }, { status: 400 });

export async function POST(request: Request, { params }: RouteContext<"/tableau-de-bord/evenements/[id]/carte/generer">) {
  const event = await getEvent((await params).id);
  const form = await request.formData().catch(() => null);
  const prompt = form?.get("prompt");
  const asked = typeof prompt === "string" ? prompt.trim() : "";
  if (!asked || asked.length > MAX_REQUEST_LENGTH)
    return invalid(`Décrivez la carte souhaitée en ${MAX_REQUEST_LENGTH} caractères au plus.`);

  const service = imageGenerationService();
  const capabilities = service.capabilities().body as { sizes?: string[]; maxReferences?: number };
  const allowed = Math.min(MAX_PHOTOS, capabilities.maxReferences ?? 0);
  const files = (form?.getAll("photos") ?? []).filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > allowed)
    return invalid(allowed > 0 ? `Ajoutez ${allowed} photos au plus.` : "Ce service de génération ne prend pas de photos.");
  // Le type est vérifié par le service (signature du fichier), pas sur la déclaration du navigateur.
  const references: ReferenceImage[] = await Promise.all(
    files.map(async (file) => ({
      mimeType: (file.type || "image/jpeg") as ReferenceImage["mimeType"],
      data: Buffer.from(await file.arrayBuffer()).toString("base64"),
    })),
  );

  const sizes = capabilities.sizes ?? [];
  // Format portrait 4:5 si le fournisseur le connaît, sinon son format par défaut (le moteur recadre).
  const size = sizes.find((s) => s === "4:5" || s === "1080x1350" || s === "1024x1280") ?? sizes[0];
  const result = await service.generate(
    { prompt: cardImagePrompt(cardFacts(event), asked, references.length), size, count: 1, noText: true, references },
    request.signal,
  );
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
