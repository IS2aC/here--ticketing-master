import type { EllipseConfig } from "konva/lib/shapes/Ellipse";
import type { LineConfig } from "konva/lib/shapes/Line";
import type { RectConfig } from "konva/lib/shapes/Rect";
import type { TextConfig } from "konva/lib/shapes/Text";
import type { ShapeElement, Stroke, TextElement } from "../../domain/elements/types.ts";

// Correspondances pures élément du modèle → configuration Konva, dans le repère local du Group (centré).
// Elles servent à l'écran (react-konva) et serviront à l'export (même rendu, ADR-008).

/** Zone de clic élargie d'une ligne, en px du document. */
const LINE_HIT_WIDTH = 24;

/** Police au format Konva : « italic 600 », « 400 »… (Konva compose ensuite la propriété CSS font). */
export function konvaFontStyle(style: TextElement["style"]): string {
  return style.fontStyle === "italic" ? `italic ${style.fontWeight}` : String(style.fontWeight);
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
    fill: element.fill ?? undefined,
    fillEnabled: element.fill !== null,
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
        },
      };
    case "ellipse":
      return { kind: "ellipse", config: { ...paint, x: 0, y: 0, radiusX: width / 2, radiusY: height / 2 } };
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
