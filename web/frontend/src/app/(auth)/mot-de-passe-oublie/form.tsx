"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthAlert, AuthField, AuthSubmit } from "@/components/auth/auth-field";
import { AuthHeading } from "@/components/auth/auth-heading";
import { Icon } from "@/components/icons";
import { confirmReset, requestReset, type ResetState } from "../actions";

// Deux étapes : le téléphone ou l'e-mail du compte, puis le code reçu sur WhatsApp et le nouveau mot de passe.
export function ResetForm() {
  const [asked, ask, asking] = useActionState<ResetState, FormData>(requestReset, {});
  const [confirmed, confirm, confirming] = useActionState<ResetState, FormData>(confirmReset, {});
  const identifier = asked.values?.identifier ?? "";

  if (asked.step !== "code") {
    return (
      <>
        <AuthHeading badge="Mot de passe oublié" badgeIcon="cadenas" title="Retrouvez" accent="votre accès">
          Indiquez le téléphone ou l&apos;e-mail de votre compte : nous vous envoyons un code sur WhatsApp.
        </AuthHeading>
        <form action={ask} className="grid gap-5" noValidate>
          <AuthField
            label="Téléphone ou e-mail"
            name="identifier"
            icon="profil"
            autoComplete="username"
            required
            defaultValue={identifier}
            error={asked.errors?.identifier}
          />
          {asked.message ? <AuthAlert>{asked.message}</AuthAlert> : null}
          <div className="mt-1">
            <AuthSubmit pending={asking} pendingLabel="Envoi…">
              Recevoir un code
            </AuthSubmit>
          </div>
          <BackToLogin />
        </form>
      </>
    );
  }

  return (
    <>
      <AuthHeading badge="Mot de passe oublié" badgeIcon="cadenas" title="Saisissez" accent="votre code" />
      <p className="-mt-3 mb-8 flex items-start gap-2 text-text-muted">
        <Icon name="message" width={20} height={20} className="mt-0.5 shrink-0 text-status-confirmed" />
        <span>
          Si un compte correspond à « {identifier} », un code à 6 chiffres vient d&apos;être envoyé sur WhatsApp, au numéro du
          compte. Il est valable 15 minutes.
        </span>
      </p>
      <form action={confirm} className="grid gap-5" noValidate>
        <input type="hidden" name="identifier" value={identifier} />
        <AuthField
          label="Code reçu sur WhatsApp"
          name="code"
          icon="message"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123 456"
          maxLength={7}
          required
          error={confirmed.errors?.code}
        />
        <AuthField
          label="Nouveau mot de passe"
          name="password"
          icon="cadenas"
          type="password"
          autoComplete="new-password"
          required
          error={confirmed.errors?.password}
          hint="8 caractères au moins."
        />
        <AuthField label="Confirmez le mot de passe" name="confirm" type="password" icon="cadenas" autoComplete="new-password" required error={confirmed.errors?.confirm} />
        {confirmed.message ? <AuthAlert>{confirmed.message}</AuthAlert> : null}
        <div className="mt-1">
          <AuthSubmit pending={confirming} pendingLabel="Enregistrement…">
            Changer le mot de passe
          </AuthSubmit>
        </div>
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
