import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { inFinder, parseQrStyle, qrMatrix, styledQrSvg, type QrStyle } from "./qr";

const URL = "https://here.example/i/Xk3v9QpL0aZ7bT2mN8cR4yW6eH1uJ5sD";
const PX = 8;
const QUIET = 4;

/** Dessine le QR comme le SVG (formes des points comprises), sur blanc, puis le relit avec jsQR. */
function decode(style: QrStyle): string | null {
  const qr = qrMatrix(URL, style);
  const side = (qr.size + 2 * QUIET) * PX;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(style.color.slice(i, i + 2), 16));
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const row = Math.floor(y / PX) - QUIET;
      const col = Math.floor(x / PX) - QUIET;
      if (row < 0 || col < 0 || row >= qr.size || col >= qr.size || !qr.isDark(row, col)) continue;
      const [u, v] = [(x % PX) / PX + 0.5 / PX - 0.5, (y % PX) / PX + 0.5 / PX - 0.5];
      const finder = inFinder(qr.size, row, col);
      const dark =
        finder || style.dots === "carres"
          ? true
          : style.dots === "ronds"
            ? Math.hypot(u, v) <= 0.46
            : Math.abs(u) <= 0.46 && Math.abs(v) <= 0.46;
      if (!dark) continue;
      data.set([r ?? 0, g ?? 0, b ?? 0, 255], (y * side + x) * 4);
    }
  }
  return jsQR(data, side, side)?.data ?? null;
}

describe("QR code stylisé", () => {
  it.each([
    { dots: "carres", corners: "carres", color: "#0B0B0B" },
    { dots: "ronds", corners: "arrondis", color: "#0B0B0B" },
    { dots: "arrondis", corners: "arrondis", color: "#7A5A1E" },
    { dots: "ronds", corners: "carres", color: "#0B1A3A" },
  ] as const)("reste lisible : points $dots, coins $corners, $color", (style) => {
    expect(decode(style)).toBe(URL);
  });

  it("dessine les repères pleins et les points dans la couleur choisie", () => {
    const svg = styledQrSvg(URL, { dots: "ronds", corners: "arrondis", color: "#7A5A1E" });
    expect(svg).toContain('fill="#7A5A1E"');
    expect(svg).toContain("<circle");
    expect(svg.match(/fill-rule="evenodd"/g)).toHaveLength(3);
  });

  it("lit un style enregistré, et revient au style par défaut sur une valeur inconnue", () => {
    expect(parseQrStyle({ dots: "ronds", corners: "arrondis", color: "#7a5a1e" })).toEqual({
      dots: "ronds",
      corners: "arrondis",
      color: "#7A5A1E",
    });
    expect(parseQrStyle({ dots: "étoiles", color: "rouge" })).toEqual({ dots: "carres", corners: "carres", color: "#0B0B0B" });
  });
});
