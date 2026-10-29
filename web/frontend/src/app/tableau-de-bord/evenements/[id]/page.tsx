import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon, type IconName } from "@/components/icons";
import { BackToDashboard } from "@/components/back-link";
import { Toast } from "@/components/toast";
import { ButtonLink } from "@/components/ui";
import { PHASE_LABELS, phaseOf } from "@/lib/event-phase";
import { eventType } from "@/lib/event-types";
import { formatDate, formatDuration, formatShortDate, formatTime, getEvent } from "@/lib/events";
import { getGuests, type GuestOut } from "@/lib/guests";
import { getWhatsApp, sentTotal, type WhatsAppOverview } from "@/lib/whatsapp";
import { maskPhone } from "@/lib/phone";
import { sendInvitations } from "./relances/actions";
import { SendButton } from "./relances/controls";

export const metadata: Metadata = { title: "Événement · Here!" };

export default function EventPage({ params, searchParams }: PageProps<"/tableau-de-bord/evenements/[id]">) {
  return (
    <Suspense fallback={<EventSkeleton />}>
      <EventView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

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
  const [event, guests, query, wa] = await Promise.all([
    getEvent(id),
    getGuests(id),
    searchParams,
    // Envoi WhatsApp : sans réponse de l'API, la liste s'affiche quand même, sans le bouton d'envoi.
    getWhatsApp(id).catch(() => null),
  ]);
  const type = eventType(event.type);
  const imported = Number(query.importes);
  const importUrl = `/tableau-de-bord/evenements/${event.id}/invites/importer`;

  return (
    <>
      <header className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div className="min-w-0 flex-1">
          <BackToDashboard />
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[26px] font-bold tracking-[-0.01em] break-words">{event.title}</h1>
            <span className="inline-flex h-[22px] items-center rounded-sm bg-background px-2 text-[11px] font-semibold tracking-[0.04em] uppercase shadow-[inset_0_0_0_1px_var(--color-border)]">
              {PHASE_LABELS[phaseOf(event, new Date().getTime())]}
            </span>
          </div>
          <p className="mt-1 text-[14px] text-text-muted">
            {type.label} · {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ButtonLink href={`/tableau-de-bord/evenements/${event.id}/relances`} variant="ghost" className="h-10 text-[14px]">
            <Icon name="relance" width={18} height={18} />
            Relances
          </ButtonLink>
          <ButtonLink href={`/tableau-de-bord/evenements/${event.id}/acces`} variant="ghost" className="h-10 text-[14px]">
            <Icon name="scanner" width={18} height={18} />
            Contrôle d&apos;accès
          </ButtonLink>
          <ButtonLink href={`/tableau-de-bord/evenements/${event.id}/carte`} variant="ghost" className="h-10 text-[14px]">
            <Icon name="invitation" width={18} height={18} />
            Carte d&apos;invitation
          </ButtonLink>
          <ButtonLink href={`/tableau-de-bord/evenements/${event.id}/modifier`} variant="ghost" className="h-10 text-[14px]">
            <Icon name="modifier" width={18} height={18} />
            Modifier
          </ButtonLink>
        </div>
      </header>

      <section aria-label="Réponses" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="participants" label="Invités" value={event.stats.guests} className="text-text" />
        <Stat icon="valide" label="Confirmés" value={event.stats.confirmed} className="text-status-confirmed" />
        <Stat icon="horloge" label="En attente" value={event.stats.pending} className="text-status-pending" />
        <Stat icon="decline" label="Déclinés" value={event.stats.declined} className="text-status-declined" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {guests.length ? (
          <GuestList guests={guests} importUrl={importUrl} eventId={event.id} wa={wa} />
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
          {/* Une rubrique par information, sur une seule ligne : une valeur trop longue est coupée (texte complet au survol). */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-[14px]">
            <Info icon={type.icon} label="Type" value={type.label} />
            <Info icon="calendrier" label="Date" value={formatShortDate(event.starts_at)} title={formatDate(event.starts_at)} />
            <Info icon="horloge" label="Heure de début" value={formatTime(event.starts_at)} />
            <Info icon="horloge" label="Durée" value={event.duration_minutes ? formatDuration(event.duration_minutes) : null} />
            <Info
              icon="lieu"
              label="Lieu"
              wide
              value={[event.location_name, event.location_address].filter(Boolean).join(", ") || null}
            />
            <Info
              icon="participants"
              label="Invités prévus"
              value={event.expected_guests !== null ? event.expected_guests.toLocaleString("fr-FR") : null}
              data
            />
            <Info icon="etiquette" label="Dress code" wide value={event.dress_code} />
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
      ) : typeof query.ajoute === "string" ? (
        <Toast title="Invité ajouté" detail={`${query.ajoute} est dans la liste. Sa carte est prête si celles de l'événement le sont.`} />
      ) : typeof query.modifie === "string" ? (
        <Toast title="Invité modifié" detail={`${query.modifie} : sa carte suit les nouvelles informations.`} />
      ) : typeof query.retire === "string" ? (
        <Toast title="Invité retiré" detail={`${query.retire} n'est plus dans la liste. Sa carte et sa réponse ont été supprimées.`} />
      ) : null}
    </>
  );
}

function GuestList({
  guests,
  importUrl,
  eventId,
  wa,
}: {
  guests: GuestOut[];
  importUrl: string;
  eventId: string;
  wa: WhatsAppOverview | null;
}) {
  const toCheck = guests.filter((g) => !g.phone_valid).length;
  // Un seul bouton rouge par écran : « Lancer les invitations » quand elles sont prêtes, sinon l'import.
  const ready = wa?.ready ?? 0;
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
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/tableau-de-bord/evenements/${eventId}/invites/nouveau`} variant="ghost" className="h-10 text-[14px]">
            <Icon name="ajouter" width={18} height={18} />
            Ajouter un invité
          </ButtonLink>
          <ButtonLink href={importUrl} variant={ready > 0 ? "ghost" : "primary"} className="h-10 text-[14px]">
            <Icon name="importer" width={18} height={18} />
            Importer des invités
          </ButtonLink>
        </div>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-text-muted">
              {["Invité", "Numéro", "Catégorie", "Position", "Réponse", "Carte"].map((h) => (
                <th key={h} className="border-b border-border px-3 pb-2 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
              <th className="border-b border-border px-3 pb-2">
                <span className="sr-only">Modifier</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => {
              const rsvp = RSVP[g.rsvp_status];
              return (
                <tr key={g.id}>
                  <td className="border-b border-border px-3 py-2.5">
                    <span className="font-semibold">{g.display_name}</span>
                    {g.rsvp_message ? (
                      <span className="mt-0.5 flex max-w-[280px] items-start gap-1 text-[12px] text-text-muted">
                        <Icon name="message" width={13} height={13} className="mt-0.5 shrink-0" />
                        <span className="line-clamp-2 italic">« {g.rsvp_message} »</span>
                      </span>
                    ) : null}
                  </td>
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
                      {g.rsvp_status === "confirmed" && g.attending_seats && g.attending_seats > 1 ? (
                        <span className="font-data font-normal tabular-nums">· {g.attending_seats}</span>
                      ) : null}
                    </span>
                  </td>
                  <td className="border-b border-border px-3 py-2.5 whitespace-nowrap">
                    {g.invitation_token ? (
                      <a
                        href={`/i/${g.invitation_token}/carte.png`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-accent-text hover:underline"
                      >
                        Voir
                      </a>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="border-b border-border px-3 py-2.5 text-right whitespace-nowrap">
                    <Link
                      href={`/tableau-de-bord/evenements/${eventId}/invites/${g.id}`}
                      aria-label={`Modifier ${g.display_name}`}
                      className="inline-flex items-center gap-1 font-semibold text-text-muted hover:text-text hover:underline"
                    >
                      <Icon name="modifier" width={14} height={14} />
                      {g.phone_valid ? "Modifier" : "Corriger"}
                    </Link>
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
      <Launch eventId={eventId} wa={wa} />
    </section>
  );
}

// Bas de la liste : lancer l'envoi WhatsApp des invitations (même action que la page Relances).
function Launch({ eventId, wa }: { eventId: string; wa: WhatsAppOverview | null }) {
  if (!wa) return null;
  const relances = `/tableau-de-bord/evenements/${eventId}/relances`;
  if (wa.ready > 0) {
    return (
      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14px]">
          <span className="font-semibold">
            {wa.ready.toLocaleString("fr-FR")} invitation{wa.ready > 1 ? "s" : ""} prête{wa.ready > 1 ? "s" : ""} à partir sur WhatsApp
          </span>
          <span className="block text-[13px] text-text-muted">Chaque invité reçoit sa carte et le lien de sa page. Envoi progressif.</span>
        </p>
        <div className="sm:w-auto sm:min-w-[260px]">
          <SendButton
            action={sendInvitations.bind(null, eventId)}
            label={`Lancer ${wa.ready > 1 ? `les ${wa.ready.toLocaleString("fr-FR")} invitations` : "l'invitation"}`}
            pendingLabel="Mise en file…"
            icon="envoyer"
          />
        </div>
      </div>
    );
  }
  const sent = sentTotal(wa.invitations) + wa.invitations.scheduled;
  return (
    <p className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-[13px] text-text-muted">
      {wa.without_card > 0 ? (
        <>
          <span>
            {wa.without_card} invité{wa.without_card > 1 ? "s" : ""} sans carte : préparez les cartes avant l&apos;envoi.
          </span>
          <Link href={`/tableau-de-bord/evenements/${eventId}/carte`} className="font-semibold text-accent-text hover:underline">
            Préparer les cartes
          </Link>
        </>
      ) : sent > 0 ? (
        <>
          <span>Les invitations sont parties ou en file.</span>
          <Link href={relances} className="font-semibold text-accent-text hover:underline">
            Suivre l&apos;envoi
          </Link>
        </>
      ) : null}
    </p>
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

function Info({
  icon,
  label,
  value,
  title,
  wide = false,
  data = false,
}: {
  icon: IconName;
  label: string;
  value: string | null;
  title?: string;
  wide?: boolean;
  data?: boolean;
}) {
  return (
    <div className={`flex min-w-0 gap-2.5 ${wide ? "col-span-2" : ""}`}>
      <Icon name={icon} width={18} height={18} className="mt-0.5 shrink-0 text-text-muted" />
      <div className="min-w-0">
        <dt className="truncate text-[12px] text-text-muted">{label}</dt>
        <dd className={`truncate ${data ? "font-data tabular-nums" : ""} ${value ? "" : "text-text-muted"}`} title={title ?? value ?? undefined}>
          {value ?? "—"}
        </dd>
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
