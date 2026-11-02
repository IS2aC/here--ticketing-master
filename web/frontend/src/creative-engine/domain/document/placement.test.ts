import { describe, expect, it } from "vitest";
import { placeImage } from "./placement.ts";

const PAGE = { width: 1080, height: 1350 };

describe("placeImage", () => {
  it("réduit une grande image à 60 % de la page, centrée, proportions conservées", () => {
    expect(placeImage({ width: 4000, height: 3000 }, PAGE)).toEqual({
      x: 216,
      y: 432,
      width: 648,
      height: 486,
    });
  });

  it("limite par la hauteur une image très haute", () => {
    const placed = placeImage({ width: 1000, height: 5000 }, PAGE);

    expect(placed.height).toBe(810);
    expect(placed.width).toBe(162);
    expect(placed.x + placed.width / 2).toBe(540);
  });

  it("n'agrandit pas une petite image", () => {
    expect(placeImage({ width: 200, height: 100 }, PAGE)).toEqual({
      x: 440,
      y: 625,
      width: 200,
      height: 100,
    });
  });

  it("garde au moins 1 px sur chaque dimension", () => {
    const placed = placeImage({ width: 20000, height: 1 }, PAGE);

    expect(placed.width).toBe(648);
    expect(placed.height).toBe(1);
  });
});
