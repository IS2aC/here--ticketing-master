"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/field";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import type { LinkState } from "./actions";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface"
    >
      <Icon name={copied ? "valide" : "partager"} width={16} height={16} className={copied ? "text-success" : undefined} />
      {copied ? "Copié" : "Copier le lien"}
    </button>
  );
}

export function NewLinkForm({ action }: { action: (state: LinkState, formData: FormData) => Promise<LinkState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <Field label="Nom de l'entrée" name="label" maxLength={60} placeholder="Entrée de la réception" />
      <Button type="submit" disabled={pending} className="h-[52px]">
        <Icon name="ajouter" width={18} height={18} />
        {pending ? "Création…" : "Créer un lien de scan"}
      </Button>
      {state.message ? (
        <p role="alert" className="text-[13px] text-error sm:col-span-2">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
