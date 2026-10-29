import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon, type IconName } from "@/components/icons";
import {
  getDashboard,
  getEvents,
  getUsers,
  PERIODS,
  type Activity,
  type AdminDashboard,
  type EventStatus,
  type Trend,
} from "@/lib/admin";
import { EVENT_TIME_ZONE, eventType } from "@/lib/event-types";
import { formatShortDate, formatTime } from "@/lib/events";
import { maskPhone } from "@/lib/phone";
import { DailyChart } from "./charts";

export const metadata: Metadata = { title: "Portail admin · Here!" };

function plural(n: number, one: string, many: string = `${one}s`): string {
  return `${n.toLocaleString("fr-FR")} ${n > 1 ? many : one}`;
}

function percent(part: number, whole: number): string {
  return whole ? `${((100 * part) / whole).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—";
}

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] text-text-muted">Admin · Tableau de bord</p>
          <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">Tableau de bord</h1>
          <p className="mt-1 text-[14px] text-text-muted">Vue d&apos;ensemble de la plateforme et de son activité.</p>
        </div>
        <Suspense fallback={null}>
          <PeriodPicker searchParams={searchParams} />
        </Suspense>
      </header>
      <Suspense fallback={<div className="h-[900px] rounded-lg bg-background" aria-busy="true" />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function period(searchParams: Promise<Record<string, string | string[] | undefined>>): Promise<number> {
  const days = Number((await searchParams).jours);
  return (PERIODS as readonly number[]).includes(days) ? days : 30;
}

async function PeriodPicker({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const days = await period(searchParams);
  return (
    <nav className="flex self-start rounded-full bg-background p-1 shadow-sm sm:self-auto" aria-label="Période">
      {PERIODS.map((d) => (
        <Link
          key={d}
          href={d === 30 ? "/admin" : `/admin?jours=${d}`}
          aria-current={d === days ? "page" : undefined}
          className={`flex h-8 items-center rounded-full px-3 text-[13px] font-semibold ${
            d === days ? "bg-ink text-white" : "text-text-muted hover:text-text"
          }`}
        >
          {d} jours
        </Link>
      ))}
    </nav>
  );
}

async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const days = await period(searchParams);
  const [d, upcoming, users] = await Promise.all([getDashboard(days), getEvents({ period: "upcoming", limit: 4 }), getUsers(5)]);
  const guests = d.guests.total;
  const confirmed = d.rsvp.confirmed;

  return (
    <>
      <section aria-label="Chiffres clés" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi icon="participants" label="Organisateurs" value={d.organizers.total} trend={d.organizers} detail={`dont ${plural(d.organizers.new, "nouveau", "nouveaux")}`} days={days} />
        <Kpi
          icon="calendrier"
          label="Événements"
          value={d.events.total}
          trend={d.events}
          detail={`${d.upcoming_events.toLocaleString("fr-FR")} à venir · ${plural(d.events_by_status.done, "terminé")}`}
          days={days}
        />
        <Kpi icon="invitation" label="Invités" value={guests} trend={d.guests} detail="tous événements" days={days} />
        <Kpi icon="valide" label="Confirmés" value={confirmed} share={[confirmed, guests]} tone="text-status-confirmed" bar="bg-status-confirmed" />
        <Kpi icon="horloge" label="En attente" value={d.rsvp.pending} share={[d.rsvp.pending, guests]} tone="text-status-pending" bar="bg-status-pending" />
        <Kpi icon="decline" label="Déclinés" value={d.rsvp.declined} share={[d.rsvp.declined, guests]} tone="text-status-declined" bar="bg-status-declined" />
        <Kpi
          icon="envoyer"
          label="Invitations envoyées"
          value={d.invitations.total}
          trend={d.invitations}
          detail={`${plural(d.invitations.delivered, "livrée")} · ${plural(d.invitations.read, "lue")}`}
          days={days}
        />
        <Kpi
          icon="relance"
          label="Relances envoyées"
          value={d.reminders.total}
          trend={d.reminders}
          detail={`${plural(d.reminders.delivered, "livrée")} · ${plural(d.reminders.read, "lue")}`}
          days={days}
        />
        <Kpi icon="message" label="Messages en file" value={d.messages_queued} detail="en attente d'envoi" />
        <Kpi
          icon="alerte"
          label="Échecs d'envoi"
          value={d.messages_failed.total}
          detail={`${d.messages_failed.new ? `+${d.messages_failed.new.toLocaleString("fr-FR")}` : "aucun"} sur ${days} jours`}
          tone={d.messages_failed.new ? "text-status-unreachable" : "text-text"}
        />
        <Kpi icon="qr-code" label="Entrées (QR)" value={d.checkins} share={[d.checkins, confirmed]} shareLabel="des confirmés" bar="bg-ink" />
        <Kpi icon="support" label="Appels prévus" value={d.calls_scheduled} detail="à passer par la conseillère" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_360px]">
        <StatusBreakdown byStatus={d.events_by_status} />
        <section className="rounded-lg bg-background p-5 shadow-sm" aria-label="Événements à venir">
          <h2 className="font-heading text-[16px] font-semibold">Événements à venir</h2>
          {upcoming.items.length ? (
            <ul className="mt-3 divide-y divide-border">
              {upcoming.items.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface">
                    <Icon name={eventType(e.type).icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold" title={e.title}>
                      {e.title}
                    </span>
                    <span className="block text-[12px] text-text-muted">
                      {formatShortDate(e.starts_at)} · {formatTime(e.starts_at)} · {e.organizer_name}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[12px] text-text-muted">
                    <span className="block font-data text-[14px] font-semibold text-text tabular-nums">{e.guests.toLocaleString("fr-FR")}</span>
                    {e.guests > 1 ? "invités" : "invité"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-text-muted">Aucun événement à venir.</p>
          )}
        </section>
        <Provider provider={d.provider} queued={d.messages_queued} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_360px]">
        <DailyChart
          title="Évolution des inscriptions"
          kind="bar"
          days={d.series.map((p) => p.day)}
          series={[
            { key: "organizers", label: "Organisateurs", one: "inscription", many: "inscriptions", values: d.series.map((p) => p.organizers) },
            { key: "guests", label: "Invités", one: "invité ajouté", many: "invités ajoutés", values: d.series.map((p) => p.guests) },
          ]}
        />
        <DailyChart
          title="Activité des envois"
          kind="line"
          days={d.series.map((p) => p.day)}
          series={[
            { key: "sent", label: "Envoyés", one: "message envoyé", many: "messages envoyés", values: d.series.map((p) => p.sent) },
            { key: "failed", label: "Échecs", one: "échec", many: "échecs", values: d.series.map((p) => p.failed) },
          ]}
        />
        <ActivityFeed items={d.activity} />
      </div>

      <section className="rounded-lg bg-background p-5 shadow-sm" aria-label="Derniers organisateurs inscrits">
        <h2 className="font-heading text-[16px] font-semibold">Derniers organisateurs inscrits</h2>
        {users.items.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="text-[12px] text-text-muted">
                <tr className="border-b border-border">
                  {["Nom", "Téléphone", "E-mail", "Structure", "Ville", "Inscription", "Événements"].map((h) => (
                    <th key={h} scope="col" className="py-2 pr-4 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.items.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2.5 pr-4">
                      <span className="flex items-center gap-2.5 font-semibold">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface font-heading text-[12px]">
                          {u.first_name.charAt(0)}
                          {u.last_name.charAt(0)}
                        </span>
                        {u.first_name} {u.last_name}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-data whitespace-nowrap tabular-nums">{maskPhone(u.phone)}</td>
                    <td className="py-2.5 pr-4">{u.email ?? "—"}</td>
                    <td className="py-2.5 pr-4">{u.organization ?? "—"}</td>
                    <td className="py-2.5 pr-4">{u.city ?? "—"}</td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">{formatShortDate(u.created_at)}</td>
                    <td className="py-2.5 pr-4 font-data tabular-nums">{u.events.toLocaleString("fr-FR")}</td>
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
          <p className="mt-3 text-[14px] text-text-muted">Aucun organisateur inscrit pour l&apos;instant.</p>
        )}
      </section>
    </>
  );
}

function Kpi({
  icon,
  label,
  value,
  trend,
  days,
  detail,
  share,
  shareLabel,
  tone = "text-text",
  bar,
}: {
  icon: IconName;
  label: string;
  value: number;
  trend?: Trend;
  days?: number;
  detail?: string;
  share?: [number, number];
  shareLabel?: string;
  tone?: string;
  bar?: string;
}) {
  const ratio = share && share[1] ? Math.min(share[0] / share[1], 1) : 0;
  return (
    <div className="rounded-lg bg-background p-4 shadow-sm">
      <p className="flex items-start gap-1.5 text-[13px] leading-snug font-medium text-text-muted">
        <Icon name={icon} width={16} height={16} className={`mt-px shrink-0 ${tone}`} />
        {label}
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="font-data text-[26px] font-semibold tracking-[-0.02em] tabular-nums">{value.toLocaleString("fr-FR")}</span>
        {trend && trend.trend_pct !== null && trend.new > 0 ? (
          <span className="text-[12px] font-semibold text-status-confirmed" title={`Hausse sur les ${days} derniers jours`}>
            ↑ +{trend.trend_pct.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %
          </span>
        ) : null}
      </p>
      {share ? (
        <>
          <p className="text-[12px] text-text-muted">
            {percent(share[0], share[1])}
            {shareLabel ? ` ${shareLabel}` : ""}
          </p>
          <div className="mt-2 h-1 rounded-full bg-surface" aria-hidden="true">
            <div className={`h-full rounded-full ${bar}`} style={{ width: `${ratio * 100}%` }} />
          </div>
        </>
      ) : detail ? (
        <p className="text-[12px] leading-snug text-text-muted">{detail}</p>
      ) : null}
    </div>
  );
}

const STATUS_LABELS: [EventStatus, string][] = [
  ["active", "Actifs"],
  ["done", "Terminés"],
  ["draft", "Brouillons"],
  ["cancelled", "Annulés"],
];

// Répartition : barres horizontales --color-ink avec valeur directe (DESIGN.md, « Graphiques »).
function StatusBreakdown({ byStatus }: { byStatus: Record<EventStatus, number> }) {
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const max = Math.max(...Object.values(byStatus), 1);
  return (
    <section className="rounded-lg bg-background p-5 shadow-sm" aria-label="Événements par statut">
      <h2 className="font-heading text-[16px] font-semibold">Événements par statut</h2>
      <p className="text-[13px] text-text-muted">{plural(total, "événement")} au total</p>
      <dl className="mt-4 grid gap-3">
        {STATUS_LABELS.map(([status, label]) => (
          <div key={status} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-[13px]">
            <dt className="text-text-muted">{label}</dt>
            <div className="h-2 rounded-full bg-surface" aria-hidden="true">
              <div className="h-full rounded-full bg-ink" style={{ width: `${(byStatus[status] / max) * 100}%` }} />
            </div>
            <dd className="w-24 text-right font-data tabular-nums">
              <span className="font-semibold">{byStatus[status].toLocaleString("fr-FR")}</span>{" "}
              <span className="text-text-muted">({percent(byStatus[status], total)})</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Provider({ provider, queued }: { provider: AdminDashboard["provider"]; queued: number }) {
  const live = provider.name === "wasender";
  const rows: [IconName, string, string][] = [
    ["envoyer", "Mode", live ? "Production" : "Test : aucun envoi réel"],
    ["cadenas", "Clé API", live ? (provider.configured ? "Configurée" : "Absente") : "Sans objet"],
    ["horloge", "Cadence", `1 invité toutes les ${provider.min_delay_seconds} à ${provider.max_delay_seconds} s`],
    ["calendrier", "Heures d'envoi", `${provider.send_start_hour} h – ${provider.send_end_hour} h`],
    ["message", "En file", plural(queued, "message")],
  ];
  const ok = !live || provider.configured;
  return (
    <section className="rounded-lg bg-background p-5 shadow-sm lg:col-span-2 xl:col-span-1" aria-label="Prestataire WhatsApp">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-[16px] font-semibold">Prestataire WhatsApp</h2>
        <span className={`flex items-center gap-1 text-[12px] font-semibold ${ok ? "text-status-confirmed" : "text-status-unreachable"}`}>
          <Icon name={ok ? "valide" : "alerte"} width={15} height={15} />
          {ok ? "Configuré" : "Non configuré"}
        </span>
      </div>
      <p className="mt-3 flex items-center gap-3 rounded-md bg-surface p-3">
        <Icon name="message" width={22} height={22} className={live ? "text-status-confirmed" : "text-text-muted"} />
        <span>
          <span className="block font-heading text-[15px] font-semibold">{live ? "WasenderAPI" : "Mode test"}</span>
          <span className="block text-[12px] text-text-muted">{live ? "Envoi réel sur WhatsApp" : "Les messages sont seulement simulés"}</span>
        </span>
      </p>
      <dl className="mt-2 divide-y divide-border text-[13px]">
        {rows.map(([icon, label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2">
            <dt className="flex items-center gap-2 text-text-muted">
              <Icon name={icon} width={15} height={15} />
              {label}
            </dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const ACTIVITY: Record<Activity["kind"], { icon: IconName; tone: string }> = {
  organizer: { icon: "participants", tone: "text-text" },
  event: { icon: "calendrier", tone: "text-text" },
  invitations: { icon: "envoyer", tone: "text-text" },
  responses: { icon: "valide", tone: "text-status-confirmed" },
  failures: { icon: "alerte", tone: "text-status-unreachable" },
};

const clock = new Intl.DateTimeFormat("fr-FR", { timeZone: EVENT_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const dayKey = new Intl.DateTimeFormat("fr-CA", { timeZone: EVENT_TIME_ZONE });

function when(iso: string): string {
  const time = clock.format(new Date(iso)).replace(":", " h ");
  return dayKey.format(new Date(iso)) === dayKey.format(new Date()) ? time : `${formatShortDate(iso).replace(/ \d{4}$/, "")} · ${time}`;
}

function ActivityFeed({ items }: { items: Activity[] }) {
  return (
    <section className="rounded-lg bg-background p-5 shadow-sm lg:col-span-2 xl:col-span-1" aria-label="Dernières activités">
      <h2 className="font-heading text-[16px] font-semibold">Dernières activités</h2>
      {items.length ? (
        <ul className="mt-3 grid gap-3">
          {items.map((a) => (
            <li key={`${a.kind}-${a.at}-${a.detail}`} className="flex gap-3">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-md bg-surface ${ACTIVITY[a.kind].tone}`}>
                <Icon name={ACTIVITY[a.kind].icon} width={18} height={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold">{a.title}</span>
                  <span className="shrink-0 font-data text-[12px] text-text-muted tabular-nums">{when(a.at)}</span>
                </span>
                <span className="block truncate text-[12px] text-text-muted" title={a.detail}>
                  {a.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[14px] text-text-muted">Aucune activité pour l&apos;instant.</p>
      )}
    </section>
  );
}
