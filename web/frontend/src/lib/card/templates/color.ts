import type { ColorKey, ColorRef } from "./definition";

// Couleurs d'un modèle : une couleur du thème suit la palette choisie, un #RRGGBB reste fixe.

export function resolveColor(ref: ColorRef, colors: Record<ColorKey, string>): string {
  return ref.startsWith("#") ? ref : colors[ref as ColorKey];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Seuil WCAG AA : 3 pour un grand texte (24 px et plus sur une carte de 1080), 4,5 sinon. */
export function contrastThreshold(size: number, scale: number): number {
  return size / scale >= 24 ? 3 : 4.5;
}

/** SVG en data: URI (fonctionne côté serveur et dans le navigateur). */
export function svgUri(svg: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(svg)) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/** Ornement SVG aux couleurs de la palette : currentColor prend la couleur demandée. */
export function tintSvg(svg: string, color: string): string {
  return svg.replaceAll("currentColor", color);
}
