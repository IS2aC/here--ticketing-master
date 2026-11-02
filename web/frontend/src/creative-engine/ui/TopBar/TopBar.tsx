import type { ReactNode } from "react";
import { canRedo, canUndo } from "../../domain/history/history.ts";
import { redo, undo } from "../../editor/actions.ts";
import { useDocumentStore } from "../../editor/documentStore.ts";
import { useEditorStore } from "../../editor/editorStore.ts";
import { ActionButton } from "../primitives/ActionButton.tsx";
import { DocumentMenu } from "./DocumentMenu.tsx";
import { DocumentTitle } from "./DocumentTitle.tsx";
import { SaveStatus } from "./SaveStatus.tsx";
import styles from "./TopBar.module.css";

export const PROPERTIES_TOGGLE_ID = "properties-panel-toggle";

/** Annuler / Rétablir, avec le nom de l'action concernée (« Annuler : Déplacer »). */
function HistoryButtons() {
  const undoLabel = useDocumentStore((s) => (canUndo(s.history) ? s.history.past.at(-1)?.label : undefined));
  const redoLabel = useDocumentStore((s) => (canRedo(s.history) ? s.history.future[0]?.label : undefined));

  return (
    <div className={styles.history} role="group" aria-label="Historique">
      <ActionButton
        label={undoLabel ? `Annuler : ${undoLabel}` : "Annuler"}
        icon="undo"
        shortcut={{ label: "Ctrl + Z", aria: "Control+Z" }}
        disabled={!undoLabel}
        onClick={undo}
      />
      <ActionButton
        label={redoLabel ? `Rétablir : ${redoLabel}` : "Rétablir"}
        icon="redo"
        shortcut={{ label: "Ctrl + Maj + Z", aria: "Control+Shift+Z" }}
        disabled={!redoLabel}
        onClick={redo}
      />
    </div>
  );
}

const SYMBOL_URL = "/creative-engine/here-symbole.svg";

interface TopBarProps {
  /** À gauche, à la place de la marque du moteur (l'hôte y met son retour, son titre). */
  leading?: ReactNode;
  /** Dernières actions, à droite d'« Exporter » (l'hôte y met sa validation). */
  trailing?: ReactNode;
  /** Menu Document (nouveau, ouvrir, fichier .here.json) ; l'hôte qui gère un seul document le retire. */
  showDocumentMenu?: boolean;
  /** État « enregistré » : où le document est gardé (par défaut, sur cet appareil). */
  savedLabel?: string;
}

export function TopBar({ leading, trailing, showDocumentMenu = true, savedLabel }: TopBarProps = {}) {
  const isPanelOpen = useEditorStore((s) => s.isPropertiesPanelOpen);
  const togglePanel = useEditorStore((s) => s.togglePropertiesPanel);

  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        {leading ?? (
          <>
            <img src={SYMBOL_URL} alt="" width={32} height={32} className={styles.symbol} />
            <span className={styles.product}>
              <span className="visually-hidden">Here! </span>Creative Engine
            </span>
          </>
        )}
      </div>

      <div className={styles.document}>
        <DocumentTitle />
        <SaveStatus savedLabel={savedLabel} />
      </div>

      <div className={styles.actions}>
        <HistoryButtons />
        {showDocumentMenu && <DocumentMenu buttonClassName={styles.iconOnlyOnPhone} />}
        <ActionButton
          id={PROPERTIES_TOGGLE_ID}
          className={styles.panelToggle}
          label="Propriétés"
          icon="sliders"
          aria-expanded={isPanelOpen}
          aria-controls="properties-panel"
          onClick={togglePanel}
        />
        <ActionButton
          label="Exporter"
          icon="download"
          showLabel
          variant="ghost"
          aria-haspopup="dialog"
          className={styles.iconOnlyOnPhone}
          onClick={() => {
            useEditorStore.getState().setExportOpen(true);
          }}
        />
        {trailing}
      </div>
    </header>
  );
}
