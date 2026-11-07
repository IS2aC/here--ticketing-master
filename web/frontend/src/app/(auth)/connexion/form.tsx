"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthAlert, AuthField, AuthSubmit } from "@/components/auth/auth-field";
import { login, type FormState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  // Coché par défaut ; après un échec, on garde le choix de l'utilisateur.
  const remember = state.values ? state.values.remember === "on" : true;

  return (
    <form action={action} className="grid gap-5" noValidate>
      <AuthField
        label="Téléphone ou e-mail"
        name="identifier"
        icon="profil"
        autoComplete="username"
        placeholder="Votre téléphone ou e-mail"
        required
        defaultValue={state.values?.identifier}
      />
      <AuthField
        label="Mot de passe"
        name="password"
        type="password"
        icon="cadenas"
        autoComplete="current-password"
        placeholder="Votre mot de passe"
        required
      />
      <div className="-mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[14px]">
        <label className="flex cursor-pointer items-center gap-2.5 text-text-muted">
          <input
            key={String(remember)}
            type="checkbox"
            name="remember"
            defaultChecked={remember}
            className="size-[18px] cursor-pointer rounded-[5px] accent-[var(--color-primary)]"
          />
          Se souvenir de moi
        </label>
        <Link href="/mot-de-passe-oublie" className="font-semibold text-accent-text hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>
      {state.message ? <AuthAlert>{state.message}</AuthAlert> : null}
      <div className="mt-2">
        <AuthSubmit pending={pending} pendingLabel="Connexion…">
          Se connecter
        </AuthSubmit>
      </div>
      <p className="mt-3 text-center text-[15px] text-text-muted">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-semibold text-accent-text hover:underline">
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
