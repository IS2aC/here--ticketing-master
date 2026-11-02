import { describe, expect, it } from "vitest";
import { fixtureDocument } from "../../test/documentFixtures.ts";
import { createShapeElement, createTextElement } from "../document/factories.ts";
import type { CreativeDocument } from "../document/types.ts";
import { validateDocument } from "../schema/validate.ts";
import {
  addElement,
  duplicateElement,
  moveElement,
  removeElement,
  reorderElement,
  reorderElements,
  resizeElement,
  rotateElement,
  updateElement,
} from "./elementCommands.ts";
import type { CommandResult } from "./result.ts";

// Exemple 04 : [0] image, [1] titre, [2] date.
const IMAGE = "e0000000-0000-4000-8000-000000000001";
const TITLE = "e0000000-0000-4000-8000-000000000002";
const DATE = "e0000000-0000-4000-8000-000000000003";
const MISSING = "e0000000-0000-4000-8000-000000000099";
const NEW_ID = "f0000000-0000-4000-8000-000000000001";

function base(): CreativeDocument {
  return fixtureDocument("04-avec-image.json");
}

/** Document produit par une commande réussie ; il doit rester valide. */
function done(result: CommandResult): CreativeDocument {
  if (!result.ok) throw new Error(`Échec inattendu : ${JSON.stringify(result.error)}`);
  expect(validateDocument(result.document)).toEqual([]);
  return result.document;
}

function errorCode(result: CommandResult): string {
  if (result.ok) throw new Error("Échec attendu");
  return result.error.code;
}

const ids = (doc: CreativeDocument) => doc.elements.map((e) => e.id);

describe("immuabilité et partage structurel", () => {
  it("ne modifie jamais le document d'entrée, et ne recrée que l'élément touché", () => {
    const before = base();
    const snapshot = structuredClone(before);

    const after = done(moveElement(before, { id: TITLE, x: 10, y: 20 }));

    expect(before).toEqual(snapshot);
    expect(after.elements[0]).toBe(before.elements[0]);
    expect(after.elements[2]).toBe(before.elements[2]);
    expect(after.elements[1]).not.toBe(before.elements[1]);
    expect(after.assets).toBe(before.assets);
  });

  it("laisse le document intact quand une commande échoue", () => {
    const before = base();
    const snapshot = structuredClone(before);

    expect(errorCode(moveElement(before, { id: TITLE, x: Number.NaN, y: 0 }))).toBe("invalid_value");
    expect(before).toEqual(snapshot);
  });
});

describe("addElement", () => {
  const text = createTextElement({ id: NEW_ID, x: 0, y: 0, width: 300, height: 40, content: "RSVP" });

  it("ajoute au premier plan par défaut", () => {
    expect(ids(done(addElement(base(), { element: text })))).toEqual([IMAGE, TITLE, DATE, NEW_ID]);
  });

  it("insère à la position demandée", () => {
    expect(ids(done(addElement(base(), { element: text, index: 0 })))).toEqual([NEW_ID, IMAGE, TITLE, DATE]);
  });

  it("refuse un identifiant déjà utilisé", () => {
    expect(errorCode(addElement(base(), { element: { ...text, id: TITLE } }))).toBe("duplicate_id");
  });

  it("refuse une image sans ressource déclarée", () => {
    const doc = base();
    const image = doc.elements[0];
    if (image?.type !== "image") throw new Error("exemple inattendu");
    const element = { ...image, id: NEW_ID, assetId: MISSING };
    expect(errorCode(addElement(doc, { element }))).toBe("asset_not_found");
  });

  it("refuse un élément invalide et détaille pourquoi", () => {
    const result = addElement(base(), { element: { ...text, width: -5 } });
    expect(!result.ok && result.error).toMatchObject({ code: "invalid_value", issues: [{ path: "width" }] });
  });

  it("refuse une position d'insertion hors limites", () => {
    expect(errorCode(addElement(base(), { element: text, index: 9 }))).toBe("invalid_value");
  });
});

describe("removeElement", () => {
  it("supprime l'élément et garde l'ordre des autres", () => {
    expect(ids(done(removeElement(base(), { id: TITLE })))).toEqual([IMAGE, DATE]);
  });

  it("signale un identifiant inconnu", () => {
    expect(errorCode(removeElement(base(), { id: MISSING }))).toBe("element_not_found");
  });
});

