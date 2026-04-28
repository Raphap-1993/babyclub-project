import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/backoffice"),
      "@repo/ui": path.resolve(__dirname, "packages/ui/src/index.ts"),
      shared: path.resolve(__dirname, "packages/shared"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
  },
});
