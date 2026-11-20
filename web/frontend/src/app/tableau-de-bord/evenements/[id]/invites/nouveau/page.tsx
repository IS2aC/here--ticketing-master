import type { Metadata } from "next";
import { Suspense } from "react";
import { BackToEvent } from "@/components/back-link";
import { Icon } from "@/components/icons";
import { getEvent } from "@/lib/events";
import { saveGuest } from "../actions";
import { GuestForm } from "../guest-form";

export const metadata: Metadata = { title: "Ajouter un invité · Here!" };

export default function NewGuestPage({ params, searchParams }: PageProps<"/tableau-de-bord/evenements/[id]/invites/nouveau">) {
  return (
    <Suspense fallback={<div className="h-[520px] rounded-lg bg-background" aria-busy="true" />}>
      <NewGuest params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function NewGuest({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { ajoute } = await searchParams;
  const added = typeof ajoute === "string" ? ajoute : null; // invité précédent, après « Ajouter et saisir un autre »
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
      <section className="grid max-w-2xl gap-5 rounded-lg bg-background p-5 shadow-sm sm:p-8">
        {added ? (
          <p role="status" className="flex items-center gap-2 rounded-md bg-surface px-4 py-3 text-[14px]">
            <Icon name="valide" width={18} height={18} className="shrink-0 text-status-confirmed" />
            <span>
              <strong className="font-semibold">{added}</strong> est dans la liste. Saisissez l&apos;invité suivant.
            </span>
          </p>
        ) : null}
        <GuestForm
          key={added ?? "premier"}
          quick
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
