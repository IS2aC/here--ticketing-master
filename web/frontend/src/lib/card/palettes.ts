import type { CardFamily } from "./library";

// Palettes des cartes automatiques : chaque palette remplace quelques couleurs de sa famille de cartes.
// La première est celle d'origine. Hommage : palettes sobres, jamais de rouge (DESIGN.md).
// Le sceau Here! garde toujours ses couleurs.

export type CardColors = {
  red: string;
  redBright: string;
  ink: string;
  white: string;
  gray300: string;
  gray500: string;
  gray600: string;
  ivory: string;
  gold: string;
  stone50: string;
  stone600: string;
};

export type Palette = {
  id: string;
  label: string;
  swatch: [string, string]; // fond, accent : pastilles du sélecteur
  colors: Partial<CardColors>;
};

export const PALETTES: Record<CardFamily, Palette[]> = {
  ceremonie: [
    { id: "or", label: "Or et ivoire", swatch: ["#F7F1E8", "#A8823C"], colors: {} },
    { id: "rose", label: "Rose poudré", swatch: ["#FBF0EE", "#B5677A"], colors: { ivory: "#FBF0EE", gold: "#B5677A", stone600: "#7A5A60" } },
    { id: "sauge", label: "Vert sauge", swatch: ["#F1F4EE", "#6E8B5E"], colors: { ivory: "#F1F4EE", gold: "#6E8B5E", stone600: "#55614D" } },
    { id: "nuit", label: "Bleu nuit", swatch: ["#EEF1F6", "#2E4A7D"], colors: { ivory: "#EEF1F6", gold: "#2E4A7D", stone600: "#4C5872" } },
    { id: "bordeaux", label: "Bordeaux", swatch: ["#F8EFEF", "#7D2335"], colors: { ivory: "#F8EFEF", gold: "#7D2335", stone600: "#6B4A50" } },
  ],
  rendez_vous: [
    { id: "rouge", label: "Rouge Here!", swatch: ["#FFFFFF", "#E10600"], colors: {} },
    { id: "corail", label: "Corail", swatch: ["#FFFFFF", "#D94F3B"], colors: { red: "#D94F3B", redBright: "#FFB4A6" } },
    { id: "bleu", label: "Bleu", swatch: ["#FFFFFF", "#1F5FBF"], colors: { red: "#1F5FBF", redBright: "#8DB8FF" } },
    { id: "vert", label: "Vert", swatch: ["#FFFFFF", "#1E7F5C"], colors: { red: "#1E7F5C", redBright: "#8FD9B6" } },
    { id: "violet", label: "Violet", swatch: ["#FFFFFF", "#6B3FA0"], colors: { red: "#6B3FA0", redBright: "#C8A8F0" } },
  ],
  officiel: [
    { id: "noir", label: "Noir", swatch: ["#FFFFFF", "#0B0B0B"], colors: {} },
    { id: "marine", label: "Bleu marine", swatch: ["#FFFFFF", "#1B2A4A"], colors: { ink: "#1B2A4A", gray600: "#5A6478" } },
    { id: "foret", label: "Vert forêt", swatch: ["#FFFFFF", "#1F3B2D"], colors: { ink: "#1F3B2D", gray600: "#5B6B61" } },
    { id: "bordeaux", label: "Bordeaux", swatch: ["#FFFFFF", "#4A1420"], colors: { ink: "#4A1420", gray600: "#6E5A5E" } },
  ],
  hommage: [
    { id: "pierre", label: "Pierre", swatch: ["#F3F1EC", "#5E5A53"], colors: {} },
    { id: "gris", label: "Gris", swatch: ["#F2F2F2", "#5A5A5A"], colors: { stone50: "#F2F2F2", stone600: "#5A5A5A" } },
    { id: "bleu", label: "Bleu ardoise", swatch: ["#EEF1F4", "#4A5868"], colors: { stone50: "#EEF1F4", stone600: "#4A5868" } },
    { id: "sable", label: "Sable", swatch: ["#F4EFE6", "#6E6253"], colors: { stone50: "#F4EFE6", stone600: "#6E6253" } },
  ],
  soiree: [
    { id: "rouge", label: "Rouge et noir", swatch: ["#0B0B0B", "#E10600"], colors: {} },
    { id: "or", label: "Or et noir", swatch: ["#0B0B0B", "#C9A24A"], colors: { red: "#C9A24A", redBright: "#E8C877" } },
    { id: "bleu", label: "Bleu électrique", swatch: ["#0B0B0B", "#2F6BFF"], colors: { red: "#2F6BFF", redBright: "#7FA5FF" } },
    { id: "violet", label: "Violet", swatch: ["#0B0B0B", "#8E44FF"], colors: { red: "#8E44FF", redBright: "#BE9BFF" } },
    { id: "emeraude", label: "Émeraude", swatch: ["#0B0B0B", "#12A37A"], colors: { red: "#12A37A", redBright: "#5FD6AE" } },
  ],
};

/** Palette d'une famille par identifiant ; inconnue ou absente : celle d'origine. */
export function paletteOf(family: CardFamily, id: string | null | undefined): Palette {
  return PALETTES[family].find((p) => p.id === id) ?? PALETTES[family][0];
}
