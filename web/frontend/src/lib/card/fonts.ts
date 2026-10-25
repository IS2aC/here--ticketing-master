import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Polices de l'identité (src/styles/brand/fonts), chargées une seule fois par processus.
// Incluses dans l'image Docker via outputFileTracingIncludes (next.config.ts).
const FONTS = [
  ["Poppins", 400, "normal", "Poppins-Regular.ttf"],
  ["Poppins", 500, "normal", "Poppins-Medium.ttf"],
  ["Poppins", 600, "normal", "Poppins-SemiBold.ttf"],
  ["Poppins", 700, "normal", "Poppins-Bold.ttf"],
  ["Poppins", 800, "normal", "Poppins-ExtraBold.ttf"],
  ["Poppins", 800, "italic", "Poppins-ExtraBoldItalic.ttf"],
  ["Playfair Display", 400, "normal", "PlayfairDisplay-Regular.ttf"],
  ["Playfair Display", 400, "italic", "PlayfairDisplay-Italic.ttf"],
  ["Playfair Display", 600, "normal", "PlayfairDisplay-SemiBold.ttf"],
  ["DM Mono", 400, "normal", "DMMono-Regular.ttf"],
] as const;

type Font = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700 | 800; style: "normal" | "italic" };

let loaded: Promise<Font[]> | undefined;

export function cardFonts(): Promise<Font[]> {
  loaded ??= Promise.all(
    FONTS.map(async ([name, weight, style, file]) => {
      const buffer = await readFile(join(process.cwd(), "src/styles/brand/fonts", file));
      return { name, weight, style, data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer };
    }),
  );
  return loaded;
}
