import { useId, type ReactNode } from "react";
import styles from "./Field.module.css";

interface SegmentedProps<T extends string> {
  label: string;
  /** null : aucune option cochée (valeurs différentes dans la sélection). */
  value: T | null;
  options: readonly { value: T; label: string; icon?: ReactNode }[];
  disabled?: boolean;
  onChange: (value: T) => void;
}

/** Choix exclusif court (alignement, ajustement) : boutons radio natifs, flèches pour changer d'option. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: SegmentedProps<T>) {
  const name = useId();
  return (
    <fieldset className={styles.field} disabled={disabled}>
      <legend className={styles.label}>{label}</legend>
      <div className={styles.segmented}>
        {options.map((option) => (
          <label key={option.value} className={styles.segment} title={option.icon ? option.label : undefined}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => {
                onChange(option.value);
              }}
            />
            {option.icon ? (
              <>
                {option.icon}
                <span className="visually-hidden">{option.label}</span>
              </>
            ) : (
              <span>{option.label}</span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface ToggleProps {
  label: string;
  /** null : état différent selon les éléments de la sélection. */
  pressed: boolean | null;
  icon?: ReactNode;
  disabled?: boolean;
  onChange: (pressed: boolean) => void;
}

/** Bouton bascule (gras, italique, majuscules…) ; « mixte » quand la sélection est partagée. */
export function Toggle({ label, pressed, icon, disabled, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={pressed === null ? "mixed" : pressed}
      aria-label={icon ? label : undefined}
      title={icon ? label : undefined}
      disabled={disabled}
      onClick={() => {
        onChange(pressed !== true);
      }}
    >
      {icon ?? label}
    </button>
  );
}
