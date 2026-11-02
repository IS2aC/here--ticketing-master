import type { CardFacts, Charter, Composition } from "./charter.ts";

// Propositions sans IA : trois chartes par type d'événement, écrites à la main. Elles servent quand aucun
// fournisseur n'est configuré, quand il échoue, et pour remplacer un texte de l'IA qui inventerait un fait.

type Look = Omit<Charter, "texts" | "composition" | "direction" | "name">;

const LOOKS = {
  ivoireOr: {
    palette: { background: "#F7F1E8", surface: "#EFE4D2", title: "#2B2620", text: "#4A443B", accent: "#8E6B2E" },
    fonts: { title: "Playfair Display", text: "Poppins", guest: "Great Vibes" },
    ornamentTint: null,
  },
  roseNuit: {
    palette: { background: "#1E1B2E", surface: "#2C2842", title: "#F6E7E1", text: "#D9CFE0", accent: "#E8A598" },
    fonts: { title: "Cormorant Garamond", text: "Montserrat", guest: "Playfair Display" },
    ornamentTint: "#E8A598",
  },
  vertSauge: {
    palette: { background: "#EEF2EA", surface: "#DDE6D6", title: "#24382C", text: "#3E5446", accent: "#6B8F71" },
    fonts: { title: "Cinzel", text: "Montserrat", guest: "Playfair Display" },
    ornamentTint: "#9DB89A",
  },
  terreWax: {
    palette: { background: "#F2D0A4", surface: "#E8BC85", title: "#C8553D", text: "#1F3A5F", accent: "#1F3A5F" },
    fonts: { title: "Playfair Display", text: "Poppins", guest: "Playfair Display" },
    ornamentTint: null,
  },
  indigoOr: {
    palette: { background: "#16233F", surface: "#22345A", title: "#F3E6C4", text: "#D5DDEB", accent: "#D4A84B" },
    fonts: { title: "Cinzel", text: "Poppins", guest: "Playfair Display" },
    ornamentTint: "#D4A84B",
  },
  pastelCiel: {
    palette: { background: "#DCEBF5", surface: "#C8DDEC", title: "#2F4858", text: "#4F6D7A", accent: "#3E5C76" },
    fonts: { title: "Playfair Display", text: "Poppins", guest: "Playfair Display" },
    ornamentTint: null,
  },
  festif: {
    palette: { background: "#FFF4E0", surface: "#FFE6BD", title: "#E4572E", text: "#29335C", accent: "#29335C" },
    fonts: { title: "Playfair Display", text: "Poppins", guest: "Playfair Display" },
    ornamentTint: null,
  },
  nuitNeon: {
    palette: { background: "#2A0F4A", surface: "#3B1A63", title: "#FFFFFF", text: "#F7C6FF", accent: "#FFD166" },
    fonts: { title: "Bebas Neue", text: "Poppins", guest: "Poppins" },
    ornamentTint: null,
  },
  marine: {
    palette: { background: "#0F1B2D", surface: "#172A45", title: "#FFFFFF", text: "#B8C4D6", accent: "#4CC9F0" },
    fonts: { title: "Montserrat", text: "Poppins", guest: "Poppins" },
    ornamentTint: null,
  },
  sobre: {
    palette: { background: "#F4F2EF", surface: "#E6E2DC", title: "#1F1F1F", text: "#4A4A4A", accent: "#6B6B6B" },
    fonts: { title: "Cormorant Garamond", text: "Montserrat", guest: "Playfair Display" },
    ornamentTint: "#8A8A8A",
  },
} satisfies Record<string, Look>;

type Plan = readonly [Composition, keyof typeof LOOKS, string][];

/** Pour chaque type : trois directions (composition, ambiance, nom). */
const PLANS: Record<string, Plan> = {
  mariage: [
    ["mariage-feuillage-dore", "ivoireOr", "Ivoire et or"],
    ["mariage-feuillage-dore", "roseNuit", "Nuit rose poudré"],
    ["bapteme-douceur", "vertSauge", "Couronne de sauge"],
  ],
  dot: [
    ["dot-motifs-wax", "terreWax", "Motifs wax"],
    ["mariage-feuillage-dore", "indigoOr", "Indigo et or"],
    ["dot-motifs-wax", "nuitNeon", "Wax de nuit"],
  ],
  bapteme: [
    ["bapteme-douceur", "pastelCiel", "Douceur"],
    ["bapteme-douceur", "vertSauge", "Sauge tendre"],
    ["mariage-feuillage-dore", "ivoireOr", "Ivoire et or"],
  ],
  funerailles: [
    ["mariage-feuillage-dore", "sobre", "Hommage sobre"],
    ["bapteme-douceur", "vertSauge", "Couronne de sauge"],
    ["seminaire-ondes", "marine", "Nuit paisible"],
  ],
  anniversaire: [
    ["anniversaire-confettis", "festif", "Confettis"],
    ["festival-nuit-couleurs", "nuitNeon", "Soirée néon"],
    ["mariage-feuillage-dore", "indigoOr", "Indigo et or"],
  ],
  seminaire: [
    ["seminaire-ondes", "marine", "Ondes"],
    ["seminaire-ondes", "indigoOr", "Indigo et or"],
    ["mariage-feuillage-dore", "sobre", "Sobre et clair"],
  ],
  festival: [
    ["festival-nuit-couleurs", "nuitNeon", "Nuit des couleurs"],
    ["anniversaire-confettis", "festif", "Confettis"],
    ["seminaire-ondes", "indigoOr", "Indigo et or"],
  ],
};
PLANS.brunch = PLANS.anniversaire as Plan;
PLANS.retrouvailles = PLANS.anniversaire as Plan;
PLANS.reunion = PLANS.seminaire as Plan;
PLANS.concert_prive = PLANS.festival as Plan;
PLANS.autre = PLANS.mariage as Plan;

