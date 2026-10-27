import test from 'node:test';
import assert from 'node:assert/strict';
import {profileFor,recordingStats,sharingProblem,stopMessage} from '../lib/recording-policy.js';
import {MAX_BYTES,MAX_SECONDS,LOCAL_MAX_BYTES,LOCAL_MAX_SECONDS} from '../lib/rules.js';
import {filterRecordings} from '../lib/library.js';
import {retryTransfer} from '../lib/transfer.js';
test('local and sharing policies are separate, bounded and explicit',()=>{
 assert.ok(LOCAL_MAX_BYTES>MAX_BYTES);assert.ok(LOCAL_MAX_SECONDS>MAX_SECONDS);
 assert.equal(sharingProblem({blob:{size:MAX_BYTES},duration:MAX_SECONDS}),'');
 assert.match(sharingProblem({blob:{size:MAX_BYTES+1},duration:30}),/smaller copy/);
 assert.match(sharingProblem({size:1000,duration:MAX_SECONDS+1}),/Trim/);
 assert.match(stopMessage('size'),/250 MB/);assert.match(stopMessage('duration'),/30-minute/);
});
test('remaining time uses observed byte growth and never goes negative',()=>{
 const s=recordingStats(30_000_000,60,'balanced');assert.equal(s.rate,500000);assert.equal(s.remaining,440);assert.equal(s.shareRemaining,40);assert.equal(s.shareable,true);
 const full=recordingStats(LOCAL_MAX_BYTES+1,LOCAL_MAX_SECONDS+1);assert.equal(full.remaining,0);assert.equal(full.shareRemaining,0);assert.equal(full.shareable,false);
 assert.ok(recordingStats(0,0).remaining>0);assert.equal(profileFor('unknown'),profileFor('balanced'));assert.ok(profileFor('saver').video<profileFor('clear').video);
});
test('library filtering and ordering preserve input and treat older clips as needing feedback',()=>{
 const a={id:'a',title:'Checkout',createdAt:2,blob:{}},b={id:'b',title:'Alpha',createdAt:1,shared:true,expiresAt:Date.now()+60000,reviewStatus:'approved'};
 const clips=[a,b];assert.deepEqual(filterRecordings(clips,{status:'needs-feedback'}).map(c=>c.id),['a']);assert.deepEqual(filterRecordings(clips,{query:'CHECK'}).map(c=>c.id),['a']);assert.deepEqual(filterRecordings(clips,{status:'shared'}).map(c=>c.id),['b']);assert.deepEqual(filterRecordings(clips,{sort:'title'}).map(c=>c.id),['b','a']);assert.deepEqual(clips,[a,b]);
});
test('a deliberately paused upload is never retried',async()=>{
 let calls=0;await assert.rejects(retryTransfer(async()=>{calls++;throw Object.assign(Error('Paused'),{name:'AbortError'})}),{name:'AbortError'});assert.equal(calls,1);
});
