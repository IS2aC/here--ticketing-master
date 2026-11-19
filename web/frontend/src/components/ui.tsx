import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Boutons et champs selon uiux/visual-identity/DESIGN.md (pilule, 52 px, un seul bouton rouge par écran).
const button =
  "inline-flex h-[52px] items-center justify-center gap-2 rounded-full px-6 font-heading text-[15px] font-semibold whitespace-nowrap transition-[background-color,transform] duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted disabled:shadow-none disabled:active:scale-100";

const variants = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  ghost: "bg-background text-text shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface",
  inverse: "bg-inverse text-on-inverse hover:bg-[color-mix(in_srgb,var(--color-inverse)_82%,var(--color-background))]",
};

type Variant = keyof typeof variants;

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${button} ${variants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${button} ${variants[variant]} ${className}`} {...props} />;
}

/** Action indisponible : même gabarit qu'un bouton contour, grisé, non cliquable. `reason` s'affiche au survol et est lu par les lecteurs d'écran. */
export function DisabledButton({ reason, className = "", children }: { reason: string; className?: string; children: ReactNode }) {
  return (
    <span
      role="link"
      aria-disabled="true"
      title={reason}
      className={`${button} cursor-not-allowed bg-surface text-text-muted opacity-70 ${className}`}
    >
      {children}
      <span className="sr-only"> : {reason}</span>
    </span>
  );
}

/** Cellule de tableau sans valeur : vide à l'écran, « non renseigné » pour les lecteurs d'écran. */
export function NotSet() {
  return <span className="sr-only">non renseigné</span>;
}
