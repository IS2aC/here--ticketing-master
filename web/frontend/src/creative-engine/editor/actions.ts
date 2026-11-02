import {
  addElement,
  duplicateElement,
  moveElement,
  removeElement,
  reorderElements,
  resizeElement,
  rotateElement,
  updateElement,
  type ElementPatch,
  type ReorderTarget,
  type TextPatch,
} from "../domain/commands/elementCommands.ts";
import { addAsset, renameDocument as renameDocumentCommand } from "../domain/commands/documentCommands.ts";
import type { CommandError } from "../domain/commands/result.ts";
import { createImageElement, createShapeElement, createTextElement } from "../domain/document/factories.ts";
import { placeImage } from "../domain/document/placement.ts";
import type { CreativeDocument, ImageAsset } from "../domain/document/types.ts";
import type { Element, ShapeElement, TextElement, TextStyle } from "../domain/elements/types.ts";
import { createId, type Id } from "../domain/ids.ts";
import { LIMITS } from "../domain/constraints.ts";
import { alignMoves, distributeMoves, type Alignment } from "./layoutAids.ts";
import { currentDocument, useDocumentStore, type DocumentCommand } from "./documentStore.ts";
import { useEditorStore } from "./editorStore.ts";
import { measuredTextHeight, prepareFont } from "./textMeasure.ts";

// Actions de l'éditeur : seul point d'entrée de l'interface et du rendu pour modifier le document.
// Elles enchaînent commandes du domaine, historique et cohérence de la sélection.

export type ImagePlacement = "centered" | "background" | "card";

export interface ElementGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

const store = () => useDocumentStore.getState();
const selection = () => useEditorStore.getState().selectedIds;
/** Flèche maintenue : la transaction de déplacement est ouverte (voir nudgeSelection). */
let nudging = false;

function findElement(id: Id): Element | undefined {
  return currentDocument().elements.find((e) => e.id === id);
}

/** Retire de la sélection les éléments qui n'existent plus (suppression, annulation, autre document). */
function pruneSelection(): void {
  const ids = selection();
  const existing = new Set(currentDocument().elements.map((e) => e.id));
  const kept = ids.filter((id) => existing.has(id));
  if (kept.length !== ids.length) useEditorStore.getState().setSelection(kept);
  const editing = useEditorStore.getState().editingTextId;
  if (editing && !existing.has(editing)) useEditorStore.getState().setEditingText(null);
}

function run(label: string, commands: readonly DocumentCommand[]): CommandError | null {
  const error = store().executeAll(label, commands);
  pruneSelection();
  return error;
}

/** Après un changement de contenu ou de style, la hauteur d'un texte suit sa nouvelle mise en page. */
function remeasure(id: Id): DocumentCommand {
  return (doc) => {
    const element = doc.elements.find((e) => e.id === id);
    if (element?.type !== "text") return { ok: true, document: doc };
    const height = measuredTextHeight(element);
    if (height === element.height) return { ok: true, document: doc };
    return resizeElement(doc, { id, x: element.x, y: element.y, width: element.width, height });
  };
}

// ——— Document ———

export function loadDocument(doc: CreativeDocument): void {
  nudging = false;
  store().load(doc);
  useEditorStore.setState({ selectedIds: [], editingTextId: null, fitToScreen: true });
}

/** Titre du document (métadonnée enregistrée avec lui) : une action annulable. */
export function renameDocument(title: string): CommandError | null {
  return run("Renommer le document", [(doc) => renameDocumentCommand(doc, { title })]);
}

export function undo(): void {
  store().undo();
  pruneSelection();
}

export function redo(): void {
  store().redo();
  pruneSelection();
}

// ——— Sélection ———

/** Sélection d'éléments existants ; les identifiants inconnus sont ignorés. */
export function setSelection(ids: readonly Id[]): void {
  const existing = new Set(currentDocument().elements.map((e) => e.id));
  useEditorStore.getState().setSelection([...new Set(ids)].filter((id) => existing.has(id)));
}

export function selectElement(id: Id | null): void {
  setSelection(id === null ? [] : [id]);
}

/** Ajoute l'élément à la sélection, ou l'en retire s'il y est déjà (Maj ou Ctrl + clic). */
export function toggleInSelection(id: Id): void {
  const ids = selection();
  setSelection(ids.includes(id) ? ids.filter((s) => s !== id) : [...ids, id]);
}

/** Tous les éléments visibles et non verrouillés. */
export function selectAll(): void {
  setSelection(
    currentDocument()
      .elements.filter((e) => !e.locked && !e.hidden)
      .map((e) => e.id),
  );
}

