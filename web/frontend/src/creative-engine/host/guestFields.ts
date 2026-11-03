import { CANVAS, GUEST_MIN_SIZE, QR_BOX, QR_SPOT, qrPosition, textBox, type CardLayout, type TextLayout } from "@/lib/card/layout";
import { createImageElement, createTextElement } from "../domain/document/factories.ts";
import type { CreativeDocument, ImageAsset } from "../domain/document/types.ts";
import type { Element, GuestSlot, TextElement } from "../domain/elements/types.ts";
import type { Id } from "../domain/ids.ts";

// Champs invité de la carte Here! : le nom, la table et catégorie, le QR code (avec le sceau Here!).
// L'éditeur les montre avec un invité fictif ; à la validation, le décor est exporté SANS eux et leur place
// devient la mise en page (CardLayout) que Satori remplit pour chaque invité (lib/card/render.tsx).
// Satori ne sait faire que ce que CardLayout décrit : la conversion ci-dessous ramène les champs à ce sous-ensemble.

/** Format de la carte envoyée sur WhatsApp. */
export const CARD_SIZE = CANVAS;

/** Ressource du sceau d'exemple : image dessinée par Satori (route sceau.png de l'éditeur). */
export const SEAL_ASSET_KEY = "here/sceau-apercu.png";

export const SEAL_ASSET: ImageAsset = {
  kind: "image",
  mimeType: "image/png",
  width: QR_BOX.width,
  height: QR_BOX.height,
  source: { type: "remote", key: SEAL_ASSET_KEY },
  provenance: "template",
};

/** Polices que Satori connaît pour les champs invité (fichiers TTF de styles/brand/fonts). */
export const GUEST_FONTS = { "Playfair Display": "serif", Poppins: "sans", "Great Vibes": "script" } as const satisfies Record<
  string,
  TextLayout["font"]
>;

const FAMILY_OF = Object.fromEntries(Object.entries(GUEST_FONTS).map(([family, font]) => [font, family])) as Record<
  TextLayout["font"],
  string
>;

/** Bornes de la taille du texte dans CardLayout (API, schemas.py). */
export const GUEST_TEXT_SIZE = { min: GUEST_MIN_SIZE, max: 160 };

/** Ligne de texte de Satori pour les champs invité (render.tsx, Placed). */
const SATORI_LINE_HEIGHT = 1.2;

export interface GuestSample {
  readonly name: string;
  readonly table: string;
}

export const slotOf = (doc: CreativeDocument, slot: GuestSlot): Element | undefined =>
  doc.elements.find((e) => e.slot === slot);

export const hasGuestFields = (doc: CreativeDocument): boolean =>
  doc.elements.some((e) => e.slot === "guest-qr");

/** Champ de texte centré sur (x, y), aussi large que la zone de Satori à cet endroit. */
function guestText(slot: "guest-name" | "guest-table", content: string, layout: TextLayout): TextElement {
  const box = textBox(layout);
  const element = createTextElement({
    x: box.left,
    y: layout.y - (layout.size * SATORI_LINE_HEIGHT) / 2,
    width: box.width,
    height: layout.size * SATORI_LINE_HEIGHT,
    content,
    style: {
      fontFamily: FAMILY_OF[layout.font],
      fontWeight: layout.bold && layout.font !== "script" ? 600 : 400,
      fontSize: layout.size,
      lineHeight: SATORI_LINE_HEIGHT,
      color: layout.color as TextElement["style"]["color"],
      align: "center",
    },
  });
  return { ...element, slot, name: slot === "guest-name" ? "Nom de l'invité" : "Table · catégorie" };
}

/** Mise en page proposée par Here! (DEFAULT_LAYOUT de l'API) : nom au centre, table dessous, QR en bas à droite. */
export const DEFAULT_GUEST_LAYOUT: CardLayout = {
  name: { x: 540, y: 700, size: 64, color: "#0B0B0B", font: "serif", bold: false },
  table: { x: 540, y: 790, size: 34, color: "#0B0B0B", font: "sans", bold: false },
  qr: QR_SPOT,
};

