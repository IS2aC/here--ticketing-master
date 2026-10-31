// « Mon propre modèle » : mise en page sur le fond importé, en pixels de la carte (1080 × 1350).
// Géométrie commune au rendu (render.tsx) et à l'éditeur de la page Carte : l'aperçu correspond à la carte.

export type TextLayout = {
  x: number; // centre de la zone
  y: number;
  size: number; // taille du texte
  color: string; // #RRGGBB
  font: "sans" | "serif"; // Poppins ou Playfair Display
  bold: boolean;
};

export type QrSpot = "bas-droite" | "bas-gauche" | "bas-centre" | "haut-droite" | "haut-gauche";

export type CardLayout = { name: TextLayout; table: TextLayout | null; qr: QrSpot };

export const CANVAS = { width: 1080, height: 1350 };

// Bloc du QR code (sceau Here! compact) : QR code sur blanc, code et mention « vérifiée par Here! ».
export const QR_BOX = { width: 260, height: 318 };
const MARGIN = 44;

export const QR_SPOTS: { id: QrSpot; label: string }[] = [
  { id: "bas-droite", label: "En bas à droite" },
  { id: "bas-centre", label: "En bas au centre" },
  { id: "bas-gauche", label: "En bas à gauche" },
  { id: "haut-droite", label: "En haut à droite" },
  { id: "haut-gauche", label: "En haut à gauche" },
];

export function qrPosition(spot: QrSpot): { left: number; top: number } {
  const left =
    spot.endsWith("gauche") ? MARGIN : spot.endsWith("droite") ? CANVAS.width - MARGIN - QR_BOX.width : (CANVAS.width - QR_BOX.width) / 2;
  const top = spot.startsWith("haut") ? MARGIN : CANVAS.height - MARGIN - QR_BOX.height;
  return { left, top };
}

/** Zone d'un texte : centrée sur (x, y), aussi large que le permettent les bords, deux lignes au plus. */
export function textBox(t: TextLayout): { left: number; top: number; width: number; height: number } {
  const half = Math.max(140, Math.min(t.x, CANVAS.width - t.x) - 24);
  const height = Math.round(t.size * 1.25 * 2);
  return { left: t.x - half, top: Math.round(t.y - height / 2), width: half * 2, height };
}

export const FONT_FAMILY: Record<TextLayout["font"], string> = { sans: "Poppins", serif: "Playfair Display" };

/** Texte de la seconde zone : table et catégorie de l'invité (« Table 4 · VIP »). */
export function tableText(seat: string | null, category: string | null): string {
  return [seat, category].filter(Boolean).join(" · ");
}
