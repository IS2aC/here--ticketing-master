import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Creative Engine (src/creative-engine) : frontières des couches reprises du dépôt du moteur (ADR-005).
// Expression régulière : un motif de chemin (« konva ») viserait aussi le dossier rendering/konva/.
const RENDERING_LIBS = { regex: "^(konva|react-konva)(/.*)?$", message: "Konva est réservé à creative-engine/rendering (ADR-005)." };
const UI_LAYER = { group: ["**/ui/**", "**/host/**"], message: "L'état et le domaine ne dépendent pas de l'interface." };
const REACT = ["react", "react-dom", "react/*", "zustand", "zustand/*"];
const CE = "src/creative-engine";

/** Couche du moteur : n'importe ni Konva, ni l'interface, ni React, ni les couches listées. */
function layer(dir, message, forbidden, ext = "ts") {
  return {
    files: [`${CE}/${dir}/**/*.${ext}`],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [RENDERING_LIBS, UI_LAYER, { group: REACT, message }, { group: forbidden, message }] },
      ],
    },
  };
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Konva n'est utilisé que par le moteur de rendu de l'éditeur.
    files: ["src/**/*.{ts,tsx}"],
    ignores: [`${CE}/rendering/**`],
    rules: { "no-restricted-imports": ["error", { patterns: [RENDERING_LIBS] }] },
  },
  {
    files: [`${CE}/editor/**/*.{ts,tsx}`],
    rules: { "no-restricted-imports": ["error", { patterns: [RENDERING_LIBS, UI_LAYER] }] },
  },
  layer("domain", "Le domaine est du TypeScript pur, sans autre couche (ADR-005).", ["**/editor/**", "**/rendering/**"]),
  layer("persistence", "La persistance ne dépend que du domaine.", ["**/editor/**", "**/rendering/**"]),
  layer("library", "Les bibliothèques ne dépendent que du domaine et de la persistance.", ["**/editor/**", "**/rendering/**"]),
  layer("export", "L'export ne dépend que du domaine et du moteur de rendu.", ["**/editor/**", "**/persistence/**", "**/library/**"]),
  layer("integrations", "Les intégrations ne dépendent d'aucune couche de l'éditeur.", [
    "**/editor/**",
    "**/rendering/**",
    "**/library/**",
    "**/export/**",
  ]),
  {
    // Code de l'éditeur : textes en français dans le JSX (apostrophes) ; images locales en blob: ou data:,
    // que next/image ne sait pas servir.
    files: [`${CE}/**/*.tsx`],
    rules: { "react/no-unescaped-entities": "off", "@next/next/no-img-element": "off" },
  },
]);

export default eslintConfig;
