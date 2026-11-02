import type { CreativeDocument, ImageAsset } from "../domain/document/types.ts";
import type { Id } from "../domain/ids.ts";
import { deserializeDocument, serializeDocument } from "../domain/schema/serialize.ts";
import { byteLength, MAX_DOCUMENT_BYTES } from "./limits.ts";
import {
  ERROR_MESSAGES,
  fail,
  ok,
  type DocumentRepository,
  type DocumentSummary,
  type RepositoryErrorCode,
  type RepositoryResult,
} from "./repository.ts";

// Stockage sur cet appareil (ADR-007), dans IndexedDB :
//   - « documents » : métadonnées (liste sans charger le contenu) et révision ;
//   - « contents »  : JSON du document, validé à l'écriture et revalidé (et migré) à la lecture ;
//   - « assets »    : fichiers d'images, par clé de contenu (SHA-256) — partagés entre documents ;
//   - « images »    : « Mes images », les images importées par l'utilisateur (v2) : nom, dimensions, aperçu.
//     Retirer une image de cette liste ne supprime pas son fichier : les documents qui l'utilisent l'affichent
//     toujours.
// La vérification de révision et l'écriture se font dans UNE transaction : deux onglets ne peuvent pas
// s'écraser mutuellement, l'un des deux reçoit « conflict ».

// v1 : documents, contents, assets. v2 : + images (migration additive, rien n'est réécrit).
const DB_VERSION = 2;
export const DEFAULT_DB_NAME = "here-creative-engine";

interface SummaryRecord extends DocumentSummary {
  readonly schemaVersion: number;
}

interface ContentRecord {
  readonly id: Id;
  readonly json: string;
}

interface AssetRecord {
  readonly key: string;
  readonly mimeType: ImageAsset["mimeType"];
  readonly blob: Blob;
}

/** Fichiers d'images de l'appareil. Clé = empreinte du contenu : un même fichier n'est stocké qu'une fois. */
export interface LocalAssetStore {
  putAsset(blob: Blob, mimeType: ImageAsset["mimeType"]): Promise<RepositoryResult<string>>;
  getAsset(key: string): Promise<RepositoryResult<Blob | null>>;
}

/** Image de « Mes images » : son fichier est dans « assets », sous la même clé. */
export interface DeviceImageRecord {
  readonly key: string;
  readonly name: string;
  readonly mimeType: ImageAsset["mimeType"];
  readonly width: number;
  readonly height: number;
  /** ISO 8601. */
  readonly addedAt: string;
  /** Aperçu réduit pour la bibliothèque ; null : l'aperçu n'a pas pu être produit. */
  readonly thumbnail: Blob | null;
}

/** « Mes images » : les images importées sur cet appareil, visibles de lui seul. */
export interface DeviceImageStore {
  /** Ajoute (ou met à jour) une image dont le fichier est déjà enregistré par putAsset. */
  addImage(image: Omit<DeviceImageRecord, "addedAt">): Promise<RepositoryResult<DeviceImageRecord>>;
  /** Images, de la plus récente à la plus ancienne. */
  listImages(): Promise<RepositoryResult<DeviceImageRecord[]>>;
  removeImage(key: string): Promise<RepositoryResult<void>>;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error ?? new Error("Requête IndexedDB échouée"));
    };
  });
}

function completion(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error ?? new Error("Transaction IndexedDB échouée"));
    };
    tx.onabort = () => {
      reject(tx.error ?? new DOMException("Transaction annulée", "AbortError"));
    };
  });
}

function openDatabase(name: string): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB absent"));
  const req = indexedDB.open(name, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains("documents")) db.createObjectStore("documents", { keyPath: "id" });
    if (!db.objectStoreNames.contains("contents")) db.createObjectStore("contents", { keyPath: "id" });
    if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets", { keyPath: "key" });
    if (!db.objectStoreNames.contains("images")) db.createObjectStore("images", { keyPath: "key" });
  };
  return request(req);
}

/** Erreur technique → code du contrat. Le détail n'est jamais montré à l'utilisateur ni journalisé. */
function errorCode(error: unknown): RepositoryErrorCode {
  return error instanceof DOMException && error.name === "QuotaExceededError"
    ? "quota_exceeded"
    : "unavailable";
}

