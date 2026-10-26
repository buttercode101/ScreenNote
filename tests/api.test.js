import test from'node:test';import assert from'node:assert/strict';import{createHandler}from'../api/clip.js';import{randomId}from'../lib/rules.js';
const MAX_SHARED=16;
function setup(overrides={},inspect=async()=>({width:960,height:540,duration:7}),limits={maxBytes:1_000_000_000,maxClips:MAX_SHARED}){const map=new Map(),store={configured:()=>true,key:id=>'clip/'+id,media:id=>'media/'+id,read:async k=>map.has(k)?{data:structuredClone(map.get(k)),etag:'1'}:null,write:async(k,d)=>{if(map.has(k))throw Error('already exists');map.set(k,structuredClone(d))},mutate:async(k,fn,initial)=>{const d=structuredClone(map.get(k)||initial?.());if(!d)throw Object.assign(Error('Missing'),{status:404});const r=fn(d);map.set(k,d);return r??d},mediaInfo:async()=>({size:1000,contentType:'video/webm'}),mediaMagic:async()=>new Uint8Array([26,69,223,163]),mediaURL:async()=> 'https://example.test/signed-video',removeMedia:async()=>{},uploadSmall:async()=>{},uploadPart:async()=>{},assemble:async()=>{},clearParts:async()=>{}};Object.assign(store,overrides);const handler=createHandler(store,undefined,inspect,limits);async function call(op,body,method='POST',headers={host:'example.test',origin:'https://example.test'}){let status,result;const res={setHeader(){},status(n){status=n;return this},json(v){result=v;return this}};await handler({query:{op,id:body?.id},url:'/api/clip',method,headers,body},res);return{status,data:result}}
return{map,store,call}}
const input=()=>({id:randomId(),owner:'a'.repeat(64),title:'Message',type:'video/webm',size:1000,duration:7,start:0,end:7});
test('reserve, publish, view, react and comment form a complete API flow',async()=>{const{call}=setup(),c=input();assert.equal((await call('reserve',c)).status,201);assert.equal((await call('view',c,'GET')).status,404);assert.equal((await call('publish',c)).status,200);const view=await call('view',c,'GET');assert.equal(view.data.ownerHash,undefined);assert.ok(view.data.mediaUrl);const who=randomId();assert.equal((await call('reaction',{id:c.id,viewer:who,reaction:'like'})).data.reactions.like,1);assert.equal((await call('reaction',{id:c.id,viewer:who,reaction:'like'})).data.reactions.like,1);const comment={id:c.id,viewer:who,eventId:randomId(),text:'Looks good',time:3};assert.equal((await call('comment',comment)).data.comments.length,1);assert.equal((await call('comment',comment)).data.comments.length,1)});
test('a wrong owner cannot finalize, revoke or delete someone else’s clip',async()=>{const{call}=setup(),c=input();await call('reserve',c);for(const op of ['publish','revoke','delete'])assert.equal((await call(op,{...c,owner:'b'.repeat(64)})).status,403)});
test('revoked and expired clips reject viewers and feedback',async()=>{const{call,map}=setup(),c=input();await call('reserve',c);await call('publish',c);await call('revoke',c);assert.equal((await call('view',c,'GET')).status,404);assert.equal((await call('comment',{id:c.id,viewer:randomId(),eventId:randomId(),text:'x',time:1})).status,404);const d=map.get('clip/'+c.id);d.status='published';d.expiresAt=Date.now()-1;assert.equal((await call('view',c,'GET')).status,404)});
test('cross-origin writes, unexpected methods and unsupported media fail',async()=>{const{call}=setup();assert.equal((await call('reserve',input(),'POST',{host:'example.test',origin:'https://evil.test'})).status,403);assert.equal((await call('view',input(),'DELETE')).status,405);assert.equal((await call('reserve',{...input(),type:'text/html'})).status,400)});
test('shared capacity is bounded before allocating another video',async()=>{const{call}=setup();for(let n=0;n<MAX_SHARED;n++)assert.equal((await call('reserve',input())).status,201);assert.equal((await call('reserve',input())).status,429)});
test('comment/reaction payloads and duplicate events are validated',async()=>{const{call}=setup(),c=input();await call('reserve',c);await call('publish',c);assert.equal((await call('reaction',{id:c.id,viewer:randomId(),reaction:'unexpected'})).status,400);assert.equal((await call('comment',{id:c.id,viewer:randomId(),eventId:randomId(),text:'x',time:20})).status,400)});

test('same-origin small upload checks owner, size and container before storage',async()=>{const{call}=setup(),c={...input(),size:4};await call('reserve',c);const data=Buffer.from([26,69,223,163]).toString('base64');assert.equal((await call('upload-small',{id:c.id,owner:c.owner,data})).status,200);assert.equal((await call('upload-small',{id:c.id,owner:'b'.repeat(64),data})).status,403);assert.equal((await call('upload-small',{id:c.id,owner:c.owner,data:'aHRtbA=='})).status,400)});

