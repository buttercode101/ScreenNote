import { randomBytes, randomUUID } from "node:crypto";
import { Input, BufferSource, WEBM } from "mediabunny";
import assert from "node:assert/strict";

const base = process.env.SCREENNOTE_LIVE_URL || "https://screennote-dev.buttercoder-dev.workers.dev";
const origin = new URL(base).origin;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function request(path, options = {}) {
  const response = await fetch(origin + path, { redirect: "manual", ...options });
  return response;
}
async function json(response) {
  const body = await response.json();
  assert.ok(response.ok, `${response.status} ${JSON.stringify(body)}`);
  return body;
}
async function retryHealth() {
  let last;
  for (let i = 0; i < 30; i++) {
    try {
      const response = await request("/api/health");
      if (response.ok) return await json(response);
      last = new Error(`health status ${response.status}`);
    } catch (error) { last = error; }
    await wait(2000);
  }
  throw last ?? new Error("Live health check did not become ready.");
}
const health = await retryHealth();
assert.equal(health.status, "ok");
const page = await jsonText(await request("/"));
assert.match(page, /<html/i);
const jsPath = page.match(/src="([^"]+\.js)"/)?.[1];
const cssPath = page.match(/href="([^"]+\.css)"/)?.[1];
assert.ok(jsPath, "production JavaScript asset referenced by HTML");
assert.ok(cssPath, "production CSS asset referenced by HTML");
assert.ok((await request(jsPath)).ok, "production JavaScript asset responds");
assert.ok((await request(cssPath)).ok, "production CSS asset responds");

const ownerKey = "a".repeat(64);
let recordingId = null;
let shareToken = null;
let sessionCookie = null;
try {
const sessionResponse = await request("/api/session");
assert.equal(sessionResponse.status, 200);
const cookie = sessionResponse.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie, "guest session cookie is set");
sessionCookie = cookie;
const headers = { cookie, origin, "content-type": "application/json" };
const recording = await json(await request("/api/recordings", {
  method: "POST", headers,
  body: JSON.stringify({ title: "Live acceptance check", mimeType: "video/webm", size: 12, duration: 12 })
}));
recordingId = recording.id;
const bytes = new Uint8Array([0x1a,0x45,0xdf,0xa3,0x93,0x42,0x86,0x81,0x01,0x42,0xf7,0x81]);
const uploaded = await request(recording.uploadUrl, {
  method: "PUT", headers: { ...headers, "content-type": "video/webm", "content-length": String(bytes.byteLength) }, body: bytes
});
if (uploaded.status !== 200) {
  await request("/api/recordings/" + recording.id, { method:"DELETE", headers, body:JSON.stringify({ ownerKey }) }).catch(() => undefined);
}
assert.equal(uploaded.status, 200, "real R2 upload succeeds");
assert.equal((await json(uploaded)).status, "ready");

