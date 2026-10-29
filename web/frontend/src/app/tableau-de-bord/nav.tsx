"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

// Maquette « tableau de bord organisateur ». Les écrans sans page pour l'instant sont grisés avec « Bientôt ».
// `anchor` : lien vers une section de la page d'accueil, jamais marqué actif.
const LINKS: { label: string; icon: IconName; href?: string; anchor?: boolean }[] = [
  { label: "Tableau de bord", icon: "statistiques", href: "/tableau-de-bord" },
  { label: "Mes événements", icon: "calendrier", href: "/tableau-de-bord#mes-evenements", anchor: true },
  { label: "Cartes", icon: "invitation", href: "/tableau-de-bord/cartes" },
  { label: "Mes invités", icon: "participants" },
  { label: "Messages", icon: "message" },
  { label: "Statistiques", icon: "courbe" },
];

export function Nav() {
  const pathname = usePathname();
  // « Tableau de bord » reste actif dans les pages d'un événement.
  return (
    <NavLinks
      active={LINKS.findLast((l) => l.href && !l.anchor && (pathname === l.href || pathname.startsWith(`${l.href}/`)))?.href}
    />
  );
}

/** Sans lien actif : affiché le temps que l'adresse soit connue (dans <Suspense>). */
export function NavLinks({ active }: { active?: string }) {
  return (
    <nav className="grid gap-1" aria-label="Navigation principale">
      {LINKS.map((l) => {
        if (!l.href) {
          return (
            <span key={l.label} aria-disabled="true" className="flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-text-muted">
              <Icon name={l.icon} />
              {l.label}
              <span className="ml-auto rounded-sm bg-surface px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] uppercase">Bientôt</span>
            </span>
          );
        }
        const on = l.href === active;
        return (
          <Link
            key={l.label}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] ${
              on
                ? "bg-surface font-semibold text-text shadow-[inset_3px_0_0_var(--color-primary)]"
                : "font-medium text-text-muted hover:bg-surface hover:text-text"
            }`}
          >
            <Icon name={l.icon} className={on ? "text-primary" : undefined} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
