import type { ReferenceImage } from "../../integrations/ai/contract.ts";
import type { ImageGenerationConfig } from "./config.ts";
import { MAX_PROMPT_LENGTH, maxReferences } from "./config.ts";
import { sniffImageType } from "../../persistence/imageFormats.ts";

// Validation côté serveur des paramètres qui coûtent (nombre d'images, taille) : le navigateur n'est pas cru
// sur parole. Le modèle n'est jamais choisi par le navigateur : c'est celui de la configuration.

export interface ValidRequest {
  readonly prompt: string;
  readonly size: string;
  readonly count: number;
  readonly noText: boolean;
  readonly references: readonly ReferenceImage[];
}

/** Taille maximale d'une photo de référence (le navigateur les réduit avant l'envoi). */
export const MAX_REFERENCE_BYTES = 4 * 1024 * 1024;

/** Consigne ajoutée à la description quand l'image doit être sans texte (en français et en anglais : selon le modèle). */
export const NO_TEXT_INSTRUCTION =
  "Aucun texte, aucune lettre, aucun chiffre ni logo dans l'image. No text, no letters, no numbers, no typography.";

/** Description réellement envoyée au fournisseur. */
export function providerPrompt(request: ValidRequest): string {
  return request.noText ? `${request.prompt}\n\n${NO_TEXT_INSTRUCTION}` : request.prompt;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateGenerationRequest(body: unknown, config: ImageGenerationConfig): ValidRequest | null {
  if (!isRecord(body) || typeof body.prompt !== "string") return null;
  // Caractères de contrôle retirés (sauf retours à la ligne) ; espaces superflus normalisés.
  const prompt = Array.from(body.prompt, (c) => {
    const code = c.charCodeAt(0);
    return code === 10 || (code >= 32 && code !== 127) ? c : " ";
  })
    .join("")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (prompt.length === 0 || prompt.length > MAX_PROMPT_LENGTH) return null;

  const size = body.size === undefined ? config.sizes[0] : body.size;
  if (typeof size !== "string" || !config.sizes.includes(size)) return null;

  const count = body.count === undefined ? 1 : body.count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > config.maxImages)
    return null;

  if (body.noText !== undefined && typeof body.noText !== "boolean") return null;

  // Photos de référence : vérifiées comme les images du fournisseur (signature), en nombre et en taille.
  const raw = body.references === undefined ? [] : body.references;
  if (!Array.isArray(raw) || raw.length > maxReferences(config)) return null;
  const references: ReferenceImage[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.data !== "string") return null;
    const bytes = Buffer.from(item.data, "base64");
    if (bytes.length === 0 || bytes.length > MAX_REFERENCE_BYTES) return null;
    const mimeType = sniffImageType(Uint8Array.from(bytes));
    if (mimeType !== "image/png" && mimeType !== "image/jpeg" && mimeType !== "image/webp") return null;
    references.push({ mimeType, data: item.data });
  }

  return { prompt, size, count, noText: body.noText === true, references };
}
