import { LIMITS, normalizeRotation, roundGeometry } from "../constraints.ts";
import type { CreativeDocument } from "../document/types.ts";
import type { Element, ImageElement, ShapeElement, TextElement, TextStyle } from "../elements/types.ts";
import type { Id } from "../ids.ts";
import { safeParseFr, toIssues } from "../schema/issues.ts";
import { elementSchema } from "../schema/schema.ts";
import { failure, success, type CommandResult } from "./result.ts";

// Commandes sur les éléments : fonctions pures (document, arguments) → résultat.
// Elles ne mutent jamais leur entrée : seuls le tableau `elements` et l'élément modifié sont recréés,
// les autres éléments gardent leur identité (partage structurel, utile au rendu et à l'historique).
// Chaque élément produit est revalidé par le même schéma que les données externes.

function indexOf(document: CreativeDocument, id: Id): number {
  return document.elements.findIndex((element) => element.id === id);
}

function notFound(id: Id): CommandResult {
  return failure("element_not_found", `Aucun élément ${id} dans le document`);
}

/** Valide un élément candidat ; renvoie l'élément validé ou l'échec à propager. */
function checkElement(
  candidate: unknown,
  document: CreativeDocument,
): { element: Element } | { error: CommandResult } {
  const parsed = safeParseFr(elementSchema, candidate);
  if (!parsed.success) {
    return {
      error: failure("invalid_value", "Valeurs invalides pour cet élément", toIssues(parsed.error.issues)),
    };
  }
  const element = parsed.data;
  if (element.type === "image" && !Object.hasOwn(document.assets, element.assetId)) {
    return { error: failure("asset_not_found", `Ressource introuvable : ${element.assetId}`) };
  }
  return { element };
}

function withElements(document: CreativeDocument, elements: readonly Element[]): CreativeDocument {
  return { ...document, elements };
}

function replaceAt(document: CreativeDocument, index: number, element: Element): CreativeDocument {
  return withElements(document, document.elements.with(index, element));
}

/** Applique une transformation à un élément existant non verrouillé, puis revalide. */
function transform(document: CreativeDocument, id: Id, change: (element: Element) => unknown): CommandResult {
  const index = indexOf(document, id);
  const element = document.elements[index];
  if (!element) return notFound(id);
  if (element.locked) return failure("element_locked", "Élément verrouillé : déverrouillez-le d'abord");
  const checked = checkElement(change(element), document);
  return "error" in checked ? checked.error : success(replaceAt(document, index, checked.element));
}

export function addElement(
  document: CreativeDocument,
  args: { element: Element; index?: number },
): CommandResult {
  const index = args.index ?? document.elements.length;
  if (!Number.isInteger(index) || index < 0 || index > document.elements.length) {
    return failure("invalid_value", `Position d'insertion hors limites : ${index}`);
  }
  if (document.elements.length >= LIMITS.elementCount.max) {
    return failure("not_applicable", `${LIMITS.elementCount.max} éléments au maximum`);
  }
  if (indexOf(document, args.element.id) !== -1) {
    return failure("duplicate_id", `Un élément ${args.element.id} existe déjà`);
  }
  const checked = checkElement(args.element, document);
  if ("error" in checked) return checked.error;
  return success(withElements(document, document.elements.toSpliced(index, 0, checked.element)));
}

export function removeElement(document: CreativeDocument, args: { id: Id }): CommandResult {
  const index = indexOf(document, args.id);
  const element = document.elements[index];
  if (!element) return notFound(args.id);
  if (element.locked) return failure("element_locked", "Élément verrouillé : déverrouillez-le d'abord");
  return success(withElements(document, document.elements.toSpliced(index, 1)));
}

/** Position absolue du coin supérieur gauche de la boîte non tournée, arrondie à 0,01 px. */
export function moveElement(
  document: CreativeDocument,
  args: { id: Id; x: number; y: number },
): CommandResult {
  return transform(document, args.id, (element) => ({
    ...element,
    x: roundGeometry(args.x),
    y: roundGeometry(args.y),
  }));
}

/** Nouvelle boîte complète : le point d'ancrage (coin ou bord opposé) est calculé par l'appelant. */
export function resizeElement(
  document: CreativeDocument,
  args: { id: Id; x: number; y: number; width: number; height: number },
): CommandResult {
  return transform(document, args.id, (element) => ({
    ...element,
    x: roundGeometry(args.x),
    y: roundGeometry(args.y),
    width: roundGeometry(args.width),
    height: roundGeometry(args.height),
  }));
}

/** Rotation absolue en degrés ; toute valeur finie est ramenée dans [0, 360). */
export function rotateElement(document: CreativeDocument, args: { id: Id; rotation: number }): CommandResult {
  if (!Number.isFinite(args.rotation)) return failure("invalid_value", "Rotation : nombre fini attendu");
  return transform(document, args.id, (element) => ({
    ...element,
    rotation: normalizeRotation(args.rotation),
  }));
}

