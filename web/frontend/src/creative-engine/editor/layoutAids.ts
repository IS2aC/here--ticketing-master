import type { Page } from "../domain/document/types.ts";
import type { Element } from "../domain/elements/types.ts";
import type { Id } from "../domain/ids.ts";

// Aide à la mise en page (étape C3) : magnétisme, alignement, distribution. Calculs purs sur les boîtes
// englobantes (celle d'un élément tourné est la boîte droite qui le contient), en px du document.

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Marge de sécurité de la carte : celle des emplacements du QR code de Satori. */
export const SAFE_MARGIN = 44;

/** Boîte droite qui contient l'élément, rotation comprise. */
export function boundsOf(element: Pick<Element, "x" | "y" | "width" | "height" | "rotation">): Box {
  const angle = (element.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const width = element.width * cos + element.height * sin;
  const height = element.width * sin + element.height * cos;
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/** Repères d'accroche : bords, marges et milieu de la page, bords et milieux des autres éléments. */
export interface SnapTargets {
  readonly x: readonly number[];
  readonly y: readonly number[];
}

export function snapTargets(page: Pick<Page, "width" | "height">, others: readonly Box[]): SnapTargets {
  const x = [0, SAFE_MARGIN, page.width / 2, page.width - SAFE_MARGIN, page.width];
  const y = [0, SAFE_MARGIN, page.height / 2, page.height - SAFE_MARGIN, page.height];
  for (const box of others) {
    x.push(box.x, box.x + box.width / 2, box.x + box.width);
    y.push(box.y, box.y + box.height / 2, box.y + box.height);
  }
  return { x, y };
}

/** Repère le plus proche d'une des valeurs, à moins de `tolerance` : décalage à appliquer et repère touché. */
function nearest(values: readonly number[], targets: readonly number[], tolerance: number) {
  let best: { delta: number; line: number } | null = null;
  for (const value of values)
    for (const target of targets) {
      const delta = target - value;
      if (Math.abs(delta) <= tolerance && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, line: target };
    }
  return best;
}

export interface Snap {
  readonly dx: number;
  readonly dy: number;
  /** Lignes d'accroche à montrer (abscisses des guides verticaux, ordonnées des guides horizontaux). */
  readonly guides: SnapTargets;
}

/** Déplacement d'une boîte : ses bords ou son milieu s'accrochent au repère le plus proche, sur chaque axe. */
export function snapBox(box: Box, targets: SnapTargets, tolerance: number): Snap {
  const sx = nearest([box.x, box.x + box.width / 2, box.x + box.width], targets.x, tolerance);
  const sy = nearest([box.y, box.y + box.height / 2, box.y + box.height], targets.y, tolerance);
  return {
    dx: sx?.delta ?? 0,
    dy: sy?.delta ?? 0,
    guides: { x: sx ? [sx.line] : [], y: sy ? [sy.line] : [] },
  };
}

/** Un point (poignée de redimensionnement) qui s'accroche aux repères. */
export function snapPoint(point: { x: number; y: number }, targets: SnapTargets, tolerance: number): Snap {
  const sx = nearest([point.x], targets.x, tolerance);
  const sy = nearest([point.y], targets.y, tolerance);
  return {
    dx: sx?.delta ?? 0,
    dy: sy?.delta ?? 0,
    guides: { x: sx ? [sx.line] : [], y: sy ? [sy.line] : [] },
  };
}

export type Alignment = "left" | "center" | "right" | "top" | "middle" | "bottom";

type Placed = Pick<Element, "id" | "x" | "y" | "width" | "height" | "rotation">;

function union(boxes: readonly Box[]): Box {
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Nouvelles positions (coin du modèle) pour aligner des éléments : sur la page s'il n'y en a qu'un, sur la
 * boîte qui les réunit sinon. Les éléments déjà en place ne sont pas renvoyés.
 */
export function alignMoves(
  elements: readonly Placed[],
  alignment: Alignment,
  page: Pick<Page, "width" | "height">,
): { id: Id; x: number; y: number }[] {
  if (elements.length === 0) return [];
  const frame = elements.length === 1 ? { x: 0, y: 0, ...page } : union(elements.map(boundsOf));
  return elements.flatMap((element) => {
    const box = boundsOf(element);
    let dx = 0;
    let dy = 0;
    if (alignment === "left") dx = frame.x - box.x;
    else if (alignment === "center") dx = frame.x + frame.width / 2 - (box.x + box.width / 2);
    else if (alignment === "right") dx = frame.x + frame.width - (box.x + box.width);
    else if (alignment === "top") dy = frame.y - box.y;
    else if (alignment === "middle") dy = frame.y + frame.height / 2 - (box.y + box.height / 2);
    else dy = frame.y + frame.height - (box.y + box.height);
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return [];
    return [{ id: element.id, x: round(element.x + dx), y: round(element.y + dy) }];
  });
}

/**
 * Répartition à espaces égaux (3 éléments au moins) : les deux extrêmes restent en place, les autres se
 * placent entre eux, dans l'ordre de leur position.
 */
export function distributeMoves(
  elements: readonly Placed[],
  axis: "horizontal" | "vertical",
): { id: Id; x: number; y: number }[] {
  if (elements.length < 3) return [];
  const horizontal = axis === "horizontal";
  const items = elements
    .map((element) => ({ element, box: boundsOf(element) }))
    .sort((a, b) => (horizontal ? a.box.x + a.box.width / 2 - (b.box.x + b.box.width / 2) : a.box.y + a.box.height / 2 - (b.box.y + b.box.height / 2)));
  const start = (b: Box) => (horizontal ? b.x : b.y);
  const size = (b: Box) => (horizontal ? b.width : b.height);
  const first = items[0] as (typeof items)[number];
  const last = items[items.length - 1] as (typeof items)[number];
  const span = start(last.box) + size(last.box) - start(first.box);
  const gap = (span - items.reduce((sum, i) => sum + size(i.box), 0)) / (items.length - 1);
  let cursor = start(first.box) + size(first.box) + gap;
  const moves: { id: Id; x: number; y: number }[] = [];
  for (const { element, box } of items.slice(1, -1)) {
    const delta = cursor - start(box);
    if (Math.abs(delta) >= 0.01)
      moves.push({ id: element.id, x: round(element.x + (horizontal ? delta : 0)), y: round(element.y + (horizontal ? 0 : delta)) });
    cursor += size(box) + gap;
  }
  return moves;
}
