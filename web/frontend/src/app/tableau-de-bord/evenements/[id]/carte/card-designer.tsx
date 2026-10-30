"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import type { Palette } from "@/lib/card/palettes";
import type { CardState } from "./actions";

// Carte automatique : intitulé et palette, avec l'aperçu en direct (l'image est redessinée à chaque choix).
export function CardDesigner({
  action,
  preview,
  alt,
  eventTitle,
  title: savedTitle,
  palette: savedPalette,
  palettes,
  locked,
  children,
}: {
  action: (state: CardState, formData: FormData) => Promise<CardState>;
  preview: string; // aperçu enregistré (…/carte.png?invite=…)
  alt: string;
  eventTitle: string;
  title: string | null;
  palette: string | null;
  palettes: Palette[];
  locked: boolean;
  children: ReactNode; // autres encarts de la colonne
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [title, setTitle] = useState(savedTitle ?? "");
  const [palette, setPalette] = useState(savedPalette ?? palettes[0].id);
  const [shownTitle, setShownTitle] = useState(title);

  // L'aperçu suit l'intitulé après une courte pause de frappe.
  useEffect(() => {
    const timer = setTimeout(() => setShownTitle(title), 450);
    return () => clearTimeout(timer);
  }, [title]);

  const params = new URLSearchParams({ palette, ...(shownTitle.trim() ? { titre: shownTitle.trim() } : {}) });
  const src = `${preview}${preview.includes("?") ? "&" : "?"}${params}`;
  const changed = title.trim() !== (savedTitle ?? "") || palette !== (savedPalette ?? palettes[0].id);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex items-center justify-center rounded-lg bg-background p-5 shadow-sm sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element -- image générée à la demande, déjà au bon format */}
        <img key={src} src={src} alt={alt} width={1080} height={1350} className="h-auto w-full max-w-[480px] rounded-md shadow-lg" />
      </section>

      <aside className="grid content-start gap-4">
        <form action={formAction} className="grid gap-4 rounded-lg bg-background p-5 shadow-sm">
          <p className="flex items-center gap-2 font-heading text-[16px] font-semibold">
            <Icon name="modifier" width={20} height={20} className="text-primary" />
            Personnaliser la carte
          </p>
          {locked ? (
            <p className="flex items-start gap-2 rounded-md bg-surface p-3 text-[13px] text-text-muted">
              <Icon name="cadenas" width={16} height={16} className="mt-0.5 shrink-0" />
              <span>Les invitations sont parties : la carte ne peut plus être modifiée.</span>
            </p>
          ) : null}
          <fieldset disabled={locked} className="grid gap-4">
            <label className="grid gap-1.5 text-[13px] font-medium text-text-muted">
              Intitulé de la carte
              <input
                name="title"
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={eventTitle}
                className="h-11 rounded-md bg-background px-3 text-[15px] text-text shadow-[inset_0_0_0_1px_var(--color-border)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-primary)] disabled:bg-surface"
              />
              <span className="text-[12px] font-normal">Vide : le nom de l&apos;événement (« {eventTitle} »).</span>
            </label>
            <div className="grid gap-2">
              <span className="text-[13px] font-medium text-text-muted">Couleurs</span>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Couleurs de la carte">
                {palettes.map((p) => (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl p-2 text-[13px] font-medium shadow-[inset_0_0_0_1px_var(--color-border)] has-[:checked]:shadow-[inset_0_0_0_2px_var(--color-primary)] ${locked ? "cursor-not-allowed opacity-60" : "hover:bg-surface"}`}
                  >
                    <input type="radio" name="palette" value={p.id} checked={palette === p.id} onChange={() => setPalette(p.id)} className="sr-only" />
                    <span className="flex shrink-0 overflow-hidden rounded-full shadow-[0_0_0_1px_var(--color-border)]" aria-hidden="true">
                      <span className="size-5" style={{ background: p.swatch[0] }} />
                      <span className="size-5" style={{ background: p.swatch[1] }} />
                    </span>
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
            {state.message ? (
              <p role="alert" className="text-[13px] text-error">
                {state.message}
              </p>
            ) : state.saved && !changed ? (
              <p role="status" className="flex items-center gap-1.5 text-[13px] text-status-confirmed">
                <Icon name="valide" width={15} height={15} />
                Carte enregistrée : les cartes de vos invités suivent.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                name="intent"
                value="save"
                disabled={pending || !changed}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 font-heading text-[14px] font-semibold text-white hover:bg-ink-700 disabled:bg-surface disabled:text-text-muted"
              >
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
              {savedTitle || savedPalette ? (
                <button
                  type="submit"
                  name="intent"
                  value="reset"
                  disabled={pending}
                  onClick={() => {
                    setTitle("");
                    setPalette(palettes[0].id);
                  }}
                  className="text-[13px] font-semibold text-text-muted hover:text-text hover:underline"
                >
                  Revenir à l&apos;origine
                </button>
              ) : null}
            </div>
          </fieldset>
        </form>
        {children}
      </aside>
    </div>
  );
}
