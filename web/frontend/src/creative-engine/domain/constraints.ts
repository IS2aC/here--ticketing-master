// Bornes du modèle, partagées par le schéma (validation des données externes) et les commandes.
// Toutes les longueurs sont en px du document.
export const LIMITS = {
  pageSize: { min: 16, max: 8000 },
  /** Position d'un élément : il peut déborder de la page (fond perdu, éléments partiellement visibles). */
  coordinate: { min: -100_000, max: 100_000 },
  elementSize: { max: 100_000 },
  elementCount: { max: 1000 },
  assetCount: { max: 500 },
  title: { maxLength: 200 },
  name: { maxLength: 100 },
  textContent: { maxLength: 5000 },
  fontFamily: { maxLength: 100 },
  fontSize: { min: 1, max: 2000 },
  lineHeight: { min: 0.5, max: 5 },
  /** En em : -0,5 em à 2 em. */
  letterSpacing: { min: -0.5, max: 2 },
  strokeWidth: { min: 0.1, max: 500 },
  assetKey: { maxLength: 500 },
  assetPixels: { max: 20_000 },
  dpi: { min: 72, max: 1200 },
  printMm: { min: 10, max: 2000 },
  bleedMm: { min: 0, max: 20 },
} as const;

/** Arrondi des coordonnées à 0,01 px : évite l'accumulation d'erreurs flottantes au fil des modifications. */
export function roundGeometry(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  // -0 (Math.round(-0,004 × 100)) devient 0. NaN reste NaN : la validation le refusera, rien n'est corrigé en silence.
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Rotation ramenée dans [0, 360). */
export function normalizeRotation(degrees: number): number {
  // L'arrondi peut donner 360 (359,999) : le second modulo le ramène à 0.
  return roundGeometry(((degrees % 360) + 360) % 360) % 360;
}
