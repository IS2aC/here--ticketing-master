import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SAMPLE_GUEST } from "@/lib/card/data";
import { tableText } from "@/lib/card/layout";
import { getCardSettings, getEvent } from "@/lib/events";
import { getGuests } from "@/lib/guests";
import { EditorLoader } from "./editor-loader";

export const metadata: Metadata = { title: "Créer ma carte · Here!" };

// Éditeur de la carte d'invitation, en plein écran au-dessus du tableau de bord.
export default function CardEditorPage({ params }: PageProps<"/tableau-de-bord/evenements/[id]/carte/editeur">) {
  return (
    <div className="fixed inset-0 z-50 bg-background">
      <Suspense fallback={<div className="h-full" aria-busy="true" />}>
        <Editor params={params} />
      </Suspense>
    </div>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [event, guests, settings] = await Promise.all([getEvent(id), getGuests(id), getCardSettings(id)]);

  if (settings.locked) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="grid max-w-[440px] gap-3 rounded-lg bg-surface p-6 text-center">
          <h1 className="font-heading text-[20px] font-semibold">La carte est figée</h1>
          <p className="text-[14px] text-text-muted">
            Les invitations sont parties : la carte ne peut plus être modifiée, pour que tous vos invités reçoivent la même.
          </p>
          <Link href={`/tableau-de-bord/evenements/${event.id}/carte`} className="font-semibold text-accent-text hover:underline">
            Retour à la carte
          </Link>
        </div>
      </div>
    );
  }

  // Invité d'exemple : le premier de la liste, sinon un invité fictif.
  const guest = guests[0];
  const sample = {
    name: guest?.display_name ?? SAMPLE_GUEST.guestName,
    table: (guest ? tableText(guest.seat, guest.category) : "") || tableText(SAMPLE_GUEST.seat, SAMPLE_GUEST.category),
  };
  return <EditorLoader eventId={event.id} eventTitle={event.title} sample={sample} />;
}
