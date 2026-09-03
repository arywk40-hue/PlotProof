import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Camera access requires HTTPS on real devices except on localhost.
    // For testing on a phone over LAN during the hackathon, run this
    // behind a tool like `ngrok` or `vite --https` with a local cert.
  },
});
