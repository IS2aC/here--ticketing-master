"use client";

import { useActionState } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import type { ImportFormState } from "../actions";

export function ConfirmButton({ action, count }: { action: (state: ImportFormState) => Promise<ImportFormState>; count: number }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="grid justify-items-end gap-2">
      <Button type="submit" disabled={pending || count === 0} className="h-12">
        {pending ? "Import en cours…" : `Importer ${count.toLocaleString("fr-FR")} invité${count > 1 ? "s" : ""}`}
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