test('chunk upload rejects invalid indexes and mismatched bytes',async()=>{const{call}=setup(),c={...input(),size:4};await call('reserve',c);const data=Buffer.from([26,69,223,163]).toString('base64');assert.equal((await call('upload-chunk',{id:c.id,owner:c.owner,part:0,data})).status,200);assert.equal((await call('upload-chunk',{id:c.id,owner:c.owner,part:1,data})).status,400);assert.equal((await call('upload-chunk',{id:c.id,owner:c.owner,part:0,data:'AAAA'})).status,400)});

test('deleting media clears upload parts, releases capacity and remains safe to retry',async()=>{
 let removed=0,cleared=0;const{call,map}=setup({removeMedia:async()=>{removed++},clearParts:async()=>{cleared++}}),c=input();
 await call('reserve',c);await call('publish',c);
 assert.ok(map.get('screennote/capacity.json').ids.includes(c.id));
 assert.equal((await call('delete',c)).status,200);
 assert.deepEqual(map.get('screennote/capacity.json').ids,[]);assert.equal(removed,1);assert.equal(cleared,2);
 assert.equal((await call('view',c,'GET')).status,404);
 assert.equal((await call('delete',c)).status,200);
 assert.equal((await call('reserve',c)).status,409);
});
test('resuming a pending upload updates its title but rejects a different file',async()=>{
 const{call,map}=setup(),c=input();await call('reserve',c);
 assert.equal((await call('reserve',{...c,title:'Renamed before retry'})).status,200);
 assert.equal(map.get('clip/'+c.id).title,'Renamed before retry');
 assert.equal((await call('reserve',{...c,size:c.size+1})).status,409);
 await call('publish',c);
 assert.equal((await call('reserve',c)).data.status,'published');
});
test('expired upload reservations cannot publish until their owner renews them',async()=>{
 const{call,map}=setup(),c=input();await call('reserve',c);
 map.get('clip/'+c.id).uploadUntil=Date.now()-1;
 assert.equal((await call('publish',c)).status,409);
 assert.equal((await call('reserve',c)).status,200);
 assert.equal((await call('publish',c)).status,200);
});
test('malformed JSON, arrays and unsupported read operations fail safely',async()=>{
 const{call}=setup();
 for(const body of ['{broken',[],null,42])assert.equal((await call('reserve',body)).status,400);
 assert.equal((await call('unexpected',input(),'GET')).status,400);
 assert.equal((await call('reserve',{...input(),type:'video/mp4-malicious'})).status,400);
});

test('failed cloud cleanup retains capacity until an authorized retry succeeds',async()=>{
 let failCleanup=true;const{call,map}=setup({removeMedia:async()=>{if(failCleanup)throw Error('Blob temporary failure')}}),c=input();
 await call('reserve',c);await call('publish',c);
 assert.equal((await call('delete',c)).status,503);
 assert.ok(map.get('screennote/capacity.json').ids.includes(c.id));
 assert.equal((await call('view',c,'GET')).status,404);
 failCleanup=false;assert.equal((await call('delete',c)).status,200);
 assert.deepEqual(map.get('screennote/capacity.json').ids,[]);
});
test('revoked uploads retain owner deletion permission and cannot be republished',async()=>{
 const{call}=setup(),c=input();await call('reserve',c);await call('publish',c);await call('revoke',c);
 assert.equal((await call('publish',c)).status,400);
 assert.equal((await call('delete',c)).status,200);
});

