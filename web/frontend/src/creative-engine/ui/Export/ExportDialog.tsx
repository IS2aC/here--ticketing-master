import { useEffect, useRef, useState } from "react";
import { PAGE_PRESETS } from "../../domain/document/presets.ts";
import type { CreativeDocument } from "../../domain/document/types.ts";
import { currentDocument, useDocumentStore } from "../../editor/documentStore.ts";
import { useEditorStore } from "../../editor/editorStore.ts";
import type { ExportError } from "../../export/errors.ts";
import { exportDocument } from "../../export/exportDocument.ts";
import {
  DEFAULT_JPEG_QUALITY,
  EXPORT_SCALES,
  hasBleed,
  planExport,
  type ExportFormat,
  type ExportOptions,
  type ExportScale,
} from "../../export/options.ts";
import { useAssetResolver } from "../../rendering/assetResolverContext.ts";
import { download } from "../download.ts";
import { ActionButton } from "../primitives/ActionButton.tsx";
import { Segmented } from "../primitives/Segmented.tsx";
import fieldStyles from "../primitives/Field.module.css";
import styles from "./ExportDialog.module.css";

const FORMATS: readonly { value: ExportFormat; label: string; hint: string }[] = [
  { value: "png", label: "PNG", hint: "Meilleure qualité, fond transparent possible." },
  { value: "jpeg", label: "JPEG", hint: "Fichier plus léger, pour le partage (WhatsApp, réseaux sociaux)." },
  { value: "pdf", label: "PDF", hint: "Pour imprimer ou envoyer un document." },
];

const MM = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

type Status = { kind: "idle" } | { kind: "exporting" } | { kind: "error"; error: ExportError };

/** Description de la page d'un PDF (format physique, résolution de l'image). */
function pdfDescription(document: CreativeDocument): string {
  const { page } = document;
  if (page.print) {
    const name = page.preset === "custom" ? "Format personnalisé" : PAGE_PRESETS[page.preset].label;
    return `${name} · ${MM.format(page.print.widthMm)} × ${MM.format(page.print.heightMm)} mm · image à ${page.print.dpi} dpi`;
  }
  const mm = (px: number) => MM.format((px * 25.4) / 96);
  return `Page de ${mm(page.width)} × ${mm(page.height)} mm · image à 2× (${page.width * 2} × ${page.height * 2} px)`;
}

/** Export PNG, JPEG ou PDF du document affiché : options, progression, erreur, téléchargement. */
export function ExportDialog() {
  const isOpen = useEditorStore((s) => s.isExportOpen);
  const setOpen = useEditorStore((s) => s.setExportOpen);
  const setNotice = useEditorStore((s) => s.setNotice);
  const document = useDocumentStore((s) => s.history.present);
  const resolveAssetUrl = useAssetResolver();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [format, setFormat] = useState<ExportFormat>("png");
  const [scale, setScale] = useState<ExportScale>(1);
  const [quality, setQuality] = useState(DEFAULT_JPEG_QUALITY);
  const [transparent, setTransparent] = useState(false);
  const [includeBleed, setIncludeBleed] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
      setStatus({ kind: "idle" });
    } else if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const options: ExportOptions = { format, scale, quality, transparentBackground: transparent, includeBleed };
  const plan = planExport(document, options);
  const exporting = status.kind === "exporting";

  const close = () => {
    abortRef.current?.abort();
    setOpen(false);
  };

  const run = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus({ kind: "exporting" });
    // Le document du moment : une modification pendant l'export ne change pas le fichier en cours.
    const result = await exportDocument(currentDocument(), options, {
      resolveAssetUrl,
      signal: controller.signal,
    });
    abortRef.current = null;
    if (!result.ok) {
      setStatus(result.error.code === "aborted" ? { kind: "idle" } : { kind: "error", error: result.error });
      return;
    }
    if (!download(result.value.blob, result.value.fileName)) {
      setStatus({
        kind: "error",
        error: { code: "encode_failed", message: "Le téléchargement n'a pas pu démarrer. Réessayez." },
      });
      return;
    }
    setStatus({ kind: "idle" });
    setOpen(false);
    setNotice({
      tone: "info",
      message: `« ${result.value.fileName} » exporté (${result.value.width} × ${result.value.height} px).`,
    });
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="export-title"
      aria-busy={exporting}
      onClose={close}
    >
      <header className={styles.header}>
        <div>
          <h2 id="export-title" className={styles.title}>
            Exporter
          </h2>
          <p className={styles.subtitle}>
            {document.meta.title || "Document sans titre"} · {document.page.width} × {document.page.height} px
          </p>
        </div>
        <ActionButton label="Fermer" icon="close" onClick={close} />
      </header>

      <div className={styles.body}>
        <fieldset className={styles.group} disabled={exporting}>
          <Segmented
            label="Format"
            value={format}
            options={FORMATS}
            onChange={(value) => {
              setFormat(value);
              setStatus({ kind: "idle" });
            }}
          />
          <p className={styles.hint}>{FORMATS.find((f) => f.value === format)?.hint}</p>

          {format !== "pdf" && (
            <>
              <Segmented
                label="Taille"
                value={String(scale) as `${ExportScale}`}
                options={EXPORT_SCALES.map((s) => ({ value: String(s) as `${ExportScale}`, label: `${s}×` }))}
                onChange={(value) => {
                  setScale(Number(value) as ExportScale);
                }}
              />
              {plan.ok && (
                <p className={styles.hint} data-testid="export-size">
                  {plan.value.output.width} × {plan.value.output.height} px
                </p>
              )}
            </>
          )}

          {format === "png" && (
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={transparent}
                onChange={(event) => {
                  setTransparent(event.target.checked);
                }}
              />
              Fond transparent (sans le fond de la page)
            </label>
          )}

          {format === "jpeg" && (
            <label className={fieldStyles.field}>
              <span className={fieldStyles.label}>Qualité</span>
              <span className={fieldStyles.control}>
                <input
                  type="range"
                  aria-label="Qualité"
                  aria-valuetext={`${Math.round(quality * 100)} %`}
                  className={fieldStyles.range}
                  min={50}
                  max={100}
                  step={5}
                  value={Math.round(quality * 100)}
                  onChange={(event) => {
                    setQuality(Number(event.target.value) / 100);
                  }}
                />
                <output className={fieldStyles.output}>{Math.round(quality * 100)} %</output>
              </span>
            </label>
          )}

          {format === "pdf" && (
            <>
              <p className={styles.hint}>{pdfDescription(document)}</p>
              {hasBleed(document) && (
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={includeBleed}
                    onChange={(event) => {
                      setIncludeBleed(event.target.checked);
                    }}
                  />
                  Ajouter le fond perdu ({MM.format(document.page.print?.bleedMm ?? 0)} mm de chaque côté)
                </label>
              )}
              <p className={styles.note}>
                Le PDF contient une image du document : le texte n'y est pas sélectionnable.
              </p>
            </>
          )}
        </fieldset>

        {!plan.ok && (
          <p className={styles.error} role="alert">
            {plan.error.message}
          </p>
        )}
        {status.kind === "error" && (
          <div className={styles.error} role="alert">
            <p>{status.error.message}</p>
            {status.error.details && (
              <ul>
                {status.error.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <footer className={styles.footer}>
        <button type="button" className={styles.secondary} onClick={close}>
          Annuler
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={!plan.ok || exporting}
          onClick={() => void run()}
        >
          {exporting
            ? "Export en cours…"
            : `Exporter en ${FORMATS.find((f) => f.value === format)?.label ?? ""}`}
        </button>
      </footer>
    </dialog>
  );
}
