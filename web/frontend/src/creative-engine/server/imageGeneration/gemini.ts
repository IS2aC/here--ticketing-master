import type { GeneratedImagePayload, ImageGenerationErrorCode } from "../../integrations/ai/contract.ts";
import type { ImageGenerationConfig } from "./config.ts";
import { deadline, imageFromBytes, isRecord, retryAfter, type ProviderOutcome } from "./shared.ts";
import { providerPrompt, type ValidRequest } from "./validate.ts";

// Adaptateur Gemini (Nano Banana) : API Gemini de Google, sans intermédiaire.
//   POST {IMAGE_BASE_URL}/models/{IMAGE_MODEL}:generateContent   en-tête x-goog-api-key
//   { contents: [{ parts: [{ text }] }],
//     generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio, imageSize? } } }
//   → candidates[0].content.parts[].inlineData.data (base64)
// D'après la documentation officielle consultée le 01/11/2026 (ai.google.dev, « Image generation »). Les formats
// sont des ratios (« 4:5 ») ; la résolution (IMAGE_RESOLUTION : 1K, 2K, 4K) n'existe que sur les modèles Gemini 3.
// Une requête produit une image : pour plusieurs variantes, autant de requêtes, l'une après l'autre.
// Toutes les images portent le filigrane invisible SynthID de Google.

/** Erreur HTTP de l'API Google → code du contrat (format { error: { code, status, message, details } }). */
function classify(status: number, body: unknown): ImageGenerationErrorCode {
  const error = isRecord(body) && isRecord(body.error) ? body.error : {};
  const text = JSON.stringify(error).toLowerCase();
  // Une clé invalide répond 400 INVALID_ARGUMENT avec la raison API_KEY_INVALID.
  if (
    status === 401 ||
    status === 403 ||
    text.includes("api_key_invalid") ||
    text.includes("api key not valid")
  )
    return "invalid_key";
  if (text.includes("billing") || (status === 429 && text.includes("quota"))) return "quota_exceeded";
  if (status === 429) return "rate_limited";
  if (status === 404) return "model_unavailable";
  if (status === 408 || status === 504) return "timeout";
  if (status === 400) return "invalid_request";
  return "provider_error";
}

/** Réponse réussie sans image : refus de contenu (blocage, raison de fin liée à la sécurité) ou rien produit. */
function emptyReason(body: Record<string, unknown>): ImageGenerationErrorCode {
  const feedback = isRecord(body.promptFeedback) ? body.promptFeedback : {};
  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  const finish = candidates.map((c) =>
    isRecord(c) && typeof c.finishReason === "string" ? c.finishReason : "",
  );
  const blocked =
    typeof feedback.blockReason === "string" ||
    finish.some((reason) => /SAFETY|PROHIBITED|BLOCK|RECITATION/i.test(reason));
  return blocked ? "prompt_rejected" : "no_image";
}

/** Première image de la réponse (inlineData en camelCase, inline_data en snake_case selon les versions). */
function firstImage(body: Record<string, unknown>): GeneratedImagePayload | ImageGenerationErrorCode {
  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  for (const candidate of candidates) {
    const content = isRecord(candidate) && isRecord(candidate.content) ? candidate.content : null;
    const parts = content && Array.isArray(content.parts) ? content.parts : [];
    for (const part of parts) {
      if (!isRecord(part)) continue;
      const inline = isRecord(part.inlineData)
        ? part.inlineData
        : isRecord(part.inline_data)
          ? part.inline_data
          : null;
      if (inline && typeof inline.data === "string")
        return imageFromBytes(Uint8Array.from(Buffer.from(inline.data, "base64")));
    }
  }
  return emptyReason(body);
}

async function generateOne(
  request: ValidRequest,
  config: ImageGenerationConfig,
  fetchImpl: typeof fetch,
  signals: { signal: AbortSignal; timeout: AbortSignal; user?: AbortSignal },
): Promise<GeneratedImagePayload | { code: ImageGenerationErrorCode; retryAfterSeconds?: number }> {
  const imageConfig: Record<string, string> = { aspectRatio: request.size };
  if (config.resolution) imageConfig.imageSize = config.resolution;
  let response: Response;
  try {
    response = await fetchImpl(
      `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey ?? "" },
        signal: signals.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: providerPrompt(request) }] }],
          generationConfig: { responseModalities: ["IMAGE"], imageConfig },
        }),
      },
    );
  } catch {
    if (signals.user?.aborted) return { code: "aborted" };
    return { code: signals.timeout.aborted ? "timeout" : "provider_error" };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (signals.timeout.aborted) return { code: "timeout" };
    return { code: response.ok ? "invalid_response" : classify(response.status, null) };
  }
  if (!response.ok) {
    const wait = retryAfter(response);
    const code = classify(response.status, body);
    return wait === undefined ? { code } : { code, retryAfterSeconds: wait };
  }
  if (!isRecord(body)) return { code: "invalid_response" };
  const image = firstImage(body);
  return typeof image === "string" ? { code: image } : image;
}

export async function generateWithGemini(
  request: ValidRequest,
  config: ImageGenerationConfig,
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ProviderOutcome> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const signals = { ...deadline(config.timeoutMs, options.signal), user: options.signal };
  const images: GeneratedImagePayload[] = [];
  for (let i = 0; i < request.count; i++) {
    const result = await generateOne(request, config, fetchImpl, signals);
    if ("code" in result) {
      // Des images déjà obtenues sont rendues plutôt que perdues (elles ont pu être facturées).
      if (images.length > 0) break;
      return result.retryAfterSeconds === undefined
        ? { ok: false, code: result.code }
        : { ok: false, code: result.code, retryAfterSeconds: result.retryAfterSeconds };
    }
    images.push(result);
  }
  return { ok: true, value: { images, provider: config.provider, model: config.model } };
}
