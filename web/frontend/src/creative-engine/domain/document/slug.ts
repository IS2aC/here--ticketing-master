// Nom de fichier lisible tiré d'un titre (« Invitation de Awa » → « invitation-de-awa ») : minuscules, sans
// accents, tirets. Partagé par le fichier .here.json et l'export.

export function titleSlug(title: string, maxLength = 60): string {
  return title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength)
    .replace(/-$/, "");
}
