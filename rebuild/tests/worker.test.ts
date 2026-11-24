import { beforeEach, describe, expect, it } from "vitest";
import worker from "../worker/index";

class FakeD1 {
  sessions = new Set<string>();
  recordings = new Map<string, any>();
  shares = new Map<string, any>();
  comments = new Map<string, any>();
  access = new Set<string>();
  prepare(sql: string) {
    const db = this;
    return { bind(...v: any[]) {
      return {
        async first() {
          if (sql.includes("FROM guest_sessions")) return db.sessions.has(v[0]) ? { token_hash: v[0] } : null;
          if (sql.includes("FROM recordings") && sql.includes("JOIN shares")) {
            for (const s of db.shares.values()) if (s.token_hash === v[0]) return { ...s, ...db.recordings.get(s.recording_id) };
          }
          if (sql.includes("FROM shares") && sql.includes("JOIN recordings")) {
            for (const s of db.shares.values()) if (s.token_hash === v[0]) return { ...s, ...db.recordings.get(s.recording_id) };
          }
          if (sql.includes("FROM shares") && sql.includes("recording_id = ?")) return [...db.shares.values()].find(s => s.recording_id === v[0]) ?? null;
          if (sql.includes("FROM shares") && sql.includes("id = ?")) return db.shares.get(v[0]) ?? null;
          if (sql.includes("FROM recordings") && sql.includes("id = ?")) {
            const r = db.recordings.get(v[0]); return r && (!v[1] || r.owner_token_hash === v[1]) && (!sql.includes("status = 'ready'") || r.status === "ready") ? r : null;
          }
          if (sql.includes("FROM comments") && sql.includes("COUNT(*)")) return { total: db.comments.size };
          if (sql.includes("FROM comments")) return db.comments.get(v[0]) ?? null;
          if (sql.includes("FROM share_access_sessions")) return db.access.has(v[0]) ? { token_hash: v[0] } : null;
          return null;
        },
        async run() {
          if (sql.startsWith("INSERT INTO guest_sessions")) db.sessions.add(v[0]);
          if (sql.startsWith("INSERT INTO recordings")) db.recordings.set(v[0], { id:v[0], owner_token_hash:v[1], title:v[2], object_key:v[3], mime_type:v[4], byte_size:v[5], duration_seconds:v[6], status:"uploading" });
          if (sql.startsWith("UPDATE recordings SET status")) { const r=db.recordings.get(v[1]); if(r)r.status="ready"; }
          if (sql.startsWith("INSERT INTO shares")) db.shares.set(v[0], { id:v[0], recording_id:v[1], owner_token_hash:v[2], owner_key_hash:v[3], token_hash:v[4], expires_at:v[5], password_salt:v[6], password_hash:v[7], revoked_at:null });
          if (sql.startsWith("INSERT INTO share_access_sessions")) db.access.add(v[0]);
          if (sql.startsWith("INSERT INTO comments")) db.comments.set(v[0], { id:v[0], share_id:v[1], parent_id:v[2], author_hash:v[3], viewer_label:v[4], body:v[5], time_seconds:v[6], created_at:v[7], updated_at:v[8], resolved:0, deleted_at:null });
          if (sql.startsWith("DELETE FROM shares")) db.shares.delete(v[0]);
          if (sql.startsWith("DELETE FROM recordings")) db.recordings.delete(v[0]);
          if (sql.startsWith("UPDATE comments")) { const c=db.comments.get(v[2]??v[3]); if(c){ if(sql.includes("body = '[deleted]'"))c.deleted_at=v[0]; else if(sql.includes("SET body = ?"))c.body=v[0]; else c.resolved=v[0]; } }
          return { success:true };
        },
        async all() {
          if (sql.includes("FROM comments WHERE share_id")) return { results:[...db.comments.values()].filter(c=>c.share_id===v[0]) };
          if (sql.includes("FROM recordings WHERE owner_token_hash")) return { results:[...db.recordings.values()].filter(r=>r.owner_token_hash===v[0]) };
          return { results:[] };
        }
      };
    }};
  }
}
const makeEnv = () => {
  const DB=new FakeD1(), objects=new Map<string, {bytes:Uint8Array;type:string}>(), deleted:string[]=[];
  const MEDIA={
    async put(key:string, body:ReadableStream<Uint8Array>, options:any){const bytes=new Uint8Array(await new Response(body).arrayBuffer());objects.set(key,{bytes,type:options.httpMetadata.contentType});},
    async get(key:string, options?:any){const o=objects.get(key);if(!o)return null;const bytes=options?.range?o.bytes.slice(options.range.offset,options.range.offset+options.range.length):o.bytes;return {body:new Blob([bytes]).stream(),httpEtag:'etag'};},
    async delete(key:string){objects.delete(key);deleted.push(key);}
  };
  return {env:{DB,MEDIA,STATIC:{get:async()=>null}},DB,objects,deleted};
};
async function session(env:any) {
  const res=await worker.fetch(new Request("https://screennote.test/api/session"),env,{} as any);
  return {cookie:res.headers.get("set-cookie")!.split(";")[0]};
}
async function upload(env:any,cookie:string) {
  const created=await worker.fetch(new Request("https://screennote.test/api/recordings",{method:"POST",headers:{origin:"https://screennote.test",cookie,"content-type":"application/json"},body:JSON.stringify({title:"Bug walkthrough",mimeType:"video/webm",size:4,duration:12})}),env,{} as any);
  const body=await created.json() as any;
  const uploaded=await worker.fetch(new Request(`https://screennote.test/api/recordings/${body.id}/media`,{method:"PUT",headers:{origin:"https://screennote.test",cookie,"content-type":"video/webm","content-length":"4"},body:new Uint8Array([1,2,3,4])}),env,{} as any);
  return {id:body.id,uploaded};
}
describe("ScreenNote temporary sharing API",()=>{
  let state:ReturnType<typeof makeEnv>;
  beforeEach(()=>{state=makeEnv();});
  it("creates guest sessions and rejects cross-origin writes",async()=>{
    const res=await worker.fetch(new Request("https://screennote.test/api/session",{headers:{origin:"https://evil.test"}}),state.env as any,{} as any);
    expect(res.status).toBe(403);expect(state.DB.sessions.size).toBe(0);
  });
  it("streams an owned upload to R2 and publishes an expiring share",async()=>{
    const s=await session(state.env),u=await upload(state.env,s.cookie);
    expect(u.uploaded.status).toBe(200);
    const key="a".repeat(64);
    const pub=await worker.fetch(new Request(`https://screennote.test/api/recordings/${u.id}/publish`,{method:"POST",headers:{origin:"https://screennote.test",cookie:s.cookie,"content-type":"application/json"},body:JSON.stringify({expiresInDays:1,ownerKey:key})}),state.env as any,{} as any);
    expect(pub.status).toBe(201);const share=await pub.json() as any;
    expect(share.url).toMatch(/^\/s\//);
    const view=await worker.fetch(new Request(`https://screennote.test/api/share/${share.token}`),state.env as any,{} as any);
    expect(view.status).toBe(200);expect(await view.json()).toMatchObject({title:"Bug walkthrough",passwordRequired:false});
  });
  it("requires a password before serving protected media",async()=>{
    const s=await session(state.env),u=await upload(state.env,s.cookie),key="b".repeat(64);
    const pub=await worker.fetch(new Request(`https://screennote.test/api/recordings/${u.id}/publish`,{method:"POST",headers:{origin:"https://screennote.test",cookie:s.cookie,"content-type":"application/json"},body:JSON.stringify({expiresInDays:1,password:"long-password",ownerKey:key})}),state.env as any,{} as any);
    const share=await pub.json() as any;
    const locked=await worker.fetch(new Request(`https://screennote.test/api/share/${share.token}`),state.env as any,{} as any);
    expect(locked.status).toBe(401);
    const access=await worker.fetch(new Request(`https://screennote.test/api/share/${share.token}/access`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password:"long-password"})}),state.env as any,{} as any);
    expect(access.status).toBe(200);expect(access.headers.get("set-cookie")).toContain("HttpOnly");
  });
  it("supports timestamped nested discussion and creator thread resolution",async()=>{
    const s=await session(state.env),u=await upload(state.env,s.cookie),key="c".repeat(64);
    const pub=await worker.fetch(new Request(`https://screennote.test/api/recordings/${u.id}/publish`,{method:"POST",headers:{origin:"https://screennote.test",cookie:s.cookie,"content-type":"application/json"},body:JSON.stringify({expiresInDays:3,ownerKey:key})}),state.env as any,{} as any);
    const share=await pub.json() as any, url=`https://screennote.test/api/share/${share.token}/comments`;
    const author="d".repeat(48);
    const first=await worker.fetch(new Request(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({authorKey:author,text:"The menu jumps here",time:4})}),state.env as any,{} as any);
    expect(first.status).toBe(201);const comment=await first.json() as any;
    const reply=await worker.fetch(new Request(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({authorKey:"e".repeat(48),parentId:comment.id,text:"I can reproduce it",time:4})}),state.env as any,{} as any);
    expect(reply.status).toBe(201);
    const resolve=await worker.fetch(new Request(`https://screennote.test/api/share/${share.token}/comments/${comment.id}/resolve`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({ownerKey:key,resolved:true})}),state.env as any,{} as any);
    expect(resolve.status).toBe(200);
  });
  it("supports byte-range playback and stops serving media after owner deletion",async()=>{
    const s=await session(state.env),u=await upload(state.env,s.cookie),key="f".repeat(64);
    const pub=await worker.fetch(new Request(`https://screennote.test/api/recordings/${u.id}/publish`,{method:"POST",headers:{origin:"https://screennote.test",cookie:s.cookie,"content-type":"application/json"},body:JSON.stringify({expiresInDays:7,ownerKey:key})}),state.env as any,{} as any);
    const share=await pub.json() as any;
    const media=await worker.fetch(new Request(`https://screennote.test/api/share/${share.token}/media`,{headers:{range:"bytes=1-2"}}),state.env as any,{} as any);
    expect(media.status).toBe(206);expect(media.headers.get("content-range")).toBe("bytes 1-2/4");
    const del=await worker.fetch(new Request(`https://screennote.test/api/recordings/${u.id}`,{method:"DELETE",headers:{origin:"https://screennote.test",cookie:s.cookie,"content-type":"application/json"},body:JSON.stringify({ownerKey:key})}),state.env as any,{} as any);
    expect(del.status).toBe(200);expect(state.objects.size).toBe(0);
  });
});