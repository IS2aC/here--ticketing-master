import type { CreativeDocument, ImageAsset } from "../domain/document/types.ts";
import type { Id } from "../domain/ids.ts";
import { loadDocument } from "../domain/schema/validate.ts";
import type { DeviceImageStore, LocalAssetStore } from "../persistence/indexedDbRepository.ts";
import {
  ERROR_MESSAGES,
  fail,
  ok,
  type DocumentRepository,
  type DocumentSummary,
  type RepositoryErrorCode,
  type RepositoryResult,
} from "../persistence/repository.ts";

// Stockage de la carte d'un événement Here! (ADR-007, implémentation « hôte ») :
//   - le document, sur le serveur : une seule carte par événement, reprise sur tout appareil ;
//   - les images, sur l'appareil (IndexedDB, comme avant) ET sur le serveur. Leur clé est l'empreinte de leur
//     contenu (« sha256-… ») : la même sur l'appareil et sur le serveur. Chaque enregistrement envoie d'abord
//     les images que le serveur n'a pas ; une image absente de l'appareil est téléchargée puis gardée.
// `baseUrl` : routes de l'éditeur (…/carte), relayées vers l'API par le serveur Next.

const SERVER_UNAVAILABLE =
  "Le serveur Here! est injoignable. Vos modifications restent à l'écran ; elles seront enregistrées au retour de la connexion.";
const LOCKED = "Les invitations sont parties : la carte ne peut plus être modifiée.";

interface StoredDesign {
  readonly document: unknown;
  readonly revision: number;
  readonly saved_at: string;
}

type Local = LocalAssetStore & DeviceImageStore;

