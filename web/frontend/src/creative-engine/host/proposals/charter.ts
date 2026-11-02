import { z } from "zod";
import { FONT_CATALOG } from "../../editor/fontCatalog.ts";
import { GUEST_FONTS } from "../guestFields.ts";

// Charte d'une carte proposée (recommandation 1) : l'IA ne dessine rien, elle décrit la carte en données
// (composition, palette, polices, textes d'accroche) et le moteur la compose (compose.ts). Les faits de
// l'événement (date, lieu, nom de l'invité, QR code) ne passent jamais par l'IA : ils viennent de Here!.

/** Compositions disponibles : les modèles intégrés, qui ont chacun la place du nom, de la table et du sceau. */
export const COMPOSITIONS = [
  "mariage-feuillage-dore",
  "dot-motifs-wax",
  "anniversaire-confettis",
  "bapteme-douceur",
  "seminaire-ondes",
  "festival-nuit-couleurs",
] as const;
export type Composition = (typeof COMPOSITIONS)[number];

export const DIRECTIONS = ["classique", "moderne", "audacieuse"] as const;

const families = FONT_CATALOG.map((f) => f.family) as [string, ...string[]];
const guestFamilies = Object.keys(GUEST_FONTS) as [keyof typeof GUEST_FONTS, ...(keyof typeof GUEST_FONTS)[]];
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

/** Longueurs maximales des textes d'accroche (caractères), à la mesure des zones des compositions. */
export const TEXT_LIMITS = { kicker: 40, title: 48, tagline: 70, closing: 90, guestLabel: 36 } as const;

const line = (max: number) => z.string().trim().max(max);

export const charterSchema = z.strictObject({
  direction: z.enum(DIRECTIONS),
  name: z.string().trim().min(2).max(40),
  composition: z.enum(COMPOSITIONS),
  palette: z.strictObject({
    background: hex,
    surface: hex,
    title: hex,
    text: hex,
    accent: hex,
  }),
  fonts: z.strictObject({
    title: z.enum(families),
    text: z.enum(families),
    guest: z.enum(guestFamilies),
  }),
  ornamentTint: hex.nullable(),
  texts: z.strictObject({
    kicker: line(TEXT_LIMITS.kicker),
    title: line(TEXT_LIMITS.title),
    tagline: line(TEXT_LIMITS.tagline),
    closing: line(TEXT_LIMITS.closing),
    guestLabel: line(TEXT_LIMITS.guestLabel),
  }),
});
export type Charter = z.infer<typeof charterSchema>;

/** Réponse attendue du fournisseur : trois directions différentes. */
export const proposalsSchema = z.strictObject({ proposals: z.array(charterSchema).min(1).max(3) });

/** Faits de l'événement, mis en forme par Here! (route des propositions). */
export interface CardFacts {
  readonly type: string;
  readonly title: string;
  /** « Samedi 20 mars 2027 à 15 h ». */
  readonly dateLine: string;
  /** Nom du lieu, puis adresse : une ou deux lignes ; vide si le lieu n'est pas connu. */
  readonly placeLines: readonly string[];
  readonly dressCode: string | null;
  /** Thème et code couleur saisis à la création de l'événement. */
  readonly theme: string | null;
  readonly colors: readonly string[];
  /** « Merci de confirmer votre présence avant le 1er mars », si une date limite existe. */
  readonly rsvpLine: string | null;
  readonly description: string | null;
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

/**
 * Vrai si le texte n'invente rien : chaque nombre et chaque nom propre (mot à majuscule qui n'ouvre pas une
 * ligne) figure dans les faits. C'est la garantie « zéro faute dans les prénoms » : un nom mal écrit ou
 * inventé par l'IA est refusé.
 */
export function isGrounded(text: string, facts: CardFacts): boolean {
  const source = normalize(
    [facts.title, facts.dateLine, ...facts.placeLines, facts.dressCode, facts.theme, facts.rsvpLine, facts.description].join(" "),
  );
  const words = new Set(source.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  const numbers = new Set(source.match(/\d+/g) ?? []);
  for (const number of text.match(/\d+/g) ?? []) if (!numbers.has(number)) return false;
  for (const textLine of text.split("\n")) {
    const tokens = textLine.split(/[^\p{L}\p{N}'’-]+/u).filter(Boolean);
    for (const [index, token] of tokens.entries()) {
      if (index === 0 || !/^\p{Lu}/u.test(token)) continue;
      const parts = normalize(token).split(/['’-]/).filter((p) => p.length > 1);
      if (parts.some((part) => !words.has(part))) return false;
    }
  }
  return true;
}

/** Textes d'une charte, ceux qui inventent remplacés par ceux de `fallback` (même rôle). */
export function groundedTexts(texts: Charter["texts"], fallback: Charter["texts"], facts: CardFacts): Charter["texts"] {
  const keep = (key: keyof Charter["texts"]) => {
    const value = texts[key];
    return isGrounded(value, facts) ? value : fallback[key];
  };
  return {
    kicker: keep("kicker"),
    // Le titre porte les noms : sans garantie, c'est celui tiré du titre saisi par l'organisateur.
    title: isGrounded(texts.title, facts) && texts.title ? texts.title : fallback.title,
    tagline: keep("tagline"),
    closing: keep("closing"),
    guestLabel: keep("guestLabel"),
  };
}
