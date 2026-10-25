import type { EventType } from "@/lib/event-types";

// Bibliothèque de cartes : une carte par type d'événement, sur les 5 modèles de uiux/visual-identity/mockups/carte-*.
// Textes au vouvoiement, sans jargon ; Hommage : formules sobres, aucun rouge, aucun point d'exclamation.

export type CardFamily = "ceremonie" | "rendez_vous" | "officiel" | "soiree" | "hommage";

export type CardStyle = {
  family: CardFamily;
  label: string; // petit titre en capitales (« MARIAGE »)
  icon: string; // pictogramme de ICON_SVG
  formula: string; // phrase au-dessus du nom de l'événement
  closing: string; // message de fin
};

export const CARD_LIBRARY: Record<EventType, CardStyle> = {
  mariage: {
    family: "ceremonie",
    label: "Mariage",
    icon: "mariage",
    formula: "Nous avons la joie de vous inviter à célébrer",
    closing: "Merci de confirmer votre présence.",
  },
  dot: {
    family: "ceremonie",
    label: "Dot",
    icon: "cadeau",
    formula: "Nous avons la joie de vous inviter à la cérémonie de",
    closing: "Merci de confirmer votre présence.",
  },
  bapteme: {
    family: "ceremonie",
    label: "Baptême",
    icon: "favori",
    formula: "Nous avons la joie de vous inviter au",
    closing: "Merci de confirmer votre présence.",
  },
  funerailles: {
    family: "hommage",
    label: "Hommage",
    icon: "hommage",
    formula: "La famille vous prie de bien vouloir l'accompagner lors de",
    closing: "Votre présence sera un réconfort pour la famille.",
  },
  anniversaire: {
    family: "rendez_vous",
    label: "Anniversaire",
    icon: "anniversaire",
    formula: "Nous vous invitons à fêter",
    closing: "On compte sur vous !",
  },
  brunch: {
    family: "rendez_vous",
    label: "Brunch",
    icon: "brunch",
    formula: "Nous vous invitons à partager",
    closing: "On compte sur vous !",
  },
  retrouvailles: {
    family: "rendez_vous",
    label: "Retrouvailles",
    icon: "retrouvailles",
    formula: "Nous vous invitons à nous retrouver pour",
    closing: "On compte sur vous !",
  },
  reunion: {
    family: "officiel",
    label: "Réunion",
    icon: "reunion",
    formula: "Nous avons le plaisir de vous convier à",
    closing: "Merci de confirmer votre participation.",
  },
  seminaire: {
    family: "officiel",
    label: "Séminaire",
    icon: "conference",
    formula: "Nous avons le plaisir de vous convier à",
    closing: "Merci de confirmer votre participation.",
  },
  concert_prive: {
    family: "soiree",
    label: "Concert privé · Sur invitation",
    icon: "concert",
    formula: "Une soirée sur invitation",
    closing: "Présentez cette carte à l'entrée.",
  },
  festival: {
    family: "soiree",
    label: "Festival · Sur invitation",
    icon: "festival",
    formula: "Une invitation pour le festival",
    closing: "Présentez cette carte à l'entrée.",
  },
  autre: {
    family: "rendez_vous",
    label: "Invitation",
    icon: "invitation",
    formula: "Nous avons le plaisir de vous inviter à",
    closing: "Merci de confirmer votre présence.",
  },
};
