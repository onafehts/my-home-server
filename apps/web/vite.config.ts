import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = dirname(fileURLToPath(import.meta.url)); // apps/web
const repoRoot = resolve(here, "../..");

export default defineConfig({
  plugins: [react()],
  // Read VITE_* vars from the repo-root .env (shared with the rest of the stack).
  envDir: repoRoot,
  resolve: {
    alias: {
      // Consume the shared package as source so Vite transpiles it directly.
      "@arena/core": resolve(repoRoot, "packages/core/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      // Allow importing files from the monorepo root (the aliased package).
      allow: [repoRoot],
    },
  },
});
