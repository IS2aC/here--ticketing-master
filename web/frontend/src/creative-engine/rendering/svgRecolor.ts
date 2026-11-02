import { formatHex, oklch, parse } from "culori";
import type { HexColor } from "../domain/elements/types.ts";

// Recoloration d'un SVG dans une teinte, en gardant son modelé : chaque couleur du dessin (remplissage, contour,
// arrêts de dégradé) prend la teinte et la saturation demandées, et garde son écart de clarté avec la clarté
// moyenne du dessin. Un feuillage doré en dégradé devient un feuillage rose poudré en dégradé, pas un aplat.
// Texte en entrée, texte en sortie : testable sans navigateur.

const COLOR_PROPERTY =
  /\b(fill|stroke|stop-color|flood-color|lighting-color|color)(\s*[:=]\s*["']?)((?:rgba?|hsla?)\([^)]*\)|[^"';)}>\s]+)/g;
const IGNORED = new Set(["none", "transparent", "currentcolor", "inherit"]);

function readColor(value: string) {
  if (IGNORED.has(value.toLowerCase()) || value.startsWith("url(")) return null;
  const parsed = parse(value);
  return parsed ? oklch(parsed) : null;
}

export function recolorSvg(svg: string, tint: HexColor): string {
  const target = oklch(tint.slice(0, 7));
  if (!target) return svg;
  const found = [...svg.matchAll(COLOR_PROPERTY)].map((m) => readColor(m[3] ?? "")).filter((c) => c !== null);
  if (found.length === 0) return svg;
  const mean = found.reduce((sum, c) => sum + (c.l ?? 0), 0) / found.length;

  return svg.replace(COLOR_PROPERTY, (whole, property: string, separator: string, value: string) => {
    const color = readColor(value);
    if (!color) return whole;
    // Blancs et noirs purs (reflets, traits) gardent leur rôle : seule leur clarté relative compte aussi.
    const lightness = Math.min(0.98, Math.max(0.05, (target.l ?? 0.5) + ((color.l ?? 0) - mean)));
    const next = formatHex({ mode: "oklch", l: lightness, c: target.c ?? 0, h: target.h }).toUpperCase();
    return `${property}${separator}${next}`;
  });
}