// ——— Géométrie ———

export function moveElementTo(id: Id, x: number, y: number): CommandError | null {
  return run("Déplacer", [(doc) => moveElement(doc, { id, x, y })]);
}

/** Éléments sélectionnés qui peuvent bouger (les verrouillés restent en place). */
function movableSelection() {
  const ids = new Set(selection());
  return currentDocument().elements.filter((e) => ids.has(e.id) && !e.locked);
}

/** Aligne la sélection : sur la page pour un élément seul, entre eux sinon (une action). */
export function alignSelection(alignment: Alignment): CommandError | null {
  const moves = alignMoves(movableSelection(), alignment, currentDocument().page);
  if (moves.length === 0) return null;
  return run("Aligner", moves.map(({ id, x, y }) => (doc: CreativeDocument) => moveElement(doc, { id, x, y })));
}

/** Répartit la sélection (3 éléments au moins) à espaces égaux (une action). */
export function distributeSelection(axis: "horizontal" | "vertical"): CommandError | null {
  const moves = distributeMoves(movableSelection(), axis);
  if (moves.length === 0) return null;
  return run("Répartir", moves.map(({ id, x, y }) => (doc: CreativeDocument) => moveElement(doc, { id, x, y })));
}

/** Fin d'un glisser de plusieurs éléments : une seule action. */
export function moveElements(moves: readonly { id: Id; x: number; y: number }[]): CommandError | null {
  return run(
    "Déplacer",
    moves.map(
      ({ id, x, y }) =>
        (doc: CreativeDocument) =>
          moveElement(doc, { id, x, y }),
    ),
  );
}

/**
 * Fin d'une transformation par les poignées (un ou plusieurs éléments) : une seule action.
 * `fontSize` : nouvelle taille de police d'un texte agrandi avec un groupe (il garde ses retours à la ligne).
 */
export function transformElements(
  changes: readonly { id: Id; geometry: ElementGeometry; fontSize?: number }[],
): CommandError | null {
  return run(
    "Transformer",
    changes.flatMap(({ id, geometry, fontSize }) => [
      (doc: CreativeDocument) => resizeElement(doc, { id, ...geometry }),
      (doc: CreativeDocument) => rotateElement(doc, { id, rotation: geometry.rotation }),
      ...(fontSize === undefined
        ? []
        : [(doc: CreativeDocument) => updateElement(doc, { id, patch: { style: { fontSize } } })]),
      remeasure(id),
    ]),
  );
}

export function transformElement(id: Id, geometry: ElementGeometry): CommandError | null {
  return transformElements([{ id, geometry }]);
}

/** Valeur saisie dans le panneau : position, taille ou rotation d'un élément. */
export function setGeometry(
  id: Id,
  field: "x" | "y" | "width" | "height" | "rotation",
  value: number,
): CommandError | null {
  const element = findElement(id);
  if (!element) return null;
  if (field === "rotation")
    return run("Faire pivoter", [(doc) => rotateElement(doc, { id, rotation: value })]);
  if (field === "x" || field === "y") {
    return run("Déplacer", [(doc) => moveElement(doc, { id, x: element.x, y: element.y, [field]: value })]);
  }
  const box = {
    id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    [field]: value,
  };
  return run("Redimensionner", [(doc) => resizeElement(doc, box), remeasure(id)]);
}

// Flèches : un appui long (répétition du clavier) forme un seul déplacement dans l'historique.
// La transaction s'ouvre au premier appui et se valide au relâchement (endNudge).

export function nudgeSelection(dx: number, dy: number): CommandError | null {
  const ids = selection();
  const moves = currentDocument()
    .elements.filter((e) => ids.includes(e.id) && !e.locked)
    .map((e) => (doc: CreativeDocument) => moveElement(doc, { id: e.id, x: e.x + dx, y: e.y + dy }));
  if (moves.length === 0) return null;
  // Nouvelle transaction au premier appui, ou si une autre action (annuler…) a validé la précédente.
  if (!nudging || !store().history.transaction) {
    // Une autre transaction (curseur du panneau) est d'abord validée : les deux gestes restent distincts.
    store().commitTransaction();
    store().beginTransaction("Déplacer");
    nudging = true;
  }
  return store().preview(moves);
}

/** Relâchement de la flèche (ou perte du focus de la fenêtre) : le déplacement entre dans l'historique. */
export function endNudge(): void {
  if (!nudging) return;
  nudging = false;
  store().commitTransaction();
}

// ——— Propriétés ———

