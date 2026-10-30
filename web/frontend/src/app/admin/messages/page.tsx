import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon, type IconName } from "@/components/icons";
import { getCalls, getInbound, requireStaff, type CallOutcome, type StaffCall, type StaffMessage } from "@/lib/admin";
import { EVENT_TIME_ZONE, eventType } from "@/lib/event-types";
import { formatDate, formatShortDate, formatTime } from "@/lib/events";
import { formatPhone, localPhone } from "@/lib/phone";
import { recordCall, setHandled } from "../actions";
import { CARD, TONES } from "../ui";
import { CallForm } from "./call-form";

export const metadata: Metadata = { title: "Appels et messages · Portail admin · Here!" };

// Écran de la conseillère (rôles admin et support) : appels après la dernière relance, messages des invités.
type Query = Record<string, string | string[] | undefined>;

const OUTCOMES: Record<CallOutcome, { label: string; icon: IconName; tone: string }> = {
  confirmed: { label: "Confirmé", icon: "valide", tone: "text-status-confirmed" },
  declined: { label: "Décliné", icon: "decline", tone: "text-status-declined" },
  no_answer: { label: "Pas de réponse", icon: "horloge", tone: "text-status-pending" },
  wrong_number: { label: "Mauvais numéro", icon: "alerte", tone: "text-status-unreachable" },
};

const clock = new Intl.DateTimeFormat("fr-FR", { timeZone: EVENT_TIME_ZONE, hour: "2-digit", minute: "2-digit" });

function when(iso: string): string {
  return `${formatShortDate(iso).replace(/ \d{4}$/, "")} · ${clock.format(new Date(iso)).replace(":", " h ")}`;
}

