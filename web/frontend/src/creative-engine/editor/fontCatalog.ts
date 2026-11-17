import type { FontWeight, TextStyle } from "../domain/elements/types.ts";

// Polices proposées dans l'éditeur : celles déclarées dans styles/fonts.css (marque Here! et polices des
// faire-part, licence OFL ; fichiers et licences dans public/creative-engine/fonts). L'import de polices n'existe pas encore.

export type FontKind = "script" | "serif" | "sans" | "display";

export const FONT_KIND_LABELS: Record<FontKind, string> = {
  script: "Calligraphies",
  serif: "Serifs",
  sans: "Linéales",
  display: "Affiche",
};

export interface FontFamilyOption {
  family: string;
  /** Genre : groupe du sélecteur ; une calligraphie ne s'écrit ni en capitales ni espacée. */
  kind: FontKind;
  /** Graisses dont le fichier est embarqué : les autres seraient simulées par le navigateur. */
  weights: readonly FontWeight[];
  /** Graisses disposant d'un vrai fichier italique. */
  italicWeights: readonly FontWeight[];
}

export const FONT_CATALOG: readonly FontFamilyOption[] = [
  // Calligraphies : prénoms des mariés, titres.
  { family: "Great Vibes", kind: "script", weights: [400], italicWeights: [] },
  { family: "Pinyon Script", kind: "script", weights: [400], italicWeights: [] },
  { family: "Parisienne", kind: "script", weights: [400], italicWeights: [] },
  { family: "Alex Brush", kind: "script", weights: [400], italicWeights: [] },
  { family: "Allura", kind: "script", weights: [400], italicWeights: [] },
  { family: "Dancing Script", kind: "script", weights: [400, 500, 600, 700], italicWeights: [] },
  // Serifs élégants.
  { family: "Playfair Display", kind: "serif", weights: [400, 600, 700], italicWeights: [400] },
  { family: "Cormorant Garamond", kind: "serif", weights: [300, 400, 500, 600, 700], italicWeights: [300, 400, 500, 600, 700] },
  { family: "EB Garamond", kind: "serif", weights: [400, 500, 600, 700, 800], italicWeights: [400, 500, 600, 700, 800] },
  { family: "Bodoni Moda", kind: "serif", weights: [400, 500, 600, 700, 800, 900], italicWeights: [] },
  { family: "Cinzel", kind: "serif", weights: [400, 500, 600, 700, 800, 900], italicWeights: [] },
  { family: "Marcellus", kind: "serif", weights: [400], italicWeights: [] },
  { family: "Italiana", kind: "serif", weights: [400], italicWeights: [] },
  // Linéales.
  { family: "Poppins", kind: "sans", weights: [400, 500, 600, 700], italicWeights: [] },
  { family: "Montserrat", kind: "sans", weights: [300, 400, 500, 600, 700, 800], italicWeights: [] },
  { family: "Raleway", kind: "sans", weights: [300, 400, 500, 600, 700, 800], italicWeights: [] },
  { family: "Josefin Sans", kind: "sans", weights: [300, 400, 500, 600, 700], italicWeights: [] },
  // Affiche.
  { family: "Bebas Neue", kind: "display", weights: [400], italicWeights: [] },
  { family: "Anton", kind: "display", weights: [400], italicWeights: [] },
  { family: "Abril Fatface", kind: "display", weights: [400], italicWeights: [] },
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
