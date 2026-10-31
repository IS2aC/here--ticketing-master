import type { Metadata } from "next";
import Link from "next/link";
import { BackToEvent } from "@/components/back-link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Toast } from "@/components/toast";
import { CARD_LIBRARY } from "@/lib/card/library";
import { eventType } from "@/lib/event-types";
import { SAMPLE_GUEST } from "@/lib/card/data";
import { tableText } from "@/lib/card/layout";
import { PALETTES } from "@/lib/card/palettes";
import { getCardSettings, getEditorTemplates, getEvent } from "@/lib/events";
import { getGuests } from "@/lib/guests";
import { Steps } from "../../steps";
import {
  generateInvitations,
  openEditor,
  removeBackground,
  saveCard,
  saveLayout,
  uploadBackground,
  validateEditorCard,
} from "./actions";
import { CardDesigner } from "./card-designer";
import { CustomDesigner } from "./custom-designer";
import { EditorPanel } from "./editor-panel";
import { UploadBackground } from "./upload-background";
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
  const [event, guests, query, settings] = await Promise.all([getEvent(id), getGuests(id), searchParams, getCardSettings(id)]);
  const type = eventType(event.type);
  const style = CARD_LIBRARY[event.type];
  const selected = guests.find((g) => g.id === query.invite) ?? guests[0];
  const withCard = guests.filter((g) => g.invitation_token).length;
  const missing = guests.length - withCard;
  const created = Number(query.creees);
  const preview = `/tableau-de-bord/evenements/${event.id}/carte.png${selected ? `?invite=${selected.id}` : ""}`;
  const editing = settings.editor_enabled && !settings.locked;
  const templates = editing ? await getEditorTemplates(event.id) : null;

  // Canvas des cartes : la carte dessinée dans l'éditeur (Doory).
  const editorPanel = editing ? (
    <EditorPanel
      templates={templates}
      inProgress={settings.editor}
      validated={settings.editor && settings.custom}
      open={openEditor.bind(null, event.id)}
      validate={validateEditorCard.bind(null, event.id)}
    />
  ) : null;

  // Encarts communs aux deux modes (carte automatique, propre modèle).
  const extras = (
    <>
          <div className="grid gap-3 rounded-lg bg-background p-5 shadow-sm">
            {settings.custom ? (
              <p className="font-heading text-[15px] font-semibold">Aperçu</p>
            ) : (
              <>
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
              </>
            )}
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
    </>
  );

  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <BackToEvent eventId={event.id} />
          <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">Votre carte d&apos;invitation</h1>
        </div>
        <Steps current={3} />
      </header>

      {settings.editor ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="grid content-start justify-items-center gap-3 rounded-lg bg-background p-5 shadow-sm sm:p-8">
            {settings.custom ? null : (
              <p className="max-w-[480px] text-center text-[13px] text-text-muted">
                Votre carte de l&apos;éditeur n&apos;est pas encore validée : vos invités recevraient pour l&apos;instant cette carte.
              </p>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element -- image générée à la demande */}
            <img
              src={`${preview}${preview.includes("?") ? "&" : "?"}v=${encodeURIComponent(event.updated_at)}`}
              alt={`Carte d'invitation pour ${selected?.display_name ?? "un invité"}`}
              width={1080}
              height={1350}
              className="h-auto w-full max-w-[480px] rounded-md shadow-lg"
            />
          </section>
          <aside className="grid content-start gap-4">
            {settings.locked ? (
              <p className="flex items-start gap-2 rounded-lg bg-background p-5 text-[14px] text-text-muted shadow-sm">
                <Icon name="cadenas" width={18} height={18} className="mt-0.5 shrink-0" />
                <span>Les invitations sont parties : votre carte ne peut plus être modifiée.</span>
              </p>
            ) : null}
            {editorPanel}
            {extras}
          </aside>
        </div>
      ) : settings.custom && settings.layout ? (
        <CustomDesigner
          background={`/tableau-de-bord/evenements/${event.id}/carte/fond.jpg?v=${encodeURIComponent(event.updated_at)}`}
          preview={preview}
          initial={settings.layout}
          sample={{
            name: selected?.display_name ?? SAMPLE_GUEST.guestName,
            table: (selected ? tableText(selected.seat, selected.category) : "") || tableText(SAMPLE_GUEST.seat, SAMPLE_GUEST.category),
          }}
          locked={settings.locked}
          save={saveLayout.bind(null, event.id)}
          remove={removeBackground.bind(null, event.id)}
        >
          {editorPanel}
          {settings.locked ? null : <UploadBackground action={uploadBackground.bind(null, event.id)} replace />}
          {extras}
        </CustomDesigner>
      ) : (
        <CardDesigner
          action={saveCard.bind(null, event.id)}
          preview={preview}
          alt={`Carte d'invitation ${type.label} pour ${selected?.display_name ?? "un invité"}`}
          eventTitle={event.title}
          title={settings.title}
          palette={settings.palette}
          palettes={PALETTES[style.family]}
          locked={settings.locked}
        >
          {editorPanel}
          {settings.locked ? null : <UploadBackground action={uploadBackground.bind(null, event.id)} replace={false} />}
          {extras}
        </CardDesigner>
      )}
      {query.fond ? (
        <Toast
          title="Fond importé"
          detail={query.fond === "recadre" ? "Il a été recadré au format de la carte (portrait 4:5). Placez maintenant le nom et le QR code." : "Placez maintenant le nom de l'invité et le QR code."}
        />
      ) : null}
      {query.editeur === "valide" ? <Toast title="Carte validée" detail="Chaque invité a maintenant cette carte, avec son nom et son QR code." /> : null}
      {query.editeur === "1" && settings.editor ? (
        <Toast title="De retour de l'éditeur" detail="Votre carte est enregistrée. Validez-la pour l'envoyer à vos invités." />
      ) : null}
      {created > 0 ? <Toast title={`${created.toLocaleString("fr-FR")} carte${created > 1 ? "s" : ""} prête${created > 1 ? "s" : ""}`} detail="Chaque invité a son QR code." /> : null}
    </>
  );
}
