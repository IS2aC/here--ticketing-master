import type { Metadata } from "next";
import { BackToEvent } from "@/components/back-link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Icon, type IconName } from "@/components/icons";
import { ButtonLink } from "@/components/ui";
import { getEvent } from "@/lib/events";
import { getImport, type ImportOut, type RowStatus } from "@/lib/guests";
import { formatPhone } from "@/lib/phone";
import { Steps } from "../../../../steps";
import { confirmImport } from "../actions";
import { ConfirmButton } from "./confirm-button";

export const metadata: Metadata = { title: "Vérifier votre liste · Here!" };

type Row = ImportOut["rows"][number];

// Statut de chaque ligne : icône + mot + couleur (DESIGN.md).
const STATUS: Record<RowStatus, { icon: IconName; label: (row: Row) => string; tone: string; row?: string }> = {
  ready: { icon: "valide", label: () => "Prêt", tone: "text-status-confirmed" },
  phone_missing: { icon: "alerte", label: () => "Numéro manquant", tone: "text-status-pending", row: "bg-[color-mix(in_srgb,var(--color-warning)_6%,transparent)]" },
  phone_invalid: { icon: "alerte", label: () => "Numéro incomplet", tone: "text-status-pending", row: "bg-[color-mix(in_srgb,var(--color-warning)_6%,transparent)]" },
  name_missing: { icon: "decline", label: () => "Nom manquant · non importé", tone: "text-status-unreachable", row: "bg-[color-mix(in_srgb,var(--color-error)_5%,transparent)]" },
  category_unknown: {
    icon: "decline",
    label: (r) => `Catégorie « ${r.raw_category} » inconnue · non importé`,
    tone: "text-status-unreachable",
    row: "bg-[color-mix(in_srgb,var(--color-error)_5%,transparent)]",
  },
  duplicate: { icon: "decline", label: () => "Déjà dans la liste · retiré", tone: "text-status-declined" },
};

const PREVIEW_LIMIT = 200;

export default function ReviewPage({ params }: PageProps<"/tableau-de-bord/evenements/[id]/invites/importer/[importId]">) {
  return (
    <Suspense fallback={<div className="h-[600px] rounded-lg bg-background" aria-busy="true" />}>
      <Review params={params} />
    </Suspense>
  );
}

