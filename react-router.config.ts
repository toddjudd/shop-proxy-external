import type { Config } from "@react-router/dev/config";

// The external proxy forwards requests to this app on localhost, so action
// submissions arrive with a public Origin that never matches the internal
// host and would otherwise trip React Router's CSRF guard. Trust the app's own
// public origin (derived from the tunnel URL) plus common dev tunnel domains.
const allowedActionOrigins = [
  "*.ngrok.io",
  "*.ngrok-free.app",
  "*.ngrok.app",
  "*.trycloudflare.com",
];

const publicUrl = process.env.SHOPIFY_APP_URL || process.env.HOST;
if (publicUrl) {
  try {
    allowedActionOrigins.unshift(new URL(publicUrl).host);
  } catch {
    // Ignore a malformed public URL; the wildcard patterns still apply.
  }
}

export default {
  allowedActionOrigins,
} satisfies Config;
