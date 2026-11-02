import { useId, useState, type KeyboardEvent } from "react";
import { LIMITS } from "../../domain/constraints.ts";
import type { FontWeight, HexColor, TextElement, TextStyle } from "../../domain/elements/types.ts";
import { commitLiveEdit, fitTextToWidth, previewElements, setTextContent, updateTextStyle } from "../../editor/actions.ts";
import { guestSlotRules } from "../../editor/guestSlots.ts";
import {
  closestWeight,
  FONT_CATALOG,
  fontOption,
  toggledBoldWeight,
  WEIGHT_LABELS,
} from "../../editor/fontCatalog.ts";
import { ColorField } from "../primitives/ColorField.tsx";
import { LegibilityHint } from "./LegibilityHint.tsx";
import { useSwatches } from "./useSwatches.ts";
import { NumberField } from "../primitives/NumberField.tsx";
import { Segmented, Toggle } from "../primitives/Segmented.tsx";
import fieldStyles from "../primitives/Field.module.css";
import { MIXED, orNull, shared } from "./selection.ts";
import styles from "./PropertiesPanel.module.css";

const ALIGN_OPTIONS = [
  { value: "left", label: "À gauche" },
  { value: "center", label: "Centré" },
  { value: "right", label: "À droite" },
  { value: "justify", label: "Justifié" },
] as const satisfies readonly { value: TextStyle["align"]; label: string }[];

