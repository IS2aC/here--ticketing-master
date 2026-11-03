import type { CardFacts } from "@/creative-engine/host/proposals/charter";
import { eventType, type EventType } from "@/lib/event-types";

// Prompt complet de la génération d'une carte par l'IA (lots D2 et D3) : un pré-prompt propre au type
// d'événement, la demande de l'organisateur, les données de l'événement et, s'il y en a, ses photos.
// L'image est une illustration SANS texte : le moteur pose ensuite les textes de l'événement (noms, date,
// lieu exacts) et le sceau QR, aux places que le prompt réserve.

/** Longueur maximale de la demande de l'organisateur. */
export const MAX_REQUEST_LENGTH = 600;

/** Photos de référence par génération (le fournisseur peut en accepter moins). */
export const MAX_PHOTOS = 4;

/** Direction artistique par type d'événement : ce qui fait une belle carte de ce type, à Abidjan. */
export const PREPROMPTS: Record<EventType, string> = {
  mariage:
    "Faire-part de mariage raffiné : romantisme et élégance, matières nobles (dorure, ivoire, satin), fleurs et feuillages délicats, esprit afro-chic contemporain d'Abidjan.",
  dot: "Cérémonie de dot ivoirienne : motifs de pagne wax, kente ou kita, calebasses, perles et bronze, symboles de l'union des deux familles ; couleurs chaudes, élégance traditionnelle et festive.",
  bapteme:
    "Baptême ou présentation d'un enfant : douceur et tendresse, tons pastel, nuages, colombe, petites fleurs, lumière apaisante.",
  funerailles:
    "Funérailles ou hommage à un défunt : sobriété, sérénité et respect ; tons doux, blanc, gris ou noir et blanc, lys, lumière paisible ; rien de festif ni de coloré.",
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

export function cardImagePrompt(facts: CardFacts, request: string, photos = 0): string {
  const type = facts.type as EventType;
  const lines = [
    `Illustration pour une carte d'invitation (${eventType(type).label.toLowerCase()}), format portrait 4:5, haut de gamme, soignée, digne d'un faire-part imprimé.`,
    `Direction artistique : ${PREPROMPTS[type] ?? PREPROMPTS.autre}`,
    `Demande de l'organisateur : ${request.trim()}`,
    facts.theme ? `Thème de l'événement : ${facts.theme}.` : null,
    facts.colors.length > 0 ? `Couleurs dominantes à respecter : ${facts.colors.join(", ")}.` : null,
    facts.dressCode && !/^dress code libre$/i.test(facts.dressCode) ? `Dress code des invités : ${facts.dressCode}.` : null,
    photos > 0
      ? `${photos === 1 ? "La photo jointe montre" : `Les ${photos} photos jointes montrent`} les personnes à l'honneur : représente-les fidèlement (visages, carnation, tenues), avec élégance, dans la moitié haute de l'image. La moitié basse reste une zone calme, claire et peu détaillée, où seront posés les textes ; le coin inférieur droit reste dégagé pour un QR code.`
      : "Composition : décor et motifs sur les bords et en haut ; une grande zone calme, claire et peu détaillée au centre, où seront posés les textes ; le coin inférieur droit dégagé pour un QR code.",
  ];
  return lines.filter(Boolean).join("\n");
}
