import type { CreativeDocument } from "../domain/document/types.ts";
import { validateDocument } from "../domain/schema/validate.ts";
import { renderDocumentToCanvas } from "../rendering/konva/sceneBuilder.ts";
import { ABORTED, fail, ok, type ExportOutcome } from "./errors.ts";
import { planExport, type ExportOptions, type ExportPlan } from "./options.ts";
import { createPdf } from "./pdf.ts";
import { prepareFonts, prepareImages, type AssetUrlResolver } from "./resources.ts";

// Export d'un document (Phase 7, ADR-008), en étapes séparées :
//   1. validation du document et des options → plan (dimensions, fond, page PDF) ;
//   2. ressources : polices chargées et vérifiées, images décodées et lisibles ;
//   3. rendu : scène hors écran construite depuis le document (rendering/konva/sceneBuilder) ;
//   4. conversion : PNG ou JPEG par le navigateur ; le PDF intègre le JPEG tel quel ;
//   5. résultat : un Blob et son nom. Le téléchargement appartient à l'interface.
// Le document n'est jamais modifié (il est immuable) ; le canvas de rendu est libéré dans tous les cas.

export interface ExportResult {
  readonly blob: Blob;
  readonly mimeType: string;
  readonly fileName: string;
  /** Dimensions de l'image produite (celle intégrée au PDF pour un PDF). */
  readonly width: number;
  readonly height: number;
}

export interface ExportContext {
  /** URL affichable de chaque ressource (l'hôte sait où sont les fichiers). */
  readonly resolveAssetUrl: AssetUrlResolver;
  /** Annulation par l'utilisateur. */
  readonly signal?: AbortSignal;
  /** Horloge (métadonnées du PDF, tests). */
  readonly now?: () => Date;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(resolve, type, quality);
    } catch {
      // SecurityError (canvas contaminé) : déjà écarté par prepareImages, mais jamais un faux succès.
      resolve(null);
    }
  });
}

const ENCODE_FAILED =
  "Le fichier n'a pas pu être produit, probablement faute de mémoire. Choisissez une taille plus petite et réessayez.";

async function encode(canvas: HTMLCanvasElement, plan: ExportPlan, title: string, now: () => Date) {
  const type = plan.format === "png" ? "image/png" : "image/jpeg";
  const blob = await toBlob(canvas, type, plan.quality);
  // Un navigateur qui ne sait pas produire le type demandé renvoie un PNG : ce serait un fichier mal nommé.
  if (!blob || blob.size === 0 || blob.type !== type) return null;
  if (!plan.pdf) return blob;
  const pdf = createPdf(
    plan.pdf,
    { jpeg: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height },
    { title, creationDate: now() },
  );
  return new Blob([pdf.slice().buffer], { type: "application/pdf" });
}

export async function exportDocument(
  document: CreativeDocument,
  options: ExportOptions,
  context: ExportContext,
): Promise<ExportOutcome<ExportResult>> {
  const { signal } = context;
  if (validateDocument(document).length > 0)
    return fail("invalid_document", "Le document contient des erreurs et ne peut pas être exporté.");
  const planned = planExport(document, options);
  if (!planned.ok) return planned;
  const plan = planned.value;

  const fonts = await prepareFonts(document);
  if (!fonts.ok) return fonts;
  if (signal?.aborted) return { ok: false, error: ABORTED };
  const images = await prepareImages(document, context.resolveAssetUrl, signal);
  if (signal?.aborted) return { ok: false, error: ABORTED };
  if (!images.ok) return images;

  let canvas: HTMLCanvasElement | null = null;
  try {
    try {
      canvas = renderDocumentToCanvas(document, images.value, plan);
    } catch {
      return fail("render_failed", "Le document n'a pas pu être dessiné pour l'export. Réessayez.");
    }
    // Un canvas trop grand pour l'appareil est créé vide (0 × 0) au lieu d'échouer.
    if (canvas.width !== plan.output.width || canvas.height !== plan.output.height)
      return fail("too_large", ENCODE_FAILED);
    const blob = await encode(canvas, plan, document.meta.title, context.now ?? (() => new Date()));
    if (signal?.aborted) return { ok: false, error: ABORTED };
    if (!blob) return fail("encode_failed", ENCODE_FAILED);
    return ok({ blob, mimeType: plan.mimeType, fileName: plan.fileName, ...plan.output });
  } finally {
    // Libère la mémoire du canvas sans attendre le ramasse-miettes (images de plusieurs dizaines de Mo).
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
