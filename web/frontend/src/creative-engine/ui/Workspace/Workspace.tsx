import { useEffect, useRef } from "react";
import { useDocumentStore } from "../../editor/documentStore.ts";
import { useEditorStore } from "../../editor/editorStore.ts";
import { usePersistenceStore } from "../../editor/persistence.ts";
import { fitToScreen } from "../../editor/viewportActions.ts";
import { CanvasStage } from "../../rendering/konva/CanvasStage.tsx";
import { TextEditorOverlay } from "../../rendering/konva/TextEditorOverlay.tsx";
import { useElementSize } from "../hooks/useElementSize.ts";
import { PersistenceNotice } from "./PersistenceNotice.tsx";
import { ZoomControls } from "./ZoomControls.tsx";
import styles from "./Workspace.module.css";

// Zone de travail : mesure l'espace disponible, garde la vue ajustée tant que l'utilisateur ne l'a pas
// changée, et accueille la scène Konva.
export function Workspace() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(viewportRef);
  const page = useDocumentStore((s) => s.history.present.page);
  const followFit = useEditorStore((s) => s.fitToScreen);
  const opening = usePersistenceStore((s) => s.opening);

  // La vue suit « Ajuster » tant que l'utilisateur n'a ni zoomé ni déplacé la vue.
  useEffect(() => {
    if (!size) return;
    useEditorStore.getState().setWorkspaceSize(size);
    if (followFit) fitToScreen();
  }, [size, followFit, page.width, page.height]);

  return (
    <main className={styles.workspace} aria-label="Zone de travail">
      <div
        ref={viewportRef}
        className={styles.viewport}
        role="application"
        tabIndex={0}
        aria-roledescription="zone de dessin"
        aria-label={`Page de ${page.width} × ${page.height} px. Sélectionnez un élément avec la souris ou dans la liste des calques ; flèches pour le déplacer, Entrée pour modifier un texte.`}
        data-testid="canvas-viewport"
      >
        {size && <CanvasStage size={size} />}
        <TextEditorOverlay
          onDone={() => {
            viewportRef.current?.focus();
          }}
        />
        <PersistenceNotice />
        {opening && <div className={styles.opening}>Ouverture du document…</div>}
      </div>
      <footer className={styles.status}>
        <span className={styles.dimensions}>
          Page <span className={styles.numeric}>{`${page.width} × ${page.height} px`}</span>
        </span>
        <ZoomControls />
      </footer>
    </main>
  );
}
