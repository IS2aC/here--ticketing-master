import { z } from "zod";

/** Problème localisé dans des données : chemin lisible (« elements[2].style.fontSize »), code stable, message. */
export interface Issue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((out, key) => {
    if (typeof key === "number") return `${out}[${key}]`;
    return out === "" ? String(key) : `${out}.${String(key)}`;
  }, "");
}

const FRENCH = z.locales.fr().localeError;

/** Valide avec les messages en français, sans modifier la configuration globale de Zod. */
export function safeParseFr<T extends z.ZodType>(schema: T, input: unknown) {
  return schema.safeParse(input, { error: FRENCH });
}

/** Zod ajoute `received` (absent de ses types) seulement pour NaN et ±Infinity. */
function isNonFiniteNumber(issue: z.core.$ZodIssue): boolean {
  return (
    issue.code === "invalid_type" &&
    "received" in issue &&
    ["NaN", "Infinity", "-Infinity"].includes(String(issue.received))
  );
}

export function toIssues(issues: readonly z.core.$ZodIssue[]): Issue[] {
  return issues.map((issue) => ({
    path: formatPath(issue.path),
    code: isNonFiniteNumber(issue) ? "non_finite_number" : issue.code,
    // Zod formule NaN et l'infini comme « nombre attendu, nombre reçu » : message plus clair.
    message: isNonFiniteNumber(issue) ? "Nombre fini attendu (NaN et l'infini sont refusés)" : issue.message,
  }));
}
