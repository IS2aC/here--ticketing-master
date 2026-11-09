// Couleurs proposées pour le code couleur d'un événement (tous types), rangées par famille.
// Les teintes courantes des cérémonies et soirées en Côte d'Ivoire : métaux, pastels, couleurs franches, tons
// sombres. L'organisateur peut toujours choisir une autre couleur au sélecteur.

export type NamedColor = { hex: string; name: string };
export type ColorFamily = { label: string; colors: NamedColor[] };

export const EVENT_COLOR_FAMILIES: ColorFamily[] = [
  {
    label: "Neutres et métaux",
    colors: [
      { hex: "#FFFFFF", name: "Blanc" },
      { hex: "#F6F1E6", name: "Ivoire" },
      { hex: "#E8D9BC", name: "Champagne" },
      { hex: "#D8C3A5", name: "Beige" },
      { hex: "#C9A24A", name: "Or" },
      { hex: "#B76E5C", name: "Or rose" },
      { hex: "#C0C4C8", name: "Argent" },
      { hex: "#8A8D91", name: "Gris perle" },
      { hex: "#5C3A21", name: "Chocolat" },
      { hex: "#0B0B0B", name: "Noir" },
    ],
  },
  {
    label: "Rouges et roses",
    colors: [
      { hex: "#E10600", name: "Rouge" },
      { hex: "#7D2335", name: "Bordeaux" },
      { hex: "#A4243B", name: "Framboise" },
      { hex: "#D81B7A", name: "Fuchsia" },
      { hex: "#E89AAE", name: "Rose" },
      { hex: "#F2D4D7", name: "Rose poudré" },
      { hex: "#F08A7E", name: "Corail" },
      { hex: "#E9B7A2", name: "Pêche" },
    ],
  },
  {
    label: "Oranges et jaunes",
    colors: [
      { hex: "#B5522E", name: "Terracotta" },
      { hex: "#E87722", name: "Orange" },
      { hex: "#F2A541", name: "Abricot" },
      { hex: "#D9A21B", name: "Moutarde" },
      { hex: "#F4D35E", name: "Jaune soleil" },
      { hex: "#F7E7A6", name: "Jaune pâle" },
    ],
  },
  {
    label: "Verts",
    colors: [
      { hex: "#0F6B4C", name: "Émeraude" },
      { hex: "#1F3B2D", name: "Vert forêt" },
      { hex: "#6B8F71", name: "Vert sauge" },
      { hex: "#6E7533", name: "Olive" },
      { hex: "#A8C69F", name: "Vert d'eau" },
      { hex: "#7BC043", name: "Vert pomme" },
    ],
  },
  {
    label: "Bleus",
    colors: [
      { hex: "#1F3A5F", name: "Bleu nuit" },
      { hex: "#1B2A4A", name: "Bleu marine" },
      { hex: "#1F5FBF", name: "Bleu roi" },
      { hex: "#1A9BA6", name: "Turquoise" },
      { hex: "#8EC5E8", name: "Bleu ciel" },
      { hex: "#C9DDF0", name: "Bleu poudré" },
    ],
  },
  {
    label: "Violets",
    colors: [
      { hex: "#4B1D52", name: "Prune" },
      { hex: "#6B3FA0", name: "Violet" },
      { hex: "#8E5A9B", name: "Mauve" },
      { hex: "#C3A6D6", name: "Lilas" },
      { hex: "#E3D5EC", name: "Lavande" },
    ],
  },
];

const NAMES = new Map(EVENT_COLOR_FAMILIES.flatMap((family) => family.colors.map((c) => [c.hex, c.name] as const)));

/** Nom d'une couleur de la palette (#RRGGBB, casse indifférente), ou null pour une couleur libre. */
export function colorName(hex: string): string | null {
  return NAMES.get(hex.toUpperCase()) ?? null;
}
