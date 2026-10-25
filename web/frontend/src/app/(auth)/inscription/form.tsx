"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field } from "@/components/ui";
import { register, type FormState } from "../actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(register, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};

  return (
    <form action={action} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Prénom" name="first_name" autoComplete="given-name" required defaultValue={v.first_name} error={e.first_name} />
        <Field label="Nom" name="last_name" autoComplete="family-name" required defaultValue={v.last_name} error={e.last_name} />
      </div>
      <Field
        label="Téléphone (WhatsApp)"
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="07 00 00 00 00"
        required
        defaultValue={v.phone}
        error={e.phone}
        hint="Il vous servira à vous connecter."
      />
      <Field
        label="E-mail (facultatif)"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={v.email}
        error={e.email}
      />
      <Field
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        error={e.password}
        hint="8 caractères minimum."
      />
      {state.message ? (
        <p role="alert" className="rounded-md bg-surface px-4 py-3 text-[14px] text-error">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Création du compte…" : "Créer mon compte"}
      </Button>
      <p className="text-center text-[14px] text-text-muted">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="font-semibold text-accent-text hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
