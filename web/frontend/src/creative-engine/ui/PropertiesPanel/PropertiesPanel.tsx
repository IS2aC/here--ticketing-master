import { useEffect, useRef } from "react";
import { useDocumentStore } from "../../editor/documentStore.ts";
import { useEditorStore } from "../../editor/editorStore.ts";
import { PROPERTIES_TOGGLE_ID } from "../TopBar/TopBar.tsx";
import { ActionButton } from "../primitives/ActionButton.tsx";
import { LayersList } from "./LayersList.tsx";
import { SelectionSection } from "./SelectionSection.tsx";
import { formatNumber, pageFormatLabel } from "./labels.ts";
import styles from "./PropertiesPanel.module.css";

/** Le focus revient au bouton qui a ouvert le tiroir. */
function focusPanelToggle() {
  document.getElementById(PROPERTIES_TOGGLE_ID)?.focus();
}

// Panneau de propriétés : permanent sur grand écran, tiroir sur écran étroit (voir App.module.css).
export function PropertiesPanel() {
  const isOpen = useEditorStore((s) => s.isPropertiesPanelOpen);
  const close = useEditorStore((s) => s.closePropertiesPanel);
  const page = useDocumentStore((s) => s.history.present.page);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    headingRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Échap ferme d'abord le tiroir ; les raccourcis de l'éditeur ignorent l'événement déjà traité.
      event.preventDefault();
      close();
      focusPanelToggle();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, close]);

  const closeAndRestoreFocus = () => {
    close();
    focusPanelToggle();
  };

  return (
    <aside
      id="properties-panel"
      aria-labelledby="properties-panel-title"
      className={styles.panel}
      data-open={isOpen}
    >
      <div className={styles.header}>
        <h2 id="properties-panel-title" ref={headingRef} tabIndex={-1} className={styles.heading}>
          Propriétés
        </h2>
        <ActionButton
          label="Fermer le panneau"
          icon="close"
          className={styles.close}
          onClick={closeAndRestoreFocus}
        />
      </div>

      <SelectionSection />

      <section aria-labelledby="properties-page-title" className={styles.section}>
        <h3 id="properties-page-title" className={styles.sectionTitle}>
          Page
        </h3>
        <dl className={styles.list}>
          <div className={styles.row}>
            <dt>Format</dt>
            <dd>{pageFormatLabel(page)}</dd>
          </div>
          <div className={styles.row}>
            <dt>Dimensions</dt>
            <dd className={styles.numeric}>
              {formatNumber(page.width)} × {formatNumber(page.height)} px
            </dd>
          </div>
        </dl>
      </section>

      <LayersList />
    </aside>
  );
}
