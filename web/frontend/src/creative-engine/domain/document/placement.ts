import type { Page } from "./types.ts";

// Placement d'une image insérée : centrée sur la page, proportions du fichier conservées, assez grande pour être
// manipulée, jamais plus grande que la page. Coordonnées en px du document (repère de la Phase 3).

/** Part maximale de la page occupée par une image insérée, sur chaque dimension. */
export const INSERTED_IMAGE_SHARE = 0.6;

export function placeImage(
  intrinsic: { readonly width: number; readonly height: number },
  page: Pick<Page, "width" | "height">,
  share: number = INSERTED_IMAGE_SHARE,
): { x: number; y: number; width: number; height: number } {
  const maxWidth = page.width * share;
  const maxHeight = page.height * share;
  // Une petite image n'est pas agrandie au-delà de sa taille réelle : elle resterait nette.
  const scale = Math.min(maxWidth / intrinsic.width, maxHeight / intrinsic.height, 1);
  const width = Math.max(1, Math.round(intrinsic.width * scale));
  const height = Math.max(1, Math.round(intrinsic.height * scale));
  return {
    x: Math.round((page.width - width) / 2),
    y: Math.round((page.height - height) / 2),
    width,
    height,
  };
}
