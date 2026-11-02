import { loadDocument } from "../domain/schema/validate.ts";
import type { CreativeDocument } from "../domain/document/types.ts";

// Documents d'exemple (test/fixtures/documents) : données brutes, telles qu'un fichier les fournirait.
const RAW = import.meta.glob<unknown>("./fixtures/documents/*.json", {
  eager: true,
  import: "default",
});

export const FIXTURES: Readonly<Record<string, unknown>> = Object.fromEntries(
  Object.entries(RAW).map(([path, data]) => [path.split("/").at(-1) ?? path, data]),
);

/** Copie indépendante des données brutes d'un exemple (les tests peuvent la modifier). */
export function rawFixture(name: string): Record<string, unknown> {
  const data = FIXTURES[name];
  if (data === undefined) throw new Error(`Exemple introuvable : ${name}`);
  return structuredClone(data) as Record<string, unknown>;
}

/** Exemple chargé et validé ; échoue bruyamment s'il ne l'est pas. */
export function fixtureDocument(name: string): CreativeDocument {
  const result = loadDocument(rawFixture(name));
  if (result.status !== "ok") throw new Error(`Exemple invalide ${name} : ${JSON.stringify(result)}`);
  return result.document;
}
