"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field } from "@/components/field";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import { confirmReset, requestReset, type ResetState } from "../actions";

// Deux étapes : le téléphone ou l'e-mail du compte, puis le code reçu sur WhatsApp et le nouveau mot de passe.
export function ResetForm() {
  const [asked, ask, asking] = useActionState<ResetState, FormData>(requestReset, {});
  const [confirmed, confirm, confirming] = useActionState<ResetState, FormData>(confirmReset, {});
  const identifier = asked.values?.identifier ?? "";

  if (asked.step !== "code") {
    return (
      <>
        <h1 className="font-heading text-[32px] leading-[1.15] font-bold tracking-[-0.01em]">Mot de passe oublié</h1>
        <p className="mt-2 mb-8 text-text-muted">
          Indiquez le téléphone ou l&apos;e-mail de votre compte : nous vous envoyons un code sur WhatsApp.
        </p>
        <form action={ask} className="grid gap-5" noValidate>
          <Field
            label="Téléphone ou e-mail"
            name="identifier"
            autoComplete="username"
            required
            defaultValue={identifier}
            error={asked.errors?.identifier}
          />
          {asked.message ? (
            <p role="alert" className="rounded-md bg-surface px-4 py-3 text-[14px] text-error">
              {asked.message}
            </p>
          ) : null}
          <Button type="submit" disabled={asking} className="mt-1 w-full">
            {asking ? "Envoi…" : "Recevoir un code"}
          </Button>
          <BackToLogin />
        </form>
      </>
    );
  }

  return (
    <>
      <h1 className="font-heading text-[32px] leading-[1.15] font-bold tracking-[-0.01em]">Saisissez votre code</h1>
      <p className="mt-2 mb-8 flex items-start gap-2 text-text-muted">
        <Icon name="message" width={20} height={20} className="mt-0.5 shrink-0 text-status-confirmed" />
        <span>
          Si un compte correspond à « {identifier} », un code à 6 chiffres vient d&apos;être envoyé sur WhatsApp, au numéro du
          compte. Il est valable 15 minutes.
        </span>
      </p>
      <form action={confirm} className="grid gap-5" noValidate>
        <input type="hidden" name="identifier" value={identifier} />
        <Field
          label="Code reçu sur WhatsApp"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123 456"
          maxLength={7}
          required
          error={confirmed.errors?.code}
        />
        <Field
          label="Nouveau mot de passe"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          error={confirmed.errors?.password}
          hint="8 caractères au moins."
        />
        <Field label="Confirmez le mot de passe" name="confirm" type="password" autoComplete="new-password" required error={confirmed.errors?.confirm} />
        {confirmed.message ? (
          <p role="alert" className="rounded-md bg-surface px-4 py-3 text-[14px] text-error">
            {confirmed.message}
          </p>
        ) : null}
        <Button type="submit" disabled={confirming} className="mt-1 w-full">
          {confirming ? "Enregistrement…" : "Changer le mot de passe"}
        </Button>
        <p className="text-center text-[13px] text-text-muted">Vos autres appareils seront déconnectés.</p>
      </form>
      <form action={ask} className="mt-4 text-center text-[14px] text-text-muted">
        <input type="hidden" name="identifier" value={identifier} />
        Pas de message ?{" "}
        <button type="submit" disabled={asking} className="font-semibold text-accent-text hover:underline disabled:text-text-muted">
          {asking ? "Envoi…" : "Renvoyer un code"}
        </button>
      </form>
      <div className="mt-2">
        <BackToLogin />
      </div>
    </>
  );
}

function BackToLogin() {
  return (
    <p className="text-center text-[14px]">
      <Link href="/connexion" className="font-semibold text-accent-text hover:underline">
        Retour à la connexion
      </Link>
    </p>
  );
}
