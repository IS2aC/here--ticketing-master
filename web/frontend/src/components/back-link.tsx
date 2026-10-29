import Link from "next/link";
import { Icon } from "./icons";

// Lien de retour, le même partout : rouge, bien visible en haut de la page, au-dessus du titre.
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-2 inline-flex items-center gap-1.5 rounded-sm text-[14px] whitespace-nowrap font-semibold text-accent-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Icon name="fleche-droite" width={16} height={16} className="rotate-180" />
      {label}
    </Link>
  );
}

// Étapes d'un événement (carte, import, relances…) : retour vers la page de l'événement.
export function BackToEvent({ eventId }: { eventId: string }) {
  return <BackLink href={`/tableau-de-bord/evenements/${eventId}`} label="Retour à l'événement" />;
}

// Page d'un événement, création, cartes, profil : retour vers le tableau de bord.
export function BackToDashboard() {
  return <BackLink href="/tableau-de-bord" label="Retour au tableau de bord" />;
}
