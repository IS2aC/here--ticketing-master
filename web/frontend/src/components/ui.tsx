import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

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

export function Field({
  label,
  name,
  error,
  hint,
  ...input
}: { label: string; name: string; error?: string; hint?: ReactNode } & ComponentProps<"input">) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={name} className="text-[13px] font-medium tracking-[0.02em] text-text-muted">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-[52px] w-full min-w-0 rounded-md bg-background px-4 text-[16px] text-text outline-none placeholder:text-gray-500 focus:shadow-[inset_0_0_0_2px_var(--color-primary)] ${
          error ? "shadow-[inset_0_0_0_1.5px_var(--color-error)]" : "shadow-[inset_0_0_0_1px_var(--color-border)]"
        }`}
        {...input}
      />
      {error ? (
        <p id={`${name}-error`} className="text-[13px] text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="text-[13px] text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
