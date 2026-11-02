import type { CropRect, ImageElement } from "../../domain/elements/types.ts";

interface Size {
  width: number;
  height: number;
}

export interface ImageLayout {
  /** Boîte de l'image dans le repère local du Group (centré sur 0, 0). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Partie du fichier source à dessiner, en pixels du fichier. */
  crop: { x: number; y: number; width: number; height: number };
}

/**
 * Placement d'une image dans son cadre selon `fit` :
 * - cover : remplit le cadre, l'excédent de l'image est rogné symétriquement ;
 * - contain : image entière, centrée, le cadre peut garder des marges ;
 * - fill : image étirée aux dimensions du cadre.
 * Un recadrage du modèle (fractions de l'image) délimite d'abord la partie utile du fichier.
 */
export function layoutImage(
  fit: ImageElement["fit"],
  frame: Size,
  intrinsic: Size,
  crop: CropRect | null,
): ImageLayout {
  const source = crop
    ? {
        x: crop.x * intrinsic.width,
        y: crop.y * intrinsic.height,
        width: crop.width * intrinsic.width,
        height: crop.height * intrinsic.height,
      }
    : { x: 0, y: 0, width: intrinsic.width, height: intrinsic.height };
  const centered = (width: number, height: number) => ({ x: -width / 2, y: -height / 2, width, height });

  if (fit === "fill") return { ...centered(frame.width, frame.height), crop: source };

  if (fit === "contain") {
    const scale = Math.min(frame.width / source.width, frame.height / source.height);
    return { ...centered(source.width * scale, source.height * scale), crop: source };
  }

  const scale = Math.max(frame.width / source.width, frame.height / source.height);
  const visibleWidth = frame.width / scale;
  const visibleHeight = frame.height / scale;
  return {
    ...centered(frame.width, frame.height),
    crop: {
      x: source.x + (source.width - visibleWidth) / 2,
      y: source.y + (source.height - visibleHeight) / 2,
      width: visibleWidth,
      height: visibleHeight,
    },
  };
}