export function createHereRepository(options: { baseUrl: string; local: Local; fetch?: typeof fetch }): {
  repository: DocumentRepository;
  assets: Local;
} {
  const { baseUrl, local } = options;
  const http = options.fetch ?? ((input, init) => fetch(input, init));
  /** Dernière version connue du serveur : sert à remplacer la carte par une nouvelle (modèle, page vierge). */
  let stored: { id: string; revision: number } | null | undefined;
  /** Empreintes des images déjà sur le serveur (chargées au premier enregistrement). */
  let serverKeys: Set<string> | null = null;

  async function request(path: string, init?: RequestInit): Promise<Response | null> {
    try {
      return await http(`${baseUrl}${path}`, { cache: "no-store", ...init });
    } catch {
      return null;
    }
  }

  async function fetchDesign(): Promise<RepositoryResult<StoredDesign | null>> {
    const response = await request("/design");
    if (!response) return fail("unavailable", SERVER_UNAVAILABLE);
    if (response.status === 404) {
      stored = null;
      return ok(null);
    }
    if (!response.ok) return failure(response);
    const design = (await response.json()) as StoredDesign;
    const id = (design.document as { id?: unknown } | null)?.id;
    stored = typeof id === "string" ? { id, revision: design.revision } : null;
    return ok(design);
  }

  async function failure<T>(response: Response): Promise<RepositoryResult<T>> {
    let detail: { code?: string; message?: string } = {};
    try {
      detail = ((await response.json()) as { detail?: typeof detail }).detail ?? {};
    } catch {
      // réponse sans JSON : message par défaut
    }
    const code: RepositoryErrorCode =
      response.status === 409
        ? detail.code === "conflict"
          ? "conflict"
          : "forbidden"
        : response.status === 413
          ? "too_large"
          : response.status === 422
            ? "invalid"
            : response.status === 401 || response.status === 403 || response.status === 404
              ? "forbidden"
              : "unavailable";
    const message =
      code === "forbidden" && response.status === 409
        ? (detail.message ?? LOCKED)
        : code === "unavailable"
          ? SERVER_UNAVAILABLE
          : ERROR_MESSAGES[code];
    return fail(code, message);
  }

  /** Envoie au serveur les images du document qu'il n'a pas encore. */
  async function uploadAssets(document: CreativeDocument): Promise<RepositoryResult<void>> {
    const keys = Object.values(document.assets)
      .filter((asset) => asset.source.type === "local")
      .map((asset) => asset.source.key);
    if (keys.length === 0) return ok(undefined);
    if (!serverKeys) {
      const response = await request("/design/images");
      if (!response) return fail("unavailable", SERVER_UNAVAILABLE);
      if (!response.ok) return failure(response);
      serverKeys = new Set((await response.json()) as string[]);
    }
    for (const key of new Set(keys)) {
      if (serverKeys.has(key)) continue;
      const blob = await local.getAsset(key);
      // Image absente de l'appareil comme du serveur : le document l'affiche en erreur, l'enregistrement continue.
      if (!blob.ok || !blob.value) continue;
      const response = await request(`/design/images/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: blob.value,
        headers: { "Content-Type": blob.value.type || "application/octet-stream" },
      });
      if (!response) return fail("unavailable", SERVER_UNAVAILABLE);
      if (!response.ok) return failure(response);
      serverKeys.add(key);
    }
    return ok(undefined);
  }

  const repository: DocumentRepository = {
    async list() {
      const found = await fetchDesign();
      if (!found.ok) return found;
      const design = found.value;
      if (!design) return ok([]);
      const loaded = loadDocument(design.document);
      if (loaded.status !== "ok") return ok([]);
      const summary: DocumentSummary = {
        id: loaded.document.id,
        title: loaded.document.meta.title,
        revision: design.revision,
        savedAt: design.saved_at,
        page: { width: loaded.document.page.width, height: loaded.document.page.height },
      };
      return ok([summary]);
    },

    async load(id: Id) {
      const found = await fetchDesign();
      if (!found.ok) return found;
      const design = found.value;
      if (!design || stored?.id !== id) return fail("not_found", ERROR_MESSAGES.not_found);
      const loaded = loadDocument(design.document);
      if (loaded.status === "invalid") return fail("invalid", ERROR_MESSAGES.invalid, loaded.issues);
      if (loaded.status === "unsupported_version") return fail("unsupported_version", loaded.message);
      return ok({ document: loaded.document, revision: design.revision, savedAt: design.saved_at, warnings: loaded.warnings });
    },

    async save(document, expectedRevision) {
      if (stored === undefined) {
        const found = await fetchDesign();
        if (!found.ok) return found;
      }
      const uploaded = await uploadAssets(document);
      if (!uploaded.ok) return uploaded;
      // Création d'une nouvelle carte (vierge ou depuis un modèle) : elle remplace celle de l'événement.
      const replace = expectedRevision === 0 && stored !== null && stored !== undefined && stored.id !== document.id;
      const response = await request("/design", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document,
          expected_revision: replace && stored ? stored.revision : expectedRevision,
          replace,
        }),
      });
      if (!response) return fail("unavailable", SERVER_UNAVAILABLE);
      if (!response.ok) return failure(response);
      const saved = (await response.json()) as { revision: number; saved_at: string };
      stored = { id: document.id, revision: saved.revision };
      return ok({ revision: saved.revision, savedAt: saved.saved_at });
    },

    remove() {
      return Promise.resolve(fail("forbidden", "La carte de l'événement ne peut pas être supprimée d'ici."));
    },
  };

  const assets: Local = {
    putAsset: (blob, mimeType) => local.putAsset(blob, mimeType),
    async getAsset(key) {
      const found = await local.getAsset(key);
      if (found.ok && found.value) return found;
      // Image enregistrée depuis un autre appareil : téléchargée, puis gardée sur celui-ci.
      const response = await request(`/design/images/${encodeURIComponent(key)}`);
      if (!response?.ok) return found.ok ? ok(null) : found;
      const blob = await response.blob();
      const type = blob.type as ImageAsset["mimeType"];
      void local.putAsset(blob, type);
      return ok(blob);
    },
    addImage: (image) => local.addImage(image),
    listImages: () => local.listImages(),
    removeImage: (key) => local.removeImage(key),
  };

  return { repository, assets };
}
