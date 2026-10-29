"use client";

import { useActionState, useTransition, type FormEvent } from "react";
import { Field } from "@/components/field";
import { Button } from "@/components/ui";
import type { User } from "@/lib/api";
import { localPhone } from "@/lib/phone";
import type { ProfileState } from "./actions";

type Action = (state: ProfileState, formData: FormData) => Promise<ProfileState>;

// Envoi manuel : le formulaire n'est pas vidé si l'API refuse une valeur.
function useManualForm(action: Action) {
  const [state, formAction] = useActionState(action, {});
  const [pending, startTransition] = useTransition();
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }
  return { state, pending, onSubmit };
}

function Message({ state }: { state: ProfileState }) {
  return state.message ? (
    <p role="alert" className="rounded-md bg-surface px-4 py-3 text-[14px] text-error">
      {state.message}
    </p>
  ) : null;
}

export function ProfileForm({ user, action }: { user: User; action: Action }) {
  const { state, pending, onSubmit } = useManualForm(action);
  const e = state.errors ?? {};
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <fieldset className="grid gap-5">
        <legend className="mb-1 font-heading text-[16px] font-semibold">Vos coordonnées</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Prénom" name="first_name" autoComplete="given-name" required defaultValue={user.first_name} error={e.first_name} />
          <Field label="Nom" name="last_name" autoComplete="family-name" required defaultValue={user.last_name} error={e.last_name} />
          <Field
            label="Téléphone (WhatsApp)"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            defaultValue={localPhone(user.phone)}
            error={e.phone}
            hint="Il vous sert à vous connecter."
          />
          <Field label="E-mail (facultatif)" name="email" type="email" autoComplete="email" defaultValue={user.email ?? ""} error={e.email} />
        </div>
      </fieldset>
      <fieldset className="grid gap-5 border-t border-border pt-5">
        <legend className="mb-1 font-heading text-[16px] font-semibold">Votre structure (facultatif)</legend>
        <Field
          label="Entreprise, association ou famille"
          name="organization"
          maxLength={120}
          placeholder="Famille Koffi, Groupe Akwaba…"
          defaultValue={user.organization ?? ""}
          error={e.organization}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Ville" name="city" autoComplete="address-level2" maxLength={80} placeholder="Abidjan" defaultValue={user.city ?? ""} error={e.city} />
          <Field label="Pays" name="country" autoComplete="country-name" maxLength={80} placeholder="Côte d'Ivoire" defaultValue={user.country ?? ""} error={e.country} />
        </div>
      </fieldset>
      <fieldset className="grid gap-5 border-t border-border pt-5">
        <legend className="mb-1 font-heading text-[16px] font-semibold">Facturation (facultatif)</legend>
        <Field
          label="Adresse de facturation"
          name="billing_address"
          autoComplete="street-address"
          maxLength={300}
          defaultValue={user.billing_address ?? ""}
          error={e.billing_address}
        />
        <Field
          label="Numéro d'identification fiscale"
          name="tax_id"
          maxLength={40}
          defaultValue={user.tax_id ?? ""}
          error={e.tax_id}
          hint="Pour une entreprise : il figurera sur vos factures."
        />
      </fieldset>
      <Message state={state} />
      <div className="flex justify-end border-t border-border pt-5">
        <Button type="submit" disabled={pending} className="h-12">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm({ action }: { action: Action }) {
  const { state, pending, onSubmit } = useManualForm(action);
  const e = state.errors ?? {};
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <Field label="Mot de passe actuel" name="current_password" type="password" autoComplete="current-password" required error={e.current_password} />
      <Field
        label="Nouveau mot de passe"
        name="new_password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        error={e.new_password}
        hint="8 caractères minimum."
      />
      <Field label="Confirmez le nouveau mot de passe" name="confirm_password" type="password" autoComplete="new-password" required error={e.confirm_password} />
      <Message state={state} />
      <Button type="submit" variant="ghost" disabled={pending} className="h-12">
        {pending ? "Modification…" : "Changer le mot de passe"}
      </Button>
      <p className="text-[13px] text-text-muted">Vos autres appareils seront déconnectés.</p>
    </form>
  );
}
