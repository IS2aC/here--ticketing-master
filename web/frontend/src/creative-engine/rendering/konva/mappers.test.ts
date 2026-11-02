import { describe, expect, it } from "vitest";
import { createShapeElement, createTextElement } from "../../domain/document/factories.ts";
import { gradientConfig, shadowConfig, shapeConfig, textConfig } from "./mappers.ts";

const GOLD = { from: "#B8862E", to: "#F3D98B", angle: 90 } as const;

describe("effets → Konva", () => {
  it("sans effet : ni ombre, ni contour, ni dégradé", () => {
    const config = textConfig(createTextElement({ x: 0, y: 0, width: 400, height: 80, content: "Aïcha" }));
    expect(config).toMatchObject({ shadowEnabled: false, strokeEnabled: false, fill: "#0B0B0B" });
    expect(config).not.toHaveProperty("fillPriority");
  });

  it("ombre : couleur, flou et décalage", () => {
    expect(shadowConfig({ color: "#0B0B0B40", blur: 12, offsetX: 0, offsetY: 6 })).toEqual({
      shadowEnabled: true,
      shadowColor: "#0B0B0B40",
      shadowBlur: 12,
      shadowOffsetX: 0,
      shadowOffsetY: 6,
      shadowOpacity: 1,
    });
  });

  it("dégradé vertical sur toute la boîte du texte", () => {
    const text = createTextElement({ x: 0, y: 0, width: 400, height: 100, content: "Aïcha", style: { gradient: GOLD } });
    const config = textConfig(text);
    expect(config.fillPriority).toBe("linear-gradient");
    expect(config.fillLinearGradientStartPoint).toEqual({ x: 200, y: 0 });
    expect(config.fillLinearGradientEndPoint).toEqual({ x: 200, y: 100 });
    expect(config.fillLinearGradientColorStops).toEqual([0, GOLD.from, 1, GOLD.to]);
  });

  it("dégradé à 0° : de gauche à droite ; ellipse : boîte centrée", () => {
    const flat = gradientConfig({ ...GOLD, angle: 0 }, { width: 300, height: 100 }, { x: -150, y: -50 });
    expect(flat.fillLinearGradientStartPoint).toEqual({ x: -150, y: 0 });
    expect(flat.fillLinearGradientEndPoint).toEqual({ x: 150, y: 0 });
  });

  it("contour du texte sous les lettres, deux fois plus large (la moitié est cachée)", () => {
    const text = createTextElement({
      x: 0,
      y: 0,
      width: 400,
      height: 80,
      content: "Aïcha",
      style: { outline: { color: "#FFFFFF", width: 3 } },
    });
    expect(textConfig(text)).toMatchObject({ stroke: "#FFFFFF", strokeWidth: 6, fillAfterStrokeEnabled: true });
  });

  it("forme en dégradé : remplie même sans couleur unie", () => {
    const rect = { ...createShapeElement({ x: 0, y: 0, width: 200, height: 100, shape: "rect", fill: null }), gradient: GOLD };
    const shape = shapeConfig(rect);
    expect(shape.kind === "rect" && shape.config).toMatchObject({ fillEnabled: true, fillPriority: "linear-gradient" });
  });
});
