import type { Metadata } from "next";
import Image from "next/image";
import { Suspense, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Toast } from "@/components/toast";
import { ButtonLink } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatTime, getEvents, getEventsSummary, type EventOut } from "@/lib/events";
import { deleteEvent } from "./evenements/actions";
import { EventsBrowser, type EventCard, type Phase } from "./events-browser";

export const metadata: Metadata = { title: "Tableau de bord · Here!" };

const NEW_EVENT = "/tableau-de-bord/evenements/nouveau";
const CARD = "rounded-2xl border border-border/60 bg-background shadow-sm";

export default function DashboardPage({ searchParams }: PageProps<"/tableau-de-bord">) {
  return (
    <>
      <Suspense fallback={null}>
        <Deleted searchParams={searchParams} />
      </Suspense>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Suspense fallback={<p className="h-5 w-32 rounded bg-background" />}>
            <Greeting />
          </Suspense>
          <h1 className="mt-1 font-heading text-[28px] font-bold tracking-[-0.01em]">Tableau de bord</h1>
          <p className="mt-1 text-[14px] text-text-muted">Retrouvez ici un aperçu de vos événements et de leur activité.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/tableau-de-bord/cartes" variant="ghost" className="h-11 text-[14px]">
            <Icon name="invitation" width={18} height={18} />
            Voir mes cartes
          </ButtonLink>
          <ButtonLink href={NEW_EVENT} className="h-11 text-[14px]">
            <Icon name="ajouter" width={18} height={18} />
            Créer un événement
          </ButtonLink>
        </div>
      </header>
      <Suspense fallback={<div className={`h-[640px] ${CARD}`} aria-busy="true" />}>
        <Dashboard />
      </Suspense>
    </>
  );
}

// Notification après la suppression d'un événement (?supprime=1).
async function Deleted({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return query.supprime ? <Toast title="Événement supprimé" detail="Ses invités, cartes et réponses ont été supprimés." /> : null;
}

async function Greeting() {
  const user = await getCurrentUser();
  return <p className="text-[14px] text-text-muted">Bonjour {user.first_name} 👋</p>;
}

/** Moment de l'événement. Fin : début + durée, sinon fin de la journée (heure d'Abidjan = UTC). */
function phaseOf(event: EventOut, now: number): Phase {
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "draft") return "draft";
  if (event.status === "done") return "done";
  const start = Date.parse(event.starts_at);
  const end = event.duration_minutes ? start + event.duration_minutes * 60_000 : new Date(start).setUTCHours(24, 0, 0, 0);
  return now < start ? "upcoming" : now < end ? "live" : "done";
}

// Ordre d'affichage : en cours, à venir (le plus proche d'abord), brouillons, terminés (le plus récent d'abord), annulés.
const ORDER: Record<Phase, number> = { live: 0, upcoming: 1, draft: 2, done: 3, cancelled: 4 };

async function Dashboard() {
  const [events, summary] = await Promise.all([getEvents(), getEventsSummary()]);
  const now = new Date().getTime(); // rendu à chaque requête : le moment présent est voulu
  const months = summary.months;
  const [previous, current] = months.slice(-2);
  const totals = events.reduce(
    (t, e) => ({
      guests: t.guests + e.stats.guests,
      confirmed: t.confirmed + e.stats.confirmed,
      pending: t.pending + e.stats.pending,
      declined: t.declined + e.stats.declined,
    }),
    { guests: 0, confirmed: 0, pending: 0, declined: 0 },
  );
  const guestTrend = previous.guests ? Math.round((100 * (current.guests - previous.guests)) / previous.guests) : null;

  const cards: EventCard[] = events
    .map((e) => ({ e, phase: phaseOf(e, now) }))
    .sort((a, b) => ORDER[a.phase] - ORDER[b.phase] || (a.phase === "done" ? -1 : 1) * (Date.parse(a.e.starts_at) - Date.parse(b.e.starts_at)))
    .map(({ e, phase }) => ({
      id: e.id,
      title: e.title,
      when: `${formatDate(e.starts_at)} · ${formatTime(e.starts_at)}`,
      location: e.location_name,
      phase,
      cover: `/tableau-de-bord/evenements/${e.id}/carte.png?couverture&v=${encodeURIComponent(e.updated_at)}`,
      sent: e.status === "active",
      stats: { guests: e.stats.guests, confirmed: e.stats.confirmed, pending: e.stats.pending, declined: e.stats.declined },
      remove: deleteEvent.bind(null, e.id),
    }));

  return (
    <>
      <section aria-label="Chiffres clés" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        <Kpi tone="bg-primary/8 text-primary" icon="calendrier" label="Total événements" value={events.length} spark={months.map((m) => m.events)} sparkLabel="Événements créés par mois">
          {current.events ? <Up>+{current.events.toLocaleString("fr-FR")}</Up> : null} ce mois
        </Kpi>
        <Kpi tone="bg-primary/8 text-primary" icon="participants" label="Invités (total)" value={totals.guests} spark={months.map((m) => m.guests)} sparkLabel="Invités ajoutés par mois">
          {guestTrend !== null ? (
            <>
              {guestTrend >= 0 ? <Up>+{guestTrend.toLocaleString("fr-FR")} %</Up> : <span className="font-semibold">{guestTrend.toLocaleString("fr-FR")} %</span>} vs mois dernier
            </>
          ) : (
            `${current.guests.toLocaleString("fr-FR")} ajoutés ce mois`
          )}
        </Kpi>
        <Kpi tone="bg-status-confirmed/10 text-status-confirmed" icon="valide" label="Confirmés" value={totals.confirmed}>
          <Share part={totals.confirmed} whole={totals.guests} bar="bg-status-confirmed" />
        </Kpi>
        <Kpi tone="bg-amber-light/20 text-status-pending" icon="horloge" label="En attente" value={totals.pending}>
          <Share part={totals.pending} whole={totals.guests} bar="bg-amber-light" />
        </Kpi>
        <Kpi tone="bg-surface text-text" icon="decline" label="Déclinés" value={totals.declined}>
          <Share part={totals.declined} whole={totals.guests} bar="bg-status-declined" />
        </Kpi>
      </section>

      <EventsBrowser events={cards} banner={<NewEventBanner first={events.length === 0} />} />
    </>
  );
}

