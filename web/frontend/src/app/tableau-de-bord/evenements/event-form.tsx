"use client";

import { useActionState, useId, useState, useTransition, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { Field } from "@/components/field";
import { Button } from "@/components/ui";
import { EVENT_TYPES, type EventType } from "@/lib/event-types";
import type { EventFormState } from "./actions";

export type EventFormValues = {
  title: string;
  type: EventType | "";
  date: string;
  time: string;
  duration: string;
  location_name: string;
  location_address: string;
  expected_guests: string;
  dress_code: string;
  theme: string;
  colors: string[]; // #RRGGBB, 3 au plus
  rsvp_deadline: string; // AAAA-MM-JJ, vide : jusqu'au début de l'événement
  description: string;
  categories: string[];
};

export const EMPTY_EVENT: EventFormValues = {
  title: "",
  type: "",
  date: "",
  time: "",
  duration: "",
  location_name: "",
  location_address: "",
  expected_guests: "",
  dress_code: "",
  theme: "",
  colors: [],
  rsvp_deadline: "",
  description: "",
  categories: ["VIP", "Normal"],
};

type Props = {
  action: (state: EventFormState, formData: FormData) => Promise<EventFormState>;
  initial: EventFormValues;
  submitLabel: string;
  pendingLabel: string;
};

export function EventForm({ action, initial, submitLabel, pendingLabel }: Props) {
  const [state, formAction] = useActionState(action, {});
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState(initial.type);
  const descriptionId = useId();
  const e = state.errors ?? {};

  // Envoi manuel : contrairement à <form action>, le formulaire n'est pas vidé si l'API refuse une valeur.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 rounded-lg bg-background p-5 shadow-sm sm:p-6" noValidate>
      <fieldset className="grid gap-3">
        <legend className="mb-3 font-heading text-[16px] font-semibold">Quel type d&apos;événement organisez-vous ?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
          {EVENT_TYPES.map((t) => (
            <label
              key={t.value}
              className={`flex h-[78px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md text-[13px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                type === t.value
                  ? "font-semibold shadow-[inset_0_0_0_2px_var(--color-primary)]"
                  : "font-medium shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={t.value}
                checked={type === t.value}
                onChange={() => setType(t.value)}
                className="sr-only"
              />
              <Icon name={t.icon} width={24} height={24} className={type === t.value ? "text-primary" : "text-text-muted"} />
              {t.label}
            </label>
          ))}
        </div>
        {e.type ? <p className="text-[13px] text-error">{e.type}</p> : null}
      </fieldset>

      <div className="grid gap-5 md:grid-cols-[2fr_1.4fr_1fr]">
        <Field label="Nom de l'événement" name="title" required maxLength={150} placeholder="Mariage Aya & Koffi" defaultValue={initial.title} error={e.title} />
        <Field label="Date" name="date" type="date" required defaultValue={initial.date} error={e.date} />
        <Field label="Heure" name="time" type="time" required defaultValue={initial.time} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Lieu" name="location_name" maxLength={200} placeholder="Église Saint-Jacques" defaultValue={initial.location_name} error={e.location_name} />
        <Field label="Adresse" name="location_address" maxLength={300} placeholder="Cocody, Abidjan" defaultValue={initial.location_address} error={e.location_address} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Invités prévus" name="expected_guests" type="number" min={0} max={100000} inputMode="numeric" defaultValue={initial.expected_guests} error={e.expected_guests} />
        <Field label="Durée (heures)" name="duration" type="number" min={0.5} max={168} step={0.5} inputMode="decimal" defaultValue={initial.duration} error={e.duration} />
      </div>

      <fieldset className="grid gap-4 rounded-md p-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <legend className="px-1 font-heading text-[15px] font-semibold">Ambiance de la carte</legend>
        <p className="-mt-2 text-[13px] text-text-muted">Repris pour composer et générer votre carte d&apos;invitation.</p>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Thème (facultatif)" name="theme" maxLength={100} placeholder="Nuit à Marrakech, chic et doré…" defaultValue={initial.theme} error={e.theme} hint="L'ambiance que la carte doit évoquer." />
          <Field
            label="Dress code"
            name="dress_code"
            maxLength={100}
            placeholder="Dress code Libre"
            defaultValue={initial.dress_code === "Dress code Libre" ? "" : initial.dress_code}
            error={e.dress_code}
            hint="Vide : « Dress code Libre »."
          />
        </div>
        <Colors initial={initial.colors} error={e.colors} />
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          label="Date limite de réponse (facultatif)"
          name="rsvp_deadline"
          type="date"
          defaultValue={initial.rsvp_deadline}
          error={e.rsvp_deadline}
          hint="Après ce jour, vos invités ne peuvent plus répondre. Sans date : jusqu'au début de l'événement."
        />
      </div>

      <div className="grid min-w-0 gap-1.5">
        <label htmlFor={descriptionId} className="text-[13px] font-medium tracking-[0.02em] text-text-muted">
          Description (facultatif)
        </label>
        <textarea
          id={descriptionId}
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={initial.description}
          className="w-full min-w-0 rounded-md bg-background px-4 py-3 text-[16px] text-text shadow-[inset_0_0_0_1px_var(--color-border)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-primary)]"
        />
        {e.description ? <p className="text-[13px] text-error">{e.description}</p> : null}
      </div>

      <Categories initial={initial.categories} error={e.categories} />

      {state.message ? (
        <p role="alert" className="rounded-md bg-surface px-4 py-3 text-[14px] text-error">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col-reverse items-stretch gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-[13px] text-text-muted sm:max-w-sm">
          <Icon name="cadenas" width={18} height={18} className="mt-0.5 shrink-0" />
          Vos informations restent privées. Seule l&apos;équipe Here! qui vous accompagne y a accès.
        </p>
        <Button type="submit" disabled={pending} className="h-12">
          {pending ? pendingLabel : submitLabel}
          {pending ? null : <Icon name="fleche-droite" width={18} height={18} />}
        </Button>
      </div>
    </form>
  );
}

const SUGGESTED_COLORS = ["#C9A24A", "#0B0B0B", "#FFFFFF", "#B76E5C", "#1F3A5F", "#6B8F71"];

/** Code couleur : 1 à 3 couleurs, choisies au sélecteur ou parmi des suggestions. */
function Colors({ initial, error }: { initial: string[]; error?: string }) {
  const [colors, setColors] = useState(initial);
  const [draft, setDraft] = useState("#C9A24A");
  const add = (color: string) => {
    const value = color.toUpperCase();
    if (colors.length < 3 && !colors.includes(value)) setColors([...colors, value]);
  };

  return (
    <div className="grid gap-2">
      <p className="text-[13px] font-medium tracking-[0.02em] text-text-muted">Code couleur (facultatif, 3 couleurs au plus)</p>
      <div className="flex flex-wrap items-center gap-2">
        {colors.map((color) => (
          <span key={color} className="inline-flex h-10 items-center gap-2 rounded-full bg-surface pr-1.5 pl-1.5 text-[13px] font-medium">
            <input type="hidden" name="colors" value={color} />
            <span className="size-7 rounded-full shadow-[inset_0_0_0_1px_var(--color-border)]" style={{ background: color }} />
            <span className="font-data">{color}</span>
            <button
              type="button"
              onClick={() => setColors(colors.filter((c) => c !== color))}
              aria-label={`Retirer la couleur ${color}`}
              className="flex size-7 items-center justify-center rounded-full text-text-muted hover:bg-background hover:text-text"
            >
              <Icon name="decline" width={16} height={16} />
            </button>
          </span>
        ))}
        {colors.length < 3 ? (
          <span className="inline-flex items-center gap-2">
            <input
              type="color"
              aria-label="Choisir une couleur"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="h-10 w-12 cursor-pointer rounded-md bg-background p-1 shadow-[inset_0_0_0_1px_var(--color-border)]"
            />
            <button
              type="button"
              onClick={() => add(draft)}
              className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-[14px] font-semibold text-accent-text hover:bg-surface"
            >
              <Icon name="ajouter" width={16} height={16} />
              Ajouter
            </button>
          </span>
        ) : null}
      </div>
      {colors.length < 3 ? (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Suggestions">
          {SUGGESTED_COLORS.filter((c) => !colors.includes(c)).map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => add(color)}
              aria-label={`Ajouter ${color}`}
              title={color}
              className="size-7 rounded-full shadow-[inset_0_0_0_1px_var(--color-border)] hover:scale-110"
              style={{ background: color }}
            />
          ))}
        </div>
      ) : null}
      {error ? <p className="text-[13px] text-error">{error}</p> : null}
    </div>
  );
}

function Categories({ initial, error }: { initial: string[]; error?: string }) {
  const [names, setNames] = useState(initial);
  const [draft, setDraft] = useState("");

  function add() {
    const name = draft.trim();
    if (name && names.length < 10 && !names.some((n) => n.toLowerCase() === name.toLowerCase())) {
      setNames([...names, name]);
    }
    setDraft("");
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 text-[13px] font-medium tracking-[0.02em] text-text-muted">Catégories d&apos;invités</legend>
      <div className="flex flex-wrap items-center gap-2">
        {names.map((name) => (
          <span key={name} className="inline-flex h-10 items-center gap-1 rounded-full bg-surface pr-1.5 pl-4 text-[14px] font-medium">
            <input type="hidden" name="categories" value={name} />
            {name}
            <button
              type="button"
              onClick={() => setNames(names.filter((n) => n !== name))}
              disabled={names.length === 1}
              aria-label={`Retirer la catégorie ${name}`}
              className="flex size-7 items-center justify-center rounded-full text-text-muted hover:bg-background hover:text-text disabled:invisible"
            >
              <Icon name="decline" width={16} height={16} />
            </button>
          </span>
        ))}
        {names.length < 10 ? (
          <span className="inline-flex items-center gap-1">
            <input
              aria-label="Nouvelle catégorie"
              value={draft}
              maxLength={40}
              placeholder="Famille, Amis…"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add();
                }
              }}
              className="h-10 w-36 rounded-full bg-background px-4 text-[14px] shadow-[inset_0_0_0_1px_var(--color-border)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-primary)]"
            />
            <button type="button" onClick={add} className="inline-flex h-10 items-center gap-1 px-2 text-[14px] font-semibold text-accent-text hover:underline">
              <Icon name="ajouter" width={18} height={18} />
              Ajouter
            </button>
          </span>
        ) : null}
      </div>
      <p className={`text-[13px] ${error ? "text-error" : "text-text-muted"}`}>
        {error ?? "La catégorie s'affiche discrètement sur la carte de chaque invité."}
      </p>
    </fieldset>
  );
}
