import { describe, expect, it } from "vitest";
import type { CardFacts } from "@/creative-engine/host/proposals/charter";
import { cardImagePrompt } from "./imagePrompt";

const FACTS: CardFacts = {
  type: "mariage",
  title: "Mariage d'Aïcha & Koffi",
  dateLine: "Samedi 20 mars 2027 à 15 h",
  placeLines: ["Église Saint-Paul du Plateau", "Abidjan"],
  dressCode: null,
  theme: null,
  colors: [],
  rsvpLine: null,
  description: "Cérémonie religieuse puis réception au bord de la lagune.",
  moment: "soirée",
};

describe("prompt de l'illustration", () => {
  it("donne le cadre de la cérémonie : lieu, moment et description", () => {
    const prompt = cardImagePrompt(FACTS, "Fleurs blanches");
    expect(prompt).toContain("lieu : Église Saint-Paul du Plateau, Abidjan");
    expect(prompt).toContain("en soirée");
    expect(prompt).toContain("au bord de la lagune");
  });

  it("raccourcit une longue description", () => {
    const prompt = cardImagePrompt({ ...FACTS, description: "mot ".repeat(200) }, "Sobre");
    const line = prompt.split("\n").find((l) => l.startsWith("Ce que l'organisateur dit")) ?? "";
    expect(line.length).toBeLessThan(400);
    expect(line.endsWith("…")).toBe(true);
  });

  it("sans lieu, moment ni description, n'en parle pas", () => {
    const prompt = cardImagePrompt({ ...FACTS, placeLines: [], moment: null, description: null }, "Sobre");
    expect(prompt).not.toContain("Cadre de la cérémonie");
    expect(prompt).not.toContain("Ce que l'organisateur dit");
  });

  it("hommage : jamais de visage, et la place du portrait sans le représenter", () => {
    const tribute = { ...FACTS, type: "funerailles" };
    for (const photos of [0, 1]) {
      const prompt = cardImagePrompt(tribute, "Lys blancs", photos);
      expect(prompt).toContain("aucun personnage ni visage");
      expect(prompt).not.toContain("représente-les");
    }
    expect(cardImagePrompt(tribute, "Lys blancs", 1)).toContain("médaillon avec le portrait");
  });
});
