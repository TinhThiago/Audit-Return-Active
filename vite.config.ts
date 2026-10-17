import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { powerApps } from "@microsoft/power-apps-vite";
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  const browser = env.VITE_RUNTIME_MODE === "browser";
  return {
    plugins: [react(), ...(!browser ? [powerApps()] : [])],
    base: browser ? (env.VITE_BASE_PATH ?? "/Audit-Return-Active/") : "./",
    server: { host: "localhost", port: 5173, strictPort: true },
    build: browser
      ? {
          outDir: "dist-pages",
          rollupOptions: {
            input: { main: "index.html", callback: "auth-callback.html" },
          },
        }
      : { outDir: "dist" },
  };
});
