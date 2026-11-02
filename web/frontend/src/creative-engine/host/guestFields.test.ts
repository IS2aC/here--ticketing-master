import { describe, expect, it } from "vitest";
import { qrPosition, textBox } from "@/lib/card/layout";
import { addAsset } from "../domain/commands/documentCommands.ts";
import { addElement } from "../domain/commands/elementCommands.ts";
import { createDocument, createTextElement } from "../domain/document/factories.ts";
import type { CreativeDocument } from "../domain/document/types.ts";
import { validateDocument } from "../domain/schema/validate.ts";
import {
  createGuestName,
  createGuestQr,
  createGuestTable,
  DEFAULT_GUEST_LAYOUT,
  nearestSpot,
  SEAL_ASSET,
  toCardLayout,
  withoutGuestFields,
} from "./guestFields.ts";

const SEAL_ID = "a0000000-0000-4000-8000-0000000000aa";
const SAMPLE = { name: "Monsieur et Madame Konan", table: "Table 4 · VIP" };

function apply(doc: CreativeDocument, ...steps: ((d: CreativeDocument) => ReturnType<typeof addElement>)[]) {
  return steps.reduce((d, step) => {
    const result = step(d);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    return result.document;
  }, doc);
}

function card(): CreativeDocument {
  return apply(
    createDocument({ preset: "social-4-5" }),
    (d) => addElement(d, { element: createTextElement({ x: 100, y: 100, width: 880, height: 80, content: "Aïcha & Koffi" }) }),
    (d) => addAsset(d, { id: SEAL_ID, asset: SEAL_ASSET }),
    (d) => addElement(d, { element: createGuestName(SAMPLE) }),
    (d) => addElement(d, { element: createGuestTable(SAMPLE) }),
    (d) => addElement(d, { element: createGuestQr(SEAL_ID, "bas-gauche") }),
  );
}

describe("champs invité", () => {
  it("créent un document valide", () => {
    expect(validateDocument(card())).toEqual([]);
  });

  it("redonnent la mise en page proposée par Here! sans changement", () => {
    expect(toCardLayout(card())).toEqual({ ok: true, layout: { ...DEFAULT_GUEST_LAYOUT, qr: "bas-gauche" } });
  });

  it("occupent la zone de texte de Satori", () => {
    const name = createGuestName(SAMPLE);
    const box = textBox(DEFAULT_GUEST_LAYOUT.name);
    expect([name.x, name.width]).toEqual([box.left, box.width]);
  });

  it("ramènent la taille, la couleur et la graisse à ce que Satori sait dessiner", () => {
    const doc = card();
    const name = doc.elements.find((e) => e.slot === "guest-name");
    if (name?.type !== "text") throw new Error("nom attendu");
    const big = {
      ...doc,
      elements: doc.elements.map((e) =>
        e === name ? { ...name, style: { ...name.style, fontSize: 400, color: "#7d2335cc" as const, fontWeight: 700 as const } } : e,
      ),
    };
    const result = toCardLayout(big);
    expect(result.ok && result.layout.name).toMatchObject({ size: 160, color: "#7D2335", bold: true });
  });

  it("refusent une carte sans le nom de l'invité, ou au mauvais format", () => {
    const doc = card();
    const noName = { ...doc, elements: doc.elements.filter((e) => e.slot !== "guest-name") };
    expect(toCardLayout(noName)).toMatchObject({ ok: false });
    expect(toCardLayout(apply(createDocument({ preset: "square" })))).toMatchObject({ ok: false });
  });

  it("table facultative", () => {
    const doc = card();
    const result = toCardLayout({ ...doc, elements: doc.elements.filter((e) => e.slot !== "guest-table") });
    expect(result.ok && result.layout.table).toBeNull();
  });

  it("placent le QR code à l'emplacement le plus proche", () => {
    const { left, top } = qrPosition("haut-droite");
    expect(nearestSpot({ x: left - 30, y: top + 40 })).toBe("haut-droite");
  });

  it("disparaissent du décor exporté, avec le sceau d'exemple", () => {
    const decor = withoutGuestFields(card());
    expect(decor.elements.map((e) => e.slot)).toEqual([undefined]);
    expect(decor.assets).toEqual({});
    expect(validateDocument(decor)).toEqual([]);
  });
});

describe("calligraphie du nom de l'invité", () => {
  it("Great Vibes devient la police « script » de Satori, sans gras (une seule graisse)", () => {
    const name = createGuestName(SAMPLE, { ...DEFAULT_GUEST_LAYOUT.name, font: "script", bold: true });
    expect(name.style).toMatchObject({ fontFamily: "Great Vibes", fontWeight: 400 });
    const doc = card();
    const scripted = {
      ...doc,
      elements: doc.elements.map((e) =>
        e.slot === "guest-name" && e.type === "text" ? { ...e, style: { ...e.style, fontFamily: "Great Vibes", fontWeight: 700 as const } } : e,
      ),
    };
    const result = toCardLayout(scripted);
    expect(result.ok && result.layout.name).toMatchObject({ font: "script", bold: false });
  });
});
