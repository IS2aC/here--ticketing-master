"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import type { EditorTemplate } from "@/lib/events";
import type { EditorState } from "./actions";

// Canvas des cartes d'invitation : la carte se dessine dans l'éditeur (Doory), comme sur Canva. Le nom de l'invité,
// sa table et le QR code y sont des emplacements ; Here! les remplit pour chaque invité une fois la carte validée.
export function EditorPanel({
  templates,
  inProgress,
  validated,
  open,
  validate,
}: {
  templates: EditorTemplate[] | null; // null : l'éditeur ne répond pas
  inProgress: boolean; // une carte existe dans l'éditeur
  validated: boolean; // la carte de l'éditeur est celle des invités
  open: (options: { template?: string | null; fresh?: boolean }) => Promise<{ url?: string; message?: string }>;
  validate: () => Promise<EditorState>;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null); // modèle en cours d'ouverture (« vierge », « reprendre »)
  const [pending, startTransition] = useTransition();

  const go = (key: string, options: { template?: string | null; fresh?: boolean }) => {
    setMessage(null);
    setOpening(key);
    startTransition(async () => {
      const result = await open(options);
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      setOpening(null);
      setMessage(result.message ?? "L'éditeur de cartes est momentanément indisponible.");
    });
  };

  const confirm = () => {
    setMessage(null);
    setOpening("valider");
    startTransition(async () => {
      const result = await validate();
      setOpening(null);
      if (result.message) setMessage(result.message);
    });
  };

  const busy = pending || opening !== null;

  return (
    <div className="grid gap-4 rounded-lg bg-background p-5 shadow-sm">
      <div className="grid gap-1">
        <p className="flex items-center gap-2 font-heading text-[16px] font-semibold">
          <Icon name="modifier" width={20} height={20} className="text-primary" />
          Canvas des cartes
        </p>
        <p className="text-[13px] text-text-muted">
          Créez votre carte comme sur Canva : textes, photos, formes. Placez le nom de l&apos;invité, sa table et le QR code : Here! les
          remplit pour chaque invité.
        </p>
      </div>

      {inProgress ? (
        <div className="grid gap-2">
          <Button type="button" disabled={busy} onClick={() => go("reprendre", {})} className="w-full">
            {opening === "reprendre" ? "Ouverture de l'éditeur…" : "Reprendre ma carte dans l'éditeur"}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={confirm} className="w-full">
            {opening === "valider" ? "Validation…" : validated ? "Valider de nouveau" : "Valider la carte"}
          </Button>
          <p className="text-[12px] text-text-muted">
            {validated
              ? "Vos invités reçoivent cette carte. Après une modification dans l'éditeur, validez-la de nouveau."
              : "Une fois validée, votre carte devient celle de chaque invité, avec son nom et son QR code."}
          </p>
        </div>
      ) : null}

      {message ? (
        <p role="alert" className="text-[13px] text-error">
          {message}
        </p>
      ) : null}

      <div className="grid gap-2">
        <p className="text-[13px] font-medium text-text-muted">{inProgress ? "Ou repartir d'un modèle" : "Choisissez un modèle"}</p>
        {templates === null ? (
          <p className="text-[13px] text-text-muted">Les modèles ne sont pas disponibles pour le moment.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => go("vierge", { template: null, fresh: true })}
              className="grid aspect-[4/5] content-center justify-items-center gap-1 rounded-md p-2 text-[12px] font-medium shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface disabled:opacity-60"
            >
              <Icon name="ajouter" width={20} height={20} className="text-text-muted" />
              {opening === "vierge" ? "Ouverture…" : "Carte vierge"}
            </button>
            {templates.map((t) => (
              <button
                key={t.slug}
                type="button"
                disabled={busy}
                title={t.title}
                onClick={() => go(t.slug, { template: t.slug, fresh: true })}
                className="group relative aspect-[4/5] overflow-hidden rounded-md bg-surface shadow-[inset_0_0_0_1px_var(--color-border)] disabled:opacity-60"
              >
                {t.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element -- vignette servie par l'éditeur
                  <img src={t.thumbnail} alt="" className="absolute inset-0 size-full object-cover" />
                ) : null}
                <span className="absolute inset-x-0 bottom-0 truncate bg-ink/70 px-1.5 py-1 text-left text-[11px] text-white">
                  {opening === t.slug ? "Ouverture…" : t.title}
                </span>
              </button>
            ))}
          </div>
        )}
        {inProgress ? (
          <p className="text-[12px] text-text-muted">Un nouveau modèle remplace la carte en cours dans l&apos;éditeur.</p>
        ) : null}
      </div>
    </div>
  );
}
