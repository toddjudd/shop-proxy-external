import { useEffect } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import {
  getConfig,
  getValidAccessToken,
  parseCustomers,
} from "../whiplash.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  let configured = true;
  try {
    getConfig();
  } catch {
    configured = false;
  }

  // Refresh the token if it's near expiry so the status reflects reality.
  if (configured) {
    try {
      await getValidAccessToken(session.shop);
    } catch {
      // Non-fatal: the card still renders from the stored connection.
    }
  }

  const record = await prisma.whiplashConnection.findUnique({
    where: { shop: session.shop },
  });

  const connection = record
    ? {
        status: record.status,
        accountName: record.whiplashUserName,
        accountEmail: record.whiplashUserEmail,
        role: record.whiplashUserRole,
        customers: parseCustomers(record),
        selectedCustomerId: record.selectedCustomerId,
        selectedCustomerName: record.selectedCustomerName,
        expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
      }
    : null;

  return {
    environment: process.env.ENVIRONMENT ?? "unknown",
    proof: process.env.PROOF ?? "none",
    shop: session.shop,
    host: url.searchParams.get("host"),
    whiplash: { configured, connection },
  };
};

export default function Index() {
  const { environment, proof, shop, host, whiplash } =
    useLoaderData<typeof loader>();
  const target = environment === "sandbox" ? "production" : "sandbox";

  const switchEnvironment = async () => {
    await fetch("/api/switch-env", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop, target }),
    });
    // Reload so the proxy serves the document from the newly selected target.
    window.location.reload();
  };

  return (
    <s-page heading="Shopify app template">
      <s-section heading="Welcome behind the proxy">
        <s-paragraph>
          You are now viewing the app behind the proxy. You&apos;re currently on
          the <s-chip color="strong">{environment}</s-chip> environment.
        </s-paragraph>
        <s-paragraph>
          Need some proof? I don&apos;t blame you. Here it is:{" "}
          <s-chip color="strong">{proof}</s-chip>
        </s-paragraph>
        <s-button onClick={switchEnvironment}>Switch to {target}</s-button>
      </s-section>

      <WhiplashCard environment={environment} host={host} whiplash={whiplash} />
    </s-page>
  );
}

type WhiplashData = ReturnType<typeof useLoaderData<typeof loader>>["whiplash"];

function WhiplashCard({
  environment,
  host,
  whiplash,
}: {
  environment: string;
  host: string | null;
  whiplash: WhiplashData;
}) {
  const connectFetcher = useFetcher<{
    authorizeUrl?: string;
    error?: string;
  }>();
  const disconnectFetcher = useFetcher();
  const customerFetcher = useFetcher();
  const [searchParams] = useSearchParams();
  const error = searchParams.get("whiplash_error");

  // Break out of the embedded iframe to Whiplash's consent screen.
  useEffect(() => {
    const authorizeUrl = connectFetcher.data?.authorizeUrl;
    if (authorizeUrl) {
      window.open(authorizeUrl, "_top");
    }
  }, [connectFetcher.data]);

  if (!whiplash.configured) {
    return (
      <s-section heading="Whiplash connection">
        <s-banner tone="warning">
          Whiplash is not configured for the {environment} instance. Set the
          WHIPLASH_* environment variables to enable it.
        </s-banner>
      </s-section>
    );
  }

  const { connection } = whiplash;

  return (
    <s-section heading="Whiplash connection">
      {error && (
        <s-banner tone="critical">
          {error === "denied"
            ? "The Whiplash authorization was cancelled or denied."
            : error === "state"
              ? "The connection request expired. Please try connecting again."
              : "We couldn't finish connecting to Whiplash. Please try again."}
        </s-banner>
      )}

      {!connection ? (
        <>
          <s-paragraph>
            Connect this shop to Whiplash ({environment}) to authorize API
            access.
          </s-paragraph>
          <connectFetcher.Form method="post" action="/app/whiplash/connect">
            <input type="hidden" name="host" value={host ?? ""} />
            <s-button
              type="submit"
              variant="primary"
              loading={connectFetcher.state !== "idle"}
            >
              Connect Whiplash
            </s-button>
          </connectFetcher.Form>
        </>
      ) : (
        <s-stack direction="block" gap="base">
          {connection.status === "error" && (
            <s-banner tone="critical">
              The Whiplash connection needs attention. Try reconnecting.
            </s-banner>
          )}

          <s-paragraph>
            Connected as{" "}
            <s-text type="strong">
              {connection.accountName ||
                connection.accountEmail ||
                "Whiplash user"}
            </s-text>
            {connection.role ? ` (${connection.role})` : ""}
            {connection.accountEmail ? ` — ${connection.accountEmail}` : ""}.
          </s-paragraph>

          <CustomerPicker connection={connection} fetcher={customerFetcher} />

          <s-paragraph>
            <s-text color="subdued">
              Token expires:{" "}
              {connection.expiresAt
                ? new Date(connection.expiresAt).toLocaleString()
                : "no expiry reported"}
            </s-text>
          </s-paragraph>

          <disconnectFetcher.Form
            method="post"
            action="/app/whiplash/disconnect"
          >
            <s-button
              type="submit"
              tone="critical"
              loading={disconnectFetcher.state !== "idle"}
            >
              Disconnect
            </s-button>
          </disconnectFetcher.Form>
        </s-stack>
      )}
    </s-section>
  );
}

function CustomerPicker({
  connection,
  fetcher,
}: {
  connection: NonNullable<WhiplashData["connection"]>;
  fetcher: ReturnType<typeof useFetcher>;
}) {
  if (connection.customers.length === 0) {
    return (
      <s-paragraph>
        <s-text color="subdued">
          No Whiplash customers are available for this account.
        </s-text>
      </s-paragraph>
    );
  }

  if (connection.customers.length === 1) {
    return (
      <s-paragraph>
        Customer:{" "}
        <s-text type="strong">
          {connection.selectedCustomerName || connection.customers[0].name}
        </s-text>
      </s-paragraph>
    );
  }

  return (
    <fetcher.Form method="post" action="/app/whiplash/select-customer">
      <s-select
        name="customerId"
        label="Active customer"
        value={
          connection.selectedCustomerId
            ? String(connection.selectedCustomerId)
            : ""
        }
      >
        <s-option value="">Select a customer…</s-option>
        {connection.customers.map((customer) => (
          <s-option key={customer.id} value={String(customer.id)}>
            {customer.name}
          </s-option>
        ))}
      </s-select>
      <s-button type="submit" loading={fetcher.state !== "idle"}>
        Save customer
      </s-button>
    </fetcher.Form>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
