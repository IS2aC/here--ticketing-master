import type { EllipseConfig } from "konva/lib/shapes/Ellipse";
import type { LineConfig } from "konva/lib/shapes/Line";
import type { RectConfig } from "konva/lib/shapes/Rect";
import type { TextConfig } from "konva/lib/shapes/Text";
import { roundGeometry } from "../../domain/constraints.ts";
import type { LinearGradient, Shadow, ShapeElement, Stroke, TextElement } from "../../domain/elements/types.ts";

// Correspondances pures élément du modèle → configuration Konva, dans le repère local du Group (centré).
// Elles servent à l'écran (react-konva) et serviront à l'export (même rendu, ADR-008).

/** Zone de clic élargie d'une ligne, en px du document. */
const LINE_HIT_WIDTH = 24;

/** Police au format Konva : « italic 600 », « 400 »… (Konva compose ensuite la propriété CSS font). */
export function konvaFontStyle(style: TextElement["style"]): string {
  return style.fontStyle === "italic" ? `italic ${style.fontWeight}` : String(style.fontWeight);
}

/** Ombre portée ; sa couleur porte sa transparence. */
export function shadowConfig(shadow: Shadow | null | undefined) {
  if (!shadow) return { shadowEnabled: false };
  return {
    shadowEnabled: true,
    shadowColor: shadow.color,
    shadowBlur: shadow.blur,
    shadowOffsetX: shadow.offsetX,
    shadowOffsetY: shadow.offsetY,
    shadowOpacity: 1,
  };
}

/**
 * Dégradé sur la boîte de l'élément (width × height), dont le coin supérieur gauche est en `origin` dans le
 * repère de la forme Konva. Les extrémités sont projetées pour que le dégradé couvre toute la boîte.
 */
export function gradientConfig(
  gradient: LinearGradient | null | undefined,
  box: { width: number; height: number },
  origin: { x: number; y: number } = { x: 0, y: 0 },
) {
  if (!gradient) return {};
  const radians = (gradient.angle * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  const half = (Math.abs(box.width * dx) + Math.abs(box.height * dy)) / 2;
  const cx = origin.x + box.width / 2;
  const cy = origin.y + box.height / 2;
  return {
    fillPriority: "linear-gradient",
    fillLinearGradientStartPoint: { x: roundGeometry(cx - dx * half), y: roundGeometry(cy - dy * half) },
    fillLinearGradientEndPoint: { x: roundGeometry(cx + dx * half), y: roundGeometry(cy + dy * half) },
    fillLinearGradientColorStops: [0, gradient.from, 1, gradient.to],
  };
}

export function textConfig(element: TextElement): TextConfig {
  const { style } = element;
  return {
    x: -element.width / 2,
    y: -element.height / 2,
    width: element.width,
    text: style.textTransform === "uppercase" ? element.content.toLocaleUpperCase("fr") : element.content,
    fontFamily: style.fontFamily,
    fontStyle: konvaFontStyle(style),
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    // Le modèle exprime l'espacement en em, Konva en px.
    letterSpacing: style.letterSpacing * style.fontSize,
    fill: style.color,
    align: style.align,
    wrap: "word",
    ...shadowConfig(style.shadow),
    // Contour sous les lettres : leur dessin reste intact, le contour déborde vers l'extérieur.
    ...(style.outline
      ? { stroke: style.outline.color, strokeWidth: style.outline.width * 2, fillAfterStrokeEnabled: true, lineJoin: "round" as const }
      : { strokeEnabled: false }),
    // Le texte se dessine depuis (0, 0) dans son propre repère : le dégradé couvre sa boîte.
    ...gradientConfig(style.gradient, { width: element.width, height: element.height }),
  };
}

function strokeConfig(stroke: Stroke | null) {
  if (!stroke) return { strokeEnabled: false };
  return {
    stroke: stroke.color,
    strokeWidth: stroke.width,
    dash: stroke.style === "dashed" ? [stroke.width * 3, stroke.width * 2] : [],
  };
}

export type ShapeConfig =
  | { kind: "rect"; config: RectConfig }
  | { kind: "ellipse"; config: EllipseConfig }
  | { kind: "line"; config: LineConfig };

export function shapeConfig(element: ShapeElement): ShapeConfig {
  const { width, height } = element;
  const paint = {
    ...strokeConfig(element.stroke),
    ...shadowConfig(element.shadow),
    fill: element.fill ?? undefined,
    fillEnabled: element.fill !== null || Boolean(element.gradient),
  };
  switch (element.shape) {
    case "rect":
      return {
        kind: "rect",
        config: {
          ...paint,
          x: -width / 2,
          y: -height / 2,
          width,
          height,
          cornerRadius: element.cornerRadius,
          ...gradientConfig(element.gradient, { width, height }),
        },
      };
    case "ellipse":
      return {
        kind: "ellipse",
        config: {
          ...paint,
          x: 0,
          y: 0,
          radiusX: width / 2,
          radiusY: height / 2,
          // L'ellipse a son origine en son centre.
          ...gradientConfig(element.gradient, { width, height }, { x: -width / 2, y: -height / 2 }),
        },
      };
    case "line":
      return {
        kind: "line",
        config: {
          ...paint,
          points: [-width / 2, 0, width / 2, 0],
          hitStrokeWidth: LINE_HIT_WIDTH,
          lineCap: "round",
        },
      };
  }
}
