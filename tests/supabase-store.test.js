import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseStore} from '../lib/supabase-store.js';
import {createGateway} from '../supabase/functions/screennote-store/gateway.js';
const secret='a'.repeat(64),url='https://example.supabase.co',id='12345678-1234-4234-8234-123456789abc';
test('Supabase configuration fails closed and never falls back to another store',async()=>{
 for(const opts of [{url,secret:''},{url:'https://evil.test',secret},{url,secret:'bad'}]){
  const store=createSupabaseStore({...opts,fetcher:()=>assert.fail('No network call for invalid configuration')});
  assert.equal(store.configured(),false);await assert.rejects(store.read('screennote/capacity.json'),/not configured/);
 }
});
test('Supabase metadata revisions retry CAS conflicts without losing another reply',async()=>{
 let calls=0,data={comments:['first']},revision=1;
 const store=createSupabaseStore({url,secret,fetcher:async(u,opts)=>{
  assert.equal(u,url+'/functions/v1/screennote-store');assert.equal(opts.headers['x-screennote-key'],secret);
  const b=JSON.parse(opts.body);
  if(b.op==='read')return Response.json({data:{data,etag:String(revision)}});
  if(calls++===0){data={comments:['first','other writer']};revision++;return Response.json({error:'Conflict'},{status:409})}
  assert.equal(b.revision,'2');data=b.data;return Response.json({data:null});
 }});
 await store.mutate('screennote/'+id+'/record.json',d=>d.comments.push('mine'));
 assert.deepEqual(data.comments,['first','other writer','mine']);
});
test('Supabase upload-state and binary transport preserve part indexes and bytes',async()=>{
 const seen=[];const store=createSupabaseStore({url,secret,fetcher:async(u,o)=>{const b=JSON.parse(o.body);seen.push(b);return Response.json({data:b.op==='partsStatus'?[0,2]:null})}});
 assert.deepEqual(await store.uploadedParts({id,size:5000000}),[0,2]);
 await store.uploadPart(id,1,Uint8Array.from([0,1,255]));
 assert.deepEqual(Buffer.from(seen[1].bytes,'base64'),Buffer.from([0,1,255]));
 assert.equal(seen[1].part,1);
});
function gatewayFixture({accepted=true,rpc,files={}}={}){
 let keyQueries=0;const client={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>{keyQueries++;return {data:accepted?{hash:'test'}:null,error:null}}})})}),rpc:rpc|| (async()=>({data:null,error:null})),storage:{from:()=>files,getBucket:async()=>({data:{public:false},error:null})}};
 const gateway=createGateway(client);
 return {keyQueries:()=>keyQueries,call:(body,token=secret,method='POST')=>gateway(new Request('https://example.test',{method,headers:{...(token?{'x-screennote-key':token}:{}),'content-type':'application/json'},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})}))};
}
test('storage gateway rejects missing, invalid and unregistered credentials before any operation',async()=>{
 const a=gatewayFixture();for(const token of ['', 'wrong'])assert.equal((await a.call({op:'read'},token)).status,401);
 assert.equal(a.keyQueries(),0);
 assert.equal((await gatewayFixture({accepted:false}).call({op:'read'})).status,401);
 assert.equal((await a.call({},secret,'GET')).status,405);
});
test('storage gateway validates JSON, record paths and metadata CAS conflicts',async()=>{
 const a=gatewayFixture({rpc:async()=>({data:false,error:null})});
 for(const body of ['{bad','null','[]',{op:'read',path:'other-tenant/private'}])assert.equal((await a.call(body)).status,400);
 assert.equal((await a.call({op:'write',path:'screennote/'+id+'/record.json',data:{title:'x'},revision:'1'})).status,409);
});
test('storage gateway lists only complete resumable parts and rejects oversized assembly',async()=>{
 const a=gatewayFixture({files:{list:async()=>({data:[{name:'0',metadata:{size:2097152}},{name:'1',metadata:{size:10}},{name:'2',metadata:{size:12}},{name:'not-a-part'}],error:null})}});
 const r=await a.call({op:'partsStatus',id,size:2097162});assert.equal(r.status,200);assert.deepEqual((await r.json()).data,[0,1]);
 assert.equal((await a.call({op:'assemble',id,size:26214401,type:'video/webm'})).status,400);
});
test('storage gateway refuses a public bucket during health and does not leak database errors',async()=>{
 const a=gatewayFixture({rpc:async()=>({data:null,error:{message:'sensitive internal connection'}})});
 const r=await a.call({op:'read',path:'screennote/capacity.json'});assert.equal(r.status,503);assert.doesNotMatch(JSON.stringify(await r.json()),/sensitive/);
 const files={};const client={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{},error:null})})})}),storage:{from:()=>files,getBucket:async()=>({data:{public:true},error:null})}};
 const r2=await createGateway(client)(new Request('https://example.test',{method:'POST',headers:{'x-screennote-key':secret},body:JSON.stringify({op:'read',path:'screennote/capacity.json'})}));assert.equal(r2.status,503);
});
