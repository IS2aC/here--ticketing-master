import { useShallow } from "zustand/react/shallow";
import type { ReorderTarget } from "../../domain/commands/elementCommands.ts";
import type { Element, ImageElement, ShapeElement, TextElement } from "../../domain/elements/types.ts";
import { deleteSelection, duplicateSelection, reorderSelection } from "../../editor/actions.ts";
import { useDocumentStore } from "../../editor/documentStore.ts";
import { ActionButton } from "../primitives/ActionButton.tsx";
import { AppearanceSection } from "./AppearanceSection.tsx";
import { EffectsSection } from "./EffectsSection.tsx";
import { GeometrySection } from "./GeometrySection.tsx";
import { ImageSection } from "./ImageSection.tsx";
import { elementLabel, elementTypeLabel } from "./labels.ts";
import { orderAvailability, useSelectedElements } from "./selection.ts";
import { ShapeSection } from "./ShapeSection.tsx";
import { TextSection } from "./TextSection.tsx";
import styles from "./PropertiesPanel.module.css";

const ORDER_ACTIONS: {
  to: ReorderTarget;
  label: string;
  icon: Parameters<typeof ActionButton>[0]["icon"];
  key: string;
  aria: string;
}[] = [
  {
    to: "front",
    label: "Mettre au premier plan",
    icon: "bringToFront",
    key: "Ctrl + Maj + ]",
    aria: "Control+Shift+]",
  },
  { to: "forward", label: "Avancer", icon: "bringForward", key: "Ctrl + ]", aria: "Control+]" },
  { to: "backward", label: "Reculer", icon: "sendBackward", key: "Ctrl + [", aria: "Control+[" },
  {
    to: "back",
    label: "Mettre à l'arrière-plan",
    icon: "sendToBack",
    key: "Ctrl + Maj + [",
    aria: "Control+Shift+[",
  },
];

const isText = (e: Element): e is TextElement => e.type === "text";
const isShape = (e: Element): e is ShapeElement => e.type === "shape";
const isImage = (e: Element): e is ImageElement => e.type === "image";

function Header({ elements }: { elements: readonly Element[] }) {
  const [first] = elements;
  if (elements.length > 1 || !first) {
    const locked = elements.filter((e) => e.locked).length;
    return (
      <>
        <h3 id="properties-selection-title" className={styles.sectionTitle}>
          Sélection multiple
        </h3>
        <p className={styles.elementName}>{elements.length} éléments</p>
        {locked > 0 && (
          <p className={styles.help}>
            {locked === 1
              ? "1 élément verrouillé ne bougera pas."
              : `${locked} éléments verrouillés ne bougeront pas.`}
          </p>
        )}
      </>
    );
  }
  return (
    <>
      <h3 id="properties-selection-title" className={styles.sectionTitle}>
        {elementTypeLabel(first)}
        {first.locked && <span className={styles.badge}>Verrouillé</span>}
      </h3>
      <p className={styles.elementName}>{elementLabel(first)}</p>
    </>
  );
}

/**
 * Propriétés de la sélection, adaptées à son contenu : géométrie pour un élément seul, réglages du type quand
 * tous les éléments sont du même type, apparence et actions dans tous les cas.
 */
export function SelectionSection() {
  const elements = useSelectedElements();
  // Ordre des éléments : ne change qu'avec un ajout, une suppression ou une réorganisation.
  const order = useDocumentStore(useShallow((s) => s.history.present.elements.map((e) => e.id)));

  if (elements.length === 0) {
    return (
      <section aria-labelledby="properties-selection-title" className={styles.section}>
        <h3 id="properties-selection-title" className={styles.sectionTitle}>
          Sélection
        </h3>
        <p className={styles.empty}>Aucun élément sélectionné.</p>
        <p className={styles.help}>
          Cliquez sur un élément de la page ou choisissez-le dans les calques. Maj + clic ou glisser dans le
          vide pour en sélectionner plusieurs.
        </p>
      </section>
    );
  }

  const [single] = elements.length === 1 ? elements : [];
  const texts = elements.filter(isText);
  const shapes = elements.filter(isShape);
  const images = elements.filter(isImage);
  const removable = elements.some((e) => !e.locked);
  const canReorder = orderAvailability(
    order,
    elements.map((e) => e.id),
  );

  return (
    <>
      <section aria-labelledby="properties-selection-title" className={styles.section}>
        <Header elements={elements} />
        <div className={styles.actions} role="group" aria-label="Actions sur la sélection">
          <ActionButton
            label="Dupliquer"
            icon="duplicate"
            showLabel
            variant="ghost"
            shortcut={{ label: "Ctrl + D", aria: "Control+D" }}
            onClick={() => {
              duplicateSelection();
            }}
          />
          <ActionButton
            label="Supprimer"
            icon="trash"
            showLabel
            variant="ghost"
            shortcut={{ label: "Suppr", aria: "Delete" }}
            disabled={!removable}
            onClick={() => {
              deleteSelection();
            }}
          />
        </div>
        <div className={styles.order} role="group" aria-label="Ordre d'affichage">
          {ORDER_ACTIONS.map((action) => (
            <ActionButton
              key={action.to}
              label={action.label}
              icon={action.icon}
              tooltipSide="top"
              shortcut={{ label: action.key, aria: action.aria }}
              disabled={!canReorder[action.to]}
              onClick={() => {
                reorderSelection(action.to);
              }}
            />
          ))}
        </div>
      </section>

      {single && <GeometrySection element={single} />}
      {texts.length === elements.length && <TextSection texts={texts} />}
      {shapes.length === elements.length && <ShapeSection shapes={shapes} />}
      {images.length === elements.length && <ImageSection images={images} />}
      {texts.length === elements.length && <EffectsSection elements={texts} />}
      {shapes.length === elements.length && <EffectsSection elements={shapes} />}
      {images.length === elements.length && <EffectsSection elements={images} />}
      <AppearanceSection elements={elements} />
    </>
  );
}