describe("géométrie", () => {
  it("déplace en conservant l'identifiant, arrondi à 0,01 px", () => {
    const element = done(moveElement(base(), { id: TITLE, x: 10.123456, y: -20.006 })).elements[1];
    expect(element).toMatchObject({ id: TITLE, x: 10.12, y: -20.01 });
  });

  it("redimensionne avec une nouvelle boîte complète", () => {
    const element = done(resizeElement(base(), { id: IMAGE, x: 100, y: 100, width: 400.004, height: 300 }))
      .elements[0];
    expect(element).toMatchObject({ x: 100, y: 100, width: 400, height: 300 });
  });

  it("refuse une taille nulle", () => {
    expect(errorCode(resizeElement(base(), { id: IMAGE, x: 0, y: 0, width: 0, height: 10 }))).toBe(
      "invalid_value",
    );
  });

  it.each([
    [450, 90],
    [-30, 330],
    [360, 0],
    [359.999, 0],
  ])("ramène une rotation de %s° à %s°", (input, expected) => {
    expect(done(rotateElement(base(), { id: TITLE, rotation: input })).elements[1]?.rotation).toBe(expected);
  });

  it("garde une ligne à hauteur nulle", () => {
    const doc = fixtureDocument("05-formes-decoratives.json");
    const line = "e0000000-0000-4000-8000-000000000003";
    expect(
      done(resizeElement(doc, { id: line, x: 0, y: 0, width: 300, height: 0 })).elements[2]?.height,
    ).toBe(0);
    expect(errorCode(resizeElement(doc, { id: line, x: 0, y: 0, width: 300, height: 20 }))).toBe(
      "invalid_value",
    );
  });

  it("aucune dérive après 100 déplacements aller-retour", () => {
    let doc = base();
    for (let i = 0; i < 100; i++) {
      doc = done(moveElement(doc, { id: TITLE, x: (doc.elements[1]?.x ?? 0) + 0.1, y: 0 }));
      doc = done(moveElement(doc, { id: TITLE, x: (doc.elements[1]?.x ?? 0) - 0.1, y: 0 }));
    }
    expect(doc.elements[1]?.x).toBe(base().elements[1]?.x);
  });
});

describe("éléments verrouillés", () => {
  const locked = () => done(updateElement(base(), { id: TITLE, patch: { locked: true } }));

  it.each([
    ["déplacer", (doc: CreativeDocument) => moveElement(doc, { id: TITLE, x: 0, y: 0 })],
    [
      "redimensionner",
      (doc: CreativeDocument) => resizeElement(doc, { id: TITLE, x: 0, y: 0, width: 10, height: 10 }),
    ],
    ["tourner", (doc: CreativeDocument) => rotateElement(doc, { id: TITLE, rotation: 10 })],
    ["supprimer", (doc: CreativeDocument) => removeElement(doc, { id: TITLE })],
  ])("refusent qu'on les %s", (_, command) => {
    expect(errorCode(command(locked()))).toBe("element_locked");
  });

  it("peuvent être déverrouillés", () => {
    expect(done(updateElement(locked(), { id: TITLE, patch: { locked: false } })).elements[1]?.locked).toBe(
      false,
    );
  });
});

describe("updateElement", () => {
  it("fusionne le style d'un texte propriété par propriété", () => {
    const element = done(
      updateElement(base(), { id: TITLE, patch: { content: "Nathan", style: { fontSize: 80 } } }),
    ).elements[1];
    expect(element).toMatchObject({ id: TITLE, content: "Nathan", style: { fontSize: 80, fontWeight: 600 } });
  });

  it("refuse les propriétés géométriques et l'identité (commandes dédiées)", () => {
    const patch = { x: 5, id: NEW_ID } as unknown as { content: string };
    const result = updateElement(base(), { id: TITLE, patch });
    expect(!result.ok && result.error.code).toBe("not_applicable");
    expect(!result.ok && result.error.message).toContain("id, x");
  });

  it("refuse une propriété étrangère au type d'élément", () => {
    const result = updateElement(base(), { id: IMAGE, patch: { content: "texte" } });
    expect(!result.ok && result.error.code).toBe("invalid_value");
  });

  it("refuse de pointer une image vers une ressource absente", () => {
    expect(errorCode(updateElement(base(), { id: IMAGE, patch: { assetId: MISSING } }))).toBe(
      "asset_not_found",
    );
  });

  it("refuse une valeur hors limites", () => {
    expect(errorCode(updateElement(base(), { id: TITLE, patch: { opacity: 2 } }))).toBe("invalid_value");
  });
});

