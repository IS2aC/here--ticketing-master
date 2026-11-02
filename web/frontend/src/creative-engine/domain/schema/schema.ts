import { z } from "zod";
import { LIMITS } from "../constraints.ts";
import { PAGE_PRESETS, matchesPreset, mmToPx } from "../document/presets.ts";
import { CURRENT_SCHEMA_VERSION, type CreativeDocument } from "../document/types.ts";
import type { Element, HexColor } from "../elements/types.ts";
import { isId } from "../ids.ts";

// Schéma des données externes (fichier, sauvegarde, API, IA). Strict : toute clé inconnue est signalée
// (la politique de traitement est dans validate.ts). Les types TypeScript de référence sont dans types.ts ;
// `satisfies` garantit que le schéma ne s'en écarte pas.

const HEX_COLOR = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
/** Une clé de stockage n'est jamais une URL (blob:, data:, https:…) : on refuse tout « schéma: » en tête. */
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const id = z.custom<string>(isId, { message: "Identifiant invalide : UUID attendu" });
const hexColor = z.custom<HexColor>((v) => typeof v === "string" && HEX_COLOR.test(v), {
  message: "Couleur invalide : #RRGGBB ou #RRGGBBAA attendu",
});
const coordinate = z.number().min(LIMITS.coordinate.min).max(LIMITS.coordinate.max);
const length = z.number().positive().max(LIMITS.elementSize.max);

const baseElement = {
  id,
  name: z.string().max(LIMITS.name.maxLength).optional(),
  slot: z.enum(["guest-name", "guest-table", "guest-qr"]).optional(),
  x: coordinate,
  y: coordinate,
  width: length,
  height: length,
  rotation: z.number().min(0).lt(360),
  opacity: z.number().min(0).max(1),
  locked: z.boolean(),
  hidden: z.boolean(),
};

// Effets (facultatifs) : un document sans effet reste un document v1 valide, sans migration.
const shadow = z
  .strictObject({
    color: hexColor,
    blur: z.number().min(LIMITS.shadowBlur.min).max(LIMITS.shadowBlur.max),
    offsetX: z.number().min(LIMITS.shadowOffset.min).max(LIMITS.shadowOffset.max),
    offsetY: z.number().min(LIMITS.shadowOffset.min).max(LIMITS.shadowOffset.max),
  })
  .nullable()
  .optional();
const gradient = z
  .strictObject({ from: hexColor, to: hexColor, angle: z.number().min(0).lt(360) })
  .nullable()
  .optional();

const textElement = z.strictObject({
  ...baseElement,
  type: z.literal("text"),
  content: z.string().max(LIMITS.textContent.maxLength),
  style: z.strictObject({
    fontFamily: z.string().trim().min(1).max(LIMITS.fontFamily.maxLength),
    fontWeight: z.literal([100, 200, 300, 400, 500, 600, 700, 800, 900]),
    fontStyle: z.enum(["normal", "italic"]),
    fontSize: z.number().min(LIMITS.fontSize.min).max(LIMITS.fontSize.max),
    lineHeight: z.number().min(LIMITS.lineHeight.min).max(LIMITS.lineHeight.max),
    letterSpacing: z.number().min(LIMITS.letterSpacing.min).max(LIMITS.letterSpacing.max),
    color: hexColor,
    align: z.enum(["left", "center", "right", "justify"]),
    textTransform: z.enum(["none", "uppercase"]),
    shadow,
    outline: z
      .strictObject({
        color: hexColor,
        width: z.number().min(LIMITS.outlineWidth.min).max(LIMITS.outlineWidth.max),
      })
      .nullable()
      .optional(),
    gradient,
  }),
});

const fraction = z.number().min(0).max(1);
const unit = z.number().min(-1).max(1);
const imageElement = z.strictObject({
  ...baseElement,
  type: z.literal("image"),
  assetId: id,
  fit: z.enum(["cover", "contain", "fill"]),
  crop: z
    .strictObject({ x: fraction, y: fraction, width: fraction.positive(), height: fraction.positive() })
    .refine((c) => c.x + c.width <= 1 && c.y + c.height <= 1, "Le recadrage dépasse l'image")
    .nullable(),
  shadow,
  tint: hexColor.nullable().optional(),
  mask: z
    .strictObject({
      shape: z.enum(["rect", "rounded", "ellipse", "arch"]),
      feather: z.number().min(LIMITS.maskFeather.min).max(LIMITS.maskFeather.max),
    })
    .nullable()
    .optional(),
  adjustments: z
    .strictObject({
      brightness: unit,
      contrast: unit,
      saturation: unit,
      blur: z.number().min(LIMITS.photoBlur.min).max(LIMITS.photoBlur.max),
    })
    .nullable()
    .optional(),
});

