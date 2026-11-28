// @ts-ignore - browser recovery helper tested as a runtime module
import { recoveryDocument,recoveryKeys } from "../legacy/lib/recovery.js";
import { readFile } from "node:fs/promises";
import { Input, BufferSource, WEBM } from "mediabunny";
import { inspectNativeMedia } from "../worker/validate-media";
import { describe, expect, it } from "vitest";
import { applyComment, passwordRecord, checkPassword } from "../worker/legacy-api";

const digest=async(value:string)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,"0")).join("");
const owner="a".repeat(64),authorKey="b".repeat(64),replyKey="c".repeat(64);
const uuid=()=>crypto.randomUUID();
async function clip(){
 return {id:uuid(),ownerHash:await digest(owner),status:"published",expiresAt:Date.now()+86400000,start:0,end:30,duration:30,title:"Unit clip",comments:[] as any[],votes:{} as Record<string,string>,discussionRevision:0};
}
describe("Cloudflare 0.5.0 API parity helpers",()=>{
 it("validates the real bundled WebM container and track metadata",async()=>{
  const bytes=new Uint8Array(await readFile(new URL("../legacy/public/sample.webm",import.meta.url)));
  const input=new Input({source:new BufferSource(bytes),formats:[WEBM]});
  const duration=await input.getDurationFromMetadata(),video=await input.getPrimaryVideoTrack();
  expect(duration).not.toBeNull();expect(video).not.toBeNull();
  const expected={type:"video/webm",size:bytes.length,duration:duration!};
  input.dispose();
  const result=await inspectNativeMedia(bytes,expected);
  expect(result.width).toBeGreaterThan(0);expect(result.height).toBeGreaterThan(0);
  await expect(inspectNativeMedia(new Uint8Array([1,2,3]),{type:"video/webm",size:3,duration:1})).rejects.toThrow(/valid video/);
 });
 it("allows recovery-key migration from official Vercel to Cloudflare only",()=>{
  const clip={id:"c9c6d84f-0bd1-4f35-a3e9-3a8b6d14a122",owner:"a".repeat(64),title:"Migrated share",shared:true,expiresAt:Date.now()+86400000};
  const source="https://screennote-woad.vercel.app",target="https://screennote-dev.buttercoder-dev.workers.dev";
  const raw=recoveryDocument([clip],source),restored=recoveryKeys(raw,target);
  expect(restored).toHaveLength(1);expect(restored[0].owner).toBe(clip.owner);
  expect(()=>recoveryKeys(raw,"https://evil.example")).toThrow(/official ScreenNote/);
 });
 it("hashes passwords with PBKDF2 and rejects incorrect values",async()=>{
  const record=await passwordRecord("strong-screen-note-password");
  expect(record.passwordAlgorithm).toBe("pbkdf2-sha256");
  expect(await checkPassword(record,"strong-screen-note-password")).toBe(true);
  expect(await checkPassword(record,"wrong-password")).toBe(false);
  await expect(passwordRecord("short")).rejects.toThrow(/8–128/);
 });
 it("supports idempotent comments, replies-to-replies and reopens resolved roots",async()=>{
  const c=await clip(),eventId=uuid();
  const first=await applyComment({} as any,c,"comment",{eventId,owner,authorKey,name:"Owner",text:"Root note",time:8});
  expect(first.comments).toHaveLength(1);
  await applyComment({} as any,c,"comment",{eventId,owner,authorKey,name:"Owner",text:"Root note",time:8});
  expect(c.comments).toHaveLength(1);
  c.comments[0].resolved=true;
  const replyId=uuid();
  await applyComment({} as any,c,"comment",{eventId:replyId,authorKey:replyKey,name:"Guest",text:"Reply",time:12,parentId:eventId});
  expect(c.comments[0].resolved).toBe(false);
  expect(c.comments[1].time).toBe(8);
  const nestedId=uuid();
  await applyComment({} as any,c,"comment",{eventId:nestedId,authorKey:replyKey,name:"Guest",text:"Reply to reply",time:18,parentId:replyId});
  expect(c.comments[2].parentId).toBe(replyId);
  expect(c.comments[2].time).toBe(8);
 });
 it("enforces comment edit versions and author/creator moderation",async()=>{
  const c=await clip(),eventId=uuid();
  await applyComment({} as any,c,"comment",{eventId,owner,authorKey,name:"Owner",text:"Initial",time:4});
  const created=c.comments[0].createdAt;
  await applyComment({} as any,c,"edit-comment",{commentId:eventId,authorKey,expectedVersion:created,text:"Updated"});
  expect(c.comments[0].text).toBe("Updated");
  await expect(applyComment({} as any,c,"edit-comment",{commentId:eventId,authorKey,expectedVersion:created,text:"Stale"})).rejects.toThrow(/changed/);
  await expect(applyComment({} as any,c,"resolve-thread",{commentId:eventId,authorKey:replyKey,resolved:true})).rejects.toThrow(/Only the thread author/);
  await applyComment({} as any,c,"resolve-thread",{commentId:eventId,owner,resolved:true});
  expect(c.comments[0].resolved).toBe(true);
  await applyComment({} as any,c,"delete-comment",{commentId:eventId,authorKey});
  expect(c.comments[0].deleted).toBe(true);
  expect(c.comments[0].text).toBe("");
 });
});
