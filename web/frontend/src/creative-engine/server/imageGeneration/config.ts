import type { ImageGenerationCapabilities } from "../../integrations/ai/contract.ts";

// Configuration du fournisseur, lue dans l'environnement du SERVEUR (jamais dans le bundle du navigateur :
// aucune de ces variables n'a le préfixe VITE_). Mêmes conventions que l'assistant de Here!
// (ASSISTANT_PROVIDER, _BASE_URL, _API_KEY, _MODEL, _TIMEOUT_SECONDS).
//
//   IMAGE_PROVIDER          none (défaut) | openrouter | gemini | openai-compatible
//   IMAGE_API_KEY           clé du fournisseur (obligatoire pour openrouter et gemini ; facultative en local)
//   IMAGE_MODEL             modèle d'image (openrouter : google/gemini-3.1-flash-lite-image ; gemini :
//                           gemini-3.1-flash-lite-image — Nano Banana 2 Lite ; openai-compatible : obligatoire)
//   IMAGE_BASE_URL          adresse de l'API (openrouter, gemini : la leur par défaut ; openai-compatible : …/v1)
//   IMAGE_SIZES             formats proposés, séparés par des virgules ; le premier est le défaut
//                           openrouter, gemini : ratios « l:h » (défaut : 4:5,1:1,9:16,3:4,3:2) ;
//                           openai-compatible : « largeurxhauteur »
//   IMAGE_RESOLUTION        openrouter, gemini (modèles récents) : 1K, 2K ou 4K (défaut : celui du modèle)
//   IMAGE_MAX_IMAGES        images par génération, 1 à 4 (défaut : 1)
//   IMAGE_TIMEOUT_SECONDS   délai maximal d'une génération (défaut : 120)
// Une variable vide vaut absente (un .env copié de .env.example garde ses valeurs par défaut).

export const PROVIDERS = ["none", "openrouter", "gemini", "openai-compatible"] as const;
export type ProviderId = (typeof PROVIDERS)[number];

/** Longueur maximale d'une description : une carte complète (textes, polices, consignes) tient en 4000 caractères. */
export const MAX_PROMPT_LENGTH = 4000;
const MAX_IMAGES_LIMIT = 4;
const PIXEL_SIZE = /^(\d{2,5})x(\d{2,5})$/;
const RATIO = /^(\d{1,2}):(\d{1,2})$/;
const RESOLUTIONS = ["1K", "2K", "4K"] as const;

const DEFAULTS = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    // Nano Banana 2 Lite, le moins cher de la famille (choix de l'utilisateur ; présent dans la liste des modèles
    // d'image d'OpenRouter le 01/11/2026). Il ne produit que du 1K.
    model: "google/gemini-3.1-flash-lite-image",
    sizes: "4:5,1:1,9:16,3:4,3:2",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1",
    model: "gemini-3.1-flash-lite-image",
    // Les formats des cartes : 4:5 (WhatsApp, Instagram), carré, story 9:16, impression (A5 ≈ 3:4 portrait), paysage.
    sizes: "4:5,1:1,9:16,3:4,3:2",
  },
  "openai-compatible": { baseUrl: null, model: null, sizes: "1024x1024" },
} as const;

export interface ImageGenerationConfig {
  readonly provider: Exclude<ProviderId, "none">;
  readonly baseUrl: string;
  /** Secret : ne quitte jamais le serveur, n'est jamais journalisée. */
  readonly apiKey: string | null;
  readonly model: string;
  readonly sizes: readonly string[];
  /** OpenRouter, Gemini : résolution demandée ; null : celle du modèle. */
  readonly resolution: (typeof RESOLUTIONS)[number] | null;
  readonly maxImages: number;
  readonly timeoutMs: number;
}

export type ConfigResult =
  | { readonly status: "disabled" }
  | { readonly status: "ok"; readonly config: ImageGenerationConfig }
  /** Configuration incomplète ou incohérente : la génération reste désactivée, l'erreur est donnée au démarrage. */
  | { readonly status: "invalid"; readonly problems: readonly string[] };

type Env = Readonly<Record<string, string | undefined>>;

