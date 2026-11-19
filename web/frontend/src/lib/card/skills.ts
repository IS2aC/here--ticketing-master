import { readFileSync } from "node:fs";
import { join } from "node:path";

// Skills de génération des cartes : un fichier Markdown par type d'événement (src/lib/card/skills/, voir son
// README). Le prompt de l'illustration reçoit la partie « Illustration », celui des chartes la partie
// « Propositions ». Les fichiers sont lus à l'exécution (next.config.ts les ajoute à la sortie standalone) et
// gardés en mémoire.

export type SkillPart = "Illustration" | "Propositions";

const DIR = join(process.cwd(), "src/lib/card/skills");
const cache = new Map<string, Partial<Record<SkillPart, string>> | null>();

/** Parties d'une fiche, sous leurs titres de niveau 2. */
export function parseSkill(markdown: string): Partial<Record<SkillPart, string>> {
  const parts: Partial<Record<SkillPart, string>> = {};
  for (const section of markdown.split(/^## /m).slice(1)) {
    const [heading = "", ...body] = section.split("\n");
    const name = heading.trim();
    if (name === "Illustration" || name === "Propositions") parts[name] = body.join("\n").trim();
  }
  return parts;
}

/** Partie de la fiche du type, ou null si la fiche manque (le code garde alors ses consignes de secours). */
export function cardSkill(type: string, part: SkillPart): string | null {
  if (!/^[a-z_]+$/.test(type)) return null;
  if (!cache.has(type)) {
    try {
      cache.set(type, parseSkill(readFileSync(join(DIR, `${type}.md`), "utf8")));
    } catch {
      cache.set(type, null);
    }
  }
  return cache.get(type)?.[part] || null;
}
