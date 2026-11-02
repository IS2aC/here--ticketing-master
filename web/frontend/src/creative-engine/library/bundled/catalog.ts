import type { PagePreset } from "../../domain/document/types.ts";
import { fail, ok, type TemplateCatalog, type TemplateCategory, type TemplateSummary } from "../contracts.ts";
import { CATEGORY_LABELS, CATEGORY_ORDER, presetLabel, PRESET_ORDER } from "../labels.ts";
import { matchesQuery, paginate } from "../search.ts";
import manifest from "./catalog.json";
import { TEMPLATE_DOCUMENTS } from "./templateDocuments.ts";

// Catalogue de modèles livré avec le moteur (src/library/bundled, produit par `pnpm library:build`).
//   - catalog.json : métadonnées, chargées avec l'application (quelques Ko) ; liste, recherche et filtres ;
//   - templates/*.json : documents, chargés un par un, seulement quand on utilise un modèle ;
//   - public/creative-engine/thumbnails/*.webp : vignettes, téléchargées par le navigateur quand elles s'affichent.
// Ces modèles sont publics : tout utilisateur de l'éditeur peut les voir et les utiliser.

interface ManifestEntry {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly description: string;
  readonly categories: readonly string[];
  readonly tags: readonly string[];
  readonly page: { readonly width: number; readonly height: number; readonly preset: string };
}

const DOCUMENTS = TEMPLATE_DOCUMENTS;
/** Vignettes servies par Next depuis public/ (copiées depuis thumbnails/ du moteur). */
const THUMBNAIL_BASE = "/creative-engine/thumbnails";

const isCategory = (value: string): value is TemplateCategory => value in CATEGORY_LABELS;
const isPreset = (value: string): value is PagePreset => (PRESET_ORDER as readonly string[]).includes(value);

function toSummary(entry: ManifestEntry): TemplateSummary {
  return {
    id: entry.id,
    version: entry.version,
    name: entry.name,
    description: entry.description,
    categories: entry.categories.filter(isCategory),
    tags: entry.tags,
    page: {
      width: entry.page.width,
      height: entry.page.height,
      preset: isPreset(entry.page.preset) ? entry.page.preset : "custom",
    },
    thumbnailUrl: `${THUMBNAIL_BASE}/${entry.id}.webp`,
  };
}

/** Texte cherchable d'un modèle : nom, description, catégories (libellés), mots-clés, format. */
function searchableText(summary: TemplateSummary): string[] {
  return [
    summary.name,
    summary.description,
    ...summary.categories.map((c) => CATEGORY_LABELS[c]),
    ...summary.tags,
    presetLabel(summary.page.preset),
  ];
}

export interface BundledCatalogSource {
  readonly entries: readonly ManifestEntry[];
  readonly documents: Readonly<Record<string, () => Promise<unknown>>>;
}

/** Catalogue intégré ; `source` remplace les fichiers livrés (tests). */
export function createBundledTemplateCatalog(
  source: BundledCatalogSource = { entries: manifest, documents: DOCUMENTS },
): TemplateCatalog {
  const summaries = source.entries.map(toSummary);
  return {
    facets() {
      const categories = new Set(summaries.flatMap((s) => s.categories));
      const presets = new Set(summaries.map((s) => s.page.preset));
      return Promise.resolve(
        ok({
          categories: CATEGORY_ORDER.filter((c) => categories.has(c)),
          presets: PRESET_ORDER.filter((p) => presets.has(p)),
        }),
      );
    },

    list(query) {
      const matching = summaries.filter(
        (s) =>
          (!query.category || s.categories.includes(query.category)) &&
          (!query.preset || s.page.preset === query.preset) &&
          matchesQuery(query.text, searchableText(s)),
      );
      return Promise.resolve(ok(paginate(matching, query.cursor, query.limit)));
    },

    async load(id) {
      const summary = summaries.find((s) => s.id === id);
      const loader = source.documents[`./templates/${id}.json`];
      if (!summary || !loader) return fail("not_found", "Ce modèle n'existe plus. Choisissez-en un autre.");
      try {
        // Copie : le module JSON est partagé ; l'appelant reçoit une donnée qu'il peut transformer librement.
        return ok({ summary, document: structuredClone(await loader()) });
      } catch {
        return fail(
          "unavailable",
          "Le modèle n'a pas pu être téléchargé. Vérifiez votre connexion et réessayez.",
        );
      }
    },
  };
}
