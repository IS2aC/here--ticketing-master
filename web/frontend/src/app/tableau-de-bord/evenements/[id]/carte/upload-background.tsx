"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/icons";
import type { BackgroundState } from "./actions";

// Envoi du fond (« Mon propre modèle ») : photo ou image du téléphone, JPEG, PNG ou WebP, 8 Mo au plus.
export function UploadBackground({
  action,
  replace,
}: {
  action: (state: BackgroundState, formData: FormData) => Promise<BackgroundState>;
  replace: boolean; // un fond existe déjà : « Changer de fond »
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [name, setName] = useState<string | null>(null);
  return (
    <form action={formAction} className="grid gap-3 rounded-lg bg-background p-5 shadow-sm">
      <p className="flex items-center gap-2 font-heading text-[15px] font-semibold">
        <Icon name="importer" width={20} height={20} className="text-primary" />
        {replace ? "Changer de fond" : "Importer mon propre modèle"}
      </p>
      {replace ? null : (
        <p className="text-[13px] text-text-muted">
          Votre fond (fait sur Canva, par un graphiste ou en photo) : vous y placez ensuite le nom de chaque invité, sa table et le QR code.
        </p>
      )}
      <label className="flex cursor-pointer items-center gap-3 rounded-xl p-3 shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface">
        <Icon name="invitation" width={20} height={20} className="shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1 truncate text-[14px]">{name ?? "Choisir une image"}</span>
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={(e) => setName(e.target.files?.[0]?.name ?? null)}
          className="sr-only"
        />
      </label>
      <p className="text-[12px] text-text-muted">Portrait, idéalement 1080 × 1350. Une autre forme est recadrée au centre. 8 Mo au plus.</p>
      {state.message ? (
        <p role="alert" className="text-[13px] text-error">
          {state.message}
        </p>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={pending || !name}
          className="inline-flex h-10 items-center gap-2 rounded-full px-4 font-heading text-[14px] font-semibold shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface disabled:text-text-muted"
        >
          {pending ? "Envoi…" : replace ? "Envoyer ce fond" : "Utiliser cette image"}
        </button>
      </div>
    </form>
  );
}
