import type { CreativeDocument } from "../document/types.ts";
import { CURRENT_SCHEMA_VERSION } from "../document/types.ts";
import { formatPath, safeParseFr, toIssues, type Issue } from "./issues.ts";
import { MIGRATIONS, migrateToCurrent, supportedVersions, type Migration } from "./migrations.ts";
import { documentSchema } from "./schema.ts";

/**
 * Résultat du chargement de données externes.
 * - ok : document valide, éventuellement avec des avertissements (champs inconnus retirés, migration appliquée).
 * - invalid : document rejeté, avec la liste des problèmes. Rien n'est corrigé en silence.
 * - unsupported_version : version absente, plus récente que le moteur, ou ancienne sans migration.
 */
export type LoadResult =
  | { readonly status: "ok"; readonly document: CreativeDocument; readonly warnings: readonly Issue[] }
  | { readonly status: "invalid"; readonly issues: readonly Issue[] }
  | {
      readonly status: "unsupported_version";
      readonly version: unknown;
      readonly supported: readonly number[];
      readonly message: string;
    };

export interface LoadOptions {
  /** Pour les tests : registre de migrations à la place du registre réel. */
  readonly migrations?: Readonly<Record<number, Migration>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Valide des données non fiables et renvoie un document utilisable.
 * Politique des champs inconnus : un document dont le SEUL problème est la présence de champs inconnus est
 * accepté ; ces champs sont retirés et chacun est signalé par un avertissement « unknown_field ». L'appelant
 * décide de l'afficher ; les données d'origine ne sont pas modifiées. Toute autre erreur rejette le document.
 */
export function loadDocument(input: unknown, options: LoadOptions = {}): LoadResult {
  const migrations = options.migrations ?? MIGRATIONS;
  if (!isRecord(input)) {
    return { status: "invalid", issues: [{ path: "", code: "invalid_type", message: "Objet JSON attendu" }] };
  }

  const version = input.schemaVersion;
  const supported = supportedVersions(migrations);
  if (typeof version !== "number" || !Number.isInteger(version) || !supported.includes(version)) {
    const newer = typeof version === "number" && version > CURRENT_SCHEMA_VERSION;
    return {
      status: "unsupported_version",
      version,
      supported,
      message: newer
        ? `Document créé avec une version plus récente du schéma (${version}) ; versions lisibles : ${supported.join(", ")}`
        : `Version de schéma non prise en charge : ${version === undefined ? "absente" : JSON.stringify(version)}`,
    };
  }

  const warnings: Issue[] = [];
  let raw = input;
  if (version !== CURRENT_SCHEMA_VERSION) {
    const migrated = migrateToCurrent(input, version, migrations);
    if (!migrated.ok) {
      if (migrated.reason === "unsupported_version") {
        return {
          status: "unsupported_version",
          version,
          supported,
          message: `Aucune migration depuis la version ${version}`,
        };
      }
      return {
        status: "invalid",
        issues: [
          {
            path: "schemaVersion",
            code: "migration_failed",
            message: `Migration depuis la version ${migrated.fromVersion} impossible : ${migrated.message}`,
          },
        ],
      };
    }
    raw = migrated.raw;
    warnings.push({
      path: "schemaVersion",
      code: "migrated",
      message: `Document migré de la version ${version} à ${CURRENT_SCHEMA_VERSION}`,
    });
  }

  const first = safeParseFr(documentSchema, raw);
  if (first.success) return { status: "ok", document: first.data, warnings };

  const unknownKeys = first.error.issues.filter((issue) => issue.code === "unrecognized_keys");
  if (unknownKeys.length !== first.error.issues.length) {
    return { status: "invalid", issues: toIssues(first.error.issues) };
  }

  // Seuls des champs inconnus posent problème : on les retire d'une copie, puis on revalide entièrement
  // (les règles transverses ne s'exécutent qu'une fois la structure correcte).
  const cleaned = structuredClone(raw);
  for (const issue of unknownKeys) {
    const parent = issue.path.reduce<unknown>(
      (node, key) =>
        isRecord(node) || Array.isArray(node) ? (node as Record<PropertyKey, unknown>)[key] : undefined,
      cleaned,
    );
    for (const key of issue.keys) {
      if (isRecord(parent)) Reflect.deleteProperty(parent, key);
      const path = formatPath([...issue.path, key]);
      warnings.push({ path, code: "unknown_field", message: `Champ inconnu ignoré : ${path}` });
    }
  }

  const second = safeParseFr(documentSchema, cleaned);
  if (!second.success) return { status: "invalid", issues: toIssues(second.error.issues) };
  return { status: "ok", document: second.data, warnings };
}

/** Problèmes d'un document déjà typé (par exemple produit par du code) : vide si valide. */
export function validateDocument(document: CreativeDocument): Issue[] {
  const result = safeParseFr(documentSchema, document);
  return result.success ? [] : toIssues(result.error.issues);
}
