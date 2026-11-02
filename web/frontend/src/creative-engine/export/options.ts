import { mmToPx } from "../domain/document/presets.ts";
import { titleSlug } from "../domain/document/slug.ts";
import type { CreativeDocument } from "../domain/document/types.ts";
import { fail, ok, type ExportOutcome } from "./errors.ts";

// Options d'export : validées et traduites en un plan précis (dimensions de sortie, fond, page PDF) avant tout
// rendu. Les dimensions dépendent du document et des options, jamais de l'affichage de l'éditeur (zoom, vue).

export type ExportFormat = "png" | "jpeg" | "pdf";

export const EXPORT_FORMATS: readonly ExportFormat[] = ["png", "jpeg", "pdf"];

/** Facteurs d'agrandissement proposés pour le PNG et le JPEG (ADR-008). */
export const EXPORT_SCALES = [1, 2, 3] as const;
export type ExportScale = (typeof EXPORT_SCALES)[number];

export const DEFAULT_JPEG_QUALITY = 0.9;
export const JPEG_QUALITY_RANGE = { min: 0.5, max: 1 } as const;
/** Qualité de l'image intégrée au PDF : proche de l'original, sans le poids d'une image sans perte. */
export const PDF_IMAGE_QUALITY = 0.95;

/**
 * Plafonds de sortie. 16 384 px de côté : limite d'un canvas dans Chrome et Firefox. 40 Mpx : marge sous la
 * limite de surface de Chrome (environ 268 Mpx) et la mémoire d'un appareil courant (160 Mo décodés).
 * Safari iOS est plus strict (environ 16,7 Mpx) : un échec à la conversion y est signalé comme tel.
 */
export const MAX_EXPORT_SIDE = 16_384;
export const MAX_EXPORT_PIXELS = 40_000_000;

/** 1 px CSS = 0,75 pt (96 px par pouce) : taille de page d'un document sans format d'impression. */
const PT_PER_PX = 72 / 96;
const PT_PER_MM = 72 / 25.4;
/** Facteur de l'image d'un PDF « écran » : assez net pour un zoom à 200 % ou une impression de bureau. */
const SCREEN_PDF_SCALE = 2;

export interface ExportOptions {
  readonly format: ExportFormat;
  /** PNG et JPEG : 1, 2 ou 3 (défaut 1). Ignoré pour le PDF (résolution fixée par le format). */
  readonly scale?: number;
  /** JPEG : 0,5 à 1 (défaut 0,9). */
  readonly quality?: number;
  /** PNG : sans le fond de page, seuls les éléments sont dessinés. */
  readonly transparentBackground?: boolean;
  /** PDF d'un document imprimable : ajoute le fond perdu autour de la page (TrimBox = format fini). */
  readonly includeBleed?: boolean;
  /** Nom du fichier sans extension ; par défaut, tiré du titre du document. */
  readonly fileName?: string;
}

/** Page PDF, en points (1/72 de pouce). */
export interface PdfPage {
  readonly widthPt: number;
  readonly heightPt: number;
  /** Format fini (sans fond perdu), s'il diffère de la page. */
  readonly trimBox: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  } | null;
}

export interface ExportPlan {
  readonly format: ExportFormat;
  readonly mimeType: "image/png" | "image/jpeg" | "application/pdf";
  readonly fileName: string;
  /** Facteur entre les px du document et les px de l'image produite. */
  readonly pixelRatio: number;
  /** Fond perdu ajouté autour de la page, en px du document (0 sans fond perdu). */
  readonly bleedPx: number;
  /** Fond : celui de la page sur blanc (comme dans l'éditeur), ou aucun (PNG transparent). */
  readonly background: "page" | "transparent";
  /** Qualité d'encodage JPEG (aussi celle de l'image d'un PDF). */
  readonly quality: number;
  /** Dimensions de l'image produite, en pixels. */
  readonly output: { readonly width: number; readonly height: number };
  readonly pdf: PdfPage | null;
}

const EXTENSIONS: Record<ExportFormat, string> = { png: ".png", jpeg: ".jpg", pdf: ".pdf" };
const MIME_TYPES = { png: "image/png", jpeg: "image/jpeg", pdf: "application/pdf" } as const;

