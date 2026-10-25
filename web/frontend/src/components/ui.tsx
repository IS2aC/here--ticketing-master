import Link from "next/link";
import type { ComponentProps } from "react";

// Boutons et champs selon uiux/visual-identity/DESIGN.md (pilule, 52 px, un seul bouton rouge par écran).
const button =
  "inline-flex h-[52px] items-center justify-center gap-2 rounded-full px-6 font-heading text-[15px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted disabled:shadow-none";

const variants = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  ghost: "bg-background text-text shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface",
  inverse: "bg-inverse text-on-inverse",
};

type Variant = keyof typeof variants;

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${button} ${variants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${button} ${variants[variant]} ${className}`} {...props} />;
}
