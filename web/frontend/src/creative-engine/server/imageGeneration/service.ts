import "server-only";
import { readImageGenerationConfig } from "./config.ts";
import { createGenerationService, type GenerationService } from "./handler.ts";

// Service unique par serveur Next, configuré une fois depuis l'environnement (IMAGE_*, voir config.ts).
let service: GenerationService | null = null;

export function imageGenerationService(): GenerationService {
  if (!service) {
    const config = readImageGenerationConfig(process.env);
    if (config.status === "invalid") console.error(`Génération d'images désactivée : ${config.problems.join(" ; ")}`);
    service = createGenerationService(config);
  }
  return service;
}

/** Plus grande requête acceptée : une description et ses options tiennent en quelques Ko. */
export const MAX_BODY_BYTES = 16 * 1024;