export function readImageGenerationConfig(env: Env): ConfigResult {
  const value = (name: string) => env[name]?.trim() || undefined;
  const provider = value("IMAGE_PROVIDER") ?? "none";
  if (provider === "none") return { status: "disabled" };
  if (provider !== "openrouter" && provider !== "gemini" && provider !== "openai-compatible")
    return {
      status: "invalid",
      problems: [`IMAGE_PROVIDER inconnu (« ${provider} ») : ${PROVIDERS.join(", ")}`],
    };
  const defaults = DEFAULTS[provider];
  const problems: string[] = [];

  const baseUrl = (value("IMAGE_BASE_URL") ?? defaults.baseUrl ?? "").replace(/\/+$/, "");
  try {
    if (!["http:", "https:"].includes(new URL(baseUrl).protocol))
      problems.push("IMAGE_BASE_URL doit être en http ou https");
  } catch {
    problems.push("IMAGE_BASE_URL manquante ou invalide");
  }
  const apiKey = value("IMAGE_API_KEY") ?? null;
  if (provider === "gemini" && !apiKey) problems.push("IMAGE_API_KEY manquante (clé de l'API Gemini)");
  if (provider === "openrouter" && !apiKey) problems.push("IMAGE_API_KEY manquante (clé OpenRouter)");
  const model = value("IMAGE_MODEL") ?? defaults.model ?? "";
  if (!model) problems.push("IMAGE_MODEL manquant");

  const byRatio = provider !== "openai-compatible";
  const pattern = byRatio ? RATIO : PIXEL_SIZE;
  const sizes = (value("IMAGE_SIZES") ?? defaults.sizes)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (sizes.length === 0 || sizes.some((s) => !pattern.test(s)))
    problems.push(
      byRatio
        ? "IMAGE_SIZES : ratios « l:h » séparés par des virgules (4:5,1:1…)"
        : "IMAGE_SIZES : tailles « largeurxhauteur » séparées par des virgules",
    );

  const resolution = value("IMAGE_RESOLUTION") ?? null;
  if (resolution !== null && (!byRatio || !(RESOLUTIONS as readonly string[]).includes(resolution)))
    problems.push("IMAGE_RESOLUTION : 1K, 2K ou 4K, avec openrouter ou gemini seulement");
  // Les modèles « Lite » ne produisent que du 1K (documentation Gemini) : une autre résolution échouerait à chaque appel.
  else if (resolution !== null && resolution !== "1K" && model.includes("flash-lite-image"))
    problems.push(`IMAGE_RESOLUTION : ${model} ne produit que du 1K (choisir un autre modèle pour 2K ou 4K)`);

  const maxImages = Number(value("IMAGE_MAX_IMAGES") ?? "1");
  if (!Number.isInteger(maxImages) || maxImages < 1 || maxImages > MAX_IMAGES_LIMIT)
    problems.push(`IMAGE_MAX_IMAGES : entier de 1 à ${MAX_IMAGES_LIMIT}`);
  const timeout = Number(value("IMAGE_TIMEOUT_SECONDS") ?? "120");
  if (!Number.isFinite(timeout) || timeout < 5 || timeout > 600)
    problems.push("IMAGE_TIMEOUT_SECONDS : de 5 à 600");

  if (problems.length > 0) return { status: "invalid", problems };
  return {
    status: "ok",
    config: {
      provider,
      baseUrl,
      apiKey,
      model,
      sizes,
      resolution: resolution as ImageGenerationConfig["resolution"],
      maxImages,
      timeoutMs: timeout * 1000,
    },
  };
}

/** Ce que le navigateur a le droit de savoir : ni URL, ni clé. */
export function publicCapabilities(config: ImageGenerationConfig | null): ImageGenerationCapabilities {
  if (!config)
    return {
      enabled: false,
      provider: null,
      model: null,
      sizes: [],
      maxImages: 0,
      maxPromptLength: MAX_PROMPT_LENGTH,
    };
  return {
    enabled: true,
    provider: config.provider,
    model: config.model,
    sizes: config.sizes,
    maxImages: config.maxImages,
    maxPromptLength: MAX_PROMPT_LENGTH,
  };
}
