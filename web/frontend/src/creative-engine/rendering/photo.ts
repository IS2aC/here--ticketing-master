import Konva from "konva";
import type { Filter, FilterFunction } from "konva/lib/Node";
import type { ImageElement, ImageMask, PhotoAdjustments } from "../domain/elements/types.ts";
import type { ImageLayout } from "./konva/imageFit.ts";

// Photo retouchée : la partie visible du fichier, réglée (filtres Konva) puis découpée en médaillon avec un
// fondu des bords, dessinée dans un canvas à la taille de l'image dans son cadre. L'éditeur et l'export
// passent par la même fonction : l'aperçu et le décor envoyé à Satori sont identiques.

/** Côté maximal du canvas produit, en pixels : borne la mémoire et le temps des filtres. */
const MAX_SIDE = 4096;

/** Vrai si l'image doit passer par photoCanvas (sinon, Konva la dessine directement). */
export function isRetouched(element: ImageElement): boolean {
  return Boolean(element.mask || element.adjustments);
}

/**
 * Pixels du canvas par px du document : la définition du fichier source, bornée par `maxRatio` (2 à l'écran,
 * le facteur de l'export sinon) et par MAX_SIDE.
 */
export function photoRatio(layout: ImageLayout, maxRatio: number): number {
  const source = Math.min(layout.crop.width / layout.width, layout.crop.height / layout.height);
  const ratio = Math.min(Math.max(source, 0.25), Math.max(maxRatio, 1));
  return Math.min(ratio, MAX_SIDE / Math.max(layout.width, layout.height));
}

/** Filtres Konva et leurs réglages pour des valeurs du modèle (voir PhotoAdjustments). */
export function filterSettings(adjustments: PhotoAdjustments, ratio: number) {
  const filters: Filter[] = [];
  const attrs: Record<string, number> = {};
  if (adjustments.brightness !== 0) {
    filters.push(Konva.Filters.Brightness);
    attrs.brightness = 1 + adjustments.brightness * 0.5;
  }
  if (adjustments.contrast !== 0) {
    filters.push(Konva.Filters.Contrast);
    attrs.contrast = adjustments.contrast * 50;
  }
  if (adjustments.saturation <= -1) filters.push(Konva.Filters.Grayscale);
  else if (adjustments.saturation !== 0) {
    filters.push(Konva.Filters.HSL);
    attrs.saturation = adjustments.saturation;
  }
  if (adjustments.blur > 0) {
    filters.push(Konva.Filters.Blur);
    attrs.blurRadius = adjustments.blur * ratio;
  }
  return { filters, attrs };
}

function applyFilters(context: CanvasRenderingContext2D, adjustments: PhotoAdjustments, ratio: number): void {
  const { filters, attrs } = filterSettings(adjustments, ratio);
  if (filters.length === 0) return;
  const { width, height } = context.canvas;
  const pixels = context.getImageData(0, 0, width, height);
  // Les filtres Konva lisent leurs réglages sur un nœud : un nœud détaché, jamais dessiné, les porte.
  const carrier = new Konva.Image({ image: undefined, ...attrs });
  try {
    // Konva type ses filtres « fonction ou nom » : ceux d'ici sont tous des fonctions.
    for (const filter of filters) (filter as FilterFunction).call(carrier, pixels);
  } finally {
    carrier.destroy();
  }
  context.putImageData(pixels, 0, 0);
}

/** Tracé de la forme dans un rectangle (x, y, width, height). */
export function traceMask(
  context: CanvasRenderingContext2D,
  shape: ImageMask["shape"],
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  context.beginPath();
  switch (shape) {
    case "rect":
      context.rect(x, y, width, height);
      break;
    case "rounded":
      context.roundRect(x, y, width, height, Math.min(width, height) * 0.12);
      break;
    case "ellipse":
      context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, 2 * Math.PI);
      break;
    case "arch": {
      const radius = Math.min(width / 2, height);
      context.moveTo(x, y + height);
      context.lineTo(x, y + radius);
      context.arc(x + width / 2, y + radius, radius, Math.PI, 0);
      context.lineTo(x + width, y + height);
      context.closePath();
      break;
    }
  }
}

/**
 * Garde l'image dans la forme. Le fondu est l'ombre floutée de la forme, dessinée seule (la forme elle-même
 * est tracée hors du canvas, son ombre est ramenée dessus) : ctx.filter n'existe pas partout. Le masque est
 * préparé à part : avec « destination-in », la forme tracée hors du canvas effacerait toute la photo.
 */
function applyMask(context: CanvasRenderingContext2D, mask: ImageMask, ratio: number): void {
  const { width, height } = context.canvas;
  const feather = Math.min(mask.feather * ratio, Math.min(width, height) / 6);
  const matte = window.document.createElement("canvas");
  matte.width = width;
  matte.height = height;
  const shape = matte.getContext("2d");
  if (!shape) return;
  shape.fillStyle = "#000";
  if (feather <= 0) {
    traceMask(shape, mask.shape, 0, 0, width, height);
  } else {
    // Rétrécie de 2 fondus : l'ombre (écart type ≈ fondu) s'éteint au bord du cadre, sans liseré.
    const inset = feather * 2;
    const away = width + 4 * feather;
    shape.shadowColor = "#000";
    shape.shadowBlur = feather * 2;
    shape.shadowOffsetX = away;
    traceMask(shape, mask.shape, inset - away, inset, width - 2 * inset, height - 2 * inset);
  }
  shape.fill();
  context.save();
  context.globalCompositeOperation = "destination-in";
  context.drawImage(matte, 0, 0);
  context.restore();
}

/** Canvas de la photo retouchée, à la taille de `layout` × ratio. */
export function photoCanvas(
  image: CanvasImageSource,
  layout: ImageLayout,
  element: Pick<ImageElement, "mask" | "adjustments">,
  ratio: number,
): HTMLCanvasElement {
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(layout.width * ratio));
  canvas.height = Math.max(1, Math.round(layout.height * ratio));
  const context = canvas.getContext("2d", { willReadFrequently: Boolean(element.adjustments) });
  if (!context) return canvas;
  const { crop } = layout;
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  if (element.adjustments) applyFilters(context, element.adjustments, ratio);
  if (element.mask) applyMask(context, element.mask, ratio);
  return canvas;
}
