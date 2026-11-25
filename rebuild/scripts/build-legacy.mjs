import { build } from "esbuild";
import { mkdir, cp, rm } from "node:fs/promises";
const source="legacy/public",output="legacy/dist";
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});await cp(source,output,{recursive:true});
await build({entryPoints:[source+"/app.js"],bundle:true,format:"esm",target:"es2022",outfile:output+"/app.js",minify:true});
console.log("Built complete ScreenNote 0.5.0 browser app for Cloudflare assets.");
