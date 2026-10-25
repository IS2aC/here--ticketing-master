import type { Metadata } from "next";
import Link from "next/link";
import { createEvent } from "../actions";
import { EMPTY_EVENT, EventForm } from "../event-form";
import { Steps } from "../steps";

export const metadata: Metadata = { title: "Créer un événement · Here!" };

export default function NewEventPage() {
  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[12px] text-text-muted">
            <Link href="/tableau-de-bord" className="hover:underline">
              Mes événements
            </Link>{" "}
            · Nouveau
          </p>
          <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">Créer un événement</h1>
        </div>
        <Steps current={1} />
      </header>
      <EventForm action={createEvent} initial={EMPTY_EVENT} submitLabel="Créer l'événement" pendingLabel="Création…" />
    </>
  );
}
