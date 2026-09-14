import { defineHandler, readBody } from "nitro/h3";
import {
  isTargetName,
  setShopTarget,
  setTargetCookie,
} from "../utils/routing.ts";

// Proxy-owned endpoint (never forwarded). The in-app toggle POSTs here to flip
// a shop's environment, then reloads so the new target serves the document.
export default defineHandler(async (event) => {
  const body = await readBody<{ shop?: string; target?: string }>(event);
  const shop = body?.shop;
  const target = body?.target;

  if (!shop || !/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) {
    event.res.status = 400;
    return { ok: false, error: "invalid shop" };
  }
  if (!isTargetName(target)) {
    event.res.status = 400;
    return { ok: false, error: "invalid target" };
  }

  await setShopTarget(shop, target);
  setTargetCookie(event, target);

  console.log(`[proxy switch] ${shop} -> ${target}`);
  return { ok: true, target };
});
