import QRCode from "qrcode";

// QR code stylisé du sceau Here! (éditeur de cartes) : forme des points, des coins (repères) et couleur.
// Il reste lisible au scan :
//   - les trois repères (coins) restent pleins ;
//   - la zone autour reste blanche (le sceau) ;
//   - la couleur doit contraster avec le blanc (4,5:1, comme un texte, vérifié aussi par l'API) ;
//   - les points ronds ou arrondis, plus petits, passent en correction d'erreur « Q ».
// L'éditeur vérifie en plus le résultat en le relisant (jsQR) avant de valider la carte.

export type QrDots = "carres" | "ronds" | "arrondis";
export type QrCorners = "carres" | "arrondis";
export type QrStyle = { dots: QrDots; corners: QrCorners; color: string };

export const DEFAULT_QR_STYLE: QrStyle = { dots: "carres", corners: "carres", color: "#0B0B0B" };

export const QR_DOTS: { id: QrDots; label: string }[] = [
  { id: "carres", label: "Carrés" },
  { id: "arrondis", label: "Arrondis" },
  { id: "ronds", label: "Ronds" },
];

export const QR_CORNERS: { id: QrCorners; label: string }[] = [
  { id: "carres", label: "Carrés" },
  { id: "arrondis", label: "Arrondis" },
];

/** Contenu du QR code d'exemple (sceau de l'éditeur) : sa relecture prouve que le style reste lisible. */
export const SAMPLE_QR_VALUE = "https://here.example/i/apercu-du-qr-code-de-l-invite";

/** Contraste minimal de la couleur des points sur le blanc du sceau. */
export const QR_MIN_CONTRAST = 4.5;

export interface QrMatrix {
  readonly size: number;
  isDark(row: number, col: number): boolean;
}

export function qrMatrix(value: string, style: QrStyle = DEFAULT_QR_STYLE): QrMatrix {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: style.dots === "carres" ? "M" : "Q" });
  return { size: modules.size, isDark: (row, col) => Boolean(modules.get(row, col)) };
}

/** Repères (7 × 7) des trois coins : coin supérieur gauche de chacun, en modules. */
export function finderOrigins(size: number): [number, number][] {
  return [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
}

export function inFinder(size: number, row: number, col: number): boolean {
  return finderOrigins(size).some(([r, c]) => row >= r && row < r + 7 && col >= c && col < c + 7);
}

/** Dessin SVG (une unité = un module, sans marge : le sceau fournit la zone blanche). */
export function styledQrSvg(value: string, style: QrStyle = DEFAULT_QR_STYLE): string {
  const qr = qrMatrix(value, style);
  const { size } = qr;
  const parts: string[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!qr.isDark(row, col) || inFinder(size, row, col)) continue;
      if (style.dots === "ronds") parts.push(`<circle cx="${col + 0.5}" cy="${row + 0.5}" r="0.46"/>`);
      else if (style.dots === "arrondis")
        parts.push(`<rect x="${col + 0.04}" y="${row + 0.04}" width="0.92" height="0.92" rx="0.32"/>`);
      else parts.push(`<rect x="${col}" y="${row}" width="1" height="1"/>`);
    }
  }
  const round = style.corners === "arrondis";
  for (const [r, c] of finderOrigins(size)) {
    // Anneau 7 × 7 (règle evenodd) et carré central 3 × 3.
    const [outer, inner] = round ? [2.2, 1.5] : [0, 0];
    parts.push(
      `<path fill-rule="evenodd" d="${roundedRect(c, r, 7, 7, outer)}${roundedRect(c + 1, r + 1, 5, 5, inner)}"/>`,
      `<rect x="${c + 2}" y="${r + 2}" width="3" height="3" rx="${round ? 0.9 : 0}"/>`,
    );
  }
  const crisp = style.dots === "carres" && !round ? ' shape-rendering="crispEdges"' : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"${crisp}><g fill="${style.color}">${parts.join("")}</g></svg>`;
}

function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  if (r === 0) return `M${x} ${y}h${w}v${h}h${-w}z`;
  return (
    `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}` +
    `h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`
  );
}

/** Style lu dans une donnée externe (mise en page enregistrée, adresse) ; le style par défaut sinon. */
export function parseQrStyle(raw: unknown): QrStyle {
  const value = (raw ?? {}) as Partial<Record<keyof QrStyle, unknown>>;
  return {
    dots: QR_DOTS.some((d) => d.id === value.dots) ? (value.dots as QrDots) : DEFAULT_QR_STYLE.dots,
    corners: QR_CORNERS.some((c) => c.id === value.corners) ? (value.corners as QrCorners) : DEFAULT_QR_STYLE.corners,
    color: typeof value.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(value.color) ? value.color.toUpperCase() : DEFAULT_QR_STYLE.color,
  };
}
