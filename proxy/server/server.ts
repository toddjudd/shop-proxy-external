import { defineHandler, proxyRequest } from "nitro/h3";
import {
  DEFAULT_TARGET,
  TARGETS,
  getShopTarget,
  getTargetCookie,
  isTargetName,
  resolveShop,
  setTargetCookie,
} from "./utils/routing.ts";

export default defineHandler(async (event) => {
  const shop = resolveShop(event);

  // Shop-bearing requests resolve from the KV source of truth and refresh the
  // sticky cookie; shopless requests (assets) ride that cookie.
  let activeTarget = DEFAULT_TARGET;
  if (event.url.pathname === "/whiplash/callback") {
    // OAuth callback carries no shop and can't rely on the partitioned cookie;
    // the ?env marker (baked into the registered redirect URI) is the source.
    const env = event.url.searchParams.get("env");
    activeTarget = isTargetName(env) ? env : DEFAULT_TARGET;
  } else if (shop) {
    activeTarget = (await getShopTarget(shop)) ?? DEFAULT_TARGET;
    setTargetCookie(event, activeTarget);
  } else {
    activeTarget = getTargetCookie(event) ?? DEFAULT_TARGET;
  }

  const target = new URL(
    event.url.pathname + event.url.search,
    TARGETS[activeTarget],
  );

  console.log(
    `[proxy -> ${activeTarget}] ${event.req.method} ${event.url.pathname}`,
  );

  // Node's fetch always rewrites Host to the target, so the upstream only
  // learns the public origin via X-Forwarded-*.
  return proxyRequest(event, target.href, { xfwd: true });
});
