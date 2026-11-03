import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateDocument } from "../../domain/schema/validate.ts";
import { contrastRatio, targetContrast } from "../../editor/colors.ts";
import { slotOf, toCardLayout } from "../guestFields.ts";
import { charterSchema, groundedTexts, isGrounded, proposalsSchema, type CardFacts } from "./charter.ts";
import { composeOnImage } from "./aiCard.ts";
import { COMPOSITIONS } from "./charter.ts";
import { charterOf, composeCard, loadComposition } from "./compose.ts";
import { defaultTexts, fallbackCharters } from "./fallback.ts";
import { backgroundBehind } from "../../editor/colors.ts";

const FACTS: CardFacts = {
  type: "mariage",
  title: "Mariage d'Aïcha & Koffi",
  dateLine: "Samedi 20 mars 2027 à 15 h",
  placeLines: ["Église Saint-Paul du Plateau", "Abidjan"],
  dressCode: "blanc et or",
  theme: "Nuit à Marrakech",
  colors: ["#C9A24A", "#0B0B0B"],
  rsvpLine: "Merci de confirmer votre présence avant le 1er mars",
  description: "Cérémonie religieuse puis réception à la Maison des Jardins.",
};
const SAMPLE = { name: "Awa Koné", table: "Table 4 · Famille" };
const TYPES = ["mariage", "dot", "bapteme", "funerailles", "anniversaire", "brunch", "retrouvailles", "reunion", "seminaire", "concert_prive", "festival", "autre"];

describe("textes de l'IA", () => {
  it("acceptent les noms et les nombres des faits, sans tenir compte des accents", () => {
    expect(isGrounded("Aicha & Koffi", FACTS)).toBe(true);
    expect(isGrounded("Rendez-vous à la Maison des Jardins", FACTS)).toBe(true);
    expect(isGrounded("Avant le 1er mars", FACTS)).toBe(true);
  });

  it("refusent un nom ou un nombre inventé", () => {
    expect(isGrounded("Aïcha & Kofi", FACTS)).toBe(false);
    expect(isGrounded("Rendez-vous à 17 h", FACTS)).toBe(false);
    expect(isGrounded("Avec Marie-Claire", FACTS)).toBe(false);
  });

  it("remplacent un texte qui invente, et le titre par celui de l'événement", () => {
    const texts = { kicker: "Nous nous marions", title: "Aïcha & Kofi", tagline: "", closing: "Réponse avant le 3 mars", guestLabel: "Pour" };
    const kept = groundedTexts(texts, defaultTexts(FACTS), FACTS);
    expect(kept.title).toBe("Aïcha\n& Koffi");
    expect(kept.closing).toBe(FACTS.rsvpLine);
    expect(kept.kicker).toBe("Nous nous marions");
  });
});

describe("schéma de sortie structurée", () => {
  it("se convertit en JSON Schema fermé, comme l'exige le mode strict des fournisseurs", () => {
    const schema = z.toJSONSchema(proposalsSchema) as { additionalProperties?: boolean; properties: Record<string, unknown> };
    expect(schema.additionalProperties).toBe(false);
    expect(JSON.stringify(schema)).toContain("mariage-feuillage-dore");
  });
});

describe("chartes sans IA", () => {
  it("donnent trois chartes valides pour chaque type d'événement", () => {
    for (const type of TYPES) {
      const charters = fallbackCharters({ ...FACTS, type });
      expect(charters, type).toHaveLength(3);
      expect(proposalsSchema.safeParse({ proposals: charters }).success, type).toBe(true);
      for (const charter of charters) expect(charterSchema.safeParse(charter).success).toBe(true);
    }
  });
});

describe("code couleur de l'événement", () => {
  it("est suivi par la direction classique", () => {
    const [classique] = fallbackCharters(FACTS);
    expect(classique?.palette.accent).toBe("#C9A24A");
    expect(classique?.ornamentTint).toBe("#C9A24A");
    const [sansCouleurs] = fallbackCharters({ ...FACTS, colors: [] });
    expect(sansCouleurs?.name).not.toBe("Vos couleurs");
  });
});

