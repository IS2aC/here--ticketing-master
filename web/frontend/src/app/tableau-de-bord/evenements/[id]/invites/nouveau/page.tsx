import type { Metadata } from "next";
import { Suspense } from "react";
import { BackToEvent } from "@/components/back-link";
import { getEvent } from "@/lib/events";
import { saveGuest } from "../actions";
import { GuestForm } from "../guest-form";

export const metadata: Metadata = { title: "Ajouter un invité · Here!" };

export default function NewGuestPage({ params }: PageProps<"/tableau-de-bord/evenements/[id]/invites/nouveau">) {
  return (
    <Suspense fallback={<div className="h-[520px] rounded-lg bg-background" aria-busy="true" />}>
      <NewGuest params={params} />
    </Suspense>
  );
}

async function NewGuest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  const eventUrl = `/tableau-de-bord/evenements/${event.id}`;
  const fallback = event.categories.find((c) => c.name.toLowerCase() === "normal") ?? event.categories[0];
  return (
    <>
      <header>
        <BackToEvent eventId={event.id} />
        <h1 className="font-heading text-[26px] font-bold tracking-[-0.01em]">Ajouter un invité</h1>
        <p className="mt-1 text-[14px] text-text-muted">{event.title}</p>
      </header>
      <section className="max-w-2xl rounded-lg bg-background p-5 shadow-sm sm:p-8">
        <GuestForm
          action={saveGuest.bind(null, event.id, null)}
          initial={{ last_name: "", first_names: "", phone: "", category_id: fallback?.id ?? "", seat: "", seats: "1" }}
          categories={event.categories}
          submitLabel="Ajouter l'invité"
          cancelHref={eventUrl}
        />
      </section>
    </>
  );
}
