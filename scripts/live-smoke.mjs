// Explicit, bounded production smoke test. Uses synthetic media and deletes only its own uploads.
// Usage: node scripts/live-smoke.mjs https://your-app.example /absolute/synthetic.webm
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {retryTransfer} from '../lib/transfer.js';
import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
const origin=new URL(process.argv[2]).origin,bytes=await readFile(process.argv[3]);
assert.ok(bytes.length>0&&bytes.length<=50_000_000);
const duration=Number(process.argv[4]||15.008);
const records=[],results=[];
async function request(url,body){return await new Promise((resolve,reject)=>{const args=['--silent','--show-error','--max-time','65','--write-out','\n%{http_code}',url];if(body)args.push('-H','content-type: application/json','-H','origin: '+origin,'--data-binary','@-');const p=spawn('curl',args),out=[],err=[];p.stdout.on('data',b=>out.push(b));p.stderr.on('data',b=>err.push(b));p.on('error',reject);p.on('close',code=>{if(code)return reject(Error(Buffer.concat(err).toString()));const raw=Buffer.concat(out),split=raw.lastIndexOf(10);resolve({status:Number(raw.subarray(split+1).toString()),bytes:raw.subarray(0,split)})});p.stdin.end(body?JSON.stringify(body):undefined)})}
async function call(op,body){const r=await request(origin+'/api/clip?op='+op,body);return{status:r.status,data:JSON.parse(r.bytes.toString())}}
async function ok(op,body){return retryTransfer(async()=>{const r=await call(op,body);if(r.status<200||r.status>=300)throw Object.assign(Error(op+': '+r.status+' '+r.data.error),{status:r.status});return r.data})}
try{
 for(const protectedVideo of [false,true]){
 const c={id:randomUUID(),owner:randomBytes(32).toString('hex'),title:'Disposable ScreenNote production QA',type:'video/webm',size:bytes.length,duration,start:0,end:duration,linkDays:1,password:protectedVideo?'synthetic QA '+randomBytes(12).toString('hex'):'',captions:[{start:0,end:3,text:'QA literal <caption>'}],chapters:[{time:0,title:'Start'},{time:5,title:'Next'}],report:{actual:'Synthetic QA only'}};
 records.push(c);await ok('reserve',c);assert.equal((await call('manage',{id:c.id,owner:randomBytes(32).toString('hex')})).status,403);
 let parts=0;for(let offset=0;offset<bytes.length;offset+=2*1024*1024){await ok('upload-chunk',{id:c.id,owner:c.owner,part:parts++,data:bytes.subarray(offset,offset+2*1024*1024).toString('base64')})}
 await ok('publish',c);
 if(protectedVideo){const locked=await call('view',{id:c.id});assert.equal(locked.status,401);assert.equal(locked.data.mediaUrl,undefined);assert.equal((await call('view',{id:c.id,accessPassword:'wrong synthetic'})).status,401)}
 const auth={id:c.id,accessPassword:c.password};let view=await ok('view',auth);assert.equal(view.ownerHash,undefined);assert.equal(view.captions[0].text,'QA literal <caption>');assert.equal(view.chapters.length,2);
 const playback=await request(view.mediaUrl);assert.equal(playback.status,200);const played=playback.bytes;assert.equal(createHash('sha256').update(played).digest('hex'),createHash('sha256').update(bytes).digest('hex'));
 const viewer=randomUUID(),eventId=randomUUID();for(let i=0;i<2;i++)view=await ok('comment',{...auth,viewer,eventId,time:2,name:'QA',text:'Literal <script> QA reply'});assert.equal(view.comments.length,1);
 view=await ok('reaction',{...auth,viewer,reaction:'like'});assert.equal(view.reactions.like,1);view=await ok('reaction',{...auth,viewer,reaction:''});assert.equal(view.reactions.like,0);
 await ok('details',{id:c.id,owner:c.owner,captions:[{start:0,end:2,text:'Updated'}],chapters:[],report:null});view=await ok('view',auth);assert.equal(view.captions[0].text,'Updated');
 await ok('revoke',c);assert.equal((await call('view',auth)).status,404);assert.equal((await ok('manage',c)).status,'revoked');
 results.push({protectedVideo,parts,bytes:bytes.length,playbackSHA256:createHash('sha256').update(played).digest('hex'),result:'passed'});console.log(JSON.stringify(results.at(-1)));
 }
}finally{
 for(const c of records){const r=await call('delete',{id:c.id,owner:c.owner});if(r.status===404)continue;assert.equal(r.status,200,'Cleanup failed: '+c.id);const state=await ok('manage',c);assert.equal(state.cleanupComplete,true);assert.equal((await call('view',{id:c.id,accessPassword:c.password})).status,404)}
 console.log(JSON.stringify({cleanup:'complete',records:records.length}));
}
