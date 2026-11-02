import { imageGenerationService } from "@/creative-engine/server/imageGeneration/service";
import { isOrganizer, reply, UNAUTHORIZED } from "../organizer";

// Génération d'images de l'éditeur de cartes : fournisseur configuré, formats proposés (sans la clé).
export async function GET() {
  if (!(await isOrganizer())) return UNAUTHORIZED();
  return reply(imageGenerationService().capabilities());
}
