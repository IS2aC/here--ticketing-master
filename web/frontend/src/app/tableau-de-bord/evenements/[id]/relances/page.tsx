import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Toast } from "@/components/toast";
import { EVENT_TIME_ZONE } from "@/lib/event-types";
import { formatDate, getEvent } from "@/lib/events";
import { getWhatsApp, sentTotal, type MessageStatus } from "@/lib/whatsapp";
import { Steps } from "../../steps";
import { sendInvitations, sendReminders, updateSettings } from "./actions";
import { SendButton, SettingsForm } from "./controls";

export const metadata: Metadata = { title: "Les relances · Here!" };

// Statut d'un message : toujours icône + mot + couleur (DESIGN.md).
const STATUS: Record<MessageStatus, { label: string; icon: IconName; className: string }> = {
  scheduled: { label: "En file", icon: "horloge", className: "text-status-pending" },
  sending: { label: "En cours", icon: "envoyer", className: "text-status-pending" },
  sent: { label: "Envoyé", icon: "envoyer", className: "text-text" },
  delivered: { label: "Livré", icon: "valide", className: "text-text" },
  read: { label: "Lu", icon: "valide", className: "text-status-confirmed" },
  failed: { label: "Échec", icon: "alerte", className: "text-status-unreachable" },
  canceled: { label: "Annulé", icon: "decline", className: "text-status-declined" },
};

