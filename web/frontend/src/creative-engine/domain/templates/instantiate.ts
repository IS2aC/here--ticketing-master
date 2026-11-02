import type { CreativeDocument, ImageAsset } from "../document/types.ts";
import type { Element } from "../elements/types.ts";
import { createId as defaultCreateId, type Id } from "../ids.ts";

// Création d'un document à partir d'un modèle (Phase 0, cas d'usage 9). Le modèle est un document valide :
// on le copie entièrement, avec de nouveaux identifiants, et on note son origine. Le document obtenu est
// autonome : le modifier ne touche jamais au modèle, et deux documents créés depuis le même modèle n'ont
// aucun identifiant en commun (pas de collision dans le stockage ni entre éléments).

/** Modèle d'origine, noté dans meta.template. */
export interface TemplateOrigin {
  readonly id: string;
  readonly version: number;
}

export interface InstantiateOptions {
  readonly origin: TemplateOrigin;
  /** Titre du nouveau document ; par défaut, celui du modèle. */
  readonly title?: string;
  /** Horloge et identifiants injectables pour des tests déterministes. */
  readonly now?: string;
  readonly createId?: () => Id;
}

/**
 * Nouveau document issu du modèle `template` (déjà validé et migré). Les identifiants du document, des éléments
 * et des ressources sont régénérés ; les références d'une image vers sa ressource suivent. Les fichiers ne sont
 * pas copiés : la ressource garde la même source (clé de stockage), seul son identifiant dans le document change.
 */
export function instantiateTemplate(
  template: CreativeDocument,
  options: InstantiateOptions,
): CreativeDocument {
  const nextId = options.createId ?? defaultCreateId;
  const now = options.now ?? new Date().toISOString();
  // Copie profonde : aucune référence partagée avec le modèle, même si l'appelant le garde en mémoire.
  const source = structuredClone(template);

  const assetIds = new Map<Id, Id>();
  const assets: Record<Id, ImageAsset> = {};
  for (const [id, asset] of Object.entries(source.assets)) {
    const fresh = nextId();
    assetIds.set(id, fresh);
    assets[fresh] = asset;
  }

  const elements = source.elements.map((element): Element => {
    const id = nextId();
    if (element.type !== "image") return { ...element, id };
    // Une référence orpheline est impossible dans un document validé ; on la garde telle quelle par prudence.
    return { ...element, id, assetId: assetIds.get(element.assetId) ?? element.assetId };
  });

  return {
    ...source,
    id: nextId(),
    meta: {
      title: options.title ?? source.meta.title,
      createdAt: now,
      updatedAt: now,
      template: { id: options.origin.id, version: options.origin.version },
    },
    assets,
    elements,
  };
}
