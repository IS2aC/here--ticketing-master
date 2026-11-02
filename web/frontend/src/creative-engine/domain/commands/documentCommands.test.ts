import { describe, expect, it } from "vitest";
import { fixtureDocument } from "../../test/documentFixtures.ts";
import { createDocument } from "../document/factories.ts";
import type { ImageAsset } from "../document/types.ts";
import { validateDocument } from "../schema/validate.ts";
import { addAsset, renameDocument, setPageBackground, setPageFormat } from "./documentCommands.ts";
import type { CommandResult } from "./result.ts";

function done(result: CommandResult) {
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  expect(validateDocument(result.document)).toEqual([]);
  return result.document;
}

const ASSET_ID = "a0000000-0000-4000-8000-000000000002";
const ASSET: ImageAsset = {
  kind: "image",
  mimeType: "image/png",
  width: 800,
  height: 600,
  source: { type: "local", key: `assets/${ASSET_ID}` },
  provenance: "upload",
};

describe("commandes du document", () => {
  it("renomme le document, sans espaces superflus", () => {
    expect(done(renameDocument(createDocument(), { title: "  Anniversaire  " })).meta.title).toBe(
      "Anniversaire",
    );
  });

  it("change la couleur de fond", () => {
    expect(done(setPageBackground(createDocument(), { color: "#F7F1E8" })).page.background.color).toBe(
      "#F7F1E8",
    );
  });

  it("refuse une couleur de fond invalide", () => {
    const result = setPageBackground(createDocument(), { color: "#XYZ" });
    expect(!result.ok && result.error.code).toBe("invalid_value");
  });

  it("passe en paysage sans déplacer les éléments", () => {
    const before = fixtureDocument("03-titre-sous-titre.json");
    const after = done(setPageFormat(before, { preset: "social-4-5", orientation: "landscape" }));

    expect(after.page).toMatchObject({ width: 1350, height: 1080, preset: "social-4-5" });
    expect(after.elements).toBe(before.elements);
  });

  it("passe à un format imprimable avec ses dimensions physiques", () => {
    const after = done(setPageFormat(createDocument(), { preset: "print-a5", orientation: "portrait" }));
    expect(after.page.print).toEqual({ widthMm: 148, heightMm: 210, dpi: 300, bleedMm: 3 });
  });

  it("accepte un format libre dans les limites, et le refuse au-delà", () => {
    expect(
      done(setPageFormat(createDocument(), { preset: "custom", width: 1500, height: 500 })).page.print,
    ).toBeNull();
    const tooLarge = setPageFormat(createDocument(), { preset: "custom", width: 9000, height: 500 });
    expect(!tooLarge.ok && tooLarge.error.issues?.[0]?.path).toBe("width");
  });

  it("déclare une ressource", () => {
    expect(done(addAsset(createDocument(), { id: ASSET_ID, asset: ASSET })).assets[ASSET_ID]).toEqual(ASSET);
  });

  it("refuse une ressource déjà déclarée, ou référencée par une URL", () => {
    const doc = fixtureDocument("04-avec-image.json");
    const existing = addAsset(doc, { id: "a0000000-0000-4000-8000-000000000001", asset: ASSET });
    expect(!existing.ok && existing.error.code).toBe("duplicate_id");

    const url = addAsset(doc, {
      id: ASSET_ID,
      asset: { ...ASSET, source: { type: "remote", key: "https://x.test/a.png" } },
    });
    expect(!url.ok && url.error.code).toBe("invalid_value");
  });
});
