import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { getDashboard, getEvents, getUsers, PERIODS, requireStaff, type Activity, type AdminDashboard, type Trend } from "@/lib/admin";
import { EVENT_TIME_ZONE, eventType } from "@/lib/event-types";
import { formatShortDate, formatTime } from "@/lib/events";
import { maskPhone } from "@/lib/phone";
import { DailyChart, Donut } from "./charts";
import { AVATARS, CARD, SeeAll, SeeButton, TONES, type Tone } from "./ui";

export const metadata: Metadata = { title: "Portail admin · Here!" };

// Tableau de bord admin : maquette Google Stitch, adaptée à la charte Here! (tokens, polices, pictogrammes).

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function plural(n: number, one: string, many: string = `${one}s`): string {
  return `${n.toLocaleString("fr-FR")} ${n > 1 ? many : one}`;
}

function percent(part: number, whole: number): string {
  return `${(whole ? (100 * part) / whole : 0).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

async function period(searchParams: SearchParams): Promise<number> {
  const days = Number((await searchParams).jours);
  return (PERIODS as readonly number[]).includes(days) ? days : 30;
}

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[12px] font-medium tracking-[0.02em] text-text-muted">Admin · Tableau de bord</p>
          <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">Tableau de bord</h1>
          <p className="mt-0.5 text-[13px] text-text-muted">Vue d&apos;ensemble de la plateforme et de son activité.</p>
        </div>
        <Suspense fallback={null}>
          <PeriodMenu searchParams={searchParams} />
        </Suspense>
      </header>
      <Suspense fallback={<div className={`h-[900px] ${CARD}`} aria-busy="true" />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </>
  );
}

// Menu déroulant sans JavaScript (<details>) : chaque période est un lien.
async function PeriodMenu({ searchParams }: { searchParams: SearchParams }) {
  const days = await period(searchParams);
  return (
    <details className="group relative self-start sm:self-auto">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-border bg-background px-3.5 text-[13px] font-semibold shadow-sm hover:bg-surface [&::-webkit-details-marker]:hidden">
        <Icon name="calendrier" width={16} height={16} className="text-text-muted" />
        {days} derniers jours
        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} className="ml-1 text-text-muted transition-transform group-open:rotate-180" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <ul className="absolute right-0 z-20 mt-2 grid w-48 gap-0.5 rounded-xl border border-border bg-background p-1.5 shadow-md">
        {PERIODS.map((d) => (
          <li key={d}>
            <Link
              href={d === 30 ? "/admin" : `/admin?jours=${d}`}
              aria-current={d === days ? "true" : undefined}
              className={`flex h-9 items-center justify-between rounded-lg px-3 text-[13px] hover:bg-surface ${d === days ? "font-semibold" : ""}`}
            >
              {d} derniers jours
              {d === days ? <Icon name="valide" width={15} height={15} className="text-primary" /> : null}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  if ((await requireStaff()).role !== "admin") redirect("/admin/messages");
  const days = await period(searchParams);
  const [d, upcoming, users] = await Promise.all([getDashboard(days), getEvents({ period: "upcoming", limit: 4 }), getUsers({ limit: 5 })]);
  const guests = d.guests.total;
  const confirmed = d.rsvp.confirmed;
  const series = d.series;

  return (
    <>
      <section aria-label="Chiffres clés" className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
        <Kpi tone="red" icon="participants" label="Organisateurs" value={d.organizers.total} trend={d.organizers} days={days}>
          dont {plural(d.organizers.new, "nouveau", "nouveaux")}
        </Kpi>
        <Kpi tone="red" icon="calendrier" label="Événements" value={d.events.total} trend={d.events} days={days}>
          {d.upcoming_events.toLocaleString("fr-FR")} à venir · {plural(d.events_by_status.done, "terminé")}
        </Kpi>
        <Kpi tone="red" icon="invitation" label="Invités" value={guests} trend={d.guests} days={days}>
          tous événements
        </Kpi>
        <Kpi tone="green" icon="valide" label="Confirmés" value={confirmed}>
          <Share part={confirmed} whole={guests} bar="bg-status-confirmed" />
        </Kpi>
        <Kpi tone="amber" icon="horloge" label="En attente" value={d.rsvp.pending}>
          <Share part={d.rsvp.pending} whole={guests} bar="bg-amber-light" />
        </Kpi>
        <Kpi tone="neutral" icon="decline" label="Déclinés" value={d.rsvp.declined}>
          <Share part={d.rsvp.declined} whole={guests} bar="bg-status-declined" />
        </Kpi>
        <Kpi tone="red" icon="envoyer" label="Invitations envoyées" value={d.invitations.total} trend={d.invitations} days={days}>
          {plural(d.invitations.delivered, "livrée")} · {plural(d.invitations.read, "lue")}
        </Kpi>
        <Kpi tone="red" icon="relance" label="Relances envoyées" value={d.reminders.total} trend={d.reminders} days={days}>
          {plural(d.reminders.delivered, "livrée")} · {plural(d.reminders.read, "lue")}
        </Kpi>
        <Kpi tone="neutral" icon="message" label="Messages en file" value={d.messages_queued}>
          en attente d&apos;envoi
        </Kpi>
        <Kpi
          tone="red"
          icon="alerte"
          label="Échecs d'envoi"
          value={d.messages_failed.total}
          badge={
            d.messages_failed.new ? (
              <span className="text-[12px] font-semibold text-status-unreachable" title={`Sur les ${days} derniers jours`}>
                ↑ +{d.messages_failed.new.toLocaleString("fr-FR")}
              </span>
            ) : null
          }
        >
          messages WhatsApp
        </Kpi>
        <Kpi tone="neutral" icon="qr-code" label="Entrées (QR)" value={d.checkins}>
          <Share part={d.checkins} whole={confirmed} bar="bg-primary" title="des invités confirmés" />
        </Kpi>
        <Kpi tone="neutral" icon="telephone" label="Appels prévus" value={d.calls_scheduled}>
          à passer
        </Kpi>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className={`${CARD} flex flex-col gap-6 p-6 lg:col-span-4`} aria-label="Événements par statut">
          <h2 className="font-heading text-[15px] font-semibold">Événements par statut</h2>
          <div className="my-auto">
            <Donut
              total={d.events.total}
              label={d.events.total > 1 ? "événements" : "événement"}
              parts={[
                { label: "Actifs", value: d.events_by_status.active, color: "var(--color-primary)" },
                { label: "Terminés", value: d.events_by_status.done, color: "var(--color-ink)" },
                { label: "Brouillons", value: d.events_by_status.draft, color: "var(--color-gray-500)" },
                { label: "Annulés", value: d.events_by_status.cancelled, color: "var(--color-amber-light)" },
              ]}
            />
          </div>
        </section>

        <section className={`${CARD} p-6 lg:col-span-4`} aria-label="Événements à venir">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading text-[15px] font-semibold">Événements à venir</h2>
            <SeeAll href="/admin/evenements?periode=a-venir" />
          </div>
          {upcoming.items.length ? (
            <ul className="mt-4 grid gap-1">
              {upcoming.items.map((e) => (
                <li key={e.id} className="relative flex items-center gap-3 rounded-xl p-1.5 hover:bg-surface/60">
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${TONES.red}`}>
                    <Icon name={eventType(e.type).icon} width={18} height={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/admin/utilisateurs/${e.organizer_id}`}
                      className="block truncate text-[13px] font-semibold after:absolute after:inset-0"
                      title={`${e.title} · ${e.organizer_name}`}
                    >
                      {e.title}
                    </Link>
                    <span className="block truncate text-[11px] text-text-muted">
                      {formatShortDate(e.starts_at)} · {formatTime(e.starts_at)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] leading-tight text-text-muted">
                    <span className="block font-data text-[13px] font-semibold text-text tabular-nums">{e.guests.toLocaleString("fr-FR")}</span>
                    {e.guests > 1 ? "invités" : "invité"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[13px] text-text-muted">Aucun événement à venir.</p>
          )}
        </section>

        <Provider provider={d.provider} queued={d.messages_queued} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <DailyChart
          title="Évolution des inscriptions"
          kind="bar"
          days={series.map((p) => p.day)}
          series={[
            { label: "Organisateurs", one: "organisateur inscrit", many: "organisateurs inscrits", values: series.map((p) => p.organizers) },
            { label: "Invités", one: "invité ajouté", many: "invités ajoutés", values: series.map((p) => p.guests) },
          ]}
        />
        <DailyChart
          title="Activité des envois"
          kind="line"
          days={series.map((p) => p.day)}
          series={[
            { label: "Envoyés", one: "message envoyé", many: "messages envoyés", values: series.map((p) => p.sent) },
            { label: "Échecs", one: "échec", many: "échecs", values: series.map((p) => p.failed) },
          ]}
        />
        <ActivityFeed items={d.activity} />
      </div>

      <section className={`${CARD} p-6`} aria-label="Derniers organisateurs inscrits">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-[15px] font-semibold">Derniers organisateurs inscrits</h2>
          <SeeAll href="/admin/utilisateurs" label="Voir tous" />
        </div>
        {users.items.length ? (
          <div className="relative mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] tracking-[0.06em] text-text-muted uppercase">
                  {["Nom", "Téléphone", "E-mail", "Structure", "Ville", "Date", "Événements"].map((h) => (
                    <th key={h} scope="col" className={`pb-3 font-medium ${h === "Événements" ? "text-center" : "pr-4"}`}>
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="pb-3 text-right font-medium">
                    <span className="sr-only">Fiche</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {users.items.map((u, i) => (
                  <tr key={u.id} className="hover:bg-surface/60">
                    <td className="py-3.5 pr-4">
                      <span className="flex items-center gap-3 font-semibold">
                        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full font-heading text-[11px] font-bold ${AVATARS[i % AVATARS.length]}`}>
                          {u.first_name.charAt(0)}
                          {u.last_name.charAt(0)}
                        </span>
                        {u.first_name} {u.last_name}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 font-data whitespace-nowrap text-text-muted tabular-nums">{maskPhone(u.phone)}</td>
                    <td className="py-3.5 pr-4 text-text-muted">{u.email ?? "—"}</td>
                    <td className="py-3.5 pr-4 text-text-muted">{u.organization ?? "—"}</td>
                    <td className="py-3.5 pr-4 text-text-muted">{u.city ?? "—"}</td>
                    <td className="py-3.5 pr-4 text-[12px] whitespace-nowrap text-text-muted">{formatShortDate(u.created_at)}</td>
                    <td className="py-3.5 text-center font-data font-semibold tabular-nums">{u.events.toLocaleString("fr-FR")}</td>
                    <td className="py-3.5 text-right">
                      <SeeButton href={`/admin/utilisateurs/${u.id}`} name={`${u.first_name} ${u.last_name}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 flex items-center gap-1.5 text-[12px] text-text-muted">
              <Icon name="cadenas" width={14} height={14} />
              Liste privée : numéros masqués.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-text-muted">Aucun organisateur inscrit pour l&apos;instant.</p>
        )}
      </section>
    </>
  );
}

function Kpi({
  tone,
  icon,
  label,
  value,
  trend,
  days,
  badge,
  children,
}: {
  tone: Tone;
  icon: IconName;
  label: string;
  value: number;
  trend?: Trend;
  days?: number;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`${CARD} flex flex-col p-4`}>
      <span className={`mb-3 flex size-8 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <Icon name={icon} width={16} height={16} />
      </span>
      <p className="text-[12px] leading-snug font-medium text-text-muted">{label}</p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
        <span className="font-data text-[24px] font-bold tracking-[-0.02em] tabular-nums">{value.toLocaleString("fr-FR")}</span>
        {badge ??
          (trend && trend.trend_pct !== null && trend.new > 0 ? (
            <span className="text-[12px] font-semibold text-status-confirmed" title={`Hausse sur les ${days} derniers jours`}>
              ↑ +{trend.trend_pct.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %
            </span>
          ) : null)}
      </p>
      <div className="mt-1 text-[11px] leading-snug text-text-muted">{children}</div>
    </div>
  );
}

