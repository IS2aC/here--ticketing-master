"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field } from "@/components/field";
import { Button } from "@/components/ui";
import { login, type FormState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});

  return (
    <form action={action} className="grid gap-5" noValidate>
      <Field
        label="Téléphone ou e-mail"
        name="identifier"
        autoComplete="username"
        required
        defaultValue={state.values?.identifier}
      />
      <Field label="Mot de passe" name="password" type="password" autoComplete="current-password" required />
      {state.message ? (
        <p role="alert" className="rounded-md bg-surface px-4 py-3 text-[14px] text-error">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
      <p className="text-center text-[14px] text-text-muted">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-semibold text-accent-text hover:underline">
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
