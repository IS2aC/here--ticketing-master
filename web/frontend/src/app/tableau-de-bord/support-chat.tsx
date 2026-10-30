"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "@/components/icons";
import type { SupportConversation, SupportMessage } from "@/lib/support";
import { closeConversation, escalate, loadConversation, sendQuestion } from "./support-actions";

// « Une question ? » : la carte de la barre latérale ouvre une discussion par-dessus la page (floutée).
// L'assistant répond ; s'il ne sait pas, ou à la demande, la question va à l'équipe Here!, qui répond ici.

const EXAMPLES = ["Comment ajouter un invité oublié ?", "Quand partent les relances ?", "Comment fonctionne le scan à l'entrée ?"];
const POLL_MS = 8000; // réponse de l'équipe attendue : la discussion se met à jour seule

const clock = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Abidjan", hour: "2-digit", minute: "2-digit" });

const STATUS_LINE: Record<SupportConversation["status"], string> = {
  assistant: "Assistant Here! · l'équipe prend le relais si besoin",
  waiting: "Transmise à l'équipe Here! · réponse ici, en général dans la journée",
  answered: "L'équipe Here! vous a répondu",
  closed: "",
};

export function SupportChat({ firstName }: { firstName: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState<string | null>(null); // message en cours d'envoi (affiché tout de suite)
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = useCallback((result: { conversation: SupportConversation | null; message?: string }) => {
    setConversation(result.conversation);
    setError(result.message ?? null);
  }, []);

  const show = () => {
    setOpen(true);
    dialog.current?.showModal();
    startTransition(async () => apply(await loadConversation()));
    setTimeout(() => input.current?.focus(), 50);
  };

  // L'équipe répond : on relit la discussion tant que la fenêtre est ouverte.
  const waiting = conversation?.status === "waiting" || conversation?.status === "answered";
  useEffect(() => {
    if (!open || !waiting) return;
    const timer = setInterval(async () => {
      const result = await loadConversation();
      if (!result.message) setConversation(result.conversation);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [open, waiting]);

  // Dernier message visible.
  const count = (conversation?.messages.length ?? 0) + (sending ? 1 : 0);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [count, open]);

  const send = (text: string) => {
    const body = text.trim();
    if (!body || pending) return;
    setDraft("");
    setSending(body);
    startTransition(async () => {
      apply(await sendQuestion(body, conversation));
      setSending(null);
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };

  // Entrée : envoyer ; Maj + Entrée : nouvelle ligne.
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(draft);
    }
  };

  const messages = conversation?.messages ?? [];
  return (
    <>
      <button
        type="button"
        onClick={show}
        className="w-full rounded-2xl bg-ink p-4 text-left text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Icon name="support" className="text-red-bright" />
        <span className="mt-2 block font-heading text-[14px] font-semibold">Une question ?</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-gray-500">
          L&apos;équipe Here! vous accompagne pour vos invitations et vos relances.
        </span>
      </button>

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-labelledby="support-chat-title"
        className="m-auto h-[min(680px,calc(100dvh-24px))] max-h-none w-[min(460px,calc(100vw-24px))] max-w-none overflow-hidden rounded-2xl bg-background p-0 text-text shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-md sm:mr-6 sm:mb-6"
      >
        <div className="flex h-full flex-col">
          <header className="flex items-start gap-3 border-b border-border/60 px-5 py-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
              <Icon name="support" width={20} height={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="support-chat-title" className="font-heading text-[17px] font-bold">
                Une question ?
              </h2>
              <p className="text-[12px] text-text-muted">{conversation ? STATUS_LINE[conversation.status] : "Assistant Here! et équipe Here!"}</p>
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Fermer"
              className="flex size-9 items-center justify-center rounded-full text-text-muted hover:bg-surface hover:text-text"
            >
              <Icon name="decline" width={20} height={20} />
            </button>
          </header>

          <div ref={list} className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4" aria-live="polite">
            {messages.length === 0 && !sending ? (
              <div className="grid gap-3 py-4">
                <p className="text-[15px]">
                  Bonjour {firstName}, posez votre question : l&apos;assistant Here! vous répond, et l&apos;équipe prend le relais si
                  besoin.
                </p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => send(example)}
                      className="rounded-full px-3 py-1.5 text-left text-[13px] font-medium shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {messages.map((m) => (
              <Bubble key={m.id} message={m} />
            ))}
            {sending ? (
              <>
                <Bubble message={{ id: "envoi", author: "organizer", body: sending, created_at: new Date().toISOString(), staff_name: null }} />
                <p className="flex items-center gap-2 text-[13px] text-text-muted">
                  <span className="flex gap-1" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="size-1.5 animate-bounce rounded-full bg-text-muted" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </span>
                  L&apos;assistant Here! écrit…
                </p>
              </>
            ) : null}
          </div>

          <form onSubmit={submit} className="grid gap-2 border-t border-border/60 px-4 pt-3 pb-4">
            {error ? (
              <p role="alert" className="text-[13px] text-error">
                {error}
              </p>
            ) : null}
            <div className="flex min-w-0 items-end gap-2">
              <label htmlFor="support-chat-input" className="sr-only">
                Votre message
              </label>
              <textarea
                id="support-chat-input"
                ref={input}
                rows={2}
                value={draft}
                maxLength={2000}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={keyDown}
                placeholder="Écrivez votre question…"
                className="max-h-32 min-h-[48px] min-w-0 flex-1 resize-none rounded-xl bg-background px-3 py-2.5 text-[15px] shadow-[inset_0_0_0_1px_var(--color-border)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-primary)]"
              />
              <button
                type="submit"
                disabled={pending || !draft.trim()}
                aria-label="Envoyer"
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover disabled:bg-surface disabled:text-text-muted"
              >
                <Icon name="envoyer" width={20} height={20} />
              </button>
            </div>
            {conversation ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                {conversation.status === "assistant" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startTransition(async () => apply(await escalate(conversation)))}
                    className="font-semibold text-accent-text hover:underline"
                  >
                    Parler à l&apos;équipe Here!
                  </button>
                ) : (
                  <span className="text-text-muted">Vous pouvez fermer : la réponse vous attend ici.</span>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => startTransition(async () => apply(await closeConversation()))}
                  className="font-semibold text-text-muted hover:text-text hover:underline"
                >
                  Nouvelle question
                </button>
              </div>
            ) : null}
          </form>
        </div>
      </dialog>
    </>
  );
}

function Bubble({ message: m }: { message: SupportMessage }) {
  const mine = m.author === "organizer";
  const who = m.author === "staff" ? `${m.staff_name ?? "Équipe"} · équipe Here!` : m.author === "assistant" ? "Assistant Here!" : null;
  return (
    <div className={`flex max-w-[85%] flex-col gap-1 ${mine ? "self-end items-end" : "self-start items-start"}`}>
      {who ? (
        <span className={`flex items-center gap-1 text-[11px] font-semibold ${m.author === "staff" ? "text-primary" : "text-text-muted"}`}>
          <Icon name={m.author === "staff" ? "support" : "message"} width={12} height={12} />
          {who}
        </span>
      ) : null}
      <p
        className={`rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-line ${
          mine
            ? "rounded-br-md bg-ink text-white"
            : m.author === "staff"
              ? "rounded-bl-md bg-primary/8 text-text shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]"
              : "rounded-bl-md bg-surface text-text"
        }`}
      >
        {m.body}
      </p>
      <span className="font-data text-[10px] text-text-muted tabular-nums">{clock.format(new Date(m.created_at)).replace(":", " h ")}</span>
    </div>
  );
}
