import { PAGE_PRESETS } from "../domain/document/presets.ts";
import type { CreativeDocument } from "../domain/document/types.ts";
import type { TextElement } from "../domain/elements/types.ts";

// Pré-prompt d'une carte complète (décision de l'utilisateur, 01/11/2026) : l'IA dessine la carte entière, textes
// compris, à partir de ce que la carte ouverte contient déjà — chaque texte (et son rôle quand le calque est nommé),
// sa police, ses couleurs, le format et le fond. Notre code ajoutera ensuite le QR code et le message de l'invité
// dans la zone laissée libre. Les informations de l'événement fournies par Here! s'ajouteront à l'intégration.

/** Types d'événements (codes de Here!, ceux des modèles du catalogue). */
export const EVENT_TYPES = {
  mariage: "Mariage",
  dot: "Dot / mariage coutumier",
  bapteme: "Baptême",
  anniversaire: "Anniversaire",
  seminaire: "Séminaire / conférence",
  reunion: "Réunion professionnelle",
  festival: "Soirée / festival",
  autre: "Autre événement",
} as const;
export type EventType = keyof typeof EVENT_TYPES;

/**
 * Informations de l'événement saisies par l'utilisateur (Here! les fournira à l'intégration). Toutes facultatives ;
 * dès qu'un texte est renseigné, ce sont elles — et non les textes posés sur la carte — que l'IA écrit.
 */
export interface EventInfo {
  readonly type: EventType | null;
  /** Prénoms des mariés, de l'enfant, de la personne fêtée… ou titre de l'événement. */
  readonly hosts: string;
  /** Formule d'invitation (« vous invitent à célébrer leur union »). */
  readonly invitation: string;
  readonly date: string;
  readonly time: string;
  readonly place: string;
  /** Mention complémentaire : réponse attendue, tenue, programme… */
  readonly note: string;
}

export const EMPTY_EVENT: EventInfo = {
  type: null,
  hosts: "",
  invitation: "",
  date: "",
  time: "",
  place: "",
  note: "",
};

export function hasEventTexts(event: EventInfo | undefined): event is EventInfo {
  return (
    !!event &&
    [event.hosts, event.invitation, event.date, event.time, event.place, event.note].some(
      (v) => v.trim() !== "",
    )
  );
}

export interface CardPromptOptions {
  /** Informations de l'événement : prioritaires sur les textes de la carte quand elles sont renseignées. */
  readonly event?: EventInfo;
  /** Ambiance ou consignes de style saisies par l'utilisateur (facultatif). */
  readonly style?: string;
  /** Laisse libre une zone pour le QR code d'invitation et le message personnalisé de l'invité. */
  readonly reserveGuestZone?: boolean;
}

/** Un texte de la carte, tel qu'il sera demandé à l'IA. */
export interface CardText {
  readonly role: string | null;
  readonly content: string;
  readonly font: string;
  readonly size: "grand" | "moyen" | "petit";
  readonly color: string;
}

const WEIGHTS: Readonly<Record<number, string>> = {
  300: "light",
  400: "regular",
  500: "medium",
  600: "semibold",
  700: "bold",
  800: "extrabold",
};

function fontLabel(element: TextElement): string {
  const { fontFamily, fontWeight, fontStyle } = element.style;
  return `${fontFamily} ${WEIGHTS[fontWeight] ?? fontWeight}${fontStyle === "italic" ? " italique" : ""}`;
}

/** Textes visibles et non vides, de haut en bas, avec une taille relative (les plus grands = titres). */
export function cardTexts(document: CreativeDocument): CardText[] {
  const texts = document.elements
    .filter((e): e is TextElement => e.type === "text" && !e.hidden && e.content.trim() !== "")
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const largest = Math.max(...texts.map((t) => t.style.fontSize), 1);
  return texts.map((t) => {
    const ratio = t.style.fontSize / largest;
    const content = t.style.textTransform === "uppercase" ? t.content.toLocaleUpperCase("fr") : t.content;
    return {
      role: t.name?.trim() || null,
      content: content.replace(/\s*\n\s*/g, " / "),
      font: fontLabel(t),
      size: ratio > 0.6 ? "grand" : ratio > 0.3 ? "moyen" : "petit",
      color: t.style.color.slice(0, 7).toUpperCase(),
    };
  });
}

