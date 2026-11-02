import type { AssetSource, ImageAsset, PagePreset } from "../domain/document/types.ts";

// Contrats entre l'éditeur et les bibliothèques de modèles et de ressources. Implémentation actuelle :
// catalogue intégré au moteur (fichiers livrés avec l'application) et images de l'appareil. Lors de
// l'intégration, Here! fournira les siennes (API) sans que l'interface ni le moteur changent.
//
// La recherche et le filtrage sont faits par la bibliothèque, pas par l'interface : une bibliothèque distante
// filtre côté serveur et ne renvoie qu'une page de résultats. Les éléments privés qu'un utilisateur n'a pas le
// droit de voir ne sont jamais renvoyés (ni dans les listes ni dans les aperçus).

export type LibraryErrorCode =
  /** Élément inexistant, retiré, ou invisible pour cet utilisateur. */
  | "not_found"
  /** Accès refusé (bibliothèque distante : authentification, droits). */
  | "forbidden"
  /** Contenu illisible ou non conforme au modèle documentaire. */
  | "invalid"
  /** Modèle d'une version de schéma que ce moteur ne sait pas lire. */
  | "unsupported_version"
  /** Bibliothèque injoignable (réseau, serveur, stockage de l'appareil). */
  | "unavailable";

/** Message destiné à l'utilisateur : il explique et propose une suite, sans détail technique. */
export interface LibraryError {
  readonly code: LibraryErrorCode;
  readonly message: string;
}

export type LibraryResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: LibraryError };

export const ok = <T>(value: T): LibraryResult<T> => ({ ok: true, value });
export const fail = <T>(code: LibraryErrorCode, message: string): LibraryResult<T> => ({
  ok: false,
  error: { code, message },
});

/** Page de résultats. `nextCursor` : à repasser pour la page suivante ; null : dernière page. */
export interface ResultPage<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly nextCursor: string | null;
}

// ——— Modèles ———

/**
 * Catégories : les types d'événements de Here! (mêmes codes), limités à ceux du catalogue. Un modèle peut en
 * avoir plusieurs, comme dans Here!.
 */
export type TemplateCategory =
  "mariage" | "dot" | "bapteme" | "anniversaire" | "seminaire" | "reunion" | "concert_prive" | "festival";

/** Ce qu'il faut pour présenter un modèle sans charger son document. */
export interface TemplateSummary {
  /** Identifiant stable du modèle (noté dans meta.template du document créé). */
  readonly id: string;
  /** Version du contenu du modèle ; augmente à chaque modification publiée. */
  readonly version: number;
  readonly name: string;
  readonly description: string;
  readonly categories: readonly TemplateCategory[];
  readonly tags: readonly string[];
  readonly page: { readonly width: number; readonly height: number; readonly preset: PagePreset };
  /** Vignette (URL affichable, taille réduite) ; null : pas d'aperçu, l'interface affiche un emplacement. */
  readonly thumbnailUrl: string | null;
}

export interface TemplateQuery {
  /** Texte libre : nom, description, catégorie, mots-clés. Vide : tous. */
  readonly text?: string;
  readonly category?: TemplateCategory | null;
  readonly preset?: PagePreset | null;
  readonly cursor?: string | null;
  readonly limit?: number;
}

/** Valeurs de filtre réellement présentes : on ne propose pas un filtre qui ne trouverait rien. */
export interface TemplateFacets {
  readonly categories: readonly TemplateCategory[];
  readonly presets: readonly PagePreset[];
}

export interface TemplateCatalog {
  facets(): Promise<LibraryResult<TemplateFacets>>;
  list(query: TemplateQuery): Promise<LibraryResult<ResultPage<TemplateSummary>>>;
  /**
   * Document du modèle, tel que stocké : donnée externe NON validée. L'appelant le lit avec loadDocument
   * (contrôle de version, migration, validation) avant toute utilisation.
   */
  load(id: string): Promise<LibraryResult<{ readonly summary: TemplateSummary; readonly document: unknown }>>;
}

// ——— Ressources ———

/** Ornement fourni avec le moteur, ou image importée depuis cet appareil. */
export type AssetOrigin = "bundled" | "device";

export interface LibraryAsset {
  /** Identifiant dans la bibliothèque (pas dans un document). */
  readonly id: string;
  readonly origin: AssetOrigin;
  readonly name: string;
  readonly mimeType: ImageAsset["mimeType"];
  /** Dimensions intrinsèques du fichier, en pixels. */
  readonly width: number;
  readonly height: number;
  /** Où le document trouvera le fichier : clé stable, jamais une URL temporaire. */
  readonly source: AssetSource;
  /** Aperçu de taille réduite ; null : l'interface affiche un emplacement. */
  readonly thumbnailUrl: string | null;
  readonly tags: readonly string[];
  /**
   * Licence connue du fichier, conservée telle quelle. null : aucune licence n'est renseignée — ce n'est PAS
   * une autorisation de réutilisation hors de l'éditeur.
   */
  readonly license: string | null;
}

export interface AssetQuery {
  readonly text?: string;
  readonly cursor?: string | null;
  readonly limit?: number;
}

export interface AssetLibrary {
  readonly origin: AssetOrigin;
  list(query: AssetQuery): Promise<LibraryResult<ResultPage<LibraryAsset>>>;
  /** Vérifie, juste avant l'insertion, que le fichier est toujours accessible à cet utilisateur. */
  ensureAvailable(asset: LibraryAsset): Promise<LibraryResult<void>>;
}
