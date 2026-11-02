import { PAGE_PRESETS, orientationOf } from "../../domain/document/presets.ts";
import type { Page } from "../../domain/document/types.ts";
import type { Element } from "../../domain/elements/types.ts";
import type { IconName } from "../icons/Icon.tsx";

const SHAPE_LABELS = { rect: "Rectangle", ellipse: "Ellipse", line: "Ligne" } as const;
const ORIENTATION_LABELS = { portrait: "portrait", landscape: "paysage", square: "carré" } as const;

export function elementTypeLabel(element: Element): string {
  if (element.type === "text") return "Texte";
  if (element.type === "image") return "Image";
  return SHAPE_LABELS[element.shape];
}

/** Nom affiché d'un calque : son nom, sinon le début du texte, sinon son type. */
export function elementLabel(element: Element): string {
  if (element.name) return element.name;
  if (element.type === "text") {
    const firstLine = element.content.split("\n")[0]?.trim() ?? "";
    if (firstLine) return firstLine.length > 32 ? `${firstLine.slice(0, 31)}…` : firstLine;
  }
  return elementTypeLabel(element);
}

export function elementIcon(element: Element): IconName {
  if (element.type === "text") return "text";
  if (element.type === "image") return "image";
  return element.shape;
}

export function pageFormatLabel(page: Page): string {
  const format = page.preset === "custom" ? "Format libre" : PAGE_PRESETS[page.preset].label;
  return `${format} · ${ORIENTATION_LABELS[orientationOf(page)]}`;
}

/** Nombre affiché : au plus deux décimales, sans zéros inutiles, séparateur décimal français. */
export function formatNumber(value: number): string {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}
