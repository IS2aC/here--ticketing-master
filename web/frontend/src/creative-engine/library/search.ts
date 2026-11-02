import type { ResultPage } from "./contracts.ts";

// Recherche simple, suffisante pour un catalogue de quelques dizaines d'éléments : chaque mot de la requête
// doit apparaître dans le texte de l'élément, sans tenir compte des accents ni des majuscules
// (« bapteme » trouve « Baptême »). Un catalogue distant ferait la même chose côté serveur.

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 100;

/** Minuscules, sans accents ni ponctuation superflue. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

/** Vrai si chaque mot de `query` figure dans l'un des champs. Une requête vide trouve tout. */
export function matchesQuery(query: string | undefined, fields: readonly string[]): boolean {
  const words = normalizeText(query ?? "")
    .split(" ")
    .filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeText(fields.join(" "));
  return words.every((word) => haystack.includes(word));
}

/**
 * Découpe une liste déjà filtrée. Le curseur est la position de départ : il reste cohérent tant que la requête
 * ne change pas. Un nouveau filtre repart de la première page.
 */
export function paginate<T>(items: readonly T[], cursor?: string | null, limit?: number): ResultPage<T> {
  const size = Math.min(Math.max(1, Math.floor(limit ?? DEFAULT_PAGE_SIZE)), MAX_PAGE_SIZE);
  const parsed = cursor ? Number.parseInt(cursor, 10) : 0;
  const start = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const end = start + size;
  return {
    items: items.slice(start, end),
    total: items.length,
    nextCursor: end < items.length ? String(end) : null,
  };
}
