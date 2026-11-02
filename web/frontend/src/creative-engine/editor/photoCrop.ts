import type { CropRect } from "../domain/elements/types.ts";

// Cadrage d'une photo dans son cadre, décrit pour l'interface par un zoom et un point central. Le recadrage
// du modèle (fractions du fichier) a toujours les proportions du cadre : « Remplir » le montre alors en entier.

interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Framing {
  /** 1 : la plus grande partie possible de la photo ; 2 : moitié moins large, etc. */
  readonly zoom: number;
  /** Centre de la partie visible, en fractions de la photo. */
  readonly centerX: number;
  readonly centerY: number;
}

export const MAX_ZOOM = 4;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 10_000) / 10_000;

/** Début et longueur arrondis d'un segment de [0, 1] : début + longueur ne dépasse jamais 1. */
function segment(start: number, size: number): [number, number] {
  const length = clamp(round(size), 0.0001, 1);
  let from = Math.floor(clamp(start, 0, 1 - length) * 10_000) / 10_000;
  while (from > 0 && from + length > 1) from = round(from - 0.0001);
  return [from, length];
}

function rect(x: number, y: number, width: number, height: number): CropRect {
  const [left, w] = segment(x, width);
  const [top, h] = segment(y, height);
  return { x: left, y: top, width: w, height: h };
}

/** Plus grande partie de la photo aux proportions du cadre, en fractions de la photo. */
function fullCrop(frame: Size, image: Size): Size {
  const frameRatio = frame.width / frame.height;
  const imageRatio = image.width / image.height;
  return frameRatio > imageRatio
    ? { width: 1, height: imageRatio / frameRatio }
    : { width: frameRatio / imageRatio, height: 1 };
}

/** Recadrage du modèle pour un cadrage : la partie visible reste dans la photo. */
export function cropFor(framing: Framing, frame: Size, image: Size): CropRect {
  const full = fullCrop(frame, image);
  const zoom = clamp(framing.zoom, 1, MAX_ZOOM);
  const width = full.width / zoom;
  const height = full.height / zoom;
  return rect(framing.centerX - width / 2, framing.centerY - height / 2, width, height);
}

/** Cadrage d'un recadrage existant (null : photo entière, centrée). */
export function framingOf(crop: CropRect | null, frame: Size, image: Size): Framing {
  if (!crop) return { zoom: 1, centerX: 0.5, centerY: 0.5 };
  const full = fullCrop(frame, image);
  // Proportions différentes (cadre redimensionné) : le zoom est celui de la surface.
  const zoom = Math.sqrt((full.width * full.height) / (crop.width * crop.height));
  return {
    zoom: clamp(zoom, 1, MAX_ZOOM),
    centerX: crop.x + crop.width / 2,
    centerY: crop.y + crop.height / 2,
  };
}

/** Recadrage du modèle pour une zone en pixels de la photo (résultat de smartcrop). */
export function cropFromPixels(area: { x: number; y: number; width: number; height: number }, image: Size): CropRect {
  return rect(area.x / image.width, area.y / image.height, area.width / image.width, area.height / image.height);
}
