import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/**/*.test.ts",
      "client/src/**/*.test.{ts,tsx}",
    ],
    setupFiles: ["./client/src/test-setup.ts", "./client/src/test/setup.ts"],
    environmentOptions: {
      jsdom: {},
    },
  },
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
});
