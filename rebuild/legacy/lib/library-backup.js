import { Zip, ZipPassThrough, unzipSync, strToU8, strFromU8 } from "fflate";
// @ts-ignore - shared browser-safe id and media validation helpers
import { validId, isVideo } from "./rules.js";
const MAX_ARCHIVE=260*1024*1024,MAX_VIDEO_TOTAL=250*1024*1024,MAX_CLIPS=500,MAX_CLIP_BYTES=50_000_000;
const bytesView=(b)=>new DataView(b.buffer,b.byteOffset,b.byteLength);
function inspectStoredZip(bytes){
 if(bytes.length>MAX_ARCHIVE||bytes.length<22)throw Error("Choose a ScreenNote backup smaller than 260 MB.");
 const view=bytesView(bytes);let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(view.getUint32(i,true)===0x06054b50){end=i;break}}
 if(end<0)throw Error("This is not a complete ScreenNote ZIP backup.");
 const count=view.getUint16(end+10,true),centralSize=view.getUint32(end+12,true),centralOffset=view.getUint32(end+16,true);
 if(!count||count>MAX_CLIPS+1||centralOffset+centralSize>end)throw Error("The backup directory is invalid.");
 let cursor=centralOffset,total=0;const names=new Set();
 for(let n=0;n<count;n++){
  if(cursor+46>bytes.length||view.getUint32(cursor,true)!==0x02014b50)throw Error("The backup directory is damaged.");
  const flags=view.getUint16(cursor+8,true),method=view.getUint16(cursor+10,true),compressed=view.getUint32(cursor+20,true),size=view.getUint32(cursor+24,true),nameLen=view.getUint16(cursor+28,true),extraLen=view.getUint16(cursor+30,true),commentLen=view.getUint16(cursor+32,true);
  if(flags&1||method!==0||compressed!==size||size===0xffffffff||compressed===0xffffffff)throw Error("Only uncompressed, private ScreenNote backup archives are supported.");
  const name=strFromU8(bytes.subarray(cursor+46,cursor+46+nameLen));
  if(name.startsWith("/")||name.includes("..")||name.includes("\\")||!(name==="manifest.json"||/^videos\/[0-9a-f-]{36}\.(mp4|webm)$/.test(name))||names.has(name))throw Error("The backup contains an unexpected or duplicate file.");
  if(name==="manifest.json"&&size>20*1024*1024)throw Error("The backup manifest is too large.");
  if(name.startsWith("videos/")&&size>MAX_CLIP_BYTES)throw Error("A video in the backup exceeds 50 MB.");
  names.add(name);total+=size;if(total>MAX_VIDEO_TOTAL+20*1024*1024)throw Error("The backup expands beyond the supported size.");
  cursor+=46+nameLen+extraLen+commentLen;
 }
 if(!names.has("manifest.json"))throw Error("The backup manifest is missing.");
 return{names,total};
}
export async function makeLibraryBackup(clips,onProgress=()=>{}){
 if(!Array.isArray(clips)||!clips.length)throw Error("There are no local recordings to back up yet.");
 if(clips.length>MAX_CLIPS)throw Error("Back up no more than 500 recordings at once.");
 const total=clips.reduce((sum,c)=>sum+(c.blob?.size||0),0);if(total>MAX_VIDEO_TOTAL)throw Error("This library is larger than the 250 MB backup limit. Export large videos individually, then back up the remaining library.");
 let copied=0;
 const entries=clips.map(c=>{if(!validId(c.id))throw Error("A local recording has an invalid identity.");if(c.owner&&!/^[a-f0-9]{64}$/.test(c.owner))throw Error("A local recovery key is invalid.");const {blob,...metadata}=c;const type=blob?.type||c.type||"";const ext=blob?(type.split(";")[0]==="video/mp4"?"mp4":type.split(";")[0]==="video/webm"?"webm":null):null;if(blob&&(!ext||blob.size>MAX_CLIP_BYTES))throw Error("A local video has an unsupported type or exceeds 50 MB.");const videoPath=blob?`videos/${c.id}.${ext}`:null;return{metadata,videoPath,videoSize:blob?.size||0,videoType:type}});
 const manifest={format:"screennote-library-backup",version:1,origin:globalThis.location?.origin||"local",createdAt:new Date().toISOString(),clipCount:entries.length,totalVideoBytes:total,clips:entries};
 const output=[];let resolveDone,rejectDone;const done=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject});
 const zip=new Zip((error,chunk,final)=>{if(error){rejectDone(error);return}if(chunk?.length)output.push(chunk);if(final)resolveDone()});
 const manifestFile=new ZipPassThrough("manifest.json");zip.add(manifestFile);manifestFile.push(strToU8(JSON.stringify(manifest)),true);
 for(const entry of entries){
  const clip=clips.find(x=>x.id===entry.metadata.id);if(!clip?.blob)continue;
  const file=new ZipPassThrough(entry.videoPath);zip.add(file);
  if(clip.blob.stream){const reader=clip.blob.stream().getReader();for(;;){const {done,value}=await reader.read();if(done)break;file.push(value,false);copied+=value.length;onProgress(total?Math.floor(copied/total*100):100)}}
  else{const data=new Uint8Array(await clip.blob.arrayBuffer());file.push(data,false);copied+=data.length;onProgress(total?Math.floor(copied/total*100):100)}
  file.push(new Uint8Array(0),true);
 }
 zip.end();await done;const blob=new Blob(output,{type:"application/zip"});if(blob.size>MAX_ARCHIVE)throw Error("The backup archive exceeds 260 MB. Export large videos individually.");return blob;
}
export async function readLibraryBackup(file,existingIds=new Set()){
 if(!file||file.size>MAX_ARCHIVE)throw Error("Choose a ScreenNote backup smaller than 260 MB.");
 const bytes=new Uint8Array(await file.arrayBuffer()),envelope=inspectStoredZip(bytes),files=unzipSync(bytes);
 let manifest;try{manifest=JSON.parse(strFromU8(files["manifest.json"]))}catch{throw Error("The backup manifest could not be read.");}
 if(!manifest||manifest.format!=="screennote-library-backup"||manifest.version!==1||!Array.isArray(manifest.clips)||manifest.clips.length>MAX_CLIPS||manifest.clipCount!==manifest.clips.length)throw Error("This is not a supported ScreenNote library backup.");
 const records=[],ids=new Set();let totalVideoBytes=0,duplicates=0;
 for(const entry of manifest.clips){
  if(!entry||typeof entry!=="object"||!entry.metadata||!validId(entry.metadata.id)||ids.has(entry.metadata.id))throw Error("The backup contains an invalid or duplicate recording.");
  const metadata={...entry.metadata};ids.add(metadata.id);const videoPath=entry.videoPath,videoSize=Number(entry.videoSize)||0,videoType=entry.videoType;delete metadata.blob;
  if(metadata.owner!==undefined&&metadata.owner!==null&&!/^[a-f0-9]{64}$/.test(metadata.owner))throw Error("A recovery key in this backup is invalid.");
  if((metadata.shared||metadata.revoked||metadata.uploadAttempted)&&!metadata.owner)throw Error("A shared recording is missing its management key.");
  if(videoPath){
   const ext=String(videoType||"").split(";")[0]==="video/mp4"?"mp4":String(videoType||"").split(";")[0]==="video/webm"?"webm":null;
   if(!ext||videoPath!==`videos/${metadata.id}.${ext}`||videoSize<=0||videoSize>MAX_CLIP_BYTES)throw Error("A backup video entry is invalid.");
   const data=files[videoPath];if(!data||data.length!==videoSize||!isVideo(data,String(videoType).split(";")[0]))throw Error("A video in this backup is damaged or does not match its manifest.");
   metadata.blob=new Blob([data],{type:videoType});metadata.type=String(videoType).split(";")[0];totalVideoBytes+=data.length;
  }else if(videoSize!==0)throw Error("A backup video is missing.");
  if(!Number.isFinite(metadata.duration)||metadata.duration<=0||metadata.duration>1800||!Number.isFinite(metadata.createdAt))throw Error("A recording's metadata is invalid.");
  if(existingIds.has(metadata.id)){duplicates++;continue}records.push(metadata);
 }
 if(totalVideoBytes>MAX_VIDEO_TOTAL||Number(manifest.totalVideoBytes)!==totalVideoBytes)throw Error("The backup video total does not match its manifest.");
 for(const name of envelope.names)if(name!=="manifest.json"&&!manifest.clips.some(e=>e.videoPath===name))throw Error("The backup contains an unlisted file.");
 return{clips:records,duplicates,totalVideoBytes,sourceOrigin:typeof manifest.origin==="string"?manifest.origin.slice(0,2048):"",clipCount:manifest.clips.length};
}
