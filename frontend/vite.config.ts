import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Standalone Vite development only. Vercel Services routes /api/* before
  // requests enter this service; deployed browser requests stay same-origin.
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
  build: {
    rollupOptions: { output: { manualChunks: { charts: ["recharts"] } } },
  },
});
