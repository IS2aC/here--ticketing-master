import type { CreativeDocument } from "../document/types.ts";
import type { Issue } from "./issues.ts";
import { loadDocument, validateDocument, type LoadOptions, type LoadResult } from "./validate.ts";

export type SerializeResult =
  { readonly ok: true; readonly json: string } | { readonly ok: false; readonly issues: readonly Issue[] };

/** Clés triées : deux documents égaux produisent le même texte (diffs lisibles, empreintes stables). */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

/** JSON du document. Un document invalide n'est jamais sérialisé : on renvoie ses problèmes. */
export function serializeDocument(
  document: CreativeDocument,
  options: { pretty?: boolean } = {},
): SerializeResult {
  const issues = validateDocument(document);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, json: JSON.stringify(sortKeys(document), null, options.pretty ? 2 : undefined) };
}

/** Lit un JSON non fiable : analyse, contrôle de version, migration éventuelle, validation complète. */
export function deserializeDocument(json: string, options: LoadOptions = {}): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      status: "invalid",
      issues: [{ path: "", code: "invalid_json", message: `JSON illisible : ${detail}` }],
    };
  }
  return loadDocument(parsed, options);
}
