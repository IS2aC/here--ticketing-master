"use client";

import { useActionState, useState } from "react";
import type { ResponseState } from "./actions";

type Action = (state: ResponseState, formData: FormData) => Promise<ResponseState>;

// Page invité : textes en 17 px minimum, boutons de 56 px (DESIGN.md, « l'invité a peut-être 70 ans »).
const big =
  "flex h-14 w-full items-center justify-center rounded-full px-6 font-heading text-[17px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60";

function Error({ state }: { state: ResponseState }) {
  return state.message ? (
    <p role="alert" className="rounded-md bg-surface px-4 py-3 text-[17px] text-error">
      {state.message}
    </p>
  ) : null;
}

export function Question({ action, seats, plural }: { action: Action; seats: number; plural: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [count, setCount] = useState(seats);
  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="seats" value={count} />
      <button type="submit" name="attending" value="oui" disabled={pending} className={`${big} bg-primary text-on-primary hover:bg-primary-hover`}>
        {plural ? "Oui, nous serons là" : "Oui, je serai là"}
      </button>
      <button type="submit" name="attending" value="non" disabled={pending} className={`${big} bg-background text-text shadow-[inset_0_0_0_1.5px_var(--color-border)]`}>
        {plural ? "Non, nous ne pourrons pas venir" : "Non, je ne pourrai pas venir"}
      </button>
      {seats > 1 ? (
        <div className="flex items-center justify-between gap-4 rounded-lg bg-surface px-5 py-4">
          <p className="text-[17px]">
            Personnes
            <span className="block text-text-muted">
              Votre invitation compte {seats} places
            </span>
          </p>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Une personne de moins" disabled={count <= 1} onClick={() => setCount(count - 1)} className="flex size-12 items-center justify-center rounded-full bg-background text-[22px] font-semibold shadow-[inset_0_0_0_1.5px_var(--color-border)] disabled:opacity-40">
              −
            </button>
            <span className="w-8 text-center font-data text-[22px] font-semibold tabular-nums" aria-live="polite">
              {count}
            </span>
            <button type="button" aria-label="Une personne de plus" disabled={count >= seats} onClick={() => setCount(count + 1)} className="flex size-12 items-center justify-center rounded-full bg-background text-[22px] font-semibold shadow-[inset_0_0_0_1.5px_var(--color-border)] disabled:opacity-40">
              +
            </button>
          </div>
        </div>
      ) : null}
      <Error state={state} />
    </form>
  );
}

export function DeclinedForm({ action, label, placeholder }: { action: Action; label: string; placeholder: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-4">
        <input type="hidden" name="attending" value="non" />
        <label className="grid gap-2 rounded-lg bg-surface p-5 text-[17px] text-text-muted">
          {label}
          <textarea name="message" rows={3} maxLength={500} placeholder={placeholder} className="w-full rounded-md bg-background px-4 py-3 text-[17px] text-text shadow-[inset_0_0_0_1px_var(--color-border)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-primary)]" />
        </label>
        <button type="submit" disabled={pending} className={`${big} bg-inverse text-on-inverse`}>
          {pending ? "Envoi…" : "Envoyer mon message"}
        </button>
      </form>
      <form action={formAction}>
        <input type="hidden" name="attending" value="oui" />
        <button type="submit" disabled={pending} className={`${big} bg-background text-text shadow-[inset_0_0_0_1.5px_var(--color-border)]`}>
          Finalement, je viendrai
        </button>
      </form>
      <Error state={state} />
    </div>
  );
}
