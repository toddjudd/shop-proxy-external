import { defineHandler, readBody, sendRedirect } from "nitro/h3";
import {
  TARGETS,
  isTargetName,
  listProxyKv,
  setProxyKvTarget,
} from "../utils/routing.ts";

// Proxy-owned console (never forwarded). GET renders the KV store; POST saves
// an edited shop -> environment mapping and redirects back to the view.
export default defineHandler(async (event) => {
  if (event.req.method === "POST") {
    const body = await readBody<{ key?: string; target?: string }>(event);
    if (body?.key && isTargetName(body.target)) {
      await setProxyKvTarget(body.key, body.target);
      console.log(`[proxy admin] ${body.key} -> ${body.target}`);
    }
    return sendRedirect(event, "/admin", 303);
  }

  const entries = await listProxyKv();
  const targetNames = Object.keys(TARGETS) as (keyof typeof TARGETS)[];

  const rows = entries
    .map(({ key, value }) => {
      const current = typeof value === "string" ? value : JSON.stringify(value);
      const options = targetNames
        .map(
          (name) =>
            `<option value="${name}"${
              name === current ? " selected" : ""
            }>${name}</option>`,
        )
        .join("");
      const badgeClass = isTargetName(current)
        ? `badge--${current}`
        : "badge--unknown";
      const badge = `<span class="badge ${badgeClass}">${escapeHtml(current)}</span>`;
      return `<tr>
  <td class="key" title="${escapeHtml(key)}"><span class="dot"></span>${escapeHtml(key)}</td>
  <td class="current">${badge}</td>
  <td class="edit">
    <form method="post" class="row-form">
      <input type="hidden" name="key" value="${escapeHtml(key)}" />
      <div class="select-wrap">
        <select name="target" aria-label="Environment for ${escapeHtml(key)}">${options}</select>
      </div>
      <button type="submit">OK</button>
    </form>
  </td>
</tr>`;
    })
    .join("");

  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Proxy Control · KV Store</title>
<style>
  :root {
    --bg: #060910;
    --panel: rgba(17, 24, 39, 0.72);
    --border: rgba(96, 165, 250, 0.16);
    --text: #e6edf6;
    --muted: #7d8aa3;
    --accent: #38bdf8;
    --accent-2: #a855f7;
    --prod: #34d399;
    --sandbox: #fbbf24;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    color: var(--text);
    background:
      radial-gradient(1200px 600px at 15% -10%, rgba(56, 189, 248, 0.12), transparent 60%),
      radial-gradient(900px 500px at 110% 10%, rgba(168, 85, 247, 0.12), transparent 55%),
      var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
  }
  .shell {
    width: 100%;
    max-width: 880px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 18px;
    box-shadow: 0 30px 80px -40px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255,255,255,0.03);
    backdrop-filter: blur(14px);
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.6rem 1.9rem;
    border-bottom: 1px solid var(--border);
    background: linear-gradient(180deg, rgba(56,189,248,0.06), transparent);
  }
  .brand { display: flex; align-items: center; gap: 0.85rem; }
  .logo {
    width: 40px; height: 40px; border-radius: 11px;
    background: linear-gradient(140deg, var(--accent), var(--accent-2));
    display: grid; place-items: center;
    box-shadow: 0 0 24px -4px var(--accent);
    font-size: 1.2rem;
  }
  .title h1 { margin: 0; font-size: 1.05rem; letter-spacing: 0.02em; }
  .title p {
    margin: 0.15rem 0 0; font-size: 0.72rem; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--muted);
  }
  .status {
    display: flex; align-items: center; gap: 0.5rem;
    font-size: 0.75rem; color: var(--muted);
    padding: 0.4rem 0.8rem; border: 1px solid var(--border); border-radius: 999px;
  }
  .status .pulse {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--prod); box-shadow: 0 0 10px var(--prod);
    animation: pulse 1.8s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
  .meta {
    display: flex; gap: 1.4rem; padding: 1rem 1.9rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.8rem; color: var(--muted);
  }
  .meta strong { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }
  .table-wrap { padding: 0.5rem 0.6rem 1.1rem; }
  table { border-collapse: collapse; width: 100%; }
  th {
    text-align: left; font-size: 0.68rem; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--muted);
    padding: 0.9rem 1.3rem 0.6rem; font-weight: 600;
  }
  td { padding: 0.75rem 1.3rem; border-top: 1px solid rgba(255,255,255,0.04); font-size: 0.9rem; }
  tbody tr { transition: background 0.15s ease; }
  tbody tr:hover { background: rgba(56, 189, 248, 0.05); }
  .key { font-family: "Cascadia Code", ui-monospace, monospace; color: #cdd8ea; }
  .key .dot {
    display: inline-block; width: 7px; height: 7px; margin-right: 0.6rem;
    border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent);
    vertical-align: middle;
  }
  .badge {
    display: inline-block; padding: 0.2rem 0.65rem; border-radius: 999px;
    font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em;
    border: 1px solid transparent;
  }
  .badge--production { color: var(--prod); background: rgba(52,211,153,0.1); border-color: rgba(52,211,153,0.3); }
  .badge--sandbox { color: var(--sandbox); background: rgba(251,191,36,0.1); border-color: rgba(251,191,36,0.3); }
  .badge--unknown { color: var(--muted); background: rgba(125,138,163,0.12); border-color: rgba(125,138,163,0.3); }
  .row-form { display: flex; align-items: center; gap: 0.55rem; justify-content: flex-end; }
  .select-wrap { position: relative; }
  .select-wrap::after {
    content: "▾"; position: absolute; right: 0.7rem; top: 50%; transform: translateY(-50%);
    color: var(--muted); pointer-events: none; font-size: 0.7rem;
  }
  select {
    appearance: none; -webkit-appearance: none;
    background: rgba(9, 14, 24, 0.9); color: var(--text);
    border: 1px solid var(--border); border-radius: 9px;
    padding: 0.45rem 2rem 0.45rem 0.8rem; font-size: 0.85rem; cursor: pointer;
    min-width: 130px;
  }
  select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(56,189,248,0.18); }
  button {
    background: linear-gradient(140deg, var(--accent), var(--accent-2));
    color: #05121e; font-weight: 700; letter-spacing: 0.03em;
    border: none; border-radius: 9px; padding: 0.5rem 1.1rem;
    cursor: pointer; font-size: 0.82rem;
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }
  button:hover { transform: translateY(-1px); box-shadow: 0 8px 20px -8px var(--accent); }
  button:active { transform: translateY(0); }
  .empty { padding: 3rem 1.9rem; text-align: center; color: var(--muted); }
  footer {
    padding: 0.9rem 1.9rem; border-top: 1px solid var(--border);
    font-size: 0.7rem; color: var(--muted); letter-spacing: 0.08em;
    display: flex; justify-content: space-between;
  }
</style>
</head>
<body>
  <main class="shell">
    <header>
      <div class="brand">
        <div class="logo">⚡</div>
        <div class="title">
          <h1>Proxy Control</h1>
          <p>KV Routing Store</p>
        </div>
      </div>
      <div class="status"><span class="pulse"></span> live</div>
    </header>
    <div class="meta">
      <span>Entries <strong>${entries.length}</strong></span>
      <span>Targets <strong>${targetNames.join(" · ")}</strong></span>
    </div>
    ${
      entries.length
        ? `<div class="table-wrap">
      <table>
        <thead><tr><th>Key</th><th>Current</th><th style="text-align:right">Edit</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
        : `<p class="empty">No entries in the proxy KV store yet.</p>`
    }
    <footer>
      <span>shop-proxy · admin</span>
      <span>source of truth</span>
    </footer>
  </main>
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
