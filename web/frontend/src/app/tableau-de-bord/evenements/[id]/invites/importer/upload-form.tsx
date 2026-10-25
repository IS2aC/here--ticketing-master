"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import type { ImportFormState } from "./actions";

export function UploadForm({ action }: { action: (state: ImportFormState, formData: FormData) => Promise<ImportFormState> }) {
  const [state, formAction] = useActionState(action, {});
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);

  // Envoi manuel : le fichier choisi reste sélectionné si l'API le refuse.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <label
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg px-6 py-10 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
          fileName ? "bg-background shadow-[inset_0_0_0_1.5px_var(--color-text)]" : "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-border)] hover:bg-background"
        }`}
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-background text-text-muted shadow-sm">
          <Icon name="importer" width={26} height={26} />
        </span>
        <span className="font-heading text-[16px] font-semibold">{fileName ?? "Choisissez votre fichier"}</span>
        <span className="text-[13px] text-text-muted">
          {fileName ? "Cliquez pour choisir un autre fichier." : "Excel (.xlsx) ou CSV, 5 Mo maximum."}
        </span>
        <input
          type="file"
          name="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          required
          className="sr-only"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
        />
      </label>
      {state.message ? (
        <div role="alert" className="flex items-start gap-3 rounded-md bg-surface px-4 py-3 text-[14px]">
          <Icon name="alerte" width={18} height={18} className="mt-0.5 shrink-0 text-error" />
          <p>
            <span className="font-semibold text-error">{state.message}</span>
            <span className="block text-text-muted">Votre liste d&apos;invités n&apos;a pas été modifiée.</span>
          </p>
        </div>
      ) : null}
      <Button type="submit" disabled={pending || !fileName} className="h-12 justify-self-end">
        {pending ? "Lecture du fichier…" : "Lire le fichier"}
        {pending ? null : <Icon name="fleche-droite" width={18} height={18} />}
      </Button>
    </form>
  );
}
