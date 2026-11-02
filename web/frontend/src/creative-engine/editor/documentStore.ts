import { create } from "zustand";
import type { CommandError, CommandResult } from "../domain/commands/result.ts";
import { createDocument } from "../domain/document/factories.ts";
import type { CreativeDocument } from "../domain/document/types.ts";
import * as H from "../domain/history/history.ts";

export type DocumentCommand = (doc: CreativeDocument) => CommandResult;

// Seul propriétaire du document courant et de son historique (ADR-003, ADR-006). Toute modification passe
// par une commande du domaine : il n'existe pas d'autre façon d'écrire dans le document.
//
// Gestes continus (flèche maintenue, curseur, sélecteur de couleur) : beginTransaction, puis autant de
// preview que nécessaire, puis commitTransaction → une seule entrée d'historique. Une action ordinaire
// (execute, undo, load…) valide d'abord la transaction ouverte : l'historique n'est jamais laissé à moitié.
interface DocumentState {
  history: H.History;
  load: (doc: CreativeDocument) => void;
  /** Une commande = une entrée d'historique en cas de succès. Renvoie l'erreur éventuelle. */
  execute: (label: string, command: DocumentCommand) => CommandError | null;
  /** Plusieurs commandes formant une seule action : tout ou rien, une seule entrée. */
  executeAll: (label: string, commands: readonly DocumentCommand[]) => CommandError | null;
  undo: () => void;
  redo: () => void;
  beginTransaction: (label: string) => void;
  /** Aperçu dans la transaction ouverte (ouverte automatiquement si besoin) ; tout ou rien. */
  preview: (commands: readonly DocumentCommand[]) => CommandError | null;
  commitTransaction: () => void;
  cancelTransaction: () => void;
}

/** Valide la transaction éventuellement ouverte (geste continu interrompu par une autre action). */
function settled(history: H.History): H.History {
  return history.transaction ? H.commitTransaction(history) : history;
}

/** Applique des commandes en chaîne sur un document ; la première erreur arrête tout. */
function chain(doc: CreativeDocument, commands: readonly DocumentCommand[]): CommandResult {
  let current: CommandResult = { ok: true, document: doc };
  for (const command of commands) {
    if (!current.ok) return current;
    current = command(current.document);
  }
  return current;
}

export const useDocumentStore = create<DocumentState>()((set, get) => ({
  history: H.createHistory(createDocument()),

  load: (doc) => {
    set({ history: H.createHistory(doc) });
  },

  execute: (label, command) => get().executeAll(label, [command]),

  executeAll: (label, commands) => {
    const history = settled(get().history);
    const result = H.apply(history, label, chain(history.present, commands));
    if (result.history !== get().history) set({ history: result.history });
    return result.error;
  },

  undo: () => {
    const history = H.undo(settled(get().history));
    if (history !== get().history) set({ history });
  },

  redo: () => {
    const history = H.redo(settled(get().history));
    if (history !== get().history) set({ history });
  },

  beginTransaction: (label) => {
    const history = get().history;
    if (!history.transaction) set({ history: H.beginTransaction(history, label) });
  },

  preview: (commands) => {
    const history = get().history;
    const open = history.transaction ? history : H.beginTransaction(history, "Modifier");
    const result = chain(open.present, commands);
    if (!result.ok) return result.error;
    set({ history: H.preview(open, result) });
    return null;
  },

  commitTransaction: () => {
    const history = get().history;
    if (history.transaction) set({ history: H.commitTransaction(history) });
  },

  cancelTransaction: () => {
    const history = get().history;
    if (history.transaction) set({ history: H.cancelTransaction(history) });
  },
}));

export function currentDocument(): CreativeDocument {
  return useDocumentStore.getState().history.present;
}
