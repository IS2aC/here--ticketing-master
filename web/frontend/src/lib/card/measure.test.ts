import { describe, expect, it, vi } from "vitest";
import { fittedSize } from "./measure";
import { textBox, type TextLayout } from "./layout";

vi.mock("server-only", () => ({}));

const name: TextLayout = { x: 540, y: 700, size: 64, width: 600, color: "#0B0B0B", font: "serif", bold: true };

describe("nom de l'invité dans sa zone", () => {
  it("garde la taille choisie quand le nom tient", async () => {
    expect(await fittedSize("Awa Koné", name)).toBe(64);
  });

  it("réduit la police d'un nom trop long pour la largeur réservée", async () => {
    const long = "Monsieur et Madame Konan Kouassi Jean-Baptiste";
    const size = await fittedSize(long, name);
    expect(size).toBeLessThan(64);
    expect(size).toBeGreaterThanOrEqual(18);
    // Même nom, zone deux fois plus large : moins réduit.
    expect(await fittedSize(long, { ...name, width: 1000 })).toBeGreaterThan(size);
  });

  it("mesure avec la vraie police : la calligraphie ne prend pas la même place", async () => {
    const long = "Mademoiselle Aya Marie-Josée N'Guessan";
    expect(await fittedSize(long, { ...name, font: "script", bold: false })).not.toBe(await fittedSize(long, name));
  });

  it("sans largeur réservée, la zone va jusqu'aux bords", () => {
    expect(textBox({ ...name, width: null }).width).toBe(1032);
    expect(textBox({ ...name, x: 395, width: 742 }).left).toBe(24);
  });
});
