import type { CardFacts } from "@/creative-engine/host/proposals/charter";
import { eventType, type EventType } from "@/lib/event-types";

// Prompt complet de la génération d'une carte par l'IA (lot D2) : la demande de l'organisateur, enrichie des
// données de l'événement et des contraintes de mise en page de Here!. L'image est une illustration SANS texte :
// le moteur pose ensuite les textes de l'événement (noms, date, lieu exacts) et le sceau QR.

/** Longueur maximale de la demande de l'organisateur. */
export const MAX_REQUEST_LENGTH = 600;

export function cardImagePrompt(facts: CardFacts, request: string): string {
  const type = eventType(facts.type as EventType).label.toLowerCase();
  const lines = [
    `Illustration de fond pour une carte d'invitation (${type}), format portrait 4:5, qualité d'impression, élégante et soignée.`,
    `Demande de l'organisateur : ${request.trim()}`,
    facts.theme ? `Thème de l'événement : ${facts.theme}.` : null,
    facts.colors.length > 0 ? `Couleurs dominantes à respecter : ${facts.colors.join(", ")}.` : null,
    facts.dressCode && !/^dress code libre$/i.test(facts.dressCode) ? `Dress code des invités : ${facts.dressCode}.` : null,
    "Composition : décor et motifs sur les bords et en haut ; une grande zone calme, claire et peu détaillée au centre, où seront posés les textes ; le coin inférieur droit dégagé pour un QR code.",
  ];
  return lines.filter(Boolean).join("\n");
}
