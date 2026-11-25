import { beforeEach, describe, expect, it } from "vitest";
import worker from "../worker/index";

(globalThis as any).FixedLengthStream = class {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  constructor(length: number) {
    const stream = new TransformStream<Uint8Array, Uint8Array>();
    const writer = stream.writable.getWriter();
    let received = 0;
    this.readable = stream.readable;
    this.writable = new WritableStream<Uint8Array>({
      write(chunk) {
        received += chunk.byteLength;
        if (received > length) throw new Error("FixedLengthStream overflow");
        return writer.write(chunk);
      },
      close() {
        if (received !== length) return writer.abort(new Error("FixedLengthStream length mismatch"));
        return writer.close();
      },
      abort(reason) { return writer.abort(reason); }
    });
  }
};

class FakeD1 {
  sessions = new Set<string>();
  recordings = new Map<string, any>();
  shares = new Map<string, any>();
  comments = new Map<string, any>();
  access = new Set<string>();
  passwordAttempts = new Map<string, any>();
  actionLimits = new Map<string, any>();
  details = new Map<string, string>();
  uploadParts: any[] = [];
  reactions = new Map<string, any>();
  reviews = new Map<string, any>();
  prepare(sql: string) {
    const db = this;
    return { bind(...v: any[]) {
      return {
        async first() {
          if (sql.includes("FROM guest_sessions")) return db.sessions.has(v[0]) ? { token_hash: v[0] } : null;
          if (sql.includes("FROM recordings") && sql.includes("JOIN shares")) {
            for (const s of db.shares.values()) if (s.token_hash === v[0]) return { ...db.recordings.get(s.recording_id), ...s };
          }
          if (sql.includes("FROM shares") && sql.includes("JOIN recordings")) {
            for (const s of db.shares.values()) if (s.token_hash === v[0]) return { ...db.recordings.get(s.recording_id), ...s };
          }
          if (sql.includes("FROM shares") && sql.includes("recording_id = ?")) return [...db.shares.values()].find(s => s.recording_id === v[0]) ?? null;
          if (sql.includes("FROM shares") && sql.includes("id = ?")) return db.shares.get(v[0]) ?? null;
          if (sql.includes("FROM recordings") && sql.includes("id = ?")) {
            const r = db.recordings.get(v[0]); if (!r || (v[1] && r.owner_token_hash !== v[1]) || (sql.includes("status = 'ready'") && r.status !== "ready") || (sql.includes("status = 'uploading'") && r.status !== "uploading")) return null;
            return sql.includes("upload_until AS uploadUntil") ? { ...r, uploadUntil:r.upload_until } : r;
          }
          if (sql.includes("FROM comments") && sql.includes("COUNT(*)")) return { total: db.comments.size };
          if (sql.includes("FROM comments")) return db.comments.get(v[0]) ?? null;
          if (sql.includes("FROM share_details")) return db.details.has(v[0]) ? { payload: db.details.get(v[0]) } : null;
          if (sql.includes("FROM share_reviews") && sql.includes("COUNT(*)")) return { total:[...db.reviews.values()].filter(r=>r.share_id===v[0]).length };
          if (sql.includes("FROM share_reviews")) { const r=db.reviews.get(v[0]+":"+v[1]); return r?{reviewerLabel:r.reviewer_label,decision:r.decision,comment:r.comment,time:r.time_seconds,createdAt:r.created_at,updatedAt:r.updated_at}:null; }
          if (sql.includes("FROM share_reactions") && sql.includes("COUNT(*)")) return { total:[...db.reactions.values()].filter(r=>r.share_id===v[0]).length };
          if (sql.includes("FROM share_reactions")) return db.reactions.get(v[0]+":"+v[1]) ?? null;
          if (sql.includes("FROM share_password_attempts")) return db.passwordAttempts.get(`${v[0]}:${v[1]}`) ?? null;
          if (sql.includes("FROM share_action_rate_limits")) return db.actionLimits.get(`${v[0]}:${v[1]}:${v[2]}`) ?? null;
          if (sql.includes("FROM share_access_sessions")) return db.access.has(v[0]) ? { token_hash: v[0] } : null;
          return null;
        },
        async run() {
          if (sql.startsWith("INSERT INTO guest_sessions")) db.sessions.add(v[0]);
          if (sql.startsWith("INSERT INTO recordings")) db.recordings.set(v[0], { id:v[0], owner_token_hash:v[1], title:v[2], object_key:v[3], mime_type:v[4], byte_size:v[5], duration_seconds:v[6], status:"uploading", upload_until:v[9] });
          if (sql.startsWith("UPDATE recordings SET status")) { const r=db.recordings.get(v[1]); if(r)r.status="ready"; }
          if (sql.startsWith("UPDATE recordings SET upload_until")) { const r=db.recordings.get(v[2]); if(r){r.upload_until=v[0];r.updated_at=v[1];} }
          if (sql.startsWith("INSERT OR REPLACE INTO recording_upload_parts")) { const [recording_id,part,object_key,size,created_at]=v; const old=db.uploadParts.findIndex(p=>p.recording_id===recording_id&&p.part===part); const item={recording_id,part,object_key,size,created_at}; if(old>=0)db.uploadParts[old]=item;else db.uploadParts.push(item); }
          if (sql.startsWith("DELETE FROM recording_upload_parts")) db.uploadParts=db.uploadParts.filter(p=>p.recording_id!==v[0]);
          if (sql.startsWith("INSERT INTO shares")) db.shares.set(v[0], { id:v[0], recording_id:v[1], owner_token_hash:v[2], owner_key_hash:v[3], token_hash:v[4], expires_at:v[5], password_salt:v[6], password_hash:v[7], revoked_at:null });
          if (sql.startsWith("INSERT OR REPLACE INTO share_details")) db.details.set(v[0], v[1]);
          if (sql.startsWith("INSERT OR REPLACE INTO share_reactions")) db.reactions.set(v[0]+":"+v[1],{share_id:v[0],voter_hash:v[1],reaction:v[2],created_at:v[3]});
          if (sql.startsWith("INSERT OR REPLACE INTO share_reviews")) db.reviews.set(v[0]+":"+v[1],{share_id:v[0],reviewer_hash:v[1],reviewer_label:v[2],decision:v[3],comment:v[4],time_seconds:v[5],created_at:v[6],updated_at:v[7]});
          if (sql.startsWith("DELETE FROM share_reactions")) db.reactions.delete(v[0]+":"+v[1]);
          if (sql.startsWith("INSERT OR REPLACE INTO share_password_attempts")) db.passwordAttempts.set(`${v[0]}:${v[1]}`, { share_id:v[0], ip_hash:v[1], window_started:v[2], attempts:v[3], locked_until:v[4] });
          if (sql.startsWith("INSERT INTO share_action_rate_limits")) { const key=`${v[0]}:${v[1]}:${v[2]}`,old=db.actionLimits.get(key);db.actionLimits.set(key,{share_id:v[0],ip_hash:v[1],action:v[2],window_started:v[3],count:old&&old.window_started===v[3]?old.count+1:1}); }
          if (sql.startsWith("DELETE FROM share_password_attempts")) {
            if (sql.includes("window_started")) { for (const [key,row] of db.passwordAttempts) if (row.window_started <= v[0]) db.passwordAttempts.delete(key); }
            else db.passwordAttempts.delete(`${v[0]}:${v[1]}`);
          }
          if (sql.startsWith("INSERT INTO share_access_sessions")) db.access.add(v[0]);
          if (sql.startsWith("INSERT INTO comments")) db.comments.set(v[0], { id:v[0], share_id:v[1], parent_id:v[2], author_hash:v[3], viewer_label:v[4], body:v[5], time_seconds:v[6], created_at:v[7], updated_at:v[8], resolved:0, deleted_at:null, anchor_x:v[9]??null, anchor_y:v[10]??null });
          if (sql.startsWith("DELETE FROM shares")) db.shares.delete(v[0]);
          if (sql.startsWith("DELETE FROM recordings")) db.recordings.delete(v[0]);
          if (sql.startsWith("UPDATE comments")) { const c=db.comments.get(v[2]??v[3]); if(c){ if(sql.includes("body = '[deleted]'"))c.deleted_at=v[0]; else if(sql.includes("SET body = ?"))c.body=v[0]; else c.resolved=v[0]; } }
          return { success:true };
        },
        async all() {
          if (sql.includes("FROM recording_upload_parts")) return { results:db.uploadParts.filter(p=>p.recording_id===v[0]).sort((a,b)=>a.part-b.part).map(p=>({part:p.part,size:p.size,objectKey:p.object_key,object_key:p.object_key})) };
          if (sql.includes("FROM share_reviews")) return {results:[...db.reviews.values()].filter(r=>r.share_id===v[0]).sort((a,b)=>b.updated_at-a.updated_at).map(r=>({reviewerLabel:r.reviewer_label,decision:r.decision,comment:r.comment,time:r.time_seconds,createdAt:r.created_at,updatedAt:r.updated_at}))};
          if (sql.includes("FROM share_reactions")) { const grouped=new Map<string,number>(); for(const r of db.reactions.values())if(r.share_id===v[0])grouped.set(r.reaction,(grouped.get(r.reaction)||0)+1);return {results:[...grouped].map(([reaction,count])=>({reaction,count}))}; }
          if (sql.includes("FROM comments WHERE share_id")) return { results:[...db.comments.values()].filter(c=>c.share_id===v[0]) };
          if (sql.includes("FROM recordings r LEFT JOIN shares") && sql.includes("status = 'ready'")) {
            return { results:[...db.recordings.values()].filter(r=>r.status==="ready"&&!([...db.shares.values()].some(s=>s.recording_id===r.id))).map(r=>({id:r.id,object_key:r.object_key})) };
          }
          if (sql.includes("FROM recordings WHERE owner_token_hash")) return { results:[...db.recordings.values()].filter(r=>r.owner_token_hash===v[0]) };
          return { results:[] };
        }
      };
    }};
  }
}
const makeEnv = () => {
  const DB=new FakeD1(), objects=new Map<string, {bytes:Uint8Array;type:string;uploaded:Date}>(), deleted:string[]=[];
  const MEDIA={
    async put(key:string, body:ReadableStream<Uint8Array>, options:any){const bytes=new Uint8Array(await new Response(body).arrayBuffer());objects.set(key,{bytes,type:options.httpMetadata.contentType,uploaded:new Date()});},
    async list(options:any={}){const keys=[...objects.keys()].filter(key=>key.startsWith(options.prefix??""));const limit=options.limit??1000;return {objects:keys.slice(0,limit).map(key=>({key,uploaded:objects.get(key)!.uploaded})),truncated:keys.length>limit};},
    async get(key:string, options?:any){const o=objects.get(key);if(!o)return null;const bytes=options?.range?o.bytes.slice(options.range.offset,options.range.offset+options.range.length):o.bytes;return {body:new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer]).stream(),httpEtag:'etag'};},
    async head(key:string){const o=objects.get(key);return o?{size:o.bytes.length,httpMetadata:{contentType:o.type}}:null;},
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
  const uploaded=await worker.fetch(new Request(`https://screennote.test/api/recordings/${body.id}/media`,{method:"PUT",headers:{origin:"https://screennote.test",cookie,"content-type":"video/webm","content-length":"4"},body:new Uint8Array([0x1a,0x45,0xdf,0xa3])}),env,{} as any);
  return {id:body.id,uploaded};
}
describe("ScreenNote temporary sharing API",()=>{
  let state:ReturnType<typeof makeEnv>;
  beforeEach(()=>{state=makeEnv();});
  it("rejects oversized JSON before parsing or reserving upload state",async()=>{
    const s=await session(state.env),huge=JSON.stringify({title:"Oversized",mimeType:"video/webm",size:4,duration:12,padding:"x".repeat(80*1024)});
    const response=await worker.fetch(new Request("https://screennote.test/api/recordings",{method:"POST",headers:{origin:"https://screennote.test",cookie:s.cookie,"content-type":"application/json"},body:huge}),state.env as any,{} as any);
    expect(response.status).toBe(400);expect(state.DB.recordings.size).toBe(0);
  });
  it("creates guest sessions and rejects cross-origin writes",async()=>{
    const res=await worker.fetch(new Request("https://screennote.test/api/session",{headers:{origin:"https://evil.test"}}),state.env as any,{} as any);
    expect(res.status).toBe(403);expect(state.DB.sessions.size).toBe(0);
    const s=await session(state.env);
    const noOrigin=await worker.fetch(new Request("https://screennote.test/api/recordings",{method:"POST",headers:{cookie:s.cookie,"content-type":"application/json"},body:JSON.stringify({title:"Blocked",mimeType:"video/webm",size:4,duration:12})}),state.env as any,{} as any);
    expect(noOrigin.status).toBe(403);expect(state.DB.recordings.size).toBe(0);
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
  it("resumes a missing upload part and assembles the private recording in order",async()=>{
    const origin="https://screennote.test",s=await session(state.env),headers={origin,cookie:s.cookie,"content-type":"application/json"};
    const size=2*1024*1024+4;
    const created=await worker.fetch(new Request("https://screennote.test/api/recordings",{method:"POST",headers,body:JSON.stringify({title:"Resumable upload",mimeType:"video/webm",size,duration:12})}),state.env as any,{} as any);
    expect(created.status).toBe(201);const reservation=await created.json() as any;
    const first=new Uint8Array(2*1024*1024);first.set([0x1a,0x45,0xdf,0xa3]);
    const part0=await worker.fetch(new Request("https://screennote.test/api/recordings/"+reservation.id+"/parts/0",{method:"PUT",headers:{origin:"https://screennote.test",origin,cookie:s.cookie,"content-type":"application/octet-stream"},body:first}),state.env as any,{} as any);
    expect(part0.status).toBe(200);
    const stateAfterPart=await worker.fetch(new Request("https://screennote.test/api/recordings/"+reservation.id+"/upload-state",{headers:{origin,cookie:s.cookie}}),state.env as any,{} as any);
    expect(await stateAfterPart.json()).toMatchObject({status:"uploading",parts:[{part:0,size:2*1024*1024}]});
    const incomplete=await worker.fetch(new Request("https://screennote.test/api/recordings/"+reservation.id+"/complete",{method:"POST",headers,body:"{}"}),state.env as any,{} as any);
    expect(incomplete.status).toBe(409);expect(await incomplete.json()).toMatchObject({missingParts:[1]});
    const part1=await worker.fetch(new Request("https://screennote.test/api/recordings/"+reservation.id+"/parts/1",{method:"PUT",headers:{origin:"https://screennote.test",origin,cookie:s.cookie,"content-type":"application/octet-stream"},body:new Uint8Array([1,2,3,4])}),state.env as any,{} as any);
    expect(part1.status).toBe(200);
    const complete=await worker.fetch(new Request("https://screennote.test/api/recordings/"+reservation.id+"/complete",{method:"POST",headers,body:"{}"}),state.env as any,{} as any);
    expect(complete.status).toBe(200);expect(await complete.json()).toMatchObject({status:"ready"});
    const stored=state.objects.get("shared/"+reservation.id);expect(stored?.bytes.length).toBe(size);
    expect(state.objects.has("recording-parts/"+reservation.id+"/0")).toBe(false);
  });
  it("supports anonymous share reactions with one vote per browser key",async()=>{
    const s=await session(state.env),u=await upload(state.env,s.cookie),key="e".repeat(64);
    const pub=await worker.fetch(new Request("https://screennote.test/api/recordings/"+u.id+"/publish",{method:"POST",headers:{origin:"https://screennote.test",cookie:s.cookie,"content-type":"application/json"},body:JSON.stringify({expiresInDays:1,ownerKey:key})}),state.env as any,{} as any);
    const share=await pub.json() as any,base="https://screennote.test/api/share/"+share.token;
    const initial=await worker.fetch(new Request(base+"/reactions"),state.env as any,{} as any);
    expect(await initial.json()).toMatchObject({counts:{like:0,thanks:0,idea:0},myReaction:""});
    const vote=await worker.fetch(new Request(base+"/reactions",{method:"POST",headers:{origin:"https://screennote.test","content-type":"application/json"},body:JSON.stringify({voterKey:"f".repeat(64),reaction:"like"})}),state.env as any,{} as any);
    expect(await vote.json()).toMatchObject({counts:{like:1,thanks:0,idea:0},myReaction:"like"});
    const own=await worker.fetch(new Request(base+"/reactions",{headers:{"x-voter-key":"f".repeat(64)}}),state.env as any,{} as any);
    expect(await own.json()).toMatchObject({myReaction:"like"});
    const change=await worker.fetch(new Request(base+"/reactions",{method:"POST",headers:{origin:"https://screennote.test","content-type":"application/json"},body:JSON.stringify({voterKey:"f".repeat(64),reaction:"thanks"})}),state.env as any,{} as any);
    expect(await change.json()).toMatchObject({counts:{like:0,thanks:1,idea:0},myReaction:"thanks"});
    const remove=await worker.fetch(new Request(base+"/reactions",{method:"POST",headers:{origin:"https://screennote.test","content-type":"application/json"},body:JSON.stringify({voterKey:"f".repeat(64),reaction:""})}),state.env as any,{} as any);
    expect(await remove.json()).toMatchObject({counts:{like:0,thanks:0,idea:0},myReaction:""});
  });
  it("persists share context behind the owner key and exposes it to viewers",async()=>{
    const s=await session(state.env),u=await upload(state.env,s.cookie),key="c".repeat(64);
    const pub=await worker.fetch(new Request(`https://screennote.test/api/recordings/${u.id}/publish`,{method:"POST",headers:{origin:"https://screennote.test",cookie:s.cookie,"content-type":"application/json"},body:JSON.stringify({expiresInDays:1,password:"context-password",ownerKey:key})}),state.env as any,{} as any);
    const share=await pub.json() as any;
    const details={captions:[{start:1,end:2,text:"Opening"}],chapters:[{time:1,title:"Intro"}],annotations:[{kind:"redact",x:.1,y:.1,w:.2,h:.2}],report:{steps:"Reproduce"},reviewStatus:"changes-requested"};
    const denied=await worker.fetch(new Request(`https://screennote.test/api/share/${share.token}/details`,{method:"PUT",headers:{origin:"https://screennote.test","content-type":"application/json"},body:JSON.stringify({ownerKey:"d".repeat(64),details})}),state.env as any,{} as any);
    expect(denied.status).toBe(403);
    const saved=await worker.fetch(new Request(`https://screennote.test/api/share/${share.token}/details`,{method:"PUT",headers:{origin:"https://screennote.test","content-type":"application/json"},body:JSON.stringify({ownerKey:key,details})}),state.env as any,{} as any);
    expect(saved.status).toBe(200);
    const locked=await worker.fetch(new Request(`https://screennote.test/api/share/${share.token}/details`),state.env as any,{} as any);
    expect(locked.status).toBe(401);
    const access=await worker.fetch(new Request(`https://screennote.test/api/share/${share.token}/access`,{method:"POST",headers:{origin:"https://screennote.test","content-type":"application/json"},body:JSON.stringify({password:"context-password"})}),state.env as any,{} as any);
    expect(access.status).toBe(200);
    const read=await worker.fetch(new Request(`https://screennote.test/api/share/${share.token}/details`,{headers:{cookie:access.headers.get("set-cookie")!.split(";")[0]}}),state.env as any,{} as any);
    expect(read.status).toBe(200);expect(await read.json()).toMatchObject({details});
  });
  it("supports account-free review decisions and lets a guest update their response",async()=>{
    const s=await session(state.env),u=await upload(state.env,s.cookie),ownerKey="a".repeat(64),reviewerKey="1".repeat(64);
    const pub=await worker.fetch(new Request(`https://screennote.test/api/recordings/${u.id}/publish`,{method:"POST",headers:{origin:"https://screennote.test",cookie:s.cookie,"content-type":"application/json"},body:JSON.stringify({expiresInDays:1,ownerKey})}),state.env as any,{} as any);
    const share=await pub.json() as any,url=`https://screennote.test/api/share/${share.token}/reviews`;
    const initial=await worker.fetch(new Request(url,{headers:{"x-reviewer-key":reviewerKey}}),state.env as any,{} as any);
    expect(await initial.json()).toMatchObject({reviews:[],myReview:null});
    const missing=await worker.fetch(new Request(url,{method:"POST",headers:{origin:"https://screennote.test","content-type":"application/json"},body:JSON.stringify({reviewerKey,decision:"changes-requested",comment:"",time:5})}),state.env as any,{} as any);
    expect(missing.status).toBe(400);
    const saved=await worker.fetch(new Request(url,{method:"POST",headers:{origin:"https://screennote.test","content-type":"application/json"},body:JSON.stringify({reviewerKey,reviewerLabel:"Luke",decision:"changes-requested",comment:"Payment state is unclear",time:5})}),state.env as any,{} as any);
    expect(saved.status).toBe(200);expect(await saved.json()).toMatchObject({saved:true});
    const listed=await worker.fetch(new Request(url,{headers:{"x-reviewer-key":reviewerKey}}),state.env as any,{} as any);
    expect(await listed.json()).toMatchObject({myReview:{reviewerLabel:"Luke",decision:"changes-requested",comment:"Payment state is unclear",time:5},reviews:[{reviewerLabel:"Luke",decision:"changes-requested"}]});
    const updated=await worker.fetch(new Request(url,{method:"POST",headers:{origin:"https://screennote.test","content-type":"application/json"},body:JSON.stringify({reviewerKey,reviewerLabel:"Luke",decision:"approved",comment:"",time:6})}),state.env as any,{} as any);
    expect(updated.status).toBe(200);
    const final=await worker.fetch(new Request(url,{headers:{"x-reviewer-key":reviewerKey}}),state.env as any,{} as any);
    expect(await final.json()).toMatchObject({myReview:{decision:"approved",comment:"",time:6},reviews:[{decision:"approved"}]});
  });
  it("requires a password before serving protected media",async()=>{
    const s=await session(state.env),u=await upload(state.env,s.cookie),key="b".repeat(64);
    const pub=await worker.fetch(new Request(`https://screennote.test/api/recordings/${u.id}/publish`,{method:"POST",headers:{origin:"https://screennote.test",cookie:s.cookie,"content-type":"application/json"},body:JSON.stringify({expiresInDays:1,password:"long-password",ownerKey:key})}),state.env as any,{} as any);
    const share=await pub.json() as any;
    const locked=await worker.fetch(new Request(`https://screennote.test/api/share/${share.token}`),state.env as any,{} as any);
    expect(locked.status).toBe(401);
    const access=await worker.fetch(new Request(`https://screennote.test/api/share/${share.token}/access`,{method:"POST",headers:{origin:"https://screennote.test","content-type":"application/json"},body:JSON.stringify({password:"long-password"})}),state.env as any,{} as any);
    expect(access.status).toBe(200);expect(access.headers.get("set-cookie")).toContain("HttpOnly");
  });
  it("throttles comment spam by share and hashed client network",async()=>{
    const s=await session(state.env),u=await upload(state.env,s.cookie),ownerKey="b".repeat(64);
    const pub=await worker.fetch(new Request(`https://screennote.test/api/recordings/${u.id}/publish`,{method:"POST",headers:{origin:"https://screennote.test",cookie:s.cookie,"content-type":"application/json"},body:JSON.stringify({expiresInDays:1,ownerKey})}),state.env as any,{} as any);
    const share=await pub.json() as any,token=share.token,authorKey="a".repeat(43);
    const headers={origin:"https://screennote.test","content-type":"application/json","cf-connecting-ip":"203.0.113.8"};
    for(let i=0;i<12;i++){const res=await worker.fetch(new Request(`https://screennote.test/api/share/${token}/comments`,{method:"POST",headers,body:JSON.stringify({authorKey,text:"Feedback "+i,time:1,viewerLabel:"Guest"})}),state.env as any,{} as any);expect(res.status).toBe(201);}
    const blocked=await worker.fetch(new Request(`https://screennote.test/api/share/${token}/comments`,{method:"POST",headers,body:JSON.stringify({authorKey,text:"Spam",time:1})}),state.env as any,{} as any);
    expect(blocked.status).toBe(429);
  });
  it("supports timestamped nested discussion and creator thread resolution",async()=>{
    const s=await session(state.env),u=await upload(state.env,s.cookie),key="c".repeat(64);
    const pub=await worker.fetch(new Request(`https://screennote.test/api/recordings/${u.id}/publish`,{method:"POST",headers:{origin:"https://screennote.test",cookie:s.cookie,"content-type":"application/json"},body:JSON.stringify({expiresInDays:3,ownerKey:key})}),state.env as any,{} as any);
    const share=await pub.json() as any, url=`https://screennote.test/api/share/${share.token}/comments`;
    const author="d".repeat(48);
    const first=await worker.fetch(new Request(url,{method:"POST",headers:{origin:"https://screennote.test","content-type":"application/json"},body:JSON.stringify({authorKey:author,text:"The menu jumps here",time:4,anchorX:0.25,anchorY:0.5})}),state.env as any,{} as any);
    expect(first.status).toBe(201);const comment=await first.json() as any;
    const reply=await worker.fetch(new Request(url,{method:"POST",headers:{origin:"https://screennote.test","content-type":"application/json"},body:JSON.stringify({authorKey:"e".repeat(48),parentId:comment.id,text:"I can reproduce it",time:4})}),state.env as any,{} as any);
    expect(reply.status).toBe(201);
    const resolve=await worker.fetch(new Request(`https://screennote.test/api/share/${share.token}/comments/${comment.id}/resolve`,{method:"PATCH",headers:{origin:"https://screennote.test","content-type":"application/json"},body:JSON.stringify({ownerKey:key,resolved:true})}),state.env as any,{} as any);
    expect(resolve.status).toBe(200);
  });
  it("locks password guesses by share and client IP after five failures",async()=>{
    const s=await session(state.env),u=await upload(state.env,s.cookie),key="f".repeat(64);
    const pub=await worker.fetch(new Request(`https://screennote.test/api/recordings/${u.id}/publish`,{method:"POST",headers:{origin:"https://screennote.test",cookie:s.cookie,"content-type":"application/json"},body:JSON.stringify({expiresInDays:7,password:"correct horse",ownerKey:key})}),state.env as any,{} as any);
    expect(pub.status).toBe(201);
    const share=await pub.json() as any;
    for(let i=0;i<5;i++){
      const attempt=await worker.fetch(new Request(`https://screennote.test/api/share/${share.token}/access`,{method:"POST",headers:{origin:"https://screennote.test","content-type":"application/json"},body:JSON.stringify({password:"incorrect"})}),state.env as any,{} as any);
      expect(attempt.status).toBe(i===4?429:401);
    }
    const correct=await worker.fetch(new Request(`https://screennote.test/api/share/${share.token}/access`,{method:"POST",headers:{origin:"https://screennote.test","content-type":"application/json"},body:JSON.stringify({password:"correct horse"})}),state.env as any,{} as any);
    expect(correct.status).toBe(429);
    const attempt=[...state.DB.passwordAttempts.values()][0];
    expect(attempt.attempts).toBe(5);
    expect(attempt.locked_until).toBeGreaterThan(Math.floor(Date.now()/1000));
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
  it("purges stale R2 objects that no longer have a D1 recording reference",async()=>{
    const key="shared/orphaned-test-object";
    state.objects.set(key,{bytes:new Uint8Array([1,2,3]),type:"video/webm",uploaded:new Date(Date.now()-3601*1000)});
    let task:Promise<void>|undefined;
    await worker.scheduled({} as any,state.env as any,{waitUntil(p:Promise<void>){task=p;}} as any);
    await task;
    expect(state.objects.has(key)).toBe(false);
    expect(state.deleted).toContain(key);
  });
  it("deletes completed uploads that were never published after the grace period",async()=>{
    const s=await session(state.env),u=await upload(state.env,s.cookie);
    expect(u.uploaded.status).toBe(200);
    const row=state.DB.recordings.get(u.id);
    row.created_at=Math.floor(Date.now()/1000)-601;
    let task:Promise<void>|undefined;
    await worker.scheduled({} as any,state.env as any,{waitUntil(p:Promise<void>){task=p;}} as any);
    await task;
    expect(state.DB.recordings.size).toBe(0);
    expect(state.objects.size).toBe(0);
    expect(state.deleted).toContain("shared/"+u.id);
  });
});