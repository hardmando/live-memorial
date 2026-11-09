import { defineConfig } from "vite";

export default defineConfig({
    // https://vitejs.dev/config/
    server: {
        // Bind to IPv4 loopback so `cloudflared --url http://localhost:5173` can reach it
        host: "127.0.0.1",
        port: 5173,
        strictPort: true,
        // Allow Cloudflare quick-tunnel hostnames (Vite blocks unknown hosts by default)
        allowedHosts: [".trycloudflare.com"],
    },
});
