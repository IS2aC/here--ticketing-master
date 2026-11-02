import { useEffect } from "react";
import {
  addText,
  deleteSelection,
  duplicateSelection,
  endNudge,
  nudgeSelection,
  redo,
  reorderSelection,
  selectAll,
  selectElement,
  startTextEditing,
  undo,
} from "../../editor/actions.ts";
import { useEditorStore } from "../../editor/editorStore.ts";
import { saveNow } from "../../editor/persistence.ts";
import { fitToScreen, zoomStep, zoomToActualSize } from "../../editor/viewportActions.ts";

/** Vrai si la touche doit rester au champ qui a le focus (saisie de texte, liste, contenu éditable). */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (target as HTMLInputElement).type;
  return !["button", "checkbox", "radio", "range", "color", "submit", "reset"].includes(type);
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Raccourcis de l'éditeur. Ignorés quand un champ de saisie a le focus, quand un autre composant a déjà traité
 * la touche (menu, tiroir), et — pour les flèches — quand le focus est sur un bouton d'une barre d'outils
 * ou d'un groupe (où elles servent à naviguer).
 */
export function handleEditorShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return false;
  const mod = event.ctrlKey || event.metaKey;
  const key = event.key;
  // Ctrl + S enregistre partout, même depuis un champ : sinon le navigateur proposerait d'enregistrer la page.
  if (mod && !event.altKey && (key === "s" || key === "S")) {
    event.preventDefault();
    void saveNow();
    return true;
  }
  if (isEditableTarget(event.target)) return false;
  // Une boîte de dialogue gère ses touches (Échap la ferme, Tab y circule) : l'éditeur ne s'en mêle pas.
  if (event.target instanceof Element && event.target.closest("dialog")) return false;

  if (mod && !event.altKey) {
    if (key === "z" || key === "Z") return run(event.shiftKey ? redo : undo);
    if (key === "y" || key === "Y") return run(redo);
    if (key === "a" || key === "A") return run(selectAll);
    if (key === "d" || key === "D") return run(duplicateSelection);
    if (key === "=" || key === "+")
      return run(() => {
        zoomStep(1);
      });
    if (key === "-")
      return run(() => {
        zoomStep(-1);
      });
    if (key === "0") return run(fitToScreen);
    if (key === "1") return run(zoomToActualSize);
    // Ctrl+] et Ctrl+[ ; avec Maj, la touche produite varie selon le clavier : on se fie au code physique.
    if (event.code === "BracketRight")
      return run(() => {
        reorderSelection(event.shiftKey ? "front" : "forward");
      });
    if (event.code === "BracketLeft")
      return run(() => {
        reorderSelection(event.shiftKey ? "back" : "backward");
      });
    return false;
  }
  if (event.altKey || mod) return false;

  // Espace maintenue : glisser déplace la vue (voir backgroundGesture). Hors des boutons, où elle les active.
  if (key === " ") {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, [role=menuitem]")) return false;
    return run(() => {
      if (!event.repeat) useEditorStore.getState().setPanKeyHeld(true);
    });
  }
  if (key === "Escape")
    return run(() => {
      selectElement(null);
    });
  if (key === "Enter") {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, [role=menuitem]")) return false;
    const [only, ...others] = useEditorStore.getState().selectedIds;
    if (!only || others.length > 0) return false;
    return run(() => {
      startTextEditing(only);
    });
  }
  if (key === "Delete" || key === "Backspace") return run(deleteSelection);
  if ((key === "t" || key === "T") && !event.shiftKey) return run(addText);

  const arrow = ARROWS[key];
  if (arrow) {
    const target = event.target as HTMLElement | null;
    // Flèches réservées à la navigation (barres d'outils, menus, groupes, listes) et aux curseurs.
    if (target?.closest("[role=toolbar], [role=menu], [role=group], [role=radiogroup], ul, input"))
      return false;
    const step = event.shiftKey ? 10 : 1;
    // Un appui long (répétition) prolonge le même déplacement : une seule entrée d'historique (endNudge).
    return run(() => {
      nudgeSelection(arrow[0] * step, arrow[1] * step);
    });
  }
  return false;

  function run(action: () => unknown): true {
    event.preventDefault();
    action();
    return true;
  }
}

/** Relâchement : fin du déplacement aux flèches, fin du mode « main » de la barre d'espace. */
export function handleEditorKeyUp(event: KeyboardEvent): void {
  if (event.key in ARROWS) endNudge();
  if (event.key === " ") useEditorStore.getState().setPanKeyHeld(false);
}

/** La fenêtre perd le focus : aucune touche ne reste « enfoncée » pour l'éditeur. */
function releaseKeys(): void {
  endNudge();
  useEditorStore.getState().setPanKeyHeld(false);
}

/** Branche les raccourcis sur la fenêtre, une seule fois pour la durée de vie de l'éditeur. */
export function useEditorShortcuts(): void {
  useEffect(() => {
    window.addEventListener("keydown", handleEditorShortcut);
    window.addEventListener("keyup", handleEditorKeyUp);
    window.addEventListener("blur", releaseKeys);
    return () => {
      window.removeEventListener("keydown", handleEditorShortcut);
      window.removeEventListener("keyup", handleEditorKeyUp);
      window.removeEventListener("blur", releaseKeys);
    };
  }, []);
}
