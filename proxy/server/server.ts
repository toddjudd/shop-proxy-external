import { defineHandler, proxyRequest } from "nitro/h3";

const TARGETS = {
  production: process.env.PROD_APP_URL || "http://localhost:3001",
  sandbox: process.env.SANDBOX_APP_URL || "http://localhost:3002",
} as const;

// Flip this to send all traffic at the other copy of the app.
const ACTIVE_TARGET: keyof typeof TARGETS = "production";

export default defineHandler((event) => {
  const target = new URL(
    event.url.pathname + event.url.search,
    TARGETS[ACTIVE_TARGET],
  );

  console.log(
    `[proxy -> ${ACTIVE_TARGET}] ${event.req.method} ${event.url.pathname}`,
  );

  // Node's fetch always rewrites Host to the target, so the upstream only
  // learns the public origin via X-Forwarded-*.
  return proxyRequest(event, target.href, { xfwd: true });
});