export default function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  return (
    <>
      <header>
        <p className="text-[12px] font-medium tracking-[0.02em] text-text-muted">Admin · Messages</p>
        <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">Appels et messages</h1>
        <p className="mt-0.5 text-[13px] text-text-muted">
          Les invités à appeler après la dernière relance restée sans réponse, et les messages qu&apos;ils envoient sur WhatsApp.
        </p>
      </header>
      <Suspense fallback={<div className={`h-[640px] ${CARD}`} aria-busy="true" />}>
        <Screen searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Screen({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const view = query.vue === "messages" ? "messages" : "appels";
  const done = query.etat === "faits";
  const [agent, calls, inbound] = await Promise.all([requireStaff(), getCalls(view === "appels" && done), getInbound(view === "messages" && done)]);
  const href = (v: string, d: boolean) => `/admin/messages?${new URLSearchParams({ ...(v === "messages" ? { vue: v } : {}), ...(d ? { etat: "faits" } : {}) })}`;
  const tab = (on: boolean) =>
    `flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-semibold ${
      on ? "bg-background text-primary shadow-[inset_0_0_0_1.5px_var(--color-primary)]" : "text-text-muted hover:bg-background hover:text-text"
    }`;
  const count = "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface px-1.5 font-data text-[11px] tabular-nums";

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1" aria-label="Vue">
          <Link href={href("appels", false)} aria-current={view === "appels" ? "page" : undefined} className={tab(view === "appels")}>
            <Icon name="telephone" width={16} height={16} />
            Appels à passer <span className={count}>{calls.to_do}</span>
          </Link>
          <Link href={href("messages", false)} aria-current={view === "messages" ? "page" : undefined} className={tab(view === "messages")}>
            <Icon name="message" width={16} height={16} />
            Messages à traiter <span className={count}>{inbound.to_do}</span>
          </Link>
        </nav>
        <Link href={href(view, !done)} className="text-[13px] font-semibold text-accent-text hover:underline">
          {done ? "Voir ce qui reste à faire" : view === "appels" ? `Voir les appels passés (${calls.done})` : `Voir les messages traités (${inbound.done})`}
        </Link>
      </div>

      {view === "appels" ? (
        calls.items.length ? (
          <ul className="grid gap-4">
            {calls.items.map((c) => (
              <CallCard key={c.id} call={c} agent={agent.first_name} />
            ))}
          </ul>
        ) : (
          <Empty icon="telephone" title={done ? "Aucun appel passé pour l'instant" : "Aucun appel à passer"} detail="Les appels sont programmés deux jours après la dernière relance restée sans réponse." />
        )
      ) : inbound.items.length ? (
        <ul className="grid gap-3">
          {inbound.items.map((m) => (
            <MessageCard key={m.id} message={m} />
          ))}
        </ul>
      ) : (
        <Empty icon="message" title={done ? "Aucun message traité" : "Aucun message à traiter"} detail="Les messages libres des invités sur WhatsApp (« On sera 3 »…) arrivent ici." />
      )}
    </>
  );
}

function Empty({ icon, title, detail }: { icon: IconName; title: string; detail: string }) {
  return (
    <div className={`${CARD} flex flex-col items-center gap-3 px-6 py-14 text-center`}>
      <span className="flex size-16 items-center justify-center rounded-full bg-surface text-text-muted">
        <Icon name={icon} width={28} height={28} />
      </span>
      <p className="font-heading text-[18px] font-semibold">{title}</p>
      <p className="max-w-md text-[14px] text-text-muted">{detail}</p>
    </div>
  );
}

function CallCard({ call: c, agent }: { call: StaffCall; agent: string }) {
  const type = eventType(c.event_type);
  const tribute = c.event_type === "funerailles";
  const date = `${formatDate(c.event_starts_at).toLowerCase()} à ${formatTime(c.event_starts_at)}`;
  // Script d'appel (DESIGN.md, ton « Équipe ») ; sobre pour un hommage.
  const script = tribute
    ? `Bonjour, ici ${agent}, de l'équipe Here!. J'appelle de la part de ${c.host} au sujet de « ${c.event_title} », le ${date}. La famille vous remercie de lui faire savoir si vous pourrez venir.`
    : `Bonjour, ici ${agent}, de l'équipe Here!. J'appelle de la part de ${c.host} pour « ${c.event_title} », le ${date}. Pourrez-vous venir ?`;
  const outcome = c.outcome ? OUTCOMES[c.outcome] : null;
  return (
    <li className={`${CARD} grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]`}>
      <div className="grid content-start gap-3">
        <div className="flex items-start gap-3">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${TONES.red}`}>
            <Icon name={type.icon} width={20} height={20} />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-[17px] font-semibold break-words">
              {c.guest_name}
              {c.seats > 1 ? <span className="ml-1.5 font-data text-[13px] font-normal text-text-muted">· {c.seats} pers.</span> : null}
            </p>
            <p className="text-[13px] text-text-muted">
              {c.event_title} · {formatShortDate(c.event_starts_at)} · pour {c.host}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-text-muted">
              <span className="rounded-sm bg-surface px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-text uppercase">{c.category}</span>
              {c.reminders_sent} relance{c.reminders_sent > 1 ? "s" : ""} restée{c.reminders_sent > 1 ? "s" : ""} sans réponse
            </p>
          </div>
        </div>
        {c.phone ? (
          <a
            href={`tel:${c.phone}`}
            className="inline-flex h-11 items-center gap-2 justify-self-start rounded-full bg-ink px-5 font-heading text-[15px] font-semibold text-white hover:bg-ink-700"
          >
            <Icon name="telephone" width={18} height={18} />
            Appeler le {c.phone_valid ? localPhone(c.phone) : formatPhone(c.phone)}
          </a>
        ) : (
          <p className="text-[13px] font-semibold text-status-unreachable">Pas de numéro : à voir avec l&apos;organisateur.</p>
        )}
        <p className="rounded-xl bg-surface p-3 text-[13px] leading-relaxed italic">« {script} »</p>
      </div>
      <div className="grid content-start gap-3 lg:border-l lg:border-border/60 lg:pl-5">
        {c.called_at && outcome ? (
          <>
            <p className={`flex items-center gap-1.5 text-[14px] font-semibold ${outcome.tone}`}>
              <Icon name={outcome.icon} width={18} height={18} />
              {outcome.label}
            </p>
            <p className="text-[13px] text-text-muted">
              Appel du {when(c.called_at)}
              {c.agent_name ? ` · ${c.agent_name}` : ""}
            </p>
            {c.notes ? <p className="text-[14px] whitespace-pre-line">{c.notes}</p> : null}
          </>
        ) : (
          <CallForm action={recordCall.bind(null, c.id)} name={c.guest_name} />
        )}
      </div>
    </li>
  );
}

function MessageCard({ message: m }: { message: StaffMessage }) {
  return (
    <li className={`${CARD} flex flex-col gap-3 p-5 sm:flex-row sm:items-start`}>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${m.guest_id ? TONES.green : TONES.neutral}`}>
        <Icon name="message" width={20} height={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] whitespace-pre-line">« {m.body} »</p>
        <p className="mt-1 text-[13px] text-text-muted">
          {m.guest_name ? (
            <>
              <span className="font-semibold text-text">{m.guest_name}</span>
              {m.event_title ? ` · ${m.event_title}` : ""}
            </>
          ) : (
            <span className="font-semibold text-text">Numéro inconnu</span>
          )}
          {" · "}
          <span className="font-data tabular-nums">{formatPhone(m.phone)}</span> · {when(m.received_at)}
        </p>
      </div>
      <form action={setHandled.bind(null, m.id, !m.handled_at)} className="shrink-0">
        <button
          type="submit"
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface"
        >
          <Icon name={m.handled_at ? "relance" : "valide"} width={16} height={16} />
          {m.handled_at ? "Remettre à traiter" : "Marquer comme traité"}
        </button>
      </form>
    </li>
  );
}
