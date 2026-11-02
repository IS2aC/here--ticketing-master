import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { memo, useRef, type RefObject } from "react";
import { Ellipse, Group, Image, Line, Rect, Text } from "react-konva";
import type { ImageAsset } from "../../domain/document/types.ts";
import type { ImageElement, ShapeElement, TextElement } from "../../domain/elements/types.ts";
import type { Id } from "../../domain/ids.ts";
import { selectElement, startTextEditing, toggleInSelection } from "../../editor/actions.ts";
import { useDocumentStore } from "../../editor/documentStore.ts";
import { useEditorStore } from "../../editor/editorStore.ts";
import { useAssetResolver } from "../assetResolverContext.ts";
import { useFontReady } from "../fonts.ts";
import { useImage } from "../images.ts";
import { tintOf, useTintedUrl } from "../svgImages.ts";
import { placementOf } from "./geometry.ts";
import { dragEnded } from "./gestures.ts";
import { layoutImage } from "./imageFit.ts";
import { shadowConfig, shapeConfig, textConfig } from "./mappers.ts";

// Un élément du document → un Group Konva identifié par l'id métier.
// Pendant un glisser ou une transformation, Konva déplace le nœud seul (aucun état React ou Zustand n'est
// modifié) ; à la fin du geste, une commande met à jour le document, qui redessine le nœud à l'identique.

const PLACEHOLDER = { fill: "#F4F4F4", stroke: "#8A8A8A", text: "#6B6B6B" };

function TextContent({ element, textRef }: { element: TextElement; textRef: RefObject<Konva.Text | null> }) {
  const fontReady = useFontReady(element.style);
  // Tant que la police n'est pas prête, rien n'est dessiné : des retours à la ligne mesurés avec une police
  // de secours seraient faux. Après 3 s, la police de secours est utilisée (voir fonts.ts).
  return fontReady ? <Text ref={textRef} {...textConfig(element)} /> : null;
}

function ShapeContent({ element }: { element: ShapeElement }) {
  const shape = shapeConfig(element);
  switch (shape.kind) {
    case "rect":
      return <Rect {...shape.config} />;
    case "ellipse":
      return <Ellipse {...shape.config} />;
    case "line":
      return <Line {...shape.config} />;
  }
}

function ImagePlaceholder({ element, label }: { element: ImageElement; label: string }) {
  const { width, height } = element;
  return (
    <>
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fill={PLACEHOLDER.fill}
        stroke={PLACEHOLDER.stroke}
        strokeWidth={2}
        dash={[12, 8]}
        strokeScaleEnabled={false}
      />
      <Text
        x={-width / 2}
        y={-12}
        width={width}
        text={label}
        align="center"
        fontFamily="Poppins"
        fontSize={Math.max(14, Math.min(28, width / 16))}
        fill={PLACEHOLDER.text}
      />
    </>
  );
}

function ImageContent({ element, asset }: { element: ImageElement; asset: ImageAsset | undefined }) {
  const resolve = useAssetResolver();
  const url = useTintedUrl(asset ? resolve(element.assetId, asset) : null, tintOf(element, asset));
  const state = useImage(url);

  if (state.status === "loading")
    return <ImagePlaceholder element={element} label="Chargement de l'image…" />;
  if (state.status === "error") return <ImagePlaceholder element={element} label="Image introuvable" />;

  const intrinsic = { width: state.image.naturalWidth, height: state.image.naturalHeight };
  const layout = layoutImage(element.fit, element, intrinsic, element.crop);
  // eslint-disable-next-line jsx-a11y/alt-text -- Image Konva (dessin sur le canevas), pas une balise <img>
  return <Image image={state.image} {...layout} {...shadowConfig(element.shadow)} />;
}

function ElementNodeView({ id }: { id: Id }) {
  const element = useDocumentStore((s) => s.history.present.elements.find((e) => e.id === id));
  const asset = useDocumentStore((s) =>
    element?.type === "image" ? s.history.present.assets[element.assetId] : undefined,
  );
  const isEditing = useEditorStore((s) => s.editingTextId === id);
  const isPanKeyHeld = useEditorStore((s) => s.isPanKeyHeld);
  const groupRef = useRef<Konva.Group>(null);
  const textRef = useRef<Konva.Text>(null);
  if (!element) return null;

  // Maj, Ctrl ou ⌘ + clic : ajoute à la sélection ou en retire. Clic simple sur un élément déjà sélectionné :
  // la sélection est conservée, pour pouvoir glisser tout le groupe.
  const onPointerDown = (event: KonvaEventObject<PointerEvent>) => {
    const { shiftKey, ctrlKey, metaKey, button } = event.evt;
    // Espace ou bouton du milieu : la scène déplace la vue, la sélection ne change pas.
    if (button !== 0 || useEditorStore.getState().isPanKeyHeld) return;
    if (shiftKey || ctrlKey || metaKey) {
      toggleInSelection(element.id);
      return;
    }
    if (!useEditorStore.getState().selectedIds.includes(element.id)) selectElement(element.id);
  };

  // Un élément que Maj + clic vient de retirer de la sélection ne doit pas être glissé.
  const onDragStart = () => {
    if (!useEditorStore.getState().selectedIds.includes(element.id)) groupRef.current?.stopDrag();
  };

  const onDragEnd = () => {
    if (groupRef.current) dragEnded(element.id, groupRef.current);
  };

  // Double-clic sur un texte : édition directe sur la page (TextEditorOverlay).
  const onDoubleClick = () => {
    startTextEditing(element.id);
  };

  return (
    <Group
      ref={groupRef}
      id={element.id}
      name="element"
      {...placementOf(element)}
      opacity={element.opacity}
      visible={!element.hidden}
      listening={!element.locked}
      draggable={!element.locked && !isEditing && !isPanKeyHeld}
      onPointerDown={onPointerDown}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
    >
      {element.type === "text" && !isEditing && <TextContent element={element} textRef={textRef} />}
      {element.type === "shape" && <ShapeContent element={element} />}
      {element.type === "image" && <ImageContent element={element} asset={asset} />}
    </Group>
  );
}

/** Ne se redessine que si son propre élément change (les autres gardent leur identité, voir ADR-006). */
export const ElementNode = memo(ElementNodeView);