/** Contenu du texte (élément seul) : validé à la perte du focus ou par Ctrl + Entrée ; Échap annule. */
function ContentField({ element }: { element: TextElement }) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    setTextContent(element.id, draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setDraft(null);
    }
  };

  return (
    <div className={fieldStyles.field}>
      <label htmlFor={id} className={fieldStyles.label}>
        Contenu
      </label>
      <textarea
        id={id}
        className={fieldStyles.textarea}
        value={draft ?? element.content}
        maxLength={LIMITS.textContent.maxLength}
        disabled={element.locked}
        rows={3}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

/** Typographie d'un ou plusieurs textes ; une valeur qui diffère entre eux s'affiche « Mixte ». */
export function TextSection({ texts }: { texts: readonly TextElement[] }) {
  const familyId = useId();
  const weightId = useId();
  const ids = texts.map((t) => t.id);
  const style = <K extends keyof TextStyle>(key: K) => shared(texts, (t) => t.style[key]);
  const family = style("fontFamily");
  const weight = style("fontWeight");
  const fontStyle = style("fontStyle");
  const transform = style("textTransform");
  const bold = shared(texts, (t) => t.style.fontWeight >= 600);
  const [single] = texts.length === 1 ? texts : [];
  const swatches = useSwatches(orNull(style("color")));
  const weights = family === MIXED ? [] : (fontOption(family)?.weights ?? []);
  const weightChoices = weight !== MIXED && !weights.includes(weight) ? [...weights, weight] : weights;

  const apply = (patch: Partial<TextStyle>, label?: string) => {
    void updateTextStyle(ids, patch, label);
  };
  // Champs invité : seulement les polices que l'hôte sait dessiner pour chaque invité.
  const slotFonts = texts.some((t) => t.slot) ? guestSlotRules()?.fonts : undefined;
  const fonts = slotFonts ? FONT_CATALOG.filter((option) => slotFonts.includes(option.family)) : FONT_CATALOG;

  return (
    <section aria-labelledby="properties-text-title" className={styles.section}>
      <h3 id="properties-text-title" className={styles.sectionTitle}>
        Typographie
      </h3>
      <div className={styles.stack}>
        {single && <ContentField key={single.id} element={single} />}

        <div className={fieldStyles.field}>
          <label htmlFor={familyId} className={fieldStyles.label}>
            Police
          </label>
          <select
            id={familyId}
            className={fieldStyles.select}
            value={family === MIXED ? "" : family}
            onChange={(event) => {
              const next = event.target.value;
              // Chaque texte garde la graisse disponible la plus proche de la sienne dans la nouvelle police.
              void Promise.all(
                texts.map((t) =>
                  updateTextStyle([t.id], {
                    fontFamily: next,
                    fontWeight: closestWeight(next, t.style.fontWeight),
                  }),
                ),
              );
            }}
          >
            {family === MIXED && (
              <option value="" disabled>
                Mixte
              </option>
            )}
            {family !== MIXED && !fontOption(family) && <option value={family}>{family}</option>}
            {fonts.map((option) => (
              <option key={option.family} value={option.family} style={{ fontFamily: option.family }}>
                {option.family}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.fields}>
          <div className={fieldStyles.field}>
            <label htmlFor={weightId} className={fieldStyles.label}>
              Graisse
            </label>
            <select
              id={weightId}
              className={fieldStyles.select}
              value={weight === MIXED ? "" : String(weight)}
              disabled={family === MIXED}
              onChange={(event) => {
                apply({ fontWeight: Number(event.target.value) as FontWeight });
              }}
            >
              {weight === MIXED && (
                <option value="" disabled>
                  Mixte
                </option>
              )}
              {weightChoices.map((w) => (
                <option key={w} value={w}>
                  {WEIGHT_LABELS[w]}
                </option>
              ))}
            </select>
          </div>
          <NumberField
            label="Taille"
            unit="px"
            value={orNull(style("fontSize"))}
            min={LIMITS.fontSize.min}
            max={LIMITS.fontSize.max}
            onCommit={(fontSize) => updateTextStyle(ids, { fontSize })}
          />
        </div>
        {single && (
          <button
            type="button"
            className={styles.textButton}
            onClick={() => {
              void fitTextToWidth(single.id);
            }}
          >
            Ajuster la taille à la largeur du cadre
          </button>
        )}

        <div className={styles.toggles} role="group" aria-label="Style du texte">
          <Toggle
            label="Gras"
            pressed={orNull(bold)}
            onChange={() => {
              void Promise.all(
                texts.map((t) =>
                  updateTextStyle([t.id], {
                    fontWeight:
                      bold === true ? closestWeight(t.style.fontFamily, 400) : toggledBoldWeight(t.style),
                  }),
                ),
              );
            }}
          />
          <Toggle
            label="Italique"
            pressed={fontStyle === MIXED ? null : fontStyle === "italic"}
            onChange={(pressed) => {
              apply({ fontStyle: pressed ? "italic" : "normal" });
            }}
          />
          <Toggle
            label="Majuscules"
            pressed={transform === MIXED ? null : transform === "uppercase"}
            onChange={(pressed) => {
              apply({ textTransform: pressed ? "uppercase" : "none" });
            }}
          />
        </div>

        <ColorField
          label="Couleur"
          value={orNull(style("color"))}
          onPreview={(color: HexColor) => {
            previewElements(ids, { style: { color } }, "Modifier la couleur");
          }}
          onCommit={(color: HexColor) => {
            previewElements(ids, { style: { color } }, "Modifier la couleur");
            commitLiveEdit();
          }}
          swatches={swatches}
        />
        {single && <LegibilityHint element={single} />}

        <Segmented
          label="Alignement"
          value={orNull(style("align"))}
          options={ALIGN_OPTIONS}
          onChange={(align) => {
            apply({ align }, "Aligner le texte");
          }}
        />

        <div className={styles.fields}>
          <NumberField
            label="Interligne"
            value={orNull(style("lineHeight"))}
            min={LIMITS.lineHeight.min}
            max={LIMITS.lineHeight.max}
            step={0.1}
            onCommit={(lineHeight) => updateTextStyle(ids, { lineHeight })}
          />
          <NumberField
            label="Espacement"
            unit="em"
            value={orNull(style("letterSpacing"))}
            min={LIMITS.letterSpacing.min}
            max={LIMITS.letterSpacing.max}
            step={0.01}
            onCommit={(letterSpacing) => updateTextStyle(ids, { letterSpacing })}
          />
        </div>
      </div>
    </section>
  );
}
