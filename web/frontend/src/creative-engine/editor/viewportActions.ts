import { currentDocument } from "./documentStore.ts";
import { useEditorStore } from "./editorStore.ts";
import {
  centeredViewport,
  clampPan,
  fitViewport,
  nextZoomStep,
  zoomAt,
  type Size,
  type Viewport,
} from "./viewport.ts";

// Commandes de vue : elles ne touchent qu'à l'état de l'éditeur, jamais au document.
// Toutes sont sans effet tant que la zone de travail n'est pas mesurée.

function context(): { page: Size; container: Size } | null {
  const container = useEditorStore.getState().workspaceSize;
  return container ? { page: currentDocument().page, container } : null;
}

/** « Ajuster » : page entière, centrée ; la vue suit ensuite les changements de taille de la zone. */
export function fitToScreen(): void {
  const ctx = context();
  const view = ctx && fitViewport(ctx.page, ctx.container);
  if (view) useEditorStore.getState().setViewport(view, { fit: true });
}

/** Vue choisie par l'utilisateur (zoom ou déplacement) : elle ne suit plus « Ajuster ». */
export function setManualViewport(view: Viewport): void {
  const ctx = context();
  if (ctx) useEditorStore.getState().setViewport(clampPan(view, ctx.page, ctx.container), { fit: false });
}

export function zoomToActualSize(): void {
  const ctx = context();
  if (ctx) setManualViewport(centeredViewport(ctx.page, ctx.container, 1));
}

/** Palier suivant ou précédent, centré sur le milieu de la zone. */
export function zoomStep(direction: 1 | -1): void {
  const ctx = context();
  const view = useEditorStore.getState().viewport;
  if (!ctx || !view) return;
  const center = { x: ctx.container.width / 2, y: ctx.container.height / 2 };
  setManualViewport(zoomAt(view, nextZoomStep(view.zoom, direction), center));
}
