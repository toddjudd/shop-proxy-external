// Starts the named ngrok tunnel from ngrok.yml, waits for it to come up, then
// launches `shopify app dev` pointed at its public URL via --tunnel-url.
// The ngrok agent must already be authenticated (ngrok config check).

import { spawn } from "node:child_process";

const TUNNEL_NAME = "shop-proxy-external";
const TUNNEL_PORT = 3005;
const NGROK_API = "http://127.0.0.1:4040/api/tunnels";

const children = [];
let shuttingDown = false;

/**
 * ngrok renders a full-screen dashboard when attached to a TTY, which fights
 * with the Shopify CLI's own full-screen UI for control of the terminal.
 * Piping stdio (instead of inheriting) keeps ngrok in plain log-line mode.
 */
function run(command, args, { inherit = false, prefix = "" } = {}) {
  const child = spawn(command, args, {
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    shell: true,
  });

  if (!inherit) {
    for (const stream of [child.stdout, child.stderr]) {
      let buffer = "";
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) process.stdout.write(prefix + line + "\n");
      });
    }
  }

  children.push(child);
  child.on("exit", (code) => shutdown(code ?? 0));
  return child;
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && child.pid) child.kill();
  }
  process.exit(code);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}

async function waitForTunnelUrl() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const res = await fetch(NGROK_API);
      if (res.ok) {
        const { tunnels } = await res.json();
        const tunnel = tunnels.find(
          (t) =>
            t.proto === "https" && t.config.addr.endsWith(`:${TUNNEL_PORT}`),
        );
        if (tunnel) return tunnel.public_url;
      }
    } catch {
      // ngrok's local API isn't up yet; keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for the "${TUNNEL_NAME}" ngrok tunnel`);
}

run("ngrok", ["start", TUNNEL_NAME, "--log=stdout"], {
  prefix: "\u001B[33m[ngrok]\u001B[0m ",
});

const publicUrl = await waitForTunnelUrl();
console.log(`ngrok tunnel ready: ${publicUrl} -> localhost:${TUNNEL_PORT}`);

// The Shopify CLI needs the terminal to itself for its own full-screen UI.
run("shopify", ["app", "dev", `--tunnel-url=${publicUrl}:${TUNNEL_PORT}`], {
  inherit: true,
});
