import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { getEvents, PAGE_SIZE, type EventStatus } from "@/lib/admin";
import { CARD, EventsTable, Pager } from "../ui";

export const metadata: Metadata = { title: "Événements · Portail admin · Here!" };

type Query = Record<string, string | string[] | undefined>;

// Filtres dans l'adresse (?statut=, ?periode=, ?q=, ?page=) : une vue filtrée se partage et survit au rechargement.
const STATUSES: { value?: string; label: string; status?: EventStatus }[] = [
  { label: "Tous" },
  { value: "actifs", label: "Actifs", status: "active" },
  { value: "brouillons", label: "Brouillons", status: "draft" },
  { value: "termines", label: "Terminés", status: "done" },
  { value: "annules", label: "Annulés", status: "cancelled" },
];
const PERIODS: { value?: string; label: string; period?: "upcoming" | "past" }[] = [
  { label: "Toutes les dates" },
  { value: "a-venir", label: "À venir", period: "upcoming" },
  { value: "passes", label: "Passés", period: "past" },
];

function read(query: Query) {
  const one = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);
  return {
    statut: STATUSES.find((s) => s.value === one("statut")) ?? STATUSES[0],
    periode: PERIODS.find((p) => p.value === one("periode")) ?? PERIODS[0],
    q: one("q")?.trim() ?? "",
    page: Math.max(1, Number(one("page")) || 1),
  };
}

function url(f: { statut?: string; periode?: string; q?: string; page?: number }): string {
  const params = new URLSearchParams();
  if (f.statut) params.set("statut", f.statut);
  if (f.periode) params.set("periode", f.periode);
  if (f.q) params.set("q", f.q);
  if (f.page && f.page > 1) params.set("page", String(f.page));
  const search = params.toString();
  return `/admin/evenements${search ? `?${search}` : ""}`;
}

export default function EventsPage({ searchParams }: PageProps<"/admin/evenements">) {
  return (
    <>
      <header>
        <p className="text-[12px] font-medium tracking-[0.02em] text-text-muted">Admin · Événements</p>
        <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">Événements</h1>
        <p className="mt-0.5 text-[13px] text-text-muted">Les événements de tous les comptes, avec leurs envois, réponses et entrées.</p>
      </header>
      <Suspense fallback={<div className={`h-[640px] ${CARD}`} aria-busy="true" />}>
        <Events searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Events({ searchParams }: { searchParams: Promise<Query> }) {
  const f = read(await searchParams);
  const { total, items } = await getEvents({
    q: f.q,
    status: f.statut.status,
    period: f.periode.period,
    limit: PAGE_SIZE,
    offset: (f.page - 1) * PAGE_SIZE,
  });
  const base = { statut: f.statut.value, periode: f.periode.value, q: f.q };
  const pill = (on: boolean) =>
    `flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-semibold ${
      on ? "bg-background text-primary shadow-[inset_0_0_0_1.5px_var(--color-primary)]" : "text-text-muted hover:bg-surface hover:text-text"
    }`;

  return (
    <section className={`${CARD} p-6`} aria-label="Liste des événements">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1" aria-label="Statut">
            {STATUSES.map((s) => (
              <Link key={s.label} href={url({ ...base, statut: s.value })} aria-current={s === f.statut ? "true" : undefined} className={pill(s === f.statut)}>
                {s.label}
              </Link>
            ))}
          </nav>
          <span className="hidden h-6 w-px bg-border md:block" aria-hidden="true" />
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1" aria-label="Période">
            {PERIODS.map((p) => (
              <Link key={p.label} href={url({ ...base, periode: p.value })} aria-current={p === f.periode ? "true" : undefined} className={pill(p === f.periode)}>
                {p.label}
              </Link>
            ))}
          </nav>
        </div>
        <form role="search" className="relative xl:w-72">
          {f.statut.value ? <input type="hidden" name="statut" value={f.statut.value} /> : null}
          {f.periode.value ? <input type="hidden" name="periode" value={f.periode.value} /> : null}
          <label htmlFor="admin-events-q" className="sr-only">
            Rechercher un événement
          </label>
          <Icon name="recherche" width={18} height={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-muted" />
          <input
            id="admin-events-q"
            type="search"
            name="q"
            defaultValue={f.q}
            placeholder="Titre ou organisateur…"
            className="h-10 w-full rounded-xl bg-background pr-4 pl-10 text-[13px] shadow-[inset_0_0_0_1px_var(--color-border)] outline-none placeholder:text-text-muted focus:shadow-[inset_0_0_0_2px_var(--color-primary)]"
          />
        </form>
      </div>

      <p className="mt-4 text-[13px] text-text-muted">
        <span className="font-data font-semibold text-text tabular-nums">{total.toLocaleString("fr-FR")}</span> événement{total > 1 ? "s" : ""}
        {f.q ? ` pour « ${f.q} »` : ""}
      </p>

      {items.length ? (
        <div className="mt-3">
          <EventsTable events={items} />
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-surface text-text-muted">
            <Icon name="calendrier" width={28} height={28} />
          </span>
          <p className="font-heading text-[18px] font-semibold">Aucun événement ne correspond</p>
          <Link href="/admin/evenements" className="text-[14px] font-semibold text-accent-text hover:underline">
            Voir tous les événements
          </Link>
        </div>
      )}
      <Pager total={total} page={f.page} size={PAGE_SIZE} href={(page) => url({ ...base, page })} />
    </section>
  );
}
