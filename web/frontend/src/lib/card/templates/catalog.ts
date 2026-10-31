import "server-only";
import { notFound, redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { EventType } from "@/lib/event-types";
import { getSessionToken } from "@/lib/session";
import type { CardDefinition } from "./definition";
import type { AssetData } from "./engine";

// Catalogue des modèles Here! (API /v1/card-templates) et leurs images.

export type CardStyleName = "luxe_gold" | "boho" | "minimal" | "wax_afro" | "floral";

export type CardTemplate = {
  id: string;
  code: string;
  name: string;
  style: CardStyleName | null;
  event_types: EventType[]; // vide : proposé pour tous les types
  definition: CardDefinition;
  assets: string[];
};

export const STYLE_LABELS: Record<CardStyleName, string> = {
  luxe_gold: "Luxe et or",
  boho: "Bohème",
  minimal: "Épuré",
  wax_afro: "Wax / afro",
  floral: "Floral",
};

// Photo des aperçus du catalogue (remplacée par celle de l'organisateur sur sa carte).
export const EXAMPLE_PHOTO = "exemple-photo";

async function catalogFetch<T>(path: string): Promise<T> {
  const response = await apiFetch(`/v1/card-templates${path}`, { token: await getSessionToken() });
  if (response.status === 401) redirect("/connexion");
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error(`API /v1/card-templates${path} : ${response.status}`);
  return response.json();
}

export function getCardTemplates(eventType?: EventType): Promise<CardTemplate[]> {
  return catalogFetch(eventType ? `?event_type=${eventType}` : "");
}

export function getCardTemplate(code: string): Promise<CardTemplate> {
  return catalogFetch(`/${encodeURIComponent(code)}`);
}

/** Images du modèle pour le rendu : SVG en texte (teintés par la palette), photos en data: URI. */
export async function templateAssets(template: CardTemplate): Promise<Record<string, AssetData>> {
  const entries = await Promise.all(
    template.assets.map(async (key): Promise<[string, AssetData] | null> => {
      const response = await apiFetch(`/v1/card-templates/${encodeURIComponent(template.code)}/assets/${encodeURIComponent(key)}`);
      if (!response.ok) return null;
      const type = response.headers.get("content-type") ?? "";
      if (type.startsWith("image/svg+xml")) return [key, { svg: await response.text() }];
      return [key, { uri: `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}` }];
    }),
  );
  return Object.fromEntries(entries.filter((e) => e !== null));
}

/** Valeurs d'exemple des champs, pour les aperçus du catalogue. */
export function exampleValues(definition: CardDefinition): Record<string, string> {
  return Object.fromEntries(definition.fields.map((f) => [f.key, f.example ?? f.default ?? ""]));
}
