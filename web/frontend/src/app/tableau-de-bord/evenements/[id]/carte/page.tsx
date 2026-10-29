import type { Metadata } from "next";
import Link from "next/link";
import { BackToEvent } from "@/components/back-link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Toast } from "@/components/toast";
import { CARD_LIBRARY } from "@/lib/card/library";
import { eventType } from "@/lib/event-types";
import { getEvent } from "@/lib/events";
import { getGuests } from "@/lib/guests";
import { Steps } from "../../steps";
import { generateInvitations } from "./actions";
import { GenerateButton } from "./generate-button";

export const metadata: Metadata = { title: "Votre carte d'invitation · Here!" };

export default function CardPage({ params, searchParams }: PageProps<"/tableau-de-bord/evenements/[id]/carte">) {
  return (
    <Suspense fallback={<div className="h-[640px] rounded-lg bg-background" aria-busy="true" />}>
      <CardView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CardView({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const [event, guests, query] = await Promise.all([getEvent(id), getGuests(id), searchParams]);
  const type = eventType(event.type);
  const style = CARD_LIBRARY[event.type];
  const selected = guests.find((g) => g.id === query.invite) ?? guests[0];
  const withCard = guests.filter((g) => g.invitation_token).length;
  const missing = guests.length - withCard;
  const created = Number(query.creees);
  const preview = `/tableau-de-bord/evenements/${event.id}/carte.png${selected ? `?invite=${selected.id}` : ""}`;

  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <BackToEvent eventId={event.id} />
          <p className="text-[12px] text-text-muted">
            <Link href={`/tableau-de-bord/evenements/${event.id}`} className="hover:underline">
              {event.title}
            </Link>{" "}
            · Carte
          </p>
          <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">Votre carte d&apos;invitation</h1>
        </div>
        <Steps current={3} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex items-center justify-center rounded-lg bg-background p-5 shadow-sm sm:p-8">
          {/* eslint-disable-next-line @next/next/no-img-element -- image générée à la demande, déjà au bon format */}
          <img
            src={preview}
            alt={`Carte d'invitation ${type.label} pour ${selected?.display_name ?? "un invité"}`}
            width={1080}
            height={1350}
            className="h-auto w-full max-w-[480px] rounded-md shadow-lg"
          />
        </section>

        <aside className="grid content-start gap-4">
          <div className="grid gap-3 rounded-lg bg-background p-5 shadow-sm">
            <p className="flex items-center gap-2 font-heading text-[16px] font-semibold">
              <Icon name={type.icon} width={20} height={20} className="text-primary" />
              Carte « {style.label} »
            </p>
            <p className="text-[14px] text-text-muted">
              Choisie dans la bibliothèque Here! d&apos;après le type de votre événement. Pour une autre carte,{" "}
              <Link href={`/tableau-de-bord/evenements/${event.id}/modifier`} className="font-semibold text-accent-text hover:underline">
                changez le type
              </Link>{" "}
              ou{" "}
              <Link href="/tableau-de-bord/cartes" className="font-semibold text-accent-text hover:underline">
                parcourez la bibliothèque
              </Link>
              .
            </p>
            {guests.length ? (
              <form className="grid gap-1.5">
                <label htmlFor="invite" className="text-[13px] font-medium text-text-muted">
                  Aperçu pour
                </label>
                <div className="flex gap-2">
                  <select
                    id="invite"
                    name="invite"
                    defaultValue={selected?.id}
                    className="h-11 min-w-0 flex-1 rounded-md bg-background px-3 text-[14px] shadow-[inset_0_0_0_1px_var(--color-border)]"
                  >
                    {guests.slice(0, 300).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.display_name} · {g.category}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="h-11 rounded-full px-4 text-[14px] font-semibold shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface">
                    Voir
                  </button>
                </div>
              </form>
            ) : null}
          </div>

          <div className="grid gap-2 rounded-lg bg-background p-5 shadow-sm">
            <p className="flex items-center gap-2 font-heading text-[15px] font-semibold">
              {/* eslint-disable-next-line @next/next/no-img-element -- pictogramme de la marque */}
              <img src="/icon.svg" alt="" width={22} height={22} className="rounded-[6px]" />
              Le sceau Here!
            </p>
            <p className="text-[14px] text-text-muted">
              Ajouté sur chaque carte : nom de l&apos;invité, QR code unique et vérification. Il ne peut pas être modifié.
            </p>
          </div>

          <div className="grid gap-3 rounded-lg bg-background p-5 shadow-sm">
            {guests.length === 0 ? (
              <p className="text-[14px] text-text-muted">
                Importez d&apos;abord votre liste : une carte est préparée pour chaque invité.{" "}
                <Link href={`/tableau-de-bord/evenements/${event.id}/invites/importer`} className="font-semibold text-accent-text hover:underline">
                  Importer la liste
                </Link>
              </p>
            ) : missing > 0 ? (
              <>
                <p className="text-[14px]">
                  <span className="font-semibold">
                    {missing.toLocaleString("fr-FR")} carte{missing > 1 ? "s" : ""} à préparer
                  </span>
                  <span className="block text-text-muted">Rien n&apos;est envoyé à vos invités à cette étape.</span>
                </p>
                <GenerateButton
                  action={generateInvitations.bind(null, event.id)}
                  label={`Préparer ${missing.toLocaleString("fr-FR")} carte${missing > 1 ? "s" : ""}`}
                />
              </>
            ) : (
              <p className="flex items-start gap-2 text-[14px]">
                <Icon name="valide" width={18} height={18} className="mt-0.5 shrink-0 text-success" />
                <span>
                  <span className="font-semibold">
                    {withCard.toLocaleString("fr-FR")} carte{withCard > 1 ? "s" : ""} prête{withCard > 1 ? "s" : ""}
                  </span>
                  <span className="block text-text-muted">
                    Chaque invité a sa carte et son QR code. Prochaine étape :{" "}
                    <Link href={`/tableau-de-bord/evenements/${event.id}/relances`} className="font-semibold text-accent-text hover:underline">
                      l&apos;envoi sur WhatsApp
                    </Link>
                    .
                  </span>
                </span>
              </p>
            )}
          </div>
        </aside>
      </div>
      {created > 0 ? <Toast title={`${created.toLocaleString("fr-FR")} carte${created > 1 ? "s" : ""} prête${created > 1 ? "s" : ""}`} detail="Chaque invité a son QR code." /> : null}
    </>
  );
}
