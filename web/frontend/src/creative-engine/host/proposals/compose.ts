import type { CreativeDocument } from "../../domain/document/types.ts";
import type { Element, FontWeight, HexColor, TextElement } from "../../domain/elements/types.ts";
import { loadDocument } from "../../domain/schema/validate.ts";
import { instantiateTemplate } from "../../domain/templates/instantiate.ts";
import { fittedFontSize } from "../../editor/actions.ts";
import { backgroundBehind, readableColor, targetContrast } from "../../editor/colors.ts";
import { closestWeight, fontOption } from "../../editor/fontCatalog.ts";
import { prepareFont } from "../../editor/textMeasure.ts";
import { TEMPLATE_DOCUMENTS } from "../../library/bundled/templateDocuments.ts";
import { createGuestName, createGuestTable, GUEST_FONTS, toTextLayout, type GuestSample } from "../guestFields.ts";
import type { CardFacts, Charter, Composition } from "./charter.ts";

// Composition d'une carte à partir d'une charte : le modèle choisi garde sa mise en page (et la place du nom,
// de la table et du sceau) ; ses textes, couleurs, polices et la teinte de ses ornements suivent la charte.
// Les faits (date, lieu, tenue) viennent de Here!. Les textes sont réduits pour tenir dans leur zone, puis
// chaque couleur de texte est rendue lisible sur ce qu'il y a derrière.

type Role =
  | "kicker"
  | "title"
  | "tagline"
  | "date"
  | "place"
  | "datePlace"
  | "closing"
  | "dressOrClosing"
  | "dress"
  | "guestLabel"
  | "pillText"
  | "line"
  | "accent"
  | "pill"
  | "panel"
  | "remove";

/** Rôle de chaque élément des modèles, par son nom. Les images sont des ornements. */
const ROLES: Record<Composition, Record<string, Role>> = {
  "mariage-feuillage-dore": {
    Annonce: "kicker",
    Prénoms: "title",
    Filet: "line",
    Date: "date",
    Lieux: "place",
    Invitation: "guestLabel",
    Réponse: "closing",
  },
  "dot-motifs-wax": {
    Annonce: "kicker",
    Prénoms: "title",
    Filet: "line",
    Date: "date",
    Lieu: "place",
    Invitation: "guestLabel",
    Tenue: "dressOrClosing",
  },
  "anniversaire-confettis": {
    Annonce: "kicker",
    Âge: "title",
    "Date et lieu": "datePlace",
    Invitation: "guestLabel",
    Pastille: "pill",
    "Dress code": "dress",
  },
  "bapteme-douceur": {
    Annonce: "kicker",
    Prénom: "title",
    Date: "date",
    Lieu: "place",
    Invitation: "guestLabel",
    Signature: "closing",
  },
  "seminaire-ondes": {
    Surtitre: "kicker",
    Titre: "title",
    Accent: "accent",
    Date: "date",
    Lieu: "place",
    Encadré: "panel",
    Invitation: "guestLabel",
    "Programme — titre": "remove",
    Programme: "remove",
    Inscription: "closing",
  },
  "festival-nuit-couleurs": {
    Surtitre: "kicker",
    Titre: "title",
    Programme: "tagline",
    Pastille: "pill",
    Date: "pillText",
    Lieu: "place",
    Invitation: "guestLabel",
    Accès: "closing",
  },
};

/** Modèle de la composition, avec de nouveaux identifiants. */
export async function loadComposition(composition: Composition): Promise<CreativeDocument> {
  const load = TEMPLATE_DOCUMENTS[`./templates/${composition}.json`];
  if (!load) throw new Error(`Composition inconnue : ${composition}`);
  const result = loadDocument(await load());
  if (result.status !== "ok") throw new Error(`Composition invalide : ${composition}`);
  return instantiateTemplate(result.document, { origin: { id: composition, version: 2 } });
}

const SCRIPTS = new Set(["Great Vibes", "Pinyon Script"]);

/** Polices d'une charte, chargées : la mesure des textes en dépend. */
export async function prepareCharterFonts(charter: Charter): Promise<void> {
  const { title, text, guest } = charter.fonts;
  const styles = [title, text, guest].flatMap((fontFamily) =>
    (fontOption(fontFamily)?.weights ?? [400]).map((fontWeight) => ({ fontFamily, fontWeight, fontStyle: "normal" as const })),
  );
  const italics = [title, text].flatMap((fontFamily) =>
    (fontOption(fontFamily)?.italicWeights ?? []).map((fontWeight) => ({ fontFamily, fontWeight, fontStyle: "italic" as const })),
  );
  await Promise.all([...styles, ...italics].map(prepareFont));
}

function styled(element: TextElement, family: string, color: HexColor): TextElement {
  const weight = closestWeight(family, element.style.fontWeight as FontWeight);
  const italic = element.style.fontStyle === "italic" && (fontOption(family)?.italicWeights ?? []).includes(weight);
  const script = SCRIPTS.has(family);
  return {
    ...element,
    style: {
      ...element.style,
      fontFamily: family,
      fontWeight: weight,
      fontStyle: italic ? "italic" : "normal",
      color,
      // Une calligraphie ne s'écrit ni en capitales ni espacée.
      ...(script ? { textTransform: "none" as const, letterSpacing: 0 } : {}),
    },
  };
}

/**
 * Le texte dans sa zone : pas plus de lignes que le modèle n'en prévoit (les suivantes sont jointes),
 * taille réduite s'il ne tient pas sur la largeur, centre vertical conservé.
 */
