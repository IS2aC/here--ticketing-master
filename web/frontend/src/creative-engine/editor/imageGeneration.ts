import { create } from "zustand";
import type { ImageGenerationCapabilities, ImageGenerationRequest } from "../integrations/ai/contract.ts";
import {
  generationError,
  type GeneratedImage,
  type GenerationError,
  type ImageGenerator,
} from "../integrations/ai/httpImageGenerator.ts";
import type { LibraryError } from "../library/contracts.ts";
import type { ImagePlacement } from "./actions.ts";
import { EMPTY_EVENT, type EventInfo } from "./cardPrompt.ts";
import { importAndInsert } from "./library.ts";

// Génération d'images par IA (Phase 8), côté éditeur : états, résultats temporaires, insertion volontaire.
//
// - Une génération ne touche jamais au document : ses résultats restent en mémoire (Blob + URL d'aperçu).
// - L'utilisateur choisit une image et clique « Ajouter au document » : elle passe par le chemin de l'import
//   (vérification, « Mes images », IndexedDB) puis par addImage (une action annulable), provenance « ai ».
// - Les URL d'aperçu sont libérées dès que les résultats sont remplacés ou abandonnés.
// - Aucune nouvelle tentative automatique : une génération peut être facturée même en cas d'erreur.

export type GenerationStatus = "idle" | "validating" | "generating" | "completed" | "failed" | "cancelled";

export interface GenerationResult extends GeneratedImage {
  /** URL temporaire (blob:) de l'aperçu ; libérée avec le résultat. */
  readonly previewUrl: string;
  readonly prompt: string;
}

interface ImageGenerationState {
  capabilities: ImageGenerationCapabilities | null;
  capabilitiesError: GenerationError | null;
  status: GenerationStatus;
  /** Message de validation (description vide ou trop longue) ou erreur de génération. */
  error: GenerationError | null;
  results: readonly GenerationResult[];
  selectedId: string | null;
  inserting: boolean;
  /** Informations de l'événement du mode « Carte complète » (gardées tant que la page est ouverte). */
  eventInfo: EventInfo;
}

const INITIAL: ImageGenerationState = {
  capabilities: null,
  capabilitiesError: null,
  status: "idle",
  error: null,
  results: [],
  selectedId: null,
  inserting: false,
  eventInfo: EMPTY_EVENT,
};

export const useImageGenerationStore = create<ImageGenerationState>()(() => INITIAL);

const state = () => useImageGenerationStore.getState();
const patch = (next: Partial<ImageGenerationState>) => {
  useImageGenerationStore.setState(next);
};

let generator: ImageGenerator | null = null;
let running: AbortController | null = null;

function release(results: readonly GenerationResult[]): void {
  for (const result of results) URL.revokeObjectURL(result.previewUrl);
}

/** Branche le client de génération (au démarrage) ; null le débranche et libère les aperçus (tests). */
export function configureImageGeneration(next: ImageGenerator | null): void {
  running?.abort();
  running = null;
  release(state().results);
  generator = next;
  useImageGenerationStore.setState(INITIAL, true);
}

/** Ce que le serveur permet ; à appeler à l'ouverture du panneau. */
export async function loadCapabilities(): Promise<void> {
  if (!generator) {
    patch({
      capabilities: {
        enabled: false,
        provider: null,
        model: null,
        sizes: [],
        maxImages: 0,
        maxPromptLength: 0,
      },
    });
    return;
  }
  patch({ capabilitiesError: null });
  const result = await generator.capabilities();
  if (result.ok) patch({ capabilities: result.value, capabilitiesError: null });
  else patch({ capabilitiesError: result.error });
}

/** Lance une génération. Refusée pendant qu'une autre est en cours (pas de double envoi). */
export async function generateImages(request: ImageGenerationRequest): Promise<void> {
  const capabilities = state().capabilities;
  if (state().status === "generating") return;
  patch({ status: "validating", error: null });
  const prompt = request.prompt.trim();
  if (!generator || !capabilities?.enabled) {
    patch({ status: "failed", error: generationError("not_configured") });
    return;
  }
  if (prompt.length === 0) {
    patch({ status: "failed", error: { code: "invalid_request", message: "Décrivez l'image souhaitée." } });
    return;
  }
  if (prompt.length > capabilities.maxPromptLength) {
    patch({
      status: "failed",
      error: {
        code: "invalid_request",
        message: `La description dépasse ${capabilities.maxPromptLength} caractères. Raccourcissez-la.`,
      },
    });
    return;
  }

  const controller = new AbortController();
  running = controller;
  patch({ status: "generating" });
  const result = await generator.generate({ ...request, prompt }, controller.signal);
  if (running !== controller) return; // remplacé ou débranché entre-temps
  running = null;

  if (!result.ok) {
    // Les résultats précédents restent affichés : on peut encore les utiliser.
    patch(
      result.error.code === "aborted"
        ? { status: "cancelled", error: null }
        : { status: "failed", error: result.error },
    );
    return;
  }
  release(state().results);
  const results = result.value.images.map((image) => ({
    ...image,
    prompt,
    previewUrl: URL.createObjectURL(image.blob),
  }));
  patch({
    status: "completed",
    error: null,
    results,
    selectedId: results.length === 1 ? (results[0]?.id ?? null) : null,
  });
}

/** Annule la génération en cours (le serveur interrompt la requête au fournisseur). */
export function cancelGeneration(): void {
  running?.abort();
}

export function selectResult(id: string | null): void {
  patch({ selectedId: id });
}

/** Abandonne les résultats (fermeture du panneau, nouveau document) et libère leurs aperçus. */
export function discardResults(): void {
  release(state().results);
  patch({
    results: [],
    selectedId: null,
    status: state().status === "generating" ? "generating" : "idle",
    error: null,
  });
}

/** Nom du calque et du fichier : « Image IA — début de la description ». */
function imageName(prompt: string): string {
  const short = prompt.length > 40 ? `${prompt.slice(0, 40).trimEnd()}…` : prompt;
  return `Image IA — ${short}`;
}

/**
 * Ajoute le résultat choisi au document, par le chemin de l'import : vérifié, enregistré sur l'appareil (il
 * reste disponible après actualisation et dans « Mes images »), inséré en une action annulable.
 */
export async function insertSelectedResult(
  /** « background » : fond de la carte, sous les textes ; « card » : la carte entière (éléments d'origine masqués). */
  placement: ImagePlacement = "centered",
): Promise<LibraryError | null> {
  const selected = state().results.find((r) => r.id === state().selectedId);
  if (!selected) return { code: "not_found", message: "Choisissez d'abord une image." };
  if (state().inserting) return null;
  patch({ inserting: true });
  const file = new File(
    [selected.blob],
    `${placement === "card" ? "Carte IA" : imageName(selected.prompt)}.${selected.mimeType.split("/")[1] ?? "png"}`,
    {
      type: selected.mimeType,
    },
  );
  const error = await importAndInsert(file, "ai", placement);
  patch({ inserting: false });
  return error;
}

/** Met à jour les informations de l'événement (champ par champ, pendant la saisie). */
export function updateEventInfo(changes: Partial<EventInfo>): void {
  patch({ eventInfo: { ...state().eventInfo, ...changes } });
}
