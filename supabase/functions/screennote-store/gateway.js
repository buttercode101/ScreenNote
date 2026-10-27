const BUCKET='screennote-media',MAX_BYTES=25*1024*1024,CHUNK_BYTES=2*1024*1024;
const idPattern=/^[a-f0-9-]{36}$/;
const recordPattern=/^screennote\/(capacity\.json|[a-f0-9-]{36}\/record\.json)$/;
const fail=(message,status=400)=>Object.assign(Error(message),{status});
function result(r){if(r.error)throw r.error;return r.data}
const video=id=>`screennote/${id}/video`;
const part=(id,n)=>`screennote/${id}/parts/${n}`;
export function createGateway(client){
 const files=client.storage.from(BUCKET);
 return async function gateway(req){
  try{
   if(req.method!=='POST')throw fail('Method not allowed.',405);
   const token=req.headers.get('x-screennote-key')||'';
   if(!/^[a-f0-9]{64}$/.test(token))throw fail('Unauthorized.',401);
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
   const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
   const accepted=result(await client.from('screennote_gateway_keys').select('hash').eq('hash',hash).maybeSingle());
   if(!accepted)throw fail('Unauthorized.',401);
   if(Number(req.headers.get('content-length')||0)>4200000)throw fail('Request is too large.',413);
   const raw=await req.text();if(raw.length>4200000)throw fail('Request is too large.',413);
   let b;try{b=JSON.parse(raw)}catch{throw fail('Invalid JSON request.')}
   if(!b||typeof b!=='object'||Array.isArray(b))throw fail('Invalid request.');
   let out=null;
   if(['read','write'].includes(b.op)){
    if(typeof b.path!=='string'||!recordPattern.test(b.path))throw fail('Invalid recording path.');
    if(b.op==='read'){
     if(b.path==='screennote/capacity.json'){const bucket=result(await client.storage.getBucket(BUCKET));if(bucket.public)throw fail('Private sharing storage is misconfigured.',503)}
     out=result(await client.rpc('screennote_read',{p_path:b.path}));
    }else{
     if(!b.data||typeof b.data!=='object'||Array.isArray(b.data))throw fail('Invalid recording data.');
     const changed=result(await client.rpc('screennote_write',{p_path:b.path,p_data:b.data,p_revision:b.revision??null}));
     if(!changed)throw fail('Recording metadata changed. Please try again.',409);
    }
   }else{
    if(typeof b.id!=='string'||!idPattern.test(b.id))throw fail('Invalid recording identity.');
    if(b.op==='info')out=result(await files.info(video(b.id)));
    else if(b.op==='sign')out=result(await files.createSignedUrl(video(b.id),300)).signedUrl;
    else if(b.op==='magic'){
     // The app caps videos at 25 MiB. Only return the container header to Vercel.
     const blob=result(await files.download(video(b.id)));out=Array.from(new Uint8Array(await blob.slice(0,64).arrayBuffer()));
    }else if(b.op==='uploadPart'||b.op==='uploadSmall'){
     if(typeof b.bytes!=='string'||b.bytes.length>4194304)throw fail('Invalid upload part.');
     const bytes=Uint8Array.from(atob(b.bytes),c=>c.charCodeAt(0));
     if(!bytes.length||bytes.length>(b.op==='uploadPart'?CHUNK_BYTES:3*1024*1024))throw fail('Invalid upload size.');
     if(b.op==='uploadPart'&&(!Number.isInteger(b.part)||b.part<0||b.part>=Math.ceil(MAX_BYTES/CHUNK_BYTES)))throw fail('Invalid part number.');
     if(b.op==='uploadSmall'&&!['video/mp4','video/webm'].includes(b.type))throw fail('Invalid video type.');
     const path=b.op==='uploadPart'?part(b.id,b.part):video(b.id);
     result(await files.upload(path,bytes,{contentType:b.op==='uploadPart'?'application/octet-stream':b.type,upsert:false,cacheControl:'0'}));
    }else if(b.op==='assemble'){
     if(!Number.isInteger(b.size)||b.size<1||b.size>MAX_BYTES||!['video/mp4','video/webm'].includes(b.type))throw fail('Invalid video.');
     const chunks=[];let size=0;
     for(let n=0;n<Math.ceil(b.size/CHUNK_BYTES);n++){
      const blob=result(await files.download(part(b.id,n)));
      if(blob.size!==Math.min(CHUNK_BYTES,b.size-n*CHUNK_BYTES))throw fail('An upload part is incomplete.');
      chunks.push(blob);size+=blob.size;
     }
     if(size!==b.size)throw fail('Upload size mismatch.');
     const uploaded=await files.upload(video(b.id),new Blob(chunks,{type:b.type}),{contentType:b.type,upsert:false,cacheControl:'0'});
     if(uploaded.error&&!/already exists|duplicate/i.test(uploaded.error.message))throw uploaded.error;
    }else if(b.op==='partsStatus'){
     if(!Number.isInteger(b.size)||b.size<1||b.size>MAX_BYTES)throw fail('Invalid video size.');
     const items=result(await files.list(`screennote/${b.id}/parts`,{limit:20}));
     out=items.filter(x=>/^(0|[1-9][0-9]*)$/.test(x.name)&&Number(x.name)<Math.ceil(b.size/CHUNK_BYTES)&&Number(x.metadata?.size)===Math.min(CHUNK_BYTES,b.size-Number(x.name)*CHUNK_BYTES)).map(x=>Number(x.name));
    }else if(b.op==='remove')result(await files.remove([video(b.id)]));
    else if(b.op==='clearParts'){
     if(!Number.isInteger(b.size)||b.size<1||b.size>MAX_BYTES)throw fail('Invalid video size.');
     result(await files.remove(Array.from({length:Math.ceil(b.size/CHUNK_BYTES)},(_,n)=>part(b.id,n))));
    }else throw fail('Unknown storage operation.');
   }
   return Response.json({data:out},{headers:{'Cache-Control':'no-store'}});
  }catch(e){
   const duplicate=/already exists|duplicate/i.test(e.message||'');
   const status=e.status||(duplicate?409:503);
   if(status>=500)console.error('ScreenNote gateway failure',JSON.stringify({name:e.name,code:e.code||e.statusCode||null}));
   return Response.json({error:duplicate?'Upload already exists.':status>=500?'Sharing storage is temporarily unavailable.':e.message},{status,headers:{'Cache-Control':'no-store'}});
  }
 };
}
