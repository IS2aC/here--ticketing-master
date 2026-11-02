import type { HexColor, LinearGradient, Shadow, TextOutline } from "../../domain/elements/types.ts";
import type { ImageElement, ShapeElement, TextElement } from "../../domain/elements/types.ts";
import { LIMITS } from "../../domain/constraints.ts";
import type { ElementPatch } from "../../domain/commands/elementCommands.ts";
import { commitLiveEdit, previewElements, updateElements } from "../../editor/actions.ts";
import { guestSlotRules } from "../../editor/guestSlots.ts";
import { ColorField } from "../primitives/ColorField.tsx";
import { NumberField } from "../primitives/NumberField.tsx";
import { Toggle } from "../primitives/Segmented.tsx";
import styles from "./PropertiesPanel.module.css";

// Effets : ombre (textes, formes, images), contour (textes), dégradé (textes, rectangles, ellipses).
// La sélection est d'un seul type (comme les sections Typographie, Forme, Image) ; les réglages affichés sont
// ceux du premier élément et s'appliquent à tous.

type Effectable = TextElement | ShapeElement | ImageElement;
interface Effects {
  shadow?: Shadow | null;
  outline?: TextOutline | null;
  gradient?: LinearGradient | null;
}

const SHADOWS: readonly { label: string; value: Shadow }[] = [
  { label: "Douce", value: { color: "#0B0B0B33", blur: 16, offsetX: 0, offsetY: 6 } },
  { label: "Portée", value: { color: "#0B0B0B66", blur: 4, offsetX: 4, offsetY: 6 } },
  { label: "Lueur", value: { color: "#FFF4D6CC", blur: 28, offsetX: 0, offsetY: 0 } },
];

/** Métaux et ambiances des faire-part. */
const GRADIENTS: readonly { label: string; value: LinearGradient }[] = [
  { label: "Or", value: { from: "#A97A2B", to: "#F2D68A", angle: 90 } },
  { label: "Or rose", value: { from: "#B76E5C", to: "#F4C7B5", angle: 90 } },
  { label: "Argent", value: { from: "#8E949B", to: "#EEF0F2", angle: 90 } },
  { label: "Nuit", value: { from: "#0B1A3A", to: "#3B5BA9", angle: 135 } },
];

const DEFAULT_OUTLINE: TextOutline = { color: "#FFFFFF", width: 2 };

const effectsOf = (element: Effectable): Effects => (element.type === "text" ? element.style : element);

