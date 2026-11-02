import type Konva from "konva";
import { useEffect, useRef } from "react";
import { Transformer } from "react-konva";
import { useShallow } from "zustand/react/shallow";
import type { Element } from "../../domain/elements/types.ts";
import { useDocumentStore } from "../../editor/documentStore.ts";
import { useEditorStore } from "../../editor/editorStore.ts";
import { reflowText, transformEnded } from "./gestures.ts";
import { beginSnapTransform, endSnap, snapAnchorPosition } from "./snapping.ts";

const ACCENT = "#E10600";
/** Taille minimale d'un élément pendant un redimensionnement, en px écran. */
const MIN_SIZE = 8;
const ALL_ANCHORS = [
  "top-left",
  "top-center",
  "top-right",
  "middle-right",
  "middle-left",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];
const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];
const HORIZONTAL = ["middle-left", "middle-right"];

/** Poignées adaptées à la sélection : la hauteur d'un texte suit son contenu, une ligne n'a qu'une longueur. */
function transformerConfig(elements: readonly Element[]) {
  if (elements.some((e) => e.locked)) return { enabledAnchors: [], rotateEnabled: false, borderDash: [4, 4] };
  // Plusieurs éléments : mise à l'échelle proportionnelle du groupe par les coins, et rotation.
  if (elements.length > 1) return { enabledAnchors: CORNERS, rotateEnabled: true, keepRatio: true };
  const [element] = elements;
  if (!element) return {};
  if (element.type === "text" || (element.type === "shape" && element.shape === "line")) {
    return { enabledAnchors: HORIZONTAL, rotateEnabled: true, keepRatio: false };
  }
  // Images : proportions conservées aux coins (Maj pour déformer, comportement Konva).
  if (element.type === "image") return { enabledAnchors: ALL_ANCHORS, rotateEnabled: true, keepRatio: true };
  return { enabledAnchors: ALL_ANCHORS, rotateEnabled: true, keepRatio: false };
}

/** Cadre de sélection et poignées, attachés aux nœuds des éléments sélectionnés. */
export function SelectionTransformer() {
  const editingText = useEditorStore((s) => s.editingTextId !== null);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const elements = useDocumentStore(
    useShallow((s) => s.history.present.elements.filter((e) => selectedIds.includes(e.id))),
  );
  const transformerRef = useRef<Konva.Transformer>(null);

  // Rattache le cadre aux nœuds à chaque changement de sélection ou des éléments (taille, rotation, contenu).
  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = transformer?.getStage();
    if (!transformer || !stage) return;
    const nodes = editingText
      ? []
      : elements.flatMap((e) => {
          const node = stage.findOne<Konva.Group>(`#${e.id}`);
          return node ? [node] : [];
        });
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [elements, editingText]);

  const isLine = elements.length === 1 && elements[0]?.type === "shape" && elements[0].shape === "line";

  return (
    <Transformer
      ref={transformerRef}
      {...transformerConfig(elements)}
      borderStroke={ACCENT}
      borderStrokeWidth={1.5}
      anchorStroke={ACCENT}
      anchorFill="#FFFFFF"
      anchorSize={10}
      anchorCornerRadius={5}
      rotateAnchorOffset={28}
      rotationSnaps={[0, 90, 180, 270]}
      rotationSnapTolerance={4}
      ignoreStroke
      flipEnabled={false}
      onTransform={() => {
        const nodes = transformerRef.current?.nodes() ?? [];
        const [only] = nodes;
        if (nodes.length === 1 && elements[0]?.type === "text" && only) reflowText(only as Konva.Group);
      }}
      onTransformStart={beginSnapTransform}
      onTransformEnd={() => {
        endSnap();
        transformEnded((transformerRef.current?.nodes() ?? []) as Konva.Group[]);
      }}
      anchorDragBoundFunc={(_old, next) => {
        const transformer = transformerRef.current;
        return transformer ? snapAnchorPosition(transformer, next) : next;
      }}
      boundBoxFunc={(oldBox, newBox) => {
        // Une ligne n'a pas de hauteur : seule sa longueur a un minimum.
        const tooSmall = Math.abs(newBox.width) < MIN_SIZE || (!isLine && Math.abs(newBox.height) < MIN_SIZE);
        return tooSmall ? oldBox : newBox;
      }}
    />
  );
}
