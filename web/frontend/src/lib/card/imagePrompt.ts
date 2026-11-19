import type { CardFacts } from "@/creative-engine/host/proposals/charter";
import { eventType, type EventType } from "@/lib/event-types";
import { cardSkill } from "./skills";

// Prompt complet de la génération d'une carte par l'IA (lots D2 et D3) : un pré-prompt propre au type
// d'événement, la demande de l'organisateur, les données de l'événement et, s'il y en a, ses photos.
// L'image est une illustration SANS texte : le moteur pose ensuite les textes de l'événement (noms, date,
// lieu exacts) et le sceau QR, aux places que le prompt réserve.
//
// Hommage (funérailles) : le portrait du défunt n'est jamais envoyé à l'IA. Le moteur le pose tel quel, recadré
// et en noir et blanc, dans un médaillon dont le prompt réserve la place (host/proposals/aiCard.ts).

/** Longueur maximale de la demande de l'organisateur. */
export const MAX_REQUEST_LENGTH = 600;

/** Photos de référence par génération (le fournisseur peut en accepter moins). */
export const MAX_PHOTOS = 4;

/** Longueur de la description de l'événement reprise dans le prompt. */
const MAX_DESCRIPTION = 300;

/** Types où la photo est un portrait posé par le moteur, jamais confié à l'IA. */
export const isTribute = (type: string) => type === "funerailles";

/** Photos acceptées pour un hommage : un seul portrait. */
export const MAX_PORTRAITS = 1;

const LIGHT: Record<NonNullable<CardFacts["moment"]>, string> = {
  matin: "le matin : lumière claire et fraîche",
  "après-midi": "l'après-midi : lumière chaude et dorée",
  soirée: "en soirée : lumières du soir, ambiance nocturne et feutrée",
};

const shorten = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, "")}…`);

/**
 * Direction artistique par type d'événement, de secours : la partie « Illustration » de la fiche du type
 * (skills/<type>.md) la remplace quand elle existe.
 */
export const PREPROMPTS: Record<EventType, string> = {
  mariage:
    "Faire-part de mariage raffiné : romantisme et élégance, matières nobles (dorure, ivoire, satin), fleurs et feuillages délicats, esprit afro-chic contemporain d'Abidjan.",
  dot: "Cérémonie de dot ivoirienne : motifs de pagne wax, kente ou kita, calebasses, perles et bronze, symboles de l'union des deux familles ; couleurs chaudes, élégance traditionnelle et festive.",
  bapteme:
    "Baptême ou présentation d'un enfant : douceur et tendresse, tons pastel, nuages, colombe, petites fleurs, lumière apaisante.",
  funerailles:
    "Funérailles ou hommage à un défunt : sobriété, sérénité et respect ; tons doux, blanc, gris ou noir et blanc, lys, lumière paisible ; rien de festif ni de coloré ; aucun personnage, visage ni silhouette.",
  anniversaire:
    "Anniversaire : joie et fête, ballons, confettis, guirlandes lumineuses, couleurs vives et chaleureuses.",
  brunch: "Brunch convivial : table dressée, fruits tropicaux, fleurs fraîches, lumière douce du matin, ambiance détendue et chic.",
  retrouvailles:
    "Retrouvailles entre amis ou en famille : chaleur, convivialité, nostalgie joyeuse, lumière dorée de fin de journée.",
  reunion: "Réunion professionnelle : sobre, clair et moderne, formes géométriques discrètes, couleurs institutionnelles.",
  seminaire:
    "Séminaire ou conférence : moderne et professionnel, lignes et formes abstraites, sentiment d'innovation, tons bleu nuit et lumière.",
  concert_prive:
    "Concert privé : scène et projecteurs, instruments, halo de lumière, ambiance intime, vibrante et nocturne.",
  festival: "Festival : énergie, couleurs vives, lumières de scène, foule festive en silhouette, esprit d'affiche graphique.",
  autre: "Événement privé : élégant, chaleureux et soigné.",
};

/**
 * `photos` : nombre de photos jointes. Pour un hommage, c'est le portrait posé par le moteur : il n'est pas
 * envoyé, le prompt lui réserve seulement sa place.
 */
export function cardImagePrompt(facts: CardFacts, request: string, photos = 0): string {
  const type = facts.type as EventType;
  const tribute = isTribute(type);
  const place = facts.placeLines.join(", ");
  const context = [place ? `lieu : ${place}` : null, facts.moment ? LIGHT[facts.moment] : null].filter(Boolean);
  const description = facts.description ? shorten(facts.description.replace(/\s+/g, " "), MAX_DESCRIPTION) : null;
  const lines = [
    `Illustration pour une carte d'invitation (${eventType(type).label.toLowerCase()}), format portrait 4:5, haut de gamme, soignée, digne d'un faire-part imprimé.`,
    `Direction artistique : ${cardSkill(type, "Illustration") ?? PREPROMPTS[type] ?? PREPROMPTS.autre}`,
    "La demande, le thème, les couleurs et le cadre donnés ci-dessous passent avant cette direction artistique.",
    `Demande de l'organisateur : ${request.trim()}`,
    facts.theme ? `Thème de l'événement : ${facts.theme}.` : null,
    facts.colors.length > 0 ? `Couleurs dominantes à respecter : ${facts.colors.join(", ")}.` : null,
    facts.dressCode && !/^dress code libre$/i.test(facts.dressCode) ? `Dress code des invités : ${facts.dressCode}.` : null,
    context.length > 0
      ? `Cadre de la cérémonie, pour un décor juste (par exemple une mairie, une église, un jardin, une plage, une salle de réception) : ${context.join(" ; ")}. N'écris pas le nom du lieu.`
      : null,
    description ? `Ce que l'organisateur dit de l'événement : ${description}` : null,
    tribute
      ? photos > 0
        ? "Composition : en haut au centre, un espace uni, doux et sans motif où sera posé ensuite un médaillon avec le portrait du défunt ; ne dessine aucun personnage ni visage. Décor discret sur les bords ; une zone calme, claire et peu détaillée au centre, où seront posés les textes ; le coin inférieur droit dégagé pour un QR code."
        : "Composition : ne dessine aucun personnage ni visage. Décor discret sur les bords et en haut ; une grande zone calme, claire et peu détaillée au centre, où seront posés les textes ; le coin inférieur droit dégagé pour un QR code."
      : photos > 0
        ? `${photos === 1 ? "La photo jointe montre" : `Les ${photos} photos jointes montrent`} les personnes à l'honneur (elles seules font exception à l'absence de personnage) : représente-les fidèlement (visages, carnation, tenues), avec élégance, dans la moitié haute de l'image. La moitié basse reste une zone calme, claire et peu détaillée, où seront posés les textes ; le coin inférieur droit reste dégagé pour un QR code.`
        : "Composition : décor et motifs sur les bords et en haut ; une grande zone calme, claire et peu détaillée au centre, où seront posés les textes ; le coin inférieur droit dégagé pour un QR code.",
  ];
  return lines.filter(Boolean).join("\n");
}
