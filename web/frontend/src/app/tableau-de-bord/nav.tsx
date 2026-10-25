"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/tableau-de-bord", label: "Tableau de bord", icon: "statistiques" },
  { href: "/tableau-de-bord/cartes", label: "Cartes", icon: "invitation" },
];

export function Nav() {
  const pathname = usePathname();
  // « Tableau de bord » reste actif dans les pages d'un événement.
  return <NavLinks active={LINKS.findLast((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))?.href} />;
}

/** Sans lien actif : affiché le temps que l'adresse soit connue (dans <Suspense>). */
export function NavLinks({ active }: { active?: string }) {
  return (
    <nav className="grid gap-0.5" aria-label="Navigation principale">
      {LINKS.map((l) => {
        const on = l.href === active;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={`flex h-10 items-center gap-3 rounded-md px-3 text-[14px] ${
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
