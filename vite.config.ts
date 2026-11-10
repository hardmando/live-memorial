import { defineConfig } from "vite";

export default defineConfig({
  // https://vitejs.dev/config/
  server: { allowedHosts: [".trycloudflare.com"] }
});