/**
 * Modification identique pour tous les éléments, ou calculée pour chacun (changer la couleur d'un contour
 * sans toucher à son épaisseur, propre à chaque élément).
 */
export type PatchFor = ElementPatch | ((element: Element) => ElementPatch);

function patchCommands(ids: readonly Id[], patch: PatchFor): DocumentCommand[] {
  return ids.flatMap((id) => [
    (doc: CreativeDocument) => {
      const element = doc.elements.find((e) => e.id === id);
      if (!element) return updateElement(doc, { id, patch: {} });
      return updateElement(doc, { id, patch: typeof patch === "function" ? patch(element) : patch });
    },
    remeasure(id),
  ]);
}

/** Modifie l'apparence ou le contenu d'éléments (une action) ; la hauteur des textes est recalculée. */
export function updateElements(ids: readonly Id[], patch: PatchFor, label = "Modifier"): CommandError | null {
  return run(label, patchCommands(ids, patch));
}

/** Style de texte : la police demandée est chargée d'abord, pour que la hauteur soit mesurée avec elle. */
export async function updateTextStyle(
  ids: readonly Id[],
  style: Partial<TextStyle>,
  label = "Modifier le texte",
): Promise<CommandError | null> {
  if ("fontFamily" in style || "fontWeight" in style || "fontStyle" in style) {
    const texts = currentDocument().elements.filter(
      (e): e is TextElement => e.type === "text" && ids.includes(e.id),
    );
    await Promise.all(texts.map((e) => prepareFont({ ...e.style, ...style })));
  }
  return updateElements(ids, { style } satisfies TextPatch, label);
}

/**
 * Plus grande taille de police pour laquelle le texte tient dans la largeur de sa boîte, sans autre retour à
 * la ligne que les siens (prénoms, titres). Recherche dichotomique sur la mesure du moteur de rendu.
 */
export function fittedFontSize(element: TextElement, min = 8, max = 400): number {
  const lines = element.content.split("\n").length;
  const fits = (fontSize: number) => {
    const style = { ...element.style, fontSize };
    return measuredTextHeight({ ...element, style }) <= lines * fontSize * style.lineHeight * 1.05;
  };
  let [lo, hi] = [min, Math.min(max, LIMITS.fontSize.max)];
  if (!fits(lo)) return lo;
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}

/** Ajuste la taille du texte à la largeur de sa boîte (une action). */
export async function fitTextToWidth(id: Id): Promise<CommandError | null> {
  const element = findElement(id);
  if (element?.type !== "text") return null;
  await prepareFont(element.style);
  return updateTextStyle([id], { fontSize: fittedFontSize(element) }, "Ajuster la taille");
}

// Modification continue depuis le panneau (curseur d'opacité, sélecteur de couleur) : aperçu en direct,
// une seule entrée d'historique à la fin. cancelLiveEdit revient à la valeur de départ.

export function previewElements(
  ids: readonly Id[],
  patch: PatchFor,
  label = "Modifier",
): CommandError | null {
  store().beginTransaction(label);
  return store().preview(patchCommands(ids, patch));
}

export function commitLiveEdit(): void {
  store().commitTransaction();
}

export function cancelLiveEdit(): void {
  store().cancelTransaction();
}

// ——— Sélection : actions groupées ———

export function deleteSelection(): CommandError | null {
  const ids = selection();
  const removable = currentDocument().elements.filter((e) => ids.includes(e.id) && !e.locked);
  if (removable.length === 0) return null;
  const label = removable.length > 1 ? `Supprimer ${removable.length} éléments` : "Supprimer";
  return run(
    label,
    removable.map((e) => (doc: CreativeDocument) => removeElement(doc, { id: e.id })),
  );
}

/** Copie chaque élément sélectionné juste au-dessus de son original, puis sélectionne les copies. */
export function duplicateSelection(): CommandError | null {
  const ids = selection();
  const sources = currentDocument().elements.filter((e) => ids.includes(e.id));
  if (sources.length === 0) return null;
  const copies = sources.map((e) => ({ id: e.id, newId: createId() }));
  const error = run(
    sources.length > 1 ? `Dupliquer ${sources.length} éléments` : "Dupliquer",
    copies.map((copy) => (doc: CreativeDocument) => duplicateElement(doc, copy)),
  );
  if (!error) setSelection(copies.map((c) => c.newId));
  return error;
}

export function reorderSelection(to: ReorderTarget): CommandError | null {
  const ids = selection();
  if (ids.length === 0) return null;
  return run("Changer l'ordre", [(doc) => reorderElements(doc, { ids, to })]);
}

// ——— Ajout ———