async function Review({ params }: { params: Promise<{ id: string; importId: string }> }) {
  const { id, importId } = await params;
  const [event, imp] = await Promise.all([getEvent(id), getImport(id, importId)]);
  if (imp.status === "done") redirect(`/tableau-de-bord/evenements/${id}`);

  const { summary } = imp;
  const toFix = imp.rows.filter((r) => r.status !== "ready").length;
  const shown = imp.rows.slice(0, PREVIEW_LIMIT);
  const back = `/tableau-de-bord/evenements/${id}/invites/importer`;

  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <BackToEvent eventId={event.id} />
          <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">Vérifiez votre liste</h1>
        </div>
        <Steps current={2} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="grid min-w-0 content-start gap-6 rounded-lg bg-background p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center gap-4 rounded-md p-4 shadow-[inset_0_0_0_1.5px_var(--color-success)]">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-surface">
              <Icon name="importer" width={22} height={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-[15px] font-semibold">{imp.file_name}</p>
              <p className="text-[13px] text-text-muted">
                <span className="font-data tabular-nums">{summary.total.toLocaleString("fr-FR")}</span> ligne
                {summary.total > 1 ? "s" : ""}
              </p>
            </div>
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-success">
              <Icon name="valide" width={16} height={16} />
              Fichier lu
            </p>
            <ButtonLink href={back} variant="ghost" className="h-10 text-[14px]">
              Changer de fichier
            </ButtonLink>
          </div>

          <div className="grid gap-3">
            <h2 className="font-heading text-[16px] font-semibold">Nous avons reconnu vos colonnes</h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {imp.columns.map((c, i) => (
                <li key={`${c.header}-${i}`} className="rounded-md bg-surface p-3">
                  <p className="truncate text-[12px] text-text-muted">« {c.header || "sans titre"} »</p>
                  {c.label ? (
                    <p className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold">
                      <Icon name="valide" width={15} height={15} className="text-success" />
                      {c.label}
                    </p>
                  ) : (
                    <p className="mt-1 text-[14px] text-text-muted">Ignorée</p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid min-w-0 gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-heading text-[16px] font-semibold">Aperçu de la liste</h2>
              {toFix ? (
                <p className="text-[13px] text-text-muted">
                  {toFix} ligne{toFix > 1 ? "s" : ""} à vérifier {toFix > 1 ? "sont" : "est"} en tête de liste
                </p>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-[12px] text-text-muted">
                    {["Invité", "Numéro WhatsApp", "Catégorie", "Position", "Vérification"].map((h) => (
                      <th key={h} className="border-b border-border px-3 pb-2 font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => {
                    const s = STATUS[row.status];
                    return (
                      <tr key={row.line} className={s.row}>
                        <td className="border-b border-border px-3 py-2.5 font-semibold">
                          {row.display_name || <span className="text-text-muted">Ligne {row.line}</span>}
                        </td>
                        <td className="border-b border-border px-3 py-2.5 font-data whitespace-nowrap tabular-nums">
                          {row.phone ? (row.phone_valid ? formatPhone(row.phone) : row.phone) : "—"}
                        </td>
                        <td className="border-b border-border px-3 py-2.5">
                          {row.category ?? row.raw_category ? (
                            <span className="inline-flex h-[22px] items-center rounded-sm bg-surface px-2 text-[11px] font-semibold tracking-[0.04em] uppercase">
                              {row.category ?? row.raw_category}
                            </span>
                          ) : null}
                        </td>
                        <td className="border-b border-border px-3 py-2.5 whitespace-nowrap">{row.seat ?? "—"}</td>
                        <td className={`border-b border-border px-3 py-2.5 font-semibold ${s.tone}`}>
                          <span className="inline-flex items-center gap-1.5">
                            <Icon name={s.icon} width={15} height={15} className="shrink-0" />
                            {s.label(row)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {imp.rows.length > PREVIEW_LIMIT ? (
              <p className="text-[13px] text-text-muted">
                Aperçu des {PREVIEW_LIMIT} premières lignes sur {imp.rows.length.toLocaleString("fr-FR")}.
              </p>
            ) : null}
            {summary.not_imported ? (
              <p className="text-[13px] text-text-muted">
                Pour ajouter les lignes non importées, corrigez votre fichier puis cliquez sur « Changer de fichier ».
              </p>
            ) : null}
          </div>

          <div className="flex justify-end border-t border-border pt-5">
            <ConfirmButton action={confirmImport.bind(null, id, importId)} count={summary.to_import} />
          </div>
        </section>

        <aside className="grid content-start gap-4 rounded-lg bg-background p-5 shadow-sm">
          <h2 className="font-heading text-[16px] font-semibold">Votre liste</h2>
          <p>
            <span className="font-data text-[44px] leading-none font-semibold tabular-nums">
              {summary.to_import.toLocaleString("fr-FR")}
            </span>{" "}
            <span className="text-text-muted">invité{summary.to_import > 1 ? "s" : ""} à importer</span>
          </p>
          <ul className="grid gap-1 text-[14px] text-text-muted">
            {summary.duplicates ? <li>{summary.duplicates} doublon{summary.duplicates > 1 ? "s" : ""} retiré{summary.duplicates > 1 ? "s" : ""} automatiquement.</li> : null}
            {summary.to_verify ? <li>{summary.to_verify} numéro{summary.to_verify > 1 ? "s" : ""} à vérifier avant l&apos;envoi.</li> : null}
            {summary.not_imported ? <li>{summary.not_imported} ligne{summary.not_imported > 1 ? "s" : ""} non importée{summary.not_imported > 1 ? "s" : ""}.</li> : null}
          </ul>
          <ul className="grid">
            {Object.entries(summary.by_category)
              .sort(([a], [b]) => a.localeCompare(b, "fr"))
              .map(([name, count]) => (
                <li key={name} className="flex items-center justify-between border-t border-border py-2.5 text-[14px]">
                  <span className="inline-flex h-[22px] items-center rounded-sm bg-surface px-2 text-[11px] font-semibold tracking-[0.04em] uppercase">
                    {name}
                  </span>
                  <span className="font-data font-semibold tabular-nums">{count}</span>
                </li>
              ))}
          </ul>
          <p className="flex items-start gap-2 rounded-md bg-surface p-3 text-[13px] text-text-muted">
            <Icon name="cadenas" width={18} height={18} className="mt-0.5 shrink-0" />
            Rien n&apos;est envoyé à vos invités à cette étape.
          </p>
        </aside>
      </div>
    </>
  );
}
