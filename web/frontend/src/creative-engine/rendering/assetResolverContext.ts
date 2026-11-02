import { createContext, useContext } from "react";
import type { ImageAsset } from "../domain/document/types.ts";
import type { Id } from "../domain/ids.ts";

/**
 * Traduit une ressource du document en URL affichable. Le document ne contient que des clés de stockage ;
 * c'est l'application hôte qui sait où sont les fichiers (démo locale aujourd'hui, stockage serveur demain).
 * null : fichier introuvable, l'élément affiche alors un état d'erreur.
 */
export type AssetUrlResolver = (assetId: Id, asset: ImageAsset) => string | null;

export const AssetResolverContext = createContext<AssetUrlResolver>(() => null);

export function useAssetResolver(): AssetUrlResolver {
  return useContext(AssetResolverContext);
}
