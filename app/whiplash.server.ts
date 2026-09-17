import crypto from "crypto";
import prisma from "./db.server";
import { decrypt, encrypt } from "./crypto.server";
import type { WhiplashConnection } from "@prisma/client";

// Refresh the access token when it's within this window of expiring.
const REFRESH_SKEW_MS = 60_000;
// OAuth state rows older than this are considered stale.
const STATE_TTL_MS = 10 * 60_000;

export interface WhiplashConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  redirectUri: string;
}

export interface WhiplashCustomer {
  id: number;
  name: string;
}

export function getConfig(): WhiplashConfig {
  const baseUrl = process.env.WHIPLASH_BASE_URL;
  const clientId = process.env.WHIPLASH_CLIENT_ID;
  const clientSecret = process.env.WHIPLASH_CLIENT_SECRET;
  if (!baseUrl || !clientId || !clientSecret) {
    throw new Error(
      "Whiplash is not configured (WHIPLASH_BASE_URL / WHIPLASH_CLIENT_ID / WHIPLASH_CLIENT_SECRET)",
    );
  }
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    clientId,
    clientSecret,
    scopes: process.env.WHIPLASH_SCOPES || "user_read",
    redirectUri: resolveRedirectUri(),
  };
}

// Prefer an explicit redirect URI; otherwise derive from the app URL, tagging
// non-production instances with ?env so the proxy can route the callback.
function resolveRedirectUri(): string {
  const explicit = process.env.WHIPLASH_REDIRECT_URI;
  if (explicit) return explicit;

  const appUrl = (process.env.SHOPIFY_APP_URL || "").replace(/\/$/, "");
  const env = process.env.ENVIRONMENT;
  const suffix = env && env !== "production" ? `?env=${env}` : "";
  return `${appUrl}/whiplash/callback${suffix}`;
}

// --- PKCE helpers -----------------------------------------------------------

function base64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(
    crypto.createHash("sha256").update(verifier).digest(),
  );
  return { verifier, challenge };
}

// --- OAuth handshake --------------------------------------------------------

export async function createOAuthState(input: {
  shop: string;
  host: string | null;
}): Promise<{ state: string; challenge: string }> {
  const state = base64Url(crypto.randomBytes(24));
  const { verifier, challenge } = createPkcePair();

  await prisma.whiplashOAuthState.create({
    data: {
      state,
      shop: input.shop,
      codeVerifier: verifier,
      host: input.host,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    },
  });

  return { state, challenge };
}

export function buildAuthorizeUrl(state: string, challenge: string): string {
  const config = getConfig();
  const url = new URL("/oauth/authorize", config.baseUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  scope?: string;
  expires_in?: number;
}

async function requestToken(
  body: Record<string, string>,
): Promise<TokenResponse> {
  const config = getConfig();
  const res = await fetch(new URL("/oauth/token", config.baseUrl).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...body,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whiplash token request failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const config = getConfig();
  return requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });
}

export function refreshToken(refresh: string): Promise<TokenResponse> {
  return requestToken({
    grant_type: "refresh_token",
    refresh_token: refresh,
  });
}

export async function revokeToken(token: string): Promise<void> {
  const config = getConfig();
  await fetch(new URL("/oauth/revoke", config.baseUrl).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      token,
    }),
  }).catch(() => {
    // Best-effort: a failed revoke shouldn't block local disconnect.
  });
}

// --- Authenticated API calls ------------------------------------------------

export interface WhiplashMe {
  id: number;
  email?: string;
  full_name?: string;
  role?: string;
  customer_ids?: number[];
}

