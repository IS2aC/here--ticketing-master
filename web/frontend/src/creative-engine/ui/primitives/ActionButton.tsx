import { useId, type ButtonHTMLAttributes, type Ref } from "react";
import { Icon, type IconName } from "../icons/Icon.tsx";
import styles from "./ActionButton.module.css";

interface ActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  icon?: IconName;
  /** Libellé visible à côté de l'icône ; sinon, le libellé n'apparaît qu'en infobulle. */
  showLabel?: boolean;
  variant?: "tool" | "ghost";
  /** Fonction pas encore disponible : le bouton reste focalisable et l'explique, mais n'agit pas. */
  unavailable?: boolean;
  tooltipSide?: "right" | "bottom" | "top";
  /** Raccourci clavier : `label` affiché dans l'infobulle, `aria` au format aria-keyshortcuts. */
  shortcut?: { label: string; aria: string };
  ref?: Ref<HTMLButtonElement>;
}

export const UNAVAILABLE_HINT = "Bientôt disponible";

export function ActionButton({
  label,
  icon,
  showLabel = false,
  variant = "tool",
  unavailable = false,
  tooltipSide = "bottom",
  shortcut,
  onClick,
  className,
  ref,
  ...rest
}: ActionButtonProps) {
  const hintId = useId();
  const hasTooltip = !showLabel || unavailable || shortcut !== undefined;

  return (
    <span className={styles.wrapper}>
      <button
        ref={ref}
        type="button"
        className={[styles.button, styles[variant], showLabel ? styles.withLabel : "", className ?? ""].join(
          " ",
        )}
        aria-label={showLabel ? undefined : label}
        aria-disabled={unavailable || undefined}
        aria-describedby={unavailable ? hintId : undefined}
        aria-keyshortcuts={shortcut?.aria}
        onClick={unavailable ? undefined : onClick}
        {...rest}
      >
        {icon && <Icon name={icon} />}
        {showLabel && <span>{label}</span>}
      </button>
      {hasTooltip && (
        <span role="tooltip" className={[styles.tooltip, styles[tooltipSide]].join(" ")}>
          {showLabel ? null : <span className={styles.tooltipLabel}>{label}</span>}
          {shortcut && <span className={styles.tooltipHint}>{shortcut.label}</span>}
          {unavailable && (
            <span id={hintId} className={styles.tooltipHint}>
              {UNAVAILABLE_HINT}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
