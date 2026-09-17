import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { parseCustomers } from "../whiplash.server";

// Admin-authenticated: sets the active Whiplash customer sent as X-Customer-Id.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const customerId = Number(form.get("customerId"));

  const connection = await prisma.whiplashConnection.findUnique({
    where: { shop: session.shop },
  });
  if (!connection) {
    return { ok: false, error: "No Whiplash connection." };
  }

  const match = parseCustomers(connection).find((c) => c.id === customerId);
  if (!match) {
    return {
      ok: false,
      error: "Customer is not available on this connection.",
    };
  }

  await prisma.whiplashConnection.update({
    where: { shop: session.shop },
    data: { selectedCustomerId: match.id, selectedCustomerName: match.name },
  });

  return { ok: true };
};
