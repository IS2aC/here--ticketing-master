import type { TextElement } from "../../domain/elements/types.ts";
import { updateTextStyle } from "../../editor/actions.ts";
import { backgroundBehind, contrastRatio, readableColor, targetContrast } from "../../editor/colors.ts";
import { useDocumentStore } from "../../editor/documentStore.ts";
import styles from "./PropertiesPanel.module.css";

/** Lisibilité d'un texte sur ce qui est derrière lui (contraste WCAG), et correction en un clic. */
export function LegibilityHint({ element }: { element: TextElement }) {
  const background = useDocumentStore((s) => backgroundBehind(s.history.present, element));
  if (element.style.gradient) return null;
  if (background === null)
    return <p className={styles.help}>Texte sur une image : vérifiez sa lisibilité sur l'aperçu.</p>;

  const ratio = contrastRatio(element.style.color, background);
  const target = targetContrast(element);
  const value = ratio.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  if (ratio >= target)
    return (
      <p className={styles.help}>
        Lisibilité : {value}:1, <strong>bonne</strong>.
      </p>
    );
  return (
    <div className={styles.legibility} role="status">
      <p>
        Lisibilité : {value}:1, <strong>insuffisante</strong> sur ce fond (il faut {target}:1).
      </p>
      <button
        type="button"
        className={styles.textButton}
        onClick={() => {
          void updateTextStyle([element.id], { color: readableColor(element.style.color, background, target) }, "Rendre lisible");
        }}
      >
        Rendre lisible
      </button>
    </div>
  );
}
