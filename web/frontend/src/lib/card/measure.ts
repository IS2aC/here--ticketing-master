import "server-only";
import { parse, type Font as Parsed } from "opentype.js";
import { cardFonts } from "./fonts";
import { FONT_FAMILY, GUEST_MIN_SIZE, textBox, type TextLayout } from "./layout";

// Nom et table de l'invité : mesurés avec la police de la carte (les mêmes fichiers que Satori) pour tenir
// en entier, sur une ligne, dans la largeur réservée par l'éditeur. Trop long : la taille est réduite.

let parsed: Promise<Map<string, Parsed>> | undefined;

function fonts(): Promise<Map<string, Parsed>> {
  parsed ??= cardFonts().then(
    (all) => new Map(all.filter((f) => f.style === "normal").map((f) => [`${f.name}/${f.weight}`, parse(f.data)])),
  );
  return parsed;
}

/** Largeur du texte en pixels, approche comprise. */
export function textWidth(font: Parsed, text: string, size: number): number {
  let units = 0;
  let previous = null;
  for (const char of text) {
    const glyph = font.charToGlyph(char);
    units += (glyph.advanceWidth ?? font.unitsPerEm / 2) + (previous ? font.getKerningValue(previous, glyph) : 0);
    previous = glyph;
  }
  return (units / font.unitsPerEm) * size;
}

/** Taille à laquelle le texte tient sur une ligne dans sa zone (jamais plus grande que celle choisie). */
export async function fittedSize(text: string, layout: TextLayout): Promise<number> {
  const weight = layout.bold && layout.font !== "script" ? 600 : 400;
  const font = (await fonts()).get(`${FONT_FAMILY[layout.font]}/${weight}`);
  if (!font) return layout.size;
  // Marge de 2 % : l'arrondi de Satori ne doit pas renvoyer la dernière lettre à la ligne.
  const available = textBox(layout).width * 0.98;
  const width = textWidth(font, text.trim(), layout.size);
  if (width <= available) return layout.size;
  return Math.max(GUEST_MIN_SIZE, Math.floor(layout.size * (available / width) * 10) / 10);
}
