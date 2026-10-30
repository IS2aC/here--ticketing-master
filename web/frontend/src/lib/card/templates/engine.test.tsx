import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./color";
import type { CardDefinition, Layer, TextLayer } from "./definition";
import { composeCard, displayValue, fillText, layerBox, type ComposeInput } from "./engine";
import type { Measure } from "./fit";

// Le modèle d'exemple est aussi celui que l'API valide (web/api/tests/test_card_definition.py).
const SAMPLE = "../../uiux/assets/card-templates/dot-wax";
const definition = JSON.parse(readFileSync(join(SAMPLE, "definition.json"), "utf8")) as CardDefinition;
const assets = {
  fond: { svg: readFileSync(join(SAMPLE, "fond.svg"), "utf8") },
  "ornement-haut": { svg: readFileSync(join(SAMPLE, "ornement-haut.svg"), "utf8") },
};
const measure: Measure = (text, _font, size, spacing) => [...text].length * (size * 0.5 + spacing);
const values = { fiances: "Aya & Koffi", familles: "Konan et Yao", date: "2026-11-01", heure: "15:30", lieu: "Cocody Angré", programme: "" };
const guest = { name: "Monsieur et Madame Konan", table: "Table 4 · VIP", code: "INV-7K2P-9QXA", qr: "data:image/svg+xml;base64,PHN2Zy8+" };
const layerOf = (id: string) => definition.layers.find((l) => l.id === id) as Layer;

function compose(over: Partial<ComposeInput> = {}) {
  return composeCard({ definition, format: "whatsapp_4_5", values, assets, guest, measure, ...over });
}

type Drawn = ReactElement<{ style?: Record<string, unknown>; src?: string; children?: unknown }>;
const drawn = (card: ReturnType<typeof composeCard>) =>
  (card.element as ReactElement<{ children: Drawn[] }>).props.children as Drawn[];
const ids = (card: ReturnType<typeof composeCard>) => drawn(card).map((c) => c.key);
const textOf = (el: Drawn) =>
  (el.props.children as ReactElement<{ children: string }>[]).map((line) => line.props.children).join(" / ");

describe("valeurs affichées", () => {
  it("écrit les dates et les heures en français", () => {
    const date = { key: "date", label: "Date", type: "date" as const };
    const time = { key: "heure", label: "Heure", type: "time" as const };
    expect(displayValue(date, "2026-11-01")).toBe("Dimanche 1er novembre 2026");
    expect(displayValue(date, "2026-12-12")).toBe("Samedi 12 décembre 2026");
    expect(displayValue(time, "15:00")).toBe("15 h");
    expect(displayValue(time, "09:30")).toBe("9 h 30");
    expect(displayValue(date, "bientôt")).toBe("bientôt");
  });

  it("n'affiche pas un texte dont un champ est vide", () => {
    expect(fillText("À partir de {heure}", definition.fields, values, null)).toBe("À partir de 15 h 30");
    expect(fillText("À partir de {heure}", definition.fields, { ...values, heure: " " }, null)).toBeNull();
    expect(fillText("{invite.nom}", definition.fields, values, guest)).toBe("Monsieur et Madame Konan");
    expect(fillText("{invite.nom}", definition.fields, values, null)).toBeNull();
  });
});

describe("layerBox", () => {
  it("applique les réglages par format, les ornements masqués et les déplacements permis", () => {
    expect(layerBox(layerOf("photo"), "square_1_1")).toBeNull();
    expect(layerBox(layerOf("date"), "square_1_1")).toEqual({ x: 7, y: 47, w: 62, h: 7 });
    expect(layerBox(layerOf("ornement-haut"), "whatsapp_4_5", { hidden: ["ornement-haut"] })).toBeNull();
    // « intro » n'est pas un ornement : il reste affiché.
    expect(layerBox(layerOf("intro"), "whatsapp_4_5", { hidden: ["intro"] })).not.toBeNull();
    const date = layerOf("date");
    expect(layerBox(date, "whatsapp_4_5", { moves: { date: { x: 20, y: 20 } } })).toEqual(date.box);
    expect(layerBox({ ...date, movable: true }, "whatsapp_4_5", { moves: { date: { x: 90, y: -5 } } })).toEqual({ ...date.box, x: 38, y: 0 });
  });
});

