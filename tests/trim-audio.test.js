import test from 'node:test';
import assert from 'node:assert/strict';
import {trimVideo} from '../public/capture.js';
test('trim unlocks audio during the click before waiting for metadata and closes it on decode failure',async()=>{
 const before={document:globalThis.document,AudioContext:globalThis.AudioContext,MediaRecorder:globalThis.MediaRecorder};let made=0,resumed=0,closed=0;
 const video={pause(){}};
 globalThis.document={createElement:()=>video};globalThis.MediaRecorder=class{};
 globalThis.AudioContext=class{constructor(){made++}resume(){resumed++;return Promise.resolve()}close(){closed++;return Promise.resolve()}};
 try{const pending=trimVideo(new Blob(['invalid']),0,1,()=>{});assert.equal(made,1);assert.equal(resumed,1);video.onerror();await assert.rejects(pending,/cannot decode/);assert.equal(closed,1)}finally{for(const[k,v]of Object.entries(before))globalThis[k]=v}
});
