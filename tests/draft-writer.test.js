import test from 'node:test';import assert from 'node:assert/strict';
import {createDraftWriter} from '../lib/draft-writer.js';
test('a quota failure warns once, abandons queued writes, and permits stop to flush',async()=>{
 let attempts=0,warnings=0;const writer=createDraftWriter(async()=>{attempts++;throw Error('quota')},()=>warnings++);
 writer.save({seconds:0});writer.save({seconds:1});writer.save({seconds:2});await writer.flush();
 await writer.save({seconds:3});assert.equal(attempts,1);assert.equal(warnings,1);
});
test('draft snapshots save in order and flush waits for pending work',async()=>{
 let release;const first=new Promise(r=>release=r),saved=[];
 const writer=createDraftWriter(async snapshot=>{if(snapshot.seconds===0)await first;saved.push(snapshot.seconds)},()=>assert.fail('unexpected failure'));
 writer.save({seconds:0});writer.save({seconds:1});let done=false;const flush=writer.flush().then(()=>done=true);
 await Promise.resolve();assert.equal(done,false);release();await flush;assert.deepEqual(saved,[0,1]);
});
test('recovery saved before a later disk failure remains intact without repeated warnings',async()=>{
 const saved=[];let warnings=0;const writer=createDraftWriter(async s=>{if(s.seconds>1)throw Error('full');saved.push(s.seconds)},()=>warnings++);
 writer.save({seconds:0});writer.save({seconds:1});writer.save({seconds:2});writer.save({seconds:3});await writer.flush();
 assert.deepEqual(saved,[0,1]);assert.equal(warnings,1);
});
