import { describe, expect, it } from "vitest";
import { fixtureDocument } from "../../test/documentFixtures.ts";
import { createImageElement } from "../document/factories.ts";
import type { CreativeDocument } from "../document/types.ts";
import { isId } from "../ids.ts";
import { validateDocument } from "../schema/validate.ts";
import { instantiateTemplate } from "./instantiate.ts";

const NOW = "2026-11-01T09:00:00.000Z";
const ORIGIN = { id: "mariage-elegance", version: 3 };

/** Modèle de test : l'exemple avec image, plus une seconde image qui partage la même ressource. */
function template(): CreativeDocument {
  const base = fixtureDocument("04-avec-image.json");
  const [assetId] = Object.keys(base.assets);
  if (!assetId) throw new Error("L'exemple doit contenir une image");
  return {
    ...base,
    elements: [
      ...base.elements,
      createImageElement({
        id: "e0000000-0000-4000-8000-0000000000ff",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        assetId,
      }),
    ],
  };
}

describe("instantiateTemplate", () => {
  it("produit un document valide, d'origine notée, aux dates du jour", () => {
    const document = instantiateTemplate(template(), { origin: ORIGIN, now: NOW });

    expect(validateDocument(document)).toEqual([]);
    expect(document.meta).toEqual({
      title: template().meta.title,
      createdAt: NOW,
      updatedAt: NOW,
      template: ORIGIN,
    });
  });

  it("régénère tous les identifiants : document, éléments, ressources", () => {
    const source = template();
    const document = instantiateTemplate(source, { origin: ORIGIN, now: NOW });

    const oldIds = new Set([source.id, ...source.elements.map((e) => e.id), ...Object.keys(source.assets)]);
    const newIds = [document.id, ...document.elements.map((e) => e.id), ...Object.keys(document.assets)];
    expect(newIds.every(isId)).toBe(true);
    expect(newIds.some((id) => oldIds.has(id))).toBe(false);
    expect(new Set(newIds).size).toBe(newIds.length);
  });

  it("garde les références des images vers leur ressource, et la même source de fichier", () => {
    const source = template();
    const document = instantiateTemplate(source, { origin: ORIGIN, now: NOW });

    const images = document.elements.filter((e) => e.type === "image");
    expect(images).toHaveLength(2);
    const [first, second] = images;
    // Les deux images partageaient une ressource : elles la partagent toujours, sous son nouvel identifiant.
    expect(first?.assetId).toBe(second?.assetId);
    const asset = first && document.assets[first.assetId];
    expect(asset?.source).toEqual(Object.values(source.assets)[0]?.source);
  });

  it("conserve le contenu, l'ordre et les propriétés des éléments, la page et le fond", () => {
    const source = template();
    const document = instantiateTemplate(source, { origin: ORIGIN, now: NOW });

    expect(document.page).toEqual(source.page);
    // Tout sauf les identifiants, qui changent par construction.
    const strip = (doc: CreativeDocument) =>
      doc.elements.map((element) => ({
        ...element,
        id: "—",
        ...(element.type === "image" ? { assetId: "—" } : {}),
      }));
    expect(strip(document)).toEqual(strip(source));
  });

  it("ne partage aucune référence mutable avec le modèle", () => {
    const source = template();
    const document = instantiateTemplate(source, { origin: ORIGIN, now: NOW });

    expect(document.page).not.toBe(source.page);
    expect(document.page.background).not.toBe(source.page.background);
    document.elements.forEach((element, index) => {
      expect(element).not.toBe(source.elements[index]);
    });
    // Modifier la copie (par mutation forcée) laisse le modèle intact.
    const before = JSON.stringify(source);
    (document.page.background as { color: string }).color = "#000000";
    (document.elements[0] as { x: number }).x = 9999;
    expect(JSON.stringify(source)).toBe(before);
  });

  it("deux documents créés depuis le même modèle n'ont aucun identifiant commun", () => {
    const source = template();
    const a = instantiateTemplate(source, { origin: ORIGIN, now: NOW });
    const b = instantiateTemplate(source, { origin: ORIGIN, now: NOW });

    const ids = (doc: CreativeDocument) => [
      doc.id,
      ...doc.elements.map((e) => e.id),
      ...Object.keys(doc.assets),
    ];
    const shared = ids(a).filter((id) => ids(b).includes(id));
    expect(shared).toEqual([]);
  });

  it("accepte un titre et des identifiants imposés", () => {
    let n = 0;
    const createId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
    const document = instantiateTemplate(fixtureDocument("01-vide.json"), {
      origin: ORIGIN,
      now: NOW,
      title: "Invitation d'Awa",
      createId,
    });

    expect(document.meta.title).toBe("Invitation d'Awa");
    expect(document.id).toBe("00000000-0000-4000-8000-000000000001");
  });
});
