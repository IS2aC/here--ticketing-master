import { oklch } from "culori";
import { describe, expect, it } from "vitest";
import { recolorSvg } from "./svgRecolor.ts";

const GOLD = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><defs><linearGradient id="g"><stop offset="0" stop-color="#D9B872"/><stop offset="1" stop-color="#8E6B2E"/></linearGradient></defs><path d="M0 0h10v10z" fill="url(#g)"/><path d="M0 0h5v5z" fill="#B8924A" stroke="none" style="opacity:.5"/></svg>`;

const colors = (svg: string) => [...svg.matchAll(/#[0-9A-F]{6}/g)].map((m) => m[0]);
const hue = (hex: string) => oklch(hex)?.h ?? NaN;
const light = (hex: string) => oklch(hex)?.l ?? NaN;

describe("recoloration d'un SVG", () => {
  it("donne la teinte demandée à toutes les couleurs, en gardant le modelé", () => {
    const pink = recolorSvg(GOLD, "#C77D8A");
    const [clear, dark, middle] = colors(pink);
    for (const color of [clear, dark, middle]) expect(Math.abs(hue(color ?? "") - hue("#C77D8A"))).toBeLessThan(3);
    // L'arrêt clair reste plus clair que l'arrêt sombre, la couleur moyenne entre les deux.
    expect(light(clear ?? "")).toBeGreaterThan(light(middle ?? ""));
    expect(light(middle ?? "")).toBeGreaterThan(light(dark ?? ""));
  });

  it("laisse les références, « none » et le reste du dessin intacts", () => {
    const pink = recolorSvg(GOLD, "#C77D8A");
    expect(pink).toContain('fill="url(#g)"');
    expect(pink).toContain('stroke="none"');
    expect(pink).toContain('d="M0 0h10v10z"');
    expect(pink).toContain("opacity:.5");
  });

  it("recolore aussi les couleurs écrites en style et en rgb()", () => {
    const svg = `<svg><rect style="fill:rgb(184, 146, 74);stroke:#000"/></svg>`;
    expect(colors(recolorSvg(svg, "#2B4C7E"))).toHaveLength(2);
  });
});
