import { imageGenerationService, MAX_BODY_BYTES } from "@/creative-engine/server/imageGeneration/service";
import { isOrganizer, reply, UNAUTHORIZED } from "../organizer";

// Génération d'images de l'éditeur de cartes. Journalise seulement le code d'erreur et la durée :
// ni description (contenu privé), ni clé, ni adresse du fournisseur.
export async function POST(request: Request) {
  if (!(await isOrganizer())) return UNAUTHORIZED();
  const text = await request.text();
  let body: unknown;
  try {
    body = text.length > MAX_BODY_BYTES ? undefined : JSON.parse(text);
  } catch {
    body = undefined;
  }
  const started = Date.now();
  // Le navigateur abandonne (annulation, page fermée) : la requête au fournisseur est interrompue.
  const result = await imageGenerationService().generate(body, request.signal);
  const code = (result.body as { error?: { code?: string } }).error?.code;
  console.info(`génération d'image : ${code ?? "réussie"} en ${Math.round((Date.now() - started) / 100) / 10} s`);
  return reply(result);
}
