import { describe, expect, it } from "vitest";
import { PAGE_PRESETS, matchesPreset, mmToPx, orientationOf, presetSize } from "./presets.ts";

describe("formats de page", () => {
  it("convertit les mm en px comme Here! (A5 à 300 dpi = 1748 × 2480)", () => {
    expect(mmToPx(148, 300)).toBe(1748);
    expect(mmToPx(210, 300)).toBe(2480);
    expect(PAGE_PRESETS["print-a5"]).toMatchObject({ width: 1748, height: 2480 });
  });

  it("déduit l'orientation des dimensions", () => {
    expect(orientationOf({ width: 1080, height: 1350 })).toBe("portrait");
    expect(orientationOf({ width: 1350, height: 1080 })).toBe("landscape");
    expect(orientationOf({ width: 1080, height: 1080 })).toBe("square");
  });

  it("inverse dimensions et format physique en paysage", () => {
    expect(presetSize("print-a5", "landscape")).toEqual({
      width: 2480,
      height: 1748,
      print: { widthMm: 210, heightMm: 148, dpi: 300, bleedMm: 3 },
    });
  });

  it("ignore l'orientation d'un format carré", () => {
    expect(presetSize("square", "landscape")).toMatchObject({ width: 1080, height: 1080 });
  });

  it("reconnaît un format dans les deux orientations", () => {
    expect(matchesPreset("social-4-5", { width: 1350, height: 1080 })).toBe(true);
    expect(matchesPreset("social-4-5", { width: 1080, height: 1080 })).toBe(false);
  });
});
