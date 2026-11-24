(async () => {
  const paths = ["/assets/bundle-00.gz", "/assets/bundle-01.gz", "/assets/bundle-02.gz", "/assets/bundle-03.gz", "/assets/bundle-04.gz", "/assets/bundle-05.gz", "/assets/bundle-06.gz", "/assets/bundle-07.gz", "/assets/bundle-08.gz", "/assets/bundle-09.gz"];
  const parts = await Promise.all(paths.map(async (path) => new Uint8Array(await (await fetch(path, { cache: "force-cache" })).arrayBuffer())));
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const compressed = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { compressed.set(part, offset); offset += part.length; }
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  const code = await new Response(stream).text();
  const script = document.createElement("script");
  script.text = code;
  document.head.appendChild(script);
})().catch((error) => {
  const root = document.getElementById("root");
  if (root) root.textContent = "ScreenNote could not load. Please refresh or try another browser.";
  console.error("ScreenNote asset loader failed", error);
});