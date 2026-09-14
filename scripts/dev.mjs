// Dev orchestrator: runs the Nitro proxy plus two copies of the React Router
// app (production + sandbox), each loaded with its own env file.
//
// The Shopify CLI runs this as the web process and hands us PORT, which is the
// port its tunnel points at. The proxy binds that port; the two app instances
// bind the ports declared in their env files.

import { spawn, spawnSync } from "node:child_process";
import { dirname, delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const INSTANCES = [
  { name: "prod", envFile: "local.prod.env", color: "\u001B[36m" },
  { name: "sandbox", envFile: "local.sandbox.env", color: "\u001B[35m" },
];

const PROXY_PORT = Number(process.env.PORT) || 3000;
if (!Number.isInteger(PROXY_PORT) || PROXY_PORT <= 0) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

const basePath = [join(root, "node_modules", ".bin"), process.env.PATH].join(
  delimiter,
);

/** Env inherited from the Shopify CLI, minus the vars each child must own. */
function inheritedEnv() {
  // HOST is the full tunnel URL (with scheme); letting it through makes
  // srvx/Vite try to bind a listener to that literal string.
  const { PORT, HMR_PORT, DATABASE_URL, HOST, ...rest } = process.env;
  return { ...rest, PATH: basePath, FORCE_COLOR: "1" };
}

function loadInstanceEnv(envFile) {
  return {
    ...inheritedEnv(),
    ...parse(readFileSync(join(root, envFile))),
  };
}

const children = [];

function run(label, color, command, env) {
  const child = spawn(command, {
    cwd: root,
    env,
    shell: true,
    stdio: ["inherit", "pipe", "pipe"],
  });

  const prefix = `${color}[${label}]\u001B[0m `;
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

  child.on("exit", (code, signal) => {
    process.stdout.write(`${prefix}exited (${signal ?? code})\n`);
    shutdown(code ?? 1);
  });

  children.push(child);
  return child;
}

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    if (process.platform === "win32") {
      // shell:true means the child is cmd.exe; kill the whole tree.
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else {
      child.kill("SIGTERM");
    }
  }

  process.exit(code);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}

// Each instance has its own SQLite file, so migrate them both up front.
for (const { name, envFile } of INSTANCES) {
  const result = spawnSync("prisma migrate deploy", {
    cwd: root,
    env: loadInstanceEnv(envFile),
    shell: true,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy failed for "${name}"`);
  }
}

run(
  "proxy",
  "\u001B[33m",
  `nitro dev ./proxy --port ${PROXY_PORT} --host localhost`,
  inheritedEnv(),
);

// Both instances share one working directory, so their initial type
// generation both target .react-router/types/ at once and race on Windows
// (EPERM on rmdir). Staggering the startups avoids the collision.
INSTANCES.forEach(({ name, envFile, color }, index) => {
  setTimeout(
    () => run(name, color, "react-router dev", loadInstanceEnv(envFile)),
    index * 2000,
  );
});
