import { LIMITS } from "../constraints.ts";
import { presetSize } from "../document/presets.ts";
import type { CreativeDocument, ImageAsset, PagePreset } from "../document/types.ts";
import type { HexColor } from "../elements/types.ts";
import { isId, type Id } from "../ids.ts";
import { safeParseFr, toIssues } from "../schema/issues.ts";
import { assetSchema, pageSchema } from "../schema/schema.ts";
import { failure, success, type CommandResult } from "./result.ts";

// Commandes sur le document lui-même : titre, page, ressources.

export function renameDocument(document: CreativeDocument, args: { title: string }): CommandResult {
  const title = args.title.trim();
  if (title.length > LIMITS.title.maxLength) {
    return failure("invalid_value", `Titre trop long (${LIMITS.title.maxLength} caractères au maximum)`);
  }
  if (title === document.meta.title) return success(document);
  return success({ ...document, meta: { ...document.meta, title } });
}

function withPage(document: CreativeDocument, page: unknown): CommandResult {
  const parsed = safeParseFr(pageSchema, page);
  if (!parsed.success) return failure("invalid_value", "Page invalide", toIssues(parsed.error.issues));
  return success({ ...document, page: parsed.data });
}

export function setPageBackground(document: CreativeDocument, args: { color: HexColor }): CommandResult {
  if (args.color === document.page.background.color) return success(document);
  return withPage(document, { ...document.page, background: { type: "solid", color: args.color } });
}

export type PageFormat =
  | { readonly preset: Exclude<PagePreset, "custom">; readonly orientation: "portrait" | "landscape" }
  | { readonly preset: "custom"; readonly width: number; readonly height: number };

/**
 * Change le format de la page. Les éléments ne sont ni déplacés ni redimensionnés : ils gardent leurs
 * coordonnées (une mise en page adaptative sera une fonctionnalité distincte).
 */
export function setPageFormat(document: CreativeDocument, args: PageFormat): CommandResult {
  const size =
    args.preset === "custom"
      ? { width: args.width, height: args.height, print: null }
      : presetSize(args.preset, args.orientation);
  return withPage(document, { ...document.page, preset: args.preset, ...size });
}

/** Déclare une ressource (le fichier lui-même est stocké ailleurs, voir AssetSource). */
export function addAsset(document: CreativeDocument, args: { id: Id; asset: ImageAsset }): CommandResult {
  if (!isId(args.id)) return failure("invalid_value", "Identifiant de ressource invalide : UUID attendu");
  if (Object.hasOwn(document.assets, args.id))
    return failure("duplicate_id", `La ressource ${args.id} existe déjà`);
  if (Object.keys(document.assets).length >= LIMITS.assetCount.max) {
    return failure("not_applicable", `${LIMITS.assetCount.max} ressources au maximum`);
  }
  const parsed = safeParseFr(assetSchema, args.asset);
  if (!parsed.success) return failure("invalid_value", "Ressource invalide", toIssues(parsed.error.issues));
  return success({ ...document, assets: { ...document.assets, [args.id]: parsed.data } });
}
