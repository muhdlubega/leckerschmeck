import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const clientDir = join(root, "dist", "client");
const serverDir = join(root, "dist", "server");
const pagesDir = join(root, "dist", "pages");

await rm(pagesDir, { force: true, recursive: true });
await mkdir(pagesDir, { recursive: true });

// Pages advanced mode expects static assets and the Worker entry point in one
// output directory. Copy the client first, then the Vinext server modules.
await cp(clientDir, pagesDir, { recursive: true });
// The Worker bundle also imports modules from `_next`, so Pages classifies that
// directory as Worker code instead of public assets. Keep a second, asset-only
// copy that the entry shim can fetch without changing browser-facing URLs.
await cp(join(clientDir, "_next"), join(pagesDir, "__assets", "_next"), {
  recursive: true,
});
for (const entry of await readdir(serverDir)) {
  if (entry === "wrangler.json" || entry === "index.js") continue;
  await cp(join(serverDir, entry), join(pagesDir, entry), { recursive: true });
}
await cp(join(serverDir, "index.js"), join(pagesDir, "index.js"));
await cp(
  join(root, "scripts", "cloudflare-pages-worker.mjs"),
  join(pagesDir, "_worker.js"),
);

// Vinext emits a Worker-only Wrangler file beside the server bundle. Leaving it
// in the tree makes Wrangler prefer it over the Pages configuration at the repo
// root, so remove this generated intermediary after packaging.
await rm(join(serverDir, "wrangler.json"), { force: true });
await rm(join(root, ".wrangler", "deploy", "config.json"), { force: true });

console.log(`Cloudflare Pages bundle prepared at ${pagesDir}`);
