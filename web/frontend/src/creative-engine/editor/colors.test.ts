import { describe, expect, it } from "vitest";
import { addElement } from "../domain/commands/elementCommands.ts";
import { createDocument, createShapeElement, createTextElement } from "../domain/document/factories.ts";
import type { CreativeDocument } from "../domain/document/types.ts";
import { backgroundBehind, contrastRatio, documentPalette, harmonies, readableColor, targetContrast } from "./colors.ts";

function withElements(...elements: Parameters<typeof addElement>[1]["element"][]): CreativeDocument {
  return elements.reduce((doc, element) => {
    const result = addElement(doc, { element });
    if (!result.ok) throw new Error(result.error.message);
    return result.document;
  }, createDocument());
}

describe("contraste", () => {
  it("noir sur blanc : 21:1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });

  it("un grand texte se contente de 3:1", () => {
    expect(targetContrast(createTextElement({ x: 0, y: 0, width: 100, height: 40, content: "A", style: { fontSize: 48 } }))).toBe(3);
    expect(targetContrast(createTextElement({ x: 0, y: 0, width: 100, height: 20, content: "A", style: { fontSize: 14 } }))).toBe(4.5);
  });

  it("corrige un doré trop clair sur l'ivoire en gardant sa teinte et sa transparence", () => {
    const fixed = readableColor("#E3C77Acc", "#F7F1E8", 4.5);
    expect(contrastRatio(fixed, "#F7F1E8")).toBeGreaterThanOrEqual(4.5);
    expect(fixed.endsWith("CC") || fixed.endsWith("cc")).toBe(true);
  });

  it("éclaircit un texte sur fond sombre ; ne touche pas une couleur déjà lisible", () => {
    expect(contrastRatio(readableColor("#3B3B3B", "#0B0B0B", 4.5), "#0B0B0B")).toBeGreaterThanOrEqual(4.5);
    expect(readableColor("#0B0B0B", "#FFFFFF")).toBe("#0B0B0B");
  });
});

describe("fond derrière un texte", () => {
  const text = createTextElement({ x: 100, y: 100, width: 200, height: 40, content: "Nom" });

  it("le fond de la page, ou la forme pleine la plus haute", () => {
    expect(backgroundBehind(withElements(text), text)).toBe("#FFFFFF");
    const band = createShapeElement({ x: 0, y: 80, width: 1080, height: 100, shape: "rect", fill: "#0B1A3A" });
    expect(backgroundBehind(withElements(band, text), text)).toBe("#0B1A3A");
  });
});

describe("palette et harmonies", () => {
  it("rassemble les couleurs du document, sans doublon", () => {
    const a = createTextElement({ x: 0, y: 0, width: 100, height: 20, content: "a", style: { color: "#A97A2B" } });
    const b = createTextElement({ x: 0, y: 0, width: 100, height: 20, content: "b", style: { color: "#a97a2bff" } });
    expect(documentPalette(withElements(a, b))).toEqual(["#A97A2B", "#FFFFFF"]);
  });

  it("propose analogues, complémentaire et nuances ; un gris n'a que ses nuances", () => {
    expect(harmonies("#E10600")).toHaveLength(5);
    expect(harmonies("#808080")).toHaveLength(2);
  });
});
