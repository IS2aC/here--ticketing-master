import { useEditorStore } from "../../editor/editorStore.ts";
import { ZOOM_LIMITS, formatZoom } from "../../editor/viewport.ts";
import { fitToScreen, zoomStep, zoomToActualSize } from "../../editor/viewportActions.ts";
import { ActionButton } from "../primitives/ActionButton.tsx";
import styles from "./Workspace.module.css";

export function ZoomControls() {
  const zoom = useEditorStore((s) => s.viewport?.zoom);
  const isFit = useEditorStore((s) => s.fitToScreen);
  if (zoom === undefined) return null;

  return (
    <div role="group" aria-label="Zoom" className={styles.zoom}>
      <ActionButton
        label="Zoom arrière"
        shortcut={{ label: "Ctrl + −", aria: "Control+-" }}
        icon="minus"
        tooltipSide="top"
        className={styles.zoomButton}
        disabled={zoom <= ZOOM_LIMITS.min}
        onClick={() => {
          zoomStep(-1);
        }}
      />
      <output className={styles.zoomValue} aria-live="polite" aria-label="Niveau de zoom">
        {formatZoom(zoom)}
      </output>
      <ActionButton
        label="Zoom avant"
        shortcut={{ label: "Ctrl + +", aria: "Control+=" }}
        icon="plus"
        tooltipSide="top"
        className={styles.zoomButton}
        disabled={zoom >= ZOOM_LIMITS.max}
        onClick={() => {
          zoomStep(1);
        }}
      />
      <ActionButton
        label="Ajuster à l'écran"
        shortcut={{ label: "Ctrl + 0", aria: "Control+0" }}
        icon="fit"
        tooltipSide="top"
        className={styles.zoomButton}
        aria-pressed={isFit}
        onClick={() => {
          fitToScreen();
        }}
      />
      <ActionButton
        label="Taille réelle (100 %)"
        shortcut={{ label: "Ctrl + 1", aria: "Control+1" }}
        icon="actualSize"
        tooltipSide="top"
        className={styles.zoomButton}
        onClick={() => {
          zoomToActualSize();
        }}
      />
    </div>
  );
}
