import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { BackLink } from "@/components/back-link";
import { Icon } from "@/components/icons";
import { getUser } from "@/lib/admin";
import { formatShortDate, formatTime } from "@/lib/events";
import { formatPhone } from "@/lib/phone";
import { setOnDemand } from "../../actions";
import { CARD, EventsTable, TONES } from "../../ui";

export const metadata: Metadata = { title: "Fiche utilisateur · Portail admin · Here!" };

const ROLES = { organizer: "Organisateur", support: "Support", admin: "Administrateur" } as const;

export default function UserPage({ params }: PageProps<"/admin/utilisateurs/[id]">) {
  return (
    <Suspense fallback={<div className={`h-[640px] ${CARD}`} aria-busy="true" />}>
      <User params={params} />
    </Suspense>
  );
}

async function User({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await getUser(id);
  const rows: [string, ReactNode][] = [
    // Fiche (et non liste) : numéro complet, pour que l'équipe puisse joindre le client.
    ["Téléphone", <span key="t" className="font-data tabular-nums">{formatPhone(u.phone)}</span>],
    ["E-mail", u.email ?? "—"],
    ["Structure", u.organization ?? "—"],
    ["Ville, pays", [u.city, u.country].filter(Boolean).join(", ") || "—"],
    ["Adresse de facturation", u.billing_address ?? "—"],
    ["Identifiant fiscal", u.tax_id ?? "—"],
    ["Inscription", formatShortDate(u.created_at)],
    ["Dernière connexion", u.last_login_at ? `${formatShortDate(u.last_login_at)} · ${formatTime(u.last_login_at)}` : "—"],
  ];

  return (
    <>
      <header>
        <BackLink href="/admin/utilisateurs" label="Retour aux utilisateurs" />
        <div className="flex items-center gap-4">
          <span className={`flex size-14 shrink-0 items-center justify-center rounded-full font-heading text-[18px] font-bold ${TONES.red}`}>
            {u.first_name.charAt(0)}
            {u.last_name.charAt(0)}
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-[26px] font-bold tracking-[-0.01em] break-words">
              {u.first_name} {u.last_name}
            </h1>
            <p className="text-[13px] text-text-muted">
              {ROLES[u.role]} · {u.events.toLocaleString("fr-FR")} événement{u.events > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className={`${CARD} p-6 lg:col-span-7`} aria-label="Coordonnées">
          <h2 className="font-heading text-[15px] font-semibold">Coordonnées et facturation</h2>
          <dl className="mt-3 divide-y divide-border/60 text-[13px]">
            {rows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[minmax(0,180px)_1fr] gap-4 py-2.5">
                <dt className="text-text-muted">{label}</dt>
                <dd className="min-w-0 font-medium break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={`${CARD} flex flex-col gap-4 p-6 lg:col-span-5`} aria-label="Options du compte">
          <h2 className="font-heading text-[15px] font-semibold">Options du compte</h2>
          <div className="rounded-xl border border-border/60 p-4">
            <div className="flex items-start gap-3">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${u.on_demand_reminders ? TONES.green : TONES.neutral}`}>
                <Icon name="relance" width={18} height={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
                  Relances à la demande
                  <span className="rounded-sm bg-surface px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] uppercase">Option payante</span>
                </p>
                <p className="mt-1 text-[13px] text-text-muted">Le bouton « Relancer maintenant » sur la page Relances de ses événements.</p>
                <p className={`mt-2 flex items-center gap-1.5 text-[13px] font-semibold ${u.on_demand_reminders ? "text-status-confirmed" : "text-text-muted"}`}>
                  <Icon name={u.on_demand_reminders ? "valide" : "decline"} width={15} height={15} />
                  {u.on_demand_reminders ? "Activée" : "Désactivée"}
                </p>
              </div>
            </div>
            <form action={setOnDemand.bind(null, u.id, !u.on_demand_reminders)} className="mt-4">
              <button
                type="submit"
                className={`inline-flex h-10 items-center rounded-full px-4 font-heading text-[14px] font-semibold ${
                  u.on_demand_reminders ? "shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface" : "bg-ink text-white hover:bg-ink-700"
                }`}
              >
                {u.on_demand_reminders ? "Désactiver l'option" : "Activer l'option"}
              </button>
            </form>
          </div>
          <p className="text-[12px] text-text-muted">
            Le rôle admin ne se donne pas ici : il se donne sur le serveur, avec <code className="font-data">python -m app.admin</code>.
          </p>
        </section>
      </div>

      <section className={`${CARD} p-6`} aria-label="Événements du compte">
        <h2 className="font-heading text-[15px] font-semibold">Ses événements</h2>
        {u.event_list.length ? (
          <div className="mt-4">
            <EventsTable events={u.event_list} showOrganizer={false} />
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-text-muted">Aucun événement créé pour l&apos;instant.</p>
        )}
      </section>
    </>
  );
}
