"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { Icon, type IconName } from "@/components/icons";
import { Button } from "@/components/ui";
import type { DatesState, SendState } from "./actions";

export function SendButton({
  action,
  label,
  pendingLabel,
  icon,
  variant = "primary",
}: {
  action: () => Promise<SendState>;
  label: string;
  pendingLabel: string;
  icon: IconName;
  variant?: "primary" | "ghost";
}) {
  const [state, formAction, pending] = useActionState<SendState>(action, {});
  return (
    <form action={formAction} className="grid gap-2">
      <Button type="submit" disabled={pending} variant={variant} className="w-full">
        {pending ? null : <Icon name={icon} width={18} height={18} />}
        {pending ? pendingLabel : label}
      </Button>
      {state.message ? (
        <p role="alert" className="text-[13px] text-error">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-full px-4 text-[14px] font-semibold shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface disabled:text-text-muted"
    >
      {pending ? "Enregistrement…" : "Enregistrer"}
    </button>
  );
}

export function SettingsForm({
  action,
  remindersEnabled,
  callsEnabled,
  schedule,
  dayBefore,
}: {
  action: (formData: FormData) => Promise<void>;
  remindersEnabled: boolean;
  callsEnabled: boolean;
  schedule: string; // « 7 jours avant l'événement »
  dayBefore: { enabled: boolean; when: string; sent: number } | null; // null : option non active
}) {
  return (
    <form action={action} className="grid gap-3">
      <label className="flex items-start gap-3 text-[14px]">
        <input type="checkbox" name="reminders_enabled" defaultChecked={remindersEnabled} className="mt-1 size-4 accent-[var(--color-ink)]" />
        <span>
          <span className="flex flex-wrap items-center gap-2 font-semibold">
            Relance automatique
            <span className="inline-flex h-[22px] items-center rounded-sm bg-surface px-2 text-[11px] font-semibold tracking-[0.04em] uppercase">
              Offerte
            </span>
          </span>
          <span className="block text-text-muted">
            Une relance WhatsApp à chaque date prévue ({schedule} par défaut), aux invités qui n&apos;ont pas encore répondu.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-[14px]">
        <input type="checkbox" name="calls_enabled" defaultChecked={callsEnabled} className="mt-1 size-4 accent-[var(--color-ink)]" />
        <span>
          <span className="font-semibold">Appels de votre conseillère</span>
          <span className="block text-text-muted">Après la dernière relance, notre équipe appelle les invités qui n&apos;ont pas répondu.</span>
        </span>
      </label>
      {dayBefore ? (
        <label className="flex items-start gap-3 text-[14px]">
          <input type="hidden" name="day_before_shown" value="1" />
          <input type="checkbox" name="day_before_enabled" defaultChecked={dayBefore.enabled} className="mt-1 size-4 accent-[var(--color-ink)]" />
          <span>
            <span className="flex flex-wrap items-center gap-2 font-semibold">
              Rappel la veille
              <span className="inline-flex h-[22px] items-center rounded-sm bg-surface px-2 text-[11px] font-semibold tracking-[0.04em] uppercase">Option</span>
            </span>
            <span className="block text-text-muted">
              Le {dayBefore.when}, la carte avec le QR code d&apos;entrée, renvoyée aux invités qui ont confirmé.
              {dayBefore.sent ? ` ${dayBefore.sent} envoyé${dayBefore.sent > 1 ? "s" : ""}.` : ""}
            </span>
          </span>
        </label>
      ) : null}
      <div>
        <SaveButton />
      </div>
    </form>
  );
}

type ReminderDate = { value: string; label: string; state: "upcoming" | "past" | "after" };

export function ReminderDates({
  action,
  dates,
  empty,
  canAdd,
  min,
  max,
  canReset,
  proposed,
}: {
  action: (previous: DatesState, formData: FormData) => Promise<DatesState>;
  dates: ReminderDate[];
  empty: string;
  canAdd: boolean;
  min: string; // AAAA-MM-JJ
  max: string;
  canReset: boolean;
  proposed: string; // « 7 jours avant l'événement »
}) {
  const [state, formAction, pending] = useActionState<DatesState, FormData>(action, {});
  const inputId = `${useId()}reminder-date`;
  return (
    <form action={formAction} className="grid gap-3" aria-busy={pending}>
      {/* Touche Entrée dans le champ date : ajoute la date (sinon le premier bouton, « Retirer », serait pris). */}
      <button type="submit" name="intent" value="add" tabIndex={-1} aria-hidden className="sr-only" />
      <p className="text-[13px] font-medium tracking-[0.02em] text-text-muted">Dates de relance</p>
      {dates.length ? (
        <ul className="grid gap-1">
          {dates.map((d) => (
            <li key={d.value} className="flex min-h-10 items-center gap-2 text-[14px]">
              <Icon name="calendrier" width={16} height={16} className="shrink-0 text-text-muted" />
              <span className={`min-w-0 flex-1 ${d.state === "upcoming" ? "font-semibold" : "text-text-muted"}`}>
                {d.label}
                {d.state === "past" ? (
                  <span className="block text-[12px]">Passée</span>
                ) : d.state === "after" ? (
                  <span className="flex items-center gap-1 text-[12px] font-semibold text-status-pending">
                    <Icon name="alerte" width={14} height={14} />
                    Après l&apos;événement : ne partira pas
                  </span>
                ) : null}
              </span>
              <button
                type="submit"
                name="intent"
                value={`remove:${d.value}`}
                formNoValidate
                disabled={pending}
                aria-label={`Retirer la relance du ${d.label.toLocaleLowerCase("fr-FR")}`}
                className="h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold text-text-muted hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:text-text-muted"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-start gap-2 text-[13px] text-text-muted">
          <Icon name="calendrier" width={16} height={16} className="mt-0.5 shrink-0" />
          <span>{empty}</span>
        </p>
      )}
      {canAdd ? (
        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor={inputId}>
            Nouvelle date de relance
          </label>
          <input
            id={inputId}
            type="date"
            name="date"
            required
            min={min}
            max={max}
            className="h-10 min-w-0 flex-1 rounded-md bg-background px-3 text-[14px] text-text shadow-[inset_0_0_0_1px_var(--color-border)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-primary)]"
          />
          <button
            type="submit"
            name="intent"
            value="add"
            disabled={pending}
            className="inline-flex h-10 items-center gap-1.5 text-[14px] font-semibold text-accent-text hover:underline disabled:text-text-muted"
          >
            <Icon name="ajouter" width={18} height={18} />
            Ajouter la date
          </button>
        </div>
      ) : null}
      {state.message ? (
        <p role="alert" className="text-[13px] text-error">
          {state.message}
        </p>
      ) : null}
      <p className="text-[12px] text-text-muted">Les relances partent dès 8 h, seulement aux invités qui n&apos;ont pas encore répondu.</p>
      {canReset ? (
        <button
          type="submit"
          name="intent"
          value="reset"
          formNoValidate
          disabled={pending}
          className="justify-self-start text-left text-[13px] font-semibold text-accent-text hover:underline disabled:text-text-muted"
        >
          Revenir au calendrier proposé ({proposed})
        </button>
      ) : null}
    </form>
  );
}
