import { getCookie, getRequestHeader, setCookie } from "nitro/h3";
import { useStorage } from "nitro/storage";
import type { H3Event } from "nitro/h3";

export const TARGETS = {
  production: process.env.PROD_APP_URL || "http://localhost:3001",
  sandbox: process.env.SANDBOX_APP_URL || "http://localhost:3002",
} as const;

export type TargetName = keyof typeof TARGETS;

export const DEFAULT_TARGET: TargetName = "production";

const COOKIE_NAME = "proxy_target";

// KV maps a shop domain to its chosen environment; it is the source of truth.
const store = () => useStorage("proxy");

export function isTargetName(value: unknown): value is TargetName {
  return typeof value === "string" && value in TARGETS;
}

export async function getShopTarget(shop: string): Promise<TargetName | null> {
  const stored = await store().getItem<string>(`shop:${shop}`);
  return isTargetName(stored) ? stored : null;
}

export async function setShopTarget(
  shop: string,
  target: TargetName,
): Promise<void> {
  await store().setItem(`shop:${shop}`, target);
}

// The routing cookie keeps asset/subrequests (which carry no shop) on the
// same environment as the document that loaded them.
export function setTargetCookie(event: H3Event, target: TargetName): void {
  setCookie(event, COOKIE_NAME, target, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "none",
    partitioned: true,
  });
}

export function getTargetCookie(event: H3Event): TargetName | null {
  const value = getCookie(event, COOKIE_NAME);
  return isTargetName(value) ? value : null;
}

/**
 * Best-effort shop lookup. Full-page loads carry `?shop=`; App Bridge fetches
 * carry a session-token JWT whose `dest` is the shop. The token is only used
 * for routing, so its signature is not verified here.
 */
export function resolveShop(event: H3Event): string | null {
  const fromQuery = event.url.searchParams.get("shop");
  if (fromQuery) return fromQuery;

  const auth = getRequestHeader(event, "authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const dest = JSON.parse(json).dest as string | undefined;
    return dest ? dest.replace(/^https?:\/\//, "") : null;
  } catch {
    return null;
  }
}
