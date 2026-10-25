import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image Docker minimale : .next/standalone + server.js (voir Dockerfile).
  output: "standalone",
  // Polices lues à l'exécution pour dessiner les cartes d'invitation (src/lib/card/fonts.ts).
  outputFileTracingIncludes: { "/**": ["./src/styles/brand/fonts/*.ttf"] },
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Import de la liste d'invités : fichiers jusqu'à 5 Mo (limite de l'API).
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