test('recovery metadata requires the owner capability and exposes no owner hash',async()=>{
 const{call}=setup(),c=input();await call('reserve',c);await call('publish',c);
 assert.equal((await call('manage',{id:c.id,owner:'b'.repeat(64)})).status,403);
 const r=await call('manage',c);assert.equal(r.data.status,'published');assert.equal(r.data.size,c.size);assert.equal(r.data.ownerHash,undefined);
 await call('revoke',c);assert.equal((await call('manage',c)).data.status,'revoked');
});
test('full capacity reclaims expired media but preserves active and recently expired records',async()=>{
 let removed=0;const{call,map}=setup({removeMedia:async()=>{removed++}}),records=[];
 for(let n=0;n<MAX_SHARED;n++){const c=input();records.push(c);await call('reserve',c)}
 const old=map.get('clip/'+records[0].id);old.uploadUntil=Date.now()-2*86400000;map.get('screennote/capacity.json').deadlines[old.id]=0;
 const recent=map.get('clip/'+records[1].id);recent.uploadUntil=Date.now()-1000;
 assert.equal((await call('reserve',input())).status,201);assert.equal(removed,1);
 assert.equal(map.get('clip/'+old.id).status,'expired');assert.equal(map.get('clip/'+old.id).cleanupComplete,true);
 assert.equal(map.get('clip/'+recent.id).status,'pending');assert.equal(map.get('screennote/capacity.json').ids.length,MAX_SHARED);
});
test('failed expired cleanup cannot release its slot or erase another live reservation',async()=>{
 const{call,map}=setup({removeMedia:async()=>{throw Error('Blob unavailable')}});let first;
 for(let n=0;n<MAX_SHARED;n++){const c=input();first||=c;await call('reserve',c)}
 map.get('clip/'+first.id).uploadUntil=Date.now()-2*86400000;map.get('screennote/capacity.json').deadlines[first.id]=0;
 assert.equal((await call('reserve',input())).status,429);assert.equal(map.get('screennote/capacity.json').ids.length,MAX_SHARED);
});
test('failed reservation creation releases its slot and can be retried',async()=>{
 let failWrite=true;const{call,map}=setup({write:async(k,c)=>{if(failWrite)throw Error('temporary write failure');map.set(k,c)}}),c=input();
 assert.equal((await call('reserve',c)).status,503);assert.deepEqual(map.get('screennote/capacity.json').ids,[]);
 failWrite=false;assert.equal((await call('reserve',c)).status,201);
});
test('capacity retains fresh orphan slots, then recovers them after the safety delay',async()=>{
 const{call,map}=setup();const ids=Array.from({length:MAX_SHARED},()=>randomId());map.set('screennote/capacity.json',{ids});
 assert.equal((await call('reserve',input())).status,429);
 const capacity=map.get('screennote/capacity.json');for(const id of ids)capacity.orphanSince[id]=Date.now()-600001;
 assert.equal((await call('reserve',input())).status,201);assert.equal(map.get('screennote/capacity.json').ids.length,13);
});

test('password protected videos expose no metadata or media without the password',async()=>{const{call,map}=setup(),c={...input(),password:'correct test password',linkDays:1,captions:[{start:0,end:2,text:'Protected caption'}],chapters:[{time:0,title:'Context'}],report:{steps:'Click Save'}};assert.equal((await call('reserve',c)).status,201);const stored=map.get('clip/'+c.id);assert.notEqual(stored.passwordHash,c.password);assert.equal(stored.password,undefined);const pub=await call('publish',c);assert.equal(pub.data.passwordProtected,true);assert.ok(pub.data.expiresAt<Date.now()+86400000+1000);const locked=await call('view',c,'GET');assert.equal(locked.status,401);assert.equal(locked.data.title,undefined);assert.equal(locked.data.mediaUrl,undefined);assert.equal((await call('view',{id:c.id,accessPassword:'wrong'})).status,401);const view=await call('view',{id:c.id,accessPassword:c.password});assert.equal(view.status,200);assert.equal(view.data.captions[0].text,'Protected caption');assert.equal(view.data.passwordHash,undefined);assert.equal(view.data.passwordSalt,undefined);const reaction={id:c.id,viewer:randomId(),reaction:'like'};assert.equal((await call('reaction',reaction)).status,401);assert.equal((await call('reaction',{...reaction,accessPassword:c.password})).status,200);await call('revoke',c);assert.equal((await call('view',{id:c.id,accessPassword:c.password})).status,404)});
test('wrong password attempts are throttled and invalid password cannot consume a reservation',async()=>{const{call,map}=setup(),c={...input(),password:'long enough'};await call('reserve',c);await call('publish',c);for(let i=0;i<8;i++)assert.equal((await call('view',{id:c.id,accessPassword:'wrong'})).status,401);assert.equal((await call('view',{id:c.id,accessPassword:c.password})).status,429);map.get('clip/'+c.id).passwordLockedUntil=0;assert.equal((await call('view',{id:c.id,accessPassword:c.password})).status,200);const bad={...input(),password:'short'};assert.equal((await call('reserve',bad)).status,400);assert.ok(!map.get('screennote/capacity.json').ids.includes(bad.id));assert.equal((await call('reserve',{...input(),linkDays:100})).status,400)});
test('only owner can update bounded captions chapters and reports on a shared video',async()=>{const{call}=setup(),c=input();await call('reserve',c);await call('publish',c);const details={...c,captions:[{start:0,end:3,text:'<literal>'}],chapters:[{time:0,title:'Start'}],report:{actual:'Failure'}};assert.equal((await call('details',{...details,owner:'b'.repeat(64)})).status,403);assert.equal((await call('details',{...details,captions:[{start:4,end:12,text:'outside'}]})).status,400);assert.equal((await call('details',details)).status,200);const view=await call('view',c,'GET');assert.equal(view.data.captions[0].text,'<literal>');assert.equal(view.data.report.actual,'Failure');assert.equal(view.data.ownerHash,undefined)});
test('upload retries cannot misrepresent or silently change an existing sharing password',async()=>{const{call}=setup(),c={...input(),password:'original password'};await call('reserve',c);assert.equal((await call('reserve',{...c,password:'a different password'})).status,400);assert.equal((await call('reserve',c)).status,200);const unprotected=input();await call('reserve',unprotected);assert.equal((await call('reserve',{...unprotected,password:'new protection'})).status,400)});

