import { fail, ok, type AssetLibrary, type LibraryAsset } from "../contracts.ts";
import { matchesQuery, paginate } from "../search.ts";
import { legacyOrnamentKey, ornamentKey } from "./keys.ts";
import manifest from "./ornaments.json";

// Ornements livrés avec le moteur (public/creative-engine/ornaments, produits par `pnpm library:build` dans le dépôt du moteur).
// Dessinés pour le projet ; aucune licence n'est renseignée (le porteur du projet la fixera).
// Publics : visibles par tout utilisateur de l'éditeur.

interface ManifestEntry {
  readonly id: string;
  readonly name: string;
  readonly tags: readonly string[];
  readonly width: number;
  readonly height: number;
}

/** Fichiers servis par Next depuis public/creative-engine/ornaments. */
const ORNAMENT_BASE = "/creative-engine/ornaments";

/** URL de chaque ressource intégrée, par clé de stockage (résolution des documents). */
export const BUNDLED_ASSET_URLS: ReadonlyMap<string, string> = new Map(
  manifest.flatMap((entry: ManifestEntry) => {
    return [
      [ornamentKey(entry.id), `${ORNAMENT_BASE}/${entry.id}.svg`] as const,
      [legacyOrnamentKey(entry.id), `${ORNAMENT_BASE}/${entry.id}.webp`] as const,
    ];
  }),
);

function toAsset(entry: ManifestEntry): LibraryAsset {
  const key = ornamentKey(entry.id);
  return {
    id: `ornament:${entry.id}`,
    origin: "bundled",
    name: entry.name,
    mimeType: "image/svg+xml",
    width: entry.width,
    height: entry.height,
    source: { type: "remote", key },
    // Les ornements sont légers (quelques dizaines de Ko) : le fichier sert d'aperçu.
    thumbnailUrl: BUNDLED_ASSET_URLS.get(key) ?? null,
    tags: entry.tags,
    license: null,
  };
}

export function createBundledAssetLibrary(entries: readonly ManifestEntry[] = manifest): AssetLibrary {
  const assets = entries.map(toAsset);
  return {
    origin: "bundled",
    list(query) {
      const matching = assets.filter((a) => matchesQuery(query.text, [a.name, ...a.tags]));
      return Promise.resolve(ok(paginate(matching, query.cursor, query.limit)));
    },
    ensureAvailable(asset) {
      return Promise.resolve(
        asset.source.type === "remote" && BUNDLED_ASSET_URLS.has(asset.source.key)
          ? ok(undefined)
          : fail("not_found", "Cette ressource n'est plus disponible."),
      );
    },
  };
}