async function apiGet<T>(
  accessToken: string,
  path: string,
  customerId?: number | null,
): Promise<T> {
  const config = getConfig();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
  if (customerId) headers["X-Customer-Id"] = String(customerId);

  const res = await fetch(new URL(path, config.baseUrl).toString(), {
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whiplash GET ${path} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

export function fetchMe(accessToken: string): Promise<WhiplashMe> {
  return apiGet<WhiplashMe>(accessToken, "/api/v2/me");
}

export async function fetchCustomers(
  accessToken: string,
): Promise<WhiplashCustomer[]> {
  const rows = await apiGet<Array<{ id: number; name: string }>>(
    accessToken,
    "/api/v2/customers",
  );
  return rows.map((c) => ({ id: c.id, name: c.name }));
}

// --- Persistence ------------------------------------------------------------

function expiresAtFrom(token: TokenResponse): Date | null {
  return token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000)
    : null;
}

export async function saveConnectionFromToken(input: {
  shop: string;
  token: TokenResponse;
  me: WhiplashMe;
  customers: WhiplashCustomer[];
}): Promise<void> {
  const { shop, token, me, customers } = input;
  const autoCustomer = customers.length === 1 ? customers[0] : null;

  const data = {
    accessToken: encrypt(token.access_token),
    refreshToken: token.refresh_token ? encrypt(token.refresh_token) : null,
    expiresAt: expiresAtFrom(token),
    scope: token.scope ?? null,
    whiplashUserId: me.id,
    whiplashUserEmail: me.email ?? null,
    whiplashUserName: me.full_name ?? null,
    whiplashUserRole: me.role ?? null,
    customers: JSON.stringify(customers),
    selectedCustomerId: autoCustomer?.id ?? null,
    selectedCustomerName: autoCustomer?.name ?? null,
    status: "connected",
    connectedAt: new Date(),
    lastRefreshedAt: new Date(),
  };

  await prisma.whiplashConnection.upsert({
    where: { shop },
    create: { shop, ...data },
    update: data,
  });
}

// Returns a valid access token for the shop, refreshing if needed. Null when
// there is no connection or the token can't be refreshed.
export async function getValidAccessToken(
  shop: string,
): Promise<string | null> {
  const connection = await prisma.whiplashConnection.findUnique({
    where: { shop },
  });
  if (!connection || connection.status !== "connected") return null;

  const notExpiring =
    !connection.expiresAt ||
    connection.expiresAt.getTime() - Date.now() > REFRESH_SKEW_MS;
  if (notExpiring) {
    return decrypt(connection.accessToken);
  }

  if (!connection.refreshToken) {
    await markError(shop);
    return null;
  }

  try {
    const token = await refreshToken(decrypt(connection.refreshToken));
    await prisma.whiplashConnection.update({
      where: { shop },
      data: {
        accessToken: encrypt(token.access_token),
        refreshToken: token.refresh_token
          ? encrypt(token.refresh_token)
          : connection.refreshToken,
        expiresAt: expiresAtFrom(token),
        scope: token.scope ?? connection.scope,
        lastRefreshedAt: new Date(),
        status: "connected",
      },
    });
    return token.access_token;
  } catch {
    await markError(shop);
    return null;
  }
}

async function markError(shop: string): Promise<void> {
  await prisma.whiplashConnection.update({
    where: { shop },
    data: { status: "error" },
  });
}

export function parseCustomers(
  connection: WhiplashConnection,
): WhiplashCustomer[] {
  if (!connection.customers) return [];
  try {
    return JSON.parse(connection.customers) as WhiplashCustomer[];
  } catch {
    return [];
  }
}

export async function consumeOAuthState(state: string): Promise<{
  shop: string;
  codeVerifier: string;
  host: string | null;
} | null> {
  const row = await prisma.whiplashOAuthState.findUnique({ where: { state } });
  if (!row) return null;

  await prisma.whiplashOAuthState.delete({ where: { state } });
  if (row.expiresAt.getTime() < Date.now()) return null;

  return { shop: row.shop, codeVerifier: row.codeVerifier, host: row.host };
}

export async function disconnect(shop: string): Promise<void> {
  const connection = await prisma.whiplashConnection.findUnique({
    where: { shop },
  });
  if (!connection) return;

  try {
    await revokeToken(decrypt(connection.accessToken));
  } catch {
    // Ignore: still remove the local connection below.
  }
  await prisma.whiplashConnection.delete({ where: { shop } });
}
