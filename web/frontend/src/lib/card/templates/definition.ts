// Modèles de cartes par type d'événement : définition JSON d'un modèle, validée par l'API (web/api/app/card_templates.py).
// Positions en pourcentage de la carte (zone de coupe pour l'A5) ; tailles en pixels d'une carte de 1080 de large.
// Les textes citent les champs entre accolades : « {maries} », « {invite.nom} », « {invite.table} ».

export type CardFormat = "whatsapp_4_5" | "story_9_16" | "square_1_1" | "print_a5";
export type ColorKey = "primary" | "secondary" | "accent" | "background" | "text";
export type ColorRef = ColorKey | `#${string}`;
export type FontFamily = "Playfair Display" | "Poppins" | "Inter";

export type Box = { x: number; y: number; w: number; h: number };

type LayerBase = {
  id: string;
  box: Box;
  locked?: boolean;
  movable?: boolean;
  hidden?: boolean;
  formats?: Partial<Record<CardFormat, { box?: Box | null; hidden?: boolean }>>;
};

export type ImageLayer = LayerBase & {
  type: "image";
  asset: string;
  fit?: "cover" | "contain";
  ornament?: boolean;
  tint?: ColorRef | null;
  opacity?: number;
};

export type TextLayer = LayerBase & {
  type: "text";
  text: string;
  font?: "heading" | "body";
  weight?: 400 | 500 | 600 | 700 | 800;
  italic?: boolean;
  uppercase?: boolean;
  letter_spacing?: number; // en em
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  size: { min: number; max: number };
  max_lines?: number;
  line_height?: number;
  color?: ColorRef;
  backdrop?: ColorRef; // couleur derrière le texte, pour le contraste
};

export type ShapeLayer = LayerBase & {
  type: "shape";
  shape: "rect" | "ellipse" | "line";
  fill?: ColorRef | null;
  stroke?: ColorRef | null;
  stroke_width?: number;
  radius?: number;
  opacity?: number;
};

export type PhotoLayer = LayerBase & {
  type: "photo";
  mask?: "circle" | "arch" | "rect";
  border?: ColorRef | null;
  border_width?: number;
};

export type QrLayer = LayerBase & { type: "qr" };

export type Layer = ImageLayer | TextLayer | ShapeLayer | PhotoLayer | QrLayer;

export type Palette = { id: string; label: string; colors: Record<ColorKey, string> };
export type FontPair = { id: string; label: string; heading: FontFamily; body: FontFamily };

export type TemplateField = {
  key: string;
  label: string;
  type?: "text" | "multiline" | "date" | "time";
  required?: boolean;
  max_length?: number;
  default?: string | null;
  example?: string | null; // pour l'aperçu de la galerie
};

export type EventSource =
  | "title"
  | "date"
  | "time"
  | "location_name"
  | "location_address"
  | "dress_code"
  | "description"
  | "rsvp_deadline";

export type CardDefinition = {
  version: 1;
  formats: CardFormat[];
  theme: { palettes: Palette[]; fonts: FontPair[] };
  fields: TemplateField[];
  field_mapping?: Partial<Record<string, EventSource>>;
  layers: Layer[];
};

/** Réglages de l'organisateur (event_cards.theme_overrides). */
export type ThemeOverrides = {
  palette?: string; // identifiant d'une palette du modèle
  fonts?: string; // identifiant d'une paire de polices
  hidden?: string[]; // ornements masqués
  moves?: Record<string, { x: number; y: number }>; // calques déplaçables : nouvelle position (%)
};

// Dimensions en pixels. A5 : 148 × 210 mm à 300 dpi, plus 3 mm de fond perdu (35 px) de chaque côté.
export const FORMATS: Record<CardFormat, { label: string; width: number; height: number; bleed: number }> = {
  whatsapp_4_5: { label: "WhatsApp", width: 1080, height: 1350, bleed: 0 },
  story_9_16: { label: "Story", width: 1080, height: 1920, bleed: 0 },
  square_1_1: { label: "Carré", width: 1080, height: 1080, bleed: 0 },
  print_a5: { label: "A5 à imprimer", width: 1748, height: 2480, bleed: 35 },
};

export const PLACEHOLDER = /\{([a-z][a-z0-9_.]*)\}/g;

/** Champs cités par un texte (« {date} à {heure} » → date, heure). */
export function placeholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1]);
}
