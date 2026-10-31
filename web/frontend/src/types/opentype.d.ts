// opentype.js 2 ne fournit pas de types : seulement ce que la mesure des textes de carte utilise.
declare module "opentype.js" {
  export type Glyph = { advanceWidth?: number };
  export type Font = {
    unitsPerEm: number;
    charToGlyph(char: string): Glyph;
    getKerningValue(left: Glyph, right: Glyph): number;
  };
  export function parse(buffer: ArrayBuffer): Font;
}
