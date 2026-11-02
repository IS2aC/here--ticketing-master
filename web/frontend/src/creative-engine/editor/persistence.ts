import { create } from "zustand";
import { createDocument as createBlankDocument } from "../domain/document/factories.ts";
import type { CreativeDocument, ImageAsset } from "../domain/document/types.ts";
import { createId, type Id } from "../domain/ids.ts";
import { exportDocumentFile, readDocumentFile, type ExportedFile } from "../persistence/documentFile.ts";
import type { LocalAssetStore } from "../persistence/indexedDbRepository.ts";
import { AUTOSAVE_DELAY_MS, RETRY_DELAYS_MS } from "../persistence/limits.ts";
import type {
  DocumentRepository,
  DocumentSummary,
  RepositoryError,
  RepositoryResult,
} from "../persistence/repository.ts";
import { loadDocument as loadInEditor } from "./actions.ts";
import { currentDocument, useDocumentStore } from "./documentStore.ts";

// Cycle de vie persistant du document courant (Phase 5, ADR-007).
//
// Trois états du document, jamais confondus :
//   1. en mémoire : documentStore.history.present (ce que l'on édite) ;
//   2. enregistré : savedDocument (la référence exacte du dernier état confirmé par le stockage) + revision ;
//   3. modifications non enregistrées : présentes dès que (1) n'est plus (2). Les documents étant immuables,
//      c'est une simple comparaison de références : annuler jusqu'à l'état enregistré rend le document « propre ».
// La vue, la sélection et le zoom ne sont pas dans le document : ils ne déclenchent jamais d'enregistrement.
//
// Enregistrement : un seul à la fois. Une modification pendant un enregistrement en attend la fin, puis le
// suivant part avec la révision renvoyée : un ancien état ne peut pas écraser un état plus récent. Les
// modifications rapprochées sont regroupées (délai AUTOSAVE_DELAY_MS). Un échec garde tout à l'écran, réessaie
// quelques fois (RETRY_DELAYS_MS), puis laisse la main à l'utilisateur. Un conflit arrête l'enregistrement
// automatique : rien n'est écrasé, les modifications locales restent, l'utilisateur choisit.

export type SaveStatus =
  /** Pas de stockage pour ce document (jamais enregistré, ou création en échec). */
  | "unsaved"
  | "saving"
  /** Dernier enregistrement confirmé ; le document peut avoir changé depuis (voir useHasUnsavedChanges). */
  | "saved"
  | "error"
  | "conflict";

interface PersistenceState {
  /** Document géré par la persistance ; un document chargé autrement (tests, démonstration) ne l'est pas. */
  documentId: Id | null;
  status: SaveStatus;
  savedDocument: CreativeDocument | null;
  /** Révision de concurrence du document enregistré ; 0 tant qu'il n'existe pas dans le stockage. */
  revision: number;
  savedAt: string | null;
  saveError: RepositoryError | null;
  /** Ouverture en cours (document demandé). */
  opening: boolean;
  /** Échec de la dernière ouverture : le document affiché n'a pas changé. */
  openError: RepositoryError | null;
}

const INITIAL: PersistenceState = {
  documentId: null,
  status: "unsaved",
  savedDocument: null,
  revision: 0,
  savedAt: null,
  saveError: null,
  opening: false,
  openError: null,
};

export const usePersistenceStore = create<PersistenceState>()(() => INITIAL);

const state = () => usePersistenceStore.getState();
const patch = (next: Partial<PersistenceState>) => {
  usePersistenceStore.setState(next);
};

/** Vrai si le document à l'écran diffère du dernier état enregistré (ou n'a jamais été enregistré). */
export function useHasUnsavedChanges(): boolean {
  const present = useDocumentStore((s) => s.history.present);
  const saved = usePersistenceStore((s) => s.savedDocument);
  return present !== saved;
}

// ——— Configuration ———

interface Config {
  repository: DocumentRepository;
  assets: LocalAssetStore | null;
  autosaveDelay: number;
  retryDelays: readonly number[];
}

let config: Config | null = null;
let unsubscribe: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<boolean> | null = null;
let retries = 0;
/** Change à chaque ouverture ou création : la réponse tardive d'un enregistrement d'un autre document est ignorée. */
let generation = 0;

