import type {
  GeneratedImagePayload,
  ImageGenerationErrorCode,
  ImageGenerationResponse,
} from "../../integrations/ai/contract.ts";
import { sniffImageType } from "../../persistence/imageFormats.ts";

// Outils communs aux adaptateurs de fournisseurs : résultat, vérification des images renvoyées, en-têtes HTTP.

export type ProviderOutcome =
  | { readonly ok: true; readonly value: ImageGenerationResponse }
  | { readonly ok: false; readonly code: ImageGenerationErrorCode; readonly retryAfterSeconds?: number };

/** Taille maximale d'une image renvoyée, une fois décodée. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Dimensions lues dans l'en-tête d'un PNG ; null pour les autres formats (le navigateur les mesurera). */
function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Octets renvoyés par un fournisseur → image du contrat, après vérification de la signature et de la taille. */
export function imageFromBytes(bytes: Uint8Array): GeneratedImagePayload | ImageGenerationErrorCode {
  if (bytes.length === 0) return "no_image";
  if (bytes.length > MAX_IMAGE_BYTES) return "unsupported_format";
  const mimeType = sniffImageType(bytes);
  if (!mimeType) return "unsupported_format";
  const size = mimeType === "image/png" ? pngSize(bytes) : null;
  return {
    mimeType,
    data: Buffer.from(bytes).toString("base64"),
    width: size?.width ?? null,
    height: size?.height ?? null,
  };
}

export function retryAfter(response: Response): number | undefined {
  const value = Number(response.headers.get("retry-after"));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Signal combinant l'annulation par le navigateur et le délai maximal de la configuration. */
export function deadline(
  timeoutMs: number,
  signal?: AbortSignal,
): { signal: AbortSignal; timeout: AbortSignal } {
  const timeout = AbortSignal.timeout(timeoutMs);
  return { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, timeout };
}
