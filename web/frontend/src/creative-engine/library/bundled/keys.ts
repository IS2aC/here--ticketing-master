// Clés de stockage des ressources intégrées au moteur. Ces fichiers sont servis avec l'application ; lors de
// l'intégration, Here! pourra servir les mêmes clés depuis son stockage. Un document ne contient que la clé,
// jamais l'URL (qui change à chaque build).

export const BUNDLED_PREFIX = "bundled/";

export function ornamentKey(id: string): string {
  return `${BUNDLED_PREFIX}ornaments/${id}.webp`;
}
