"use client";

import { useActionState, useEffect, useRef } from "react";
import { Icon } from "@/components/icons";
import type { EventFormState } from "./evenements/actions";

// Action irréversible (DESIGN.md) : boîte de dialogue sur voile noir, titre en question, conséquence en une phrase,
// sortie en contour à gauche, bouton destructif plein à droite.
// `sent` : des invitations sont parties ou en file (événement « En cours »).
export function DeleteEvent({
  title,
  sent,
  action,
}: {
  title: string;
  sent: boolean;
  action: () => Promise<EventFormState>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState<EventFormState>(action, {});
  useEffect(() => {
    if (state.message) dialog.current?.showModal();
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label={`Supprimer l'événement ${title}`}
        className="inline-flex items-center gap-1 rounded-sm px-1 text-[13px] font-semibold text-text-muted hover:text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Icon name="decline" width={16} height={16} />
        Supprimer
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="delete-event-title"
        className="m-auto w-[min(480px,calc(100vw-32px))] rounded-lg bg-background p-6 text-text shadow-lg backdrop:bg-ink/45"
      >
        <h2 id="delete-event-title" className="font-heading text-[20px] leading-tight font-bold">
          Supprimer l&apos;événement « {title} » ?
        </h2>
        <p className="mt-3 text-[14px] text-text-muted">
          Les invités, les cartes, les invitations, les liens de scan et les réponses seront supprimés définitivement.
        </p>
        {sent ? (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-surface p-3 text-[14px] text-status-pending">
            <Icon name="alerte" width={18} height={18} className="mt-0.5 shrink-0" />
            <span>
              Des invitations ont déjà été envoyées ou sont en file : vos invités ne pourront plus ouvrir leur invitation
              ni répondre, et les envois en file seront annulés.
            </span>
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
            Garder l&apos;événement
          </button>
          <form action={formAction}>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-error px-5 font-heading text-[14px] font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Suppression…" : "Supprimer l'événement"}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
