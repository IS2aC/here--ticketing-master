import { PAGE_PRESETS } from "../domain/document/presets.ts";
import type { PagePreset } from "../domain/document/types.ts";
import type { TemplateCategory, TemplateSummary } from "./contracts.ts";

// Libellés affichés (et cherchables) des catégories et des formats.

export const CATEGORY_LABELS: Readonly<Record<TemplateCategory, string>> = {
  mariage: "Mariage",
  dot: "Dot",
  bapteme: "Baptême",
  anniversaire: "Anniversaire",
  seminaire: "Séminaire",
  reunion: "Réunion",
  concert_prive: "Concert privé",
  festival: "Festival",
};

/** Ordre d'affichage des catégories (celui des types d'événements de Here!). */
export const CATEGORY_ORDER: readonly TemplateCategory[] = Object.keys(CATEGORY_LABELS) as TemplateCategory[];

export function presetLabel(preset: PagePreset): string {
  return preset === "custom" ? "Format libre" : PAGE_PRESETS[preset].label;
}

/** Ordre d'affichage des formats. */
export const PRESET_ORDER: readonly PagePreset[] = [...(Object.keys(PAGE_PRESETS) as PagePreset[]), "custom"];

/** « Mariage, Dot · A5 à imprimer » : catégories et format d'un modèle. */
export function templateMeta(template: TemplateSummary): string {
  const categories = template.categories.map((c) => CATEGORY_LABELS[c]).join(", ");
  return [categories, presetLabel(template.page.preset)].filter(Boolean).join(" · ");
}
