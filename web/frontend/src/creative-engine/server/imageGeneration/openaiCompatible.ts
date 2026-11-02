import type { GeneratedImagePayload, ImageGenerationErrorCode } from "../../integrations/ai/contract.ts";
import type { ImageGenerationConfig } from "./config.ts";
import { imageFromBytes, isRecord, retryAfter, type ProviderOutcome } from "./shared.ts";
import { providerPrompt, type ValidRequest } from "./validate.ts";

// Adaptateur « API Images compatible OpenAI » : POST {IMAGE_BASE_URL}/images/generations
//   { model, prompt, n, size, response_format: "b64_json" } → { data: [{ b64_json } | { url }] }
// Vérifié le 01/11/2026 contre Ollama 0.30.6 (point d'accès expérimental, b64_json seulement, erreurs au format
// OpenAI). Compatible avec l'API d'OpenAI et les proxys qui la reproduisent (LiteLLM…). Chaque fournisseur
// a ses propres tailles et limites : elles sont fixées par la configuration (IMAGE_SIZES, IMAGE_MAX_IMAGES).

/** Erreur HTTP du fournisseur → code du contrat. Le corps n'est lu que pour distinguer les cas connus. */
function classify(status: number, body: unknown): ImageGenerationErrorCode {
  const error = isRecord(body) && isRecord(body.error) ? body.error : {};
  const text =
    `${typeof error.code === "string" ? error.code : ""} ${typeof error.type === "string" ? error.type : ""} ${typeof error.message === "string" ? error.message : ""}`.toLowerCase();
  if (status === 401 || status === 403) return "invalid_key";
  if (status === 402 || text.includes("insufficient_quota") || text.includes("billing"))
    return "quota_exceeded";
  if (status === 429) return "rate_limited";
  if (status === 404 || text.includes("not_found") || text.includes("model_not_found"))
    return "model_unavailable";
  if (text.includes("content_policy") || text.includes("safety") || text.includes("moderation"))
    return "prompt_rejected";
  if (status === 408 || status === 504) return "timeout";
  return "provider_error";
}

async function decodeImage(
  entry: unknown,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<GeneratedImagePayload | ImageGenerationErrorCode> {
  if (!isRecord(entry)) return "invalid_response";
  let bytes: Uint8Array;
  if (typeof entry.b64_json === "string") {
    bytes = Uint8Array.from(Buffer.from(entry.b64_json, "base64"));
  } else if (typeof entry.url === "string" && /^https:\/\//.test(entry.url)) {
    // Certains fournisseurs renvoient une URL temporaire : le serveur la télécharge tout de suite, le navigateur
    // ne la voit jamais (elle expirerait, et son origine bloquerait l'export).
    const download = await fetchImpl(entry.url, { signal });
    if (!download.ok) return "provider_error";
    bytes = new Uint8Array(await download.arrayBuffer());
  } else {
    return "invalid_response";
  }
  return imageFromBytes(bytes);
}

export async function generateWithOpenAiCompatible(
  request: ValidRequest,
  config: ImageGenerationConfig,
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ProviderOutcome> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeout = AbortSignal.timeout(config.timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  let response: Response;
  try {
    response = await fetchImpl(`${config.baseUrl}/images/generations`, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        model: config.model,
        prompt: providerPrompt(request),
        n: request.count,
        size: request.size,
        response_format: "b64_json",
      }),
    });
  } catch {
    if (options.signal?.aborted) return { ok: false, code: "aborted" };
    return { ok: false, code: timeout.aborted ? "timeout" : "provider_error" };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (timeout.aborted) return { ok: false, code: "timeout" };
    return { ok: false, code: response.ok ? "invalid_response" : classify(response.status, null) };
  }
  if (!response.ok) {
    const code = classify(response.status, body);
    const wait = retryAfter(response);
    return wait === undefined ? { ok: false, code } : { ok: false, code, retryAfterSeconds: wait };
  }
  if (!isRecord(body) || !Array.isArray(body.data)) return { ok: false, code: "invalid_response" };
  if (body.data.length === 0) return { ok: false, code: "no_image" };

  const images: GeneratedImagePayload[] = [];
  try {
    for (const entry of body.data.slice(0, request.count)) {
      const decoded = await decodeImage(entry, fetchImpl, signal);
      if (typeof decoded === "string") return { ok: false, code: decoded };
      images.push(decoded);
    }
  } catch {
    return { ok: false, code: timeout.aborted ? "timeout" : "provider_error" };
  }
  return { ok: true, value: { images, provider: config.provider, model: config.model } };
}
