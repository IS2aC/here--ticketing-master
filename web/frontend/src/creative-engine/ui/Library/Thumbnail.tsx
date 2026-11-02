import { useState } from "react";
import styles from "./Library.module.css";

/**
 * Vignette aux proportions de l'élément, réservées avant le chargement (pas de saut de mise en page).
 * Une vignette absente ou en échec affiche un emplacement neutre sans bloquer le reste de la grille.
 */
export function Thumbnail({
  url,
  width,
  height,
  alt = "",
  eager = false,
}: {
  url: string | null;
  width: number;
  height: number;
  alt?: string;
  eager?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = url === null || failedUrl === url;
  return (
    <span className={styles.thumbnail} style={{ aspectRatio: `${width} / ${height}` }}>
      {failed ? (
        <span className={styles.thumbnailMissing}>Aperçu indisponible</span>
      ) : (
        <img
          src={url}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => {
            setFailedUrl(url);
          }}
        />
      )}
    </span>
  );
}
