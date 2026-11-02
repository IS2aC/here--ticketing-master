import { LIMITS } from "../../domain/constraints.ts";
import type { ShapePatch } from "../../domain/commands/elementCommands.ts";
import type { Element, HexColor, ShapeElement, Stroke } from "../../domain/elements/types.ts";
import { commitLiveEdit, previewElements, updateElements, type PatchFor } from "../../editor/actions.ts";
import { ColorField } from "../primitives/ColorField.tsx";
import { NumberField } from "../primitives/NumberField.tsx";
import { Segmented, Toggle } from "../primitives/Segmented.tsx";
import { MIXED, orNull, shared } from "./selection.ts";
import styles from "./PropertiesPanel.module.css";

/** Valeurs données à un remplissage ou à un contour qu'on active. */
const DEFAULT_FILL: HexColor = "#E2E2E2";
const DEFAULT_STROKE: Stroke = { color: "#0B0B0B", width: 2, style: "solid" };

const STROKE_STYLES = [
  { value: "solid", label: "Plein" },
  { value: "dashed", label: "Tirets" },
] as const satisfies readonly { value: Stroke["style"]; label: string }[];

/** Contour modifié élément par élément : chaque forme garde ses autres réglages de contour. */
const withStroke =
  (change: Partial<Stroke>) =>
  (element: Element): ShapePatch => ({
    stroke: { ...((element.type === "shape" && element.stroke) || DEFAULT_STROKE), ...change },
  });

/** Couleur choisie : l'aperçu en cours (ou la valeur saisie) devient une seule entrée d'historique. */
function commitColor(ids: readonly string[], patch: PatchFor, label: string) {
  previewElements(ids, patch, label);
  commitLiveEdit();
}

/** Remplissage, contour et coins d'une ou plusieurs formes. Une ligne n'a qu'un contour, toujours présent. */
export function ShapeSection({ shapes }: { shapes: readonly ShapeElement[] }) {
  const ids = shapes.map((s) => s.id);
  const hasLine = shapes.some((s) => s.shape === "line");
  const allRects = shapes.every((s) => s.shape === "rect");
  const fill = shared(shapes, (s) => s.fill);
  const hasStroke = shared(shapes, (s) => s.stroke !== null);
  const strokes = shapes.flatMap((s) => (s.stroke ? [s.stroke] : []));
  const strokeColor = orNull(shared(strokes, (s) => s.color));
  const strokeWidth = orNull(shared(strokes, (s) => s.width));
  const strokeStyle = orNull(shared(strokes, (s) => s.style));

  return (
    <section aria-labelledby="properties-shape-title" className={styles.section}>
      <h3 id="properties-shape-title" className={styles.sectionTitle}>
        Forme
      </h3>
      <div className={styles.stack}>
        {!hasLine && (
          <div className={styles.withSwitch}>
            <ColorField
              label="Remplissage"
              value={fill === MIXED ? null : fill}
              none={fill === null}
              onPreview={(color) => {
                previewElements(ids, { fill: color }, "Modifier le remplissage");
              }}
              onCommit={(color) => {
                commitColor(ids, { fill: color }, "Modifier le remplissage");
              }}
            />
            <Toggle
              label="Aucun"
              pressed={fill === MIXED ? null : fill === null}
              onChange={(none) => {
                updateElements(ids, { fill: none ? null : DEFAULT_FILL }, "Modifier le remplissage");
              }}
            />
          </div>
        )}

        <div className={styles.withSwitch}>
          <ColorField
            label="Contour"
            value={strokeColor}
            none={hasStroke === false}
            onPreview={(color) => {
              previewElements(ids, withStroke({ color }), "Modifier le contour");
            }}
            onCommit={(color) => {
              commitColor(ids, withStroke({ color }), "Modifier le contour");
            }}
          />
          {!hasLine && (
            <Toggle
              label="Aucun"
              pressed={hasStroke === MIXED ? null : !hasStroke}
              onChange={(none) => {
                updateElements(ids, none ? { stroke: null } : withStroke({}), "Modifier le contour");
              }}
            />
          )}
        </div>

        {hasStroke !== false && (
          <div className={styles.fields}>
            <NumberField
              label="Épaisseur"
              unit="px"
              value={strokeWidth}
              min={LIMITS.strokeWidth.min}
              max={LIMITS.strokeWidth.max}
              onCommit={(width) => updateElements(ids, withStroke({ width }), "Modifier le contour")}
            />
            <Segmented
              label="Trait"
              value={strokeStyle}
              options={STROKE_STYLES}
              onChange={(style) => {
                updateElements(ids, withStroke({ style }), "Modifier le contour");
              }}
            />
          </div>
        )}

        {allRects && (
          <NumberField
            label="Arrondi des coins"
            unit="px"
            value={orNull(shared(shapes, (s) => s.cornerRadius))}
            min={0}
            max={LIMITS.elementSize.max}
            onCommit={(cornerRadius) => updateElements(ids, { cornerRadius }, "Arrondir les coins")}
          />
        )}
      </div>
    </section>
  );
}