/** Propriétés modifiables par updateElement : tout sauf l'identité et la géométrie (commandes dédiées). */
type GeometryKeys = "x" | "y" | "width" | "height" | "rotation";
type Editable<T extends Element> = Omit<T, "id" | "type" | GeometryKeys>;
export type TextPatch = Partial<Omit<Editable<TextElement>, "style">> & {
  readonly style?: Partial<TextStyle>;
};
export type ImagePatch = Partial<Editable<ImageElement>>;
export type ShapePatch = Partial<Editable<ShapeElement>>;
export type ElementPatch = TextPatch | ImagePatch | ShapePatch;

const FORBIDDEN_PATCH_KEYS = ["id", "type", "x", "y", "width", "height", "rotation"] as const;

/**
 * Modifie l'apparence ou le contenu d'un élément. Le style d'un texte est fusionné propriété par propriété ;
 * les autres valeurs sont remplacées. Une propriété qui n'appartient pas au type de l'élément est refusée.
 * Autorisé sur un élément verrouillé (c'est ainsi qu'on le déverrouille).
 */
export function updateElement(
  document: CreativeDocument,
  args: { id: Id; patch: ElementPatch },
): CommandResult {
  const index = indexOf(document, args.id);
  const element = document.elements[index];
  if (!element) return notFound(args.id);

  const forbidden = FORBIDDEN_PATCH_KEYS.filter((key) => Object.hasOwn(args.patch, key));
  if (forbidden.length > 0) {
    return failure(
      "not_applicable",
      `Propriétés non modifiables par cette commande : ${forbidden.join(", ")}`,
    );
  }

  const merged: Record<string, unknown> = { ...element, ...args.patch };
  if (element.type === "text" && "style" in args.patch && args.patch.style) {
    merged.style = { ...element.style, ...args.patch.style };
  }
  const checked = checkElement(merged, document);
  return "error" in checked ? checked.error : success(replaceAt(document, index, checked.element));
}

/**
 * Copie juste au-dessus de l'original, décalée ; l'identifiant de la copie est fourni par l'appelant.
 * La copie d'un champ invité est un élément ordinaire : chaque champ n'existe qu'une fois.
 */
export function duplicateElement(
  document: CreativeDocument,
  args: { id: Id; newId: Id; offset?: number },
): CommandResult {
  const index = indexOf(document, args.id);
  const original = document.elements[index];
  if (!original) return notFound(args.id);
  const element = { ...original };
  delete element.slot;
  const offset = args.offset ?? 16;
  return addElement(document, {
    element: {
      ...element,
      id: args.newId,
      x: roundGeometry(element.x + offset),
      y: roundGeometry(element.y + offset),
    },
    index: index + 1,
  });
}

export type ReorderTarget = "forward" | "backward" | "front" | "back";

/** Change l'ordre d'affichage. Déjà en place : succès sans changement (même document). */
export function reorderElement(
  document: CreativeDocument,
  args: { id: Id; to: ReorderTarget },
): CommandResult {
  const from = indexOf(document, args.id);
  const element = document.elements[from];
  if (!element) return notFound(args.id);

  const last = document.elements.length - 1;
  const target = { forward: Math.min(from + 1, last), backward: Math.max(from - 1, 0), front: last, back: 0 }[
    args.to
  ];
  if (target === from) return success(document);
  return success(withElements(document, document.elements.toSpliced(from, 1).toSpliced(target, 0, element)));
}

/**
 * Change l'ordre d'affichage de plusieurs éléments à la fois, en conservant leur ordre relatif.
 * forward / backward : chaque élément passe au-dessus (au-dessous) du premier voisin non sélectionné ;
 * un bloc déjà en haut (en bas) ne bouge pas. front / back : tout le groupe au premier plan (à l'arrière-plan).
 * Rien à changer : succès sans changement (même document).
 */
export function reorderElements(
  document: CreativeDocument,
  args: { ids: readonly Id[]; to: ReorderTarget },
): CommandResult {
  const selected = new Set(args.ids);
  const missing = args.ids.find((id) => indexOf(document, id) === -1);
  if (missing) return notFound(missing);

  const order = [...document.elements];
  const isSelected = (index: number) => {
    const element = order[index];
    return element !== undefined && selected.has(element.id);
  };
  const swap = (a: number, b: number) => {
    const first = order[a];
    const second = order[b];
    if (first && second) [order[a], order[b]] = [second, first];
  };

  switch (args.to) {
    case "forward":
      for (let i = order.length - 2; i >= 0; i--) if (isSelected(i) && !isSelected(i + 1)) swap(i, i + 1);
      break;
    case "backward":
      for (let i = 1; i < order.length; i++) if (isSelected(i) && !isSelected(i - 1)) swap(i, i - 1);
      break;
    case "front":
    case "back": {
      const moved = order.filter((e) => selected.has(e.id));
      const others = order.filter((e) => !selected.has(e.id));
      order.splice(0, order.length, ...(args.to === "front" ? [...others, ...moved] : [...moved, ...others]));
      break;
    }
  }

  const unchanged = order.every((element, index) => element === document.elements[index]);
  return success(unchanged ? document : withElements(document, order));
}
