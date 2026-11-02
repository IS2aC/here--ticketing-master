import { useRef, type KeyboardEvent } from "react";
import { addText } from "../../editor/actions.ts";
import { useEditorStore, type LibraryPanel } from "../../editor/editorStore.ts";
import { useImageImport } from "../Library/useImageImport.ts";
import { ActionButton } from "../primitives/ActionButton.tsx";
import { ShapeMenu } from "./ShapeMenu.tsx";
import styles from "./ToolRail.module.css";

const NEXT_KEYS = new Set(["ArrowDown", "ArrowRight"]);
const PREVIOUS_KEYS = new Set(["ArrowUp", "ArrowLeft"]);

// Barre d'outils au sens ARIA : un seul arrêt de tabulation, flèches pour passer d'un outil à l'autre.
// Sélection : seul mode d'interaction (indicateur). Texte et Formes ajoutent un élément au document ; Image
// importe une image de l'appareil ; Modèles et Ressources ouvrent le panneau de bibliothèque.
export function ToolRail() {
  const railRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const libraryPanel = useEditorStore((s) => s.libraryPanel);
  const setLibraryPanel = useEditorStore((s) => s.setLibraryPanel);
  const { importing, importFiles } = useImageImport();
  const toggle = (panel: LibraryPanel) => {
    setLibraryPanel(libraryPanel === panel ? null : panel);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(
      railRef.current?.querySelectorAll<HTMLButtonElement>(":scope > span > button") ?? [],
    );
    const current = buttons.findIndex((button) => button === document.activeElement);
    if (current === -1) return;

    let next: number;
    if (NEXT_KEYS.has(event.key)) next = (current + 1) % buttons.length;
    else if (PREVIOUS_KEYS.has(event.key)) next = (current - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else return;

    event.preventDefault();
    buttons.forEach((button, index) => {
      button.tabIndex = index === next ? 0 : -1;
    });
    buttons[next]?.focus();
  };

  return (
    <div
      ref={railRef}
      role="toolbar"
      aria-label="Outils"
      aria-orientation="vertical"
      className={styles.rail}
      onKeyDown={onKeyDown}
    >
      <ActionButton
        label="Sélection"
        icon="select"
        aria-pressed
        tooltipSide="right"
        className={styles.tool}
        tabIndex={0}
      />
      <ActionButton
        label="Ajouter un texte"
        icon="text"
        tooltipSide="right"
        className={styles.tool}
        shortcut={{ label: "T", aria: "T" }}
        tabIndex={-1}
        onClick={() => {
          addText();
        }}
      />
      <ShapeMenu buttonClassName={styles.tool} />
      <ActionButton
        label={importing ? "Import de l'image en cours…" : "Importer une image"}
        icon="image"
        tooltipSide="right"
        className={styles.tool}
        tabIndex={-1}
        aria-busy={importing || undefined}
        onClick={() => fileRef.current?.click()}
      />
      <ActionButton
        label="Ressources"
        icon="library"
        tooltipSide="right"
        className={styles.tool}
        tabIndex={-1}
        aria-expanded={libraryPanel === "assets"}
        onClick={() => {
          toggle("assets");
        }}
      />
      <ActionButton
        label="Générer une image"
        icon="sparkles"
        tooltipSide="right"
        className={styles.tool}
        tabIndex={-1}
        aria-expanded={libraryPanel === "generate"}
        onClick={() => {
          toggle("generate");
        }}
      />
      <ActionButton
        label="Modèles"
        icon="template"
        tooltipSide="right"
        className={styles.tool}
        tabIndex={-1}
        aria-expanded={libraryPanel === "templates"}
        onClick={() => {
          toggle("templates");
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        data-testid="toolrail-image-input"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void importFiles(files);
        }}
      />
    </div>
  );
}
