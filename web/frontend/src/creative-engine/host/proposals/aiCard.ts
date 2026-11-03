import { createDocument, createImageElement, createShapeElement, createTextElement } from "../../domain/document/factories.ts";
import type { CreativeDocument, ImageAsset } from "../../domain/document/types.ts";
import type { Element, HexColor, TextElement, TextStyle } from "../../domain/elements/types.ts";
import { createId } from "../../domain/ids.ts";
import { backgroundBehind, readableColor, targetContrast } from "../../editor/colors.ts";
import { CARD_SIZE, createGuestName, createGuestQr, createGuestTable, SEAL_ASSET, type GuestSample } from "../guestFields.ts";
import type { CardFacts } from "./charter.ts";
import { withContent } from "./compose.ts";
import { defaultTexts } from "./fallback.ts";

// Carte générée par l'IA (lot D2) : l'illustration couvre la page ; les textes de l'événement sont posés par le
// moteur sur un voile clair, au centre (là où le prompt demande une zone calme), et le sceau en bas à droite.
// L'IA ne dessine aucun texte : noms, date et lieu restent exacts et modifiables.

const VEIL = { x: 120, y: 220, width: 840, height: 740 };
const INNER = { x: VEIL.x + 40, width: VEIL.width - 80 };

function text(name: string, y: number, placeholder: string, style: Partial<TextStyle>): TextElement {
  const lines = placeholder.split("\n").length;
  const fontSize = style.fontSize ?? 30;
  const lineHeight = style.lineHeight ?? 1.25;
  return {
    ...createTextElement({
      x: INNER.x,
      y,
      width: INNER.width,
      height: Math.round(lines * fontSize * lineHeight * 100) / 100,
      content: placeholder,
      style: { fontFamily: "Poppins", fontWeight: 400, align: "center", lineHeight, ...style },
    }),
    name,
  };
}

/** Carte complète autour de l'illustration générée, avec les faits de l'événement et l'invité d'exemple. */
export function composeOnImage(illustration: ImageAsset, facts: CardFacts, sample: GuestSample): CreativeDocument {
  const base = createDocument({ preset: "social-4-5" });
  const accent = (facts.colors[0] ?? "#8E6B2E") as HexColor;
  const ink = (facts.colors[1] ?? "#1F1F1F") as HexColor;
  const muted = "#4A4A4A" as HexColor;
  const texts = defaultTexts(facts);
  const imageId = createId();
  const sealId = createId();
  const dress = !facts.dressCode ? "" : /^dress code/i.test(facts.dressCode) ? facts.dressCode : `Tenue : ${facts.dressCode}`;

  const filled = (element: TextElement, content: string) => (content.trim() ? withContent(element, content) : null);
  const parts: (Element | null)[] = [
    {
      ...createImageElement({ x: 0, y: 0, width: CARD_SIZE.width, height: CARD_SIZE.height, assetId: imageId, fit: "cover" }),
      name: "Illustration IA",
    },
    {
      ...createShapeElement({ ...VEIL, shape: "rect", fill: "#FFFFFFE6" as HexColor, cornerRadius: 36 }),
      name: "Voile",
    },
    filled(text("Annonce", 268, "x", { fontSize: 26, fontWeight: 500, color: accent, textTransform: "uppercase", letterSpacing: 0.25 }), texts.kicker),
    filled(text("Titre", 318, "x\nx", { fontFamily: "Playfair Display", fontSize: 80, fontWeight: 600, lineHeight: 1.1, color: ink }), texts.title),
    filled(text("Date", 522, "x", { fontSize: 32, fontWeight: 500, color: ink }), facts.dateLine),
    filled(text("Lieu", 574, "x\nx", { fontSize: 26, lineHeight: 1.4, color: muted }), facts.placeLines.join("\n")),
    filled(text("Invitation", 676, "x", { fontFamily: "Playfair Display", fontSize: 26, fontStyle: "italic", color: accent }), texts.guestLabel),
    { ...createGuestName(sample, { x: 540, y: 752, size: 60, color: ink, font: "serif", bold: true }) },
    { ...createGuestTable(sample, { x: 540, y: 816, size: 28, color: muted, font: "sans", bold: false }) },
    filled(text("Tenue", 858, "x", { fontSize: 24, fontWeight: 500, color: accent }), dress),
    filled(text("Réponse", 900, "x", { fontFamily: "Playfair Display", fontSize: 24, fontStyle: "italic", color: muted }), texts.closing),
    createGuestQr(sealId, "bas-droite"),
  ];

  const doc: CreativeDocument = {
    ...base,
    meta: { ...base.meta, title: `Carte · ${facts.title}` },
    assets: { [imageId]: illustration, [sealId]: SEAL_ASSET },
    elements: parts.filter((e): e is Element => e !== null),
  };
  // Textes lisibles sur le voile (couleurs du code couleur de l'événement, assombries si besoin).
  return {
    ...doc,
    elements: doc.elements.map((element) => {
      if (element.type !== "text") return element;
      const behind = backgroundBehind(doc, element) ?? doc.page.background.color;
      return { ...element, style: { ...element.style, color: readableColor(element.style.color, behind, targetContrast(element)) } };
    }),
  };
}