function addAndSelect(label: string, element: Element): CommandError | null {
  const error = run(label, [(doc) => addElement(doc, { element }), remeasure(element.id)]);
  if (!error) setSelection([element.id]);
  return error;
}

/** Bloc de texte centré, à une taille proportionnée à la page. */
export function addText(): CommandError | null {
  const { width, height } = currentDocument().page;
  const fontSize = Math.round(Math.min(width, height) * 0.06);
  const boxWidth = Math.round(width * 0.6);
  const boxHeight = Math.round(fontSize * 1.2);
  return addAndSelect(
    "Ajouter un texte",
    createTextElement({
      x: Math.round((width - boxWidth) / 2),
      y: Math.round((height - boxHeight) / 2),
      width: boxWidth,
      height: boxHeight,
      content: "Votre texte",
      style: { fontSize },
    }),
  );
}

export function addShape(shape: ShapeElement["shape"]): CommandError | null {
  const { width, height } = currentDocument().page;
  const size = Math.round(Math.min(width, height) * 0.3);
  const boxHeight = shape === "line" ? 0 : size;
  return addAndSelect(
    { rect: "Ajouter un rectangle", ellipse: "Ajouter une ellipse", line: "Ajouter une ligne" }[shape],
    createShapeElement({
      shape,
      x: Math.round((width - size) / 2),
      y: Math.round((height - boxHeight) / 2),
      width: size,
      height: boxHeight,
      ...(shape === "line"
        ? { stroke: { color: "#0B0B0B", width: Math.max(2, Math.round(size / 100)), style: "solid" } }
        : {}),
    }),
  );
}

/**
 * Image centrée sur la page, aux proportions du fichier (une seule action annulable). Une image dont le fichier
 * est déjà utilisé par le document réutilise sa ressource au lieu de la déclarer deux fois.
 */
export function addImage(
  asset: ImageAsset,
  name?: string,
  /**
   * « background » : l'image couvre toute la page, sous les autres éléments (visuel de fond d'une carte).
   * « card » : comme « background », et les éléments existants sont masqués (pas supprimés) : l'image est la carte.
   */
  placement: ImagePlacement = "centered",
): CommandError | null {
  const doc = currentDocument();
  const existing = Object.entries(doc.assets).find(
    ([, a]) => a.source.type === asset.source.type && a.source.key === asset.source.key,
  )?.[0];
  const assetId = existing ?? createId();
  const background = placement !== "centered";
  const geometry = background
    ? { x: 0, y: 0, width: doc.page.width, height: doc.page.height }
    : placeImage(asset, doc.page);
  // En fond, « cover » remplit la page quelles que soient les proportions de l'image (l'excédent est rogné).
  const element = createImageElement({ ...geometry, name, assetId, fit: "cover" });
  const commands: DocumentCommand[] = existing ? [] : [(d) => addAsset(d, { id: assetId, asset })];
  if (placement === "card")
    for (const existing of doc.elements)
      if (!existing.hidden)
        commands.push((d) => updateElement(d, { id: existing.id, patch: { hidden: true } }));
  commands.push((d) => addElement(d, background ? { element, index: 0 } : { element }));
  const label = {
    centered: "Ajouter une image",
    background: "Ajouter un fond",
    card: "Utiliser la carte générée",
  }[placement];
  const error = run(label, commands);
  if (!error) setSelection([element.id]);
  return error;
}

// ——— Texte ———

/** Nouveau contenu d'un texte (édition directe ou panneau) : une action, hauteur recalculée. */
export function setTextContent(id: Id, content: string): CommandError | null {
  const element = findElement(id);
  if (element?.type !== "text" || element.content === content) return null;
  return updateElements([id], { content } satisfies TextPatch, "Modifier le texte");
}

/** Double-clic ou Entrée sur un texte : édition directe sur la page (le texte est sélectionné seul). */
export function startTextEditing(id: Id): void {
  const element = findElement(id);
  if (element?.type !== "text" || element.locked) return;
  store().commitTransaction();
  setSelection([id]);
  useEditorStore.getState().setEditingText(id);
}

/**
 * Fin de l'édition directe. Un texte vidé est supprimé (un bloc vide serait invisible et introuvable) ;
 * l'annulation le rétablit avec son contenu d'avant.
 */
export function finishTextEditing(content: string): CommandError | null {
  const id = useEditorStore.getState().editingTextId;
  if (!id) return null;
  useEditorStore.getState().setEditingText(null);
  if (content.trim() === "") return run("Supprimer le texte vide", [(doc) => removeElement(doc, { id })]);
  return setTextContent(id, content);
}
