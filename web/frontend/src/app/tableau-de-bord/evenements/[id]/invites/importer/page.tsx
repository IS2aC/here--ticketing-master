import type { Metadata } from "next";
import { BackToEvent } from "@/components/back-link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { getEvent } from "@/lib/events";
import { Steps } from "../../../steps";
import { uploadImport } from "./actions";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Importer vos invités · Here!" };

const COLUMNS = [
  ["Nom", "Obligatoire (ou les prénoms)", "Konan"],
  ["Prénoms", "Obligatoire (ou le nom)", "Kouadio Jean"],
  ["Numéro", "Facultatif · numéro WhatsApp", "07 07 12 34 56"],
  ["Catégorie", "Facultatif · « Normal » par défaut", "VIP"],
  ["Position", "Facultatif · table ou place", "Table 4"],
  ["Nb pers.", "Facultatif · l'invité et ses accompagnants, 1 par défaut", "2"],
];

export default function ImportPage({
  params,
}: PageProps<"/tableau-de-bord/evenements/[id]/invites/importer">) {
  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Suspense
            fallback={<p className="h-4 w-40 rounded-sm bg-background" />}
          >
            <Crumb params={params} />
          </Suspense>
          <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">
            Importer vos invités
          </h1>
        </div>
        <Steps current={2} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg bg-background p-5 shadow-sm sm:p-6">
          <Suspense fallback={<div className="h-56 rounded-lg bg-surface" />}>
            <Upload params={params} />
          </Suspense>
        </section>

        <aside className="grid content-start gap-4 rounded-lg bg-background p-5 shadow-sm">
          <h2 className="font-heading text-[16px] font-semibold">
            Votre fichier
          </h2>
          <p className="text-[14px] text-text-muted">
            Une ligne par invité, avec ces colonnes dans n&apos;importe quel
            ordre. Les titres sont reconnus même sans accents.
          </p>
          <dl className="grid gap-3 text-[14px]">
            {COLUMNS.map(([name, rule, example]) => (
              <div
                key={name}
                className="grid grid-cols-[96px_1fr] gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <dt className="font-semibold">{name}</dt>
                <dd>
                  <span className="block text-text-muted">{rule}</span>
                  <span className="font-data text-[13px]">{example}</span>
                </dd>
              </div>
            ))}
          </dl>
          <a
            href="/modele-invites.xlsx"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 font-heading text-[14px] font-semibold shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Icon name="telecharger" width={18} height={18} />
            Télécharger notre modèle Excel
          </a>
          <p className="flex items-start gap-2 rounded-md bg-surface p-3 text-[13px] text-text-muted">
            <Icon
              name="cadenas"
              width={18}
              height={18}
              className="mt-0.5 shrink-0"
            />
            Les numéros de vos invités ne servent qu&apos;à leur envoyer votre
            invitation. Ils ne sont jamais partagés ni réutilisés.
          </p>
        </aside>
      </div>
    </>
  );
}

async function Crumb({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  return <BackToEvent eventId={event.id} />;
}

async function Upload({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UploadForm action={uploadImport.bind(null, id)} />;
}
