import { LIMITS } from "../domain/constraints.ts";
import { sniffImageType, type ImageMimeType } from "../persistence/imageFormats.ts";
import { MAX_SVG_BYTES, sanitizeSvg, svgSize, withIntrinsicSize } from "../persistence/svgFiles.ts";
import type {
  DeviceImageRecord,
  DeviceImageStore,
  LocalAssetStore,
} from "../persistence/indexedDbRepository.ts";
import { MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS } from "../persistence/limits.ts";
import { fail, ok, type AssetLibrary, type LibraryAsset, type LibraryResult } from "./contracts.ts";
import { matchesQuery, paginate } from "./search.ts";

// « Mes images » : images importées depuis cet appareil. Le fichier est vérifié (taille, signature, décodage,
// dimensions), enregistré tel quel par empreinte (aucun traitement : ni recadrage ni recompression), et un
// aperçu réduit est produit pour la bibliothèque. Ces images sont privées : seul cet appareil les voit.

/** Côté le plus long d'un aperçu, en pixels. */
export const THUMBNAIL_SIZE = 320;

export interface ReadImage {
  readonly blob: Blob;
  readonly mimeType: ImageMimeType;
  readonly width: number;
  readonly height: number;
  readonly name: string;
}

const MB = 1024 * 1024;

/** Nom lisible tiré du nom de fichier (« IMG_2041.jpeg » → « IMG_2041 »). */
function displayName(fileName: string | undefined): string {
  const base = (fileName ?? "").replace(/\.[^.]+$/, "").trim();
  return (base || "Image").slice(0, LIMITS.name.maxLength);
}

/** Lit et vérifie une image choisie par l'utilisateur (donnée non fiable). Rien n'est enregistré. */
export async function readImageFile(
  file: Blob & { readonly name?: string },
): Promise<LibraryResult<ReadImage>> {
  if (file.size > MAX_IMAGE_BYTES)
    return fail(
      "invalid",
      `Cette image dépasse ${MAX_IMAGE_BYTES / MB} Mo. Choisissez une image plus légère.`,
    );
  if (file.size === 0) return fail("invalid", "Ce fichier est vide.");

  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const mimeType = sniffImageType(head);
  if (!mimeType) return fail("invalid", "Ce fichier n'est pas une image JPEG, PNG, WebP ou SVG.");
  if (mimeType === "image/svg+xml") return readSvgFile(file);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return fail("invalid", "Cette image est endommagée ou illisible.");
  }
  const { width, height } = bitmap;
  bitmap.close();
  if (width < 1 || height < 1) return fail("invalid", "Cette image est endommagée ou illisible.");
  if (width * height > MAX_IMAGE_PIXELS || Math.max(width, height) > LIMITS.assetPixels.max)
    return fail(
      "invalid",
      `Cette image est trop grande (${width} × ${height} px). La limite est de ${MAX_IMAGE_PIXELS / 1_000_000} millions de pixels.`,
    );
  // Le type reconnu fait foi : un fichier mal nommé reste utilisable, un fichier déguisé est refusé.
  const blob = file.type === mimeType ? file : new Blob([file], { type: mimeType });
  return ok({ blob, mimeType, width, height, name: displayName(file.name) });
}

/** SVG : nettoyé (scripts et liens retirés), avec ses dimensions explicites ; c'est cette version qui est gardée. */
async function readSvgFile(file: Blob & { readonly name?: string }): Promise<LibraryResult<ReadImage>> {
  if (file.size > MAX_SVG_BYTES)
    return fail("invalid", `Ce SVG dépasse ${MAX_SVG_BYTES / MB} Mo. Simplifiez le dessin ou exportez-le en PNG.`);
  const clean = sanitizeSvg(await file.text());
  const size = clean ? svgSize(clean) : null;
  if (!clean || !size) return fail("invalid", "Ce SVG est illisible ou n'a pas de dimensions (width, height ou viewBox).");
  if (Math.max(size.width, size.height) > LIMITS.assetPixels.max)
    return fail("invalid", `Ce SVG est trop grand (${size.width} × ${size.height} px).`);
  const blob = new Blob([withIntrinsicSize(clean, size)], { type: "image/svg+xml" });
  return ok({ blob, mimeType: "image/svg+xml", ...size, name: displayName(file.name) });
}

