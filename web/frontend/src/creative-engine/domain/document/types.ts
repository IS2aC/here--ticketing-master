import type { Element, HexColor } from "../elements/types.ts";
import type { Id } from "../ids.ts";

export const CURRENT_SCHEMA_VERSION = 1;

export type PagePreset = "social-4-5" | "story-9-16" | "square" | "print-a5" | "print-a4" | "custom";

/** Fond de page. v1 : couleur unie (les dégradés et images de fond viendront par migration). */
export interface SolidFill {
  readonly type: "solid";
  readonly color: HexColor;
}

/** Format physique d'un document imprimable. Le fond perdu s'étend hors de la page, sur chaque bord. */
export interface PrintSpec {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly dpi: number;
  readonly bleedMm: number;
}

/**
 * Page. width et height sont en px du document, indépendants de l'écran, du zoom et de la résolution d'export.
 * L'orientation n'est pas stockée : elle se déduit des dimensions (voir orientationOf).
 */
export interface Page {
  readonly unit: "px";
  readonly width: number;
  readonly height: number;
  readonly preset: PagePreset;
  readonly print: PrintSpec | null;
  readonly background: SolidFill;
}

/**
 * Emplacement d'un fichier, sans URL : une URL (blob:, signée, distante) est résolue au chargement,
 * jamais enregistrée. local = stockage de l'appareil (Phase 5) ; remote = stockage serveur (plus tard).
 */
export type AssetSource =
  { readonly type: "local"; readonly key: string } | { readonly type: "remote"; readonly key: string };

export interface ImageAsset {
  readonly kind: "image";
  readonly mimeType: "image/png" | "image/jpeg" | "image/webp";
  /** Dimensions intrinsèques du fichier, en pixels. */
  readonly width: number;
  readonly height: number;
  readonly source: AssetSource;
  readonly provenance: "upload" | "template" | "ai";
}

export interface DocumentMeta {
  readonly title: string;
  /** ISO 8601. */
  readonly createdAt: string;
  /** ISO 8601. Mis à jour à l'enregistrement (Phase 5), pas par les commandes. */
  readonly updatedAt: string;
  /** Modèle d'origine, si le document a été créé depuis un modèle. */
  readonly template: { readonly id: string; readonly version: number } | null;
}

export interface CreativeDocument {
  readonly schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  readonly id: Id;
  readonly meta: DocumentMeta;
  readonly page: Page;
  /** Fichiers référencés par les éléments, par identifiant. */
  readonly assets: Readonly<Record<Id, ImageAsset>>;
  /** Ordre d'affichage : du premier (arrière-plan) au dernier (premier plan). Aucun zIndex séparé. */
  readonly elements: readonly Element[];
}
