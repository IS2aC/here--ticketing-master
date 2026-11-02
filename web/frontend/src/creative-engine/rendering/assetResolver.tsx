import type { ReactNode } from "react";
import { AssetResolverContext, type AssetUrlResolver } from "./assetResolverContext.ts";

export function AssetResolverProvider({
  resolver,
  children,
}: {
  resolver: AssetUrlResolver;
  children: ReactNode;
}) {
  return <AssetResolverContext value={resolver}>{children}</AssetResolverContext>;
}
