import { describe, expect, it } from "vitest";
import { FIXTURES, fixtureDocument } from "../../test/documentFixtures.ts";
import { createDocument } from "../document/factories.ts";
import { deserializeDocument, serializeDocument } from "./serialize.ts";

function serialize(...args: Parameters<typeof serializeDocument>): string {
  const result = serializeDocument(...args);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.json;
}

describe("sérialisation", () => {
  it.each(Object.keys(FIXTURES))("%s : un aller-retour préserve toutes les données métier", (name) => {
    const document = fixtureDocument(name);

    const restored = deserializeDocument(serialize(document));

    expect(restored).toEqual({ status: "ok", document, warnings: [] });
  });

  it("produit le même texte quel que soit l'ordre des propriétés en mémoire", () => {
    const document = fixtureDocument("03-titre-sous-titre.json");
    const reordered = Object.fromEntries(Object.entries(document).reverse()) as typeof document;

    expect(serialize(reordered)).toBe(serialize(document));
  });

  it("ne sérialise que les données du modèle", () => {
    const parsed = JSON.parse(serialize(fixtureDocument("04-avec-image.json"))) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(["assets", "elements", "id", "meta", "page", "schemaVersion"]);
  });

  it("refuse de sérialiser un document invalide", () => {
    const document = createDocument();
    const broken = { ...document, page: { ...document.page, width: -1 } };

    const result = serializeDocument(broken);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues[0]?.path).toBe("page.width");
  });

  it("met en forme sur demande", () => {
    expect(serialize(createDocument(), { pretty: true })).toContain('\n  "assets"');
  });
});

describe("désérialisation", () => {
  it("signale un JSON illisible", () => {
    expect(deserializeDocument("{ pas du json")).toMatchObject({
      status: "invalid",
      issues: [{ code: "invalid_json" }],
    });
  });

  it("signale une version non prise en charge", () => {
    expect(deserializeDocument('{"schemaVersion": 99}')).toMatchObject({
      status: "unsupported_version",
      version: 99,
    });
  });

  it("rejette un document structurellement invalide", () => {
    expect(deserializeDocument('{"schemaVersion": 1}').status).toBe("invalid");
  });
});
