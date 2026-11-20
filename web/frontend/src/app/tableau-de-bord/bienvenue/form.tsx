"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field } from "@/components/field";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import { savePhone, type PhoneState } from "./actions";

export function PhoneForm() {
  const [state, action, pending] = useActionState<PhoneState, FormData>(savePhone, {});
  return (
    <form action={action} noValidate className="grid gap-5">
      <Field
        label="Numéro WhatsApp (facultatif)"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="07 07 12 34 56"
        defaultValue={state.phone}
        error={state.error}
        hint="Pour que l'équipe Here! puisse vous joindre. Vous pourrez l'ajouter plus tard dans « Mon profil »."
      />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/tableau-de-bord" className="text-center text-[14px] font-semibold text-text-muted hover:text-text hover:underline">
          Plus tard
        </Link>
        <Button type="submit" disabled={pending} className="h-11 text-[14px]">
          {pending ? null : <Icon name="valide" width={18} height={18} />}
          {pending ? "Enregistrement…" : "Enregistrer mon numéro"}
        </Button>
      </div>
    </form>
  );
}
