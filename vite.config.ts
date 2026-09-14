import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
// Replace the HOST env var with SHOPIFY_APP_URL so that it doesn't break the Vite server.
// The CLI will eventually stop passing in HOST,
// so we can remove this workaround after the next major release.
if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost")
  .hostname;

// Each app instance needs its own HMR port so two copies can run side by side.
const hmrPort =
  Number(process.env.HMR_PORT) || parseInt(process.env.FRONTEND_PORT!) || 8002;

// Browsers treat localhost as a secure context, so ws:// HMR isn't blocked as
// mixed content even when the page loads over the tunnel's https:// origin.
// This intentionally ignores `host` (the tunnel domain): binding the HMR
// listener there fails since it doesn't resolve to a local interface, and for
// same-machine dev there's no need to route HMR through the tunnel at all.
const hmrConfig = {
  protocol: "ws" as const,
  host: "localhost",
  port: hmrPort,
  clientPort: hmrPort,
};

export default defineConfig({
  server: {
    allowedHosts: [host],
    cors: {
      preflightContinue: true,
    },
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
      allow: ["app", "node_modules"],
    },
  },
  plugins: [reactRouter(), tsconfigPaths()],
  build: {
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    include: ["@shopify/app-bridge-react"],
  },
}) satisfies UserConfig;
