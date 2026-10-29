import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Toast } from "@/components/toast";
import { DeleteEvent } from "./delete-event";
import { deleteEvent } from "./evenements/actions";
import { ButtonLink } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { eventType } from "@/lib/event-types";
import { formatDate, formatTime, getEvents } from "@/lib/events";

export const metadata: Metadata = { title: "Tableau de bord · Here!" };

const NEW_EVENT = "/tableau-de-bord/evenements/nouveau";

export default function DashboardPage({ searchParams }: PageProps<"/tableau-de-bord">) {
  return (
    <>
      <Suspense fallback={null}>
        <Deleted searchParams={searchParams} />
      </Suspense>
      <header>
        <p className="text-[12px] text-text-muted">Tableau de bord</p>
        <Suspense fallback={<div className="mt-1 h-8 w-64 rounded-md bg-background" />}>
          <Greeting />
        </Suspense>
      </header>
      <Suspense fallback={<div className="h-64 rounded-lg bg-background" aria-busy="true" />}>
        <EventList />
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
  return <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">Bonjour {user.first_name}</h1>;
}

async function EventList() {
  const events = await getEvents();

  if (events.length === 0) {
    // État vide (DESIGN.md) : pastille, ce qui manque, quoi faire, une action.
    return (
      <section className="flex flex-col items-center gap-3 rounded-lg bg-background px-6 py-16 text-center shadow-sm">
        <div className="flex size-16 items-center justify-center rounded-full bg-surface text-text-muted">
          <Icon name="calendrier" width={28} height={28} />
        </div>
        <h2 className="font-heading text-[18px] font-semibold">Vous n&apos;avez pas encore d&apos;événement</h2>
        <p className="max-w-md text-[14px] text-text-muted">
          Créez votre premier événement : nous préparons les cartes, les envois WhatsApp et les relances.
        </p>
        <ButtonLink href={NEW_EVENT} className="mt-2 h-10 text-[14px]">
          <Icon name="ajouter" width={18} height={18} />
          Créer un événement
        </ButtonLink>
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-[16px] font-semibold">
          Mes événements <span className="font-data text-text-muted tabular-nums">{events.length}</span>
        </h2>
        <ButtonLink href={NEW_EVENT} className="h-10 text-[14px]">
          <Icon name="ajouter" width={18} height={18} />
          Créer un événement
        </ButtonLink>
      </div>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => {
          const type = eventType(event.type);
          return (
            <li key={event.id} className="flex flex-col rounded-lg bg-background shadow-sm transition-shadow hover:shadow-md">
              <Link
                href={`/tableau-de-bord/evenements/${event.id}`}
                className="flex flex-1 flex-col gap-3 rounded-t-lg p-5 pb-3 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface text-text-muted">
                    <Icon name={type.icon} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-heading text-[15px] font-semibold">{event.title}</p>
                    <p className="text-[13px] text-text-muted">
                      {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
                    </p>
                  </div>
                </div>
                {event.location_name ? (
                  <p className="flex items-center gap-1.5 text-[13px] text-text-muted">
                    <Icon name="lieu" width={16} height={16} />
                    <span className="truncate">{event.location_name}</span>
                  </p>
                ) : null}
              </Link>
              {/* Pied de carte hors du lien : le bouton « Supprimer » ne doit pas ouvrir l'événement. */}
              <div className="mx-5 flex items-center gap-4 border-t border-border py-3 text-[13px]">
                <span className="font-data tabular-nums">
                  {event.stats.guests} invité{event.stats.guests > 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1 font-semibold text-status-confirmed">
                  <Icon name="valide" width={15} height={15} />
                  <span className="font-data tabular-nums">{event.stats.confirmed}</span> confirmé
                  {event.stats.confirmed > 1 ? "s" : ""}
                </span>
                <span className="ml-auto">
                  <DeleteEvent title={event.title} sent={event.status === "active"} action={deleteEvent.bind(null, event.id)} />
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