describe("composition d'une carte", () => {
  it("donne une carte valide, prête pour Satori, avec les faits de l'événement", async () => {
    for (const type of ["mariage", "dot", "anniversaire", "bapteme", "seminaire", "festival"]) {
      for (const charter of fallbackCharters({ ...FACTS, type })) {
        const doc = composeCard(await loadComposition(charter.composition), charter, { ...FACTS, type }, SAMPLE);
        const label = `${type} / ${charter.name}`;
        expect(validateDocument(doc), label).toEqual([]);
        expect(toCardLayout(doc).ok, label).toBe(true);
        expect(doc.page.background.color, label).toBe(charter.palette.background);
        const contents = doc.elements.flatMap((e) => (e.type === "text" ? [e.content] : [])).join("\n");
        expect(contents, label).toContain(FACTS.dateLine);
        expect(contents, label).toContain(SAMPLE.name);
        // Aucun texte du modèle d'origine ne reste (prénoms, lieux d'exemple).
        for (const sample of ["Aminata", "Fatou", "Noah", "Riviera", "Bingerville", "Hôtel Ivoire", "Ateliers"])
          expect(contents, `${label} : ${sample}`).not.toContain(sample);
      }
    }
  });

  it("rend chaque texte lisible sur ce qu'il y a derrière", async () => {
    for (const charter of fallbackCharters({ ...FACTS, type: "festival" })) {
      const doc = composeCard(await loadComposition(charter.composition), charter, FACTS, SAMPLE);
      for (const element of doc.elements) {
        if (element.type !== "text") continue;
        const behind = backgroundBehind(doc, element) ?? doc.page.background.color;
        expect(contrastRatio(element.style.color, behind), `${charter.name} : ${element.name}`).toBeGreaterThanOrEqual(
          targetContrast(element) - 0.05,
        );
      }
    }
  });

  it("écrit le nom de l'invité dans la police de la charte, dans la zone de Satori", async () => {
    const [charter] = fallbackCharters(FACTS);
    if (!charter) throw new Error("charte attendue");
    const doc = composeCard(await loadComposition(charter.composition), { ...charter, fonts: { ...charter.fonts, guest: "Poppins" } }, FACTS, SAMPLE);
    const name = slotOf(doc, "guest-name");
    expect(name?.type === "text" && name.style.fontFamily).toBe("Poppins");
    const layout = toCardLayout(doc);
    expect(layout.ok && layout.layout.name.font).toBe("sans");
  });
});

describe("modèles Here! remplis avec l'événement", () => {
  it("gardent le style du modèle et prennent les faits de l'événement", async () => {
    for (const composition of COMPOSITIONS) {
      const template = await loadComposition(composition);
      const doc = composeCard(template, charterOf(template, composition, FACTS), FACTS, SAMPLE);
      expect(validateDocument(doc), composition).toEqual([]);
      expect(toCardLayout(doc).ok, composition).toBe(true);
      expect(doc.page.background.color.slice(0, 7), composition).toBe(template.page.background.color.slice(0, 7));
      const contents = doc.elements.flatMap((e) => (e.type === "text" ? [e.content] : [])).join("\n");
      expect(contents, composition).toContain(FACTS.dateLine);
      expect(contents, composition).toContain("Koffi");
    }
  });
});

describe("carte générée par l'IA", () => {
  const illustration = {
    kind: "image" as const,
    mimeType: "image/png" as const,
    width: 1024,
    height: 1280,
    source: { type: "local" as const, key: `sha256-${"a".repeat(64)}` },
    provenance: "ai" as const,
  };

  it("pose les textes exacts sur un voile lisible, le sceau en bas à droite", () => {
    const doc = composeOnImage(illustration, FACTS, SAMPLE);
    expect(validateDocument(doc)).toEqual([]);
    const layout = toCardLayout(doc);
    expect(layout.ok && layout.layout.qr).toBe("bas-droite");
    const contents = doc.elements.flatMap((e) => (e.type === "text" ? [e.content] : [])).join("\n");
    for (const fact of [FACTS.dateLine, "Église Saint-Paul du Plateau", "Tenue : blanc et or", SAMPLE.name]) expect(contents).toContain(fact);
    for (const element of doc.elements) {
      if (element.type !== "text") continue;
      const behind = backgroundBehind(doc, element) ?? doc.page.background.color;
      expect(contrastRatio(element.style.color, behind), element.name).toBeGreaterThanOrEqual(targetContrast(element) - 0.05);
    }
  });

  it("n'écrit rien pour un fait absent", () => {
    const doc = composeOnImage(illustration, { ...FACTS, placeLines: [], dressCode: null }, SAMPLE);
    expect(doc.elements.some((e) => e.name === "Lieu" || e.name === "Tenue")).toBe(false);
  });
});
