import { describe, expect, it } from "vitest";
import { normalizeRotation, roundGeometry } from "./constraints.ts";

describe("roundGeometry", () => {
  it("arrondit à 0,01 px", () => {
    expect(roundGeometry(10.123456)).toBe(10.12);
    expect(roundGeometry(0.1 + 0.2)).toBe(0.3);
  });

  it("ne renvoie jamais -0", () => {
    expect(Object.is(roundGeometry(-0.001), 0)).toBe(true);
  });

  it("laisse passer NaN pour que la validation le refuse (aucune correction silencieuse)", () => {
    expect(roundGeometry(Number.NaN)).toBeNaN();
  });
});

describe("normalizeRotation", () => {
  it("reste dans [0, 360)", () => {
    for (const degrees of [-720.5, -1, 0, 359.994, 359.996, 360, 721]) {
      const result = normalizeRotation(degrees);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(360);
    }
  });
});
