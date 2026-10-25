import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getEvent, toDateInput, toTimeInput } from "@/lib/events";
import { updateEvent } from "../../actions";
import { EventForm, type EventFormValues } from "../../event-form";

export const metadata: Metadata = { title: "Modifier l'événement · Here!" };

export default function EditEventPage({ params }: PageProps<"/tableau-de-bord/evenements/[id]/modifier">) {
  return (
    <Suspense fallback={<div className="h-[640px] rounded-lg bg-background" aria-busy="true" />}>
      <EditView params={params} />
    </Suspense>
  );
}

async function EditView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  const initial: EventFormValues = {
    title: event.title,
    type: event.type,
    date: toDateInput(event.starts_at),
    time: toTimeInput(event.starts_at),
    duration: event.duration_minutes ? String(event.duration_minutes / 60) : "",
    location_name: event.location_name ?? "",
    location_address: event.location_address ?? "",
    expected_guests: event.expected_guests?.toString() ?? "",
    dress_code: event.dress_code ?? "",
    description: event.description ?? "",
    categories: event.categories.map((c) => c.name),
  };

  return (
    <>
      <header>
        <p className="text-[12px] text-text-muted">
          <Link href="/tableau-de-bord" className="hover:underline">
            Mes événements
          </Link>{" "}
          ·{" "}
          <Link href={`/tableau-de-bord/evenements/${event.id}`} className="hover:underline">
            {event.title}
          </Link>
        </p>
        <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">Modifier l&apos;événement</h1>
      </header>
      <EventForm
        action={updateEvent.bind(null, event.id)}
        initial={initial}
        submitLabel="Enregistrer"
        pendingLabel="Enregistrement…"
      />
    </>
  );
}
