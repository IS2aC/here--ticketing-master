import type { CreativeDocument, ImageAsset } from "../domain/document/types.ts";
import type { TextElement } from "../domain/elements/types.ts";
import type { Id } from "../domain/ids.ts";
import { ensureFont, isFontAvailable } from "../rendering/fonts.ts";
import { fail, ok, type ExportOutcome } from "./errors.ts";

// Ressources d'un export : toutes les polices et images des éléments visibles, prêtes AVANT le rendu.
// Une ressource qui manque arrête l'export avec la liste des éléments en cause (ADR-008) : jamais d'image
// incomplète présentée comme réussie.

/** Délai maximal de chargement d'une image : une image distante ne bloque pas l'export indéfiniment. */
export const IMAGE_TIMEOUT_MS = 15_000;

export type AssetUrlResolver = (assetId: Id, asset: ImageAsset) => string | null;

const label = (element: { name?: string }, fallback: string) => element.name?.trim() || fallback;

function fontLabel(style: TextElement["style"]): string {
  return `${style.fontFamily} ${style.fontWeight}${style.fontStyle === "italic" ? " italique" : ""}`;
}

/** Polices des textes visibles : chargées, puis vérifiées. */
export async function prepareFonts(document: CreativeDocument): Promise<ExportOutcome<void>> {
  const texts = document.elements.filter((e): e is TextElement => e.type === "text" && !e.hidden);
  await Promise.all(texts.map((t) => ensureFont(t.style)));
  const missing = new Set(texts.filter((t) => !isFontAvailable(t.style)).map((t) => fontLabel(t.style)));
  if (missing.size > 0)
    return fail(
      "font_unavailable",
      "Une police du document n'a pas pu être chargée : l'export aurait une autre police. Réessayez dans un instant.",
      [...missing],
    );
  return ok(undefined);
}

function loadImage(url: string, signal: AbortSignal | undefined): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    // Sans CORS, une image d'une autre origine « contaminerait » le canvas et bloquerait l'export.
    image.crossOrigin = "anonymous";
    const done = (value: HTMLImageElement | null) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => {
      image.src = "";
      done(null);
    };
    const timer = setTimeout(() => {
      image.src = "";
      done(null);
    }, IMAGE_TIMEOUT_MS);
    signal?.addEventListener("abort", onAbort);
    image.onload = () => {
      done(image.naturalWidth > 0 ? image : null);
    };
    image.onerror = () => {
      done(null);
    };
    image.src = url;
  });
}

/**
 * Vrai si les pixels de l'image peuvent être lus (sinon, le navigateur refusera de produire le fichier).
 * Avec crossOrigin « anonymous », une image d'une autre origine sans CORS échoue déjà au chargement ; cette
 * vérification protège des cas restants (navigateur, cache) plutôt que de risquer un échec à la conversion.
 */
function isReadable(image: HTMLImageElement): boolean {
  const canvas = window.document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  if (!context) return false;
  try {
    context.drawImage(image, 0, 0, 1, 1);
    context.getImageData(0, 0, 1, 1);
    return true;
  } catch {
    return false;
  }
}

/** Fichier décodé de chaque ressource utilisée par une image visible. */
export async function prepareImages(
  document: CreativeDocument,
  resolveUrl: AssetUrlResolver,
  signal?: AbortSignal,
): Promise<ExportOutcome<Map<Id, HTMLImageElement>>> {
  const used = new Map<Id, string[]>();
  for (const element of document.elements) {
    if (element.type !== "image" || element.hidden) continue;
    used.set(element.assetId, [...(used.get(element.assetId) ?? []), label(element, "Image")]);
  }

  const images = new Map<Id, HTMLImageElement>();
  const missing: string[] = [];
  const blocked: string[] = [];
  await Promise.all(
    [...used].map(async ([assetId, names]) => {
      const asset = document.assets[assetId];
      const url = asset ? resolveUrl(assetId, asset) : null;
      const image = url ? await loadImage(url, signal) : null;
      if (!image) missing.push(...names);
      else if (!isReadable(image)) blocked.push(...names);
      else images.set(assetId, image);
    }),
  );

  if (missing.length > 0)
    return fail(
      "missing_assets",
      "Des images du document sont introuvables, illisibles ou refusées par leur site. Remplacez-les ou supprimez-les, puis réessayez.",
      missing.sort(),
    );
  if (blocked.length > 0)
    return fail(
      "asset_blocked",
      "Des images viennent d'un site qui interdit leur réutilisation : le navigateur bloque l'export. Importez-les depuis votre appareil.",
      blocked.sort(),
    );
  return ok(images);
}
