import { inspectNativeMedia } from "./validate-media";
// Cloudflare-native implementation of ScreenNote 0.5.0's /api/clip contract.
// Pure validation helpers are shared with the original application; storage and
// authorization are implemented on D1/R2. Unknown IDs return null so old
// Vercel shares remain readable through the explicit compatibility fallback.
// @ts-ignore - shared browser-safe JS module
import { clipInput, validId, isVideo, publicClip, commentInput, CHUNK_BYTES, MAX_BYTES, MAX_SECONDS } from "../legacy/lib/rules.js";
// @ts-ignore - shared browser-safe JS module
import { validateExtras } from "../legacy/lib/enrichment.js";
// @ts-ignore - shared browser-safe JS module
import { validTitle } from "../legacy/lib/titles.js";
// @ts-ignore - shared browser-safe JS module
import { REVIEW_STATES } from "../legacy/lib/library.js";

type LegacyEnv = { DB:D1Database; MEDIA:R2Bucket };
type ClipRow = {
  id:string; owner_hash:string; status:string; size:number; mime_type:string;
  duration_seconds:number; expires_at:number; upload_until:number; created_at:number;
  object_key:string; data:string; media_token_hash:string|null; media_token_expires:number|null;
};
type ClipRecord = { row:ClipRow; clip:any };
const fail=(message:string,status=400,code?:string)=>Object.assign(new Error(message),{status,code});
const response=(data:unknown,status=200,headers:HeadersInit={})=>Response.json(data,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff",...headers}});
const encoder=new TextEncoder();
const MAX_BODY=4_200_000,MAX_CLIPS=10_000,MAX_STORAGE=1_000_000_000;
const PASSWORD_LIMIT=5,PASSWORD_WINDOW=900,PASSWORD_LOCK=900;
const terminal=(s:string)=>["revoked","deleted","expired"].includes(s);
const keyFor=(id:string)=>`legacy/clips/${id}/video`;
const partKey=(id:string,n:number)=>`legacy/clips/${id}/parts/${n}`;
const hex=(bytes:Uint8Array)=>[...bytes].map(x=>x.toString(16).padStart(2,"0")).join("");
async function digest(value:string){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(value))))}
function randomToken(bytes=32){const b=crypto.getRandomValues(new Uint8Array(bytes));return btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
function safeEqual(a:string,b:string){const x=encoder.encode(a),y=encoder.encode(b);let d=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)d|=(x[i]??0)^(y[i]??0);return d===0}
function decodeBase64(raw:string){let bin:string;try{bin=atob(raw)}catch{throw fail("Invalid upload data.")}const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));if(btoa(bin)!==raw)throw fail("Invalid upload data.");return bytes}
function base64(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes))}
async function getClip(env:LegacyEnv,id:string):Promise<ClipRecord|null>{
 if(!validId(id))return null;
 const row=await env.DB.prepare("SELECT * FROM legacy_clip_records WHERE id=?").bind(id).first<ClipRow>();
 return row?{row,clip:JSON.parse(row.data)}:null;
}
async function getTombstone(env:LegacyEnv,id:string){if(!validId(id))return null;return env.DB.prepare("SELECT id,owner_hash,deleted_at,reason FROM legacy_clip_tombstones WHERE id=?").bind(id).first<{id:string;owner_hash:string;deleted_at:number;reason:string}>()}
async function purgeRecord(env:LegacyEnv,record:ClipRecord,reason:string){
 await env.DB.batch([
  env.DB.prepare("INSERT INTO legacy_clip_tombstones(id,owner_hash,deleted_at,reason) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner_hash=excluded.owner_hash,deleted_at=excluded.deleted_at,reason=excluded.reason").bind(record.row.id,record.row.owner_hash,Date.now(),reason),
  env.DB.prepare("DELETE FROM legacy_clip_password_attempts WHERE clip_id=?").bind(record.row.id),
  env.DB.prepare("DELETE FROM legacy_clip_parts WHERE clip_id=?").bind(record.row.id),
  env.DB.prepare("DELETE FROM legacy_clip_records WHERE id=?").bind(record.row.id)
 ]);
}
async function saveClip(env:LegacyEnv,record:ClipRecord,clip:any,patch:Record<string,unknown>={}){
 const row=record.row;
 const saved=await env.DB.prepare("UPDATE legacy_clip_records SET status=?,expires_at=?,upload_until=?,data=?,media_token_hash=?,media_token_expires=? WHERE id=? AND data=?").bind(clip.status,clip.expiresAt,clip.uploadUntil,JSON.stringify(clip),patch.mediaTokenHash===undefined?row.media_token_hash:patch.mediaTokenHash,patch.mediaTokenExpires===undefined?row.media_token_expires:patch.mediaTokenExpires,row.id,row.data).run();
 if(saved.meta.changes!==1)throw fail("Recording metadata changed. Refresh and try again.",409);
 record.clip=clip;row.status=clip.status;row.expires_at=clip.expiresAt;row.upload_until=clip.uploadUntil;row.data=JSON.stringify(clip);
 if(patch.mediaTokenHash!==undefined)row.media_token_hash=patch.mediaTokenHash as string|null;
 if(patch.mediaTokenExpires!==undefined)row.media_token_expires=patch.mediaTokenExpires as number|null;
}
async function transitionStatus(env:LegacyEnv,record:ClipRecord,clip:any,nextStatus:string,patch:Record<string,unknown>={}){
 const row=record.row,oldStatus=row.status,id=row.id,size=clip.size;
 const toTerminal=terminal(nextStatus)&&["pending","published"].includes(oldStatus);
 const releaseBytes=oldStatus==="pending"&&nextStatus==="published"?size:toTerminal?(oldStatus==="pending"?2*size:size):0;
 const releaseCount=toTerminal?1:0;
 clip.status=nextStatus;
 const tokenHash=patch.mediaTokenHash===undefined?record.row.media_token_hash:patch.mediaTokenHash;
 const tokenExpires=patch.mediaTokenExpires===undefined?record.row.media_token_expires:patch.mediaTokenExpires;
 const result=await env.DB.batch([
  env.DB.prepare("UPDATE legacy_capacity SET reserved_bytes=MAX(0,reserved_bytes-?),reserved_count=MAX(0,reserved_count-?) WHERE id=1 AND EXISTS(SELECT 1 FROM legacy_clip_records WHERE id=? AND status=? AND data=?)").bind(releaseBytes,releaseCount,id,oldStatus,row.data),
  env.DB.prepare("UPDATE legacy_clip_records SET status=?,expires_at=?,upload_until=?,data=?,media_token_hash=?,media_token_expires=? WHERE id=? AND status=? AND data=?").bind(nextStatus,clip.expiresAt,clip.uploadUntil,JSON.stringify(clip),tokenHash,tokenExpires,id,oldStatus,row.data)
 ]);
 if(result[1].meta.changes!==1)throw fail("This clip changed. Refresh and try again.",409);
 record.row.status=nextStatus;record.row.expires_at=clip.expiresAt;record.row.upload_until=clip.uploadUntil;record.row.data=JSON.stringify(clip);
 record.row.media_token_hash=tokenHash as string|null;record.row.media_token_expires=tokenExpires as number|null;record.clip=clip;
}
async function ownerMatches(value:unknown,expected:string){return typeof value==="string"&&value.length>=40&&value.length<=100&&safeEqual(await digest(value),expected)}
async function requireOwner(clip:any,owner:unknown){if(!await ownerMatches(owner,clip.ownerHash))throw fail("This browser does not have permission to manage the link.",403)}
function available(clip:any){if(clip.status!=="published"||clip.expiresAt<=Date.now())throw fail("This link has expired or is no longer shared.",404)}
export async function passwordRecord(password:unknown){
 if(password===undefined||password==="")return {};
 if(typeof password!=="string"||password.length<8||password.length>128)throw fail("Use a sharing password of 8–128 characters.");
 const salt=randomToken(16),key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:encoder.encode(salt),iterations:100000},key,256);
 return{passwordSalt:salt,passwordHash:hex(new Uint8Array(bits)),passwordAlgorithm:"pbkdf2-sha256"};
}
export async function checkPassword(clip:any,password:unknown){
 if(!clip.passwordHash)return true;
 if(typeof password!=="string"||password.length>128||clip.passwordAlgorithm!=="pbkdf2-sha256")return false;
 const key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:encoder.encode(clip.passwordSalt),iterations:100000},key,256);
 return safeEqual(hex(new Uint8Array(bits)),clip.passwordHash);
}
async function passwordGate(request:Request,env:LegacyEnv,record:ClipRecord,password:unknown){
 const c=record.clip;available(c);if(!c.passwordHash)return;
 const ip=request.headers.get("cf-connecting-ip")||"unknown",ipHash=await digest(c.id+":"+ip),now=Math.floor(Date.now()/1000);
 const old=await env.DB.prepare("SELECT attempts,window_started,locked_until FROM legacy_clip_password_attempts WHERE clip_id=? AND ip_hash=?").bind(c.id,ipHash).first<{attempts:number;window_started:number;locked_until:number}>();
 if(old&&old.locked_until>now)throw fail("Too many password attempts. Try again in 15 minutes.",429,"PASSWORD_LOCKED");
 const ok=await checkPassword(c,password);
 if(ok){await env.DB.prepare("DELETE FROM legacy_clip_password_attempts WHERE clip_id=? AND ip_hash=?").bind(c.id,ipHash).run();return}
 if(typeof password==="string"&&password){
  const within=old&&now-old.window_started<PASSWORD_WINDOW,attempts=(within?old!.attempts:0)+1,windowStarted=within?old!.window_started:now,lockedUntil=attempts>=PASSWORD_LIMIT?now+PASSWORD_LOCK:0;
  await env.DB.prepare("INSERT INTO legacy_clip_password_attempts(clip_id,ip_hash,window_started,attempts,locked_until) VALUES(?,?,?,?,?) ON CONFLICT(clip_id,ip_hash) DO UPDATE SET window_started=excluded.window_started,attempts=excluded.attempts,locked_until=excluded.locked_until")
   .bind(c.id,ipHash,windowStarted,attempts,lockedUntil).run();
 }
 throw fail("This video needs its sharing password.",401,"PASSWORD_REQUIRED");
}
async function issueMedia(request:Request,env:LegacyEnv,record:ClipRecord){
 const c=record.clip;available(c);const token=randomToken(32),tokenHash=await digest(token),expires=Math.min(c.expiresAt,Date.now()+30*60*1000);
 await saveClip(env,record,c,{mediaTokenHash:tokenHash,mediaTokenExpires:expires});
 const url=new URL("/api/clip",request.url);url.searchParams.set("op","media");url.searchParams.set("id",c.id);url.searchParams.set("token",token);return url.toString();
}
async function clearParts(env:LegacyEnv,id:string){
 const rows=await env.DB.prepare("SELECT part,object_key FROM legacy_clip_parts WHERE clip_id=?").bind(id).all<{part:number;object_key:string}>();
 for(const p of rows.results)await env.MEDIA.delete(p.object_key);
 await env.DB.prepare("DELETE FROM legacy_clip_parts WHERE clip_id=?").bind(id).run();
}
async function removeClipMedia(env:LegacyEnv,record:ClipRecord){
 await env.MEDIA.delete(record.row.object_key);await clearParts(env,record.row.id);
}
async function assemble(env:LegacyEnv,record:ClipRecord){
 const c=record.clip,size=c.size,count=Math.ceil(size/CHUNK_BYTES),parts=await env.DB.prepare("SELECT part,object_key,size FROM legacy_clip_parts WHERE clip_id=? ORDER BY part").bind(c.id).all<{part:number;object_key:string;size:number}>();
 if(parts.results.length!==count)throw fail("An upload part is missing. Publish again to retry.",409);
 for(let i=0;i<count;i++)if(parts.results[i].part!==i)throw fail("An upload part is missing. Publish again to retry.",409);
 const readPart=async(n:number)=>{const obj=await env.MEDIA.get(parts.results[n].object_key);if(!obj)throw fail("An upload part is missing. Publish again to retry.",409);return new Uint8Array(await obj.arrayBuffer())};
 const objectKey=record.row.object_key;
 if(size<=5*1024*1024){const bytes=new Uint8Array(size);let offset=0;for(let i=0;i<count;i++){const part=await readPart(i);bytes.set(part,offset);offset+=part.length}await env.MEDIA.put(objectKey,bytes,{httpMetadata:{contentType:c.type}});return}
 const multipart=await env.MEDIA.createMultipartUpload(objectKey,{httpMetadata:{contentType:c.type}}),uploaded:R2UploadedPart[]=[];
 try{
  let offset=0,number=1;
  while(offset<size){const length=Math.min(6*1024*1024,size-offset),buffer=new Uint8Array(length);let written=0;
   while(written<length){const chunkIndex=Math.floor(offset/CHUNK_BYTES),within=offset%CHUNK_BYTES,chunk=await readPart(chunkIndex),take=Math.min(length-written,chunk.length-within);buffer.set(chunk.subarray(within,within+take),written);offset+=take;written+=take}
   uploaded.push(await multipart.uploadPart(number++,buffer));
  }
  await multipart.complete(uploaded);
 }catch(error){await multipart.abort().catch(()=>{});throw error}
}
async function cleanupPending(env:LegacyEnv,record:ClipRecord){
 await removeClipMedia(env,record);
}
function rootOf(comments:any[],comment:any){const seen=new Set<string>();let current=comment;while(current.parentId){if(seen.has(current.id))throw fail("This thread is unavailable.",409);seen.add(current.id);const parent=comments.find(x=>x.id===current.parentId);if(!parent)break;current=parent}return current}
export async function applyComment(env:LegacyEnv,clip:any,op:string,body:any){
 if(clip.status!=="published"||clip.expiresAt<Date.now())throw fail("This link has expired or is no longer shared.",404);
 clip.comments||=[];const creator=await ownerMatches(body.owner,clip.ownerHash);
 if(op==="comment"){
  const comment=commentInput(body,clip),eventId=body.eventId;
  if(!validId(eventId))throw fail("Invalid reply identity.");
  if(body.authorKey!==undefined&&!/^[a-f0-9]{64}$/.test(body.authorKey))throw fail("Invalid comment management key.");
  if(clip.comments.some((x:any)=>x.id===eventId))return publicClip(clip);
  if(clip.comments.length>=100)throw fail("This clip has reached 100 comments and replies.",429);
  if(comment.parentId){const parent=clip.comments.find((x:any)=>x.id===comment.parentId);if(!parent||parent.deleted)throw fail("This reply is no longer available. Refresh the conversation.",409);comment.time=parent.time;rootOf(clip.comments,parent).resolved=false}
  clip.comments.push({...comment,id:eventId,createdAt:Date.now(),creator,...(body.authorKey?{authorHash:await digest(body.authorKey)}:{})});
 }else{
  if(!validId(body.commentId))throw fail("Choose an existing comment.");
  const comment=clip.comments.find((x:any)=>x.id===body.commentId);if(!comment)throw fail("Comment not found.",404);
  const author=await ownerMatches(body.authorKey,comment.authorHash||"");
  if(op==="resolve-thread"){
   const root=rootOf(clip.comments,comment);
   if(!creator&&!await ownerMatches(body.authorKey,root.authorHash||""))throw fail("Only the thread author or video creator can resolve this thread.",403);
   if(typeof body.resolved!=="boolean")throw fail("Choose whether this thread is resolved.");root.resolved=body.resolved;
  }else{
   if(!author&&!(creator&&op==="delete-comment"))throw fail("This browser cannot change this comment.",403);
   if(op==="delete-comment"){comment.deleted=true;comment.text="";comment.name="Deleted comment";comment.editedAt=Date.now()}
   else if(op==="edit-comment"){
    if(comment.deleted)throw fail("This comment was deleted.",409);
    if(body.expectedVersion!==(comment.editedAt||comment.createdAt))throw fail("This comment changed. Refresh before editing again.",409);
    if(typeof body.text!=="string"||body.text.trim().length>500||!body.text.trim())throw fail("Please check the text fields.");
    comment.text=body.text.trim();comment.editedAt=Math.max(Date.now(),(comment.editedAt||comment.createdAt)+1);
   }
  }
 }
 clip.discussionRevision=(clip.discussionRevision||0)+1;return publicClip(clip);
}
async function handleMedia(request:Request,env:LegacyEnv,url:URL){
 const id=url.searchParams.get("id")||"",token=url.searchParams.get("token")||"",record=await getClip(env,id);
 if(!record){const tombstone=await getTombstone(env,id);return tombstone?response({error:"This share was deleted or expired."},404):null}
 const row=record.row,c=record.clip;
 if(c.status!=="published"||c.expiresAt<=Date.now()||!token||!row.media_token_hash||(row.media_token_expires ?? 0)<=Date.now()||!safeEqual(await digest(token),row.media_token_hash))return response({error:"This media link has expired."},404);
 const head=request.method==="HEAD",range=request.headers.get("range"),object=await env.MEDIA.head(row.object_key);
 if(!object)return response({error:"Video unavailable."},404);
 let start=0,end=object.size-1,status=200;
 if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range.trim());if(!m)return response({error:"Invalid byte range."},416,{"content-range":`bytes */${object.size}`});
  if(!m[1]){const suffix=Number(m[2]);if(!suffix)return response({error:"Invalid byte range."},416,{"content-range":`bytes */${object.size}`});start=Math.max(0,object.size-suffix);end=object.size-1}
  else{start=Number(m[1]);end=m[2]?Number(m[2]):object.size-1}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||start>=object.size)return response({error:"Invalid byte range."},416,{"content-range":`bytes */${object.size}`});
  end=Math.min(end,object.size-1);status=206;
 }
 const length=end-start+1,body=head?null:await env.MEDIA.get(row.object_key,range?{range:{offset:start,length}}:{});
 if(!head&&!body)return response({error:"Video unavailable."},404);
 const headers=new Headers({"content-type":row.mime_type,"content-length":String(length),"accept-ranges":"bytes","cache-control":"private, no-store","x-content-type-options":"nosniff"});
 if(status===206)headers.set("content-range",`bytes ${start}-${end}/${object.size}`);
 return new Response(head?null:body!.body,{status,headers});
}
async function parseBody(request:Request){
 const bytes=await request.arrayBuffer();if(bytes.byteLength>MAX_BODY)throw fail("Request is too large.",413);
 if(!bytes.byteLength)return{};try{return JSON.parse(new TextDecoder().decode(bytes))}catch{throw fail("Invalid JSON request.")}
}
async function getCapacity(env:LegacyEnv){
 const row=await env.DB.prepare("SELECT reserved_bytes,reserved_count FROM legacy_capacity WHERE id=1").first<{reserved_bytes:number;reserved_count:number}>();
 const reserved=row?.reserved_bytes||0;return{maxStorageBytes:MAX_STORAGE,reservedBytes:reserved,availableBytes:Math.max(0,MAX_STORAGE-reserved),reservedRecordings:row?.reserved_count||0};
}
export async function handleLegacyClip(request:Request,env:LegacyEnv):Promise<Response|null>{
 const url=new URL(request.url),op=url.searchParams.get("op")||"",id=url.searchParams.get("id")||"";
 if(request.method==="GET"&&op==="health")return response({configured:true,maxBytes:MAX_BYTES,maxSeconds:MAX_SECONDS,...await getCapacity(env)});
 if(request.method==="GET"&&op==="media")return handleMedia(request,env,url);
 if(request.method!=="GET"&&request.method!=="POST")return null;
 if(request.method==="GET"&&op!=="view")return null;
 if(op==="upload"){const tombstone=await getTombstone(env,id);return tombstone?response({error:"This share was deleted or expired."},404):null} // Vercel Blob token operation remains on the legacy fallback until the native upload path is retired.
 if(request.method==="POST"&&request.headers.get("origin")&&request.headers.get("origin")!==url.origin)return response({error:"Use the ScreenNote page to make this request."},403);
 const body=request.method==="POST"?await parseBody(request):{};
 const clipId=id||body.id||"";
 if(op==="reserve"&&request.method==="POST"){
  const input=clipInput(body);
  if(!validId(body.id)||typeof body.owner!=="string"||body.owner.length<40||body.owner.length>100)throw fail("Invalid recording identity.");
  if(await getTombstone(env,body.id))throw fail("This share identity was deleted. Create a new recording identity.",409);
  const existing=await getClip(env,body.id);
  if(existing){
   await requireOwner(existing.clip,body.owner);
   if(body.password&&(!existing.clip.passwordHash||!await checkPassword(existing.clip,body.password)))throw fail("Use the original sharing password for this upload. Delete the upload first to change its protection.");
   if(!["pending","published"].includes(existing.clip.status))throw fail("This clip is no longer publishable. Create a new share link.",409);
   if(existing.clip.size!==input.size||existing.clip.type!==input.type||existing.clip.duration!==input.duration)throw fail("This upload does not match its reservation.",409);
   if(existing.clip.status==="pending"){Object.assign(existing.clip,input);existing.clip.uploadUntil=Date.now()+600000;await saveClip(env,existing,existing.clip)}
   return response({id:body.id,status:existing.clip.status});
  }
  const credentials=await passwordRecord(body.password),now=Date.now();
  const clip={...input,...credentials,id:body.id,ownerHash:await digest(body.owner),createdAt:now,uploadUntil:now+600000,expiresAt:now+7*86400000,status:"pending",comments:[],votes:{},discussionRevision:0,width:Number(body.width)||0,height:Number(body.height)||0};
  const reservation=await env.DB.batch([
   env.DB.prepare("UPDATE legacy_capacity SET reserved_bytes=reserved_bytes+?,reserved_count=reserved_count+1 WHERE id=1 AND reserved_count<? AND reserved_bytes+?<=?").bind(2*clip.size,MAX_CLIPS,2*clip.size,MAX_STORAGE),
   env.DB.prepare("INSERT INTO legacy_clip_records(id,owner_hash,status,size,mime_type,duration_seconds,expires_at,upload_until,created_at,object_key,data) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1")
    .bind(clip.id,clip.ownerHash,clip.status,clip.size,clip.type,clip.duration,clip.expiresAt,clip.uploadUntil,clip.createdAt,keyFor(clip.id),JSON.stringify(clip))
  ]);
  if(reservation[1].meta.changes!==1)throw fail("Shared storage is full. Download locally, delete a share you own, or try after expired uploads are reclaimed.",429);
  return response({id:clip.id,status:clip.status},201);
 }
 const record=await getClip(env,clipId);if(!record){const tombstone=await getTombstone(env,clipId);if(!tombstone)return null;const owns=await ownerMatches(body.owner,tombstone.owner_hash);if(owns&&op==="delete")return response({deleted:true});if(owns&&op==="revoke")return response({revoked:true});if(owns&&op==="manage")return response({status:tombstone.reason,deleted:true,cleanupComplete:true});return response({error:"This share was deleted or expired."},404)}
 const c=record.clip;
 if(op==="upload-state"){await requireOwner(c,body.owner);if(c.status!=="pending")return response({parts:[]});const rows=await env.DB.prepare("SELECT part FROM legacy_clip_parts WHERE clip_id=? ORDER BY part").bind(c.id).all<{part:number}>();return response({parts:rows.results.map(x=>x.part)})}
 if(op==="view"){
  await passwordGate(request,env,record,body.accessPassword);
  const mediaUrl=await issueMedia(request,env,record);return response({...publicClip(c),mediaUrl});
 }
 if(op==="restore-media"){await requireOwner(c,body.owner);available(c);return response({mediaUrl:await issueMedia(request,env,record)})}
 if(op==="manage"){await requireOwner(c,body.owner);return response({...publicClip(c),type:c.type,size:c.size,status:c.status,cleanupComplete:!!c.cleanupComplete})}
 if(op==="review-status"){await requireOwner(c,body.owner);if(!REVIEW_STATES.includes(body.reviewStatus))throw fail("Choose a valid review status.");c.reviewStatus=body.reviewStatus;await saveClip(env,record,c);return response({reviewStatus:c.reviewStatus})}
 if(op==="title"){await requireOwner(c,body.owner);c.title=validTitle(body.title);await saveClip(env,record,c);return response({title:c.title})}
 if(op==="details"){await requireOwner(c,body.owner);const extras=validateExtras(body,c.duration);Object.assign(c,extras);await saveClip(env,record,c);return response(extras)}
 if(op==="upload-chunk"){
  await requireOwner(c,body.owner);if(c.status!=="pending"||c.uploadUntil<Date.now())throw fail("This upload reservation expired.",409);
  const count=Math.ceil(c.size/CHUNK_BYTES),part=body.part;if(!Number.isInteger(part)||part<0||part>=count||typeof body.data!=="string"||body.data.length>2800000)throw fail("Invalid upload part.");
  const bytes=decodeBase64(body.data),expected=Math.min(CHUNK_BYTES,c.size-part*CHUNK_BYTES);
  if(bytes.length!==expected||part===0&&!isVideo(bytes,c.type))throw fail("The upload part does not match this video.");
  const objectKey=partKey(c.id,part),old=await env.DB.prepare("SELECT size FROM legacy_clip_parts WHERE clip_id=? AND part=?").bind(c.id,part).first<{size:number}>();
  if(old){const obj=await env.MEDIA.head(objectKey);if(obj&&obj.size===expected)return response({part,uploaded:true});await env.MEDIA.put(objectKey,bytes,{httpMetadata:{contentType:"application/octet-stream"}});await env.DB.prepare("UPDATE legacy_clip_parts SET size=?,created_at=? WHERE clip_id=? AND part=?").bind(bytes.length,Date.now(),c.id,part).run()}
  else{await env.MEDIA.put(objectKey,bytes,{httpMetadata:{contentType:"application/octet-stream"}});await env.DB.prepare("INSERT INTO legacy_clip_parts(clip_id,part,object_key,size,created_at) VALUES(?,?,?,?,?)").bind(c.id,part,objectKey,bytes.length,Date.now()).run()}
  return response({part,uploaded:true});
 }
 if(op==="upload-small"){
  await requireOwner(c,body.owner);if(c.status!=="pending"||c.uploadUntil<Date.now())throw fail("This upload reservation expired.",409);
  if(typeof body.data!=="string"||body.data.length>4194304)throw fail("This transfer supports files up to 3 MB.");
  const bytes=decodeBase64(body.data);if(bytes.length>3145728||bytes.length!==c.size||!isVideo(bytes,c.type))throw fail("The upload does not match the video.");
  await env.MEDIA.put(record.row.object_key,bytes,{httpMetadata:{contentType:c.type}});return response({uploaded:true});
 }
 if(op==="publish"){
  await requireOwner(c,body.owner);
  if(c.status==="published"){try{await clearParts(env,c.id);if(!c.cleanupComplete){c.cleanupComplete=true;await saveClip(env,record,c)}}catch{}return response(publicClip(c))}
  if(c.status!=="pending")throw fail("This clip is no longer publishable.",409);
  if(c.uploadUntil<Date.now())throw fail("This upload reservation expired. Publish again to renew it.",409);
  let info=await env.MEDIA.head(record.row.object_key);
  if(!info){await assemble(env,record);info=await env.MEDIA.head(record.row.object_key)}
  if(!info||info.size!==c.size||info.size>MAX_BYTES||!(info.httpMetadata?.contentType||"").startsWith(c.type))throw fail("The uploaded file does not match the video. Keep your local copy and try another file.");
  const fullObject=await env.MEDIA.get(record.row.object_key);if(!fullObject)throw fail("The uploaded video could not be read. Keep your local copy and retry.",503);
  const verified=await inspectNativeMedia(new Uint8Array(await fullObject.arrayBuffer()),{type:c.type,size:c.size,duration:c.duration});
  c.width=verified.width;c.height=verified.height;c.duration=verified.duration;c.expiresAt=Date.now()+(c.linkDays||7)*86400000;c.cleanupComplete=false;
  await transitionStatus(env,record,c,"published",{mediaTokenHash:null,mediaTokenExpires:null});
  try{await clearParts(env,c.id);c.cleanupComplete=true;await saveClip(env,record,c)}catch{}
  return response(publicClip(c));
 }
 if(op==="revoke"){await requireOwner(c,body.owner);c.cleanupComplete=false;await transitionStatus(env,record,c,"revoked",{mediaTokenHash:null,mediaTokenExpires:null});await cleanupPending(env,record);c.cleanupComplete=true;await saveClip(env,record,c);await purgeRecord(env,record,"revoked");return response({revoked:true})}
 if(op==="delete"){await requireOwner(c,body.owner);c.cleanupComplete=false;await transitionStatus(env,record,c,"deleted",{mediaTokenHash:null,mediaTokenExpires:null});await cleanupPending(env,record);c.cleanupComplete=true;await saveClip(env,record,c);await purgeRecord(env,record,"deleted");return response({deleted:true})}
 await passwordGate(request,env,record,body.accessPassword);
 if(!validId(body.viewer))throw fail("Refresh this page before replying.");
 if(["comment","edit-comment","delete-comment","resolve-thread"].includes(op)){
  const result=await applyComment(env,c,op,body);await saveClip(env,record,c);return response(result);
 }
 if(op==="reaction"){
  if(!["like","thanks","idea",""].includes(body.reaction))throw fail("Choose a listed reaction.");
  c.votes||={};const voter=await digest(body.viewer);
  if(!c.votes[voter]&&Object.keys(c.votes).length>=500)throw fail("This clip has reached its reaction limit.",429);
  if(body.reaction)c.votes[voter]=body.reaction;else delete c.votes[voter];await saveClip(env,record,c);return response(publicClip(c));
 }
 return response({error:"Unknown action."},400);
}
