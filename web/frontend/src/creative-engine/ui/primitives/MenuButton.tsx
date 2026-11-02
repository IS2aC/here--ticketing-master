import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "../icons/Icon.tsx";
import { ActionButton } from "./ActionButton.tsx";
import styles from "./MenuButton.module.css";

export interface MenuItem {
  label: string;
  icon?: IconName;
  /** Raccourci affiché à droite (« Ctrl + S »). */
  hint?: string;
  disabled?: boolean;
  onSelect: () => void;
}

interface MenuButtonProps {
  /** Libellé du bouton (infobulle ou texte visible). */
  label: string;
  /** Nom du menu pour les lecteurs d'écran. */
  menuLabel: string;
  icon: IconName;
  items: readonly MenuItem[];
  showLabel?: boolean;
  /** À droite du bouton (barre d'outils verticale) ou dessous (barre supérieure). */
  placement?: "right" | "below";
  tooltipSide?: "right" | "bottom" | "top";
  buttonClassName?: string;
  tabIndex?: number;
  children?: ReactNode;
}

/** Bouton et son menu (motif ARIA menu button : flèches, Début/Fin, Échap, focus rendu au bouton). */
export function MenuButton({
  label,
  menuLabel,
  icon,
  items,
  showLabel = false,
  placement = "below",
  tooltipSide = "bottom",
  buttonClassName,
  tabIndex,
  children,
}: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const entries = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? []);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    entries()[0]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Les touches du menu ne doivent ni parcourir une barre d'outils ni déclencher les raccourcis globaux.
    event.stopPropagation();
    const list = entries();
    const current = list.findIndex((item) => item === document.activeElement);
    const focusAt = (index: number) => list[(index + list.length) % list.length]?.focus();
    switch (event.key) {
      case "ArrowDown":
        focusAt(current + 1);
        break;
      case "ArrowUp":
        focusAt(current - 1);
        break;
      case "Home":
        focusAt(0);
        break;
      case "End":
        focusAt(list.length - 1);
        break;
      case "Escape":
      case "Tab":
        close(event.key === "Escape");
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <span className={styles.anchor}>
      <ActionButton
        ref={buttonRef}
        label={label}
        icon={icon}
        showLabel={showLabel}
        variant={showLabel ? "ghost" : "tool"}
        tooltipSide={tooltipSide}
        className={buttonClassName}
        tabIndex={tabIndex}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen((value) => !value);
        }}
      />
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={menuLabel}
          className={styles.menu}
          data-placement={placement}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={styles.item}
              disabled={item.disabled}
              onClick={() => {
                close(false);
                item.onSelect();
              }}
            >
              {item.icon && <Icon name={item.icon} />}
              <span className={styles.itemLabel}>{item.label}</span>
              {item.hint && <span className={styles.hint}>{item.hint}</span>}
            </button>
          ))}
        </div>
      )}
      {children}
    </span>
  );
}
