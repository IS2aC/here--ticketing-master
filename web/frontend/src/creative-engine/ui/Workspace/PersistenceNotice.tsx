import { useEditorStore } from "../../editor/editorStore.ts";
import {
  dismissOpenError,
  newDocument,
  reloadSavedVersion,
  retrySave,
  saveAsCopy,
  usePersistenceStore,
} from "../../editor/persistence.ts";
import styles from "./Workspace.module.css";

/**
 * Messages de la persistance au-dessus de la page, avec l'action utile : réessayer, résoudre un conflit, ouvrir
 * un autre document. Les modifications restent à l'écran tant que l'utilisateur n'a pas choisi.
 */
export function PersistenceNotice() {
  const status = usePersistenceStore((s) => s.status);
  const saveError = usePersistenceStore((s) => s.saveError);
  const openError = usePersistenceStore((s) => s.openError);
  const isDocumentsOpen = useEditorStore((s) => s.isDocumentsOpen);
  const notice = useEditorStore((s) => s.notice);
  const setNotice = useEditorStore((s) => s.setNotice);

  if (status === "conflict") {
    return (
      <div className={styles.notice} data-tone="error" role="alert">
        <p>{saveError?.message} Vos modifications sont conservées à l'écran : choisissez quoi en faire.</p>
        <div className={styles.noticeActions}>
          <button type="button" onClick={() => void saveAsCopy()}>
            Enregistrer une copie
          </button>
          <button type="button" onClick={() => void reloadSavedVersion()}>
            Recharger la version enregistrée
          </button>
        </div>
      </div>
    );
  }

  // La liste des documents affiche elle-même pourquoi un document ne s'ouvre pas.
  if (openError && !isDocumentsOpen) {
    return (
      <div className={styles.notice} data-tone="error" role="alert">
        <p>{openError.message}</p>
        <div className={styles.noticeActions}>
          <button
            type="button"
            onClick={() => {
              dismissOpenError();
              useEditorStore.getState().setDocumentsOpen(true);
            }}
          >
            Mes documents
          </button>
          <button
            type="button"
            onClick={() => {
              dismissOpenError();
              void newDocument({ discardChanges: true });
            }}
          >
            Nouveau document
          </button>
          <button type="button" onClick={dismissOpenError}>
            Fermer
          </button>
        </div>
      </div>
    );
  }

  if (status === "error" && saveError) {
    return (
      <div className={styles.notice} data-tone="error" role="alert">
        <p>{saveError.message} Vos modifications restent à l'écran.</p>
        <div className={styles.noticeActions}>
          <button type="button" onClick={() => void retrySave()}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (notice) {
    return (
      <div
        className={styles.notice}
        data-tone={notice.tone}
        role={notice.tone === "error" ? "alert" : "status"}
      >
        <p>{notice.message}</p>
        <div className={styles.noticeActions}>
          <button
            type="button"
            onClick={() => {
              setNotice(null);
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }
  return null;
}
