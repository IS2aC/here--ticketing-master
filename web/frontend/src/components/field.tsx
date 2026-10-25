"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

export function Field({
  label,
  name,
  error,
  hint,
  ...input
}: { label: string; name: string; error?: string; hint?: ReactNode } & ComponentProps<"input">) {
  // Identifiant unique : Next.js garde les pages visitées dans le DOM (masquées), les id ne doivent pas se répéter.
  const id = `${useId()}${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium tracking-[0.02em] text-text-muted">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-[52px] w-full min-w-0 rounded-md bg-background px-4 text-[16px] text-text outline-none placeholder:text-gray-500 focus:shadow-[inset_0_0_0_2px_var(--color-primary)] ${
          error ? "shadow-[inset_0_0_0_1.5px_var(--color-error)]" : "shadow-[inset_0_0_0_1px_var(--color-border)]"
        }`}
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
