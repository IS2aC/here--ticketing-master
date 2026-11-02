import { describe, expect, it } from "vitest";
import { fixtureDocument } from "../../test/documentFixtures.ts";
import { moveElement, reorderElement, rotateElement } from "../commands/elementCommands.ts";
import type { CreativeDocument } from "../document/types.ts";
import {
  apply,
  beginTransaction,
  cancelTransaction,
  canRedo,
  canUndo,
  commitTransaction,
  createHistory,
  preview,
  record,
  redo,
  undo,
  type History,
} from "./history.ts";

const TITLE = "e0000000-0000-4000-8000-000000000002";

function start(limit?: number): History {
  return createHistory(fixtureDocument("04-avec-image.json"), limit);
}

function move(history: History, x: number): History {
  return apply(history, "Déplacer", moveElement(history.present, { id: TITLE, x, y: 0 })).history;
}

const titleX = (doc: CreativeDocument) => doc.elements[1]?.x;

describe("annuler et rétablir", () => {
  it("annule puis rétablit une modification", () => {
    const initial = start();
    const moved = move(initial, 10);

    const undone = undo(moved);
    expect(undone.present).toBe(initial.present);
    expect(canRedo(undone)).toBe(true);

    const redone = redo(undone);
    expect(redone.present).toBe(moved.present);
    expect(canRedo(redone)).toBe(false);
  });

  it("parcourt plusieurs étapes dans les deux sens", () => {
    let history = start();
    for (const x of [10, 20, 30]) history = move(history, x);

    history = undo(undo(history));
    expect(titleX(history.present)).toBe(10);
    history = redo(history);
    expect(titleX(history.present)).toBe(20);
  });

  it("une nouvelle action après une annulation efface ce qui pouvait être rétabli", () => {
    const history = move(undo(move(move(start(), 10), 20)), 99);

    expect(titleX(history.present)).toBe(99);
    expect(canRedo(history)).toBe(false);
    expect(titleX(undo(history).present)).toBe(10);
  });

  it("sans rien à annuler ou rétablir, ne change rien", () => {
    const history = start();
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it("conserve les libellés pour l'interface", () => {
    const history = apply(
      start(),
      "Faire pivoter",
      rotateElement(start().present, { id: TITLE, rotation: 15 }),
    ).history;
    expect(history.past.at(-1)?.label).toBe("Faire pivoter");
    expect(undo(history).future[0]?.label).toBe("Faire pivoter");
  });

  it("revient exactement à l'état initial après N actions et N annulations", () => {
    const initial = start();
    let history = initial;
    for (let i = 1; i <= 25; i++) history = move(history, i * 3.33);
    for (let i = 0; i < 25; i++) history = undo(history);
    expect(history.present).toBe(initial.present);
  });
});

describe("cohérence", () => {
  it("une commande en échec n'ajoute aucune entrée et renvoie l'erreur", () => {
    const history = start();
    const { history: after, error } = apply(
      history,
      "Déplacer",
      moveElement(history.present, { id: "inconnu", x: 0, y: 0 }),
    );

    expect(after).toBe(history);
    expect(error?.code).toBe("element_not_found");
  });

  it("une commande sans effet n'ajoute aucune entrée", () => {
    const history = start();
    const after = apply(
      history,
      "Premier plan",
      reorderElement(history.present, { id: "e0000000-0000-4000-8000-000000000003", to: "front" }),
    ).history;
    expect(after).toBe(history);
  });

  it("limite le nombre d'entrées en oubliant les plus anciennes", () => {
    let history = start(3);
    for (const x of [1, 2, 3, 4, 5]) history = move(history, x);

    expect(history.past).toHaveLength(3);
    expect(titleX(undo(undo(undo(history))).present)).toBe(2);
    expect(canUndo(undo(undo(undo(history))))).toBe(false);
  });

  it("refuse une limite invalide", () => {
    expect(() => createHistory(start().present, 0)).toThrow(RangeError);
  });
});

describe("transactions (gestes continus)", () => {
  it("enregistre une seule entrée pour toute une série d'aperçus", () => {
    let history = beginTransaction(start(), "Rotation");
    for (const rotation of [5, 10, 15, 20]) {
      history = preview(history, rotateElement(history.present, { id: TITLE, rotation }));
    }
    history = commitTransaction(history);

    expect(history.past).toHaveLength(1);
    expect(history.present.elements[1]?.rotation).toBe(20);
    expect(undo(history).present.elements[1]?.rotation).toBe(0);
  });

  it("annuler la transaction rétablit l'état de départ, sans entrée", () => {
    const initial = start();
    let history = beginTransaction(initial, "Rotation");
    history = preview(history, rotateElement(history.present, { id: TITLE, rotation: 45 }));
    history = cancelTransaction(history);

    expect(history.present).toBe(initial.present);
    expect(history.past).toHaveLength(0);
  });

  it("n'enregistre rien si le geste revient au point de départ", () => {
    const initial = start();
    const history = commitTransaction(beginTransaction(initial, "Rotation"));
    expect(history.past).toHaveLength(0);
  });

  it("bloque annuler, rétablir et les enregistrements directs pendant le geste", () => {
    const history = beginTransaction(move(start(), 10), "Rotation");

    expect(canUndo(history)).toBe(false);
    expect(undo(history)).toBe(history);
    expect(() => record(history, "Autre", start().present)).toThrow(/transaction/);
    expect(() => beginTransaction(history, "Encore")).toThrow(/déjà/);
  });

  it("ignore un aperçu en échec", () => {
    const history = beginTransaction(start(), "Rotation");
    expect(preview(history, rotateElement(history.present, { id: TITLE, rotation: Number.NaN }))).toBe(
      history,
    );
  });
});
