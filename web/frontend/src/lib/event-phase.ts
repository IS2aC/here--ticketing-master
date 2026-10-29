import type { EventOut } from "./events";

// Moment d'un événement, le même partout (tableau de bord, page de l'événement) :
// statut de la base, puis date pour les événements actifs.
export type Phase = "upcoming" | "live" | "done" | "draft" | "cancelled";

export const PHASE_LABELS: Record<Phase, string> = {
  live: "En cours",
  upcoming: "À venir",
  done: "Terminé",
  draft: "Brouillon",
  cancelled: "Annulé",
};

/** Fin : début + durée, sinon fin de la journée (heure d'Abidjan = UTC). */
export function phaseOf(event: Pick<EventOut, "status" | "starts_at" | "duration_minutes">, now: number): Phase {
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "draft") return "draft";
  if (event.status === "done") return "done";
  const start = Date.parse(event.starts_at);
  const end = event.duration_minutes ? start + event.duration_minutes * 60_000 : new Date(start).setUTCHours(24, 0, 0, 0);
  return now < start ? "upcoming" : now < end ? "live" : "done";
}
