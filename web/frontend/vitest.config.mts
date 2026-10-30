import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests du moteur des cartes (lib/card/templates) : logique pure, sans navigateur ni serveur Next.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.test.{ts,tsx}"] },
});
