import type { CreativeDocument } from "../domain/document/types.ts";
import type { Id } from "../domain/ids.ts";
import type { Issue } from "../domain/schema/issues.ts";

// Contrat entre l'éditeur et le stockage des documents (ADR-007). Deux implémentations sont prévues :
// IndexedDB maintenant (cet appareil), HTTP fournie par l'hôte (Here!) lors de l'intégration.
//
// Trois versions à ne pas confondre :
//   - schemaVersion : version du MODÈLE documentaire (dans le document, migrations du domaine) ;
//   - revision : version de CONCURRENCE d'un document enregistré, incrémentée à chaque enregistrement par le
//     stockage ; un enregistrement doit annoncer la révision qu'il remplace (concurrence optimiste) ;
//   - savedAt : date du dernier enregistrement, fixée par le stockage (copiée dans meta.updatedAt).

/** Ce qu'il faut pour lister et retrouver un document sans charger son contenu. */
export interface DocumentSummary {
  readonly id: Id;
  readonly title: string;
  readonly revision: number;
  /** ISO 8601. */
  readonly savedAt: string;
  readonly page: { readonly width: number; readonly height: number };
}

export interface StoredDocument {
  readonly document: CreativeDocument;
  readonly revision: number;
  readonly savedAt: string;
  /** Avertissements du chargement (migration appliquée, champs inconnus retirés). */
  readonly warnings: readonly Issue[];
}

export interface SaveReceipt {
  readonly revision: number;
  readonly savedAt: string;
}

export type RepositoryErrorCode =
  /** Aucun document avec cet identifiant (ou supprimé). */
  | "not_found"
  /** Le document enregistré n'a plus la révision attendue : modifié ailleurs (autre onglet, autre appareil). */
  | "conflict"
  /** Accès refusé (implémentation HTTP : authentification, propriété). */
  | "forbidden"
  /** Contenu illisible ou non conforme au schéma. */
  | "invalid"
  /** Document d'une version de schéma que ce moteur ne sait pas lire. */
  | "unsupported_version"
  /** Document au-delà de la taille autorisée. */
  | "too_large"
  /** Espace de stockage plein. */
  | "quota_exceeded"
  /** Stockage indisponible (navigation privée, réseau, serveur). */
  | "unavailable";

/**
 * Échec d'une opération. Le message est destiné à l'utilisateur : il explique sans révéler de détail technique
 * (chemins, requêtes, identifiants de connexion). Le détail éventuel sert au diagnostic local uniquement.
 */
export interface RepositoryError {
  readonly code: RepositoryErrorCode;
  readonly message: string;
  readonly issues?: readonly Issue[];
}

export type RepositoryResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: RepositoryError };

export interface DocumentRepository {
  /** Documents accessibles, du plus récemment enregistré au plus ancien. */
  list(): Promise<RepositoryResult<DocumentSummary[]>>;
  /** Contenu validé (et migré si besoin) d'un document. */
  load(id: Id): Promise<RepositoryResult<StoredDocument>>;
  /**
   * Enregistre le document. `expectedRevision` est la révision qu'il remplace : 0 pour une création.
   * Échoue avec « conflict » si le stockage n'a plus cette révision ; rien n'est alors écrasé.
   */
  save(document: CreativeDocument, expectedRevision: number): Promise<RepositoryResult<SaveReceipt>>;
  /** Suppression définitive. */
  remove(id: Id): Promise<RepositoryResult<void>>;
}

export function ok<T>(value: T): RepositoryResult<T> {
  return { ok: true, value };
}

export function fail<T>(
  code: RepositoryErrorCode,
  message: string,
  issues?: readonly Issue[],
): RepositoryResult<T> {
  return { ok: false, error: issues ? { code, message, issues } : { code, message } };
}

/** Messages par défaut, compréhensibles et sans détail technique. */
export const ERROR_MESSAGES: Record<RepositoryErrorCode, string> = {
  not_found: "Ce document est introuvable. Il a peut-être été supprimé.",
  conflict: "Ce document a été modifié ailleurs (dans un autre onglet) depuis votre dernier enregistrement.",
  forbidden: "Vous n'avez pas accès à ce document.",
  invalid: "Ce document est endommagé ou n'est pas un document Here! Creative Engine.",
  unsupported_version: "Ce document a été créé avec une version plus récente de l'éditeur.",
  too_large: "Ce document est trop volumineux pour être enregistré.",
  quota_exceeded: "L'espace de stockage de cet appareil est plein. Libérez de la place, puis réessayez.",
  unavailable:
    "Le stockage de cet appareil est indisponible (navigation privée ?). Vos modifications restent à l'écran.",
};
