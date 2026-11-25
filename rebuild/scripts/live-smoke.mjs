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

const sessionResponse = await request("/api/session");
assert.equal(sessionResponse.status, 200);
const cookie = sessionResponse.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie, "guest session cookie is set");
const headers = { cookie, origin, "content-type": "application/json" };
const recording = await json(await request("/api/recordings", {
  method: "POST", headers,
  body: JSON.stringify({ title: "Live acceptance check", mimeType: "video/webm", size: 12, duration: 12 })
}));
const ownerKey = "a".repeat(64);
const bytes = new Uint8Array([0x1a,0x45,0xdf,0xa3,0x93,0x42,0x86,0x81,0x01,0x42,0xf7,0x81]);
const uploaded = await request(recording.uploadUrl, {
  method: "PUT", headers: { ...headers, "content-type": "video/webm", "content-length": String(bytes.byteLength) }, body: bytes
});
if (uploaded.status !== 200) {
  await request("/api/recordings/" + recording.id, { method:"DELETE", headers, body:JSON.stringify({ ownerKey }) }).catch(() => undefined);
}
assert.equal(uploaded.status, 200, "real R2 upload succeeds");
assert.equal((await json(uploaded)).status, "ready");

const published = await json(await request(`/api/recordings/${recording.id}/publish`, {
  method: "POST", headers,
  body: JSON.stringify({ expiresInDays: 1, password: "live-check-password", ownerKey })
}));
const token = published.token;
assert.ok(token, "share token returned");
const sharePath = `/api/share/${token}`;
assert.equal((await request(sharePath)).status, 401, "password protects share metadata");
assert.equal((await request(sharePath + "/access", {
  method: "POST", headers: { origin, "content-type": "application/json" },
  body: JSON.stringify({ password: "wrong-password" })
})).status, 401, "wrong password rejected");
const accessResponse = await request(sharePath + "/access", {
  method: "POST", headers: { origin, "content-type": "application/json" },
  body: JSON.stringify({ password: "live-check-password" })
});
assert.equal(accessResponse.status, 200, "correct password unlocks share");
const accessCookie = accessResponse.headers.get("set-cookie")?.split(";")[0];
assert.ok(accessCookie, "password access cookie is set");
const viewerHeaders = { origin, cookie: accessCookie, "content-type": "application/json" };
const share = await json(await request(sharePath, { headers: viewerHeaders }));
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
console.log("Live ScreenNote acceptance passed: assets, guest session, real D1/R2 upload, password gate, byte-range media, comments/replies/edit/delete, resolve, and stop-share deletion.");

async function jsonText(response) {
  assert.equal(response.status, 200, "homepage responds");
  return await response.text();
}
