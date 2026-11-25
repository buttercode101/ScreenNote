import { describe,expect,it } from "vitest";
import { readFile } from "node:fs/promises";
import { makeLibraryBackup,readLibraryBackup } from "../legacy/lib/library-backup.js";
describe("portable local library backup",()=>{
 it("round-trips a real sample video, clip metadata and private management key",async()=>{
  const bytes=new Uint8Array(await readFile(new URL("../legacy/public/sample.webm",import.meta.url)));
  const clip={id:"c9c6d84f-0bd1-4f35-a3e9-3a8b6d14a122",owner:"a".repeat(64),title:"Portable sample",type:"video/webm",createdAt:Date.now(),duration:15,blob:new Blob([bytes],{type:"video/webm"}),thumbnail:"data:image/jpeg;base64,AA==",shared:true,reviewStatus:"approved",captions:[{start:0,end:1,text:"Caption"}]};
  const backup=await makeLibraryBackup([clip]);const restored=await readLibraryBackup(backup,new Set());
  expect(restored.clips).toHaveLength(1);expect(restored.clips[0].owner).toBe(clip.owner);expect(restored.clips[0].title).toBe(clip.title);
  expect(restored.clips[0].blob.size).toBe(bytes.length);expect(new Uint8Array(await restored.clips[0].blob.arrayBuffer())).toEqual(bytes);
  const duplicate=await readLibraryBackup(backup,new Set([clip.id]));expect(duplicate.clips).toHaveLength(0);expect(duplicate.duplicates).toBe(1);
 });
 it("rejects malformed archives before import",async()=>{await expect(readLibraryBackup(new Blob(["not a zip"]))).rejects.toThrow(/ZIP backup/)});
});
