import {createMetadataStore} from './metadata-store.js';
export function createSupabaseStore({url,secret,fetcher=fetch}){
 const ready=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||'')&&/^[a-f0-9]{64}$/.test(secret||'');
 async function request(op,body={}){
  if(!ready())throw Error('Supabase sharing is not configured.');
  const r=await fetcher(url+'/functions/v1/screennote-store',{method:'POST',headers:{'Content-Type':'application/json','x-screennote-key':secret},body:JSON.stringify({op,...body}),signal:AbortSignal.timeout(55000)});
  const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||'Sharing storage is unavailable.'),{status:r.status>=500?undefined:r.status,statusCode:r.status,conflict:r.status===409});return data.data;
 }
 const metadata=createMetadataStore({
  get:async path=>{const record=await request('read',{path});return record?{stream:JSON.stringify(record.data),blob:{etag:record.etag}}:null},
  put:async(path,raw,options)=>request('write',{path,data:JSON.parse(raw),revision:options.ifMatch??null}),
  isConflict:e=>e.conflict
 });
 return{
  configured:ready,...metadata,
  mediaInfo:id=>request('info',{id}),
  mediaMagic:async id=>Uint8Array.from(await request('magic',{id})),
  mediaURL:id=>request('sign',{id}),removeMedia:id=>request('remove',{id}),
  uploadedParts:c=>request('partsStatus',{id:c.id,size:c.size}),
  uploadSmall:(id,bytes,type)=>request('uploadSmall',{id,bytes:Buffer.from(bytes).toString('base64'),type}),
  uploadPart:(id,part,bytes)=>request('uploadPart',{id,part,bytes:Buffer.from(bytes).toString('base64')}),
  assemble:c=>request('assemble',{id:c.id,size:c.size,type:c.type}),
  clearParts:c=>request('clearParts',{id:c.id,size:c.size})
 };
}