describe("duplicateElement", () => {
  it("crée une copie décalée, juste au-dessus, avec le nouvel identifiant", () => {
    const doc = done(duplicateElement(base(), { id: TITLE, newId: NEW_ID }));
    const [original, copy] = [doc.elements[1], doc.elements[2]];

    expect(ids(doc)).toEqual([IMAGE, TITLE, NEW_ID, DATE]);
    expect(copy).toEqual({ ...original, id: NEW_ID, x: (original?.x ?? 0) + 16, y: (original?.y ?? 0) + 16 });
  });

  it("refuse un nouvel identifiant déjà pris", () => {
    expect(errorCode(duplicateElement(base(), { id: TITLE, newId: DATE }))).toBe("duplicate_id");
  });

  it("ne recopie pas le champ invité : la copie est un élément ordinaire", () => {
    const doc = base();
    const named = {
      ...doc,
      elements: doc.elements.map((e) => (e.id === TITLE ? { ...e, slot: "guest-name" as const } : e)),
    };
    const copied = done(duplicateElement(named, { id: TITLE, newId: NEW_ID }));

    expect(copied.elements[1]?.slot).toBe("guest-name");
    expect(copied.elements[2]).not.toHaveProperty("slot");
  });
});

describe("reorderElement", () => {
  it.each([
    ["forward", [IMAGE, DATE, TITLE]],
    ["backward", [TITLE, IMAGE, DATE]],
    ["front", [IMAGE, DATE, TITLE]],
    ["back", [TITLE, IMAGE, DATE]],
  ] as const)("%s", (to, expected) => {
    expect(ids(done(reorderElement(base(), { id: TITLE, to })))).toEqual(expected);
  });

  it("renvoie le même document quand l'élément est déjà en place", () => {
    const doc = base();
    const result = reorderElement(doc, { id: DATE, to: "front" });
    expect(result.ok && result.document).toBe(doc);
  });
});

describe("formes", () => {
  it("refuse des coins arrondis sur une ellipse", () => {
    const doc = done(
      addElement(base(), {
        element: createShapeElement({ id: NEW_ID, shape: "ellipse", x: 0, y: 0, width: 50, height: 50 }),
      }),
    );
    expect(errorCode(updateElement(doc, { id: NEW_ID, patch: { cornerRadius: 5 } }))).toBe("invalid_value");
  });
});

describe("reorderElements (plusieurs éléments)", () => {
  // Ordre : [A, B, C, D, E] du fond au premier plan.
  const ID = (n: number) => `e0000000-0000-4000-8000-0000000001${n.toString().padStart(2, "0")}`;
  const [A, B, C, D, E] = [1, 2, 3, 4, 5].map(ID) as [string, string, string, string, string];
  const doc = () =>
    done(
      [A, B, C, D, E].reduce<CommandResult>(
        (result, id) =>
          result.ok
            ? addElement(result.document, {
                element: createShapeElement({ id, shape: "rect", x: 0, y: 0, width: 10, height: 10 }),
              })
            : result,
        { ok: true, document: { ...base(), elements: [], assets: {} } },
      ),
    );

  it.each([
    ["forward", [B, D], [A, C, B, E, D]],
    ["backward", [B, D], [B, A, D, C, E]],
    ["front", [B, D], [A, C, E, B, D]],
    ["back", [B, D], [B, D, A, C, E]],
    ["forward", [D, E], [A, B, C, D, E]],
    ["forward", [C, E], [A, B, D, C, E]],
    ["backward", [A, B], [A, B, C, D, E]],
  ] as const)("%s %j", (to, selection, expected) => {
    expect(ids(done(reorderElements(doc(), { ids: selection, to })))).toEqual(expected);
  });

  it("renvoie le même document quand rien ne bouge", () => {
    const original = doc();
    const result = reorderElements(original, { ids: [D, E], to: "front" });
    expect(result.ok && result.document).toBe(original);
  });

  it("signale un identifiant inconnu", () => {
    expect(errorCode(reorderElements(doc(), { ids: [A, MISSING], to: "front" }))).toBe("element_not_found");
  });
});
