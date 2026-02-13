import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "client",
  server: {
    port: 5166,
    proxy: {
      "/api": "http://localhost:3006",
      "/ws": {
        target: "ws://localhost:3006",
        ws: true,
      },
    },
  },
  build: {
    outDir: "../dist",
  },
});
