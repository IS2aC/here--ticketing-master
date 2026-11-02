import type { Element } from "../domain/elements/types.ts";
import type { Id } from "../domain/ids.ts";

// Géométrie de la sélection au lasso, en px du document (indépendante du zoom et du moteur de rendu).

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Rectangle aux côtés positifs défini par deux points (le lasso peut être tracé dans tous les sens). */
export function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/** Boîte englobante (axes de la page) de l'élément après rotation autour de son centre. */
export function elementBounds(element: Element): Rect {
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  const angle = (element.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const width = element.width * cos + element.height * sin;
  const height = element.width * sin + element.height * cos;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/** Contact, bords compris : une ligne (hauteur nulle) touchée par le lasso est sélectionnée. */
function intersects(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
}

/**
 * Éléments touchés par le lasso, dans l'ordre du document. Les éléments masqués ou verrouillés sont ignorés,
 * comme au clic. La boîte englobante d'un élément tourné est un peu plus grande que lui : c'est le compromis
 * habituel des éditeurs, prévisible et peu coûteux.
 */
export function elementsInRect(elements: readonly Element[], rect: Rect): Id[] {
  return elements
    .filter((e) => !e.hidden && !e.locked && intersects(elementBounds(e), rect))
    .map((e) => e.id);
}
