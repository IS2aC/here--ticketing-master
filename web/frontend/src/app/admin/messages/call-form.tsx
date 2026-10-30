"use client";

import { useActionState } from "react";
import { Icon, type IconName } from "@/components/icons";
import type { CallState } from "../actions";

// Résultat de l'appel : statut = pictogramme + mot + couleur (DESIGN.md).
const OUTCOMES: { value: string; label: string; icon: IconName; tone: string }[] = [
  { value: "confirmed", label: "Confirmé", icon: "valide", tone: "has-[:checked]:text-status-confirmed has-[:checked]:shadow-[inset_0_0_0_1.5px_var(--color-status-confirmed)]" },
  { value: "declined", label: "Décliné", icon: "decline", tone: "has-[:checked]:text-status-declined has-[:checked]:shadow-[inset_0_0_0_1.5px_var(--color-status-declined)]" },
  { value: "no_answer", label: "Pas de réponse", icon: "horloge", tone: "has-[:checked]:text-status-pending has-[:checked]:shadow-[inset_0_0_0_1.5px_var(--color-status-pending)]" },
  { value: "wrong_number", label: "Mauvais numéro", icon: "alerte", tone: "has-[:checked]:text-status-unreachable has-[:checked]:shadow-[inset_0_0_0_1.5px_var(--color-status-unreachable)]" },
];

export function CallForm({ action, name }: { action: (state: CallState, formData: FormData) => Promise<CallState>; name: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-3">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 text-[13px] font-medium text-text-muted">Résultat de l&apos;appel à {name}</legend>
        {OUTCOMES.map((o) => (
          <label
            key={o.value}
            className={`inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-text-muted shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface ${o.tone}`}
          >
            <input type="radio" name="outcome" value={o.value} className="sr-only" />
            <Icon name={o.icon} width={16} height={16} />
            {o.label}
          </label>
        ))}
      </fieldset>
      <label className="grid gap-1 text-[13px] font-medium text-text-muted">
        Note (facultatif)
        <textarea
          name="notes"
          rows={2}
          maxLength={500}
          placeholder="Viendra avec son épouse ; rappeler demain…"
          className="rounded-xl bg-background px-3 py-2 text-[14px] text-text shadow-[inset_0_0_0_1px_var(--color-border)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-primary)]"
        />
      </label>
      {state.message ? (
        <p role="alert" className="text-[13px] text-error">
          {state.message}
        </p>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-full px-4 font-heading text-[14px] font-semibold shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface disabled:opacity-60"
        >
          <Icon name="valide" width={16} height={16} />
          {pending ? "Enregistrement…" : "Enregistrer le résultat"}
        </button>
      </div>
    </form>
  );
}
