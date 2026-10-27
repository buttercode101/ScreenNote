import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_BYTES,STORAGE_BUDGET_BYTES} from '../lib/rules.js';
import {reserveCapacity,releaseCapacity,finalizeCapacity,capacityBytes,capacitySummary} from '../lib/capacity.js';

test('more than sixteen small recordings fit the storage budget',()=>{
 const c={ids:[]};for(let i=0;i<200;i++){reserveCapacity(c,String(i),1024*1024);finalizeCapacity(c,String(i),1024*1024,Date.now()+86400000)}
 assert.equal(c.ids.length,200);assert.equal(capacityBytes(c),200*1024*1024);
});
test('maximum-sized sequential uploads use available quota while allowing assembly overlap',()=>{
 const c={ids:[]};for(let i=0;i<37;i++){reserveCapacity(c,String(i),MAX_BYTES);finalizeCapacity(c,String(i),MAX_BYTES,Date.now()+86400000)}
 assert.equal(c.ids.length,37);assert.throws(()=>reserveCapacity(c,'overflow',MAX_BYTES),{status:429});
 assert.ok(capacityBytes(c)+MAX_BYTES<=STORAGE_BUDGET_BYTES);
});
test('simultaneous pending reservations cannot overbook temporary assembly space',()=>{
 const c={ids:[]};for(let i=0;i<19;i++)reserveCapacity(c,String(i),MAX_BYTES);
 assert.throws(()=>reserveCapacity(c,'overflow',MAX_BYTES),{status:429});
 finalizeCapacity(c,'0',MAX_BYTES,Date.now()+86400000);releaseCapacity(c,'1');reserveCapacity(c,'next',MAX_BYTES);
 assert.ok(capacityBytes(c)<=STORAGE_BUDGET_BYTES);
});
test('cleanup releases bytes, while late finalization cannot resurrect deleted reservations',()=>{
 const c={ids:[]};reserveCapacity(c,'x',1000);assert.equal(capacityBytes(c),2000);releaseCapacity(c,'x');finalizeCapacity(c,'x',1000,Date.now());
 assert.equal(capacityBytes(c),0);assert.deepEqual(c.ids,[]);assert.equal(c.deadlines.x,undefined);
 assert.equal(capacitySummary(c).availableBytes,STORAGE_BUDGET_BYTES);
});
