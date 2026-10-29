"use client";

import { useActionState, useEffect, useRef } from "react";
import { Icon } from "@/components/icons";
import type { GuestFormState } from "./actions";

// Action irréversible (DESIGN.md) : titre en question, conséquence en une phrase,
// « Garder l'invité » en contour à gauche, « Retirer l'invité » plein rouge à droite.
export function RemoveGuest({ name, sent, action }: { name: string; sent: boolean; action: () => Promise<GuestFormState> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState<GuestFormState>(action, {});
  useEffect(() => {
    if (state.message) dialog.current?.showModal();
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex h-10 items-center gap-2 rounded-full px-4 font-heading text-[14px] font-semibold text-error shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface"
      >
        <Icon name="decline" width={18} height={18} />
        Retirer de la liste
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="remove-guest-title"
        className="m-auto w-[min(480px,calc(100vw-32px))] rounded-lg bg-background p-6 text-text shadow-lg backdrop:bg-ink/45"
      >
        <h2 id="remove-guest-title" className="font-heading text-[20px] leading-tight font-bold">
          Retirer {name} de la liste ?
        </h2>
        <p className="mt-3 text-[14px] text-text-muted">Sa carte, sa réponse et son entrée seront supprimées définitivement.</p>
        {sent ? (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-surface p-3 text-[14px] text-status-pending">
            <Icon name="alerte" width={18} height={18} className="mt-0.5 shrink-0" />
            <span>Les invitations de cet événement sont parties : si la sienne l&apos;est aussi, le lien qu&apos;il a reçu ne fonctionnera plus.</span>
          </p>
        ) : null}
        {state.message ? (
          <p role="alert" className="mt-3 text-[13px] text-error">
            {state.message}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            autoFocus
            onClick={() => dialog.current?.close()}
            className="inline-flex h-11 items-center justify-center rounded-full px-5 font-heading text-[14px] font-semibold shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface"
          >
            Garder l&apos;invité
          </button>
          <form action={formAction}>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-error px-5 font-heading text-[14px] font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Retrait…" : "Retirer l'invité"}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
