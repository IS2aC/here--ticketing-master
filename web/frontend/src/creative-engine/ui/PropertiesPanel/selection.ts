import { useShallow } from "zustand/react/shallow";
import type { ReorderTarget } from "../../domain/commands/elementCommands.ts";
import type { Element } from "../../domain/elements/types.ts";
import type { Id } from "../../domain/ids.ts";
import { useDocumentStore } from "../../editor/documentStore.ts";
import { useEditorStore } from "../../editor/editorStore.ts";

/**
 * Éléments sélectionnés, dans l'ordre du document. Le composant n'est rendu à nouveau que si l'un d'eux change
 * (les commandes recréent seulement l'élément modifié) : déplacer un autre élément ne le concerne pas.
 */
export function useSelectedElements(): readonly Element[] {
  const ids = useEditorStore((s) => s.selectedIds);
  return useDocumentStore(useShallow((s) => s.history.present.elements.filter((e) => ids.includes(e.id))));
}

/** Valeurs différentes selon les éléments de la sélection. */
export const MIXED = Symbol("mixte");
export type Shared<T> = T | typeof MIXED;

/** Valeur commune à tous les éléments, ou MIXED. */
export function shared<E, T>(elements: readonly E[], get: (element: E) => T): Shared<T> {
  const [first, ...rest] = elements;
  if (first === undefined) return MIXED;
  const value = get(first);
  return rest.every((e) => Object.is(get(e), value)) ? value : MIXED;
}

/** Valeur pour un champ : null quand elle diffère (le champ affiche « Mixte »). */
export function orNull<T>(value: Shared<T>): T | null {
  return value === MIXED ? null : value;
}

/**
 * Ordre d'affichage modifiable (sinon le bouton est désactivé : déjà en place). Monter est possible si un
 * élément sélectionné a un élément non sélectionné au-dessus de lui ; avancer d'un niveau l'est alors aussi
 * (voir reorderElements). Même raisonnement pour descendre.
 */
export function orderAvailability(
  order: readonly Id[],
  selected: readonly Id[],
): Record<ReorderTarget, boolean> {
  const flags = order.map((id) => selected.includes(id));
  const raise = flags.some((isSelected, i) => isSelected && flags.slice(i + 1).some((f) => !f));
  const lower = flags.some((isSelected, i) => isSelected && flags.slice(0, i).some((f) => !f));
  return { front: raise, forward: raise, backward: lower, back: lower };
}
