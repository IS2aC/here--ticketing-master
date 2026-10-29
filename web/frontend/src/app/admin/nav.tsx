"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

// Les écrans sans page pour l'instant sont affichés, grisés, avec « Bientôt » (jamais de lien mort).
const LINKS: { label: string; icon: IconName; href?: string }[] = [
  { label: "Tableau de bord", icon: "statistiques", href: "/admin" },
  { label: "Utilisateurs", icon: "profil", href: "/admin/utilisateurs" },
  { label: "Événements", icon: "calendrier", href: "/admin/evenements" },
  { label: "Messages", icon: "envoyer" },
  { label: "Cartes", icon: "invitation" },
  { label: "Réglages", icon: "parametres", href: "/admin/reglages" },
];

export function AdminNav() {
  const pathname = usePathname();
  return <AdminNavLinks active={LINKS.findLast((l) => l.href && (pathname === l.href || pathname.startsWith(`${l.href}/`)))?.href} />;
}

/** Sans lien actif : affiché le temps que l'adresse soit connue (dans <Suspense>). */
export function AdminNavLinks({ active }: { active?: string }) {
  return (
    <nav className="grid gap-1.5" aria-label="Navigation du portail admin">
      {LINKS.map((l) => {
        if (!l.href) {
          return (
            <span key={l.label} aria-disabled="true" className="flex h-10 items-center gap-3.5 rounded-xl px-4 text-[14px] font-medium text-text-muted">
              <Icon name={l.icon} width={18} height={18} />
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
            className={`flex h-10 items-center gap-3.5 rounded-xl px-4 text-[14px] ${
              on ? "bg-surface font-semibold text-text" : "font-medium text-text-muted hover:bg-surface hover:text-text"
            }`}
          >
            <Icon name={l.icon} width={18} height={18} className={on ? "text-primary" : undefined} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