const round2 = (value: number) => Math.round(value * 100) / 100;

function baseName(document: CreativeDocument, requested: string | undefined): string {
  return titleSlug(requested ?? "") || titleSlug(document.meta.title) || "document";
}

/** Vrai si le PDF de ce document peut avoir un fond perdu (format d'impression avec fond perdu). */
export function hasBleed(document: CreativeDocument): boolean {
  return (document.page.print?.bleedMm ?? 0) > 0;
}

/** Plan d'export validé, ou l'erreur qui explique pourquoi l'export est impossible. */
export function planExport(document: CreativeDocument, options: ExportOptions): ExportOutcome<ExportPlan> {
  const { format } = options;
  if (!(EXPORT_FORMATS as readonly string[]).includes(format))
    return fail("invalid_options", "Ce format d'export n'est pas pris en charge.");

  const { page } = document;
  let pixelRatio: number;
  let bleedPx = 0;
  let pdf: PdfPage | null = null;

  if (format === "pdf") {
    const print = page.print;
    if (print) {
      // Les px d'un document imprimable sont à sa résolution d'impression (300 dpi) : facteur 1.
      pixelRatio = 1;
      const bleedMm = options.includeBleed === false ? 0 : print.bleedMm;
      bleedPx = mmToPx(bleedMm, print.dpi);
      const trim = { width: print.widthMm * PT_PER_MM, height: print.heightMm * PT_PER_MM };
      const bleed = bleedMm * PT_PER_MM;
      pdf = {
        widthPt: round2(trim.width + 2 * bleed),
        heightPt: round2(trim.height + 2 * bleed),
        trimBox:
          bleedMm > 0
            ? { x: round2(bleed), y: round2(bleed), width: round2(trim.width), height: round2(trim.height) }
            : null,
      };
    } else {
      pixelRatio = SCREEN_PDF_SCALE;
      pdf = {
        widthPt: round2(page.width * PT_PER_PX),
        heightPt: round2(page.height * PT_PER_PX),
        trimBox: null,
      };
    }
  } else {
    const scale = options.scale ?? 1;
    if (!(EXPORT_SCALES as readonly number[]).includes(scale))
      return fail("invalid_options", "La taille d'export doit être 1×, 2× ou 3×.");
    pixelRatio = scale;
  }

  let quality = format === "pdf" ? PDF_IMAGE_QUALITY : DEFAULT_JPEG_QUALITY;
  if (format === "jpeg" && options.quality !== undefined) {
    if (
      !Number.isFinite(options.quality) ||
      options.quality < JPEG_QUALITY_RANGE.min ||
      options.quality > JPEG_QUALITY_RANGE.max
    )
      return fail("invalid_options", "La qualité JPEG doit être comprise entre 50 % et 100 %.");
    quality = options.quality;
  }

  const output = {
    width: Math.round((page.width + 2 * bleedPx) * pixelRatio),
    height: Math.round((page.height + 2 * bleedPx) * pixelRatio),
  };
  if (output.width < 1 || output.height < 1)
    return fail("invalid_options", "Les dimensions du document sont nulles.");
  const tooLarge = exportSizeError(output);
  if (tooLarge) return fail("too_large", tooLarge);

  return ok({
    format,
    mimeType: MIME_TYPES[format],
    fileName: `${baseName(document, options.fileName)}${format !== "pdf" && pixelRatio > 1 ? `@${pixelRatio}x` : ""}${EXTENSIONS[format]}`,
    pixelRatio,
    bleedPx,
    background: format === "png" && options.transparentBackground ? "transparent" : "page",
    quality,
    output,
    pdf,
  });
}

/** Message si une image de ces dimensions dépasse les plafonds ; null si elle est possible. */
export function exportSizeError(output: { width: number; height: number }): string | null {
  if (
    Math.max(output.width, output.height) <= MAX_EXPORT_SIDE &&
    output.width * output.height <= MAX_EXPORT_PIXELS
  )
    return null;
  return `L'image ferait ${output.width} × ${output.height} px, au-delà de ce que le navigateur peut produire. Choisissez une taille plus petite.`;
}
