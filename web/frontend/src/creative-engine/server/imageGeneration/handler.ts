import "server-only";
import type {
  ImageGenerationErrorBody,
  ImageGenerationErrorCode,
  ImageGenerationResponse,
} from "../../integrations/ai/contract.ts";
import { publicCapabilities, type ConfigResult, type ImageGenerationConfig } from "./config.ts";
import { generateWithGemini } from "./gemini.ts";
import { generateWithOpenAiCompatible } from "./openaiCompatible.ts";
import { generateWithOpenRouter } from "./openrouter.ts";
import type { ProviderOutcome } from "./shared.ts";
import { validateGenerationRequest, type ValidRequest } from "./validate.ts";

// Routes de l'hôte (voir integrations/ai/contract.ts), indépendantes du serveur qui les sert : les
// fonctions sont pures (testées sans réseau) ; les Route Handlers de Next les branchent (app/api/image-generation).

export type Provider = (
  request: ValidRequest,
  config: ImageGenerationConfig,
  options: { signal?: AbortSignal },
) => Promise<ProviderOutcome>;

/** Fournisseurs disponibles, par identifiant de configuration. En ajouter un ne touche ni à l'éditeur ni à l'interface. */
export const PROVIDER_ADAPTERS: Readonly<Record<ImageGenerationConfig["provider"], Provider>> = {
  "openai-compatible": (request, config, options) => generateWithOpenAiCompatible(request, config, options),
  openrouter: (request, config, options) => generateWithOpenRouter(request, config, options),
  gemini: (request, config, options) => generateWithGemini(request, config, options),
};

interface HttpReply {
  readonly status: number;
  readonly body: unknown;
}

const STATUS: Partial<Record<ImageGenerationErrorCode, number>> = {
  not_configured: 503,
  invalid_request: 400,
  prompt_rejected: 422,
  model_unavailable: 503,
  invalid_key: 502,
  rate_limited: 429,
  quota_exceeded: 502,
  timeout: 504,
  busy: 429,
  aborted: 499,
};

function errorReply(code: ImageGenerationErrorCode, retryAfterSeconds?: number): HttpReply {
  const body: ImageGenerationErrorBody = {
    error: retryAfterSeconds === undefined ? { code } : { code, retryAfterSeconds },
  };
  return { status: STATUS[code] ?? 502, body };
}

export interface GenerationService {
  capabilities(): HttpReply;
  generate(body: unknown, signal?: AbortSignal): Promise<HttpReply>;
}

/**
 * Service de génération. Une seule génération à la fois par serveur : protège le fournisseur (et la facture)
 * des doubles clics et des onglets multiples, en attendant les quotas par utilisateur de l'hôte.
 */
export function createGenerationService(
  configResult: ConfigResult,
  adapters: Readonly<Record<string, Provider | undefined>> = PROVIDER_ADAPTERS,
): GenerationService {
  const config = configResult.status === "ok" ? configResult.config : null;
  let inFlight = false;
  return {
    capabilities: () => ({ status: 200, body: publicCapabilities(config) }),

    async generate(body, signal) {
      if (!config) return errorReply("not_configured");
      const adapter = adapters[config.provider];
      if (!adapter) return errorReply("not_configured");
      const request = validateGenerationRequest(body, config);
      if (!request) return errorReply("invalid_request");
      if (inFlight) return errorReply("busy");
      inFlight = true;
      try {
        const outcome = await adapter(request, config, { signal });
        if (!outcome.ok) return errorReply(outcome.code, outcome.retryAfterSeconds);
        const reply: ImageGenerationResponse = outcome.value;
        return { status: 200, body: reply };
      } finally {
        inFlight = false;
      }
    },
  };
}
