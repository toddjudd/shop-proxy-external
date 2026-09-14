import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return {
    environment: process.env.ENVIRONMENT || "local",
    port: process.env.PORT || "unknown",
    proof:
      process.env.PROOF ||
      "This instance is connected and ready to receive traffic.",
    showForm: Boolean(login),
  };
};

export default function App() {
  const { environment, port, proof, showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <header className={styles.header}>
          <div className={styles.eyebrow}>
            <span className={styles.statusDot} />
            External proxy proof of concept
          </div>
          <h1 className={styles.heading}>Shopify External Proxy</h1>
          <p className={styles.text}>
            One Shopify app, multiple environments, one clear request path.
          </p>
        </header>

        <section className={styles.heroPanel} aria-labelledby="proof-heading">
          <div>
            <p className={styles.panelLabel}>Current proof</p>
            <h2 id="proof-heading">The request reached the right app.</h2>
            <p className={styles.proof}>{proof}</p>
          </div>
          <div className={styles.routeMark} aria-hidden="true">
            <span>Proxy</span>
            <span className={styles.routeArrow}>-&gt;</span>
            <span>{environment}</span>
          </div>
        </section>

        <section className={styles.details} aria-label="Environment details">
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Environment</span>
            <strong>{environment}</strong>
            <span className={styles.detailHint}>
              Selected by this app instance
            </span>
          </div>
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Listening on</span>
            <strong>Port {port}</strong>
            <span className={styles.detailHint}>
              Available to the local proxy
            </span>
          </div>
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Flow</span>
            <strong>Proxy -&gt; Shopify app</strong>
            <span className={styles.detailHint}>
              Forwarded with request context
            </span>
          </div>
        </section>

        {showForm && (
          <section
            className={styles.loginPanel}
            aria-labelledby="login-heading"
          >
            <div>
              <p className={styles.panelLabel}>Continue to the app</p>
              <h2 id="login-heading">Test the Shopify connection</h2>
              <p className={styles.loginText}>
                Sign in with a development store to verify the embedded app
                flow.
              </p>
            </div>
            <Form className={styles.form} method="post" action="/auth/login">
              <label className={styles.label}>
                <span>Shop domain</span>
                <input
                  className={styles.input}
                  type="text"
                  name="shop"
                  placeholder="my-store.myshopify.com"
                />
              </label>
              <button className={styles.button} type="submit">
                Log in
                <span aria-hidden="true">-&gt;</span>
              </button>
            </Form>
          </section>
        )}
      </div>
    </div>
  );
}
