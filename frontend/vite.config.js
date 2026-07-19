import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";


export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:4000/api" || "https://ai-travel-assistant-travellis-backend.onrender.com/api",
        changeOrigin: true,
      },
    },
  },
});
