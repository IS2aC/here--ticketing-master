import type { GeneratedImagePayload, ImageGenerationErrorCode } from "../../integrations/ai/contract.ts";
import type { ImageGenerationConfig } from "./config.ts";
import { deadline, imageFromBytes, isRecord, retryAfter, type ProviderOutcome } from "./shared.ts";
import { providerPrompt, type ValidRequest } from "./validate.ts";

// Adaptateur OpenRouter : API d'images dédiée, une clé pour de nombreux modèles (Gemini Nano Banana, GPT Image,
// FLUX, Seedream…).
//   POST {IMAGE_BASE_URL}/images   Authorization: Bearer {IMAGE_API_KEY}
//   { model, prompt, aspect_ratio, resolution? } → { data: [{ b64_json, media_type }] }
// D'après la documentation officielle consultée le 01/11/2026 (openrouter.ai, « Image generation »). Les fournisseurs
// ramènent le ratio à ceux qu'ils acceptent. Une génération échouée n'est pas facturée (502). Certains modèles
// n'acceptent qu'une image par requête : pour plusieurs variantes, autant de requêtes, l'une après l'autre.

/** Erreur HTTP d'OpenRouter → code du contrat (format { error: { code, message, metadata } }). */
function classify(status: number, body: unknown): ImageGenerationErrorCode {
  const error = isRecord(body) && isRecord(body.error) ? body.error : {};
  const text = JSON.stringify(error).toLowerCase();
  // 403 sert aussi au refus de modération : à distinguer d'une clé refusée.
  if (text.includes("moderation") || text.includes("flagged")) return "prompt_rejected";
  if (status === 401 || status === 403) return "invalid_key";
  if (status === 402 || text.includes("credits")) return "quota_exceeded";
  if (status === 429) return "rate_limited";
  if (status === 404 || text.includes("no endpoints") || text.includes("not a valid model"))
    return "model_unavailable";
  if (status === 408 || status === 504) return "timeout";
  if (status === 400) return "invalid_request";
  return "provider_error";
}

async function generateOne(
  request: ValidRequest,
  config: ImageGenerationConfig,
  fetchImpl: typeof fetch,
  signals: { signal: AbortSignal; timeout: AbortSignal; user?: AbortSignal },
): Promise<GeneratedImagePayload | { code: ImageGenerationErrorCode; retryAfterSeconds?: number }> {
  const payload: Record<string, string> = {
    model: config.model,
    prompt: providerPrompt(request),
    aspect_ratio: request.size,
  };
  if (config.resolution) payload.resolution = config.resolution;
  // Photos de référence : data URL, champ input_references (documentation OpenRouter, « Image generation »).
  const references = request.references.map((r) => ({
    type: "image_url",
    image_url: { url: `data:${r.mimeType};base64,${r.data}` },
  }));
  let response: Response;
  try {
    response = await fetchImpl(`${config.baseUrl}/images`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey ?? ""}`,
        // Attribution facultative prévue par OpenRouter : le nom de l'application dans ses statistiques.
        "X-Title": "Here! Creative Engine",
      },
      signal: signals.signal,
      body: JSON.stringify(references.length > 0 ? { ...payload, input_references: references } : payload),
    });
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
  if (!isRecord(body) || !Array.isArray(body.data)) return { code: "invalid_response" };
  const entry: unknown = body.data[0];
  if (entry === undefined) return { code: "no_image" };
  if (!isRecord(entry) || typeof entry.b64_json !== "string") return { code: "invalid_response" };
  const image = imageFromBytes(Uint8Array.from(Buffer.from(entry.b64_json, "base64")));
  return typeof image === "string" ? { code: image } : image;
}

export async function generateWithOpenRouter(
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
      // Des images déjà obtenues sont rendues plutôt que perdues (elles ont été facturées).
      if (images.length > 0) break;
      return result.retryAfterSeconds === undefined
        ? { ok: false, code: result.code }
        : { ok: false, code: result.code, retryAfterSeconds: result.retryAfterSeconds };
    }
    images.push(result);
  }
  return { ok: true, value: { images, provider: config.provider, model: config.model } };
}
