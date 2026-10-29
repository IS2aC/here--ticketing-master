"use client";

import { useActionState, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import type { ImportOut } from "@/lib/guests";
import { formatPhone } from "@/lib/phone";
import type { RowFixState } from "../actions";

type Row = ImportOut["rows"][number];
export type RowStatusView = { icon: IconName; label: string; tone: string; row?: string };

const input =
  "h-10 w-full min-w-0 rounded-md bg-background px-3 text-[14px] shadow-[inset_0_0_0_1px_var(--color-border)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-primary)]";

// Ligne de l'aperçu, avec « Corriger » : formulaire sous la ligne, vérifié à nouveau à l'enregistrement.
export function ImportRow({
  row,
  status,
  categories,
  fix,
  drop,
}: {
  row: Row;
  status: RowStatusView;
  categories: string[];
  fix: (state: RowFixState, formData: FormData) => Promise<RowFixState>;
  drop: () => Promise<RowFixState>;
}) {
  const [fixed, fixAction, fixing] = useActionState(fix, {});
  const [dropped, dropAction, dropping] = useActionState(drop, {});
  // Ouvert depuis un instant donné ; un enregistrement plus récent le referme :
  // la ligne vérifiée à nouveau remplace le formulaire.
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const open = openedAt !== null && !(fixed.saved && fixed.saved > openedAt);
  const setOpen = (value: boolean) => setOpenedAt(value ? Date.now() : null);
  const message = fixed.message ?? dropped.message;
  const known = categories.find((c) => c.toLowerCase() === (row.category ?? row.raw_category ?? "").toLowerCase());

  return (
    <>
      <tr className={status.row}>
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
        <td className={`border-b border-border px-3 py-2.5 font-semibold ${status.tone}`}>
          <span className="inline-flex items-center gap-1.5">
            <Icon name={status.icon} width={15} height={15} className="shrink-0" />
            {status.label}
          </span>
        </td>
        <td className="border-b border-border px-3 py-2.5 text-right whitespace-nowrap">
          {row.status !== "ready" || open ? (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              className="font-semibold text-accent-text hover:underline"
            >
              {open ? "Fermer" : "Corriger"}
            </button>
          ) : null}
        </td>
      </tr>
      {open ? (
        <tr className="bg-surface/60">
          <td colSpan={6} className="border-b border-border px-3 py-4">
            <form action={fixAction} className="grid gap-3">
              <div className="grid max-w-[640px] gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <label className="grid gap-1 text-[12px] font-medium text-text-muted">
                  Prénoms
                  <input name="first_names" defaultValue={row.first_names ?? ""} className={input} />
                </label>
                <label className="grid gap-1 text-[12px] font-medium text-text-muted">
                  Nom
                  <input name="last_name" defaultValue={row.last_name ?? ""} className={input} />
                </label>
                <label className="grid gap-1 text-[12px] font-medium text-text-muted">
                  Numéro WhatsApp
                  <input name="phone" type="tel" inputMode="tel" placeholder="07 07 12 34 56" defaultValue={row.phone ?? ""} className={`${input} font-data`} />
                </label>
                <label className="grid gap-1 text-[12px] font-medium text-text-muted">
                  Catégorie
                  <select name="category" defaultValue={known ?? categories[0]} className={input}>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-[12px] font-medium text-text-muted">
                  Position
                  <input name="seat" defaultValue={row.seat ?? ""} className={input} />
                </label>
              </div>
              {message ? (
                <p role="alert" className="text-[13px] text-error">
                  {message}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={fixing}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 font-heading text-[14px] font-semibold text-white hover:bg-ink-700 disabled:opacity-60"
                >
                  <Icon name="valide" width={16} height={16} />
                  {fixing ? "Vérification…" : "Enregistrer la ligne"}
                </button>
                <button
                  type="submit"
                  formAction={dropAction}
                  formNoValidate
                  disabled={dropping}
                  className="inline-flex h-10 items-center gap-1.5 px-2 text-[14px] font-semibold text-error hover:underline disabled:opacity-60"
                >
                  <Icon name="decline" width={16} height={16} />
                  {dropping ? "Retrait…" : "Retirer la ligne"}
                </button>
              </div>
            </form>
          </td>
        </tr>
      ) : null}
    </>
  );
}
