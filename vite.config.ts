import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay({
      filter(err) {
        // Suppress resource-load false positives.
        // When a browser resource (img/video/font) fails to load, window.onerror
        // fires with evt.error === null.  The plugin converts that null into a
        // synthetic Error("(unknown runtime error)").  Those are not app crashes —
        // filter them out so Replit's crash reporter isn't triggered by a missing
        // avatar or a blocked HLS segment.
        if (err.message === "(unknown runtime error)") return false;
        // Also suppress NotAllowedError thrown by video.play() when autoplay is
        // blocked — the player already handles this gracefully.
        if (err.name === "NotAllowedError") return false;
        return true;
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
