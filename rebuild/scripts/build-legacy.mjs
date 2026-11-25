import { build } from "esbuild";
import { mkdir, cp, rm } from "node:fs/promises";

// Only copy the offline shell worker and app icon. The legacy HTML, CSS and JS
// are deliberately excluded: Cloudflare ships the independent React application.
const source = "legacy/public";
const output = "public";
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ["sw.js", "icon.svg", "manifest.webmanifest"]) {
  try { await cp(`${source}/${file}`, `${output}/${file}`); } catch { /* optional static asset */ }
}
console.log("Prepared Cloudflare-only public assets; legacy UI bundle is excluded.");
