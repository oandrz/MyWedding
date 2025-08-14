import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Local development configuration without Replit-specific plugins
export default defineConfig({
  plugins: [
    react(),
    // Remove Replit-specific plugins for local development
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  envPrefix: 'VITE_',
});