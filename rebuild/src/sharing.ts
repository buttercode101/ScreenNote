// @ts-expect-error Shared browser-safe retry helper has no declaration file.
import { retryTransfer } from "../legacy/lib/transfer.js";
export type PublishResult = { id: string; token: string; url: string; expiresAt: number; passwordProtected: boolean; ownerKey: string };
type PendingUpload = { id: string; size: number; mimeType: string; ownerKey: string; createdAt: number };
async function readJson<T>(response: Response): Promise<T & {error?:string}> {
  return await response.json().catch(() => ({})) as T & {error?:string};
}
function savePending(key:string,value:PendingUpload|null) {
  try { if(value)localStorage.setItem(key,JSON.stringify(value));else localStorage.removeItem(key); } catch { /* Resume remains available for the current page even when storage is blocked. */ }
}
function loadPending(key:string):PendingUpload|null {
  try { const raw=localStorage.getItem(key);if(!raw)return null;const value=JSON.parse(raw) as PendingUpload;return value&&typeof value.id==="string"&&typeof value.ownerKey==="string"?value:null; } catch { return null; }
}
export async function ensureGuestSession(): Promise<void> {
  const response = await fetch("/api/session", { credentials: "same-origin" });
  if (!response.ok) throw new Error("ScreenNote couldn't start a private guest session. Refresh and try again.");
}
export function newOwnerKey(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function publishRecording(
  clip: { id?:string; title: string; mimeType: string; size: number; duration: number; blob: Blob },
  days: number,
  password: string,
  ownerKey: string,
  onProgress: (percent:number)=>void = () => undefined
): Promise<PublishResult> {
  await ensureGuestSession();
  const type=clip.mimeType.split(";")[0],storageKey="screennote-pending-upload-"+(clip.id||"unknown");
  let pending=loadPending(storageKey);
  if(pending&&(pending.size!==clip.size||pending.mimeType!==type)){savePending(storageKey,null);pending=null;}
  let state:{status:string;parts:{part:number;size:number}[];chunkBytes:number}|null=null;
  if(pending){
    const response=await fetch("/api/recordings/"+pending.id+"/upload-state",{credentials:"same-origin"});
    if(response.ok)state=await readJson(response);
    else if(response.status===404||response.status===409){savePending(storageKey,null);pending=null;}
    else {const data=await readJson(response);throw new Error(data.error||"Couldn't resume the previous upload.");}
  }
  if(!pending){
    const create=await fetch("/api/recordings",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({title:clip.title,mimeType:type,size:clip.size,duration:clip.duration})});
    const reservation=await readJson<{id?:string;chunkBytes?:number}>(create);
    if(!create.ok||!reservation.id)throw new Error(reservation.error||"Couldn't prepare this video for sharing.");
    pending={id:reservation.id,size:clip.size,mimeType:type,ownerKey,createdAt:Date.now()};
    savePending(storageKey,pending);
    const status=await fetch("/api/recordings/"+pending.id+"/upload-state",{credentials:"same-origin"});
    if(!status.ok){const data=await readJson(status);throw new Error(data.error||"Couldn't start the resumable upload.");}
    state=await readJson(status);
  } else if(!pending.ownerKey) {
    pending={...pending,ownerKey};savePending(storageKey,pending);
  }
  const resolvedOwnerKey=pending.ownerKey||ownerKey;
  pending={...pending,ownerKey:resolvedOwnerKey};savePending(storageKey,pending);
  const chunkBytes=state?.chunkBytes||2*1024*1024;
  const count=Math.ceil(clip.size/chunkBytes);
  const uploaded=new Set((state?.parts||[]).map(part=>part.part));
  let transferred=(state?.parts||[]).reduce((sum,part)=>sum+part.size,0);
  onProgress(Math.min(99,Math.round(transferred/clip.size*100)));
  if(state?.status!=="ready"){
    for(let part=0;part<count;part++){
      if(uploaded.has(part))continue;
      const start=part*chunkBytes,end=Math.min(clip.size,start+chunkBytes),chunk=clip.blob.slice(start,end);
      await retryTransfer(async()=>{
        const response=await fetch("/api/recordings/"+pending!.id+"/parts/"+part,{method:"PUT",credentials:"same-origin",headers:{"content-type":"application/octet-stream","content-length":String(chunk.size)},body:chunk});
        const data=await readJson<{uploaded?:boolean}>(response);
        if(!response.ok)throw Object.assign(new Error(data.error||"A video part could not be uploaded."),{status:response.status});
        return data;
      },()=>onProgress(Math.min(99,Math.round(transferred/clip.size*100))));
      transferred+=chunk.size;onProgress(Math.min(99,Math.round(transferred/clip.size*100)));
    }
    const complete=await fetch("/api/recordings/"+pending.id+"/complete",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:"{}"});
    const completed=await readJson<{status?:string;missingParts?:number[]}>(complete);
    if(!complete.ok||completed.status!=="ready")throw new Error(completed.error||"The upload is not complete yet. Retry to resume the missing parts.");
  }
  onProgress(100);
  const publish=await fetch("/api/recordings/"+pending.id+"/publish",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({expiresInDays:days,password:password||undefined,ownerKey:resolvedOwnerKey})});
  const result=await readJson<Omit<PublishResult,"ownerKey">>(publish);
  if(!publish.ok)throw new Error(result.error||"Couldn't publish this link. Your local video and resumable upload remain safe.");
  savePending(storageKey,null);
  return {...result,ownerKey:resolvedOwnerKey};
}
export async function shareRequest<T>(token: string, path = "", init: RequestInit = {}): Promise<T> {
  const response = await fetch("/api/share/" + token + path, { ...init, credentials: "same-origin", headers: { ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers } });
  const result = await readJson<T>(response);
  if (!response.ok) throw Object.assign(new Error(result.error || "This ScreenNote is no longer available."), { status: response.status });
  return result;
}