function Up({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-0.5 font-semibold text-status-confirmed">
      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 17L17 7M9 7h8v8" />
      </svg>
      {children}
    </span>
  );
}

function Kpi({
  tone,
  icon,
  label,
  value,
  spark,
  sparkLabel,
  children,
}: {
  tone: string;
  icon: IconName;
  label: string;
  value: number;
  spark?: number[];
  sparkLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className={`${CARD} flex gap-3.5 p-5`}>
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon name={icon} width={22} height={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-text-muted">{label}</p>
        <div className="flex items-end justify-between gap-2">
          <p className="font-data text-[28px] leading-tight font-bold tracking-[-0.02em] tabular-nums">{value.toLocaleString("fr-FR")}</p>
          {spark ? <Sparkline values={spark} label={sparkLabel ?? label} /> : null}
        </div>
        <div className="mt-1.5 text-[12px] text-text-muted">{children}</div>
      </div>
    </div>
  );
}

// Mini-histogramme des 6 derniers mois : le mois en cours en rouge plein.
function Sparkline({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-9 items-end gap-[3px]" role="img" aria-label={`${label} : ${values.join(", ")} (6 derniers mois)`}>
      {values.map((v, i) => (
        <span
          key={i}
          className={`w-[5px] rounded-t-[2px] ${i === values.length - 1 ? "bg-primary" : "bg-primary/30"}`}
          style={{ height: `${Math.max((v / max) * 100, 8)}%` }}
        />
      ))}
    </div>
  );
}

function Share({ part, whole, bar }: { part: number; whole: number; bar: string }) {
  const ratio = whole ? part / whole : 0;
  return (
    <>
      <span className="font-data font-medium tabular-nums">
        {(100 * ratio).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %
      </span>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden="true">
        <span className={`block h-full rounded-full ${bar}`} style={{ width: `${ratio * 100}%` }} />
      </span>
    </>
  );
}

// Bandeau « Créer un nouvel événement ». Bouton noir : un seul bouton rouge par écran (DESIGN.md), celui de l'en-tête.
function NewEventBanner({ first }: { first: boolean }) {
  return (
    <div className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white sm:size-14">
        <Icon name="ajouter" width={26} height={26} />
      </span>
      <div className="relative z-10 min-w-0 flex-1 sm:max-w-[46%] lg:max-w-[44%]">
        <h3 className="font-heading text-[18px] font-bold">{first ? "Créez votre premier événement" : "Créer un nouvel événement"}</h3>
        <p className="mt-1 text-[14px] text-text-muted">
          Mariage, dot, baptême, funérailles, séminaire… Créez votre événement en quelques clics et commencez à inviter vos proches.
        </p>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-[200px] hidden w-[300px] md:block lg:right-[230px] lg:w-[320px]" aria-hidden="true">
        <Image src="/images/vue-organisateur.jpg" alt="" fill sizes="320px" className="object-cover object-[50%_30%]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#FFF4F3] via-transparent to-[#FFF4F3]" />
      </div>
      <ButtonLink href={NEW_EVENT} variant="inverse" className="relative z-10 h-11 self-start text-[14px] sm:ml-auto sm:self-center">
        <Icon name="ajouter" width={18} height={18} />
        Créer un événement
      </ButtonLink>
    </div>
  );
}
