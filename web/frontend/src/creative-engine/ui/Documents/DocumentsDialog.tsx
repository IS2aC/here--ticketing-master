import { useEffect, useRef, useState } from "react";
import type { Id } from "../../domain/ids.ts";
import { useEditorStore } from "../../editor/editorStore.ts";
import {
  listDocuments,
  openDocument,
  openMostRecentOrNew,
  removeDocument,
  usePersistenceStore,
} from "../../editor/persistence.ts";
import type { DocumentSummary, RepositoryError } from "../../persistence/repository.ts";
import { ActionButton } from "../primitives/ActionButton.tsx";
import styles from "./DocumentsDialog.module.css";

const DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

type ListState =
  | { status: "loading" }
  | { status: "error"; error: RepositoryError }
  | { status: "ready"; documents: readonly DocumentSummary[] };

/** Documents enregistrés sur cet appareil : ouvrir, supprimer (avec confirmation). */
export function DocumentsDialog() {
  const isOpen = useEditorStore((s) => s.isDocumentsOpen);
  const setOpen = useEditorStore((s) => s.setDocumentsOpen);
  const currentId = usePersistenceStore((s) => s.documentId);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [confirming, setConfirming] = useState<Id | null>(null);
  const [blocked, setBlocked] = useState<{ id: Id; message: string } | null>(null);

  const refresh = async () => {
    setList({ status: "loading" });
    const result = await listDocuments();
    setList(
      result.ok ? { status: "ready", documents: result.value } : { status: "error", error: result.error },
    );
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
      setConfirming(null);
      setBlocked(null);
      void refresh();
    } else if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const open = async (id: Id, discardChanges = false) => {
    if (await openDocument(id, { discardChanges })) {
      setOpen(false);
      return;
    }
    const error = usePersistenceStore.getState().openError;
    if (error) setBlocked({ id, message: error.message });
  };

  const remove = async (id: Id) => {
    setConfirming(null);
    const result = await removeDocument(id);
    if (!result.ok) {
      setList({ status: "error", error: result.error });
      return;
    }
    if (id === currentId) await openMostRecentOrNew();
    await refresh();
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="documents-title"
      onClose={() => {
        setOpen(false);
      }}
    >
      <header className={styles.header}>
        <div>
          <h2 id="documents-title" className={styles.title}>
            Mes documents
          </h2>
          <p className={styles.subtitle}>Enregistrés sur cet appareil, dans ce navigateur.</p>
        </div>
        <ActionButton
          label="Fermer"
          icon="close"
          onClick={() => {
            setOpen(false);
          }}
        />
      </header>

      {blocked && (
        <div className={styles.warning} role="alert">
          <p>{blocked.message}</p>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => {
              void open(blocked.id, true);
            }}
          >
            Abandonner mes modifications et ouvrir
          </button>
        </div>
      )}

      {list.status === "loading" && <p className={styles.state}>Chargement…</p>}
      {list.status === "error" && (
        <div className={styles.state} role="alert">
          <p>{list.error.message}</p>
          <button type="button" className={styles.textButton} onClick={() => void refresh()}>
            Réessayer
          </button>
        </div>
      )}
      {list.status === "ready" && list.documents.length === 0 && (
        <p className={styles.state}>Aucun document enregistré pour l'instant.</p>
      )}
      {list.status === "ready" && list.documents.length > 0 && (
        <ul className={styles.list}>
          {list.documents.map((doc) => (
            <li key={doc.id} className={styles.item} aria-current={doc.id === currentId || undefined}>
              <div className={styles.info}>
                <span className={styles.name}>{doc.title || "Document sans titre"}</span>
                <span className={styles.meta}>
                  {DATE.format(new Date(doc.savedAt))} · {doc.page.width} × {doc.page.height} px
                  {doc.id === currentId && <span className={styles.current}> · Ouvert</span>}
                </span>
              </div>
              {confirming === doc.id ? (
                <div className={styles.confirm} role="group" aria-label={`Supprimer « ${doc.title} »`}>
                  <span>Supprimer définitivement ?</span>
                  <button type="button" className={styles.danger} onClick={() => void remove(doc.id)}>
                    Supprimer
                  </button>
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => {
                      setConfirming(null);
                    }}
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.open}
                    disabled={doc.id === currentId}
                    aria-label={`Ouvrir « ${doc.title || "Document sans titre"} »`}
                    onClick={() => void open(doc.id)}
                  >
                    Ouvrir
                  </button>
                  <ActionButton
                    label={`Supprimer « ${doc.title || "Document sans titre"} »`}
                    icon="trash"
                    tooltipSide="top"
                    onClick={() => {
                      setConfirming(doc.id);
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </dialog>
  );
}
