import {createMetadataStore} from './metadata-store.js';
import{Readable}from'node:stream';
import{CHUNK_BYTES}from'./rules.js';
import{get,put,head,del,issueSignedToken,presignUrl,BlobPreconditionFailedError}from'@vercel/blob';
export const key=id=>`screennote/${id}/record.json`,media=id=>`screennote/${id}/video`;
export const configured=()=>!!(process.env.BLOB_READ_WRITE_TOKEN||process.env.BLOB_STORE_ID);
export const {read,write,mutate}=createMetadataStore({get,head,put,isConflict:e=>e instanceof BlobPreconditionFailedError});
export async function mediaInfo(id){return head(media(id))}
export async function mediaMagic(id){const r=await get(media(id),{access:'private'});if(!r)throw Error('Upload is missing.');const reader=r.stream.getReader();try{const{value}=await reader.read();return value||new Uint8Array()}finally{await reader.cancel()}}
export async function mediaURL(id){const pathname=media(id),validUntil=Date.now()+300000,signed=await issueSignedToken({pathname,operations:['get'],validUntil});return(await presignUrl(signed,{operation:'get',pathname,access:'private',validUntil})).presignedUrl}
export const removeMedia=id=>del(media(id));

export const uploadSmall=(id,bytes,type)=>put(media(id),bytes,{access:'private',addRandomSuffix:false,contentType:type});

export const partKey=(id,n)=>`screennote/${id}/parts/${n}`;
export const uploadPart=(id,n,bytes)=>put(partKey(id,n),bytes,{access:'private',addRandomSuffix:false,contentType:'application/octet-stream'});
export async function assemble(c){const count=Math.ceil(c.size/CHUNK_BYTES);async function*chunks(){for(let n=0;n<count;n++){const r=await get(partKey(c.id,n),{access:'private'});if(!r)throw Error('An upload part is missing. Publish again to retry.');for await(const bytes of r.stream)yield bytes}}await put(media(c.id),Readable.from(chunks()),{access:'private',contentType:c.type,addRandomSuffix:false,multipart:true})}
export const clearParts=c=>del(Array.from({length:Math.ceil(c.size/CHUNK_BYTES)},(_,n)=>partKey(c.id,n)));
