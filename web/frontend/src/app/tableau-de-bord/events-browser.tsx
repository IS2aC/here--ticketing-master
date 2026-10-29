"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import type { EventFormState } from "./evenements/actions";
import { DeleteEvent } from "./delete-event";

// « Mes événements » : recherche, filtres par moment et cartes (maquette du tableau de bord organisateur).

export type Phase = "upcoming" | "live" | "done" | "draft" | "cancelled";

export type EventCard = {
  id: string;
  title: string;
  when: string; // « Samedi 31 octobre 2026 · 10 h 00 »
  location: string | null;
  phase: Phase;
  cover: string; // aperçu de la carte d'invitation
  sent: boolean; // invitations parties ou en file
  stats: { guests: number; confirmed: number; pending: number; declined: number };
  remove: () => Promise<EventFormState>;
};

const PHASES: Record<Phase, { label: string; icon: IconName; className: string }> = {
  live: { label: "En cours", icon: "valide", className: "text-status-confirmed" },
  upcoming: { label: "À venir", icon: "horloge", className: "text-text" },
  done: { label: "Terminé", icon: "valide", className: "text-text-muted" },
  draft: { label: "Brouillon", icon: "modifier", className: "text-text-muted" },
  cancelled: { label: "Annulé", icon: "decline", className: "text-status-declined" },
};

const FILTERS: { key: "all" | Exclude<Phase, "cancelled">; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "upcoming", label: "À venir" },
  { key: "live", label: "En cours" },
  { key: "done", label: "Terminés" },
  { key: "draft", label: "Brouillons" },
];

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr-FR");
}

