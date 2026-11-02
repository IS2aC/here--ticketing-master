import type { CommandError, CommandResult } from "../commands/result.ts";
import type { CreativeDocument } from "../document/types.ts";

// Historique par instantanés immuables (ADR-006). Une entrée garde le document entier, mais comme les commandes
// partagent tout ce qui n'a pas changé, une entrée ne coûte que le tableau `elements` et l'élément modifié.
// Annuler = reprendre l'instantané précédent : aucune opération inverse à écrire, donc aucune à mal écrire.
// L'historique ne contient que le document : sélection, zoom et panneaux n'y entrent pas.

export interface HistoryEntry {
  /** Libellé affichable (« Déplacer », « Modifier le texte »). */
  readonly label: string;
  readonly document: CreativeDocument;
}

export interface History {
  /** Du plus ancien au plus récent ; chaque entrée est l'état AVANT l'action nommée. */
  readonly past: readonly HistoryEntry[];
  readonly present: CreativeDocument;
  /** Du prochain à rétablir au plus lointain ; chaque entrée est l'état APRÈS l'action nommée. */
  readonly future: readonly HistoryEntry[];
  readonly limit: number;
  /** Geste continu en cours (curseur, glisser) : des aperçus sans entrée, puis une seule entrée à la fin. */
  readonly transaction: { readonly label: string; readonly base: CreativeDocument } | null;
}

export const DEFAULT_HISTORY_LIMIT = 100;

export function createHistory(document: CreativeDocument, limit = DEFAULT_HISTORY_LIMIT): History {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError(`Limite d'historique invalide : ${limit}`);
  return { past: [], present: document, future: [], limit, transaction: null };
}

function push(history: History, label: string, before: CreativeDocument, next: CreativeDocument): History {
  return {
    ...history,
    past: [...history.past, { label, document: before }].slice(-history.limit),
    present: next,
    future: [],
    transaction: null,
  };
}

/**
 * Enregistre un nouvel état. Rien n'est enregistré si le document n'a pas changé (même objet).
 * Une nouvelle action après une annulation efface les actions qui pouvaient être rétablies.
 */
export function record(history: History, label: string, next: CreativeDocument): History {
  if (history.transaction)
    throw new Error("Une transaction est en cours : terminez-la ou annulez-la d'abord");
  if (next === history.present) return history;
  return push(history, label, history.present, next);
}

/** Applique le résultat d'une commande : un échec ne touche pas l'historique et renvoie l'erreur. */
export function apply(
  history: History,
  label: string,
  result: CommandResult,
): { history: History; error: CommandError | null } {
  if (!result.ok) return { history, error: result.error };
  return { history: record(history, label, result.document), error: null };
}

export function canUndo(history: History): boolean {
  return history.transaction === null && history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.transaction === null && history.future.length > 0;
}

/** Sans effet s'il n'y a rien à annuler ou si une transaction est en cours. */
export function undo(history: History): History {
  const entry = history.past.at(-1);
  if (!entry || history.transaction) return history;
  return {
    ...history,
    past: history.past.slice(0, -1),
    present: entry.document,
    future: [{ label: entry.label, document: history.present }, ...history.future],
  };
}

/** Sans effet s'il n'y a rien à rétablir ou si une transaction est en cours. */
export function redo(history: History): History {
  const [entry, ...rest] = history.future;
  if (!entry || history.transaction) return history;
  return {
    ...history,
    past: [...history.past, { label: entry.label, document: history.present }].slice(-history.limit),
    present: entry.document,
    future: rest,
  };
}

export function beginTransaction(history: History, label: string): History {
  if (history.transaction) throw new Error("Une transaction est déjà en cours");
  return { ...history, transaction: { label, base: history.present } };
}

/** Aperçu pendant une transaction : l'état courant change, l'historique non. Un échec est sans effet. */
export function preview(history: History, result: CommandResult): History {
  if (!history.transaction) throw new Error("Aucune transaction en cours");
  return result.ok ? { ...history, present: result.document } : history;
}

/** Une seule entrée pour tout le geste, ou aucune si l'état final est celui du départ. */
export function commitTransaction(history: History): History {
  const transaction = history.transaction;
  if (!transaction) throw new Error("Aucune transaction en cours");
  if (history.present === transaction.base) return { ...history, transaction: null };
  return push(history, transaction.label, transaction.base, history.present);
}

export function cancelTransaction(history: History): History {
  const transaction = history.transaction;
  if (!transaction) throw new Error("Aucune transaction en cours");
  return { ...history, present: transaction.base, transaction: null };
}
