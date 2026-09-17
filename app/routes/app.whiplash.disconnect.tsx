import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { disconnect } from "../whiplash.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await disconnect(session.shop);
  return { ok: true };
};
