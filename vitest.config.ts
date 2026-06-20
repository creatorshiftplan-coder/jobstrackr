import { defineConfig } from "vitest/config";
import path from "path";

// Lightweight config for unit tests. The main vite.config.ts wires dev-only
// Python/Supabase middleware we don't want to load during tests, so the test
// runner uses its own minimal config that only reuses the "@" path alias.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
