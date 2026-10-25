import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Toast } from "@/components/toast";
import { ButtonLink } from "@/components/ui";
import { eventType } from "@/lib/event-types";
import { formatDate, formatDuration, formatTime, getEvent, type EventOut } from "@/lib/events";
import { getGuests, type GuestOut } from "@/lib/guests";
import { maskPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Événement · Here!" };

export default function EventPage({ params, searchParams }: PageProps<"/tableau-de-bord/evenements/[id]">) {
  return (
    <Suspense fallback={<EventSkeleton />}>
      <EventView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const STATUS_LABELS: Record<EventOut["status"], string> = {
  draft: "Brouillon",
  active: "En cours",
  done: "Terminé",
  cancelled: "Annulé",
};

const RSVP: Record<GuestOut["rsvp_status"], { icon: IconName; label: string; tone: string }> = {
  pending: { icon: "horloge", label: "En attente", tone: "text-status-pending" },
  confirmed: { icon: "valide", label: "Confirmé", tone: "text-status-confirmed" },
  declined: { icon: "decline", label: "Décliné", tone: "text-status-declined" },
};

async function EventView({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const [event, guests, query] = await Promise.all([getEvent(id), getGuests(id), searchParams]);
  const type = eventType(event.type);
  const imported = Number(query.importes);
  const importUrl = `/tableau-de-bord/evenements/${event.id}/invites/importer`;

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[12px] text-text-muted">
            <Link href="/tableau-de-bord" className="hover:underline">
              Mes événements
            </Link>{" "}
            · {type.label}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[26px] font-bold tracking-[-0.01em] break-words">{event.title}</h1>
            <span className="inline-flex h-[22px] items-center rounded-sm bg-background px-2 text-[11px] font-semibold tracking-[0.04em] uppercase shadow-[inset_0_0_0_1px_var(--color-border)]">
              {STATUS_LABELS[event.status]}
            </span>
          </div>
          <p className="mt-1 text-[14px] text-text-muted">
            {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
          </p>
        </div>
        <ButtonLink href={`/tableau-de-bord/evenements/${event.id}/modifier`} variant="ghost" className="h-10 shrink-0 text-[14px]">
          <Icon name="modifier" width={18} height={18} />
          Modifier
        </ButtonLink>
      </header>

      <section aria-label="Réponses" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="participants" label="Invités" value={event.stats.guests} className="text-text" />
        <Stat icon="valide" label="Confirmés" value={event.stats.confirmed} className="text-status-confirmed" />
        <Stat icon="horloge" label="En attente" value={event.stats.pending} className="text-status-pending" />
        <Stat icon="decline" label="Déclinés" value={event.stats.declined} className="text-status-declined" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {guests.length ? (
          <GuestList guests={guests} importUrl={importUrl} />
        ) : (
          // État vide (DESIGN.md) : la prochaine étape est l'import de la liste.
          <section className="flex flex-col items-center gap-3 rounded-lg bg-background px-6 py-14 text-center shadow-sm">
            <div className="flex size-16 items-center justify-center rounded-full bg-surface text-text-muted">
              <Icon name="importer" width={28} height={28} />
            </div>
            <h2 className="font-heading text-[18px] font-semibold">Votre liste d&apos;invités est vide</h2>
            <p className="max-w-md text-[14px] text-text-muted">
              Importez votre fichier Excel ou CSV : nous vérifions les numéros avant d&apos;envoyer les invitations.
            </p>
            <ButtonLink href={importUrl} className="mt-2 h-10 text-[14px]">
              <Icon name="importer" width={18} height={18} />
              Importer la liste
            </ButtonLink>
          </section>
        )}

        <aside className="grid content-start gap-5 rounded-lg bg-background p-5 shadow-sm">
          <h2 className="font-heading text-[16px] font-semibold">L&apos;événement</h2>
          <dl className="grid gap-4 text-[14px]">
            <Info icon={type.icon} label="Type">
              {type.label}
            </Info>
            <Info icon="calendrier" label="Date">
              {formatDate(event.starts_at)}, {formatTime(event.starts_at)}
              {event.duration_minutes ? ` · ${formatDuration(event.duration_minutes)}` : null}
            </Info>
            {event.location_name || event.location_address ? (
              <Info icon="lieu" label="Lieu">
                {event.location_name}
                {event.location_address ? <span className="block text-text-muted">{event.location_address}</span> : null}
              </Info>
            ) : null}
            {event.expected_guests !== null ? (
              <Info icon="participants" label="Invités prévus">
                <span className="font-data tabular-nums">{event.expected_guests.toLocaleString("fr-FR")}</span>
              </Info>
            ) : null}
            {event.dress_code ? (
              <Info icon="etiquette" label="Dress code">
                {event.dress_code}
              </Info>
            ) : null}
          </dl>
          {event.description ? <p className="text-[14px] whitespace-pre-line text-text-muted">{event.description}</p> : null}
          <div className="grid gap-2 border-t border-border pt-4">
            <h3 className="text-[13px] font-medium text-text-muted">Catégories d&apos;invités</h3>
            <ul className="flex flex-wrap gap-2">
              {event.categories.map((c) => (
                <li key={c.id} className="inline-flex h-8 items-center gap-2 rounded-full bg-surface px-3 text-[13px] font-medium">
                  {c.name}
                  <span className="font-data text-[12px] text-text-muted tabular-nums">{c.guests}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
      {imported > 0 ? (
        <Toast
          title={`${imported.toLocaleString("fr-FR")} invité${imported > 1 ? "s" : ""} importé${imported > 1 ? "s" : ""}`}
          detail="Votre liste est à jour."
        />
      ) : null}
    </>
  );
}

function GuestList({ guests, importUrl }: { guests: GuestOut[]; importUrl: string }) {
  const toCheck = guests.filter((g) => !g.phone_valid).length;
  return (
    <section className="grid min-w-0 content-start gap-4 rounded-lg bg-background p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-[16px] font-semibold">
            Invités <span className="font-data text-text-muted tabular-nums">{guests.length.toLocaleString("fr-FR")}</span>
          </h2>
          {toCheck ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold text-status-pending">
              <Icon name="alerte" width={15} height={15} />
              {toCheck} numéro{toCheck > 1 ? "s" : ""} à vérifier avant l&apos;envoi
            </p>
          ) : null}
        </div>
        <ButtonLink href={importUrl} className="h-10 text-[14px]">
          <Icon name="importer" width={18} height={18} />
          Importer des invités
        </ButtonLink>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-text-muted">
              {["Invité", "Numéro", "Catégorie", "Position", "Réponse"].map((h) => (
                <th key={h} className="border-b border-border px-3 pb-2 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => {
              const rsvp = RSVP[g.rsvp_status];
              return (
                <tr key={g.id}>
                  <td className="border-b border-border px-3 py-2.5 font-semibold">{g.display_name}</td>
                  <td className="border-b border-border px-3 py-2.5 whitespace-nowrap">
                    {g.phone && g.phone_valid ? (
                      <span className="font-data tabular-nums">{maskPhone(g.phone)}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-status-pending">
                        <Icon name="alerte" width={14} height={14} />
                        {g.phone ? "À vérifier" : "Manquant"}
                      </span>
                    )}
                  </td>
                  <td className="border-b border-border px-3 py-2.5">
                    <span className="inline-flex h-[22px] items-center rounded-sm bg-surface px-2 text-[11px] font-semibold tracking-[0.04em] uppercase">
                      {g.category}
                    </span>
                  </td>
                  <td className="border-b border-border px-3 py-2.5 whitespace-nowrap">{g.seat ?? "—"}</td>
                  <td className={`border-b border-border px-3 py-2.5 font-semibold whitespace-nowrap ${rsvp.tone}`}>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name={rsvp.icon} width={15} height={15} />
                      {rsvp.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-1.5 text-[12px] text-text-muted">
        <Icon name="cadenas" width={14} height={14} />
        Liste privée : les numéros sont masqués.
      </p>
    </section>
  );
}

function Stat({ icon, label, value, className }: { icon: IconName; label: string; value: number; className: string }) {
  return (
    <div className="rounded-lg bg-background p-4 shadow-sm">
      <p className={`flex items-center gap-1.5 text-[13px] font-semibold ${className}`}>
        <Icon name={icon} width={16} height={16} />
        {label}
      </p>
      <p className="mt-2 font-data text-[28px] font-semibold tabular-nums">{value.toLocaleString("fr-FR")}</p>
    </div>
  );
}

function Info({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon name={icon} width={18} height={18} className="mt-0.5 shrink-0 text-text-muted" />
      <div className="min-w-0">
        <dt className="text-[12px] text-text-muted">{label}</dt>
        <dd className="break-words">{children}</dd>
      </div>
    </div>
  );
}

function EventSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true">
      <div className="h-16 w-80 max-w-full rounded-md bg-background" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[92px] rounded-lg bg-background" />
        ))}
      </div>
      <div className="h-72 rounded-lg bg-background" />
    </div>
  );
}
