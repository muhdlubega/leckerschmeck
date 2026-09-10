import { spawn } from "node:child_process";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is unavailable; run this script through npm.");

const build = spawn(process.execPath, [npmCli, "run", "build"], {
  env: { ...process.env, LECKERSCHMECK_CLOUDFLARE_PAGES: "1" },
  stdio: "inherit",
});

const exitCode = await new Promise((resolve, reject) => {
  build.once("error", reject);
  build.once("exit", (code) => resolve(code ?? 1));
});

if (exitCode !== 0) process.exit(exitCode);
await import("./prepare-cloudflare-pages.mjs");
