import { describe, expect, it } from "vitest";
import { cropFor, cropFromPixels, framingOf } from "./photoCrop.ts";

const portrait = { width: 400, height: 500 };
const landscape = { width: 3000, height: 2000 };

describe("cadrage d'une photo", () => {
  it("prend la plus grande partie de la photo aux proportions du cadre", () => {
    // Photo 3:2 dans un cadre 4:5 : toute la hauteur, 0,8 × 2/3 = 53 % de la largeur, centrée.
    expect(cropFor({ zoom: 1, centerX: 0.5, centerY: 0.5 }, portrait, landscape)).toEqual({
      x: 0.2333,
      y: 0,
      width: 0.5333,
      height: 1,
    });
  });

  it("zoome autour du centre choisi sans sortir de la photo", () => {
    const crop = cropFor({ zoom: 2, centerX: 0.98, centerY: 0.02 }, portrait, landscape);
    expect(crop.width).toBeCloseTo(0.2667, 3);
    expect(crop.height).toBe(0.5);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1);
    expect(crop.y).toBe(0);
  });

  it("retrouve le cadrage d'un recadrage", () => {
    const framing = { zoom: 1.5, centerX: 0.4, centerY: 0.6 };
    const back = framingOf(cropFor(framing, portrait, landscape), portrait, landscape);
    expect(back.zoom).toBeCloseTo(1.5, 2);
    expect(back.centerX).toBeCloseTo(0.4, 3);
    expect(back.centerY).toBeCloseTo(0.6, 3);
    expect(framingOf(null, portrait, landscape)).toEqual({ zoom: 1, centerX: 0.5, centerY: 0.5 });
  });

  it("convertit une zone en pixels sans jamais dépasser la photo", () => {
    for (const x of [0, 1000.3, 1401.7, 1999.99]) {
      const crop = cropFromPixels({ x, y: 0, width: 1000.37, height: 2000 }, landscape);
      expect(crop.x + crop.width).toBeLessThanOrEqual(1);
      expect(crop.y + crop.height).toBeLessThanOrEqual(1);
    }
  });
});
