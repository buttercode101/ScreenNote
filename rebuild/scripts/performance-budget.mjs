import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const assetsDir = path.resolve(".cloudflare/output/v1/workers/default/assets/assets");
const files = await readdir(assetsDir);
const jsFiles = files.filter((name) => /\\.m?js$/.test(name) && name !== "sw.js");
const cssFiles = files.filter((name) => /\\.css$/.test(name));

if (jsFiles.length === 0 || cssFiles.length === 0) {
  throw new Error(`Performance budget could not find built JS/CSS assets in ${assetsDir}`);
}

async function measure(names) {
  let raw = 0;
  let gzip = 0;
  for (const name of names) {
    const file = path.join(assetsDir, name);
    const buffer = await readFile(file);
    raw += buffer.length;
    gzip += gzipSync(buffer, { level: 9 }).length;
  }
  return { raw, gzip };
}

const js = await measure(jsFiles);
const css = await measure(cssFiles);
const budgets = {
  "JavaScript (gzip)": { actual: js.gzip, max: 130 * 1024 },
  "CSS (gzip)": { actual: css.gzip, max: 16 * 1024 },
  "JavaScript (raw)": { actual: js.raw, max: 400 * 1024 },
  "CSS (raw)": { actual: css.raw, max: 80 * 1024 },
};

console.log("ScreenNote client performance budget");
console.log(`JS: ${(js.raw / 1024).toFixed(1)} KiB raw / ${(js.gzip / 1024).toFixed(1)} KiB gzip (${jsFiles.join(", ")})`);
console.log(`CSS: ${(css.raw / 1024).toFixed(1)} KiB raw / ${(css.gzip / 1024).toFixed(1)} KiB gzip (${cssFiles.join(", ")})`);

let failed = false;
for (const [label, budget] of Object.entries(budgets)) {
  const pass = budget.actual <= budget.max;
  console.log(`${pass ? "PASS" : "FAIL"} ${label}: ${(budget.actual / 1024).toFixed(1)} / ${(budget.max / 1024).toFixed(1)} KiB`);
  if (!pass) failed = true;
}
if (failed) process.exitCode = 1;
