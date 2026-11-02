import type { ImageElement, ShapeElement, TextElement, TextStyle } from "../elements/types.ts";
import { createId, type Id } from "../ids.ts";
import { presetSize } from "./presets.ts";
import { CURRENT_SCHEMA_VERSION, type CreativeDocument, type PagePreset } from "./types.ts";

// Fabriques : produisent des valeurs valides avec des défauts explicites.
// L'identifiant et la date sont injectables pour des tests déterministes.

export interface CreateDocumentOptions {
  readonly id?: Id;
  readonly title?: string;
  readonly preset?: Exclude<PagePreset, "custom">;
  readonly orientation?: "portrait" | "landscape";
  readonly now?: string;
}

export function createDocument(options: CreateDocumentOptions = {}): CreativeDocument {
  const now = options.now ?? new Date().toISOString();
  const { width, height, print } = presetSize(
    options.preset ?? "social-4-5",
    options.orientation ?? "portrait",
  );
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: options.id ?? createId(),
    meta: { title: options.title ?? "Document sans titre", createdAt: now, updatedAt: now, template: null },
    page: {
      unit: "px",
      width,
      height,
      preset: options.preset ?? "social-4-5",
      print,
      background: { type: "solid", color: "#FFFFFF" },
    },
    assets: {},
    elements: [],
  };
}

const BASE_DEFAULTS = { rotation: 0, opacity: 1, locked: false, hidden: false } as const;

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: "Poppins",
  fontWeight: 400,
  fontStyle: "normal",
  fontSize: 48,
  lineHeight: 1.2,
  letterSpacing: 0,
  color: "#0B0B0B",
  align: "center",
  textTransform: "none",
};

/** Géométrie obligatoire et nom de calque facultatif, communs à toutes les fabriques. */
type Geometry = Pick<TextElement, "x" | "y" | "width" | "height"> & { name?: string };

export function createTextElement(
  input: Geometry & { content: string; id?: Id; style?: Partial<TextStyle> },
): TextElement {
  const { id, style, ...rest } = input;
  return {
    ...BASE_DEFAULTS,
    ...rest,
    id: id ?? createId(),
    type: "text",
    style: { ...DEFAULT_TEXT_STYLE, ...style },
  };
}

export function createImageElement(
  input: Geometry & { assetId: Id; id?: Id; fit?: ImageElement["fit"] },
): ImageElement {
  const { id, fit, ...rest } = input;
  return { ...BASE_DEFAULTS, ...rest, id: id ?? createId(), type: "image", fit: fit ?? "cover", crop: null };
}

export function createShapeElement(
  input: Geometry &
    Pick<ShapeElement, "shape"> &
    Partial<Pick<ShapeElement, "fill" | "stroke" | "cornerRadius">> & { id?: Id },
): ShapeElement {
  const { id, ...rest } = input;
  const isLine = rest.shape === "line";
  return {
    ...BASE_DEFAULTS,
    fill: isLine ? null : "#E2E2E2",
    stroke: isLine ? { color: "#0B0B0B", width: 2, style: "solid" } : null,
    cornerRadius: 0,
    ...rest,
    height: isLine ? 0 : rest.height,
    id: id ?? createId(),
    type: "shape",
  };
}
