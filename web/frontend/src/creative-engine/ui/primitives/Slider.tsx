import { useId, useRef } from "react";
import styles from "./Field.module.css";

interface SliderProps {
  label: string;
  /** null : valeurs différentes dans la sélection. */
  value: number | null;
  min: number;
  max: number;
  step?: number;
  /** Valeur affichée à droite du curseur. */
  format: (value: number) => string;
  disabled?: boolean;
  /** Pendant le geste : aperçu, sans entrée dans l'historique. */
  onPreview: (value: number) => void;
  /** À la fin du geste (relâchement, touche, perte du focus) : une seule entrée dans l'historique. */
  onCommit: () => void;
}

/** Curseur : l'aperçu suit le geste, le document n'enregistre que la valeur finale. */
export function Slider({ label, value, min, max, step = 0.01, format, disabled = false, onPreview, onCommit }: SliderProps) {
  const id = useId();
  const moved = useRef(false);
  const finish = () => {
    if (!moved.current) return;
    moved.current = false;
    onCommit();
  };
  const shown = value ?? (min + max) / 2;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          id={id}
          className={styles.range}
          type="range"
          min={min}
          max={max}
          step={step}
          value={shown}
          disabled={disabled}
          onChange={(event) => {
            moved.current = true;
            onPreview(Number(event.target.value));
          }}
          onPointerUp={finish}
          onKeyUp={finish}
          onBlur={finish}
        />
        <output className={styles.output} htmlFor={id}>
          {value === null ? "Mixte" : format(value)}
        </output>
      </div>
    </div>
  );
}
