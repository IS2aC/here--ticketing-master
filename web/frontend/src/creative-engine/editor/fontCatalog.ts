import type { FontWeight, TextStyle } from "../domain/elements/types.ts";

// Polices proposées dans l'éditeur : celles embarquées dans l'application (styles/fonts.css).
// Les modèles du catalogue intégré n'utilisent que ces polices ; l'import de polices n'existe pas encore.

export interface FontFamilyOption {
  family: string;
  /** Graisses dont le fichier est embarqué : les autres seraient simulées par le navigateur. */
  weights: readonly FontWeight[];
  /** Graisses disposant d'un vrai fichier italique. */
  italicWeights: readonly FontWeight[];
}

export const FONT_CATALOG: readonly FontFamilyOption[] = [
  { family: "Playfair Display", weights: [400, 600, 700], italicWeights: [400] },
  { family: "Poppins", weights: [400, 500, 600, 700], italicWeights: [] },
];

export const WEIGHT_LABELS: Record<FontWeight, string> = {
  100: "Thin",
  200: "Extra Light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "SemiBold",
  700: "Bold",
  800: "Extra Bold",
  900: "Black",
};

export function fontOption(family: string): FontFamilyOption | undefined {
  return FONT_CATALOG.find((option) => option.family === family);
}

/** Graisse disponible la plus proche dans une famille (changement de police). */
export function closestWeight(family: string, weight: FontWeight): FontWeight {
  const weights = fontOption(family)?.weights ?? [];
  return weights.reduce<FontWeight>(
    (best, candidate) => (Math.abs(candidate - weight) < Math.abs(best - weight) ? candidate : best),
    weights[0] ?? weight,
  );
}

/** Gras : la graisse « Bold » de la famille, ou la plus forte disponible ; sinon retour à Regular. */
export function toggledBoldWeight(style: Pick<TextStyle, "fontFamily" | "fontWeight">): FontWeight {
  if (style.fontWeight >= 600) return closestWeight(style.fontFamily, 400);
  return closestWeight(style.fontFamily, 700);
}
