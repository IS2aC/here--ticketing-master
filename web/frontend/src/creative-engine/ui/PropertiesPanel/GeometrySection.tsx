import { LIMITS } from "../../domain/constraints.ts";
import type { Element } from "../../domain/elements/types.ts";
import { setGeometry } from "../../editor/actions.ts";
import { NumberField } from "../primitives/NumberField.tsx";
import styles from "./PropertiesPanel.module.css";

const COORDINATE = LIMITS.coordinate;

/** Position, taille et rotation d'un élément seul, modifiables au clavier (validées à la confirmation). */
export function GeometrySection({ element }: { element: Element }) {
  const isText = element.type === "text";
  const isLine = element.type === "shape" && element.shape === "line";
  const locked = element.locked;

  return (
    <section aria-labelledby="properties-geometry-title" className={styles.section}>
      <h3 id="properties-geometry-title" className={styles.sectionTitle}>
        Position et taille
      </h3>
      <div className={styles.fields}>
        <NumberField
          label="X"
          unit="px"
          value={element.x}
          min={COORDINATE.min}
          max={COORDINATE.max}
          disabled={locked}
          testId="geometry-x"
          onCommit={(value) => setGeometry(element.id, "x", value)}
        />
        <NumberField
          label="Y"
          unit="px"
          value={element.y}
          min={COORDINATE.min}
          max={COORDINATE.max}
          disabled={locked}
          testId="geometry-y"
          onCommit={(value) => setGeometry(element.id, "y", value)}
        />
        <NumberField
          label={isLine ? "Longueur" : "Largeur"}
          unit="px"
          value={element.width}
          min={1}
          max={LIMITS.elementSize.max}
          disabled={locked}
          testId="geometry-largeur"
          onCommit={(value) => setGeometry(element.id, "width", value)}
        />
        {!isLine && (
          <NumberField
            label="Hauteur"
            unit="px"
            value={element.height}
            min={1}
            max={LIMITS.elementSize.max}
            disabled={locked || isText}
            testId="geometry-hauteur"
            onCommit={(value) => setGeometry(element.id, "height", value)}
          />
        )}
        <NumberField
          label="Rotation"
          unit="°"
          value={element.rotation}
          disabled={locked}
          testId="geometry-rotation"
          onCommit={(value) => setGeometry(element.id, "rotation", value)}
        />
      </div>
      {isText && !locked && <p className={styles.help}>La hauteur d'un texte suit son contenu.</p>}
      {locked && <p className={styles.help}>Élément verrouillé : déverrouillez-le pour le déplacer.</p>}
    </section>
  );
}
