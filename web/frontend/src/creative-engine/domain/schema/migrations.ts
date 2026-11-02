import { CURRENT_SCHEMA_VERSION } from "../document/types.ts";

/** Transforme un document brut de la version N vers la version N + 1. Pure ; elle ne valide pas. */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migrations connues, indexées par version de départ. Aucune pour l'instant : la version 1 est la première.
 * Ajouter une version : incrémenter CURRENT_SCHEMA_VERSION, ajouter MIGRATIONS[ancienne] et un fichier de
 * référence figé de l'ancienne version dans tests/fixtures, puis tester la migration sur ce fichier.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export type MigrationResult =
  | { readonly ok: true; readonly raw: Record<string, unknown> }
  | { readonly ok: false; readonly reason: "unsupported_version" }
  | {
      readonly ok: false;
      readonly reason: "migration_failed";
      readonly fromVersion: number;
      readonly message: string;
    };

/** Versions lisibles : la courante et toutes celles depuis lesquelles une chaîne de migrations y mène. */
export function supportedVersions(
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  current: number = CURRENT_SCHEMA_VERSION,
): number[] {
  const versions = [current];
  for (let v = current - 1; migrations[v] !== undefined; v--) versions.unshift(v);
  return versions;
}

export function migrateToCurrent(
  raw: Record<string, unknown>,
  fromVersion: number,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  current: number = CURRENT_SCHEMA_VERSION,
): MigrationResult {
  if (!supportedVersions(migrations, current).includes(fromVersion))
    return { ok: false, reason: "unsupported_version" };

  let migrated = raw;
  for (let version = fromVersion; version < current; version++) {
    const migration = migrations[version];
    if (!migration) return { ok: false, reason: "unsupported_version" };
    try {
      migrated = { ...migration(migrated), schemaVersion: version + 1 };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, reason: "migration_failed", fromVersion: version, message };
    }
  }
  return { ok: true, raw: migrated };
}
