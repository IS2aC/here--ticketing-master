import type { TextElement, TextStyle } from "../domain/elements/types.ts";

// Hauteur occupée par un texte mis en page. Seul le moteur de rendu sait la mesurer (police, retours à la
// ligne) ; il fournit ses fonctions au démarrage (main.tsx). Sans mesureur, la hauteur stockée est conservée.
export interface TextMeasurer {
  measure: (element: TextElement) => number;
  /** Charge la police d'un style : une mesure faite avant serait fausse (police de secours). */
  prepare: (style: Pick<TextStyle, "fontFamily" | "fontWeight" | "fontStyle">) => Promise<void>;
}

let measurer: TextMeasurer | null = null;

export function registerTextMeasurer(value: TextMeasurer | null): void {
  measurer = value;
}

export function measuredTextHeight(element: TextElement): number {
  const height = measurer?.measure(element);
  return height !== undefined && Number.isFinite(height) && height > 0
    ? Math.round(height * 100) / 100
    : element.height;
}

export function prepareFont(
  style: Pick<TextStyle, "fontFamily" | "fontWeight" | "fontStyle">,
): Promise<void> {
  return measurer?.prepare(style) ?? Promise.resolve();
}
