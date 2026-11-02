// Erreurs d'export : un code que l'appelant peut traiter, un message compréhensible par l'utilisateur, et le
// détail utile (éléments en cause) sans information interne. Un export en échec ne produit jamais de fichier.

export type ExportErrorCode =
  /** Le document ne respecte pas le schéma. */
  | "invalid_document"
  /** Format inconnu ou options hors des valeurs permises. */
  | "invalid_options"
  /** Le fichier dépasserait les limites du navigateur (pixels, côté). */
  | "too_large"
  /** Une image du document est introuvable ou illisible. */
  | "missing_assets"
  /** Une image vient d'une origine qui interdit de lire ses pixels (CORS) : le navigateur bloque l'export. */
  | "asset_blocked"
  /** Une police du document n'a pas pu être chargée. */
  | "font_unavailable"
  /** Le dessin du document a échoué. */
  | "render_failed"
  /** La conversion en PNG, JPEG ou PDF a échoué (souvent : mémoire insuffisante). */
  | "encode_failed"
  /** Export annulé par l'utilisateur. */
  | "aborted";

export interface ExportError {
  readonly code: ExportErrorCode;
  readonly message: string;
  /** Éléments ou ressources en cause, lisibles (noms de calques, polices). */
  readonly details?: readonly string[];
}

export type ExportOutcome<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ExportError };

export const ok = <T>(value: T): ExportOutcome<T> => ({ ok: true, value });
export const fail = <T>(
  code: ExportErrorCode,
  message: string,
  details?: readonly string[],
): ExportOutcome<T> => ({
  ok: false,
  error: details && details.length > 0 ? { code, message, details } : { code, message },
});

export const ABORTED: ExportError = { code: "aborted", message: "Export annulé." };
