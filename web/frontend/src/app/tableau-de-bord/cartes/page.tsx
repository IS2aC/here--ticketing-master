import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackToDashboard } from "@/components/back-link";
import { CARD_LIBRARY } from "@/lib/card/library";
import { STYLE_LABELS, getCardTemplates } from "@/lib/card/templates/catalog";
import { EVENT_TYPES, eventType } from "@/lib/event-types";
import { Swatches } from "./swatches";

export const metadata: Metadata = { title: "Bibliothèque de cartes · Here!" };

const FAMILY_NAMES = {
  ceremonie: "Cérémonie",
  rendez_vous: "Rendez-vous",
  officiel: "Officiel",
  soiree: "Soirée",
  hommage: "Hommage",
};

const GRID = "grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4";

export default function LibraryPage() {
  return (
    <>
      <header>
        <BackToDashboard />
        <h1 className="font-heading text-[26px] font-bold tracking-[-0.01em]">Bibliothèque de cartes</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-text-muted">
          Chaque invité reçoit sa propre carte, avec son nom et son QR code. Le sceau Here! garantit à vos invités que
          l&apos;invitation est authentique.
        </p>
      </header>

      <section aria-labelledby="modeles-photo" className="grid gap-3">
        <div>
          <h2 id="modeles-photo" className="font-heading text-[19px] font-bold">
            Modèles avec photo
          </h2>
          <p className="mt-0.5 max-w-2xl text-[14px] text-text-muted">
            Des exemples à personnaliser : votre photo, vos textes et vos couleurs. Les photos et les noms sont fictifs.
          </p>
        </div>
        <Suspense fallback={<div className={GRID} aria-busy="true"><div className="aspect-[4/5] rounded-md bg-background" /></div>}>
          <PhotoTemplates />
        </Suspense>
      </section>

      <section aria-labelledby="cartes-automatiques" className="grid gap-3">
        <div>
          <h2 id="cartes-automatiques" className="font-heading text-[19px] font-bold">
            Cartes automatiques
          </h2>
          <p className="mt-0.5 max-w-2xl text-[14px] text-text-muted">
            Une carte par type d&apos;événement, préparée à partir des informations de votre événement.
          </p>
        </div>
        <ul className={GRID}>
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
      </section>
    </>
  );
}

async function PhotoTemplates() {
  const templates = await getCardTemplates();
  if (!templates.length) return <p className="text-[14px] text-text-muted">Les modèles arrivent bientôt.</p>;
  return (
    <ul className={GRID}>
      {templates.map((t) => (
        <li key={t.code}>
          <Link
            href={`/tableau-de-bord/cartes/modeles/${t.code}`}
            className="group grid gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- image générée par la route du modèle */}
            <img
              src={`/tableau-de-bord/cartes/modeles/${t.code}/apercu.png`}
              alt={`Exemple de carte « ${t.name} »`}
              width={1080}
              height={1350}
              loading="lazy"
              className="h-auto w-full rounded-md bg-background shadow-sm transition-transform group-hover:-translate-y-0.5"
            />
            <span className="text-[14px] font-semibold group-hover:underline">
              {t.name}
              <span className="block text-[12px] font-normal text-text-muted">
                {[t.style ? STYLE_LABELS[t.style] : null, ...t.event_types.map((type) => eventType(type).label)].filter(Boolean).join(" · ")}
              </span>
            </span>
            <Swatches palettes={t.definition.theme.palettes} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