function withContent(element: TextElement, content: string): TextElement {
  const allowed = Math.max(1, element.content.split("\n").length);
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  // « & Koffi » se joint par une espace ; les autres lignes (lieu, adresse) par une virgule.
  const join = (rest: string[]) => rest.reduce((all, next) => (next.startsWith("&") ? `${all} ${next}` : `${all}, ${next}`));
  const kept = lines.length > allowed ? [...lines.slice(0, allowed - 1), join(lines.slice(allowed - 1))] : lines;
  const text = { ...element, content: kept.join("\n") };
  const size = Math.min(element.style.fontSize, fittedFontSize(text, 12, element.style.fontSize));
  const height = Math.round(kept.length * size * element.style.lineHeight * 100) / 100;
  const center = element.y + element.height / 2;
  return { ...text, y: Math.round((center - height / 2) * 100) / 100, height, style: { ...text.style, fontSize: size } };
}

function guestField(element: TextElement, charter: Charter, sample: GuestSample): TextElement {
  const layout = toTextLayout(element);
  if (element.slot === "guest-table") {
    const table = createGuestTable(sample, { ...layout, color: charter.palette.text, font: "sans", bold: false });
    return { ...table, id: element.id };
  }
  const family = charter.fonts.guest;
  const wasScript = element.style.fontFamily === "Great Vibes";
  const isScript = family === "Great Vibes";
  // La calligraphie paraît plus petite à taille égale.
  const size = Math.round(layout.size * (isScript === wasScript ? 1 : isScript ? 1.12 : 1 / 1.12));
  const name = createGuestName(sample, {
    ...layout,
    size,
    color: charter.palette.title,
    font: GUEST_FONTS[family],
    bold: !isScript,
  });
  return { ...name, id: element.id };
}

/** Carte composée : modèle `template` (déjà instancié), habillé selon la charte, avec les faits de l'événement. */
export function composeCard(
  template: CreativeDocument,
  charter: Charter,
  facts: CardFacts,
  sample: GuestSample,
): CreativeDocument {
  const { palette, fonts, texts } = charter;
  const roles = ROLES[charter.composition];
  const placeText = facts.placeLines.join("\n");
  const dress = facts.dressCode ? `Tenue : ${facts.dressCode}` : "";
  const closingFamily = SCRIPTS.has(fonts.title) || fonts.title === "Bebas Neue" ? fonts.text : fonts.title;
  const pillInk = readableColor(palette.background as HexColor, palette.accent as HexColor);

  const text = (element: TextElement, content: string, family: string, color: string): TextElement | null =>
    content.trim() ? withContent(styled(element, family, color as HexColor), content) : null;

  const elements: Element[] = [];
  for (const element of template.elements) {
    if (element.type === "text" && element.slot) {
      elements.push(guestField(element, charter, sample));
      continue;
    }
    if (element.type === "image") {
      const asset = template.assets[element.assetId];
      const ornament = !element.slot && asset?.mimeType === "image/svg+xml";
      elements.push(ornament ? { ...element, tint: charter.ornamentTint as HexColor | null } : element);
      continue;
    }
    const role = element.name ? roles[element.name] : undefined;
    let next: Element | null = element;
    if (element.type === "shape") {
      if (role === "line" && element.stroke) next = { ...element, stroke: { ...element.stroke, color: palette.accent as HexColor } };
      else if (role === "accent" || role === "pill") next = { ...element, fill: palette.accent as HexColor };
      else if (role === "panel") next = { ...element, fill: palette.surface as HexColor };
      if (role === "pill" && charter.composition === "anniversaire-confettis" && !dress) next = null;
    } else if (element.type === "text") {
      switch (role) {
        case "kicker":
          next = text(element, texts.kicker, fonts.text, palette.accent);
          break;
        case "title":
          next = text(element, texts.title, fonts.title, palette.title);
          break;
        case "tagline":
          next = text(element, texts.tagline, fonts.text, palette.text);
          break;
        case "date":
          next = text(element, facts.dateLine, fonts.text, palette.text);
          break;
        case "place":
          next = text(element, placeText, fonts.text, palette.text);
          break;
        case "datePlace":
          next = text(element, [facts.dateLine, facts.placeLines[0] ?? ""].join("\n"), fonts.text, palette.text);
          break;
        case "closing":
          next = text(element, texts.closing, closingFamily, palette.accent);
          break;
        case "dressOrClosing":
          next = text(element, dress || texts.closing, closingFamily, palette.accent);
          break;
        case "dress":
          next = text(element, dress, fonts.text, pillInk);
          break;
        case "pillText":
          next = text(element, facts.dateLine, fonts.text, pillInk);
          break;
        case "guestLabel":
          next = text(element, texts.guestLabel, fonts.text, palette.accent);
          break;
        case "remove":
          next = null;
          break;
        default:
          next = styled(element, fonts.text, palette.text as HexColor);
      }
    }
    if (next) elements.push(next);
  }

  const composed: CreativeDocument = {
    ...template,
    meta: { ...template.meta, title: charter.name },
    page: { ...template.page, background: { type: "solid", color: palette.background as HexColor } },
    elements,
  };
  // Dernière passe : chaque texte lisible sur ce qu'il y a derrière lui (fond, pastille, encadré).
  return {
    ...composed,
    elements: composed.elements.map((element) => {
      if (element.type !== "text") return element;
      const behind = backgroundBehind(composed, element) ?? composed.page.background.color;
      const color = readableColor(element.style.color, behind, targetContrast(element));
      return color === element.style.color ? element : { ...element, style: { ...element.style, color } };
    }),
  };
}