const publishResponse = await request(`/api/recordings/${recording.id}/publish`, {
  method: "POST", headers,
  body: JSON.stringify({ expiresInDays: 1, password: "live-check-password", ownerKey })
});
if (publishResponse.status !== 201) {
  await request("/api/recordings/" + recording.id, { method:"DELETE", headers, body:JSON.stringify({ ownerKey }) }).catch(() => undefined);
}
const published = await json(publishResponse);
shareToken = published.token;
const token = shareToken;
assert.ok(token, "share token returned");
const sharePath = `/api/share/${token}`;
assert.equal((await request(sharePath)).status, 401, "password protects share metadata");
assert.equal((await request(sharePath + "/access", {
  method: "POST", headers: { origin, "content-type": "application/json" },
  body: JSON.stringify({ password: "wrong-password" })
})).status, 401, "wrong password rejected");
const sharedDetails = {
  annotations: [{ kind: "redact", x: .1, y: .1, w: .2, h: .2 }],
  captions: [{ start: 1, end: 2, text: "Owner-supplied live caption" }],
  chapters: [{ time: 1, title: "Live chapter" }],
  report: { url: "https://example.com/checkout", steps: "Open checkout", expected: "Payment appears", actual: "Payment is missing", environment: "GitHub Actions" }
};
const detailsSaved = await request(sharePath + "/details", {
  method: "PUT", headers: { origin, "content-type": "application/json" },
  body: JSON.stringify({ ownerKey, details: sharedDetails })
});
assert.equal(detailsSaved.status, 200, "owner can save shared captions, chapters, annotations and bug report before viewer unlock");
const accessResponse = await request(sharePath + "/access", {
  method: "POST", headers: { origin, "content-type": "application/json" },
  body: JSON.stringify({ password: "live-check-password" })
});
assert.equal(accessResponse.status, 200, "correct password unlocks share");
const accessCookie = accessResponse.headers.get("set-cookie")?.split(";")[0];
assert.ok(accessCookie, "password access cookie is set");
for (let i = 0; i < 5; i++) {
  const failed = await request(sharePath + "/access", {
    method:"POST", headers:{origin,"content-type":"application/json"},
    body:JSON.stringify({password:"wrong-password-again"})
  });
  assert.equal(failed.status, i === 4 ? 429 : 401, "password attempts are throttled after five failures");
}
const lockedCorrect = await request(sharePath + "/access", {
  method:"POST", headers:{origin,"content-type":"application/json"},
  body:JSON.stringify({password:"live-check-password"})
});
assert.equal(lockedCorrect.status, 429, "correct password is held during the temporary lockout");
const viewerHeaders = { origin, cookie: accessCookie, "content-type": "application/json" };
const share = await json(await request(sharePath, { headers: viewerHeaders }));
const contextResponse = await json(await request(sharePath + "/details", { headers: viewerHeaders }));
assert.deepEqual(contextResponse.details, sharedDetails, "authorized viewers receive the saved shared context");
assert.equal(share.title, "Live acceptance check");
assert.equal(share.passwordRequired, true);
const media = await request(sharePath + "/media", { headers: { cookie: accessCookie, range: "bytes=2-7" } });
assert.equal(media.status, 206, "R2 video supports range playback");
assert.equal(media.headers.get("content-range"), "bytes 2-7/12");
assert.equal((await media.arrayBuffer()).byteLength, 6);

const authorKey = "b".repeat(48), replyKey = "c".repeat(48);
const commentsPath = sharePath + "/comments";
const comment = await json(await request(commentsPath, {
  method: "POST", headers: viewerHeaders,
  body: JSON.stringify({ authorKey, text: "Live lifecycle comment", time: 4, anchorX: 0.3, anchorY: 0.6 })
}));
assert.equal((await request(commentsPath, { headers: { cookie: accessCookie, "x-sn-author-key": authorKey } })).status, 200);
const reply = await json(await request(commentsPath, {
  method: "POST", headers: viewerHeaders,
  body: JSON.stringify({ authorKey: replyKey, parentId: comment.id, text: "Live threaded reply", time: 4 })
}));
assert.ok(reply.id);
const resolved = await request(commentsPath + "/" + comment.id + "/resolve", {
  method: "PATCH", headers: viewerHeaders,
  body: JSON.stringify({ ownerKey, resolved: true })
});
assert.equal(resolved.status, 200, "owner can resolve a thread");
const edited = await request(commentsPath + "/" + comment.id, {
  method: "PATCH", headers: viewerHeaders,
  body: JSON.stringify({ authorKey, text: "Edited live lifecycle comment" })
});
assert.equal(edited.status, 200, "comment author can edit");
const deleted = await request(commentsPath + "/" + comment.id, {
  method: "DELETE", headers: viewerHeaders,
  body: JSON.stringify({ authorKey })
});
assert.equal(deleted.status, 200, "comment author can delete");

const stopped = await request(sharePath + "/manage", {
  method: "DELETE", headers: { origin, "content-type": "application/json" },
  body: JSON.stringify({ ownerKey })
});
assert.equal(stopped.status, 200, "owner can stop share and delete shared object");
assert.equal((await request(sharePath)).status, 404, "stopped share is no longer available");
shareToken = null;
recordingId = null;
console.log("Live ScreenNote acceptance passed: assets, guest session, real D1/R2 upload, password gate and lockout, byte-range media, comments/replies/edit/delete, resolve, and stop-share deletion.");
} catch (error) {
  if (shareToken) {
    await request(`/api/share/${shareToken}/manage`, { method:"DELETE", headers:{origin,"content-type":"application/json"}, body:JSON.stringify({ownerKey}) }).catch(() => undefined);
  } else if (recordingId) {
    await request(`/api/recordings/${recordingId}`, { method:"DELETE", headers:{cookie:sessionCookie,origin,"content-type":"application/json"}, body:JSON.stringify({ownerKey}) }).catch(() => undefined);
  }
  throw error;
}

