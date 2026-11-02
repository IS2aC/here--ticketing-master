import { useHasUnsavedChanges, usePersistenceStore } from "../../editor/persistence.ts";
import styles from "./TopBar.module.css";

/**
 * État de sauvegarde, toujours visible. « Enregistré » n'apparaît qu'après confirmation du stockage, et
 * précise où : sur cet appareil (ADR-007), pour ne pas laisser croire à une sauvegarde en ligne. L'hôte qui
 * enregistre sur son serveur donne son propre libellé (`savedLabel`).
 */
export function SaveStatus({ savedLabel = "Enregistré sur cet appareil" }: { savedLabel?: string }) {
  const status = usePersistenceStore((s) => s.status);
  const opening = usePersistenceStore((s) => s.opening);
  const unsaved = useHasUnsavedChanges();

  let label: string;
  let tone: "neutral" | "busy" | "ok" | "warning" | "error";
  if (opening) [label, tone] = ["Ouverture…", "busy"];
  else if (status === "saving") [label, tone] = ["Enregistrement…", "busy"];
  else if (status === "conflict") [label, tone] = ["Conflit d'enregistrement", "error"];
  else if (status === "error") [label, tone] = ["Échec de l'enregistrement", "error"];
  else if (status === "saved" && !unsaved) [label, tone] = [savedLabel, "ok"];
  else if (status === "saved") [label, tone] = ["Modifications non enregistrées", "warning"];
  else [label, tone] = ["Non enregistré", "neutral"];

  return (
    <span role="status" className={styles.status} data-tone={tone} data-testid="save-status" title={label}>
      <span>{label}</span>
    </span>
  );
}
