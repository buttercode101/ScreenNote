import { mkdir, cp, rm, writeFile } from "node:fs/promises";

// Keep only static assets needed by the new React app. Never copy legacy UI files.
const source = "legacy/public";
const output = "public";
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await writeFile(`${output}/_headers`, `/index.html
  Cache-Control: no-cache

/sw.js
  Cache-Control: no-cache
`);
for (const file of ["sw.js", "icon.svg", "manifest.webmanifest"]) {
  try { await cp(`${source}/${file}`, `${output}/${file}`); } catch { /* optional static asset */ }
}
console.log("Prepared isolated Cloudflare public assets; legacy HTML, CSS and JS are excluded.");
