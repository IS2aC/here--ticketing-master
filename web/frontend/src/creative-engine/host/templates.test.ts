import { describe, expect, it } from "vitest";
import { qrPosition, QR_BOX, QR_SPOT } from "@/lib/card/layout";
import type { CreativeDocument } from "../domain/document/types.ts";
import type { Element } from "../domain/elements/types.ts";
import { loadDocument } from "../domain/schema/validate.ts";
import { TEMPLATE_DOCUMENTS } from "../library/bundled/templateDocuments.ts";
import { CARD_SIZE, createGuestName, createGuestTable, SEAL_ASSET_KEY, slotOf, toCardLayout } from "./guestFields.ts";

// Modèles intégrés : au format de la carte, avec une place réservée au nom, à la table et au sceau QR.

const SAMPLE = { name: "Awa Koné", table: "Table 4 · Famille" };

async function templates(): Promise<[string, CreativeDocument][]> {
  return Promise.all(
    Object.entries(TEMPLATE_DOCUMENTS).map(async ([path, load]) => {
      const result = loadDocument(await load());
      if (result.status !== "ok") throw new Error(`${path} : ${JSON.stringify(result)}`);
      return [path, result.document] as [string, CreativeDocument];
    }),
  );
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
type Box = Pick<Element, "x" | "y" | "width" | "height">;

describe("modèles de cartes", () => {
  it("sont au format de la carte et passent la validation de Satori", async () => {
    for (const [path, doc] of await templates()) {
      expect(doc.page, path).toMatchObject(CARD_SIZE);
      expect(toCardLayout(doc).ok, path).toBe(true);
    }
  });

  it("placent le sceau exactement en bas à droite, comme Satori", async () => {
    for (const [path, doc] of await templates()) {
      const qr = slotOf(doc, "guest-qr");
      expect(qr?.type === "image" && doc.assets[qr.assetId]?.source.key, path).toBe(SEAL_ASSET_KEY);
      if (!qr) continue;
      const { left, top } = qrPosition(QR_SPOT);
      expect({ x: qr.x, y: qr.y, width: qr.width, height: qr.height, locked: qr.locked }, path).toEqual({
        x: left,
        y: top,
        width: QR_BOX.width,
        height: QR_BOX.height,
        locked: true,
      });
    }
  });

  it("donnent au nom et à la table la zone que Satori dessinera", async () => {
    for (const [path, doc] of await templates()) {
      const result = toCardLayout(doc);
      if (!result.ok || !result.layout.table) throw new Error(path);
      // Au centième de pixel près (72 × 1,2 n'est pas exact en virgule flottante).
      const r = (v: number) => Math.round(v * 100) / 100;
      const box = ({ x, y, width, height }: Box) => ({ x: r(x), y: r(y), width: r(width), height: r(height) });
      expect(box(slotOf(doc, "guest-name") as Element), path).toEqual(box(createGuestName(SAMPLE, result.layout.name)));
      expect(box(slotOf(doc, "guest-table") as Element), path).toEqual(box(createGuestTable(SAMPLE, result.layout.table)));
    }
  });

  it("ne mettent aucun texte sur le nom, la table ou le sceau", async () => {
    for (const [path, doc] of await templates()) {
      const reserved = doc.elements.filter((e) => e.slot);
      const texts = doc.elements.filter((e) => e.type === "text" && !e.slot);
      for (const text of texts)
        for (const zone of reserved) expect(overlaps(text, zone), `${path} : « ${text.name} » sur ${zone.slot}`).toBe(false);
    }
  });
});
