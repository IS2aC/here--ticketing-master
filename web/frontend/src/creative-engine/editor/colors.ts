import { formatHex, oklch, wcagContrast, type Oklch } from "culori";
import type { CreativeDocument } from "../domain/document/types.ts";
import type { Element, HexColor, TextElement } from "../domain/elements/types.ts";

// Couleur et lisibilité (recommandation 7) : contraste WCAG, correction automatique en OKLCH (la clarté
// change, la teinte reste), palette du document et harmonies. Calculs purs, sans interface.

/** Contraste WCAG entre deux couleurs (1 à 21). La transparence est ignorée. */
export function contrastRatio(foreground: HexColor, background: HexColor): number {
  return wcagContrast(foreground.slice(0, 7), background.slice(0, 7));
}

/** Contraste à atteindre : 3:1 pour un grand texte (24 px, ou 18,66 px en gras), 4,5:1 sinon (WCAG AA). */
export function targetContrast(element: TextElement): number {
  const { fontSize, fontWeight } = element.style;
  return fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5;
}

const toHex = (color: Oklch) => formatHex(color).toUpperCase() as HexColor;

/**
 * Couleur la plus proche de `text` (même teinte et saturation) qui atteint le contraste voulu sur `background` :
 * plus sombre sur un fond clair, plus claire sur un fond sombre. Garde le canal alpha éventuel.
 */
export function readableColor(text: HexColor, background: HexColor, target = 4.5): HexColor {
  const alpha = text.length === 9 ? text.slice(7) : "";
  const base = oklch(text.slice(0, 7));
  const ground = oklch(background.slice(0, 7));
  if (!base || !ground) return text;
  if (contrastRatio(text, background) >= target) return text;
  const darker = (ground.l ?? 0.5) > 0.6;
  let color: Oklch = { ...base };
  for (let i = 0; i < 40 && wcagContrast(formatHex(color), background.slice(0, 7)) < target; i++) {
    color = { ...color, l: Math.min(1, Math.max(0, (color.l ?? 0.5) + (darker ? -0.025 : 0.025))) };
  }
  return `${toHex(color)}${alpha}` as HexColor;
}

const contains = (e: Element, x: number, y: number) =>
  x >= e.x && x <= e.x + e.width && y >= e.y && y <= e.y + e.height;

/**
 * Fond visible derrière le centre d'un élément : la forme pleine la plus haute qui le contient, sinon le fond
 * de la page. null derrière une image : sa couleur n'est pas connue ici.
 */
export function backgroundBehind(doc: CreativeDocument, element: Element): HexColor | null {
  const index = doc.elements.findIndex((e) => e.id === element.id);
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  for (let i = index - 1; i >= 0; i--) {
    const below = doc.elements[i];
    if (!below || below.hidden || below.opacity < 0.5 || !contains(below, cx, cy)) continue;
    if (below.type === "image") return null;
    if (below.type === "shape" && below.shape !== "line") {
      if (below.gradient) return mix(below.gradient.from, below.gradient.to);
      if (below.fill) return below.fill;
    }
  }
  return doc.page.background.color;
}

function mix(a: HexColor, b: HexColor): HexColor {
  const [x, y] = [oklch(a.slice(0, 7)), oklch(b.slice(0, 7))];
  if (!x || !y) return a;
  return toHex({ mode: "oklch", l: ((x.l ?? 0) + (y.l ?? 0)) / 2, c: ((x.c ?? 0) + (y.c ?? 0)) / 2, h: x.h ?? y.h });
}

/** Couleurs utilisées dans le document (sans transparence), les plus fréquentes d'abord. */
export function documentPalette(doc: CreativeDocument, max = 8): HexColor[] {
  const counts = new Map<string, number>();
  const add = (color: HexColor | null | undefined) => {
    if (!color) return;
    const key = color.slice(0, 7).toUpperCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  add(doc.page.background.color);
  for (const e of doc.elements) {
    if (e.type === "text") {
      add(e.style.color);
      add(e.style.gradient?.from);
      add(e.style.gradient?.to);
    } else if (e.type === "shape") {
      add(e.fill);
      add(e.stroke?.color);
      add(e.gradient?.from);
      add(e.gradient?.to);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([color]) => color as HexColor);
}

/**
 * Harmonies d'une couleur, en OKLCH (perceptuellement régulières) : analogues, complémentaire, et une version
 * plus claire et plus sombre. Une couleur sans teinte (gris) ne donne que ses nuances.
 */
export function harmonies(color: HexColor): HexColor[] {
  const base = oklch(color.slice(0, 7));
  if (!base) return [];
  const l = base.l ?? 0.5;
  const shades = [toHex({ ...base, l: Math.min(0.97, l + 0.2) }), toHex({ ...base, l: Math.max(0.15, l - 0.2) })];
  if ((base.c ?? 0) < 0.02 || base.h === undefined) return shades;
  const turn = (degrees: number) => toHex({ ...base, h: ((base.h ?? 0) + degrees + 360) % 360 });
  return [turn(-30), turn(30), turn(180), ...shades];
}
