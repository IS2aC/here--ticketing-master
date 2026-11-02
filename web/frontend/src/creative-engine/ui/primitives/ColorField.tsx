import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { HexColor } from "../../domain/elements/types.ts";
import { parseHexColor } from "./colorInput.ts";
import styles from "./Field.module.css";

interface ColorFieldProps {
  label: string;
  /** null : valeurs différentes dans la sélection, ou aucune couleur (`none`). */
  value: HexColor | null;
  /** Pas de couleur (remplissage ou contour désactivé) : champ désactivé, « Aucun ». */
  none?: boolean;
  disabled?: boolean;
  /** Pendant le choix dans la palette : aperçu sans entrée d'historique. */
  onPreview: (color: HexColor) => void;
  /** Choix confirmé (palette refermée, Entrée dans le champ texte) : une seule entrée d'historique. */
  onCommit: (color: HexColor) => void;
}

/**
 * Pastille (sélecteur natif, aperçu en direct) et code hexadécimal (saisie clavier, validée à la confirmation).
 * Le sélecteur natif ignore la transparence : un canal alpha existant est conservé.
 */
export function ColorField({
  label,
  value,
  none = false,
  disabled = none,
  onPreview,
  onCommit,
}: ColorFieldProps) {
  const id = useId();
  const pickerRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const alpha = value && value.length === 9 ? value.slice(7) : "";

  // React traduit `onChange` par l'événement input (chaque mouvement) ; la confirmation est l'événement change.
  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;
    const onChange = () => {
      const color = parseHexColor(picker.value + alpha);
      if (color) onCommit(color);
    };
    picker.addEventListener("change", onChange);
    return () => {
      picker.removeEventListener("change", onChange);
    };
  }, [onCommit, alpha]);

  const commitDraft = () => {
    if (draft === null) return;
    const color = parseHexColor(draft);
    if (!color) {
      setInvalid(true);
      return;
    }
    setDraft(null);
    setInvalid(false);
    if (color !== value) onCommit(color);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setDraft(null);
      setInvalid(false);
    }
  };

  return (
    <div className={styles.field} data-invalid={invalid || undefined}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          ref={pickerRef}
          type="color"
          className={styles.swatch}
          value={(value ?? "#FFFFFF").slice(0, 7).toLowerCase()}
          disabled={disabled}
          aria-label={`${label} : palette`}
          data-mixed={value === null || none || undefined}
          onChange={(event) => {
            const color = parseHexColor(event.target.value + alpha);
            if (color) onPreview(color);
          }}
        />
        <input
          id={id}
          className={`${styles.input} ${styles.hex}`}
          type="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={9}
          value={none ? "" : (draft ?? value ?? "")}
          placeholder={none ? "Aucun" : value === null ? "Mixte" : undefined}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onFocus={(event) => {
            setDraft(value ?? "");
            event.target.select();
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onBlur={() => {
            if (draft !== null && parseHexColor(draft)) commitDraft();
            else {
              setDraft(null);
              setInvalid(false);
            }
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {invalid && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          Code couleur attendu, par exemple #E10600.
        </p>
      )}
    </div>
  );
}