/** Textes d'accroche par type, sans nom ni date : ceux-là viennent des faits. */
const WORDING: Record<string, Pick<Charter["texts"], "kicker" | "guestLabel" | "tagline"> & { closing: string }> = {
  mariage: { kicker: "Nous nous marions", guestLabel: "Invitation personnelle pour", tagline: "", closing: "Votre présence nous comblera de joie" },
  dot: { kicker: "Cérémonie de dot", guestLabel: "Invitation pour", tagline: "", closing: "Votre présence honorera nos familles" },
  bapteme: { kicker: "Baptême", guestLabel: "Avec joie, nous invitons", tagline: "", closing: "Avec toute notre tendresse" },
  funerailles: { kicker: "En mémoire", guestLabel: "La famille invite", tagline: "", closing: "Merci de votre soutien et de vos prières" },
  anniversaire: { kicker: "Venez fêter avec nous", guestLabel: "Une invitation pour", tagline: "", closing: "On compte sur vous" },
  brunch: { kicker: "Un brunch entre nous", guestLabel: "Une invitation pour", tagline: "", closing: "On compte sur vous" },
  retrouvailles: { kicker: "Les retrouvailles", guestLabel: "Une invitation pour", tagline: "", closing: "On compte sur vous" },
  reunion: { kicker: "Réunion", guestLabel: "Invitation nominative", tagline: "", closing: "Merci de confirmer votre participation" },
  seminaire: { kicker: "Séminaire", guestLabel: "Invitation nominative", tagline: "", closing: "Merci de confirmer votre participation" },
  concert_prive: { kicker: "Concert privé", guestLabel: "Invitation nominative", tagline: "", closing: "Entrée sur invitation" },
  festival: { kicker: "Festival", guestLabel: "Invitation nominative", tagline: "", closing: "Entrée sur invitation" },
  autre: { kicker: "Invitation", guestLabel: "Invitation pour", tagline: "", closing: "Au plaisir de vous voir" },
};

const DIRECTIONS = ["classique", "moderne", "audacieuse"] as const;

/** Mots qui ouvrent souvent un titre d'événement et que le surtitre dit déjà (« Mariage d'Aïcha & Koffi »). */
const TYPE_PREFIX =
  /^(mariage|dot|bapt[eê]me|fun[eé]railles|anniversaire|brunch|retrouvailles|r[eé]union|s[eé]minaire|concert priv[eé]|festival)(\s+(de la|de|du|des)\s+|\s+d['’]|\s+)/i;

/** Titre de la carte : celui de l'événement, sans le type en tête, les deux noms d'un couple sur deux lignes. */
export function cardTitle(facts: CardFacts): string {
  const short = facts.title.replace(TYPE_PREFIX, "").trim() || facts.title;
  return short.replace(/\s+&\s+/, "\n& ");
}

/** Textes par défaut d'un type d'événement (et de remplacement des textes de l'IA refusés). */
export function defaultTexts(facts: CardFacts): Charter["texts"] {
  const wording = WORDING[facts.type] ?? (WORDING.autre as (typeof WORDING)[string]);
  return {
    kicker: wording.kicker,
    title: cardTitle(facts),
    tagline: wording.tagline,
    // La date limite de réponse, si l'organisateur l'a donnée, vaut mieux qu'une formule.
    closing: facts.rsvpLine ?? wording.closing,
    guestLabel: wording.guestLabel,
  };
}

/** Trois chartes pour l'événement, sans IA. */
export function fallbackCharters(facts: CardFacts): Charter[] {
  const plan = PLANS[facts.type] ?? (PLANS.autre as Plan);
  const texts = defaultTexts(facts);
  const charters: Charter[] = plan.map(([composition, look, name], index) => ({
    ...structuredClone(LOOKS[look]),
    direction: DIRECTIONS[index] ?? "classique",
    name,
    composition,
    texts,
  }));
  // Code couleur de l'organisateur : la direction classique le suit (accent et ornements, puis titre).
  const [first] = charters;
  const [accent, title] = facts.colors;
  if (first && accent) {
    first.palette = { ...first.palette, accent, ...(title ? { title } : {}) };
    first.ornamentTint = accent;
    first.name = "Vos couleurs";
  }
  return charters;
}
