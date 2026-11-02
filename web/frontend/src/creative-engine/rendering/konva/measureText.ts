import Konva from "konva";
import type { TextElement } from "../../domain/elements/types.ts";
import type { TextMeasurer } from "../../editor/textMeasure.ts";
import { ensureFont } from "../fonts.ts";
import { textConfig } from "./mappers.ts";

/** Hauteur occupée par un texte, mesurée par Konva avec la même configuration que l'affichage. */
export function measureKonvaTextHeight(element: TextElement): number {
  const node = new Konva.Text(textConfig(element));
  const height = node.height();
  node.destroy();
  return height;
}

/** Mesureur fourni à l'éditeur (registerTextMeasurer) : mêmes polices et même mise en page que l'écran. */
export const konvaTextMeasurer: TextMeasurer = { measure: measureKonvaTextHeight, prepare: ensureFont };
