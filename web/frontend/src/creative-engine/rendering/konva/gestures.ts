import type Konva from "konva";
import type { Element } from "../../domain/elements/types.ts";
import type { Id } from "../../domain/ids.ts";
import { moveElements, transformElements } from "../../editor/actions.ts";
import { currentDocument } from "../../editor/documentStore.ts";
import { geometryFromTransform, placementOf, positionFromCenter } from "./geometry.ts";

// Fins de gestes sur la page → une seule action métier par geste, même quand plusieurs éléments bougent.
// État transitoire : la file des nœuds dont le glisser vient de finir. Elle est vidée à la fin de la tâche.

function elementOf(id: Id): Element | undefined {
  return currentDocument().elements.find((e) => e.id === id);
}

/** Remet un nœud dans l'état décrit par le document (geste refusé par une commande). */
export function resetNode(group: Konva.Group, element: Element): void {
  group.setAttrs({ ...placementOf(element), scaleX: 1, scaleY: 1 });
  const text = group.findOne<Konva.Text>("Text");
  if (element.type === "text" && text) text.setAttrs({ width: element.width, x: -element.width / 2 });
}

const endedDrags = new Map<Id, Konva.Group>();

/**
 * Quand plusieurs éléments sont sélectionnés, Konva déplace tous les nœuds du cadre de sélection et chacun
 * signale sa fin de glisser, l'un après l'autre, dans le même événement. On les réunit en une seule action.
 */
export function dragEnded(id: Id, group: Konva.Group): void {
  if (endedDrags.size === 0) queueMicrotask(flushDrags);
  endedDrags.set(id, group);
}

function flushDrags(): void {
  const nodes = [...endedDrags];
  endedDrags.clear();
  const moves = nodes.flatMap(([id, group]) => {
    const element = elementOf(id);
    return element && !element.locked ? [{ id, ...positionFromCenter(group.position(), element) }] : [];
  });
  const rejected = moves.length > 0 && moveElements(moves) !== null;
  // Le cadre de sélection entraîne aussi les éléments verrouillés du groupe : ils reprennent leur place.
  for (const [id, group] of nodes) {
    const element = elementOf(id);
    if (element && (rejected || element.locked)) resetNode(group, element);
  }
}

/**
 * Changement métier d'un nœud transformé. Seul, un texte garde sa police et se remet en page (sa largeur a
 * absorbé l'échelle, voir reflowText). Dans un groupe, tout est agrandi d'un même facteur (coins, proportions
 * conservées) : la police du texte suit, ses retours à la ligne ne changent pas.
 */
function changeOf(group: Konva.Group, element: Element, inGroup: boolean) {
  const node = {
    ...group.position(),
    rotation: group.rotation(),
    scaleX: group.scaleX(),
    scaleY: group.scaleY(),
  };
  const text = group.findOne<Konva.Text>("Text");
  if (element.type !== "text" || !text)
    return { id: element.id, geometry: geometryFromTransform(node, element) };
  if (inGroup) {
    const scale = Math.abs(group.scaleX());
    return {
      id: element.id,
      geometry: geometryFromTransform(node, element),
      fontSize: Math.round(element.style.fontSize * scale * 100) / 100,
    };
  }
  const scaleX = (text.width() * Math.abs(group.scaleX())) / element.width;
  return { id: element.id, geometry: geometryFromTransform({ ...node, scaleX, scaleY: 1 }, element) };
}

/** Fin d'une transformation par les poignées : tous les nœuds du cadre, une seule action. */
export function transformEnded(groups: readonly Konva.Group[]): void {
  const nodes = groups.flatMap((group) => {
    const element = elementOf(group.id());
    return element ? [{ group, element }] : [];
  });
  const changes = nodes.map(({ group, element }) => changeOf(group, element, nodes.length > 1));
  for (const { group } of nodes) group.scale({ x: 1, y: 1 });
  if (transformElements(changes)) {
    for (const { group, element } of nodes) resetNode(group, element);
  }
}

/** Pendant la transformation d'un seul texte : il se remet en page au lieu d'être étiré. */
export function reflowText(group: Konva.Group): void {
  const text = group.findOne<Konva.Text>("Text");
  if (!text) return;
  const width = Math.max(1, text.width() * Math.abs(group.scaleX()));
  text.setAttrs({ width, x: -width / 2 });
  group.scale({ x: 1, y: 1 });
}