export function EventsBrowser({ events, banner }: { events: EventCard[]; banner: ReactNode }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const q = normalize(query.trim());
  const searched = q ? events.filter((e) => normalize(`${e.title} ${e.location ?? ""}`).includes(q)) : events;
  const shown = filter === "all" ? searched : searched.filter((e) => e.phase === filter);
  const count = (key: (typeof FILTERS)[number]["key"]) => (key === "all" ? searched.length : searched.filter((e) => e.phase === key).length);

  return (
    <section id="mes-evenements" className="grid min-w-0 scroll-mt-6 gap-5" aria-label="Mes événements">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <h2 className="flex shrink-0 items-center gap-2.5 font-heading text-[22px] font-bold whitespace-nowrap">
          Mes événements
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-background shadow-sm px-2 font-data text-[12px] font-semibold tabular-nums">
            {events.length}
          </span>
        </h2>
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block lg:w-64 lg:shrink-0">
            <span className="sr-only">Rechercher un événement</span>
            <Icon name="recherche" width={18} height={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un événement, un lieu…"
              className="h-11 w-full rounded-full bg-background pr-4 pl-10 text-[14px] shadow-[inset_0_0_0_1px_var(--color-border)] outline-none placeholder:text-text-muted focus:shadow-[inset_0_0_0_2px_var(--color-primary)]"
            />
          </label>
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:pb-0" role="group" aria-label="Filtrer les événements">
            {FILTERS.map((f) => {
              const on = f.key === filter;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(f.key)}
                  className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    on ? "bg-background text-primary shadow-[inset_0_0_0_1.5px_var(--color-primary)]" : "text-text-muted hover:bg-background hover:text-text"
                  }`}
                >
                  {f.label}
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-data text-[11px] text-text-muted tabular-nums ${on ? "bg-surface" : "bg-background"}`}
                  >
                    {count(f.key)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {banner}

      {shown.length ? (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((e) => (
            <EventCardItem key={e.id} event={e} />
          ))}
        </ul>
      ) : events.length ? (
        <p className="rounded-2xl bg-background p-8 text-center text-[14px] text-text-muted shadow-sm">
          Aucun événement ne correspond{q ? ` à « ${query.trim()} »` : ""}.
        </p>
      ) : null}
    </section>
  );
}

function EventCardItem({ event: e }: { event: EventCard }) {
  const phase = PHASES[e.phase];
  const href = `/tableau-de-bord/evenements/${e.id}`;
  const rate = e.stats.guests ? Math.round((100 * e.stats.confirmed) / e.stats.guests) : 0;
  const stats: { icon: IconName; value: number; label: string; className: string }[] = [
    { icon: "participants", value: e.stats.guests, label: e.stats.guests > 1 ? "invités" : "invité", className: "text-text-muted" },
    { icon: "valide", value: e.stats.confirmed, label: e.stats.confirmed > 1 ? "confirmés" : "confirmé", className: "text-status-confirmed" },
    { icon: "horloge", value: e.stats.pending, label: "en attente", className: "text-status-pending" },
    { icon: "decline", value: e.stats.declined, label: e.stats.declined > 1 ? "déclinés" : "décliné", className: "text-status-declined" },
  ];
  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm transition-shadow hover:shadow-md">
      <Link href={href} className="relative block h-[128px] overflow-hidden bg-ivory" tabIndex={-1} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- carte générée à la demande, déjà au bon format */}
        <img src={e.cover} alt="" width={1080} height={1350} loading="lazy" className="size-full object-cover object-[50%_30%]" />
        <span className={`absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1 text-[12px] font-semibold shadow-sm ${phase.className}`}>
          <Icon name={phase.icon} width={15} height={15} />
          {phase.label}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="truncate font-heading text-[16px] font-semibold">
            <Link href={href} className="hover:underline focus-visible:outline-2 focus-visible:outline-primary">
              {e.title}
            </Link>
          </h3>
          <p className="mt-1.5 flex items-center gap-2 text-[13px] text-text-muted">
            <Icon name="calendrier" width={16} height={16} className="shrink-0" />
            {e.when}
          </p>
          {e.location ? (
            <p className="mt-1 flex items-center gap-2 text-[13px] text-text-muted">
              <Icon name="lieu" width={16} height={16} className="shrink-0" />
              <span className="truncate">{e.location}</span>
            </p>
          ) : null}
        </div>
        <dl className="grid grid-cols-4 gap-1">
          {stats.map((s) => (
            <div key={s.label} className="flex min-w-0 items-start gap-1">
              <Icon name={s.icon} width={14} height={14} className={`mt-0.5 shrink-0 ${s.className}`} />
              <div className="min-w-0">
                <dd className="font-data text-[15px] leading-tight font-semibold tabular-nums">{s.value.toLocaleString("fr-FR")}</dd>
                <dt className="text-[11px] leading-tight text-text-muted">{s.label}</dt>
              </div>
            </div>
          ))}
        </dl>
        <div className="flex items-center gap-3" title={`${rate} % des invités ont confirmé`}>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface" aria-hidden="true">
            <div className="h-full rounded-full bg-status-confirmed" style={{ width: `${rate}%` }} />
          </div>
          <span className="font-data text-[12px] text-text-muted tabular-nums">{rate} %</span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          {e.phase === "draft" ? (
            <Link
              href={`${href}/modifier`}
              className="inline-flex h-10 items-center gap-2 rounded-full px-4 font-heading text-[14px] font-semibold shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface"
            >
              <Icon name="modifier" width={18} height={18} />
              Continuer l&apos;édition
            </Link>
          ) : (
            <Link
              href={href}
              className="inline-flex h-10 items-center gap-2 rounded-full px-4 font-heading text-[14px] font-semibold shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface"
            >
              <Icon name="invitation" width={18} height={18} />
              Voir l&apos;événement
            </Link>
          )}
          <EventMenu event={e} href={href} />
        </div>
      </div>
    </li>
  );
}

// Menu « … » : se ferme au clic à l'extérieur et avec Échap.
function EventMenu({ event: e, href }: { event: EventCard; href: string }) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (ev: Event) => {
      const el = menu.current;
      if (!el?.open) return;
      if (ev instanceof KeyboardEvent ? ev.key === "Escape" : !el.contains(ev.target as Node)) el.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  const item = "flex h-9 w-full items-center gap-2 rounded-lg px-3 text-[13px] hover:bg-surface";
  return (
    <details ref={menu} className="relative">
      <summary
        aria-label={`Actions pour ${e.title}`}
        className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </summary>
      <div className="absolute right-0 bottom-12 z-20 grid w-52 gap-0.5 rounded-xl border border-border bg-background p-1.5 shadow-md">
        <Link href={href} className={item}>
          <Icon name="invitation" width={16} height={16} />
          Voir l&apos;événement
        </Link>
        <Link href={`${href}/modifier`} className={item}>
          <Icon name="modifier" width={16} height={16} />
          Modifier
        </Link>
        <div className="px-2 py-1.5">
          <DeleteEvent title={e.title} sent={e.sent} action={e.remove} />
        </div>
      </div>
    </details>
  );
}
