import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "./definition";
import { composeCard } from "./engine";
import { createMeasure, type FontFile } from "./measure";

// Chaque modèle du catalogue (web/api/app/card_catalog), avec ses exemples, se dessine sans alerte
// dans tous ses formats, toutes ses palettes et toutes ses polices : mesure avec les vraies polices de la carte.
const CATALOG = "../api/app/card_catalog";
const FONTS: [string, number, "normal" | "italic", string][] = [
  ["Poppins", 400, "normal", "Poppins-Regular.ttf"],
  ["Poppins", 500, "normal", "Poppins-Medium.ttf"],
  ["Poppins", 600, "normal", "Poppins-SemiBold.ttf"],
  ["Poppins", 700, "normal", "Poppins-Bold.ttf"],
  ["Poppins", 800, "normal", "Poppins-ExtraBold.ttf"],
  ["Playfair Display", 400, "normal", "PlayfairDisplay-Regular.ttf"],
  ["Playfair Display", 400, "italic", "PlayfairDisplay-Italic.ttf"],
  ["Playfair Display", 600, "normal", "PlayfairDisplay-SemiBold.ttf"],
  ["Playfair Display", 700, "normal", "PlayfairDisplay-Bold.ttf"],
  ["Inter", 400, "normal", "Inter-Regular.ttf"],
  ["Inter", 500, "normal", "Inter-Medium.ttf"],
  ["Inter", 600, "normal", "Inter-SemiBold.ttf"],
];
const measure = createMeasure(
  FONTS.map(([name, weight, style, file]): FontFile => {
    const b = readFileSync(join("src/styles/brand/fonts", file));
    return { name, weight, style, data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer };
  }),
);
const guest = { name: "Monsieur et Madame Konan", table: "Table 4 · VIP", code: "INV-7K2P-9QXA", qr: "data:image/svg+xml;base64,PHN2Zy8+" };
const codes = (JSON.parse(readFileSync(join(CATALOG, "catalogue.json"), "utf8")) as { code: string }[]).map((c) => c.code);

describe.each(codes)("modèle %s", (code) => {
  const definition = JSON.parse(readFileSync(join(CATALOG, code, "definition.json"), "utf8")) as CardDefinition;
  const assets = Object.fromEntries(
    readdirSync(join(CATALOG, code))
      .filter((f) => f.endsWith(".svg"))
      .map((f) => [f.replace(/\.svg$/, ""), { svg: readFileSync(join(CATALOG, code, f), "utf8") }]),
  );
  const values = Object.fromEntries(definition.fields.map((f) => [f.key, f.example ?? ""]));

  it("a toutes ses images", () => {
    for (const layer of definition.layers) if (layer.type === "image") expect(assets, layer.id).toHaveProperty(layer.asset);
  });

  it.each(definition.formats)("se dessine sans alerte en %s", (format) => {
    for (const palette of definition.theme.palettes) {
      for (const fonts of definition.theme.fonts) {
        const card = composeCard({ definition, format, values, overrides: { palette: palette.id, fonts: fonts.id }, assets, photo: "data:image/jpeg;base64,AA==", guest, measure });
        expect(card.warnings, `${palette.id} / ${fonts.id}`).toEqual([]);
      }
    }
  });
});