function formatLabel(document: CreativeDocument): string {
  const { width, height, preset } = document.page;
  const shape = width === height ? "carré" : width < height ? "portrait" : "paysage";
  const name = preset === "custom" ? null : PAGE_PRESETS[preset].label;
  return `${name ? `${name}, ` : ""}${shape} (${width} × ${height})`;
}

/** Police d'un rôle : celle du plus grand texte de la carte (titre), sinon celle du texte courant le plus fréquent. */
function cardFonts(document: CreativeDocument): { title: string; body: string } {
  const texts = document.elements.filter((e): e is TextElement => e.type === "text" && !e.hidden);
  const largest = [...texts].sort((a, b) => b.style.fontSize - a.style.fontSize)[0];
  const counts = new Map<string, number>();
  for (const t of texts) if (t !== largest) counts.set(fontLabel(t), (counts.get(fontLabel(t)) ?? 0) + 1);
  const body = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const title = largest ? fontLabel(largest) : "Playfair Display semibold";
  return { title, body: body ?? (largest ? title : "Poppins regular") };
}

/** Textes de l'événement, dans l'ordre d'une invitation, avec les polices de la carte. */
export function eventTexts(document: CreativeDocument, event: EventInfo): CardText[] {
  const fonts = cardFonts(document);
  const when = [event.date.trim(), event.time.trim()].filter(Boolean).join(" à ");
  const entries: [string, string, CardText["size"], string][] = [
    [
      event.type === "seminaire" || event.type === "reunion" ? "Titre" : "Prénoms",
      event.hosts,
      "grand",
      fonts.title,
    ],
    ["Formule d'invitation", event.invitation, "moyen", fonts.body],
    ["Date et heure", when, "moyen", fonts.body],
    ["Lieu", event.place, "moyen", fonts.body],
    ["Mention", event.note, "petit", fonts.body],
  ];
  return entries
    .filter(([, content]) => content.trim() !== "")
    .map(([role, content, size, font]) => ({
      role,
      content: content.trim().replace(/\s*\n\s*/g, " / "),
      font,
      size,
      color: "",
    }));
}

/** Textes que l'IA écrira : ceux de l'événement s'ils sont renseignés, sinon ceux posés sur la carte. */
export function promptTexts(document: CreativeDocument, event?: EventInfo): CardText[] {
  return hasEventTexts(event) ? eventTexts(document, event) : cardTexts(document);
}

/** Consigne complète envoyée au fournisseur, en français (les modèles d'image récents la comprennent). */
export function buildCardPrompt(document: CreativeDocument, options: CardPromptOptions = {}): string {
  const texts = promptTexts(document, options.event);
  const lines: string[] = [
    "Crée une carte d'invitation événementielle complète, prête à envoyer, au design soigné et professionnel.",
    `Format : ${formatLabel(document)}. Couleur de fond dominante : ${document.page.background.color.slice(0, 7).toUpperCase()}.`,
  ];
  const type = options.event?.type;
  if (type)
    lines.push(
      `Type d'événement : ${EVENT_TYPES[type].toLowerCase()} (choisis un décor et une ambiance adaptés).`,
    );
  if (texts.length > 0) {
    lines.push(
      "Textes à écrire sur la carte, exactement comme indiqué (orthographe, accents, majuscules et ponctuation à respecter à la lettre, aucun autre texte) :",
      ...texts.map(
        (t, i) =>
          `${i + 1}. ${t.role ? `${t.role} : ` : ""}« ${t.content} » — police ${t.font}, taille ${t.size}${t.color ? `, couleur ${t.color}` : ""}`,
      ),
      "Respecte cet ordre de haut en bas et la hiérarchie des tailles.",
    );
  } else {
    lines.push("La carte ne contient aucun texte : n'écris aucun texte.");
  }
  const style = options.style?.trim();
  if (style) lines.push(`Ambiance et style souhaités : ${style}`);
  if (options.reserveGuestZone ?? true)
    lines.push(
      "Laisse en bas de la carte une zone vide et unie, d'environ un cinquième de la hauteur, sans texte ni motif chargé : un QR code d'invitation et le nom de l'invité y seront ajoutés ensuite.",
    );
  lines.push(
    "Aucun texte en dehors de ceux listés, pas de filigrane, pas de bordure blanche autour de la carte.",
  );
  return lines.join("\n");
}