// Full 0.5.0 API parity smoke against the deployed Cloudflare D1/R2 implementation.
const nativeHealth = await json(await request("/api/clip?op=health"));
assert.equal(nativeHealth.configured,true);
assert.equal(nativeHealth.maxBytes,50_000_000);
assert.equal(nativeHealth.maxSeconds,600);
const sampleResponse = await request("/sample.webm");
assert.equal(sampleResponse.status,200,"original sample video is served by Cloudflare assets");
const sampleBytes = new Uint8Array(await sampleResponse.arrayBuffer());
assert.ok(sampleBytes.length>4 && sampleBytes.length<=50_000_000);
const sampleInput=new Input({source:new BufferSource(sampleBytes),formats:[WEBM]});
const sampleVideo=await sampleInput.getPrimaryVideoTrack(),sampleDuration=await sampleInput.getDurationFromMetadata();
assert.ok(sampleVideo&&sampleDuration&&sampleDuration>1&&sampleDuration<=600);
const sampleWidth=sampleVideo.displayWidth,sampleHeight=sampleVideo.displayHeight;sampleInput.dispose();
const nativeId = randomUUID();
const nativeOwner = randomBytes(32).toString("hex");
const nativePassword = "cloudflare-native-live-check";
let nativeReserved = false;
const nativeHeaders = {origin,"content-type":"application/json"};
const nativeApi = (op,body={},id=nativeId)=>request("/api/clip?op="+op+(id?"&id="+encodeURIComponent(id):""),{method:"POST",headers:nativeHeaders,body:JSON.stringify(body)});
try {
  const reservation = await json(await nativeApi("reserve",{
    id:nativeId,owner:nativeOwner,title:"Native Cloudflare parity smoke",type:"video/webm",duration:sampleDuration,size:sampleBytes.length,
    start:0,end:sampleDuration,linkDays:1,password:nativePassword,reviewStatus:"needs-feedback",width:sampleWidth,height:sampleHeight,
    captions:[{start:0,end:Math.min(1,sampleDuration),text:"A live caption"}],chapters:[{time:Math.min(1,sampleDuration/2),title:"Live chapter"}],
    report:{url:"https://example.com/live-smoke",steps:"Open the sample",expected:"Video loads",actual:"Video loads",environment:"GitHub Actions"}
  }));
  nativeReserved=true;
  assert.equal(reservation.id,nativeId);
  const partBytes=2*1024*1024;
  for(let part=0,offset=0;offset<sampleBytes.length;part++,offset+=partBytes){
    const chunk=sampleBytes.subarray(offset,Math.min(sampleBytes.length,offset+partBytes));
    const result=await json(await nativeApi("upload-chunk",{id:nativeId,owner:nativeOwner,part,data:Buffer.from(chunk).toString("base64")}));
    assert.equal(result.uploaded,true);
  }
  const state=await json(await nativeApi("upload-state",{id:nativeId,owner:nativeOwner}));
  assert.deepEqual(state.parts,Array.from({length:Math.ceil(sampleBytes.length/partBytes)},(_,i)=>i));
  const published=await json(await nativeApi("publish",{id:nativeId,owner:nativeOwner,width:sampleWidth,height:sampleHeight}));
  assert.equal(published.passwordProtected,true);
  assert.equal(published.title,"Native Cloudflare parity smoke");
  const noPassword=await request("/api/clip?op=view&id="+nativeId);
  assert.equal(noPassword.status,401,"native share password gate is enforced");
  const wrong=await nativeApi("view",{id:nativeId,accessPassword:"wrong-password"});
  assert.equal(wrong.status,401,"wrong native share password is rejected");
  const view=await json(await nativeApi("view",{id:nativeId,accessPassword:nativePassword}));
  assert.equal(view.passwordProtected,true);
  assert.equal(view.captions[0].text,"A live caption");
  assert.equal(view.chapters[0].title,"Live chapter");
  assert.equal(view.report.steps,"Open the sample");
  const range=await fetch(view.mediaUrl,{headers:{range:"bytes=0-63"}});
  assert.equal(range.status,206,"native R2 media supports byte ranges");
  assert.equal(range.headers.get("content-range"),"bytes 0-63/"+sampleBytes.length);
  assert.equal((await range.arrayBuffer()).byteLength,64);
  const viewer=randomUUID(),authorKey=randomBytes(32).toString("hex"),eventId=randomUUID();
  const posted=await json(await nativeApi("comment",{id:nativeId,owner:nativeOwner,viewer,eventId,authorKey,name:"Live QA",text:"Native comment",time:2,accessPassword:nativePassword}));
  const root=posted.comments.find(x=>x.id===eventId);assert.ok(root);
  const replyId=randomUUID();
  const replied=await json(await nativeApi("comment",{id:nativeId,viewer:randomUUID(),eventId:replyId,authorKey:randomBytes(32).toString("hex"),name:"Guest",text:"Nested reply",time:2,parentId:eventId,accessPassword:nativePassword}));
  assert.equal(replied.comments.find(x=>x.id===replyId).parentId,eventId);
  await json(await nativeApi("edit-comment",{id:nativeId,viewer,authorKey,commentId:eventId,expectedVersion:root.createdAt,text:"Edited native comment",accessPassword:nativePassword}));
  await json(await nativeApi("resolve-thread",{id:nativeId,viewer,owner:nativeOwner,commentId:eventId,resolved:true,accessPassword:nativePassword}));
  await json(await nativeApi("reaction",{id:nativeId,viewer:randomUUID(),reaction:"thanks",accessPassword:nativePassword}));
  const title=await json(await nativeApi("title",{id:nativeId,owner:nativeOwner,title:"Native parity verified"}));assert.equal(title.title,"Native parity verified");
  const status=await json(await nativeApi("review-status",{id:nativeId,owner:nativeOwner,reviewStatus:"approved"}));assert.equal(status.reviewStatus,"approved");
  const manage=await json(await nativeApi("manage",{id:nativeId,owner:nativeOwner}));assert.equal(manage.status,"published");
  const restored=await json(await nativeApi("restore-media",{id:nativeId,owner:nativeOwner}));assert.match(restored.mediaUrl,/op=media/);
  await json(await nativeApi("delete-comment",{id:nativeId,viewer,authorKey,commentId:eventId,accessPassword:nativePassword}));
  for(let attempt=0;attempt<5;attempt++)assert.equal((await nativeApi("view",{id:nativeId,accessPassword:"wrong-password-again"})).status,401);
  assert.equal((await nativeApi("view",{id:nativeId,accessPassword:nativePassword})).status,429,"five failed attempts lock the native password gate");
  await json(await nativeApi("revoke",{id:nativeId,owner:nativeOwner}));
  assert.equal((await request("/api/clip?op=view&id="+nativeId)).status,404,"revoked native share is unavailable");
  await json(await nativeApi("delete",{id:nativeId,owner:nativeOwner}));
  const tombstone=await json(await nativeApi("manage",{id:nativeId,owner:nativeOwner}));assert.equal(tombstone.deleted,true);assert.equal(tombstone.status,"revoked","deleted records remain in the revoked state to prevent legacy-share resurrection");
  assert.equal((await nativeApi("view",{id:nativeId,accessPassword:nativePassword})).status,404,"deleted IDs cannot fall back to old Vercel shares");
  assert.equal((await nativeApi("delete",{id:nativeId,owner:nativeOwner})).status,200,"delete is idempotent");
  nativeReserved=false;
  const capacity=await json(await request("/api/clip?op=health"));
  assert.equal(capacity.reservedBytes,nativeHealth.reservedBytes,"native storage reservation is released after delete");
  assert.equal(capacity.reservedRecordings,nativeHealth.reservedRecordings,"native recording count is released after delete");
  console.log("Native Cloudflare acceptance passed: D1 reservation, chunk resume state, R2 publish/range, password lockout, captions/chapters/report, nested comments/edit/resolve/delete, reaction, owner metadata, revoke and cleanup.");
} catch(error) {
  if(nativeReserved)await nativeApi("delete",{id:nativeId,owner:nativeOwner}).catch(()=>undefined);
  throw error;
}

async function jsonText(response) {
  assert.equal(response.status, 200, "homepage responds");
  return await response.text();
}
