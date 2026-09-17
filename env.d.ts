/// <reference types="vite/client" />
/// <reference types="@react-router/node" />

declare namespace NodeJS {
  interface ProcessEnv {
    ENVIRONMENT?: string;
    PROOF?: string;
    PORT?: string;
    HMR_PORT?: string;
    DATABASE_URL?: string;
    SHOPIFY_API_KEY?: string;
    SHOPIFY_API_SECRET?: string;
    SHOPIFY_APP_URL?: string;
    SCOPES?: string;
    SHOP_CUSTOM_DOMAIN?: string;
    WHIPLASH_BASE_URL?: string;
    WHIPLASH_CLIENT_ID?: string;
    WHIPLASH_CLIENT_SECRET?: string;
    WHIPLASH_SCOPES?: string;
    WHIPLASH_REDIRECT_URI?: string;
    WHIPLASH_TOKEN_ENC_KEY?: string;
  }
}
