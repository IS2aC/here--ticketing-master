import Link from "next/link";
import { Icon } from "./icons";

// Retour vers la page de l'événement, bien visible en haut des étapes (carte, import, relances…).
export function BackToEvent({ eventId }: { eventId: string }) {
  return (
    <Link
      href={`/tableau-de-bord/evenements/${eventId}`}
      className="mb-2 inline-flex items-center gap-1.5 rounded-sm text-[14px] font-semibold text-accent-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Icon name="fleche-droite" width={16} height={16} className="rotate-180" />
      Retour à l&apos;événement
    </Link>
  );
}
