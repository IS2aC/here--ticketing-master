import type { Metadata } from "next";
import { CARD_LIBRARY } from "@/lib/card/library";
import { EVENT_TYPES } from "@/lib/event-types";

export const metadata: Metadata = { title: "Bibliothèque de cartes · Here!" };

const FAMILY_NAMES = {
  ceremonie: "Cérémonie",
  rendez_vous: "Rendez-vous",
  officiel: "Officiel",
  soiree: "Soirée",
  hommage: "Hommage",
};

export default function LibraryPage() {
  return (
    <>
      <header>
        <p className="text-[12px] text-text-muted">Tableau de bord</p>
        <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">Bibliothèque de cartes</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-text-muted">
          Une carte par type d&apos;événement, préparée automatiquement avec le nom de chaque invité et son QR code. Le
          sceau Here! garantit à vos invités que l&apos;invitation est authentique.
        </p>
      </header>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {EVENT_TYPES.map((t) => (
          <li key={t.value} className="grid gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- image générée par la route voisine */}
            <img
              src={`/tableau-de-bord/cartes/${t.value}/carte.png`}
              alt={`Exemple de carte ${t.label}`}
              width={1080}
              height={1350}
              loading="lazy"
              className="h-auto w-full rounded-md bg-background shadow-sm"
            />
            <p className="text-[14px] font-semibold">
              {t.label}
              <span className="block text-[12px] font-normal text-text-muted">Modèle {FAMILY_NAMES[CARD_LIBRARY[t.value].family]}</span>
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
