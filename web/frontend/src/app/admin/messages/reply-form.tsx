"use client";

import { useActionState } from "react";
import { Icon } from "@/components/icons";
import type { ReplyState } from "../actions";

// Réponse de l'équipe : le champ se vide après l'envoi (nouvelle clé du formulaire).
export function ReplyForm({ action, name }: { action: (state: ReplyState, formData: FormData) => Promise<ReplyState>; name: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form key={state.sent ?? 0} action={formAction} className="grid gap-2">
      <label className="grid gap-1 text-[13px] font-medium text-text-muted">
        Répondre à {name}
        <textarea
          name="body"
          rows={3}
          maxLength={2000}
          required
          placeholder="Bonjour, …"
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
          className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 font-heading text-[14px] font-semibold text-white hover:bg-ink-700 disabled:opacity-60"
        >
          <Icon name="envoyer" width={16} height={16} />
          {pending ? "Envoi…" : "Envoyer la réponse"}
        </button>
      </div>
    </form>
  );
}
