/** Téléchargement d'un fichier produit dans la page ; faux si le navigateur a refusé de le démarrer. */
export function download(blob: Blob, fileName: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    // Le navigateur a lu l'URL au clic : elle peut être libérée au prochain tour.
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
    return true;
  } catch {
    return false;
  }
}
