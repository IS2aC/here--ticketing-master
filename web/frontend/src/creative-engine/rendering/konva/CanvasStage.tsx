import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect, useRef } from "react";
import { Layer, Rect, Stage } from "react-konva";
import { useShallow } from "zustand/react/shallow";
import { useDocumentStore } from "../../editor/documentStore.ts";
import { useEditorStore } from "../../editor/editorStore.ts";
import { setManualViewport } from "../../editor/viewportActions.ts";
import { wheelZoomFactor, zoomAt, type Size } from "../../editor/viewport.ts";
import { isPanGesture, startBackgroundGesture } from "./backgroundGesture.ts";
import { ElementNode } from "./ElementNode.tsx";
import { SelectionTransformer } from "./SelectionTransformer.tsx";

// Zone de travail Konva. Le Stage porte la vue (échelle = zoom, position = décalage) : tout ce qu'il contient
// est exprimé en px du document. Couches :
//   - « page » : ombre et fond de la page (interface, hors document, non cliquable sauf pour désélectionner) ;
//   - « elements » : les éléments, découpés aux limites de la page ;
//   - « selection » : le cadre de transformation et le lasso, au-dessus de tout et non découpés.

const PAGE_SHADOW = { color: "#0B0B0B", blur: 24, opacity: 0.12, offsetY: 6 };
const LASSO = { fill: "rgba(225, 6, 0, 0.08)", stroke: "#E10600" };

export function CanvasStage({ size }: { size: Size }) {
  const view = useEditorStore((s) => s.viewport);
  const page = useDocumentStore((s) => s.history.present.page);
  const ids = useDocumentStore(useShallow((s) => s.history.present.elements.map((e) => e.id)));
  const isPanKeyHeld = useEditorStore((s) => s.isPanKeyHeld);
  const stageRef = useRef<Konva.Stage>(null);
  const lassoRef = useRef<Konva.Rect>(null);
  const stopGesture = useRef<(() => void) | null>(null);

  // Un geste en cours est interrompu au démontage (écouteurs posés sur la fenêtre).
  useEffect(
    () => () => {
      stopGesture.current?.();
    },
    [],
  );

  // Espace maintenue : curseur « main » au survol de la zone de travail.
  useEffect(() => {
    const container = stageRef.current?.container();
    if (!container) return;
    container.style.cursor = isPanKeyHeld ? "grab" : "";
  }, [isPanKeyHeld]);

  if (!view) return null;

  const isBackground = (target: Konva.Node) =>
    target === target.getStage() || target.hasName("page-background");

  // Dans le vide : lasso ou déplacement de la vue (voir backgroundGesture). Avec Espace ou le bouton du
  // milieu, la vue se déplace même quand le geste commence sur un élément.
  const onPointerDown = (event: KonvaEventObject<PointerEvent>) => {
    const stage = stageRef.current;
    const lasso = lassoRef.current;
    if (!stage || !lasso) return;
    const pan = isPanGesture(event.evt) && (event.evt.pointerType === "mouse" || isBackground(event.target));
    if (!pan && !isBackground(event.target)) return;
    stopGesture.current?.();
    stopGesture.current = startBackgroundGesture(stage, lasso, event.evt);
  };

  // Molette : défilement = déplacement de la vue ; Ctrl/⌘ + molette (et pincement du pavé tactile) = zoom.
  const onWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (event.evt.ctrlKey || event.evt.metaKey) {
      if (pointer) setManualViewport(zoomAt(view, view.zoom * wheelZoomFactor(event.evt.deltaY), pointer));
      return;
    }
    setManualViewport({ ...view, x: view.x - event.evt.deltaX, y: view.y - event.evt.deltaY });
  };

  return (
    <Stage
      ref={stageRef}
      width={size.width}
      height={size.height}
      scaleX={view.zoom}
      scaleY={view.zoom}
      x={view.x}
      y={view.y}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
    >
      <Layer name="page" listening>
        <Rect
          width={page.width}
          height={page.height}
          fill="#FFFFFF"
          shadowColor={PAGE_SHADOW.color}
          shadowBlur={PAGE_SHADOW.blur / view.zoom}
          shadowOpacity={PAGE_SHADOW.opacity}
          shadowOffsetY={PAGE_SHADOW.offsetY / view.zoom}
          listening={false}
        />
        <Rect name="page-background" width={page.width} height={page.height} fill={page.background.color} />
      </Layer>
      <Layer name="elements" clipX={0} clipY={0} clipWidth={page.width} clipHeight={page.height}>
        {ids.map((id) => (
          <ElementNode key={id} id={id} />
        ))}
      </Layer>
      <Layer name="selection">
        <SelectionTransformer />
        <Rect
          ref={lassoRef}
          name="lasso"
          visible={false}
          fill={LASSO.fill}
          stroke={LASSO.stroke}
          strokeWidth={1}
          strokeScaleEnabled={false}
          listening={false}
        />
      </Layer>
    </Stage>
  );
}
