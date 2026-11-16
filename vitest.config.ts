import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["@testing-library/jest-dom/vitest"],
    include: [
      "packages/**/tests/**/*.test.ts",
      "packages/**/tests/**/*.test.tsx",
      "apps/api/tests/**/*.test.ts",
      "apps/web/tests/**/*.test.ts",
      "apps/web/tests/**/*.test.tsx",
      "apps/extension/tests/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "e2e/**"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["packages/*/src/**", "apps/api/src/**"],
    },
  },
});
