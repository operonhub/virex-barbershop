import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Los proveedores del agente importan `server-only`, que fuera de Next tira error.
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
  test:
    // `npm test`: sólo tests puros (sin red ni base). `npm run test:integration`:
    // los que tocan la base real (DATABASE_URL) y limpian lo que crean.
    mode === "integration"
      ? { include: ["src/**/*.integration.test.ts"], environment: "node", testTimeout: 30_000, hookTimeout: 30_000 }
      : { include: ["src/**/*.test.ts"], exclude: ["**/*.integration.test.ts", "**/node_modules/**"], environment: "node" },
}))
