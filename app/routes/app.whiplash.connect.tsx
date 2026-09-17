import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  buildAuthorizeUrl,
  createOAuthState,
  getConfig,
} from "../whiplash.server";

// Admin-authenticated: mints OAuth state and returns the Whiplash authorize URL.
// The client performs the top-level (out-of-iframe) redirect.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    getConfig();
  } catch {
    return {
      ok: false,
      error: "Whiplash is not configured for this environment.",
    };
  }

  const form = await request.formData();
  const host = (form.get("host") as string | null) ?? null;

  const { state, challenge } = await createOAuthState({
    shop: session.shop,
    host,
  });

  return { ok: true, authorizeUrl: buildAuthorizeUrl(state, challenge) };
};
