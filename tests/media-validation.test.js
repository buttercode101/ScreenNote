import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectMedia,validatePublishedMedia} from '../lib/media-validation.js';

test('real WebM, square MP4 and portrait MP4 retain tracks and measured dimensions', async () => {
  for (const [path,type,duration,width,height] of [['public/sample.webm','video/webm',7.008,960,540],['tests/media/square.mp4','video/mp4',2,360,360],['tests/media/portrait.mp4','video/mp4',2,270,480]]) {
    const b=await readFile(path), info=await inspectMedia(b,{type,duration,size:b.length});
    assert.equal(info.width,width);assert.equal(info.height,height);assert.ok(Math.abs(info.duration-duration)<.1);
  }
});
test('signature-only MP4, truncated MP4, missing video and dishonest duration cannot publish', async () => {
  const mp4=await readFile('tests/media/square.mp4');
  for (const b of [Buffer.from([0,0,0,8,102,116,121,112]),mp4.subarray(0,1000),await readFile('tests/media/audio-only.mp4')])
    await assert.rejects(inspectMedia(b,{type:'video/mp4',duration:2,size:b.length}),{status:400});
  await assert.rejects(inspectMedia(mp4,{type:'video/mp4',duration:20,size:mp4.length}),{status:400});
});
test('trusted fetch is bounded, verifies downloaded bytes, and fails closed on unavailable media', async () => {
  const b=await readFile('tests/media/square.mp4'),expected={type:'video/mp4',duration:2,size:b.length};
  assert.equal((await validatePublishedMedia('https://storage.test/video',expected,async()=>new Response(b))).width,360);
  await assert.rejects(validatePublishedMedia('https://storage.test/video',{...expected,size:8},async()=>new Response(b)),{status:400});
  await assert.rejects(validatePublishedMedia('https://storage.test/video',expected,async()=>new Response(null,{status:503})),{status:503});
  await assert.rejects(validatePublishedMedia('https://storage.test/video',expected,async()=>new Response(new ReadableStream({start(c){c.error(Error('Connection interrupted'))}}))),{status:503});
});
