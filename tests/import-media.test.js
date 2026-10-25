import test from 'node:test';
import assert from 'node:assert/strict';
import {importMedia} from '../lib/import-media.js';
const mp4=Buffer.from([0,0,0,24,102,116,121,112,105,115,111,109]);
test('device files without MIME are normalized only after a matching supported container check',async()=>{
 for(const type of ['', 'application/octet-stream','video/mp4']){const f=new File([mp4],'Phone Recording.MP4',{type}),r=await importMedia(f);assert.equal(r.type,'video/mp4');assert.equal(r.blob.type,'video/mp4');assert.deepEqual(Buffer.from(await r.blob.arrayBuffer()),mp4)}
 const r=await importMedia(new File([new Uint8Array([26,69,223,163])],'clip.webm'));assert.equal(r.type,'video/webm');
});
test('renaming arbitrary data or using unsupported file types cannot bypass import validation',async()=>{
 for(const f of [new File(['garbage'],'clip.mp4'),new File([mp4],'clip.txt'),new File([mp4],'clip.mp4',{type:'text/html'}),new File([mp4],'clip.webm')])await assert.rejects(importMedia(f));
});
