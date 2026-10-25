"use client";

import { useActionState } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import type { GenerateState } from "./actions";

export function GenerateButton({ action, label }: { action: () => Promise<GenerateState>; label: string }) {
  const [state, formAction, pending] = useActionState<GenerateState>(action, {});
  return (
    <form action={formAction} className="grid gap-2">
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Préparation des cartes…" : label}
        {pending ? null : <Icon name="fleche-droite" width={18} height={18} />}
      </Button>
      {state.message ? (
        <p role="alert" className="text-[13px] text-error">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