/** Aperçu réduit (WebP, ou PNG si le navigateur ne sait pas encoder le WebP) ; null en cas d'échec. */
export async function createThumbnail(image: ReadImage, size: number = THUMBNAIL_SIZE): Promise<Blob | null> {
  // Un SVG, léger et net à toute taille, est son propre aperçu.
  if (image.mimeType === "image/svg+xml") return image.blob;
  try {
    const scale = Math.min(1, size / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const bitmap = await createImageBitmap(image.blob, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: "high",
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    bitmap.close();
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.8);
    });
  } catch {
    return null;
  }
}

export interface DeviceImageLibrary extends AssetLibrary {
  /** Vérifie, enregistre et ajoute une image à « Mes images ». */
  importImage(file: Blob & { readonly name?: string }): Promise<LibraryResult<LibraryAsset>>;
  /** Retire une image de « Mes images » ; les documents qui l'utilisent la gardent. */
  removeImage(asset: LibraryAsset): Promise<LibraryResult<void>>;
  /** Libère les aperçus (URL temporaires). */
  dispose(): void;
}

const UNAVAILABLE = "Vos images n'ont pas pu être lues sur cet appareil. Réessayez.";

export function createDeviceImageLibrary(store: LocalAssetStore & DeviceImageStore): DeviceImageLibrary {
  // URL temporaires des aperçus, créées une fois par image et libérées au retrait ou à la fermeture.
  const thumbnailUrls = new Map<string, string>();

  const toAsset = (record: DeviceImageRecord): LibraryAsset => {
    let url = thumbnailUrls.get(record.key) ?? null;
    if (!url && record.thumbnail) {
      url = URL.createObjectURL(record.thumbnail);
      thumbnailUrls.set(record.key, url);
    }
    return {
      id: `device:${record.key}`,
      origin: "device",
      name: record.name,
      mimeType: record.mimeType,
      width: record.width,
      height: record.height,
      source: { type: "local", key: record.key },
      thumbnailUrl: url,
      tags: [],
      license: null,
    };
  };

  const forget = (key: string) => {
    const url = thumbnailUrls.get(key);
    if (url) URL.revokeObjectURL(url);
    thumbnailUrls.delete(key);
  };

  return {
    origin: "device",

    async list(query) {
      const records = await store.listImages();
      if (!records.ok) return fail("unavailable", UNAVAILABLE);
      const matching = records.value.filter((r) => matchesQuery(query.text, [r.name]));
      const page = paginate(matching, query.cursor, query.limit);
      return ok({ ...page, items: page.items.map(toAsset) });
    },

    async ensureAvailable(asset) {
      if (asset.source.type !== "local") return fail("not_found", "Cette image n'est plus disponible.");
      const file = await store.getAsset(asset.source.key);
      if (!file.ok) return fail("unavailable", UNAVAILABLE);
      return file.value ? ok(undefined) : fail("not_found", "Cette image n'est plus sur cet appareil.");
    },

    async importImage(file) {
      const read = await readImageFile(file);
      if (!read.ok) return read;
      const stored = await store.putAsset(read.value.blob, read.value.mimeType);
      if (!stored.ok) {
        return fail(
          "unavailable",
          stored.error.code === "quota_exceeded"
            ? "L'espace de stockage de cet appareil est plein. Libérez de la place, puis réessayez."
            : "L'image n'a pas pu être enregistrée sur cet appareil. Réessayez.",
        );
      }
      const { mimeType, width, height, name } = read.value;
      const added = await store.addImage({
        key: stored.value,
        name,
        mimeType,
        width,
        height,
        thumbnail: await createThumbnail(read.value),
      });
      if (!added.ok) return fail("unavailable", "L'image n'a pas pu être ajoutée à vos images. Réessayez.");
      forget(stored.value);
      return ok(toAsset(added.value));
    },

    async removeImage(asset) {
      if (asset.source.type !== "local") return fail("not_found", "Cette image n'est pas dans vos images.");
      const removed = await store.removeImage(asset.source.key);
      if (!removed.ok) return fail("unavailable", "L'image n'a pas pu être retirée. Réessayez.");
      forget(asset.source.key);
      return ok(undefined);
    },

    dispose() {
      for (const url of thumbnailUrls.values()) URL.revokeObjectURL(url);
      thumbnailUrls.clear();
    },
  };
}
