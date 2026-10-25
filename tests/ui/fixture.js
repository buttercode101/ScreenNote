// Internal QA only. This file is never copied by the production build.
const mode=new URLSearchParams(location.search).get('case')||'empty';
document.documentElement.dataset.qaCase=mode;
const lag=Number(new URLSearchParams(location.search).get('lag'))||200;
const run=new URLSearchParams(location.search).get('run')||'default';
let healthCalls=0,reserveCalls=0,publishCalls=0;
const realFetch=window.fetch.bind(window),realOpen=indexedDB.open.bind(indexedDB);
const id='11111111-1111-4111-8111-111111111111',owner='a'.repeat(64);
if(mode==='clipboard-failed')Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Clipboard unavailable (QA simulation).')}}});
const longTitle='ScreenNote_'+ 'W'.repeat(89);
const record={passwordProtected:mode==='protected',captions:[{start:0,end:2,text:'A clear introduction'},{start:3,end:6,text:'Show the bug <literal>'}],chapters:[{time:0,title:'Context'},{time:3,title:'The problem'}],report:{url:'https://example.com/bug',steps:'Open the page, then Save',expected:'A saved message',actual:'An error appears',environment:'QA browser'},id,owner,title:longTitle,type:'video/webm',size:348711,duration:7.008,start:0,end:7.008,createdAt:Date.now(),expiresAt:Date.now()+86400000,status:'published',comments:[{id:'22222222-2222-4222-8222-222222222222',name:'W'.repeat(40),text:'W'.repeat(500),time:2,createdAt:Date.now()}],reactions:{like:1,thanks:0,idea:0}};
indexedDB.open=(name,version)=>realOpen('screennote-qa-'+mode+'-'+run+'-'+name,version);
if(mode==='storage-unavailable')indexedDB.open=()=>{throw Error('Device storage is unavailable (QA simulation).')};
if(!['empty','viewer','unavailable','storage-unavailable','recording','permission','quota','permission-pending','portrait-capture'].includes(mode)){
 const blob=await(await realFetch('/sample.webm')).blob();
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('screennote',1);r.onupgradeneeded=()=>{r.result.createObjectStore('clips',{keyPath:'id'});r.result.createObjectStore('drafts',{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=reject});
 await new Promise((resolve,reject)=>{const t=db.transaction('clips','readwrite'),store=t.objectStore('clips');const r=store.get(id);r.onsuccess=()=>{if(!r.result&&mode!=='interrupted')store.put({...record,revoked:mode==='protected',blob:mode==='recovered'?undefined:blob,managementOnly:mode==='recovered',shared:['shared','recovered','clipboard-failed'].includes(mode),uploadAttempted:['shared','recovered','clipboard-failed','protected'].includes(mode)})};t.oncomplete=resolve;t.onerror=reject});if(mode==='interrupted')await new Promise((resolve,reject)=>{const t=db.transaction('drafts','readwrite');t.objectStore('drafts').put({id,createdAt:Date.now(),seconds:7.008,chunks:[blob]});t.oncomplete=resolve;t.onerror=reject});db.close();
}
function generatedStream(camera=false,audio=false){
 const canvas=document.createElement('canvas');canvas.width=camera?320:mode==='portrait-capture'?540:960;canvas.height=camera?240:mode==='portrait-capture'?960:540;const ctx=canvas.getContext('2d');
 let frame=0;const timer=setInterval(()=>{ctx.fillStyle=camera?'#c44726':'#242d28';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#fff';ctx.font='24px sans-serif';ctx.fillText('Synthetic QA capture '+frame++,20,70)},40);
 const stream=canvas.captureStream(24);for(const t of stream.getTracks())t.addEventListener('ended',()=>clearInterval(timer));
 if(audio){const ac=new AudioContext(),osc=ac.createOscillator(),dest=ac.createMediaStreamDestination();osc.frequency.value=440;osc.connect(dest);osc.start();stream.addTrack(dest.stream.getAudioTracks()[0]);}
 return stream;
}
if(['recording','permission','quota','permission-pending','portrait-capture'].includes(mode)){
 Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{enumerateDevices:async()=>[{kind:'audioinput',deviceId:'qa-microphone',label:'QA microphone'}],getDisplayMedia:async opts=>{if(mode==='permission-pending')return new Promise(()=>{});if(mode==='permission')throw Object.assign(Error('Permission declined (QA simulation).'),{name:'NotAllowedError'});return generatedStream(false,opts.audio)},getUserMedia:async opts=>{const stream=generatedStream(true,opts.audio);if(!opts.video)for(const t of stream.getVideoTracks()){stream.removeTrack(t);t.stop()}return stream}}});
 if(mode==='quota'){
  const transaction=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(names,kind){if(kind==='readwrite')throw Object.assign(Error('Storage quota exceeded (QA simulation).'),{name:'QuotaExceededError'});return transaction.call(this,names,kind)};
 }
}
window.fetch=async(url,options={})=>{
 const u=new URL(url,location.href);if(u.pathname!=='/api/clip')return realFetch(url,options);
 const op=u.searchParams.get('op'),body=options.body?JSON.parse(options.body):{};
 const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
 if(op==='health'){if(mode==='storage-suspended')return json({error:'Online sharing is unavailable. Keep or download your local copy. The site owner needs to restore sharing access.',code:'STORAGE_ACCESS_UNAVAILABLE'},503);healthCalls++;if(mode==='health-retry'&&healthCalls<=4)return json({error:'Temporary health failure (QA)'},503);return json({configured:mode!=='offline'})}
 await new Promise(resolve=>setTimeout(resolve,lag));
 if(op==='view'){if(mode==='unavailable')return json({error:'This link has expired or is no longer shared.'},404);return json({...record,mediaUrl:'/sample.webm'})}
 if(op==='details'){Object.assign(record,{captions:body.captions,chapters:body.chapters,report:body.report});return json(body)}
 if(op==='upload-state')return json({parts:[]});
 if(op==='manage')return body.owner===owner?json(record):json({error:'This browser does not have permission to manage the link.'},403);
 if(op==='reserve'){if(mode==='transfer-retry'&&++reserveCalls<3)return json({error:'Temporary setup failure (QA)'},503);record.passwordProtected=!!body.password;return json({id:body.id,status:'pending'},201)};
 if(op==='upload-chunk')return mode==='upload-failed'?json({error:'Upload failed (QA simulation). Your local copy is safe.'},503):json({uploaded:true});
 if(op==='publish'){if(mode==='transfer-retry'&&++publishCalls<3)return json({error:'Temporary finalization failure (QA)'},503);Object.assign(record,{...body,status:'published'});return json(record)}
 if(op==='revoke'){record.status='revoked';return json({revoked:true})}
 if(op==='delete'){record.status='deleted';record.cleanupComplete=true;return json({deleted:true})}
 if(op==='reaction'){for(const k in record.reactions)record.reactions[k]=k===body.reaction?1:0;return json(record)}
 if(op==='comment'){if(!record.comments.some(c=>c.id===body.eventId))record.comments.push({id:body.eventId,name:body.name||'Guest',text:body.text,time:body.time});return json(record)}
 return json({error:'Unknown fixture action'},400);
};
if(['viewer','unavailable'].includes(mode))history.replaceState({},'',`/v/${id}?fixture=${mode}`);
await import('/app.js');
