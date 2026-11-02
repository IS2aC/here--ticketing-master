import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../editor/editorStore.ts";
import { createFromTemplate } from "../../editor/library.ts";
import type { TemplateSummary } from "../../library/contracts.ts";
import { templateMeta } from "../../library/labels.ts";
import { ActionButton } from "../primitives/ActionButton.tsx";
import { Thumbnail } from "./Thumbnail.tsx";
import styles from "./Library.module.css";

type UseState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "error"; message: string }
  | { status: "blocked"; message: string };

/** Aperçu d'un modèle (vignette agrandie, sans charger le document) et création d'un document. */
export function TemplatePreviewDialog({
  template,
  onClose,
}: {
  template: TemplateSummary | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [use, setUse] = useState<UseState>({ status: "idle" });
  const setNotice = useEditorStore((s) => s.setNotice);
  const setLibraryPanel = useEditorStore((s) => s.setLibraryPanel);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (template && !dialog.open) dialog.showModal();
    else if (!template && dialog.open) dialog.close();
  }, [template]);

  const close = () => {
    setUse({ status: "idle" });
    onClose();
  };

  const create = async (discardChanges = false) => {
    if (!template) return;
    setUse({ status: "creating" });
    const result = await createFromTemplate(template.id, { discardChanges });
    if (!result.ok) {
      setUse({ status: result.blockedByUnsavedChanges ? "blocked" : "error", message: result.error.message });
      return;
    }
    close();
    setLibraryPanel(null);
    if (result.missingAssets > 0) {
      setNotice({
        tone: "error",
        message:
          result.missingAssets === 1
            ? "Une image du modèle est introuvable : elle apparaît comme manquante. Remplacez-la ou supprimez-la."
            : `${result.missingAssets} images du modèle sont introuvables : elles apparaissent comme manquantes.`,
      });
    } else if (result.saved) {
      setNotice({ tone: "info", message: `Nouveau document créé à partir du modèle « ${template.name} ».` });
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.preview}
      aria-labelledby="template-preview-title"
      onClose={close}
    >
      {template && (
        <>
          <header className={styles.previewHeader}>
            <div>
              <h2 id="template-preview-title" className={styles.previewTitle}>
                {template.name}
              </h2>
              <p className={styles.previewMeta}>
                {templateMeta(template)} · {template.page.width} × {template.page.height} px
              </p>
            </div>
            <ActionButton label="Fermer l'aperçu" icon="close" onClick={close} />
          </header>
          <div className={styles.previewBody}>
            <div className={styles.previewImage}>
              <Thumbnail
                url={template.thumbnailUrl}
                width={template.page.width}
                height={template.page.height}
                alt={`Aperçu du modèle « ${template.name} »`}
                eager
              />
            </div>
            <div className={styles.previewSide}>
              <p>{template.description}</p>
              <p className={styles.previewNote}>
                Le modèle reste intact : vous travaillez sur une copie, enregistrée comme un nouveau document.
              </p>
              {use.status === "error" && (
                <p className={styles.inlineError} role="alert">
                  {use.message}
                </p>
              )}
              {use.status === "blocked" && (
                <div className={styles.warning} role="alert">
                  <p>{use.message}</p>
                  <button type="button" className={styles.textButton} onClick={() => void create(true)}>
                    Abandonner mes modifications et utiliser ce modèle
                  </button>
                </div>
              )}
              <div className={styles.previewActions}>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={use.status === "creating"}
                  onClick={() => void create()}
                >
                  {use.status === "creating" ? "Création du document…" : "Utiliser ce modèle"}
                </button>
                <button type="button" className={styles.secondary} onClick={close}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </dialog>
  );
}
