import { create } from "zustand";
import type { Id } from "../domain/ids.ts";
import type { Size, Viewport } from "./viewport.ts";

export type LibraryPanel = "templates" | "assets" | "generate";

// État de l'éditeur (ADR-003) : interface, jamais enregistré dans le document.
interface EditorState {
  /** Éléments sélectionnés, dans l'ordre où ils ont été ajoutés à la sélection. */
  selectedIds: readonly Id[];
  /** Vue de la zone de travail ; null tant que la zone n'est pas mesurée. */
  viewport: Viewport | null;
  /** Vrai tant que la vue suit « Ajuster » : elle se recalcule quand la zone change de taille. */
  fitToScreen: boolean;
  /** Taille mesurée de la zone de travail, en px CSS. */
  workspaceSize: Size | null;
  /** Texte en cours d'édition directe sur la page. */
  editingTextId: Id | null;
  /** Barre d'espace maintenue : glisser dans la zone de travail déplace la vue au lieu de tracer un lasso. */
  isPanKeyHeld: boolean;
  isPropertiesPanelOpen: boolean;
  /** Message ponctuel à l'utilisateur (import réussi ou refusé, export…), affiché jusqu'à fermeture. */
  notice: { tone: "info" | "error"; message: string } | null;
  /** Liste des documents ouverte. */
  isDocumentsOpen: boolean;
  /** Panneau de bibliothèque ouvert à gauche : modèles ou ressources. */
  libraryPanel: LibraryPanel | null;
  /** Boîte d'export ouverte. */
  isExportOpen: boolean;

  setSelection: (ids: readonly Id[]) => void;
  setViewport: (viewport: Viewport, options: { fit: boolean }) => void;
  setWorkspaceSize: (size: Size) => void;
  setEditingText: (id: Id | null) => void;
  setPanKeyHeld: (held: boolean) => void;
  openPropertiesPanel: () => void;
  closePropertiesPanel: () => void;
  togglePropertiesPanel: () => void;
  setNotice: (notice: EditorState["notice"]) => void;
  setDocumentsOpen: (open: boolean) => void;
  setLibraryPanel: (panel: LibraryPanel | null) => void;
  setExportOpen: (open: boolean) => void;
}

const NONE: readonly Id[] = [];

function sameIds(a: readonly Id[], b: readonly Id[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  selectedIds: NONE,
  viewport: null,
  fitToScreen: true,
  workspaceSize: null,
  editingTextId: null,
  isPanKeyHeld: false,
  isPropertiesPanelOpen: false,
  notice: null,
  isDocumentsOpen: false,
  libraryPanel: null,
  isExportOpen: false,

  setSelection: (ids) => {
    // Même sélection : aucune mise à jour (le lasso la recalcule à chaque mouvement du pointeur).
    if (sameIds(ids, get().selectedIds)) return;
    set({ selectedIds: ids.length === 0 ? NONE : ids });
  },
  setViewport: (viewport, { fit }) => {
    set({ viewport, fitToScreen: fit });
  },
  setWorkspaceSize: (workspaceSize) => {
    set({ workspaceSize });
  },
  setEditingText: (editingTextId) => {
    set({ editingTextId });
  },
  setPanKeyHeld: (isPanKeyHeld) => {
    set({ isPanKeyHeld });
  },
  openPropertiesPanel: () => {
    set({ isPropertiesPanelOpen: true });
  },
  closePropertiesPanel: () => {
    set({ isPropertiesPanelOpen: false });
  },
  togglePropertiesPanel: () => {
    set((state) => ({ isPropertiesPanelOpen: !state.isPropertiesPanelOpen }));
  },
  setNotice: (notice) => {
    set({ notice });
  },
  setDocumentsOpen: (isDocumentsOpen) => {
    set({ isDocumentsOpen });
  },
  setLibraryPanel: (libraryPanel) => {
    set({ libraryPanel });
  },
  setExportOpen: (isExportOpen) => {
    set({ isExportOpen });
  },
}));

/** Sélection simple : l'identifiant si un seul élément est sélectionné. */
export function useSingleSelectedId(): Id | null {
  return useEditorStore((s) => (s.selectedIds.length === 1 ? (s.selectedIds[0] ?? null) : null));
}
