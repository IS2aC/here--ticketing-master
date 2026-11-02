import { titleSlug } from "../domain/document/slug.ts";
import type { CreativeDocument, ImageAsset } from "../domain/document/types.ts";
import type { Id } from "../domain/ids.ts";
import type { Issue } from "../domain/schema/issues.ts";
import { serializeDocument } from "../domain/schema/serialize.ts";
import { loadDocument } from "../domain/schema/validate.ts";
import { IMAGE_SIGNATURES } from "./imageFormats.ts";
import { MAX_FILE_BYTES } from "./limits.ts";
import { ERROR_MESSAGES, fail, ok, type RepositoryResult } from "./repository.ts";

// Fichier .here.json : un document portable, images intégrées (base64), pour l'emporter sur un autre appareil
// ou le conserver hors du navigateur (ADR-007). Le document qu'il contient est lu comme toute donnée externe :
// contrôle de version, migration éventuelle, validation complète. Les images sont vérifiées (type déclaré,
// signature binaire) : un fichier déguisé en image est refusé.

export const FILE_FORMAT = "here-creative-engine/document";
export const FILE_FORMAT_VERSION = 1;
export const FILE_EXTENSION = ".here.json";

interface FileAsset {
  readonly mimeType: ImageAsset["mimeType"];
  readonly data: string;
}

interface DocumentFile {
  readonly format: typeof FILE_FORMAT;
  readonly formatVersion: number;
  readonly exportedAt: string;
  readonly document: unknown;
  readonly assets: Readonly<Record<string, FileAsset>>;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function fromBase64(data: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface ExportedFile {
  readonly blob: Blob;
  readonly fileName: string;
  /** Images introuvables au moment de l'export : le document les référence, le fichier ne les contient pas. */
  readonly missingAssets: readonly Id[];
}

/** Nom de fichier lisible tiré du titre (« Invitation de Awa » → « invitation-de-awa.here.json »). */
export function fileNameFor(document: CreativeDocument): string {
  return `${titleSlug(document.meta.title) || "document"}${FILE_EXTENSION}`;
}

/** Fichier portable du document ; `readAsset` fournit le fichier de chaque image (null : introuvable). */
export async function exportDocumentFile(
  document: CreativeDocument,
  readAsset: (id: Id, asset: ImageAsset) => Promise<Blob | null>,
  now: () => string = () => new Date().toISOString(),
): Promise<RepositoryResult<ExportedFile>> {
  const serialized = serializeDocument(document);
  if (!serialized.ok) return fail("invalid", ERROR_MESSAGES.invalid, serialized.issues);

  const assets: Record<string, FileAsset> = {};
  const missingAssets: Id[] = [];
  for (const [id, asset] of Object.entries(document.assets)) {
    const blob = await readAsset(id, asset);
    if (!blob) {
      missingAssets.push(id);
      continue;
    }
    assets[id] = { mimeType: asset.mimeType, data: toBase64(new Uint8Array(await blob.arrayBuffer())) };
  }

  const file: DocumentFile = {
    format: FILE_FORMAT,
    formatVersion: FILE_FORMAT_VERSION,
    exportedAt: now(),
    document: JSON.parse(serialized.json) as unknown,
    assets,
  };
  const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
  if (blob.size > MAX_FILE_BYTES) return fail("too_large", tooLargeMessage());
  return ok({ blob, fileName: fileNameFor(document), missingAssets });
}

export interface ImportedFile {
  readonly document: CreativeDocument;
  /** Fichiers des images, par identifiant d'image du document. */
  readonly assets: ReadonlyMap<Id, Blob>;
  readonly warnings: readonly Issue[];
}

function tooLargeMessage(): string {
  return `Ce fichier dépasse ${MAX_FILE_BYTES / 1024 / 1024} Mo, la taille maximale d'un document.`;
}

const NOT_A_DOCUMENT = "Ce fichier n'est pas un document Here! Creative Engine (.here.json).";

/** Lit un fichier .here.json non fiable. Rien n'est enregistré : l'appelant décide quoi faire du résultat. */
export async function readDocumentFile(file: Blob): Promise<RepositoryResult<ImportedFile>> {
  if (file.size > MAX_FILE_BYTES) return fail("too_large", tooLargeMessage());

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return fail("invalid", NOT_A_DOCUMENT);
  }
  if (!isRecord(parsed) || parsed.format !== FILE_FORMAT) return fail("invalid", NOT_A_DOCUMENT);
  if (typeof parsed.formatVersion !== "number" || parsed.formatVersion > FILE_FORMAT_VERSION)
    return fail("unsupported_version", ERROR_MESSAGES.unsupported_version);

  const loaded = loadDocument(parsed.document);
  if (loaded.status === "unsupported_version")
    return fail("unsupported_version", ERROR_MESSAGES.unsupported_version);
  if (loaded.status === "invalid") return fail("invalid", ERROR_MESSAGES.invalid, loaded.issues);

  const document = loaded.document;
  const fileAssets = isRecord(parsed.assets) ? parsed.assets : {};
  const assets = new Map<Id, Blob>();
  const warnings: Issue[] = [...loaded.warnings];
  for (const [id, asset] of Object.entries(document.assets)) {
    const entry = fileAssets[id];
    if (!isRecord(entry)) {
      warnings.push({ path: `assets.${id}`, code: "missing_asset", message: "Image absente du fichier" });
      continue;
    }
    const bytes = typeof entry.data === "string" ? fromBase64(entry.data) : null;
    const signature = IMAGE_SIGNATURES[asset.mimeType];
    if (entry.mimeType !== asset.mimeType || !bytes || !signature(bytes)) {
      return fail("invalid", "Une image de ce fichier est endommagée ou n'est pas du type annoncé.", [
        { path: `assets.${id}`, code: "invalid_asset", message: "Image invalide" },
      ]);
    }
    assets.set(id, new Blob([bytes.slice().buffer], { type: asset.mimeType }));
  }
  return ok({ document, assets, warnings });
}
