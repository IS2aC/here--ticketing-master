import type { ImageAsset } from "../domain/document/types.ts";
import { instantiateTemplate } from "../domain/templates/instantiate.ts";
import { loadDocument as readDocument } from "../domain/schema/validate.ts";
import type { AssetLibrary, LibraryAsset, LibraryError, TemplateCatalog } from "../library/contracts.ts";
import type { DeviceImageLibrary } from "../library/deviceImages.ts";
import { addImage, type ImagePlacement } from "./actions.ts";
import { createDocument, UNSAVED_BLOCKS_LEAVING, usePersistenceStore } from "./persistence.ts";

// Modèles et ressources (Phase 6) : ce que l'éditeur fait d'un modèle ou d'une ressource choisis dans une
// bibliothèque. Les bibliothèques sont fournies par l'hôte (catalogue intégré et images de l'appareil
// aujourd'hui, API Here! demain) ; ce module ne sait pas d'où viennent les fichiers.

interface LibraryConfig {
  templates: TemplateCatalog;
  assets: readonly AssetLibrary[];
  device: DeviceImageLibrary | null;
  /** Le fichier d'une ressource de document peut-il être affiché ? (ressources d'un modèle) */
  isAssetAvailable: (asset: ImageAsset) => boolean;
}

let config: LibraryConfig | null = null;

/** Branche les bibliothèques (au démarrage) ; null les débranche (tests). */
export function configureLibrary(next: LibraryConfig | null): void {
  config?.device?.dispose();
  config = next;
}

export function templateCatalog(): TemplateCatalog | null {
  return config?.templates ?? null;
}

export function assetLibraries(): readonly AssetLibrary[] {
  return config?.assets ?? [];
}

const NOT_CONFIGURED: LibraryError = { code: "unavailable", message: "La bibliothèque est indisponible." };

// ——— Modèles ———

export type TemplateUseResult =
  | {
      readonly ok: true;
      /** Faux : le document est ouvert mais pas encore enregistré (le bandeau d'erreur propose de réessayer). */
      readonly saved: boolean;
      /** Images du modèle introuvables : elles apparaissent comme manquantes dans le document. */
      readonly missingAssets: number;
    }
  | {
      readonly ok: false;
      readonly error: LibraryError;
      /** Vrai : le document actuel a des modifications non enregistrées ; rien n'a changé à l'écran. */
      readonly blockedByUnsavedChanges?: boolean;
    };

/**
 * Crée un nouveau document à partir d'un modèle et l'ouvre. Le modèle est lu comme une donnée externe
 * (version, migration, validation) ; le document obtenu a ses propres identifiants et ne partage rien avec lui.
 * En cas d'échec, le document affiché ne change pas.
 */
export async function createFromTemplate(
  templateId: string,
  options: { discardChanges?: boolean } = {},
): Promise<TemplateUseResult> {
  if (!config) return { ok: false, error: NOT_CONFIGURED };
  const loaded = await config.templates.load(templateId);
  if (!loaded.ok) return loaded;

  const read = readDocument(loaded.value.document);
  if (read.status === "unsupported_version") {
    return {
      ok: false,
      error: {
        code: "unsupported_version",
        message: "Ce modèle a été créé pour une version plus récente de l'éditeur. Choisissez-en un autre.",
      },
    };
  }
  if (read.status === "invalid") {
    return {
      ok: false,
      error: {
        code: "invalid",
        message: "Ce modèle est endommagé et ne peut pas être utilisé. Choisissez-en un autre.",
      },
    };
  }

  const { summary } = loaded.value;
  const document = instantiateTemplate(read.document, {
    origin: { id: summary.id, version: summary.version },
  });
  const available = config.isAssetAvailable;
  const missingAssets = Object.values(document.assets).filter((asset) => !available(asset)).length;

  const saved = await createDocument(document, options);
  if (usePersistenceStore.getState().documentId !== document.id) {
    const error = usePersistenceStore.getState().openError;
    return error === UNSAVED_BLOCKS_LEAVING
      ? { ok: false, error: { code: "unavailable", message: error.message }, blockedByUnsavedChanges: true }
      : {
          ok: false,
          error: { code: "unavailable", message: "Le document n'a pas pu être créé. Réessayez." },
        };
  }
  return { ok: true, saved, missingAssets };
}

// ——— Ressources ———

function libraryFor(asset: LibraryAsset): AssetLibrary | undefined {
  return config?.assets.find((library) => library.origin === asset.origin);
}

/** Insère une ressource de bibliothèque dans le document (une action annulable), après avoir vérifié son accès. */
export async function insertLibraryAsset(
  asset: LibraryAsset,
  /** Origine notée dans le document ; par défaut, déduite de la bibliothèque. */
  provenance: ImageAsset["provenance"] = asset.origin === "device" ? "upload" : "template",
  placement: ImagePlacement = "centered",
): Promise<LibraryError | null> {
  const library = libraryFor(asset);
  if (!library) return NOT_CONFIGURED;
  const access = await library.ensureAvailable(asset);
  if (!access.ok) return access.error;
  const error = addImage(
    {
      kind: "image",
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      source: asset.source,
      provenance,
    },
    asset.name,
    placement,
  );
  return error ? { code: "invalid", message: "Cette ressource ne peut pas être ajoutée au document." } : null;
}

export interface ImportOutcome {
  readonly inserted: number;
  /** Un message par fichier refusé, préfixé de son nom. */
  readonly errors: readonly string[];
}

/** Importe des images de l'appareil dans « Mes images » et les insère dans le document. */
export async function importImages(
  files: readonly (Blob & { readonly name?: string })[],
): Promise<ImportOutcome> {
  const device = config?.device;
  if (!device) return { inserted: 0, errors: [NOT_CONFIGURED.message] };
  let inserted = 0;
  const errors: string[] = [];
  for (const file of files) {
    const error = await importAndInsert(file, "upload");
    if (error) errors.push(file.name ? `${file.name} : ${error.message}` : error.message);
    else inserted++;
  }
  return { inserted, errors };
}

/**
 * Un fichier image → « Mes images » (vérifié, enregistré sur l'appareil) → document (une action annulable).
 * Sert à l'import et aux images générées par IA (provenance « ai ») : un seul chemin vers le document.
 */
export async function importAndInsert(
  file: Blob & { readonly name?: string },
  provenance: ImageAsset["provenance"],
  placement: ImagePlacement = "centered",
): Promise<LibraryError | null> {
  const device = config?.device;
  if (!device) return NOT_CONFIGURED;
  const imported = await device.importImage(file);
  return imported.ok ? insertLibraryAsset(imported.value, provenance, placement) : imported.error;
}

export async function removeDeviceImage(asset: LibraryAsset): Promise<LibraryError | null> {
  const device = config?.device;
  if (!device) return NOT_CONFIGURED;
  const removed = await device.removeImage(asset);
  return removed.ok ? null : removed.error;
}
