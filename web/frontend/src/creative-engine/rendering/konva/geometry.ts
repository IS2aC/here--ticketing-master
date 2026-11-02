import { normalizeRotation, roundGeometry } from "../../domain/constraints.ts";
import type { Element } from "../../domain/elements/types.ts";
import type { ElementGeometry } from "../../editor/actions.ts";

// Conversions entre la géométrie du modèle et celle des nœuds Konva.
// Modèle : (x, y) = coin de la boîte non tournée, rotation autour du centre, pas d'échelle.
// Konva : chaque élément est un Group placé à son CENTRE, tourné autour de ce point ; son contenu est dessiné
// autour de (0, 0). Le Group ne connaît que le repère du document : zoom et vue sont portés par le Stage.

export interface GroupPlacement {
  x: number;
  y: number;
  rotation: number;
}

export function placementOf(element: Element): GroupPlacement {
  return { x: element.x + element.width / 2, y: element.y + element.height / 2, rotation: element.rotation };
}

/** Attributs d'un Group après un glisser : seule la position du centre a changé. */
export function positionFromCenter(
  center: { x: number; y: number },
  element: Element,
): { x: number; y: number } {
  return { x: center.x - element.width / 2, y: center.y - element.height / 2 };
}

export interface TransformedNode {
  /** Centre du Group dans le repère du document. */
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Géométrie du modèle après une transformation par les poignées : l'échelle appliquée par Konva est « cuite »
 * dans la largeur et la hauteur (le modèle n'a pas d'échelle). `measuredHeight` remplace la hauteur pour un
 * texte, dont la hauteur suit le contenu mis en page.
 */
export function geometryFromTransform(
  node: TransformedNode,
  element: Element,
  measuredHeight?: number,
): ElementGeometry {
  const width = roundGeometry(element.width * Math.abs(node.scaleX));
  const height =
    measuredHeight !== undefined
      ? roundGeometry(measuredHeight)
      : roundGeometry(element.height * Math.abs(node.scaleY));
  return {
    x: roundGeometry(node.x - width / 2),
    y: roundGeometry(node.y - height / 2),
    width,
    height,
    rotation: normalizeRotation(node.rotation),
  };
}
