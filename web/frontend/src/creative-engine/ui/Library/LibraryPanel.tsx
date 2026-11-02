import { useEditorStore } from "../../editor/editorStore.ts";
import { ActionButton } from "../primitives/ActionButton.tsx";
import { AssetsBrowser } from "./AssetsBrowser.tsx";
import { GenerateBrowser } from "./GenerateBrowser.tsx";
import { TemplatesBrowser } from "./TemplatesBrowser.tsx";
import styles from "./Library.module.css";

const TITLES = { templates: "Modèles", assets: "Ressources", generate: "Image par IA" } as const;

/** Panneau de bibliothèque, à côté de la barre d'outils (en feuille depuis le bas sur téléphone). */
export function LibraryPanel() {
  const panel = useEditorStore((s) => s.libraryPanel);
  const setPanel = useEditorStore((s) => s.setLibraryPanel);
  if (!panel) return null;

  return (
    <section
      className={styles.panel}
      aria-labelledby="library-title"
      onKeyDown={(event) => {
        // Échap ferme le panneau, sauf s'il vient d'une boîte de dialogue (elle se ferme seule).
        if (event.key === "Escape" && !(event.target as Element).closest("dialog")) setPanel(null);
      }}
    >
      <header className={styles.panelHeader}>
        <h2 id="library-title" className={styles.panelTitle}>
          {TITLES[panel]}
        </h2>
        <ActionButton
          label={`Fermer le panneau « ${TITLES[panel]} »`}
          icon="close"
          onClick={() => {
            setPanel(null);
          }}
        />
      </header>
      {panel === "templates" && <TemplatesBrowser />}
      {panel === "assets" && <AssetsBrowser />}
      {panel === "generate" && <GenerateBrowser />}
    </section>
  );
}
