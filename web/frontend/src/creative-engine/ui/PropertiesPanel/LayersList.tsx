import { selectElement, toggleInSelection } from "../../editor/actions.ts";
import { useDocumentStore } from "../../editor/documentStore.ts";
import { useEditorStore } from "../../editor/editorStore.ts";
import { Icon } from "../icons/Icon.tsx";
import { elementIcon, elementLabel } from "./labels.ts";
import styles from "./PropertiesPanel.module.css";

/**
 * Calques du premier plan à l'arrière-plan. Alternative au canevas : sélection au clavier et lecteurs d'écran.
 * Maj, Ctrl ou ⌘ + clic (ou Entrée) ajoute le calque à la sélection ou l'en retire.
 */
export function LayersList() {
  const elements = useDocumentStore((s) => s.history.present.elements);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const topFirst = elements.toReversed();

  return (
    <section aria-labelledby="properties-layers-title" className={styles.section}>
      <h3 id="properties-layers-title" className={styles.sectionTitle}>
        Calques <span className={styles.count}>{elements.length}</span>
      </h3>
      {topFirst.length === 0 ? (
        <p className={styles.help}>
          La page est vide. Ajoutez un texte ou une forme depuis la barre d'outils.
        </p>
      ) : (
        <ul className={styles.layers}>
          {topFirst.map((element) => (
            <li key={element.id}>
              <button
                type="button"
                className={styles.layer}
                aria-pressed={selectedIds.includes(element.id)}
                onClick={(event) => {
                  if (event.shiftKey || event.ctrlKey || event.metaKey) toggleInSelection(element.id);
                  else selectElement(element.id);
                }}
              >
                <Icon name={elementIcon(element)} size={18} />
                <span className={styles.layerName}>{elementLabel(element)}</span>
                {element.locked && (
                  <span className={styles.layerFlag} title="Verrouillé">
                    <Icon name="lock" size={16} />
                    <span className="visually-hidden">(verrouillé)</span>
                  </span>
                )}
                {element.hidden && <span className={styles.layerFlag}>masqué</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
