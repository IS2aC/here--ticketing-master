import { useEffect, useId, useRef } from "react";
import type { Element } from "../../domain/elements/types.ts";
import { cancelLiveEdit, commitLiveEdit, previewElements, updateElements } from "../../editor/actions.ts";
import { Toggle } from "../primitives/Segmented.tsx";
import fieldStyles from "../primitives/Field.module.css";
import { orNull, shared } from "./selection.ts";
import styles from "./PropertiesPanel.module.css";

/** Opacité (aperçu en direct, une entrée d'historique au relâchement), visibilité et verrouillage. */
export function AppearanceSection({ elements }: { elements: readonly Element[] }) {
  const id = useId();
  const rangeRef = useRef<HTMLInputElement>(null);
  const ids = elements.map((e) => e.id);
  const opacity = orNull(shared(elements, (e) => e.opacity));
  const hidden = orNull(shared(elements, (e) => e.hidden));
  const locked = orNull(shared(elements, (e) => e.locked));

  // Relâchement du curseur (souris, doigt ou touche) : l'événement natif change valide l'aperçu.
  useEffect(() => {
    const range = rangeRef.current;
    if (!range) return;
    const onChange = () => {
      commitLiveEdit();
    };
    range.addEventListener("change", onChange);
    return () => {
      range.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <section aria-labelledby="properties-appearance-title" className={styles.section}>
      <h3 id="properties-appearance-title" className={styles.sectionTitle}>
        Apparence
      </h3>
      <div className={fieldStyles.field}>
        <label htmlFor={id} className={fieldStyles.label}>
          Opacité
        </label>
        <div className={fieldStyles.control}>
          <input
            ref={rangeRef}
            id={id}
            type="range"
            className={fieldStyles.range}
            min={0}
            max={100}
            step={1}
            value={Math.round((opacity ?? 1) * 100)}
            aria-valuetext={opacity === null ? "Mixte" : `${Math.round(opacity * 100)} %`}
            onChange={(event) => {
              previewElements(ids, { opacity: Number(event.target.value) / 100 }, "Modifier l'opacité");
            }}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              cancelLiveEdit();
            }}
          />
          <output htmlFor={id} className={fieldStyles.output}>
            {opacity === null ? "Mixte" : `${Math.round(opacity * 100)} %`}
          </output>
        </div>
      </div>
      <div className={styles.toggles}>
        <Toggle
          label="Masquer"
          pressed={hidden}
          onChange={(pressed) => {
            updateElements(ids, { hidden: pressed }, pressed ? "Masquer" : "Afficher");
          }}
        />
        <Toggle
          label="Verrouiller"
          pressed={locked}
          onChange={(pressed) => {
            updateElements(ids, { locked: pressed }, pressed ? "Verrouiller" : "Déverrouiller");
          }}
        />
      </div>
    </section>
  );
}
