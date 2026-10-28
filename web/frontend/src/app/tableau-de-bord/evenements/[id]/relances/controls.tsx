"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Icon, type IconName } from "@/components/icons";
import { Button } from "@/components/ui";
import type { SendState } from "./actions";

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
}: {
  action: (formData: FormData) => Promise<void>;
  remindersEnabled: boolean;
  callsEnabled: boolean;
  schedule: string; // « 7 jours avant l'événement »
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
          <span className="block text-text-muted">Une relance WhatsApp {schedule}, aux invités qui n&apos;ont pas encore répondu.</span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-[14px]">
        <input type="checkbox" name="calls_enabled" defaultChecked={callsEnabled} className="mt-1 size-4 accent-[var(--color-ink)]" />
        <span>
          <span className="font-semibold">Appels de votre conseillère</span>
          <span className="block text-text-muted">Après la dernière relance, notre équipe appelle les invités qui n&apos;ont pas répondu.</span>
        </span>
      </label>
      <div>
        <SaveButton />
      </div>
    </form>
  );
}
