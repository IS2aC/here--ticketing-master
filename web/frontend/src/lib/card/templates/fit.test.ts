import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fitText, wrap, type FitRequest, type Measure } from "./fit";
import { createMeasure } from "./measure";

// Police fictive : chaque caractère fait une demi-taille de large.
const mono: Measure = (text, _font, size, spacing) => [...text].length * (size / 2 + spacing);
const font = { family: "Test", weight: 400, italic: false };
const request = (over: Partial<FitRequest>): FitRequest => ({
  text: "Aya & Koffi",
  font,
  width: 600,
  height: 240,
  min: 40,
  max: 100,
  maxLines: 2,
  lineHeight: 1.2,
  letterSpacing: 0,
  ...over,
});

describe("wrap", () => {
  const widthOf = (s: string) => s.length * 10;

  it("coupe entre les mots et garde les retours à la ligne", () => {
    expect(wrap("Aya et Koffi Konan", 100, widthOf)).toEqual(["Aya et", "Koffi", "Konan"]);
    expect(wrap("Accueil\nRepas", 200, widthOf)).toEqual(["Accueil", "Repas"]);
  });

  it("coupe un mot trop long entre deux lettres", () => {
    expect(wrap("Anticonstitutionnellement", 100, widthOf)).toEqual(["Anticonsti", "tutionnell", "ement"]);
  });
});

describe("fitText", () => {
  it("garde la taille maximale quand le texte tient", () => {
    expect(fitText(request({}), mono)).toEqual({ size: 100, lines: ["Aya & Koffi"], overflow: false });
  });

  it("réduit la taille pour tenir dans la zone", () => {
    const fit = fitText(request({ text: "Marie-Christelle & Jean-Baptiste" }), mono);
    expect(fit.overflow).toBe(false);
    expect(fit.size).toBeLessThan(100);
    expect(fit.size).toBeGreaterThanOrEqual(40);
    expect(fit.lines).toHaveLength(2);
    for (const line of fit.lines) expect(mono(line, font, fit.size, 0)).toBeLessThanOrEqual(600 * 0.98);
    expect(fit.lines.length * fit.size * 1.2).toBeLessThanOrEqual(240);
  });

  it("tient compte de l'espacement des lettres", () => {
    const plain = fitText(request({ text: "FAMILLES KONAN ET YAO", maxLines: 1 }), mono);
    const spaced = fitText(request({ text: "FAMILLES KONAN ET YAO", maxLines: 1, letterSpacing: 0.3 }), mono);
    expect(spaced.size).toBeLessThan(plain.size);
  });

  it("signale le débordement et termine par des points de suspension", () => {
    const fit = fitText(request({ text: "Un texte beaucoup trop long pour cette petite zone de la carte", maxLines: 1, height: 60 }), mono);
    expect(fit).toMatchObject({ size: 40, overflow: true });
    expect(fit.lines).toHaveLength(1);
    expect(fit.lines[0].endsWith("…")).toBe(true);
    expect(mono(fit.lines[0], font, 40, 0)).toBeLessThanOrEqual(600 * 0.98);
  });
});

describe("createMeasure", () => {
  const load = (name: string, weight: number, style: "normal" | "italic", file: string) => {
    const b = readFileSync(join("src/styles/brand/fonts", file));
    return { name, weight, style, data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer };
  };
  const measure = createMeasure([
    load("Playfair Display", 400, "normal", "PlayfairDisplay-Regular.ttf"),
    load("Playfair Display", 600, "normal", "PlayfairDisplay-SemiBold.ttf"),
    load("Playfair Display", 400, "italic", "PlayfairDisplay-Italic.ttf"),
  ]);
  const playfair = (weight: number, italic = false) => ({ family: "Playfair Display", weight, italic });

  it("mesure avec les vraies polices, proportionnellement à la taille", () => {
    const at100 = measure("Aya & Koffi", playfair(400), 100, 0);
    expect(at100).toBeGreaterThan(400);
    expect(at100).toBeLessThan(800);
    expect(measure("Aya & Koffi", playfair(400), 50, 0)).toBeCloseTo(at100 / 2, 5);
    expect(measure("Aya", playfair(400), 100, 2)).toBeCloseTo(measure("Aya", playfair(400), 100, 0) + 6, 5);
  });

  it("prend la graisse la plus proche et l'italique quand il existe", () => {
    expect(measure("Koffi", playfair(700), 100, 0)).toBe(measure("Koffi", playfair(600), 100, 0));
    expect(measure("Koffi", playfair(400, true), 100, 0)).not.toBe(measure("Koffi", playfair(400), 100, 0));
    expect(() => measure("Koffi", { family: "Comic Sans", weight: 400, italic: false }, 10, 0)).toThrow("Police absente");
  });
});