const shapeElement = z
  .strictObject({
    ...baseElement,
    height: z.number().min(0).max(LIMITS.elementSize.max),
    type: z.literal("shape"),
    shape: z.enum(["rect", "ellipse", "line"]),
    fill: hexColor.nullable(),
    stroke: z
      .strictObject({
        color: hexColor,
        width: z.number().min(LIMITS.strokeWidth.min).max(LIMITS.strokeWidth.max),
        style: z.enum(["solid", "dashed"]),
      })
      .nullable(),
    cornerRadius: z.number().min(0),
    shadow,
    gradient,
  })
  .superRefine((shape, ctx) => {
    const issue = (path: string, message: string) => {
      ctx.addIssue({ code: "custom", path: [path], message });
    };
    if (shape.shape === "line") {
      if (shape.height !== 0) issue("height", "Une ligne a une hauteur de 0");
      if (shape.fill !== null) issue("fill", "Une ligne n'a pas de remplissage");
      if (shape.stroke === null) issue("stroke", "Une ligne doit avoir un contour");
    } else if (shape.height <= 0) {
      issue("height", "La hauteur doit être supérieure à 0");
    }
    if (shape.shape === "line" && shape.gradient) issue("gradient", "Une ligne n'a pas de dégradé");
    if (shape.shape !== "rect" && shape.cornerRadius !== 0)
      issue("cornerRadius", "Seul un rectangle a des coins arrondis");
    if (shape.cornerRadius > Math.min(shape.width, shape.height) / 2)
      issue("cornerRadius", "Le rayon dépasse la moitié du plus petit côté");
  });

export const elementSchema = z.discriminatedUnion("type", [textElement, imageElement, shapeElement]);

export const assetSchema = z.strictObject({
  kind: z.literal("image"),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]),
  width: z.int().positive().max(LIMITS.assetPixels.max),
  height: z.int().positive().max(LIMITS.assetPixels.max),
  source: z.strictObject({
    type: z.enum(["local", "remote"]),
    key: z
      .string()
      .trim()
      .min(1)
      .max(LIMITS.assetKey.maxLength)
      .refine(
        (key) => !URL_SCHEME.test(key),
        "Une référence de ressource est une clé de stockage, pas une URL",
      ),
  }),
  provenance: z.enum(["upload", "template", "ai"]),
});

const pageSize = z.int().min(LIMITS.pageSize.min).max(LIMITS.pageSize.max);
export const pageSchema = z
  .strictObject({
    unit: z.literal("px"),
    width: pageSize,
    height: pageSize,
    preset: z.enum(["social-4-5", "story-9-16", "square", "print-a5", "print-a4", "custom"]),
    print: z
      .strictObject({
        widthMm: z.number().min(LIMITS.printMm.min).max(LIMITS.printMm.max),
        heightMm: z.number().min(LIMITS.printMm.min).max(LIMITS.printMm.max),
        dpi: z.int().min(LIMITS.dpi.min).max(LIMITS.dpi.max),
        bleedMm: z.number().min(LIMITS.bleedMm.min).max(LIMITS.bleedMm.max),
      })
      .nullable(),
    background: z.strictObject({ type: z.literal("solid"), color: hexColor }),
  })
  .superRefine((page, ctx) => {
    if (page.preset !== "custom" && !matchesPreset(page.preset, page)) {
      const { width, height } = PAGE_PRESETS[page.preset];
      ctx.addIssue({
        code: "custom",
        path: ["preset"],
        message: `Le format ${page.preset} mesure ${width} × ${height} px (ou l'inverse), pas ${page.width} × ${page.height}`,
      });
    }
    // Les pixels doivent correspondre au format physique, à 1 px près (arrondi).
    if (page.print) {
      const { widthMm, heightMm, dpi } = page.print;
      if (
        Math.abs(mmToPx(widthMm, dpi) - page.width) > 1 ||
        Math.abs(mmToPx(heightMm, dpi) - page.height) > 1
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["print"],
          message: `${widthMm} × ${heightMm} mm à ${dpi} dpi ne correspond pas à ${page.width} × ${page.height} px`,
        });
      }
    }
  });

export const documentSchema = z
  .strictObject({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    id,
    meta: z.strictObject({
      title: z.string().max(LIMITS.title.maxLength),
      createdAt: z.iso.datetime({ offset: true }),
      updatedAt: z.iso.datetime({ offset: true }),
      template: z.strictObject({ id: z.string().min(1).max(200), version: z.int().nonnegative() }).nullable(),
    }),
    page: pageSchema,
    assets: z
      .record(id, assetSchema)
      .refine(
        (a) => Object.keys(a).length <= LIMITS.assetCount.max,
        `${LIMITS.assetCount.max} ressources au maximum`,
      ),
    elements: z.array(elementSchema).max(LIMITS.elementCount.max),
  })
  .superRefine((doc, ctx) => {
    for (const issue of documentInvariantIssues(doc)) ctx.addIssue({ code: "custom", ...issue });
  }) satisfies z.ZodType<CreativeDocument>;

/** Invariants qui portent sur plusieurs parties du document : unicité des identifiants, ressources référencées. */
export function documentInvariantIssues(
  doc: Pick<CreativeDocument, "assets" | "elements">,
): { path: (string | number)[]; message: string }[] {
  const issues: { path: (string | number)[]; message: string }[] = [];
  const seen = new Set<string>();
  doc.elements.forEach((element: Element, index) => {
    if (seen.has(element.id)) {
      issues.push({ path: ["elements", index, "id"], message: `Identifiant en double : ${element.id}` });
    }
    seen.add(element.id);
    if (element.type === "image" && !Object.hasOwn(doc.assets, element.assetId)) {
      issues.push({
        path: ["elements", index, "assetId"],
        message: `Ressource introuvable dans document.assets : ${element.assetId}`,
      });
    }
  });
  return issues;
}
