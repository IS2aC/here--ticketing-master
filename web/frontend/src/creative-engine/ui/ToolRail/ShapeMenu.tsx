import type { ShapeElement } from "../../domain/elements/types.ts";
import { addShape } from "../../editor/actions.ts";
import type { IconName } from "../icons/Icon.tsx";
import { MenuButton } from "../primitives/MenuButton.tsx";

const SHAPES: readonly { shape: ShapeElement["shape"]; label: string; icon: IconName }[] = [
  { shape: "rect", label: "Rectangle", icon: "rect" },
  { shape: "ellipse", label: "Ellipse", icon: "ellipse" },
  { shape: "line", label: "Ligne", icon: "line" },
];

/** Bouton « Formes » de la barre d'outils et son menu. */
export function ShapeMenu({ buttonClassName }: { buttonClassName?: string }) {
  return (
    <MenuButton
      label="Ajouter une forme"
      menuLabel="Formes"
      icon="shapes"
      placement="right"
      tooltipSide="right"
      buttonClassName={buttonClassName}
      tabIndex={-1}
      items={SHAPES.map(({ shape, label, icon }) => ({
        label,
        icon,
        onSelect: () => {
          addShape(shape);
        },
      }))}
    />
  );
}