export function createGuestName(sample: GuestSample, layout: TextLayout = DEFAULT_GUEST_LAYOUT.name): TextElement {
  return guestText("guest-name", sample.name, layout);
}

export function createGuestTable(
  sample: GuestSample,
  layout: TextLayout = DEFAULT_GUEST_LAYOUT.table ?? DEFAULT_GUEST_LAYOUT.name,
): TextElement {
  return guestText("guest-table", sample.table, layout);
}

/** Sceau Here! et QR code : verrouillé, toujours en bas à droite. */
export function createGuestQr(assetId: Id): Element {
  const { left, top } = qrPosition(QR_SPOT);
  return {
    ...createImageElement({ x: left, y: top, width: QR_BOX.width, height: QR_BOX.height, assetId, fit: "contain" }),
    slot: "guest-qr",
    name: "QR code et sceau Here!",
    locked: true,
  };
}

/** Le sceau est-il à sa place (en bas à droite) ? Les anciennes cartes pouvaient le mettre ailleurs. */
export function sealInPlace(element: Pick<Element, "x" | "y">): boolean {
  const { left, top } = qrPosition(QR_SPOT);
  return element.x === left && element.y === top;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Zone de Satori d'un champ invité (centre, taille, couleur, police). */
export function toTextLayout(element: TextElement): TextLayout {
  return {
    x: Math.round(clamp(element.x + element.width / 2, 0, CARD_SIZE.width)),
    y: Math.round(clamp(element.y + element.height / 2, 0, CARD_SIZE.height)),
    size: Math.round(clamp(element.style.fontSize, GUEST_TEXT_SIZE.min, GUEST_TEXT_SIZE.max)),
    // Largeur du champ : Satori y fait tenir le nom de chaque invité, en réduisant la police si besoin.
    width: Math.round(clamp(element.width, 40, CARD_SIZE.width)),
    color: element.style.color.slice(0, 7).toUpperCase(),
    font: (GUEST_FONTS as Record<string, TextLayout["font"]>)[element.style.fontFamily] ?? "sans",
    // Great Vibes n'a qu'une graisse.
    bold: element.style.fontWeight >= 600 && element.style.fontFamily !== "Great Vibes",
  };
}

export type LayoutResult = { readonly ok: true; readonly layout: CardLayout } | { readonly ok: false; readonly message: string };

/** Mise en page des champs invité pour Satori, ou ce qui empêche de valider la carte. */
export function toCardLayout(doc: CreativeDocument): LayoutResult {
  if (doc.page.width !== CARD_SIZE.width || doc.page.height !== CARD_SIZE.height)
    return {
      ok: false,
      message: `La carte envoyée sur WhatsApp est au format portrait 4:5 (${CARD_SIZE.width} × ${CARD_SIZE.height} px). Changez le format de la page.`,
    };
  const name = slotOf(doc, "guest-name");
  if (name?.type !== "text" || name.hidden)
    return { ok: false, message: "Ajoutez le nom de l'invité sur la carte : chaque invité y verra le sien." };
  const table = slotOf(doc, "guest-table");
  return {
    ok: true,
    layout: {
      name: toTextLayout(name),
      table: table?.type === "text" && !table.hidden ? toTextLayout(table) : null,
      qr: QR_SPOT,
    },
  };
}

/** Décor de la carte : le document sans les champs invité, que Satori dessinera pour chaque invité. */
export function withoutGuestFields(doc: CreativeDocument): CreativeDocument {
  const assets = Object.fromEntries(Object.entries(doc.assets).filter(([, a]) => a.source.key !== SEAL_ASSET_KEY));
  return { ...doc, assets, elements: doc.elements.filter((e) => e.slot === undefined) };
}
