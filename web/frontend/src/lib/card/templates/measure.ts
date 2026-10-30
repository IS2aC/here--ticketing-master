import opentype from "opentype.js";
import type { Measure } from "./fit";

// Mesure des textes avec les fichiers de polices de la carte (ceux que Satori dessine) :
// pour chaque famille, le fichier de la graisse la plus proche, en italique s'il existe.

export type FontFile = { name: string; weight: number; style: "normal" | "italic"; data: ArrayBuffer };

export function createMeasure(files: FontFile[]): Measure {
  const parsed = files.map((file) => ({ ...file, font: opentype.parse(file.data) }));
  const cache = new Map<string, (typeof parsed)[number]>();

  const pick = (family: string, weight: number, italic: boolean) => {
    const key = `${family}/${weight}/${italic}`;
    let found = cache.get(key);
    if (!found) {
      const candidates = parsed.filter((f) => f.name === family);
      if (!candidates.length) throw new Error(`Police absente de la carte : ${family}`);
      const styled = candidates.filter((f) => (f.style === "italic") === italic);
      found = (styled.length ? styled : candidates).reduce((best, f) =>
        Math.abs(f.weight - weight) < Math.abs(best.weight - weight) ? f : best,
      );
      cache.set(key, found);
    }
    return found.font;
  };

  // Glyphe par glyphe, avec le crénage : la mise en forme complète d'opentype.js échoue sur certaines tables (ccmp).
  return (text, font, size, letterSpacing) => {
    const face = pick(font.family, font.weight, font.italic);
    const glyphs = [...text].map((char) => face.charToGlyph(char));
    let units = 0;
    glyphs.forEach((glyph, i) => {
      units += glyph.advanceWidth ?? 0;
      if (i > 0) units += face.getKerningValue(glyphs[i - 1], glyph);
    });
    return (units / face.unitsPerEm) * size + letterSpacing * glyphs.length;
  };
}
