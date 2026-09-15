import { defineHandler } from "nitro/h3";
import { TARGETS, listProxyKv } from "../utils/routing.ts";

// Proxy-owned view (never forwarded). Renders every entry in the proxy KV
// store so shop -> environment mappings can be inspected at a glance.
export default defineHandler(async (event) => {
  const entries = await listProxyKv();

  const rows = entries
    .map(
      ({ key, value }) =>
        `<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(
          typeof value === "string" ? value : JSON.stringify(value),
        )}</td></tr>`,
    )
    .join("");

  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Proxy KV store</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #1a1a1a; }
  h1 { font-size: 1.25rem; }
  table { border-collapse: collapse; width: 100%; max-width: 720px; }
  th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #ddd; }
  th { background: #f5f5f5; }
  code { background: #f0f0f0; padding: 0.1rem 0.3rem; border-radius: 3px; }
  .empty { color: #666; }
</style>
</head>
<body>
<h1>Proxy KV store</h1>
<p>Known targets: ${Object.keys(TARGETS)
    .map((name) => `<code>${escapeHtml(name)}</code>`)
    .join(", ")}</p>
${
  entries.length
    ? `<table><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<p class="empty">No entries in the proxy KV store.</p>`
}
</body>
</html>`;

  event.res.headers.set("content-type", "text/html; charset=utf-8");
  return body;
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
