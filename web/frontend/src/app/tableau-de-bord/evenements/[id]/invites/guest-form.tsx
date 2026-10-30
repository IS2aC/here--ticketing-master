"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { Field } from "@/components/field";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import type { GuestFormState } from "./actions";

export type GuestInitial = { last_name: string; first_names: string; phone: string; category_id: string; seat: string; seats: string };

export function GuestForm({
  action,
  initial,
  categories,
  submitLabel,
  cancelHref,
}: {
  action: (state: GuestFormState, formData: FormData) => Promise<GuestFormState>;
  initial: GuestInitial;
  categories: { id: string; name: string }[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = (key: keyof GuestInitial) => state.values?.[key] ?? initial[key];
  const e = state.errors ?? {};
  const categoryId = `${useId()}category`;

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Prénoms" name="first_names" autoComplete="off" defaultValue={v("first_names")} error={e.first_names} />
        <Field label="Nom" name="last_name" autoComplete="off" defaultValue={v("last_name")} error={e.last_name} />
      </div>
      <Field
        label="Numéro WhatsApp"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        placeholder="07 07 12 34 56"
        defaultValue={v("phone")}
        error={e.phone}
        hint="Laissez vide si vous ne l'avez pas : l'invité ne recevra pas son invitation sur WhatsApp."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={categoryId} className="text-[13px] font-medium tracking-[0.02em] text-text-muted">
            Catégorie
          </label>
          <select
            id={categoryId}
            name="category_id"
            defaultValue={v("category_id")}
            aria-invalid={e.category_id ? true : undefined}
            className={`h-[52px] w-full rounded-md bg-background px-4 text-[16px] text-text outline-none focus:shadow-[inset_0_0_0_2px_var(--color-primary)] ${
              e.category_id ? "shadow-[inset_0_0_0_1.5px_var(--color-error)]" : "shadow-[inset_0_0_0_1px_var(--color-border)]"
            }`}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {e.category_id ? <p className="text-[13px] text-error">{e.category_id}</p> : null}
        </div>
        <Field label="Position (facultatif)" name="seat" placeholder="Table 4" autoComplete="off" defaultValue={v("seat")} error={e.seat} />
      </div>
      <Field
        label="Nombre de personnes"
        name="seats"
        type="number"
        min={1}
        max={20}
        inputMode="numeric"
        defaultValue={v("seats")}
        error={e.seats}
        hint="L'invité compris. Sur sa page, il indique combien viendront ; tous entrent au même scan."
      />
      {state.message ? (
        <p role="alert" className="rounded-md bg-surface px-4 py-3 text-[14px] text-error">
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href={cancelHref} className="text-center text-[14px] font-semibold text-text-muted hover:text-text hover:underline">
          Annuler
        </Link>
        <Button type="submit" disabled={pending} className="h-11 text-[14px]">
          {pending ? null : <Icon name="valide" width={18} height={18} />}
          {pending ? "Enregistrement…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