function failure<T>(error: unknown): RepositoryResult<T> {
  const code = errorCode(error);
  return fail(code, ERROR_MESSAGES[code]);
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface IndexedDbRepositoryOptions {
  /** Nom de la base (les tests en utilisent une par cas). */
  name?: string;
  /** Horloge (tests). */
  now?: () => string;
}

export function createIndexedDbRepository(
  options: IndexedDbRepositoryOptions = {},
): DocumentRepository & LocalAssetStore & DeviceImageStore & { close: () => void } {
  const name = options.name ?? DEFAULT_DB_NAME;
  const now = options.now ?? (() => new Date().toISOString());
  let opening: Promise<IDBDatabase> | null = null;
  // Une base fermée par le navigateur (suppression, nouvelle version) sera rouverte à la prochaine opération.
  const db = () => {
    opening ??= openDatabase(name).then((database) => {
      database.onclose = () => {
        opening = null;
      };
      database.onversionchange = () => {
        database.close();
        opening = null;
      };
      return database;
    });
    opening.catch(() => {
      opening = null;
    });
    return opening;
  };

  return {
    async list() {
      try {
        const tx = (await db()).transaction("documents", "readonly");
        const records = await request(tx.objectStore("documents").getAll() as IDBRequest<SummaryRecord[]>);
        const summaries = records
          .map(({ id, title, revision, savedAt, page }) => ({ id, title, revision, savedAt, page }))
          .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
        return ok(summaries);
      } catch (error) {
        return failure(error);
      }
    },

    async load(id) {
      try {
        const tx = (await db()).transaction(["documents", "contents"], "readonly");
        const [summary, content] = await Promise.all([
          request(tx.objectStore("documents").get(id) as IDBRequest<SummaryRecord | undefined>),
          request(tx.objectStore("contents").get(id) as IDBRequest<ContentRecord | undefined>),
        ]);
        if (!summary || !content) return fail("not_found", ERROR_MESSAGES.not_found);

        const loaded = deserializeDocument(content.json);
        if (loaded.status === "unsupported_version")
          return fail("unsupported_version", ERROR_MESSAGES.unsupported_version);
        if (loaded.status === "invalid") return fail("invalid", ERROR_MESSAGES.invalid, loaded.issues);
        if (loaded.document.id !== id) return fail("invalid", ERROR_MESSAGES.invalid);
        return ok({
          document: loaded.document,
          revision: summary.revision,
          savedAt: summary.savedAt,
          warnings: loaded.warnings,
        });
      } catch (error) {
        return failure(error);
      }
    },

    async save(document: CreativeDocument, expectedRevision: number) {
      const savedAt = now();
      const stamped = { ...document, meta: { ...document.meta, updatedAt: savedAt } };
      const serialized = serializeDocument(stamped);
      if (!serialized.ok) return fail("invalid", ERROR_MESSAGES.invalid, serialized.issues);
      if (byteLength(serialized.json) > MAX_DOCUMENT_BYTES)
        return fail("too_large", ERROR_MESSAGES.too_large);

      try {
        const tx = (await db()).transaction(["documents", "contents"], "readwrite");
        const done = completion(tx);
        const documents = tx.objectStore("documents");
        const current = await request(documents.get(document.id) as IDBRequest<SummaryRecord | undefined>);
        if ((current?.revision ?? 0) !== expectedRevision) {
          tx.abort();
          await done.catch(() => undefined);
          return fail("conflict", ERROR_MESSAGES.conflict);
        }
        const revision = expectedRevision + 1;
        const summary: SummaryRecord = {
          id: document.id,
          title: document.meta.title,
          revision,
          savedAt,
          page: { width: document.page.width, height: document.page.height },
          schemaVersion: document.schemaVersion,
        };
        documents.put(summary);
        tx.objectStore("contents").put({ id: document.id, json: serialized.json } satisfies ContentRecord);
        await done;
        return ok({ revision, savedAt });
      } catch (error) {
        return failure(error);
      }
    },

    async remove(id) {
      try {
        const tx = (await db()).transaction(["documents", "contents"], "readwrite");
        const done = completion(tx);
        const existing = await request(tx.objectStore("documents").getKey(id));
        if (existing === undefined) {
          tx.abort();
          await done.catch(() => undefined);
          return fail("not_found", ERROR_MESSAGES.not_found);
        }
        tx.objectStore("documents").delete(id);
        tx.objectStore("contents").delete(id);
        await done;
        return ok(undefined);
      } catch (error) {
        return failure(error);
      }
    },

    async putAsset(blob, mimeType) {
      try {
        const key = `sha256-${await sha256(blob)}`;
        const tx = (await db()).transaction("assets", "readwrite");
        const done = completion(tx);
        tx.objectStore("assets").put({ key, mimeType, blob } satisfies AssetRecord);
        await done;
        return ok(key);
      } catch (error) {
        return failure(error);
      }
    },

    async getAsset(key) {
      try {
        const tx = (await db()).transaction("assets", "readonly");
        const record = await request(
          tx.objectStore("assets").get(key) as IDBRequest<AssetRecord | undefined>,
        );
        return ok(record?.blob ?? null);
      } catch (error) {
        return failure(error);
      }
    },

    async addImage(image) {
      try {
        const record: DeviceImageRecord = { ...image, addedAt: now() };
        const tx = (await db()).transaction("images", "readwrite");
        const done = completion(tx);
        tx.objectStore("images").put(record);
        await done;
        return ok(record);
      } catch (error) {
        return failure(error);
      }
    },

    async listImages() {
      try {
        const tx = (await db()).transaction("images", "readonly");
        const records = await request(tx.objectStore("images").getAll() as IDBRequest<DeviceImageRecord[]>);
        return ok(records.sort((a, b) => b.addedAt.localeCompare(a.addedAt)));
      } catch (error) {
        return failure(error);
      }
    },

    async removeImage(key) {
      try {
        const tx = (await db()).transaction("images", "readwrite");
        const done = completion(tx);
        tx.objectStore("images").delete(key);
        await done;
        return ok(undefined);
      } catch (error) {
        return failure(error);
      }
    },

    close() {
      void opening?.then((database) => {
        database.close();
      });
      opening = null;
    },
  };
}
