import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackToEvent } from "@/components/back-link";
import { getEvent } from "@/lib/events";
import { getGuest } from "@/lib/guests";
import { localPhone } from "@/lib/phone";
import { removeGuest, saveGuest } from "../actions";
import { GuestForm } from "../guest-form";
import { RemoveGuest } from "../remove-guest";

export const metadata: Metadata = { title: "Modifier un invité · Here!" };

export default function EditGuestPage({ params }: PageProps<"/tableau-de-bord/evenements/[id]/invites/[guestId]">) {
  return (
    <Suspense fallback={<div className="h-[520px] rounded-lg bg-background" aria-busy="true" />}>
      <EditGuest params={params} />
    </Suspense>
  );
}

async function EditGuest({ params }: { params: Promise<{ id: string; guestId: string }> }) {
  const { id, guestId } = await params;
  const [event, guest] = await Promise.all([getEvent(id), getGuest(guestId)]);
  if (!event.categories.some((c) => c.id === guest.category_id)) notFound(); // invité d'un autre événement
  const eventUrl = `/tableau-de-bord/evenements/${event.id}`;
  return (
    <>
      <header>
        <BackToEvent eventId={event.id} />
        <h1 className="font-heading text-[26px] font-bold tracking-[-0.01em] break-words">{guest.display_name}</h1>
        <p className="mt-1 text-[14px] text-text-muted">
          {event.title}
          {guest.invitation_token ? " · sa carte suivra les modifications" : ""}
        </p>
      </header>
      <section className="max-w-2xl rounded-lg bg-background p-5 shadow-sm sm:p-8">
        <GuestForm
          action={saveGuest.bind(null, event.id, guest.id)}
          initial={{
            last_name: guest.last_name ?? (guest.first_names ? "" : guest.display_name),
            first_names: guest.first_names ?? "",
            // Numéro valide : au format local ; à vérifier : tel qu'importé, pour le corriger.
            phone: guest.phone ? (guest.phone_valid ? localPhone(guest.phone) : guest.phone) : "",
            category_id: guest.category_id,
            seat: guest.seat ?? "",
          }}
          categories={event.categories}
          submitLabel="Enregistrer"
          cancelHref={eventUrl}
        />
      </section>
      <section className="flex max-w-2xl flex-col gap-3 rounded-lg bg-background p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 className="font-heading text-[16px] font-semibold">Retirer cet invité</h2>
          <p className="mt-1 text-[13px] text-text-muted">Il disparaît de la liste, avec sa carte et sa réponse.</p>
        </div>
        <RemoveGuest
          name={guest.display_name}
          sent={Boolean(guest.invitation_token) && event.status === "active"}
          action={removeGuest.bind(null, event.id, guest.id, guest.display_name)}
        />
      </section>
    </>
  );
}