const shortDate = new Intl.DateTimeFormat("fr-FR", {
  timeZone: EVENT_TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function when(iso: string): string {
  return shortDate.format(new Date(iso)).replace(":", " h ");
}

function plural(n: number, one: string, many: string = `${one}s`): string {
  return `${n.toLocaleString("fr-FR")} ${n > 1 ? many : one}`;
}

export default function RemindersPage({ params, searchParams }: PageProps<"/tableau-de-bord/evenements/[id]/relances">) {
  return (
    <Suspense fallback={<div className="h-[640px] rounded-lg bg-background" aria-busy="true" />}>
      <RemindersView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function RemindersView({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const [event, wa, query] = await Promise.all([getEvent(id), getWhatsApp(id), searchParams]);
  const sentInvitations = sentTotal(wa.invitations);
  const sentReminders = sentTotal(wa.reminders);
  const queued = wa.invitations.scheduled + wa.reminders.scheduled;
  const justSent = Number(query.envoyees);
  const justReminded = Number(query.relances);
  // Un seul bouton rouge : l'envoi des invitations s'il en reste, sinon la relance.
  const reminderIsPrimary = wa.ready === 0;
  const days = wa.reminder_days_before;
  const schedule =
    days.length === 0
      ? "avant l'événement"
      : `${days.length > 1 ? `${days.slice(0, -1).join(", ")} et ${days.at(-1)}` : days[0]} jours avant l'événement`;

  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[12px] text-text-muted">
            <Link href={`/tableau-de-bord/evenements/${event.id}`} className="hover:underline">
              {event.title}
            </Link>{" "}
            · Relances
          </p>
          <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">Relances et invitations</h1>
          <p className="mt-1 text-[14px] text-text-muted">Organisez votre cérémonie. Les relances, on s&apos;en charge.</p>
        </div>
        <Steps current={4} />
      </header>

      {wa.provider === "console" ? (
        <p className="flex items-start gap-3 rounded-md bg-ink p-4 text-[13px] text-white">
          <Icon name="alerte" width={18} height={18} className="mt-0.5 shrink-0 text-amber-light" />
          <span>
            <b className="font-semibold">Mode test.</b> Aucun message ne part réellement vers vos invités : les envois sont seulement
            simulés.
          </span>
        </p>
      ) : !wa.configured ? (
        <p className="flex items-start gap-3 rounded-md bg-ink p-4 text-[13px] text-white">
          <Icon name="alerte" width={18} height={18} className="mt-0.5 shrink-0 text-amber-light" />
          <span>
            <b className="font-semibold">Envoi WhatsApp non configuré.</b> Les messages restent en file jusqu&apos;au branchement du
            numéro Here!.
          </span>
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-6">
          <section aria-label="Envois" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon="invitation" label="Invitations" value={sentInvitations} detail={`envoyées · ${plural(wa.invitations.read, "lue")}`} />
            <Stat icon="relance" label="Relances" value={sentReminders} detail={`${plural(wa.to_remind, "invité")} sans réponse`} />
            <Stat icon="horloge" label="En file" value={queued} detail="envoi progressif" className="text-status-pending" />
            <Stat
              icon="alerte"
              label="Échecs"
              value={wa.invitations.failed + wa.reminders.failed}
              detail={`${plural(wa.calls_scheduled, "appel")} prévu${wa.calls_scheduled > 1 ? "s" : ""}`}
              className="text-status-unreachable"
            />
          </section>

          <section className="rounded-lg bg-background p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-heading text-[16px] font-semibold">Derniers messages</h2>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-text-muted">
                <Icon name="cadenas" width={14} height={14} />
                Visible par vous et votre conseillère
              </span>
            </div>
            {wa.recent.length === 0 ? (
              <p className="text-[14px] text-text-muted">Aucun message pour l&apos;instant. Les envois apparaîtront ici, invité par invité.</p>
            ) : (
              <ul className="divide-y divide-border">
                {wa.recent.map((m) => {
                  const s = STATUS[m.status];
                  return (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-[14px]">
                      <span className="min-w-0">
                        <span className="font-semibold">{m.guest_name}</span>
                        <span className="block text-[12px] text-text-muted">
                          {m.kind === "invitation" ? "Invitation" : "Relance"} · {when(m.sent_at ?? m.scheduled_at)}
                          {m.status === "failed" && m.error ? ` · ${m.error}` : ""}
                        </span>
                      </span>
                      <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${s.className}`}>
                        <Icon name={s.icon} width={15} height={15} />
                        {s.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {wa.inbound.length ? (
            <section className="rounded-lg bg-background p-5 shadow-sm">
              <h2 className="mb-3 font-heading text-[16px] font-semibold">Messages de vos invités</h2>
              <ul className="grid gap-2">
                {wa.inbound.map((m) => (
                  <li key={m.id} className="rounded-md bg-surface p-3 text-[14px]">
                    <span className="flex justify-between gap-3 text-[12px] text-text-muted">
                      <span className="font-semibold text-text">{m.guest_name ?? "Numéro inconnu"}</span>
                      {when(m.received_at)}
                    </span>
                    <span className="mt-1 block">{m.body}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="order-first grid content-start gap-4 lg:order-none">
          <div className="grid gap-3 rounded-lg bg-background p-5 shadow-sm">
            <p className="flex items-center gap-2 font-heading text-[16px] font-semibold">
              <Icon name="message" width={20} height={20} className="text-primary" />
              Envoi sur WhatsApp
            </p>
            {wa.ready > 0 ? (
              <>
                <p className="text-[14px]">
                  <span className="font-semibold">{plural(wa.ready, "invitation prête", "invitations prêtes")}</span>
                  <span className="block text-text-muted">
                    Chaque invité reçoit sa carte, le lien de sa page et un sondage « Oui / Non ».
                  </span>
                </p>
                <SendButton
                  action={sendInvitations.bind(null, event.id)}
                  label={`Envoyer ${plural(wa.ready, "invitation")}`}
                  pendingLabel="Mise en file…"
                  icon="envoyer"
                />
              </>
            ) : sentInvitations + wa.invitations.scheduled > 0 ? (
              <p className="flex items-start gap-2 text-[14px]">
                <Icon name="valide" width={18} height={18} className="mt-0.5 shrink-0 text-success" />
                <span>
                  <span className="font-semibold">Toutes les invitations sont parties ou en file.</span>
                  <span className="block text-text-muted">Les réponses arrivent dans la liste de vos invités.</span>
                </span>
              </p>
            ) : (
              <p className="text-[14px] text-text-muted">
                Préparez d&apos;abord les cartes de vos invités.{" "}
                <Link href={`/tableau-de-bord/evenements/${event.id}/carte`} className="font-semibold text-accent-text hover:underline">
                  Étape 3 : la carte
                </Link>
              </p>
            )}
            {wa.without_phone > 0 || wa.without_card > 0 ? (
              <p className="flex items-start gap-2 text-[13px] text-status-pending">
                <Icon name="alerte" width={16} height={16} className="mt-0.5 shrink-0" />
                <span>
                  {wa.without_phone > 0 ? `${plural(wa.without_phone, "invité")} sans numéro valide. ` : ""}
                  {wa.without_card > 0 ? `${plural(wa.without_card, "invité")} sans carte préparée.` : ""}
                </span>
              </p>
            ) : null}
            <p className="text-[12px] text-text-muted">
              Envoi progressif, un invité à la fois, de 8 h à 20 h : environ 30 invités par heure, pour protéger le numéro d&apos;envoi.
            </p>
          </div>

          <div className="grid gap-3 rounded-lg bg-background p-5 shadow-sm">
            <p className="flex items-center gap-2 font-heading text-[16px] font-semibold">
              <Icon name="relance" width={20} height={20} />
              Relancer
            </p>
            <p className="text-[14px] text-text-muted">
              {wa.to_remind > 0
                ? `${plural(wa.to_remind, "invité")} n'${wa.to_remind > 1 ? "ont" : "a"} pas encore répondu.`
                : "Aucun invité à relancer pour l'instant."}
            </p>
            {wa.reminders_enabled && wa.reminder_dates.length ? (
              <p className="flex items-start gap-2 text-[13px]">
                <Icon name="calendrier" width={16} height={16} className="mt-0.5 shrink-0 text-text-muted" />
                <span>
                  Relance prévue le{wa.reminder_dates.length > 1 ? "s" : ""}{" "}
                  <span className="font-semibold">{wa.reminder_dates.map((d) => formatDate(d).toLocaleLowerCase("fr-FR")).join(", ")}</span>
                </span>
              </p>
            ) : null}
            {wa.on_demand_reminders && wa.to_remind > 0 ? (
              <SendButton
                action={sendReminders.bind(null, event.id)}
                label="Relancer maintenant"
                pendingLabel="Mise en file…"
                icon="relance"
                variant={reminderIsPrimary ? "primary" : "ghost"}
              />
            ) : null}
            <SettingsForm
              action={updateSettings.bind(null, event.id)}
              remindersEnabled={wa.reminders_enabled}
              callsEnabled={wa.calls_enabled}
              schedule={schedule}
            />
          </div>
        </aside>
      </div>
      {justSent > 0 ? (
        <Toast title={`${plural(justSent, "invitation mise", "invitations mises")} en file`} detail="Elles partent une à une sur WhatsApp." />
      ) : justReminded > 0 ? (
        <Toast title={`${plural(justReminded, "relance programmée", "relances programmées")}`} detail="Seuls les invités sans réponse sont relancés." />
      ) : null}
    </>
  );
}

function Stat({
  icon,
  label,
  value,
  detail,
  className = "text-text",
}: {
  icon: IconName;
  label: string;
  value: number;
  detail: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg bg-background p-4 shadow-sm">
      <p className={`flex items-center gap-2 text-[13px] font-medium ${className}`}>
        <Icon name={icon} width={18} height={18} />
        {label}
      </p>
      <p className="mt-1 font-data text-[28px] font-semibold tracking-[-0.02em] tabular-nums">{value.toLocaleString("fr-FR")}</p>
      <p className="text-[12px] text-text-muted">{detail}</p>
    </div>
  );
}
