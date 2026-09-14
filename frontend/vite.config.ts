import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages hosts the frontend under /Call-Agent/.
// VITE_BACKEND_URL configures the independently deployed backend (not a secret).
export default defineConfig({
  plugins: [react()],
  base: "/Call-Agent/",
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
