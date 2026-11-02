import type { CreativeDocument } from "../document/types.ts";
import type { Issue } from "../schema/issues.ts";

export type CommandErrorCode =
  | "element_not_found"
  | "element_locked"
  | "duplicate_id"
  | "asset_not_found"
  | "invalid_value"
  | "not_applicable";

export interface CommandError {
  readonly code: CommandErrorCode;
  readonly message: string;
  /** Pour invalid_value : les règles du schéma qui ne sont pas respectées. */
  readonly issues?: readonly Issue[];
}

/**
 * Résultat d'une commande. En cas de succès sans changement (par exemple « mettre au premier plan » un élément
 * qui y est déjà), le document renvoyé est le MÊME objet : l'historique n'enregistre alors rien.
 * En cas d'échec, le document d'origine n'est pas modifié (les commandes ne mutent jamais leur entrée).
 */
export type CommandResult =
  | { readonly ok: true; readonly document: CreativeDocument }
  | { readonly ok: false; readonly error: CommandError };

export function success(document: CreativeDocument): CommandResult {
  return { ok: true, document };
}

export function failure(code: CommandErrorCode, message: string, issues?: readonly Issue[]): CommandResult {
  return { ok: false, error: issues ? { code, message, issues } : { code, message } };
}
