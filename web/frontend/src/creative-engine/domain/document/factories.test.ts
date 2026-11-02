import { describe, expect, it } from "vitest";
import { validateDocument } from "../schema/validate.ts";
import { createDocument, createImageElement, createShapeElement, createTextElement } from "./factories.ts";

const ID = "d0000000-0000-4000-8000-000000000001";
const NOW = "2026-10-31T10:00:00.000Z";

describe("createDocument", () => {
  it("crée un document vierge valide avec des défauts explicites", () => {
    const document = createDocument({ id: ID, now: NOW });

    expect(validateDocument(document)).toEqual([]);
    expect(document).toEqual({
      schemaVersion: 1,
      id: ID,
      meta: { title: "Document sans titre", createdAt: NOW, updatedAt: NOW, template: null },
      page: {
        unit: "px",
        width: 1080,
        height: 1350,
        preset: "social-4-5",
        print: null,
        background: { type: "solid", color: "#FFFFFF" },
      },
      assets: {},
      elements: [],
    });
  });

  it("crée un format imprimable en paysage, valide", () => {
    const document = createDocument({ preset: "print-a4", orientation: "landscape" });

    expect(validateDocument(document)).toEqual([]);
    expect(document.page).toMatchObject({
      width: 3508,
      height: 2480,
      print: { widthMm: 297, heightMm: 210 },
    });
  });

  it("attribue un identifiant différent à chaque document", () => {
    expect(createDocument().id).not.toBe(createDocument().id);
  });
});

describe("fabriques d'éléments", () => {
  it("crée un texte avec le style par défaut, surchargeable", () => {
    const text = createTextElement({
      x: 0,
      y: 0,
      width: 400,
      height: 60,
      content: "Bonjour",
      style: { fontSize: 72 },
    });

    expect(text).toMatchObject({ type: "text", rotation: 0, opacity: 1, locked: false, hidden: false });
    expect(text.style).toMatchObject({ fontFamily: "Poppins", fontSize: 72, color: "#0B0B0B" });
  });

  it("crée une image ajustée en cover, sans recadrage", () => {
    const image = createImageElement({ x: 0, y: 0, width: 100, height: 100, assetId: ID });

    expect(image).toMatchObject({ type: "image", fit: "cover", crop: null, assetId: ID });
  });

  it("crée une ligne de hauteur 0, avec contour et sans remplissage", () => {
    const line = createShapeElement({ shape: "line", x: 0, y: 10, width: 200, height: 40 });

    expect(line).toMatchObject({ height: 0, fill: null, stroke: { width: 2, style: "solid" } });
  });

  it("produit des éléments que le document accepte", () => {
    const elements = [
      createTextElement({ x: 10, y: 10, width: 300, height: 50, content: "Titre" }),
      createShapeElement({ shape: "rect", x: 0, y: 0, width: 100, height: 50, cornerRadius: 8 }),
      createShapeElement({ shape: "ellipse", x: 0, y: 0, width: 100, height: 100 }),
      createShapeElement({ shape: "line", x: 0, y: 0, width: 100, height: 0 }),
    ];
    expect(validateDocument({ ...createDocument(), elements })).toEqual([]);
  });
});

describe("nom de calque", () => {
  it("est facultatif et transmis tel quel", () => {
    expect(createTextElement({ x: 0, y: 0, width: 10, height: 10, content: "a" })).not.toHaveProperty("name");
    expect(createShapeElement({ shape: "rect", name: "Cadre", x: 0, y: 0, width: 10, height: 10 }).name).toBe(
      "Cadre",
    );
  });
});
