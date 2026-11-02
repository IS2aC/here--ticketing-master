import type { Element } from "../../domain/elements/types.ts";
import { alignSelection, distributeSelection } from "../../editor/actions.ts";
import type { Alignment } from "../../editor/layoutAids.ts";
import { ActionButton } from "../primitives/ActionButton.tsx";
import styles from "./PropertiesPanel.module.css";

// Disposition (étape C3) : aligner la sélection (sur la page pour un élément seul) et la répartir.

const ALIGNMENTS: { value: Alignment; label: string; icon: Parameters<typeof ActionButton>[0]["icon"] }[] = [
  { value: "left", label: "Aligner à gauche", icon: "alignLeft" },
  { value: "center", label: "Centrer horizontalement", icon: "alignCenter" },
  { value: "right", label: "Aligner à droite", icon: "alignRight" },
  { value: "top", label: "Aligner en haut", icon: "alignTop" },
  { value: "middle", label: "Centrer verticalement", icon: "alignMiddle" },
  { value: "bottom", label: "Aligner en bas", icon: "alignBottom" },
];

export function LayoutSection({ elements }: { elements: readonly Element[] }) {
  const movable = elements.filter((e) => !e.locked);
  if (movable.length === 0) return null;
  const onPage = movable.length === 1;
  return (
    <section aria-labelledby="properties-layout-title" className={styles.section}>
      <h3 id="properties-layout-title" className={styles.sectionTitle}>
        Disposition
      </h3>
      <div className={styles.align} role="group" aria-label={onPage ? "Aligner sur la page" : "Aligner les éléments"}>
        {ALIGNMENTS.map(({ value, label, icon }) => (
          <ActionButton
            key={value}
            label={onPage ? `${label} sur la page` : label}
            icon={icon}
            tooltipSide="top"
            onClick={() => {
              alignSelection(value);
            }}
          />
        ))}
      </div>
      {movable.length >= 3 && (
        <div className={styles.order} role="group" aria-label="Répartir">
          <ActionButton
            label="Répartir horizontalement"
            icon="distributeHorizontal"
            tooltipSide="top"
            onClick={() => {
              distributeSelection("horizontal");
            }}
          />
          <ActionButton
            label="Répartir verticalement"
            icon="distributeVertical"
            tooltipSide="top"
            onClick={() => {
              distributeSelection("vertical");
            }}
          />
        </div>
      )}
      <p className={styles.help}>
        {onPage
          ? "Un élément seul s'aligne sur la page. En le déplaçant, il s'accroche aux bords, aux marges et au milieu (Alt pour l'en empêcher)."
          : "Les éléments s'alignent entre eux. En les déplaçant, ils s'accrochent aux autres éléments et à la page (Alt pour l'en empêcher)."}
      </p>
    </section>
  );
}
