"use client";

import { useActionState, useId, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import type { PlatformSettings, PlatformValues } from "@/lib/admin";
import type { SettingsState } from "../actions";
import { CARD } from "../styles";

type Key = keyof PlatformValues;

function show(key: Key, v: PlatformValues): string {
  const value = v[key];
  if (key === "whatsapp_provider") return value === "wasender" ? "WasenderAPI" : "Mode test";
  if (key === "whatsapp_reminder_days_before") return (value as number[]).length ? `${(value as number[]).join(", ")} j avant` : "aucune";
  if (key.endsWith("_hour")) return `${value} h`;
  if (key.endsWith("_seconds")) return `${value} s`;
  if (key.endsWith("_minutes")) return `${value} min`;
  return String(value);
}

export function SettingsForm({ settings, action }: { settings: PlatformSettings; action: (s: SettingsState, f: FormData) => Promise<SettingsState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  const { values, defaults, overridden } = settings;

  // Aide sous chaque champ : valeur par défaut, et retour possible si le réglage a été modifié.
  const meta = (key: Key): ReactNode => (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      Par défaut : {show(key, defaults)}
      {overridden.includes(key) ? (
        <>
          <span className="rounded-sm bg-primary/8 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-primary uppercase">Modifié</span>
          <button type="submit" name="intent" value={`reset:${key}`} formNoValidate disabled={pending} className="font-semibold text-accent-text hover:underline">
            Revenir à la valeur par défaut
          </button>
        </>
      ) : null}
    </span>
  );

  return (
    <form action={formAction} className="grid gap-6" aria-busy={pending}>
      {/* Touche Entrée : enregistre (sinon le premier bouton, « Revenir à la valeur par défaut », serait pris). */}
      <button type="submit" name="intent" value="save" tabIndex={-1} aria-hidden className="sr-only" />

      <section className={`${CARD} p-6`} aria-labelledby="reglages-prestataire">
        <h2 id="reglages-prestataire" className="font-heading text-[15px] font-semibold">
          Prestataire d&apos;envoi WhatsApp
        </h2>
        <p className="mt-1 text-[13px] text-text-muted">Changer de prestataire ne demande pas de redéployer : le worker le prend en compte à son prochain tour.</p>
        <fieldset className="mt-4 grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Prestataire</legend>
          {settings.providers.map((p) => {
            const selectable = p.available && (p.configured || values.whatsapp_provider === p.value);
            return (
              <label
                key={p.value}
                className={`flex items-start gap-3 rounded-xl border p-4 text-[14px] ${
                  selectable ? "cursor-pointer border-border/80 has-[:checked]:border-primary has-[:checked]:bg-primary/5" : "border-border/60 text-text-muted"
                }`}
              >
                <input
                  type="radio"
                  name="whatsapp_provider"
                  value={p.value}
                  defaultChecked={values.whatsapp_provider === p.value}
                  disabled={!selectable}
                  className="mt-1 size-4 accent-[var(--color-primary)]"
                />
                <span>
                  <span className="block font-semibold">{p.label}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[12px]">
                    {!p.available ? (
                      "Bientôt : connecteur à écrire"
                    ) : p.value === "console" ? (
                      "Aucun message ne part : envois simulés"
                    ) : p.configured ? (
                      <span className="flex items-center gap-1 text-status-confirmed">
                        <Icon name="valide" width={13} height={13} />
                        Clé configurée
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-status-unreachable">
                        <Icon name="alerte" width={13} height={13} />
                        Clé absente (WASENDER_API_KEY)
                      </span>
                    )}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <p className="mt-3 text-[12px] text-text-muted">{meta("whatsapp_provider")}</p>
      </section>

      <section className={`${CARD} p-6`} aria-labelledby="reglages-relances">
        <h2 id="reglages-relances" className="font-heading text-[15px] font-semibold">
          Relances
        </h2>
        <p className="mt-1 text-[13px] text-text-muted">
          Calendrier proposé aux organisateurs, qui peuvent ensuite choisir leurs propres dates. Les relances ne partent qu&apos;aux invités sans réponse.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Jours avant l'événement" name="whatsapp_reminder_days_before" defaultValue={values.whatsapp_reminder_days_before.join(", ")} hint={meta("whatsapp_reminder_days_before")} placeholder="14, 7, 2" inputMode="numeric" />
        </div>
      </section>

      <section className={`${CARD} p-6`} aria-labelledby="reglages-cadence">
        <h2 id="reglages-cadence" className="font-heading text-[15px] font-semibold">
          Cadence d&apos;envoi
        </h2>
        <p className="mt-1 text-[13px] text-text-muted">Un invité à la fois, avec des pauses irrégulières, pour protéger le numéro d&apos;envoi du blocage.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Délai minimum (s)" name="whatsapp_min_delay_seconds" type="number" min={5} max={600} step="any" defaultValue={values.whatsapp_min_delay_seconds} hint={meta("whatsapp_min_delay_seconds")} />
          <Field label="Délai maximum (s)" name="whatsapp_max_delay_seconds" type="number" min={5} max={600} step="any" defaultValue={values.whatsapp_max_delay_seconds} hint={meta("whatsapp_max_delay_seconds")} />
          <Field label="Taille d'un lot (invités)" name="whatsapp_batch_size" type="number" min={1} max={500} defaultValue={values.whatsapp_batch_size} hint={meta("whatsapp_batch_size")} />
          <Field label="Pause entre deux lots (min)" name="whatsapp_batch_pause_minutes" type="number" min={0} max={240} step="any" defaultValue={values.whatsapp_batch_pause_minutes} hint={meta("whatsapp_batch_pause_minutes")} />
        </div>
      </section>

      <section className={`${CARD} p-6`} aria-labelledby="reglages-heures">
        <h2 id="reglages-heures" className="font-heading text-[15px] font-semibold">
          Heures d&apos;envoi
        </h2>
        <p className="mt-1 text-[13px] text-text-muted">Heure d&apos;Abidjan. Aucun message ne part la nuit.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Début (h)" name="whatsapp_send_start_hour" type="number" min={0} max={23} defaultValue={values.whatsapp_send_start_hour} hint={meta("whatsapp_send_start_hour")} />
          <Field label="Fin (h)" name="whatsapp_send_end_hour" type="number" min={1} max={24} defaultValue={values.whatsapp_send_end_hour} hint={meta("whatsapp_send_end_hour")} />
          <Field label="Rappel la veille (h)" name="whatsapp_day_before_hour" type="number" min={0} max={23} defaultValue={values.whatsapp_day_before_hour} hint={meta("whatsapp_day_before_hour")} />
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" name="intent" value="save" disabled={pending} className="h-11 text-[14px]">
          {pending ? null : <Icon name="valide" width={18} height={18} />}
          {pending ? "Enregistrement…" : "Enregistrer les réglages"}
        </Button>
        {state.message ? (
          <p role="alert" className="flex items-center gap-1.5 text-[13px] text-error">
            <Icon name="alerte" width={16} height={16} />
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Field({ label, name, hint, ...input }: { label: string; name: string; hint: ReactNode } & React.ComponentProps<"input">) {
  const id = `${useId()}${name}`;
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-text-muted">
        {label}
      </label>
      <input
        id={id}
        name={name}
        required={name !== "whatsapp_reminder_days_before"}
        className="h-11 w-full rounded-xl bg-background px-3.5 font-data text-[15px] tabular-nums shadow-[inset_0_0_0_1px_var(--color-border)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-primary)]"
        {...input}
      />
      <span className="text-[12px] text-text-muted">{hint}</span>
    </div>
  );
}
