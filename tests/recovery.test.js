import test from 'node:test';import assert from 'node:assert/strict';
import {recoveryDocument,recoveryKeys} from '../lib/recovery.js';
import {reclaimable,RETENTION_GRACE} from '../lib/retention.js';
import {randomId} from '../lib/rules.js';
const origin='https://example.test';
test('recovery exports capabilities without videos and validates them on import',()=>{
 const c={id:randomId(),owner:'a'.repeat(64),shared:true,title:'Secret title',blob:'Video bytes'};
 const raw=recoveryDocument([c,{...c,id:randomId(),cloudDeleted:true}],origin);
 assert.equal(raw.includes('Secret title'),false);assert.equal(raw.includes('Video bytes'),false);
 assert.deepEqual(recoveryKeys(raw,origin),[{id:c.id,owner:c.owner}]);
});
test('recovery rejects foreign origins, duplicate IDs, malformed keys and oversized files',()=>{
 const doc=JSON.parse(recoveryDocument([{id:randomId(),owner:'a'.repeat(64),shared:true}],origin));
 assert.throws(()=>recoveryKeys(JSON.stringify(doc),'https://elsewhere.test'));
 assert.throws(()=>recoveryKeys('{broken',origin));assert.throws(()=>recoveryKeys('x'.repeat(524289),origin));
 assert.throws(()=>recoveryKeys(JSON.stringify({...doc,keys:[...doc.keys,...doc.keys]}),origin));
 assert.throws(()=>recoveryKeys(JSON.stringify({...doc,keys:[{id:doc.keys[0].id,owner:'bad'}]}),origin));
});
test('retention preserves fresh uploads and live links while reclaiming old data',()=>{
 const now=Date.now();assert.equal(reclaimable({status:'pending',uploadUntil:now-1},now),false);
 assert.equal(reclaimable({status:'pending',uploadUntil:now-RETENTION_GRACE-1},now),true);
 assert.equal(reclaimable({status:'published',expiresAt:now+1},now),false);
 assert.equal(reclaimable({status:'published',expiresAt:now-RETENTION_GRACE-1},now),true);
 assert.equal(reclaimable({status:'revoked',expiresAt:now-RETENTION_GRACE-1},now),true);
});
