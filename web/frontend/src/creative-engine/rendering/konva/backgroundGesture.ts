import type Konva from "konva";
import { selectElement, setSelection } from "../../editor/actions.ts";
import { currentDocument } from "../../editor/documentStore.ts";
import { useEditorStore } from "../../editor/editorStore.ts";
import { elementsInRect, rectFromPoints } from "../../editor/selectionGeometry.ts";
import { setManualViewport } from "../../editor/viewportActions.ts";

// Geste commencé dans le vide de la zone de travail (ou n'importe où avec Espace / bouton du milieu) :
//   - souris, bouton principal : lasso de sélection (Maj, Ctrl ou ⌘ : ajoute à la sélection) ;
//   - doigt ou stylet, Espace maintenue, bouton du milieu : déplacement de la vue.
// Un clic sans mouvement dans le vide désélectionne. Pendant le geste, la vue est déplacée directement sur la
// scène (fluide) ; l'état de l'éditeur n'est mis à jour qu'à la fin. Les écouteurs sont posés sur la fenêtre
// pour suivre le pointeur hors de la zone, et retirés à la fin du geste ou par la fonction renvoyée.

/** Distance en px écran en dessous de laquelle le geste reste un clic. */
const CLICK_TOLERANCE = 3;

type Point = { x: number; y: number };

export function isPanGesture(evt: PointerEvent): boolean {
  return evt.pointerType !== "mouse" || evt.button === 1 || useEditorStore.getState().isPanKeyHeld;
}

function containerPoint(stage: Konva.Stage, evt: PointerEvent): Point {
  const box = stage.container().getBoundingClientRect();
  return { x: evt.clientX - box.left, y: evt.clientY - box.top };
}

/** Point de l'écran → px du document (inverse de l'échelle et de la position de la scène). */
function toDocument(stage: Konva.Stage, point: Point): Point {
  return { x: (point.x - stage.x()) / stage.scaleX(), y: (point.y - stage.y()) / stage.scaleY() };
}

/** Démarre le geste ; renvoie de quoi l'interrompre (démontage de la scène). */
export function startBackgroundGesture(
  stage: Konva.Stage,
  lasso: Konva.Rect,
  down: PointerEvent,
): () => void {
  const pan = isPanGesture(down);
  if (!pan && down.button !== 0) return () => undefined;

  const origin = containerPoint(stage, down);
  const startPosition = stage.position();
  const additive = down.shiftKey || down.ctrlKey || down.metaKey;
  const base = additive ? useEditorStore.getState().selectedIds : [];
  const container = stage.container();
  let moved = false;

  const onMove = (evt: PointerEvent) => {
    if (evt.pointerId !== down.pointerId) return;
    const point = containerPoint(stage, evt);
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    if (!moved && Math.hypot(dx, dy) < CLICK_TOLERANCE) return;
    moved = true;

    if (pan) {
      container.style.cursor = "grabbing";
      stage.position({ x: startPosition.x + dx, y: startPosition.y + dy });
      return;
    }
    const rect = rectFromPoints(toDocument(stage, origin), toDocument(stage, point));
    lasso.setAttrs({ ...rect, visible: true });
    lasso.getLayer()?.batchDraw();
    const hits = elementsInRect(currentDocument().elements, rect).filter((id) => !base.includes(id));
    setSelection([...base, ...hits]);
  };

  const cleanup = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    container.style.cursor = "";
    lasso.visible(false);
    lasso.getLayer()?.batchDraw();
  };

  function onUp(evt: PointerEvent) {
    if (evt.pointerId !== down.pointerId) return;
    cleanup();
    if (pan && moved) {
      setManualViewport({ zoom: stage.scaleX(), x: stage.x(), y: stage.y() });
      // La vue peut avoir été bornée : la scène reprend la position retenue, même si React ne la change pas.
      const view = useEditorStore.getState().viewport;
      if (view) stage.position({ x: view.x, y: view.y });
    }
    if (!moved && !additive) selectElement(null);
  }

  function onCancel(evt: PointerEvent) {
    if (evt.pointerId !== down.pointerId) return;
    cleanup();
    if (pan) stage.position(startPosition);
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  return cleanup;
}
