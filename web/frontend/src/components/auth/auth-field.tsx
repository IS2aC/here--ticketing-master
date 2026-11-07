"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

// Champ des écrans d'accès (connexion, inscription, mot de passe oublié) : libellé avec pictogramme,
// fond gris clair, et bouton « Afficher » pour les mots de passe. Mêmes props que components/field.tsx.
export function AuthField({
  label,
  name,
  icon,
  error,
  hint,
  type = "text",
  ...input
}: { label: string; name: string; icon?: IconName; error?: string; hint?: ReactNode } & ComponentProps<"input">) {
  const id = `${useId()}${name}`;
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="grid min-w-0 gap-2">
      <label htmlFor={id} className="flex items-center gap-2 text-[14px] font-semibold text-text">
        {icon ? <Icon name={icon} width={17} height={17} /> : null}
        {label}
      </label>
      <div className="relative">
        {icon ? (
          <Icon
            name={icon}
            width={19}
            height={19}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-text-muted"
          />
        ) : null}
        <input
          id={id}
          name={name}
          type={isPassword && visible ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-[54px] w-full min-w-0 rounded-[16px] bg-surface text-[16px] text-text outline-none transition-[background-color,box-shadow] duration-200 placeholder:text-gray-500 focus:bg-background focus:shadow-[inset_0_0_0_2px_var(--color-primary)] ${
            icon ? "pl-12" : "pl-4"
          } ${isPassword ? "pr-13" : "pr-4"} ${error ? "shadow-[inset_0_0_0_1.5px_var(--color-error)]" : ""}`}
          {...input}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={visible}
            aria-controls={id}
            className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Icon name={visible ? "oeil-barre" : "oeil"} width={20} height={20} />
          </button>
        ) : null}
      </div>
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

/** Message d'erreur général d'un formulaire d'accès. */
export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-[16px] bg-red/[0.07] px-4 py-3 text-[14px] text-error">
      <Icon name="alerte" width={18} height={18} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Bouton principal d'un formulaire d'accès, avec flèche et état « en cours ». */
export function AuthSubmit({ pending, children, pendingLabel }: { pending: boolean; children: ReactNode; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className="group inline-flex h-[56px] w-full items-center justify-center gap-2.5 rounded-full bg-primary px-6 font-heading text-[16px] font-semibold text-on-primary shadow-[0_12px_28px_-10px_rgba(225,6,0,0.6)] transition-[background-color,transform,box-shadow] duration-200 hover:bg-primary-hover active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-80"
    >
      {pending ? (
        <>
          <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          {pendingLabel}
        </>
      ) : (
        <>
          {children}
          <Icon
            name="fleche-droite"
            width={19}
            height={19}
            className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </>
      )}
    </button>
  );
}
