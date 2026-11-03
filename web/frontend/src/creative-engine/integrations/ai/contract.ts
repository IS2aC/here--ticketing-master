// Contrat HTTP de la génération d'images (Phase 8), entre l'éditeur et le serveur de l'hôte.
//
// L'éditeur n'appelle JAMAIS un fournisseur d'IA : il appelle l'hôte, qui détient la clé, valide les paramètres
// coûteux et parle au fournisseur. En autonome, l'hôte est le serveur Vite (server/imageGeneration) ; lors de
// l'intégration, l'API Here! implémentera ces deux routes. Ce fichier est partagé par les deux côtés : types
// seulement, sans DOM ni Node.
//
//   GET  {base}/capabilities  → ImageGenerationCapabilities
//   POST {base}/generate      ← ImageGenerationRequest   → ImageGenerationResponse | ImageGenerationErrorBody

/** Ce que le fournisseur configuré permet réellement ; rien d'autre n'est proposé dans l'interface. */
export interface ImageGenerationCapabilities {
  readonly enabled: boolean;
  /** Identifiant du fournisseur (« openai-compatible »…), affichable ; jamais d'URL ni de clé. */
  readonly provider: string | null;
  readonly model: string | null;
  /**
   * Formats acceptés : « largeurxhauteur » en pixels (API compatible OpenAI) ou ratio « l:h » (Gemini), selon le
   * fournisseur. Le premier est la valeur par défaut.
   */
  readonly sizes: readonly string[];
  /** Nombre maximal d'images par génération (1 si le fournisseur n'en produit qu'une). */
  readonly maxImages: number;
  readonly maxPromptLength: number;
  /** Photos de référence acceptées par génération (0 : le fournisseur n'en prend pas). */
  readonly maxReferences?: number;
}

/** Photo de référence (visages, lieu, tenue) que le modèle d'image doit reprendre. */
export interface ReferenceImage {
  readonly mimeType: "image/png" | "image/jpeg" | "image/webp";
  /** Fichier encodé en base64. */
  readonly data: string;
}

export interface ImageGenerationRequest {
  readonly prompt: string;
  /** Une des `sizes` annoncées ; par défaut, la première. */
  readonly size?: string;
  /** 1 à `maxImages` ; par défaut 1. */
  readonly count?: number;
  /**
   * Demande une image sans texte : les noms, dates et lieux restent des textes modifiables de la carte (un texte
   * dessiné par l'IA ne se corrige pas). Par défaut : faux.
   */
  readonly noText?: boolean;
  /** Photos de référence, `maxReferences` au plus. */
  readonly references?: readonly ReferenceImage[];
}

export interface GeneratedImagePayload {
  readonly mimeType: "image/png" | "image/jpeg" | "image/webp";
  /** Fichier encodé en base64 (le serveur a vérifié sa signature). */
  readonly data: string;
  readonly width: number | null;
  readonly height: number | null;
}

export interface ImageGenerationResponse {
  readonly images: readonly GeneratedImagePayload[];
  readonly provider: string;
  readonly model: string;
}

export type ImageGenerationErrorCode =
  /** Aucun fournisseur configuré sur le serveur. */
  | "not_configured"
  /** Description vide ou trop longue, taille ou nombre non autorisés. */
  | "invalid_request"
  /** Description refusée par le fournisseur (contenu). */
  | "prompt_rejected"
  /** Modèle introuvable ou non chargé chez le fournisseur. */
  | "model_unavailable"
  /** Clé refusée par le fournisseur (problème de configuration du serveur). */
  | "invalid_key"
  /** Trop de requêtes : le fournisseur demande d'attendre. */
  | "rate_limited"
  /** Solde ou quota épuisé chez le fournisseur. */
  | "quota_exceeded"
  /** Le fournisseur n'a pas répondu à temps. */
  | "timeout"
  /** Une génération est déjà en cours sur ce serveur. */
  | "busy"
  /** Erreur du fournisseur, réponse illisible ou sans image. */
  | "provider_error"
  | "invalid_response"
  | "no_image"
  /** Image dans un format que l'éditeur n'accepte pas. */
  | "unsupported_format"
  /** Serveur de l'hôte injoignable (côté navigateur). */
  | "network"
  /** Annulé par l'utilisateur (côté navigateur). */
  | "aborted";

export interface ImageGenerationErrorBody {
  readonly error: { readonly code: ImageGenerationErrorCode; readonly retryAfterSeconds?: number };
}

/** Messages destinés à l'utilisateur : ce qui se passe et quoi faire, sans détail technique. */
export const GENERATION_ERROR_MESSAGES: Readonly<Record<ImageGenerationErrorCode, string>> = {
  not_configured: "La génération d'images n'est pas disponible sur ce serveur.",
  invalid_request: "Ces réglages ne sont pas acceptés. Vérifiez la description et réessayez.",
  prompt_rejected: "Le service a refusé cette description. Reformulez-la et réessayez.",
  model_unavailable: "Le modèle de génération est indisponible pour le moment. Réessayez plus tard.",
  invalid_key: "Le service de génération refuse l'accès. Contactez l'administrateur.",
  rate_limited: "Trop de demandes en peu de temps. Patientez un instant avant de réessayer.",
  quota_exceeded: "Le crédit de génération est épuisé. Contactez l'administrateur.",
  timeout: "La génération a pris trop de temps. Réessayez, éventuellement avec une description plus simple.",
  busy: "Une autre génération est en cours. Patientez qu'elle se termine.",
  provider_error: "Le service de génération a rencontré une erreur. Réessayez plus tard.",
  invalid_response: "Le service de génération a renvoyé une réponse illisible. Réessayez plus tard.",
  no_image: "Le service n'a renvoyé aucune image. Réessayez, éventuellement avec une autre description.",
  unsupported_format: "Le service a renvoyé une image dans un format non pris en charge.",
  network: "Le serveur est injoignable. Vérifiez votre connexion et réessayez.",
  aborted: "Génération annulée.",
};

/** Codes pour lesquels un nouvel essai manuel a un sens (jamais automatique : une génération peut être facturée). */
export const RETRYABLE_CODES: ReadonlySet<ImageGenerationErrorCode> = new Set([
  "rate_limited",
  "timeout",
  "busy",
  "provider_error",
  "invalid_response",
  "no_image",
  "network",
  "model_unavailable",
]);
