import type Konva from "konva";
import { create } from "zustand";
import type { Id } from "../../domain/ids.ts";
import { currentDocument } from "../../editor/documentStore.ts";
import { useEditorStore } from "../../editor/editorStore.ts";
import { boundsOf, snapBox, snapPoint, snapTargets, type Box, type SnapTargets } from "../../editor/layoutAids.ts";

// Magnétisme pendant un glisser ou un redimensionnement (étape C3). Les repères sont calculés au début du
// geste (les autres éléments ne bougent pas pendant) ; les guides affichés vivent dans un petit store
// d'interface, jamais dans le document. Alt maintenue : pas de magnétisme.

/** Distance d'accroche, en px à l'écran (quel que soit le zoom). */
const TOLERANCE_PX = 6;

const NO_GUIDES: SnapTargets = { x: [], y: [] };
export const useSnapGuides = create<SnapTargets>(() => NO_GUIDES);

let altHeld = false;

/** Suit la touche Alt (Option) : à appeler au montage de la scène ; renvoie de quoi arrêter. */
export function trackSnapModifier(): () => void {
  const update = (event: KeyboardEvent) => {
    altHeld = event.altKey;
  };
  const reset = () => {
    altHeld = false;
  };
  window.addEventListener("keydown", update);
  window.addEventListener("keyup", update);
  window.addEventListener("blur", reset);
  return () => {
    window.removeEventListener("keydown", update);
    window.removeEventListener("keyup", update);
    window.removeEventListener("blur", reset);
  };
}

interface Session {
  readonly targets: SnapTargets;
  /** Boîte qui réunit les éléments déplacés, et centre de l'élément tenu, au début du geste. */
  readonly union: Box;
  readonly center: { x: number; y: number };
}

let session: Session | null = null;

function moving(): { ids: Set<Id>; targets: SnapTargets } {
  const doc = currentDocument();
  const ids = new Set(useEditorStore.getState().selectedIds);
  const others = doc.elements.filter((e) => !ids.has(e.id) && !e.hidden).map(boundsOf);
  return { ids, targets: snapTargets(doc.page, others) };
}

/** Début d'un glisser de l'élément `id` (et du reste de la sélection, que Konva entraîne avec lui). */
export function beginSnapDrag(id: Id): void {
  const doc = currentDocument();
  const { ids, targets } = moving();
  const boxes = doc.elements.filter((e) => ids.has(e.id) && !e.locked).map(boundsOf);
  const held = doc.elements.find((e) => e.id === id);
  if (!held || boxes.length === 0) return;
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const union = {
    x: left,
    y: top,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - left,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - top,
  };
  session = { targets, union, center: { x: held.x + held.width / 2, y: held.y + held.height / 2 } };
}

/** Fin du geste : plus de repères ni de guides. */
export function endSnap(): void {
  session = null;
  useSnapGuides.setState(NO_GUIDES);
}

const toDocument = (stage: Konva.Stage, pos: Konva.Vector2d) => ({
  x: (pos.x - stage.x()) / stage.scaleX(),
  y: (pos.y - stage.y()) / stage.scaleY(),
});
const toAbsolute = (stage: Konva.Stage, pos: Konva.Vector2d) => ({
  x: pos.x * stage.scaleX() + stage.x(),
  y: pos.y * stage.scaleY() + stage.y(),
});

function show(guides: SnapTargets): void {
  const current = useSnapGuides.getState();
  if (current.x.join() !== guides.x.join() || current.y.join() !== guides.y.join()) useSnapGuides.setState(guides);
}

/** Position absolue proposée par Konva pour l'élément tenu → position accrochée. */
export function snapDragPosition(node: Konva.Node, pos: Konva.Vector2d): Konva.Vector2d {
  const stage = node.getStage();
  if (!stage || !session || altHeld) {
    show(NO_GUIDES);
    return pos;
  }
  const center = toDocument(stage, pos);
  const box = {
    ...session.union,
    x: session.union.x + center.x - session.center.x,
    y: session.union.y + center.y - session.center.y,
  };
  const snap = snapBox(box, session.targets, TOLERANCE_PX / stage.scaleX());
  show(snap.guides);
  return toAbsolute(stage, { x: center.x + snap.dx, y: center.y + snap.dy });
}

/** Début d'un redimensionnement : repères des éléments non sélectionnés. */
export function beginSnapTransform(): void {
  session = { targets: moving().targets, union: { x: 0, y: 0, width: 0, height: 0 }, center: { x: 0, y: 0 } };
}

/** Poignée de redimensionnement : elle s'accroche aux repères (cadre non tourné seulement). */
export function snapAnchorPosition(transformer: Konva.Transformer, pos: Konva.Vector2d): Konva.Vector2d {
  const stage = transformer.getStage();
  if (!stage || !session || altHeld || Math.abs(transformer.rotation()) > 0.01) {
    show(NO_GUIDES);
    return pos;
  }
  const point = toDocument(stage, pos);
  const snap = snapPoint(point, session.targets, TOLERANCE_PX / stage.scaleX());
  show(snap.guides);
  return toAbsolute(stage, { x: point.x + snap.dx, y: point.y + snap.dy });
}
