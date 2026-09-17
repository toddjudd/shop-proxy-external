import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import {
  consumeOAuthState,
  exchangeCodeForToken,
  fetchCustomers,
  fetchMe,
  saveConnectionFromToken,
} from "../whiplash.server";

// Public: Whiplash redirects the browser here (top-level, no Shopify session).
// The proxy routes this to the right instance via the ?env marker; security is
// enforced by the DB-backed state + PKCE verifier, not a Shopify session.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError || !code || !state) {
    return redirect("/app?whiplash_error=denied");
  }

  const stored = await consumeOAuthState(state);
  if (!stored) {
    return redirect("/app?whiplash_error=state");
  }

  try {
    const token = await exchangeCodeForToken(code, stored.codeVerifier);
    const me = await fetchMe(token.access_token);
    const customers = await fetchCustomers(token.access_token);
    await saveConnectionFromToken({ shop: stored.shop, token, me, customers });
  } catch (error) {
    console.error("[whiplash] callback failed", error);
    return redirect(reembedPath(stored.shop, stored.host, "exchange"));
  }

  return redirect(reembedPath(stored.shop, stored.host));
};

function reembedPath(
  shop: string,
  host: string | null,
  error?: string,
): string {
  const params = new URLSearchParams({ shop });
  if (host) params.set("host", host);
  if (error) params.set("whiplash_error", error);
  return `/app?${params.toString()}`;
}
