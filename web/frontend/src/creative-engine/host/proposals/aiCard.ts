import { createDocument, createImageElement, createShapeElement, createTextElement } from "../../domain/document/factories.ts";
import type { CreativeDocument, ImageAsset } from "../../domain/document/types.ts";
import type { Element, HexColor, TextElement, TextStyle } from "../../domain/elements/types.ts";
import { createId } from "../../domain/ids.ts";
import { backgroundBehind, readableColor, targetContrast } from "../../editor/colors.ts";
import { CARD_SIZE, createGuestName, createGuestQr, createGuestTable, SEAL_ASSET, type GuestSample } from "../guestFields.ts";
import type { CardFacts } from "./charter.ts";
import { withContent } from "./compose.ts";
import { defaultTexts } from "./fallback.ts";

// Carte générée par l'IA (lots D2 et D3) : l'illustration couvre la page ; les textes de l'événement sont posés
// par le moteur sur un voile clair, là où le prompt demande une zone calme, et le sceau en bas à droite.
//   - « centre » : un voile au centre ;
//   - « photos » : les personnes des photos occupent la moitié haute ; deux voiles en bas, à gauche du sceau.
// L'IA ne dessine aucun texte : noms, date et lieu restent exacts et modifiables.

export type AiLayout = "centre" | "photos";

interface Box {
  readonly x: number;
  readonly width: number;
}

function text(box: Box, name: string, y: number, placeholder: string, style: Partial<TextStyle>): TextElement {
  const lines = placeholder.split("\n").length;
  const fontSize = style.fontSize ?? 30;
  const lineHeight = style.lineHeight ?? 1.25;
  return {
    ...createTextElement({
      x: box.x,
      y,
      width: box.width,
      height: Math.round(lines * fontSize * lineHeight * 100) / 100,
      content: placeholder,
      style: { fontFamily: "Poppins", fontWeight: 400, align: "center", lineHeight, ...style },
    }),
    name,
  };
}

const veil = (name: string, x: number, y: number, width: number, height: number): Element => ({
  ...createShapeElement({ x, y, width, height, shape: "rect", fill: "#FFFFFFE6" as HexColor, cornerRadius: 36 }),
  name,
});

/** Carte complète autour de l'illustration générée, avec les faits de l'événement et l'invité d'exemple. */
export function composeOnImage(
  illustration: ImageAsset,
  facts: CardFacts,
  sample: GuestSample,
  layout: AiLayout = "centre",
): CreativeDocument {
  const base = createDocument({ preset: "social-4-5" });
  const accent = (facts.colors[0] ?? "#8E6B2E") as HexColor;
  const ink = (facts.colors[1] ?? "#1F1F1F") as HexColor;
  const muted = "#4A4A4A" as HexColor;
  const texts = defaultTexts(facts);
  const imageId = createId();
  const sealId = createId();
  const dress = !facts.dressCode ? "" : /^dress code/i.test(facts.dressCode) ? facts.dressCode : `Tenue : ${facts.dressCode}`;

  const filled = (element: TextElement, content: string) => (content.trim() ? withContent(element, content) : null);
  const kicker = { fontSize: 26, fontWeight: 500, color: accent, textTransform: "uppercase", letterSpacing: 0.25 } as const;
  const title = { fontFamily: "Playfair Display", fontWeight: 600, lineHeight: 1.1, color: ink } as const;
  const italic = { fontFamily: "Playfair Display", fontStyle: "italic" } as const;
  const illustrationElement: Element = {
    ...createImageElement({ x: 0, y: 0, width: CARD_SIZE.width, height: CARD_SIZE.height, assetId: imageId, fit: "cover" }),
    name: "Illustration IA",
  };

  const parts: (Element | null)[] =
    layout === "photos"
      ? (() => {
          const top = { x: 130, width: 820 };
          const bottom = { x: 100, width: 610 };
          return [
            illustrationElement,
            veil("Voile", 90, 600, 900, 340),
            veil("Voile invité", 60, 990, 690, 300),
            filled(text(top, "Annonce", 622, "x", { ...kicker, fontSize: 22 }), texts.kicker),
            filled(text(top, "Titre", 660, "x\nx", { ...title, fontSize: 64 }), texts.title),
            filled(text(top, "Date", 812, "x", { fontSize: 28, fontWeight: 500, color: ink }), facts.dateLine),
            filled(text(top, "Lieu", 856, "x\nx", { fontSize: 22, lineHeight: 1.35, color: muted }), facts.placeLines.join("\n")),
            filled(text(bottom, "Invitation", 1012, "x", { ...italic, fontSize: 22, color: accent }), texts.guestLabel),
            createGuestName(sample, { x: 395, y: 1080, size: 52, color: ink, font: "serif", bold: true }),
            createGuestTable(sample, { x: 395, y: 1135, size: 26, color: muted, font: "sans", bold: false }),
            filled(text(bottom, "Tenue", 1165, "x", { fontSize: 22, fontWeight: 500, color: accent }), dress),
            filled(text(bottom, "Réponse", 1205, "x", { ...italic, fontSize: 22, color: muted }), texts.closing),
            createGuestQr(sealId),
          ];
        })()
      : (() => {
          const inner = { x: 160, width: 760 };
          return [
            illustrationElement,
            veil("Voile", 120, 220, 840, 740),
            filled(text(inner, "Annonce", 268, "x", kicker), texts.kicker),
            filled(text(inner, "Titre", 318, "x\nx", { ...title, fontSize: 80 }), texts.title),
            filled(text(inner, "Date", 522, "x", { fontSize: 32, fontWeight: 500, color: ink }), facts.dateLine),
            filled(text(inner, "Lieu", 574, "x\nx", { fontSize: 26, lineHeight: 1.4, color: muted }), facts.placeLines.join("\n")),
            filled(text(inner, "Invitation", 676, "x", { ...italic, fontSize: 26, color: accent }), texts.guestLabel),
            createGuestName(sample, { x: 540, y: 752, size: 60, color: ink, font: "serif", bold: true }),
            createGuestTable(sample, { x: 540, y: 816, size: 28, color: muted, font: "sans", bold: false }),
            filled(text(inner, "Tenue", 858, "x", { fontSize: 24, fontWeight: 500, color: accent }), dress),
            filled(text(inner, "Réponse", 900, "x", { ...italic, fontSize: 24, color: muted }), texts.closing),
            createGuestQr(sealId),
          ];
        })();

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