function Share({ part, whole, bar, title }: { part: number; whole: number; bar: string; title?: string }) {
  const ratio = whole ? Math.min(part / whole, 1) : 0;
  return (
    <span className="flex items-center gap-2" title={title}>
      <span className="font-data font-medium tabular-nums">{percent(part, whole)}</span>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-surface" aria-hidden="true">
        <span className={`block h-full rounded-full ${bar}`} style={{ width: `${ratio * 100}%` }} />
      </span>
    </span>
  );
}

function Provider({ provider, queued }: { provider: AdminDashboard["provider"]; queued: number }) {
  const live = provider.name === "wasender";
  const ok = !live || provider.configured;
  const rows: { icon: IconName; label: string; value: ReactNode }[] = [
    { icon: "parametres", label: "Mode", value: live ? "Production" : "Test" },
    {
      icon: "cadenas",
      label: "Clé API",
      value: !live ? (
        "Sans objet"
      ) : provider.configured ? (
        <span className="flex items-center gap-1 text-status-confirmed">
          <Icon name="valide" width={14} height={14} />
          Configurée
        </span>
      ) : (
        <span className="flex items-center gap-1 text-status-unreachable">
          <Icon name="alerte" width={14} height={14} />
          Absente
        </span>
      ),
    },
    { icon: "horloge", label: "Cadence", value: `${provider.min_delay_seconds} à ${provider.max_delay_seconds} s par invité` },
    { icon: "calendrier", label: "Heures d'envoi", value: `${provider.send_start_hour} h – ${provider.send_end_hour} h` },
    { icon: "message", label: "En file", value: plural(queued, "message") },
  ];
  return (
    <section className={`${CARD} flex flex-col p-6 lg:col-span-4`} aria-label="Prestataire WhatsApp">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-[15px] font-semibold">Prestataire WhatsApp</h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
            ok ? "bg-status-confirmed/10 text-status-confirmed" : "bg-status-unreachable/10 text-status-unreachable"
          }`}
        >
          <Icon name={ok ? "valide" : "alerte"} width={14} height={14} />
          {ok ? "Configuré" : "Non configuré"}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-status-confirmed/15 bg-status-confirmed/8 p-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-status-confirmed text-white shadow-sm">
          <Icon name="message" width={20} height={20} />
        </span>
        <span>
          <span className="block text-[13px] font-semibold">{live ? "WasenderAPI" : "Mode test"}</span>
          <span className="block text-[11px] text-text-muted">{live ? "En production" : "Les messages sont seulement simulés"}</span>
        </span>
      </div>
      <dl className="mt-3 divide-y divide-border/60 text-[13px]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 py-2">
            <dt className="flex items-center gap-2 text-text-muted">
              <Icon name={r.icon} width={15} height={15} />
              {r.label}
            </dt>
            <dd className="text-right font-semibold">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const ACTIVITY: Record<Activity["kind"], { icon: IconName; tone: Tone }> = {
  organizer: { icon: "profil", tone: "green" },
  event: { icon: "calendrier", tone: "red" },
  invitations: { icon: "envoyer", tone: "neutral" },
  responses: { icon: "valide", tone: "green" },
  failures: { icon: "alerte", tone: "red" },
};

const clock = new Intl.DateTimeFormat("fr-FR", { timeZone: EVENT_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const dayKey = new Intl.DateTimeFormat("fr-CA", { timeZone: EVENT_TIME_ZONE });

function when(iso: string): string {
  const time = clock.format(new Date(iso)).replace(":", " h ");
  return dayKey.format(new Date(iso)) === dayKey.format(new Date()) ? time : `${formatShortDate(iso).replace(/ \d{4}$/, "")} · ${time}`;
}

function ActivityFeed({ items }: { items: Activity[] }) {
  return (
    <section className={`${CARD} p-6 lg:col-span-4`} aria-label="Dernières activités">
      <h2 className="font-heading text-[15px] font-semibold">Dernières activités</h2>
      {items.length ? (
        <ul className="mt-4 grid gap-3.5">
          {items.slice(0, 6).map((a) => (
            <li key={`${a.kind}-${a.at}-${a.detail}`} className="flex items-center gap-3">
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${TONES[ACTIVITY[a.kind].tone]}`}>
                <Icon name={ACTIVITY[a.kind].icon} width={16} height={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold">{a.title}</span>
                <span className="block truncate text-[12px] text-text-muted" title={a.detail}>
                  {a.detail}
                </span>
              </span>
              <span className="shrink-0 self-start font-data text-[11px] text-text-muted tabular-nums">{when(a.at)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[13px] text-text-muted">Aucune activité pour l&apos;instant.</p>
      )}
    </section>
  );
}
