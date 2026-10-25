import type { IconName } from "@/components/icons";

// Ordre et pictogrammes de la maquette uiux/visual-identity/mockups/backoffice-creation.html.
export const EVENT_TYPES = [
  { value: "mariage", label: "Mariage", icon: "mariage" },
  { value: "dot", label: "Dot", icon: "cadeau" },
  { value: "bapteme", label: "Baptême", icon: "favori" },
  { value: "funerailles", label: "Funérailles", icon: "hommage" },
  { value: "anniversaire", label: "Anniversaire", icon: "anniversaire" },
  { value: "brunch", label: "Brunch", icon: "brunch" },
  { value: "retrouvailles", label: "Retrouvailles", icon: "retrouvailles" },
  { value: "reunion", label: "Réunion", icon: "reunion" },
  { value: "seminaire", label: "Séminaire", icon: "conference" },
  { value: "concert_prive", label: "Concert privé", icon: "concert" },
  { value: "festival", label: "Festival", icon: "festival" },
  { value: "autre", label: "Autre", icon: "ajouter" },
] as const satisfies readonly { value: string; label: string; icon: IconName }[];

export type EventType = (typeof EVENT_TYPES)[number]["value"];

export function eventType(value: EventType) {
  return EVENT_TYPES.find((t) => t.value === value) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
}

// Les événements sont saisis et affichés à l'heure d'Abidjan (UTC+0, sans heure d'été).
export const EVENT_TIME_ZONE = "Africa/Abidjan";
export const EVENT_UTC_OFFSET = "+00:00";
