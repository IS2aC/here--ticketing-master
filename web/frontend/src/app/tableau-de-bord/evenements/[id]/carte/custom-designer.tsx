"use client";

import { useEffect, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { CANVAS, FONT_FAMILY, QR_BOX, QR_SPOTS, qrPosition, textBox, type CardLayout, type TextLayout } from "@/lib/card/layout";

// « Mon propre modèle » : le nom de l'invité et la table / catégorie se placent au doigt sur le fond importé,
// avec un nom d'exemple. La géométrie est celle du rendu (lib/card/layout) : la carte réelle correspond.

type Zone = "name" | "table";

const SWATCHES = ["#0B0B0B", "#FFFFFF", "#A8823C", "#7D2335", "#1B2A4A", "#E10600"];
const DEFAULT_TABLE: TextLayout = { x: 540, y: 790, size: 34, color: "#0B0B0B", font: "sans", bold: false };

export function CustomDesigner({
  background,
  preview,
  initial,
  sample,
  locked,
  save,
  remove,
  children,
}: {
  background: string; // fond importé (…/carte/fond.jpg)
  preview: string; // rendu réel de la carte (…/carte.png)
  initial: CardLayout;
  sample: { name: string; table: string };
  locked: boolean;
  save: (layout: CardLayout) => Promise<{ message?: string; saved?: number }>;
  remove: () => Promise<{ message?: string }>;
  children: ReactNode; // autres encarts de la colonne
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4); // largeur affichée / 1080
  const [layout, setLayout] = useState<CardLayout>(initial);
  const [zone, setZone] = useState<Zone>("name");
  const [drag, setDrag] = useState<Zone | null>(null);
  const [saved, setSaved] = useState<CardLayout>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // recharge l'aperçu réel après un enregistrement
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / CANVAS.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const current = zone === "table" ? layout.table : layout.name;
  const changed = JSON.stringify(layout) !== JSON.stringify(saved);

  // Une zone déplacée ou retouchée ici n'a plus la zone exacte venue de l'éditeur : elle suit son centre.
  const update = (z: Zone, patch: Partial<TextLayout>) =>
    setLayout((l) =>
      z === "name" ? { ...l, name: { ...l.name, ...patch, box: null } } : l.table ? { ...l, table: { ...l.table, ...patch, box: null } } : l,
    );

  // Glisser au doigt ou à la souris : le centre de la zone suit le pointeur (en pixels de la carte).
  const move = (event: ReactPointerEvent) => {
    if (!drag || !canvas.current) return;
    const rect = canvas.current.getBoundingClientRect();
    const x = Math.round(Math.min(Math.max(((event.clientX - rect.left) / rect.width) * CANVAS.width, 40), CANVAS.width - 40));
    const y = Math.round(Math.min(Math.max(((event.clientY - rect.top) / rect.height) * CANVAS.height, 30), CANVAS.height - 30));
    update(drag, { x, y });
  };

  const zoneStyle = (t: TextLayout) => {
    const box = textBox(t);
    return {
      left: box.left * scale,
      top: box.top * scale,
      width: box.width * scale,
      height: box.height * scale,
      fontFamily: FONT_FAMILY[t.font],
      fontWeight: t.bold ? 600 : 400,
      fontSize: t.size * scale,
      color: t.color,
      lineHeight: 1.2,
    };
  };

  const qr = qrPosition(layout.qr);

  if (locked) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex items-center justify-center rounded-lg bg-background p-5 shadow-sm sm:p-8">
          {/* eslint-disable-next-line @next/next/no-img-element -- image générée à la demande */}
          <img src={preview} alt="Votre carte d'invitation" width={1080} height={1350} className="h-auto w-full max-w-[480px] rounded-md shadow-lg" />
        </section>
        <aside className="grid content-start gap-4">
          <p className="flex items-start gap-2 rounded-lg bg-background p-5 text-[14px] text-text-muted shadow-sm">
            <Icon name="cadenas" width={18} height={18} className="mt-0.5 shrink-0" />
            <span>Les invitations sont parties : votre modèle ne peut plus être modifié.</span>
          </p>
          {children}
        </aside>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="grid content-start justify-items-center gap-3 rounded-lg bg-background p-4 shadow-sm sm:p-8">
        <p className="text-[13px] text-text-muted">Faites glisser le nom et la table pour les placer sur votre fond.</p>
        <div
          ref={canvas}
          onPointerMove={move}
          onPointerUp={() => setDrag(null)}
          onPointerCancel={() => setDrag(null)}
          className="relative aspect-[4/5] w-full max-w-[480px] touch-none overflow-hidden rounded-md bg-surface shadow-lg select-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- fond importé par l'organisateur */}
          <img src={background} alt="" draggable={false} className="absolute inset-0 size-full" />
          {(["name", "table"] as const).map((z) => {
            const t = z === "name" ? layout.name : layout.table;
            if (!t) return null;
            return (
              <button
                key={z}
                type="button"
                onPointerDown={(e) => {
                  setZone(z);
                  setDrag(z);
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId); // le glissé continue hors de la zone
                  } catch {
                    // pointeur déjà relâché : sans capture, le glissé suit quand même la carte
                  }
                }}
                onPointerMove={move}
                onPointerUp={() => setDrag(null)}
                aria-label={z === "name" ? "Nom de l'invité" : "Table et catégorie"}
                className={`absolute flex cursor-grab items-center justify-center overflow-hidden text-center ${
                  zone === z ? "outline-2 outline-offset-2 outline-primary outline-dashed" : "outline-1 outline-dashed outline-white/60"
                } ${drag === z ? "cursor-grabbing" : ""}`}
                style={zoneStyle(t)}
              >
                {z === "name" ? sample.name : sample.table}
              </button>
            );
          })}
          <div
            className="absolute flex flex-col items-center justify-center gap-1 rounded-[10px] bg-white text-ink shadow"
            style={{ left: qr.left * scale, top: qr.top * scale, width: QR_BOX.width * scale, height: QR_BOX.height * scale }}
            aria-label="Emplacement du QR code"
          >
            <Icon name="qr-code" width={Math.max(28, 150 * scale)} height={Math.max(28, 150 * scale)} />
            <span className="text-[10px] font-semibold">QR code</span>
          </div>
        </div>
      </section>

      <aside className="grid content-start gap-4">
        <div className="grid gap-4 rounded-lg bg-background p-5 shadow-sm">
          <p className="flex items-center gap-2 font-heading text-[16px] font-semibold">
            <Icon name="modifier" width={20} height={20} className="text-primary" />
            Mon propre modèle
          </p>
          <div className="flex rounded-full bg-surface p-1" role="group" aria-label="Zone à régler">
            {(
              [
                ["name", "Nom de l'invité"],
                ["table", "Table · catégorie"],
              ] as const
            ).map(([z, label]) => (
              <button
                key={z}
                type="button"
                aria-pressed={zone === z}
                onClick={() => setZone(z)}
                className={`h-8 flex-1 rounded-full text-[13px] font-semibold ${zone === z ? "bg-background shadow-sm" : "text-text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {zone === "table" ? (
            <label className="flex items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                checked={Boolean(layout.table)}
                onChange={(e) => setLayout((l) => ({ ...l, table: e.target.checked ? (l.table ?? DEFAULT_TABLE) : null }))}
                className="size-4 accent-[var(--color-ink)]"
              />
              Afficher la table et la catégorie de l&apos;invité
            </label>
          ) : null}

          {current ? (
            <div className="grid gap-3">
              <label className="grid gap-1 text-[13px] font-medium text-text-muted">
                Taille du texte
                <input type="range" min={18} max={160} value={current.size} onChange={(e) => update(zone, { size: Number(e.target.value) })} className="accent-[var(--color-primary)]" />
              </label>
              <div className="grid gap-1.5">
                <span className="text-[13px] font-medium text-text-muted">Couleur</span>
                <div className="flex flex-wrap items-center gap-2">
                  {SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Couleur ${c}`}
                      onClick={() => update(zone, { color: c })}
                      className={`size-8 rounded-full shadow-[0_0_0_1px_var(--color-border)] ${current.color.toUpperCase() === c ? "ring-2 ring-primary ring-offset-2" : ""}`}
                      style={{ background: c }}
                    />
                  ))}
                  <label className="relative size-8 cursor-pointer overflow-hidden rounded-full shadow-[0_0_0_1px_var(--color-border)]" title="Autre couleur">
                    <span className="sr-only">Autre couleur</span>
                    <input type="color" value={current.color} onChange={(e) => update(zone, { color: e.target.value.toUpperCase() })} className="absolute -inset-2 size-12 cursor-pointer" />
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["serif", "Élégante"],
                    ["sans", "Moderne"],
                  ] as const
                ).map(([font, label]) => (
                  <button
                    key={font}
                    type="button"
                    aria-pressed={current.font === font}
                    onClick={() => update(zone, { font })}
                    className={`h-9 rounded-full px-4 text-[14px] shadow-[inset_0_0_0_1px_var(--color-border)] ${current.font === font ? "shadow-[inset_0_0_0_2px_var(--color-primary)]" : ""}`}
                    style={{ fontFamily: FONT_FAMILY[font] }}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={current.bold}
                  onClick={() => update(zone, { bold: !current.bold })}
                  className={`h-9 rounded-full px-4 text-[14px] font-semibold shadow-[inset_0_0_0_1px_var(--color-border)] ${current.bold ? "shadow-[inset_0_0_0_2px_var(--color-primary)]" : ""}`}
                >
                  Gras
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <span className="text-[13px] font-medium text-text-muted">QR code d&apos;entrée</span>
            <div className="grid grid-cols-2 gap-2">
              {QR_SPOTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={layout.qr === s.id}
                  onClick={() => setLayout((l) => ({ ...l, qr: s.id }))}
                  className={`h-9 rounded-lg px-2 text-[12px] font-medium shadow-[inset_0_0_0_1px_var(--color-border)] ${layout.qr === s.id ? "shadow-[inset_0_0_0_2px_var(--color-primary)]" : "hover:bg-surface"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <span className="text-[12px] text-text-muted">Toujours sur fond blanc, avec le code et le sceau Here!, pour rester lisible au scan.</span>
          </div>

          {message ? (
            <p role="alert" className="text-[13px] text-error">
              {message}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || !changed}
              onClick={() =>
                startTransition(async () => {
                  const result = await save(layout);
                  setMessage(result.message ?? null);
                  if (!result.message) {
                    setSaved(layout);
                    setVersion((v) => v + 1);
                  }
                })
              }
              className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 font-heading text-[14px] font-semibold text-white hover:bg-ink-700 disabled:bg-surface disabled:text-text-muted"
            >
              {pending ? "Enregistrement…" : changed ? "Enregistrer la mise en page" : "Mise en page enregistrée"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Revenir à la carte automatique ? Votre fond importé sera supprimé.")) return;
                startTransition(async () => setMessage((await remove()).message ?? null));
              }}
              className="text-[13px] font-semibold text-text-muted hover:text-text hover:underline"
            >
              Revenir à la carte automatique
            </button>
          </div>
        </div>

        <div className="grid gap-2 rounded-lg bg-background p-5 shadow-sm">
          <p className="font-heading text-[15px] font-semibold">Carte réelle</p>
          <p className="text-[13px] text-text-muted">Telle que vos invités la recevront (mise en page enregistrée).</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- image générée à la demande */}
          <img key={version} src={`${preview}${preview.includes("?") ? "&" : "?"}v=${version}`} alt="Aperçu de la carte réelle" width={1080} height={1350} className="h-auto w-40 rounded-md shadow" />
        </div>
        {children}
      </aside>
    </div>
  );
}
