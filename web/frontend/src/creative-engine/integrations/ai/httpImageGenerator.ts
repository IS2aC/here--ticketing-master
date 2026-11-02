import {
  GENERATION_ERROR_MESSAGES,
  type GeneratedImagePayload,
  type ImageGenerationCapabilities,
  type ImageGenerationErrorCode,
  type ImageGenerationRequest,
} from "./contract.ts";

// Client du contrat de génération (contract.ts) : ce que l'éditeur sait de la génération d'images. Il ne connaît
// ni le fournisseur, ni son URL, ni sa clé : seulement les routes de l'hôte. Un autre hôte peut fournir sa propre
// implémentation d'ImageGenerator (par exemple Here!, avec son authentification).

export interface GeneratedImage {
  /** Identifiant local du résultat (pas un identifiant de document). */
  readonly id: string;
  readonly blob: Blob;
  readonly mimeType: GeneratedImagePayload["mimeType"];
  readonly width: number | null;
  readonly height: number | null;
}

export interface GenerationError {
  readonly code: ImageGenerationErrorCode;
  readonly message: string;
  readonly retryAfterSeconds?: number;
}

export type GenerationOutcome<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: GenerationError };

export interface ImageGenerator {
  capabilities(signal?: AbortSignal): Promise<GenerationOutcome<ImageGenerationCapabilities>>;
  generate(
    request: ImageGenerationRequest,
    signal?: AbortSignal,
  ): Promise<GenerationOutcome<{ images: GeneratedImage[]; provider: string; model: string }>>;
}

/** Délai côté navigateur : large, le serveur applique déjà le délai du fournisseur (IMAGE_TIMEOUT_SECONDS). */
const CLIENT_TIMEOUT_MS = 11 * 60 * 1000;

const CODES = new Set(Object.keys(GENERATION_ERROR_MESSAGES));

export function generationError(code: ImageGenerationErrorCode, retryAfterSeconds?: number): GenerationError {
  const message = GENERATION_ERROR_MESSAGES[code];
  return retryAfterSeconds === undefined ? { code, message } : { code, message, retryAfterSeconds };
}

const fail = <T>(code: ImageGenerationErrorCode, retryAfterSeconds?: number): GenerationOutcome<T> => ({
  ok: false,
  error: generationError(code, retryAfterSeconds),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const DISABLED: ImageGenerationCapabilities = {
  enabled: false,
  provider: null,
  model: null,
  sizes: [],
  maxImages: 0,
  maxPromptLength: 0,
};

function readCapabilities(body: unknown): ImageGenerationCapabilities | null {
  if (!isRecord(body) || typeof body.enabled !== "boolean") return null;
  if (!body.enabled) return DISABLED;
  const sizes = Array.isArray(body.sizes) ? body.sizes.filter((s): s is string => typeof s === "string") : [];
  if (sizes.length === 0 || typeof body.maxImages !== "number" || typeof body.maxPromptLength !== "number")
    return null;
  return {
    enabled: true,
    provider: typeof body.provider === "string" ? body.provider : null,
    model: typeof body.model === "string" ? body.model : null,
    sizes,
    maxImages: Math.max(1, Math.floor(body.maxImages)),
    maxPromptLength: body.maxPromptLength,
  };
}

function toBlob(payload: unknown): GeneratedImage | null {
  if (!isRecord(payload) || typeof payload.data !== "string") return null;
  if (
    payload.mimeType !== "image/png" &&
    payload.mimeType !== "image/jpeg" &&
    payload.mimeType !== "image/webp"
  )
    return null;
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(payload.data), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  if (bytes.length === 0) return null;
  return {
    id: crypto.getRandomValues(new Uint32Array(2)).join("-"),
    blob: new Blob([bytes.slice().buffer], { type: payload.mimeType }),
    mimeType: payload.mimeType,
    width: typeof payload.width === "number" ? payload.width : null,
    height: typeof payload.height === "number" ? payload.height : null,
  };
}

function errorFrom(body: unknown, status: number): GenerationError {
  const error = isRecord(body) && isRecord(body.error) ? body.error : null;
  const code =
    error && typeof error.code === "string" && CODES.has(error.code)
      ? (error.code as ImageGenerationErrorCode)
      : null;
  const wait = error && typeof error.retryAfterSeconds === "number" ? error.retryAfterSeconds : undefined;
  if (code) return generationError(code, wait);
  return generationError(status === 404 ? "not_configured" : "provider_error");
}

export function createHttpImageGenerator(options: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): ImageGenerator {
  const fetchImpl =
    options.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const base = options.baseUrl.replace(/\/+$/, "");

  async function call(path: string, init: RequestInit, signal?: AbortSignal) {
    const timeout = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const response = await fetchImpl(`${base}${path}`, {
        ...init,
        signal: combined,
        credentials: "same-origin",
      });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { response, body } as const;
    } catch {
      if (signal?.aborted) return "aborted" as const;
      return timeout.aborted ? ("timeout" as const) : ("network" as const);
    }
  }

  return {
    async capabilities(signal) {
      const result = await call("/capabilities", { method: "GET" }, signal);
      if (typeof result === "string") return fail(result);
      // Pas de route (hébergement statique sans serveur) : la génération n'existe pas ici.
      if (result.response.status === 404) return { ok: true, value: DISABLED };
      if (!result.response.ok) return { ok: false, error: errorFrom(result.body, result.response.status) };
      const capabilities = readCapabilities(result.body);
      return capabilities ? { ok: true, value: capabilities } : fail("invalid_response");
    },

    async generate(request, signal) {
      const result = await call(
        "/generate",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) },
        signal,
      );
      if (typeof result === "string") return fail(result);
      if (!result.response.ok) return { ok: false, error: errorFrom(result.body, result.response.status) };
      const body = result.body;
      if (!isRecord(body) || !Array.isArray(body.images)) return fail("invalid_response");
      if (body.images.length === 0) return fail("no_image");
      const images = body.images.map(toBlob);
      if (images.some((image) => image === null)) return fail("invalid_response");
      return {
        ok: true,
        value: {
          images: images.filter((image): image is GeneratedImage => image !== null),
          provider: typeof body.provider === "string" ? body.provider : "",
          model: typeof body.model === "string" ? body.model : "",
        },
      };
    },
  };
}
