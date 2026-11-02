import type { Id } from "../ids.ts";

/** Couleur #RRGGBB ou #RRGGBBAA. */
export type HexColor = `#${string}`;

/**
 * Propriétés communes à tous les éléments.
 * Repère : px du document, origine en haut à gauche de la page, y vers le bas.
 * (x, y) est le coin supérieur gauche de la boîte NON tournée ; la rotation (degrés, sens horaire, [0, 360))
 * s'applique autour du centre de la boîte. Le modèle ne contient pas d'échelle : un redimensionnement modifie
 * width et height.
 */
/**
 * Champ rempli pour chaque invité par l'hôte (Here!) : nom, table et catégorie, QR code. Dans l'éditeur, il
 * s'affiche avec un invité fictif ; il n'est pas dessiné dans le décor exporté pour l'hôte.
 */
export type GuestSlot = "guest-name" | "guest-table" | "guest-qr";

export interface BaseElement {
  readonly id: Id;
  readonly name?: string;
  /** Champ invité ; absent pour un élément ordinaire. Une copie de l'élément ne le reprend pas. */
  readonly slot?: GuestSlot;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  /** 0 (transparent) à 1 (opaque). */
  readonly opacity: number;
  /** Non sélectionnable sur le canevas ; refuse déplacement, redimensionnement, rotation et suppression. */
  readonly locked: boolean;
  readonly hidden: boolean;
}

/** Ombre portée, en px du document. La couleur porte sa transparence (#RRGGBBAA). */
export interface Shadow {
  readonly color: HexColor;
  readonly blur: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/**
 * Dégradé linéaire à deux couleurs, sur toute la boîte de l'élément. Angle en degrés, sens horaire :
 * 0 = de gauche à droite, 90 = de haut en bas. Il remplace la couleur de remplissage.
 */
export interface LinearGradient {
  readonly from: HexColor;
  readonly to: HexColor;
  readonly angle: number;
}

/** Contour d'un texte, dessiné sous les lettres (elles gardent leur dessin). */
export interface TextOutline {
  readonly color: HexColor;
  /** px du document. */
  readonly width: number;
}

export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export interface TextStyle {
  readonly fontFamily: string;
  readonly fontWeight: FontWeight;
  readonly fontStyle: "normal" | "italic";
  /** px du document. */
  readonly fontSize: number;
  /** Multiple de fontSize. */
  readonly lineHeight: number;
  /** En em (fraction de fontSize), converti en px par le rendu. */
  readonly letterSpacing: number;
  readonly color: HexColor;
  readonly align: "left" | "center" | "right" | "justify";
  readonly textTransform: "none" | "uppercase";
  /** Effets (facultatifs, absents = aucun). */
  readonly shadow?: Shadow | null;
  readonly outline?: TextOutline | null;
  readonly gradient?: LinearGradient | null;
}

/**
 * Bloc de texte. width = largeur du conteneur : le texte revient à la ligne sur les mots.
 * height = hauteur occupée par le texte mis en page, mesurée par le moteur de rendu (le conteneur grandit
 * avec le texte, il ne le coupe pas). Un seul style par bloc en v1.
 */
export interface TextElement extends BaseElement {
  readonly type: "text";
  /** Texte brut ; « \n » pour un retour à la ligne forcé. */
  readonly content: string;
  readonly style: TextStyle;
}

/** Recadrage dans l'image source, en fractions (0 à 1) de ses dimensions. */
export interface CropRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Image placée dans le document. Le fichier est décrit une seule fois dans document.assets. */
export interface ImageElement extends BaseElement {
  readonly type: "image";
  readonly assetId: Id;
  /** cover : remplit le cadre en rognant ; contain : entière dans le cadre ; fill : déformée au cadre. */
  readonly fit: "cover" | "contain" | "fill";
  readonly crop: CropRect | null;
  readonly shadow?: Shadow | null;
}

export interface Stroke {
  readonly color: HexColor;
  /** px du document. */
  readonly width: number;
  readonly style: "solid" | "dashed";
}

/**
 * Forme simple. Pour une ligne, height vaut 0 : le segment va de (x, y) à (x + width, y),
 * tourné autour de son milieu ; elle n'a pas de remplissage et a toujours un contour.
 */
export interface ShapeElement extends BaseElement {
  readonly type: "shape";
  readonly shape: "rect" | "ellipse" | "line";
  readonly fill: HexColor | null;
  readonly stroke: Stroke | null;
  /** Rectangle uniquement : rayon des coins, en px. */
  readonly cornerRadius: number;
  readonly shadow?: Shadow | null;
  /** Rectangle et ellipse : remplace `fill`. */
  readonly gradient?: LinearGradient | null;
}

export type Element = TextElement | ImageElement | ShapeElement;
export type ElementType = Element["type"];
