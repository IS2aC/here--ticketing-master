// Saisie de nombres à la française : virgule ou point décimal, espaces de milliers tolérées.

const NUMBER = /^-?(\d+([.,]\d*)?|[.,]\d+)$/;

/** Nombre saisi, ou null si le texte n'en est pas un (vide compris). */
export function parseNumber(text: string): number | null {
  const compact = text.replace(/[\s\u00A0\u202F]/g, "");
  if (!NUMBER.test(compact)) return null;
  const value = Number(compact.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** Valeur affichée dans un champ : au plus `decimals` décimales, virgule, sans séparateur de milliers. */
export function formatInputNumber(value: number, decimals = 2): string {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: decimals, useGrouping: false });
}
