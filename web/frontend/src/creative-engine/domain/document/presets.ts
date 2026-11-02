import type { PagePreset, PrintSpec } from "./types.ts";

export type Orientation = "portrait" | "landscape" | "square";

interface PresetDefinition {
  readonly label: string;
  /** Dimensions en orientation portrait (ou carrée). */
  readonly width: number;
  readonly height: number;
  readonly print: PrintSpec | null;
}

const MM_PER_INCH = 25.4;

/** Pixels correspondant à une longueur imprimée, à la résolution donnée. */
export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / MM_PER_INCH) * dpi);
}

function printPreset(label: string, widthMm: number, heightMm: number): PresetDefinition {
  const print = { widthMm, heightMm, dpi: 300, bleedMm: 3 };
  return { label, width: mmToPx(widthMm, 300), height: mmToPx(heightMm, 300), print };
}

// Formats repris de Here! (WhatsApp 4:5, story, carré, A5 à 300 dpi), plus l'A4.
export const PAGE_PRESETS: Readonly<Record<Exclude<PagePreset, "custom">, PresetDefinition>> = {
  "social-4-5": { label: "Réseaux sociaux 4:5", width: 1080, height: 1350, print: null },
  "story-9-16": { label: "Story 9:16", width: 1080, height: 1920, print: null },
  square: { label: "Carré", width: 1080, height: 1080, print: null },
  "print-a5": printPreset("A5 à imprimer", 148, 210),
  "print-a4": printPreset("A4 à imprimer", 210, 297),
};

export function orientationOf(size: { width: number; height: number }): Orientation {
  if (size.width === size.height) return "square";
  return size.width > size.height ? "landscape" : "portrait";
}

/** Dimensions d'un format dans l'orientation demandée (un format carré ignore l'orientation). */
export function presetSize(
  preset: Exclude<PagePreset, "custom">,
  orientation: Exclude<Orientation, "square">,
): { width: number; height: number; print: PrintSpec | null } {
  const { width, height, print } = PAGE_PRESETS[preset];
  if (orientation === "portrait" || width === height) return { width, height, print };
  return {
    width: height,
    height: width,
    print: print && { ...print, widthMm: print.heightMm, heightMm: print.widthMm },
  };
}

/** Vrai si les dimensions correspondent au format, dans l'une ou l'autre orientation. */
export function matchesPreset(
  preset: Exclude<PagePreset, "custom">,
  size: { width: number; height: number },
): boolean {
  const { width, height } = PAGE_PRESETS[preset];
  return (size.width === width && size.height === height) || (size.width === height && size.height === width);
}
