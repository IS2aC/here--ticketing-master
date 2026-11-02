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
      // Tailwind ne traite que la feuille globale (elle importe les fonts et tokens de la marque) : les CSS
      // modules de l'éditeur de cartes (src/creative-engine) gardent le traitement natif de Next.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
