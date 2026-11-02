import { useId, useState, type KeyboardEvent } from "react";
import type { CommandError } from "../../domain/commands/result.ts";
import { formatInputNumber, parseNumber } from "./numberInput.ts";
import styles from "./Field.module.css";

interface NumberFieldProps {
  label: string;
  /** null : valeurs différentes dans la sélection (« Mixte »). */
  value: number | null;
  unit?: string;
  min?: number;
  max?: number;
  /** Pas des flèches haut / bas (Maj : × 10). */
  step?: number;
  decimals?: number;
  disabled?: boolean;
  testId?: string;
  /** Valide la valeur auprès des commandes ; renvoie l'erreur à afficher, sinon null. */
  onCommit: (value: number) => CommandError | null | Promise<CommandError | null>;
}

/**
 * Champ numérique validé à la confirmation (Entrée, Tab, perte du focus) : une seule commande par valeur,
 * jamais une par caractère. Le champ peut être vide ou invalide pendant la saisie ; une valeur invalide n'est
 * jamais envoyée et le message l'explique. Échap rétablit la valeur du document.
 */
export function NumberField({
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  decimals = 2,
  disabled = false,
  testId,
  onCommit,
}: NumberFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  // null hors saisie : le champ affiche la valeur du document, toujours à jour (annuler, gestes sur la page).
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : formatInputNumber(value, decimals));

  /** Vérifie et envoie un nombre ; renvoie vrai s'il est accepté. */
  const submit = async (next: number): Promise<boolean> => {
    if ((min !== undefined && next < min) || (max !== undefined && next > max)) {
      setError(rangeMessage(min, max, unit));
      return false;
    }
    if (next === value) {
      setError(null);
      return true;
    }
    const failure = await onCommit(next);
    setError(failure ? failure.message : null);
    return failure === null;
  };

  const commitDraft = async (onInvalid: "keep" | "revert") => {
    if (draft === null) return;
    const parsed = parseNumber(draft);
    if (draft.trim() === "" || parsed === null) {
      if (onInvalid === "revert") {
        setDraft(null);
        setError(null);
      } else if (draft.trim() !== "") setError("Saisissez un nombre, par exemple 12 ou 12,5.");
      return;
    }
    const accepted = await submit(parsed);
    if (accepted || onInvalid === "revert") setDraft(null);
    if (!accepted && onInvalid === "revert") setError(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitDraft("keep");
    } else if (event.key === "Escape") {
      // Échap annule la saisie sans désélectionner l'élément ni fermer le tiroir.
      event.preventDefault();
      event.stopPropagation();
      setDraft(null);
      setError(null);
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const base = parseNumber(shown) ?? value ?? 0;
      const delta = (event.key === "ArrowUp" ? 1 : -1) * step * (event.shiftKey ? 10 : 1);
      const next = clamp(Math.round((base + delta) * 100) / 100, min, max);
      void submit(next).then((accepted) => {
        if (accepted) setDraft(null);
      });
    }
  };

  return (
    <div className={styles.field} data-invalid={error !== null || undefined}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          id={id}
          className={styles.input}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={shown}
          placeholder={value === null ? "Mixte" : undefined}
          disabled={disabled}
          aria-invalid={error !== null || undefined}
          aria-describedby={error ? errorId : undefined}
          data-testid={testId}
          onFocus={(event) => {
            setDraft(shown);
            event.target.select();
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onBlur={() => {
            void commitDraft("revert");
          }}
          onKeyDown={onKeyDown}
        />
        {unit && (
          <span className={styles.unit} aria-hidden="true">
            {unit}
          </span>
        )}
      </div>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function clamp(value: number, min?: number, max?: number): number {
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));
}

function rangeMessage(min?: number, max?: number, unit?: string): string {
  const suffix = unit ? ` ${unit}` : "";
  const fmt = (n: number) => formatInputNumber(n);
  if (min !== undefined && max !== undefined) return `Entre ${fmt(min)} et ${fmt(max)}${suffix}.`;
  if (min !== undefined) return `Au moins ${fmt(min)}${suffix}.`;
  return `Au plus ${fmt(max ?? 0)}${suffix}.`;
}
