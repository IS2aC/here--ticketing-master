"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthAlert, AuthField, AuthSubmit } from "@/components/auth/auth-field";
import { register, type FormState } from "../actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(register, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};

  return (
    <form action={action} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <AuthField label="Prénom" name="first_name" autoComplete="given-name" required defaultValue={v.first_name} error={e.first_name} />
        <AuthField label="Nom" name="last_name" autoComplete="family-name" required defaultValue={v.last_name} error={e.last_name} />
      </div>
      <AuthField
        label="Téléphone (WhatsApp)"
        name="phone"
        icon="telephone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="07 00 00 00 00"
        required
        defaultValue={v.phone}
        error={e.phone}
        hint="Il vous servira à vous connecter."
      />
      <AuthField
        label="E-mail (facultatif)"
        name="email"
        icon="message"
        type="email"
        autoComplete="email"
        defaultValue={v.email}
        error={e.email}
      />
      <AuthField
        label="Mot de passe"
        name="password"
        icon="cadenas"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        error={e.password}
        hint="8 caractères minimum."
      />
      {state.message ? <AuthAlert>{state.message}</AuthAlert> : null}
      <div className="mt-1">
        <AuthSubmit pending={pending} pendingLabel="Création du compte…">
          Créer mon compte
        </AuthSubmit>
      </div>
      <p className="mt-1 text-center text-[15px] text-text-muted">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="font-semibold text-accent-text hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
