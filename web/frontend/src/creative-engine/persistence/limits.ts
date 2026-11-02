// Limites de la persistance, centralisées. Elles protègent l'appareil (quota) et le futur serveur (entrées).

/**
 * Taille maximale du JSON d'un document, sans les images (stockées à part). Un document de 1000 éléments
 * (limite du modèle) pèse environ 1 Mo : 5 Mo laissent une marge large sans accepter n'importe quoi.
 */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

/** Taille maximale d'un fichier .here.json importé ou exporté, images intégrées comprises (ADR-007). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/**
 * Image importée depuis l'appareil. 10 Mo couvrent les photos de téléphone ; au-delà, l'image alourdirait
 * l'export .here.json (25 Mo, images comprises) sans gain visible sur une carte.
 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Nombre de pixels d'une image importée : 25 Mpx (6000 × 4000), soit 100 Mo une fois décodée. */
export const MAX_IMAGE_PIXELS = 25_000_000;

/** Délai entre la dernière modification et la sauvegarde automatique. */
export const AUTOSAVE_DELAY_MS = 1000;

/** Nouvelles tentatives automatiques après un échec d'enregistrement, puis l'utilisateur reprend la main. */
export const RETRY_DELAYS_MS: readonly number[] = [2000, 5000, 15000];

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