test('temporary storage failure is retryable and never exposes provider details',async()=>{
 const {call}=setup({uploadPart:async()=>{throw Error('provider secret diagnostic')}}),c={...input(),size:4};
 await call('reserve',c);
 const result=await call('upload-chunk',{id:c.id,owner:c.owner,part:0,data:Buffer.from([26,69,223,163]).toString('base64')});
 assert.equal(result.status,503);assert.match(result.data.error,/temporarily unavailable/);assert.ok(!result.data.error.includes('secret'));
});

test('sharing health checks actual storage reads instead of credentials alone',async()=>{const {call}=setup({read:async()=>{throw Error('Provider offline')}});const r=await call('health',undefined,'GET');assert.equal(r.status,503);assert.equal(r.data.configured,undefined);assert.match(r.data.error,/temporarily unavailable/)});

test('storage access denial is distinguishable from a transient failure without exposing provider details',async()=>{const {call}=setup({read:async()=>{throw Error('Vercel Blob: Failed to fetch blob: 403 Forbidden')}});const r=await call('health',undefined,'GET');assert.equal(r.status,503);assert.equal(r.data.code,'STORAGE_ACCESS_UNAVAILABLE');assert.match(r.data.error,/owner needs to restore/);assert.ok(!r.data.error.includes('Forbidden'))});

test('owner can correct a published title without changing its link or feedback',async()=>{
 const {call}=setup(),c=input();await call('reserve',c);await call('publish',c);
 await call('comment',{id:c.id,viewer:randomId(),eventId:randomId(),text:'Keep this reply',time:1});
 assert.equal((await call('title',{...c,owner:'b'.repeat(64),title:'Wrong owner'})).status,403);
 for(const title of ['', 'x'.repeat(101)])assert.equal((await call('title',{...c,title})).status,400);
 assert.equal((await call('title',{...c,title:'Corrected title'})).status,200);
 const view=await call('view',c,'GET');assert.equal(view.data.id,c.id);assert.equal(view.data.title,'Corrected title');assert.equal(view.data.comments[0].text,'Keep this reply');
});
test('the publication boundary rejects signature-only media and leaves it pending',async()=>{
 const {inspectMedia}=await import('../lib/media-validation.js'),bytes=Buffer.from([0,0,0,8,102,116,121,112]);
 const {call,map}=setup({mediaInfo:async()=>({size:8,contentType:'video/mp4'}),mediaMagic:async()=>bytes},async(url,c)=>inspectMedia(bytes,c));
 const c={...input(),type:'video/mp4',size:8};await call('reserve',c);
 assert.equal((await call('upload-chunk',{...c,part:0,data:bytes.toString('base64')})).status,200);
 assert.equal((await call('publish',c)).status,400);assert.equal(map.get('clip/'+c.id).status,'pending');
 assert.equal((await call('view',c,'GET')).status,404);
});

test('production byte policy accepts more than sixteen small API reservations',async()=>{
 const {defaultCapacityLimits}=await import('../lib/capacity.js');const{call}=setup({},undefined,defaultCapacityLimits);
 for(let i=0;i<20;i++)assert.equal((await call('reserve',input())).status,201);
 const health=await call('health',undefined,'GET');assert.equal(health.data.reservedRecordings,20);assert.equal(health.data.reservedBytes,40000);assert.equal(health.data.maxStorageBytes,1_000_000_000);
});
test('legacy capacity is upgraded without losing existing owners or recordings',async()=>{
 const {call,map}=setup(),c=input();await call('reserve',c);await call('publish',c);
 map.set('screennote/capacity.json',{ids:[c.id]});const h=await call('health',undefined,'GET');
 assert.equal(h.data.reservedBytes,c.size);assert.equal(h.data.reservedRecordings,1);assert.equal((await call('manage',c)).status,200);
 assert.ok(map.get('screennote/capacity.json').deadlines[c.id]>Date.now());
});
test('publication retains its assembly reservation until chunk cleanup succeeds',async()=>{
 let failed=true;const {call,map}=setup({clearParts:async()=>{if(failed)throw Error('Temporary cleanup interruption')}}),c=input();
 await call('reserve',c);await call('publish',c);assert.equal(map.get('screennote/capacity.json').allocations[c.id],2*c.size);
 failed=false;await call('publish',c);assert.equal(map.get('screennote/capacity.json').allocations[c.id],c.size);
});
