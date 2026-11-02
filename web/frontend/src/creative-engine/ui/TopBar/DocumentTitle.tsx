import { useState, type KeyboardEvent } from "react";
import { LIMITS } from "../../domain/constraints.ts";
import { renameDocument } from "../../editor/actions.ts";
import { useDocumentStore } from "../../editor/documentStore.ts";
import styles from "./TopBar.module.css";

const UNTITLED = "Document sans titre";

/** Titre du document, modifiable sur place (Entrée ou perte du focus pour valider, Échap pour annuler). */
export function DocumentTitle() {
  const title = useDocumentStore((s) => s.history.present.meta.title);
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    renameDocument(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setDraft(null);
    }
  };

  if (draft !== null) {
    return (
      <input
        className={styles.titleInput}
        value={draft}
        maxLength={LIMITS.title.maxLength}
        aria-label="Titre du document"
        placeholder={UNTITLED}
        // L'utilisateur vient de demander à renommer : le champ prend le focus.
        autoFocus
        onFocus={(event) => {
          event.target.select();
        }}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    );
  }

  return (
    <h1 className={styles.title}>
      <button
        type="button"
        className={styles.titleButton}
        title="Renommer le document"
        onClick={() => {
          setDraft(title);
        }}
      >
        {title || UNTITLED}
        <span className="visually-hidden"> — renommer</span>
      </button>
    </h1>
  );
}