function clearTimer(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

/** Branche le stockage (au démarrage) ; null le débranche (tests). */
export function configurePersistence(
  repository: DocumentRepository | null,
  options: { assets?: LocalAssetStore | null; autosaveDelay?: number; retryDelays?: readonly number[] } = {},
): void {
  clearTimer();
  unsubscribe?.();
  unsubscribe = null;
  inFlight = null;
  retries = 0;
  generation++;
  usePersistenceStore.setState(INITIAL, true);
  config = repository
    ? {
        repository,
        assets: options.assets ?? null,
        autosaveDelay: options.autosaveDelay ?? AUTOSAVE_DELAY_MS,
        retryDelays: options.retryDelays ?? RETRY_DELAYS_MS,
      }
    : null;
  if (config) unsubscribe = useDocumentStore.subscribe(onDocumentChange);
}

function isManaged(): boolean {
  return config !== null && state().documentId === currentDocument().id;
}

/** Une modification du document programme un enregistrement (sauf conflit, ou geste encore en cours). */
function onDocumentChange(): void {
  const { history } = useDocumentStore.getState();
  if (!isManaged() || history.transaction || state().status === "conflict") return;
  if (history.present === state().savedDocument) {
    clearTimer();
    return;
  }
  schedule(config?.autosaveDelay ?? AUTOSAVE_DELAY_MS);
}

function schedule(delay: number): void {
  clearTimer();
  timer = setTimeout(() => {
    timer = null;
    void saveNow();
  }, delay);
}

// ——— Enregistrement ———

/**
 * Enregistre maintenant (Ctrl + S, perte de visibilité de la page). Si un enregistrement est en cours, attend
 * sa fin puis enregistre l'état le plus récent. Renvoie vrai si le document à l'écran est enregistré.
 */
export async function saveNow(): Promise<boolean> {
  clearTimer();
  if (!isManaged()) return false;
  if (inFlight) {
    await inFlight;
    return isManaged() && currentDocument() === state().savedDocument ? true : saveNow();
  }
  return performSave();
}

function performSave(): Promise<boolean> {
  const current = config;
  if (!current || state().status === "conflict") return Promise.resolve(false);
  const { history } = useDocumentStore.getState();
  // Un geste continu (curseur, flèche maintenue) n'est enregistré qu'une fois terminé.
  if (history.transaction) {
    schedule(current.autosaveDelay);
    return Promise.resolve(false);
  }
  const snapshot = history.present;
  if (snapshot === state().savedDocument) {
    patch({ status: "saved", saveError: null });
    return Promise.resolve(true);
  }

  const startedFor = generation;
  patch({ status: "saving" });
  const attempt = current.repository.save(snapshot, state().revision).then((result) => {
    inFlight = null;
    if (startedFor !== generation) return false;
    if (result.ok) {
      retries = 0;
      patch({
        status: "saved",
        savedDocument: snapshot,
        revision: result.value.revision,
        savedAt: result.value.savedAt,
        saveError: null,
      });
      // Des modifications faites pendant l'enregistrement partent au suivant.
      if (currentDocument() !== snapshot) onDocumentChange();
      return true;
    }
    if (result.error.code === "conflict") {
      patch({ status: "conflict", saveError: result.error });
      return false;
    }
    patch({ status: "error", saveError: result.error });
    const delay = current.retryDelays[retries];
    if (delay !== undefined) {
      retries++;
      schedule(delay);
    }
    return false;
  });
  inFlight = attempt;
  return attempt;
}

/** « Réessayer » après un échec : nouvelles tentatives automatiques remises à zéro. */
export function retrySave(): Promise<boolean> {
  retries = 0;
  return saveNow();
}

/** Attend l'enregistrement des modifications en cours avant de quitter le document. */
async function flush(): Promise<boolean> {
  if (!isManaged()) return true;
  if (state().status === "conflict") return false;
  if (currentDocument() === state().savedDocument && !inFlight) return true;
  return saveNow();
}

/** Vrai si quitter maintenant perdrait des modifications (à demander avant de fermer la page). */
export function hasPendingChanges(): boolean {
  if (!config) return false;
  return inFlight !== null || (isManaged() && currentDocument() !== state().savedDocument);
}

// ——— Cycle de vie ———

/** Quitter le document perdrait des modifications qui n'ont pas pu être enregistrées : on ne le fait pas en silence. */
export const UNSAVED_BLOCKS_LEAVING: RepositoryError = {
  code: "conflict",
  message:
    "Vos dernières modifications n'ont pas pu être enregistrées. Réessayez ou enregistrez une copie avant de changer de document, ou abandonnez-les.",
};

function adopt(document: CreativeDocument, saved: { revision: number; savedAt: string } | null): void {
  clearTimer();
  generation++;
  retries = 0;
  inFlight = null;
  loadInEditor(document);
  patch({
    documentId: document.id,
    status: saved ? "saved" : "unsaved",
    savedDocument: saved ? document : null,
    revision: saved?.revision ?? 0,
    savedAt: saved?.savedAt ?? null,
    saveError: null,
    openError: null,
  });
}

/**
 * Ouvre un document enregistré. Il n'est chargé dans l'éditeur qu'une fois lu et validé ; en cas d'échec,
 * le document affiché ne change pas et openError explique pourquoi. Les modifications en cours sont d'abord
 * enregistrées, sauf `discardChanges` (choix explicite de l'utilisateur, par exemple après un conflit).
 */
export async function openDocument(id: Id, options: { discardChanges?: boolean } = {}): Promise<boolean> {
  const current = config;
  if (!current) return false;
  if (!options.discardChanges && !(await flush())) {
    patch({ openError: UNSAVED_BLOCKS_LEAVING });
    return false;
  }
  patch({ opening: true, openError: null });
  const result = await current.repository.load(id);
  patch({ opening: false });
  if (!result.ok) {
    patch({ openError: result.error });
    return false;
  }
  adopt(result.value.document, result.value);
  return true;
}

/**
 * Crée un document dans le stockage et l'ouvre. Il est éditable tout de suite ; il n'est « enregistré » (et
 * listé) qu'une fois la création confirmée. En cas d'échec, il reste à l'écran, non enregistré.
 */
export async function createDocument(
  document: CreativeDocument,
  options: { discardChanges?: boolean } = {},
): Promise<boolean> {
  if (!config) return false;
  if (!options.discardChanges && !(await flush())) {
    patch({ openError: UNSAVED_BLOCKS_LEAVING });
    return false;
  }
  adopt(document, null);
  return performSave();
}

/** Nouveau document vierge, au format par défaut (un document issu d'un modèle : editor/library.ts). */
export function newDocument(options: { discardChanges?: boolean } = {}): Promise<boolean> {
  return createDocument(createBlankDocument(), options);
}

/** Après la suppression du document ouvert : le plus récent, sinon un document vierge. */
export async function openMostRecentOrNew(): Promise<boolean> {
  const list = await listDocuments();
  const latest = list.ok ? list.value[0] : undefined;
  if (latest && (await openDocument(latest.id, { discardChanges: true }))) return true;
  return newDocument({ discardChanges: true });
}

/** Conflit : abandonne les modifications locales et recharge la version enregistrée. */
export function reloadSavedVersion(): Promise<boolean> {
  const id = state().documentId;
  return id ? openDocument(id, { discardChanges: true }) : Promise.resolve(false);
}

/** Conflit : garde les modifications locales dans un nouveau document, sans toucher à l'autre version. */
export function saveAsCopy(): Promise<boolean> {
  const present = currentDocument();
  const copy: CreativeDocument = {
    ...present,
    id: createId(),
    meta: { ...present.meta, title: `${present.meta.title || "Document sans titre"} (copie)` },
  };
  if (!config) return Promise.resolve(false);
  adopt(copy, null);
  return performSave();
}

export function dismissOpenError(): void {
  patch({ openError: null });
}

export async function listDocuments(): Promise<RepositoryResult<DocumentSummary[]>> {
  if (!config) return { ok: true, value: [] };
  return config.repository.list();
}

/** Suppression définitive ; le document courant n'est plus géré (l'appelant en ouvre un autre). */
export async function removeDocument(id: Id): Promise<RepositoryResult<void>> {
  if (!config) return { ok: true, value: undefined };
  const result = await config.repository.remove(id);
  if (result.ok && id === state().documentId) {
    clearTimer();
    generation++;
    patch({ ...INITIAL });
  }
  return result;
}

// ——— Fichiers .here.json ———

/** Importe un fichier : ses images rejoignent le stockage de l'appareil, puis il devient un nouveau document. */
export async function importDocumentFile(file: Blob): Promise<RepositoryResult<Id>> {
  const current = config;
  if (!current?.assets) return { ok: false, error: { code: "unavailable", message: "Import indisponible." } };
  const read = await readDocumentFile(file);
  if (!read.ok) return read;

  const assets: Record<Id, ImageAsset> = { ...read.value.document.assets };
  for (const [assetId, blob] of read.value.assets) {
    const asset = assets[assetId];
    if (!asset) continue;
    const stored = await current.assets.putAsset(blob, asset.mimeType);
    if (!stored.ok) return stored;
    assets[assetId] = { ...asset, source: { type: "local", key: stored.value } };
  }
  // Nouvel identifiant : importer deux fois le même fichier donne deux documents, sans conflit.
  const document: CreativeDocument = { ...read.value.document, id: createId(), assets };
  const created = await createDocument(document);
  if (!created) {
    return { ok: false, error: state().saveError ?? { code: "unavailable", message: "Import impossible." } };
  }
  return { ok: true, value: document.id };
}

/** Fichier portable du document à l'écran ; `readAsset` fournit les images (l'hôte sait où elles sont). */
export function exportCurrentDocument(
  readAsset: (id: Id, asset: ImageAsset) => Promise<Blob | null>,
): Promise<RepositoryResult<ExportedFile>> {
  return exportDocumentFile(currentDocument(), readAsset);
}

/** Image stockée sur l'appareil (clé de contenu), pour l'afficher ou l'exporter. */
export async function readLocalAsset(key: string): Promise<Blob | null> {
  if (!config?.assets) return null;
  const result = await config.assets.getAsset(key);
  return result.ok ? result.value : null;
}
