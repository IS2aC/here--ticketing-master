// Documents des modèles intégrés, chargés un par un à l'utilisation. Généré depuis templates/*.json :
// Next (Turbopack) ne connaît pas import.meta.glob. À compléter quand `library:build` ajoute un modèle.
export const TEMPLATE_DOCUMENTS: Readonly<Record<string, () => Promise<unknown>>> = {
  "./templates/anniversaire-confettis.json": () => import("./templates/anniversaire-confettis.json").then((m: { default: unknown }) => m.default),
  "./templates/bapteme-douceur.json": () => import("./templates/bapteme-douceur.json").then((m: { default: unknown }) => m.default),
  "./templates/dot-motifs-wax.json": () => import("./templates/dot-motifs-wax.json").then((m: { default: unknown }) => m.default),
  "./templates/festival-nuit-couleurs.json": () => import("./templates/festival-nuit-couleurs.json").then((m: { default: unknown }) => m.default),
  "./templates/mariage-feuillage-dore.json": () => import("./templates/mariage-feuillage-dore.json").then((m: { default: unknown }) => m.default),
  "./templates/seminaire-ondes.json": () => import("./templates/seminaire-ondes.json").then((m: { default: unknown }) => m.default),
};
