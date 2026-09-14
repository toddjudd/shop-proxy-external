import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

import styles from "./_index/styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return {
    environment: process.env.ENVIRONMENT ?? "unknown",
    proof: process.env.PROOF ?? "none",
  };
};

export default function Index() {
  const { environment, proof } = useLoaderData<typeof loader>();

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
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