export function EffectsSection({ elements }: { elements: readonly Effectable[] }) {
  const [first] = elements;
  if (!first) return null;
  const ids = elements.map((e) => e.id);
  const isText = first.type === "text";
  const canGradient = isText || (first.type === "shape" && first.shape !== "line");
  const current = effectsOf(first);
  const shadow = current.shadow ?? null;
  const outline = current.outline ?? null;
  const gradient = current.gradient ?? null;

  // Champs invité : l'hôte les dessine lui-même et peut ne pas savoir rendre les effets.
  const rules = guestSlotRules();
  if (rules && !rules.effects && elements.some((e) => e.slot)) {
    return (
      <section aria-labelledby="properties-effects-title" className={styles.section}>
        <h3 id="properties-effects-title" className={styles.sectionTitle}>
          Effets
        </h3>
        <p className={styles.help}>
          Champ rempli pour chaque invité : les effets ne s'y appliquent pas. Mettez-les en valeur avec le décor
          autour.
        </p>
      </section>
    );
  }

  const patch = (effects: Effects): ElementPatch => (isText ? { style: effects } : effects) as ElementPatch;
  const apply = (effects: Effects, label: string) => updateElements(ids, patch(effects), label);
  const preview = (effects: Effects, label: string) => {
    previewElements(ids, patch(effects), label);
  };
  const commit = (effects: Effects, label: string) => {
    preview(effects, label);
    commitLiveEdit();
  };

  return (
    <section aria-labelledby="properties-effects-title" className={styles.section}>
      <h3 id="properties-effects-title" className={styles.sectionTitle}>
        Effets
      </h3>
      <div className={styles.stack}>
        <div>
          <p className={styles.help}>Ombre</p>
          <div className={styles.toggles} role="group" aria-label="Ombre">
            <Toggle label="Aucune" pressed={shadow === null} onChange={() => apply({ shadow: null }, "Retirer l'ombre")} />
            {SHADOWS.map((preset) => (
              <Toggle
                key={preset.label}
                label={preset.label}
                pressed={shadow !== null && sameShadow(shadow, preset.value)}
                onChange={() => apply({ shadow: preset.value }, "Ajouter une ombre")}
              />
            ))}
          </div>
        </div>
        {shadow && (
          <>
            <ColorField
              label="Couleur de l'ombre"
              value={shadow.color}
              onPreview={(color: HexColor) => preview({ shadow: { ...shadow, color } }, "Couleur de l'ombre")}
              onCommit={(color: HexColor) => commit({ shadow: { ...shadow, color } }, "Couleur de l'ombre")}
            />
            <div className={styles.fields}>
              <NumberField
                label="Flou"
                unit="px"
                value={shadow.blur}
                min={LIMITS.shadowBlur.min}
                max={LIMITS.shadowBlur.max}
                onCommit={(blur) => apply({ shadow: { ...shadow, blur } }, "Flou de l'ombre")}
              />
              <NumberField
                label="Décalage"
                unit="px"
                value={shadow.offsetY}
                min={LIMITS.shadowOffset.min}
                max={LIMITS.shadowOffset.max}
                onCommit={(offsetY) => apply({ shadow: { ...shadow, offsetY } }, "Décalage de l'ombre")}
              />
            </div>
          </>
        )}

        {canGradient && (
          <div>
            <p className={styles.help}>Dégradé</p>
            <div className={styles.toggles} role="group" aria-label="Dégradé">
              <Toggle
                label="Aucun"
                pressed={gradient === null}
                onChange={() => apply({ gradient: null }, "Retirer le dégradé")}
              />
              {GRADIENTS.map((preset) => (
                <Toggle
                  key={preset.label}
                  label={preset.label}
                  pressed={gradient !== null && gradient.from === preset.value.from && gradient.to === preset.value.to}
                  onChange={() => apply({ gradient: preset.value }, "Appliquer un dégradé")}
                />
              ))}
            </div>
          </div>
        )}
        {canGradient && gradient && (
          <>
            <div className={styles.fields}>
              <ColorField
                label="Début"
                value={gradient.from}
                onPreview={(from: HexColor) => preview({ gradient: { ...gradient, from } }, "Couleurs du dégradé")}
                onCommit={(from: HexColor) => commit({ gradient: { ...gradient, from } }, "Couleurs du dégradé")}
              />
              <ColorField
                label="Fin"
                value={gradient.to}
                onPreview={(to: HexColor) => preview({ gradient: { ...gradient, to } }, "Couleurs du dégradé")}
                onCommit={(to: HexColor) => commit({ gradient: { ...gradient, to } }, "Couleurs du dégradé")}
              />
            </div>
            <NumberField
              label="Angle"
              unit="°"
              value={gradient.angle}
              min={0}
              max={359}
              onCommit={(angle) => apply({ gradient: { ...gradient, angle: ((angle % 360) + 360) % 360 } }, "Angle du dégradé")}
            />
          </>
        )}

        {isText && (
          <div>
            <div className={styles.toggles} role="group" aria-label="Contour">
              <Toggle
                label="Contour"
                pressed={outline !== null}
                onChange={(on) => apply({ outline: on ? DEFAULT_OUTLINE : null }, on ? "Ajouter un contour" : "Retirer le contour")}
              />
            </div>
          </div>
        )}
        {isText && outline && (
          <div className={styles.fields}>
            <ColorField
              label="Couleur du contour"
              value={outline.color}
              onPreview={(color: HexColor) => preview({ outline: { ...outline, color } }, "Couleur du contour")}
              onCommit={(color: HexColor) => commit({ outline: { ...outline, color } }, "Couleur du contour")}
            />
            <NumberField
              label="Épaisseur"
              unit="px"
              value={outline.width}
              min={LIMITS.outlineWidth.min}
              max={LIMITS.outlineWidth.max}
              step={0.5}
              onCommit={(width) => apply({ outline: { ...outline, width } }, "Épaisseur du contour")}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function sameShadow(a: Shadow, b: Shadow): boolean {
  return a.color === b.color && a.blur === b.blur && a.offsetX === b.offsetX && a.offsetY === b.offsetY;
}
