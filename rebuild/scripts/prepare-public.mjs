import { mkdir, cp, writeFile } from "node:fs/promises";

// Preserve the rebuilt PWA assets in public/. Only reuse the legacy sample video;
// never delete the manifest, service worker or icon supplied by this rebuild.
const legacy = "legacy/public";
const output = "public";
await mkdir(output, { recursive: true });
await writeFile(`${output}/_headers`, `/index.html
  Cache-Control: no-cache

/sw.js
  Cache-Control: no-cache
`);
try {
  await cp(`${legacy}/sample.webm`, `${output}/sample.webm`, { force: true });
} catch {
  // The sample clip is only used by automated editor tests.
}
console.log("Preserved the Cloudflare PWA shell and prepared the legacy test sample.");