describe("composeCard", () => {
  it("dessine chaque format à sa taille, l'A5 avec 3 mm de fond perdu", () => {
    expect([compose().width, compose().height]).toEqual([1080, 1350]);
    expect(compose({ format: "story_9_16" }).height).toBe(1920);
    expect(compose({ format: "square_1_1" }).height).toBe(1080);
    const a5 = compose({ format: "print_a5" });
    expect([a5.width, a5.height]).toEqual([1818, 2550]);
    // Le fond touche les bords : il couvre le fond perdu ; le texte reste dans la coupe.
    const fond = drawn(a5).find((c) => c.key === "fond")!;
    expect(fond.props.style).toMatchObject({ left: 0, top: 0, width: 1818, height: 2550 });
    const date = drawn(a5).find((c) => c.key === "date")!;
    expect(date.props.style!.left).toBeCloseTo(35 + 0.07 * 1748, 5);
  });

  it("carte de l'invité : son nom et le QR code ; carte générique : ni l'un ni l'autre", () => {
    expect(ids(compose())).toEqual(expect.arrayContaining(["invite", "qr"]));
    const generic = ids(compose({ guest: null }));
    expect(generic).not.toContain("invite");
    expect(generic).not.toContain("qr");
    // Programme vide : pas de calque ; pas de photo : zone signalée seulement dans l'éditeur.
    expect(ids(compose())).not.toContain("programme");
    expect(ids(compose())).not.toContain("photo");
    expect(ids(compose({ placeholders: true }))).toContain("photo");
  });

  it("met les textes aux couleurs de la palette choisie et teinte les ornements", () => {
    const indigo = definition.theme.palettes.find((p) => p.id === "indigo")!;
    const card = compose({ overrides: { palette: "indigo", fonts: "moderne" } });
    const fiances = drawn(card).find((c) => c.key === "fiances")!;
    expect(fiances.props.style).toMatchObject({ color: indigo.colors.primary, fontFamily: "Poppins" });
    expect(card.element.props).toMatchObject({ style: { background: indigo.colors.background } });
    const ornament = drawn(card).find((c) => c.key === "ornement-haut")!;
    expect(atob(ornament.props.src!.split(",")[1])).toContain(indigo.colors.accent);
    expect(textOf(drawn(card).find((c) => c.key === "familles")!)).toBe("FAMILLES KONAN ET YAO");
  });

  it("prévient quand un texte est trop long", () => {
    const card = compose({ values: { ...values, fiances: "Marie-Christelle Aménan Kouassi & Jean-Baptiste Kouadio N'Guessan" } });
    expect(card.warnings).toContainEqual({ layer: "fiances", kind: "overflow", message: "« Noms des fiancés » est trop long pour la carte : raccourcissez-le." });
    expect(compose().warnings).toEqual([]);
  });

  it("prévient quand un texte ressort mal sur le fond", () => {
    const pale = { ...definition, theme: { ...definition.theme, palettes: definition.theme.palettes.map((p) => ({ ...p, colors: { ...p.colors, primary: "#EFE3D0" } })) } };
    const warnings = compose({ definition: pale }).warnings.filter((w) => w.kind === "contrast");
    expect(warnings.map((w) => w.layer)).toEqual(["invite", "fiances", "date"]);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("toutes les palettes du modèle d'exemple sont lisibles", () => {
    for (const palette of definition.theme.palettes) {
      expect(compose({ overrides: { palette: palette.id } }).warnings, palette.id).toEqual([]);
    }
  });

  it("dessine les lignes calculées, sans laisser Satori les recouper", () => {
    const fiances = drawn(compose()).find((c) => c.key === "fiances")!;
    const lines = fiances.props.children as ReactElement<{ style: Record<string, unknown> }>[];
    expect(lines.every((line) => line.props.style.whiteSpace === "pre")).toBe(true);
    const layer = layerOf("fiances") as TextLayer;
    expect(fiances.props.style!.fontSize).toBe(layer.size.max);
  });
});
