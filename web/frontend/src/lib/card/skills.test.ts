import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPOSITIONS, isGrounded, TEXT_LIMITS, type CardFacts } from "@/creative-engine/host/proposals/charter";
import { FONT_CATALOG } from "@/creative-engine/editor/fontCatalog";
import { EVENT_TYPES } from "@/lib/event-types";
import { cardImagePrompt } from "./imagePrompt";
import { cardSkill } from "./skills";

// Les fiches sont écrites à la main : ces tests vérifient qu'elles restent utilisables par le code et que
// leurs exemples de formules passeraient les contrôles du moteur.

const FACTS: CardFacts = {
  type: "autre",
  title: "Fête de famille",
  dateLine: "Samedi 20 mars 2027 à 15 h",
  placeLines: ["Salle des fêtes"],
  dressCode: null,
  theme: null,
  colors: [],
  rsvpLine: null,
  description: null,
};

const LIMITS: Record<string, number> = {
  Surtitres: TEXT_LIMITS.kicker,
  Fins: TEXT_LIMITS.closing,
  "Mentions avant le nom": TEXT_LIMITS.guestLabel,
};

const types = EVENT_TYPES.map((t) => t.value);

describe("skills des cartes", () => {
  it("une fiche par type, rien de plus", () => {
    const files = readdirSync(join(process.cwd(), "src/lib/card/skills")).filter((f) => f !== "README.md");
    expect(files.sort()).toEqual(types.map((t) => `${t}.md`).sort());
  });

  for (const type of types) {
    describe(type, () => {
      const illustration = cardSkill(type, "Illustration") ?? "";
      const propositions = cardSkill(type, "Propositions") ?? "";

      it("a ses deux parties, l'illustration courte et sans mots qui font dessiner des lettres", () => {
        expect(illustration).not.toBe("");
        expect(propositions).not.toBe("");
        expect(illustration.split(/\s+/).length).toBeLessThanOrEqual(90);
        expect(illustration).not.toMatch(/\b(textes?|QR|affiches?)\b/i);
      });

      it("ne cite que des compositions et des polices qui existent", () => {
        for (const [name] of propositions.matchAll(/`([a-z-]+)`/g))
          expect(COMPOSITIONS as readonly string[], name).toContain(name.slice(1, -1));
        const families = FONT_CATALOG.map((f) => f.family);
        for (const [, font] of propositions.matchAll(/titre en ([A-Z][\w ]+?)(?= ou | \(|,|;|\.)/g))
          expect(families, font).toContain(font);
      });

      it("donne des formules aux bonnes longueurs, sans fait inventé", () => {
        let count = 0;
        for (const line of propositions.split("\n")) {
          const label = Object.keys(LIMITS).find((l) => line.startsWith(`- ${l} :`));
          if (!label) continue;
          for (const [, formula = ""] of line.matchAll(/« ([^»]+) »/g)) {
            count++;
            expect(formula.length, formula).toBeLessThanOrEqual(LIMITS[label] ?? 0);
            expect(isGrounded(formula, { ...FACTS, type }), formula).toBe(true);
          }
        }
        expect(count).toBeGreaterThanOrEqual(6);
      });

      it("remplace la direction artistique de secours dans le prompt de l'image", () => {
        expect(cardImagePrompt({ ...FACTS, type }, "Sobre")).toContain(illustration);
      });
    });
  }

  it("type inconnu ou nom de fichier suspect : pas de fiche", () => {
    expect(cardSkill("../package", "Illustration")).toBeNull();
    expect(cardSkill("inconnu", "Propositions")).toBeNull();
  });
});
