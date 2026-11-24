type Bindings = { DB: D1Database; MEDIA: R2Bucket; STATIC: R2Bucket; ASSETS?: Fetcher };
const SESSION_COOKIE = "sn_guest";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_DURATION_SECONDS = 10 * 60;
const MAX_COMMENTS_PER_SHARE = 200;
const encoder = new TextEncoder();

const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(data, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers } });
const fail = (message: string, status = 400) => json({ error: message }, status);

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie") ?? "";
  const entry = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(name + "="));
  if (!entry) return null;
  try { return decodeURIComponent(entry.slice(name.length + 1)); } catch { return null; }
}
function randomToken(bytes = 32): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function digest(value: string): Promise<string> {
  const data = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(data)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function passwordDigest(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 150000 }, key, 256);
  return [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a), right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`;
}
function accessCookie(shareId: string, token: string, shareToken: string, maxAge: number): string {
  return `sn_access_${shareId}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/api/share/${shareToken}; Max-Age=${maxAge}`;
}
async function ownerHash(request: Request, env: Bindings): Promise<string | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || token.length > 128) return null;
  const tokenHash = await digest(token);
  const row = await env.DB.prepare("SELECT token_hash FROM guest_sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(tokenHash, Math.floor(Date.now() / 1000)).first<{ token_hash: string }>();
  return row?.token_hash ?? null;
}
async function ensureSession(request: Request, env: Bindings): Promise<Response> {
  const existing = await ownerHash(request, env);
  if (existing) return json({ status: "guest", expiresIn: SESSION_SECONDS });
  const token = randomToken(32), tokenHash = await digest(token), now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("INSERT INTO guest_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)")
    .bind(tokenHash, now, now + SESSION_SECONDS).run();
  return json({ status: "guest", expiresIn: SESSION_SECONDS }, 200, { "set-cookie": sessionCookie(token) });
}
function validId(value: string): boolean { return /^[a-f0-9-]{36}$/i.test(value); }
function shareCookieName(id: string): string { return `sn_access_${id}`; }
async function shareAccess(request: Request, env: Bindings, share: { id: string; token_hash: string; password_hash: string | null }): Promise<boolean> {
  if (!share.password_hash) return true;
  const token = readCookie(request, shareCookieName(share.id));
  if (!token || token.length > 128) return false;
  const row = await env.DB.prepare("SELECT token_hash FROM share_access_sessions WHERE token_hash = ? AND share_id = ? AND expires_at > ?")
    .bind(await digest(token), share.id, Math.floor(Date.now() / 1000)).first<{ token_hash: string }>();
  return !!row;
}
async function getShare(env: Bindings, token: string) {
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return null;
  return env.DB.prepare(
    "SELECT s.id, s.recording_id, s.owner_token_hash, s.token_hash, s.expires_at, s.password_salt, s.password_hash, s.revoked_at, r.title, r.object_key, r.mime_type, r.byte_size, r.duration_seconds FROM shares s JOIN recordings r ON r.id = s.recording_id WHERE s.token_hash = ?"
  ).bind(await digest(token)).first<{
    id: string; recording_id: string; owner_token_hash: string; token_hash: string; expires_at: number;
    password_salt: string | null; password_hash: string | null; revoked_at: number | null;
    title: string; object_key: string; mime_type: string; byte_size: number; duration_seconds: number;
  }>();
}
function active(share: { expires_at: number; revoked_at: number | null }): boolean {
  return !share.revoked_at && share.expires_at > Math.floor(Date.now() / 1000);
}
function publicShare(share: { title: string; mime_type: string; byte_size: number; duration_seconds: number; expires_at: number; password_hash: string | null }) {
  return { title: share.title, mimeType: share.mime_type, size: share.byte_size, duration: share.duration_seconds, expiresAt: share.expires_at, passwordRequired: !!share.password_hash };
}
async function requireShare(request: Request, env: Bindings, token: string) {
  const share = await getShare(env, token);
  if (!share || !active(share)) return { response: fail("This ScreenNote has ended or is no longer available.", 404) } as const;
  if (!(await shareAccess(request, env, share))) return { response: fail("Enter the sharing password to continue.", 401) } as const;
  return { share } as const;
}
function parseRange(header: string | null, size: number): { offset: number; length: number; contentRange: string } | null | false {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return false;
  let start: number, end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!suffix) return false;
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size) return false;
  end = Math.min(end, size - 1);
  return { offset: start, length: end - start + 1, contentRange: `bytes ${start}-${end}/${size}` };
}
async function validMediaHeader(stream: ReadableStream<Uint8Array>, mime: string): Promise<boolean> {
  const reader = stream.getReader();
  const bytes: number[] = [];
  try {
    while (bytes.length < 12) {
      const part = await reader.read();
      if (part.done) break;
      for (const value of part.value) { bytes.push(value); if (bytes.length >= 12) break; }
    }
  } finally { await reader.cancel().catch(() => undefined); }
  if (mime === "video/webm") return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (mime === "video/mp4" || mime === "video/quicktime") return bytes.length >= 8 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  return false;
}
async function serveMedia(request: Request, env: Bindings, share: NonNullable<Awaited<ReturnType<typeof getShare>>>) {
  const range = parseRange(request.headers.get("range"), share.byte_size);
  if (range === false) return new Response(null, { status: 416, headers: { "content-range": `bytes */${share.byte_size}` } });
  const object = await env.MEDIA.get(share.object_key, range ? { range: { offset: range.offset, length: range.length } } : undefined);
  if (!object) return fail("This shared recording is no longer available.", 404);
  const headers = new Headers({
    "content-type": share.mime_type, "content-length": String(range ? range.length : share.byte_size),
    "accept-ranges": "bytes", "cache-control": "private, no-store", "x-content-type-options": "nosniff",
    "content-disposition": "inline"
  });
  if (range) headers.set("content-range", range.contentRange);
  return new Response(request.method === "HEAD" ? null : object.body, { status: range ? 206 : 200, headers });
}
async function handleApi(request: Request, env: Bindings): Promise<Response> {
  const url = new URL(request.url), path = url.pathname;
  if (path !== "/api/health" && !sameOrigin(request)) return fail("Cross-origin request rejected.", 403);
  if (path === "/api/health" && request.method === "GET") return json({ status: "ok", service: "screennote", version: "1.0.0" });
  if (path === "/api/session" && request.method === "GET") return ensureSession(request, env);

  const shareMatch = path.match(/^\/api\/share\/([A-Za-z0-9_-]{32,64})(?:\/(media|access|manage|comments|comments\/([a-f0-9-]{36})(?:\/(resolve))?))?$/i);
  if (shareMatch) {
    const token = shareMatch[1], action = shareMatch[2] ?? "";
    const share = await getShare(env, token);
    if (!share || !active(share)) return fail("This ScreenNote has ended or is no longer available.", 404);
    if (action === "manage" && request.method === "DELETE") {
      const body = await request.json<{ ownerKey?: string }>().catch(() => null);
      if (typeof body?.ownerKey !== "string" || !/^[a-f0-9]{64}$/.test(body.ownerKey)) return fail("The private recovery key is required.", 403);
      if (!safeEqual(await digest(body.ownerKey), await env.DB.prepare("SELECT owner_key_hash FROM shares WHERE id = ?").bind(share.id).then((row: any) => row?.owner_key_hash ?? ""))) return fail("This browser cannot stop sharing this recording.", 403);
      await env.MEDIA.delete(share.object_key);
      await env.DB.prepare("DELETE FROM recordings WHERE id = ?").bind(share.recording_id).run();
      return json({ deleted: true });
    }
    if (action === "access" && request.method === "POST") {
      if (!share.password_hash) return json({ access: true });
      const body = await request.json<{ password?: string }>().catch(() => null);
      if (!body || typeof body.password !== "string" || body.password.length > 128) return fail("Enter the sharing password.", 400);
      const actual = await passwordDigest(body.password, share.password_salt!);
      if (!safeEqual(actual, share.password_hash)) return fail("That password isn't correct.", 401);
      const tokenValue = randomToken(32), now = Math.floor(Date.now() / 1000);
      await env.DB.prepare("INSERT INTO share_access_sessions (token_hash, share_id, expires_at) VALUES (?, ?, ?)")
        .bind(await digest(tokenValue), share.id, Math.min(share.expires_at, now + 60 * 60 * 12)).run();
      return json({ access: true }, 200, { "set-cookie": accessCookie(share.id, tokenValue, token, Math.min(share.expires_at - now, 43200)) });
    }
    if (!(await shareAccess(request, env, share))) return fail("Enter the sharing password to continue.", 401);
    if (action === "media" && (request.method === "GET" || request.method === "HEAD")) return serveMedia(request, env, share);
    if (action === "" && request.method === "GET") return json(publicShare(share));
    if (action === "comments" && request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT id, parent_id AS parentId, viewer_label AS viewerLabel, body, time_seconds AS time, created_at AS createdAt, updated_at AS updatedAt, resolved, deleted_at AS deletedAt FROM comments WHERE share_id = ? ORDER BY created_at ASC LIMIT 200"
      ).bind(share.id).all();
      return json({ comments: results });
    }
    if (action === "comments" && request.method === "POST") {
      const body = await request.json<{ authorKey?: string; text?: string; time?: number; parentId?: string | null; viewerLabel?: string }>().catch(() => null);
      if (!body || typeof body.authorKey !== "string" || !/^[A-Za-z0-9_-]{32,64}$/.test(body.authorKey)) return fail("A valid comment identity is required.", 400);
      if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 2000) return fail("Comments must be between 1 and 2,000 characters.", 400);
      if (!Number.isFinite(body.time) || body.time! < 0 || body.time! > share.duration_seconds) return fail("Choose a timestamp within this video.", 400);
      const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM comments WHERE share_id = ? AND deleted_at IS NULL").bind(share.id).first<{ total: number }>();
      if ((count?.total ?? 0) >= MAX_COMMENTS_PER_SHARE) return fail("This discussion has reached its comment limit.", 429);
      if (body.parentId) {
        const parent = await env.DB.prepare("SELECT id FROM comments WHERE id = ? AND share_id = ? AND deleted_at IS NULL").bind(body.parentId, share.id).first();
        if (!parent) return fail("The comment you're replying to is no longer available.", 404);
      }
      const id = crypto.randomUUID(), now = Math.floor(Date.now() / 1000);
      await env.DB.prepare("INSERT INTO comments (id, share_id, parent_id, author_hash, viewer_label, body, time_seconds, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, share.id, body.parentId ?? null, await digest(body.authorKey), typeof body.viewerLabel === "string" ? body.viewerLabel.slice(0, 40) : "Guest", body.text.trim(), Math.floor(body.time!), now, now).run();
      return json({ id, createdAt: now }, 201);
    }
    const commentId = shareMatch[3];
    if (commentId && action.includes("comments/")) {
      if (action.endsWith("/resolve") && request.method === "PATCH") {
        const body = await request.json<{ ownerKey?: string; resolved?: boolean }>().catch(() => null);
        if (typeof body?.ownerKey !== "string" || !/^[a-f0-9]{64}$/.test(body.ownerKey)) return fail("The private share key is required.", 403);
        const keyHash = await digest(body.ownerKey);
        const allowed = await env.DB.prepare("SELECT id FROM shares WHERE id = ? AND owner_key_hash = ?").bind(share.id, keyHash).first();
        if (!allowed) return fail("This browser cannot manage the discussion.", 403);
        await env.DB.prepare("UPDATE comments SET resolved = ?, updated_at = ? WHERE id = ? AND share_id = ? AND parent_id IS NULL")
          .bind(body.resolved ? 1 : 0, Math.floor(Date.now() / 1000), commentId, share.id).run();
        return json({ resolved: !!body.resolved });
      }
      if (request.method === "PATCH" || request.method === "DELETE") {
        const body = await request.json<{ authorKey?: string; text?: string }>().catch(() => null);
        if (typeof body?.authorKey !== "string") return fail("The comment's private edit key is required.", 403);
        const authorHash = await digest(body.authorKey), now = Math.floor(Date.now() / 1000);
        const comment = await env.DB.prepare("SELECT id FROM comments WHERE id = ? AND share_id = ? AND author_hash = ? AND deleted_at IS NULL")
          .bind(commentId, share.id, authorHash).first();
        if (!comment) return fail("This comment cannot be edited from this browser.", 403);
        if (request.method === "DELETE") {
          await env.DB.prepare("UPDATE comments SET deleted_at = ?, body = '[deleted]', updated_at = ? WHERE id = ? AND share_id = ?")
            .bind(now, now, commentId, share.id).run();
          return json({ deleted: true });
        }
        if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 2000) return fail("Comments must be between 1 and 2,000 characters.", 400);
        await env.DB.prepare("UPDATE comments SET body = ?, updated_at = ? WHERE id = ? AND share_id = ?")
          .bind(body.text.trim(), now, commentId, share.id).run();
        return json({ updated: true });
      }
    }
  }

  const owner = await ownerHash(request, env);
  if (!owner) return fail("A guest session is required.", 401);
  if (path === "/api/recordings" && request.method === "GET") {
    const { results } = await env.DB.prepare("SELECT id, title, mime_type AS mimeType, byte_size AS size, duration_seconds AS duration, status, created_at AS createdAt FROM recordings WHERE owner_token_hash = ? ORDER BY created_at DESC LIMIT 100")
      .bind(owner).all();
    return json({ recordings: results });
  }
  if (path === "/api/recordings" && request.method === "POST") {
    const body = await request.json<{ title?: string; mimeType?: string; size?: number; duration?: number }>().catch(() => null);
    if (!body || typeof body.title !== "string" || !body.title.trim() || body.title.length > 120) return fail("A valid recording title is required.", 400);
    if (!Number.isSafeInteger(body.size) || !body.size || body.size! < 1 || body.size! > MAX_UPLOAD_BYTES) return fail("This clip exceeds the 100 MB sharing limit.", 413);
    if (!Number.isFinite(body.duration) || body.duration! < 0 || body.duration! > MAX_DURATION_SECONDS) return fail("ScreenNote clips must be 10 minutes or shorter.", 413);
    const mime = body.mimeType?.split(";")[0] ?? "";
    if (!["video/webm", "video/mp4", "video/quicktime"].includes(mime)) return fail("Choose an MP4, WebM or MOV video.", 415);
    const id = crypto.randomUUID(), now = Math.floor(Date.now() / 1000), key = `shared/${id}`;
    await env.DB.prepare("INSERT INTO recordings (id, owner_token_hash, title, object_key, mime_type, byte_size, duration_seconds, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'uploading', ?, ?)")
      .bind(id, owner, body.title.trim(), key, mime, body.size, Math.ceil(body.duration!), now, now).run();
    return json({ id, uploadUrl: `/api/recordings/${id}/media` }, 201);
  }
  const recordingMatch = path.match(/^\/api\/recordings\/([a-f0-9-]{36})(?:\/(media|publish))?$/i);
  if (recordingMatch && recordingMatch[2] === "media" && request.method === "PUT") {
    const row = await env.DB.prepare("SELECT object_key, mime_type, byte_size FROM recordings WHERE id = ? AND owner_token_hash = ? AND status = 'uploading'")
      .bind(recordingMatch[1], owner).first<{ object_key: string; mime_type: string; byte_size: number }>();
    if (!row) return fail("This upload reservation is no longer available.", 404);
    const length = Number(request.headers.get("content-length") ?? 0), type = request.headers.get("content-type")?.split(";")[0] ?? "";
    if (!request.body || length !== row.byte_size || length > MAX_UPLOAD_BYTES) return fail("The uploaded file size did not match the reservation.", 400);
    if (type !== row.mime_type) return fail("The uploaded file type did not match the reservation.", 415);
    const [uploadStream, inspectStream] = request.body.tee();\n    if (!(await validMediaHeader(inspectStream, row.mime_type))) return fail("The uploaded file does not match its declared video format.", 415);\n    await env.MEDIA.put(row.object_key, uploadStream, { httpMetadata: { contentType: row.mime_type } });
    await env.DB.prepare("UPDATE recordings SET status = 'ready', updated_at = ? WHERE id = ? AND owner_token_hash = ?")
      .bind(Math.floor(Date.now() / 1000), recordingMatch[1], owner).run();
    return json({ id: recordingMatch[1], status: "ready" });
  }
  if (recordingMatch && recordingMatch[2] === "publish" && request.method === "POST") {
    const body = await request.json<{ expiresInDays?: number; password?: string; ownerKey?: string }>().catch(() => null);
    if (!body || ![1, 3, 7].includes(body.expiresInDays ?? 0)) return fail("Choose an expiry of 1, 3 or 7 days.", 400);
    if (typeof body.ownerKey !== "string" || !/^[a-f0-9]{64}$/.test(body.ownerKey)) return fail("A private recovery key is required.", 400);
    if (body.password && (body.password.length < 8 || body.password.length > 128)) return fail("Sharing passwords must be 8–128 characters.", 400);
    const recording = await env.DB.prepare("SELECT id, title, object_key, mime_type, byte_size, duration_seconds FROM recordings WHERE id = ? AND owner_token_hash = ? AND status = 'ready'")
      .bind(recordingMatch[1], owner).first<{ id: string; title: string; object_key: string; mime_type: string; byte_size: number; duration_seconds: number }>();
    if (!recording) return fail("Upload the complete recording before publishing.", 409);
    const old = await env.DB.prepare("SELECT id FROM shares WHERE recording_id = ?").bind(recording.id).first<{ id: string }>();
    if (old) {
      const existing = await env.DB.prepare("SELECT owner_key_hash FROM shares WHERE id = ?").bind(old.id).first<{ owner_key_hash: string }>();
      if (!existing || !safeEqual(existing.owner_key_hash, await digest(body.ownerKey))) return fail("This recording already has a share. Use its original private key to replace it.", 403);
      await env.MEDIA.delete(recording.object_key);
      await env.DB.prepare("DELETE FROM shares WHERE id = ?").bind(old.id).run();
    }
    const token = randomToken(32), shareId = crypto.randomUUID(), now = Math.floor(Date.now() / 1000);
    const salt = body.password ? randomToken(16) : null;
    const passwordHash = body.password ? await passwordDigest(body.password, salt!) : null;
    await env.DB.prepare("INSERT INTO shares (id, recording_id, owner_token_hash, owner_key_hash, token_hash, expires_at, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(shareId, recording.id, owner, await digest(body.ownerKey), await digest(token), now + body.expiresInDays! * 86400, salt, passwordHash, now).run();
    return json({ id: shareId, token, url: `/s/${token}`, expiresAt: now + body.expiresInDays! * 86400, passwordProtected: !!passwordHash }, 201);
  }
  if (recordingMatch && !recordingMatch[2] && request.method === "DELETE") {
    const body = await request.json<{ ownerKey?: string }>().catch(() => null);
    if (typeof body?.ownerKey !== "string") return fail("The private recovery key is required.", 403);
    const row = await env.DB.prepare("SELECT id, object_key FROM recordings WHERE id = ? AND owner_token_hash = ?")
      .bind(recordingMatch[1], owner).first<{ id: string; object_key: string }>();
    if (!row) return fail("Recording not found.", 404);
    const share = await env.DB.prepare("SELECT id, owner_key_hash FROM shares WHERE recording_id = ?").bind(row.id).first<{ id: string; owner_key_hash: string }>();
    if (share && !safeEqual(share.owner_key_hash, await digest(body.ownerKey))) return fail("This browser cannot stop sharing this recording.", 403);
    await env.MEDIA.delete(row.object_key);
    await env.DB.prepare("DELETE FROM recordings WHERE id = ? AND owner_token_hash = ?").bind(row.id, owner).run();
    return json({ deleted: true });
  }
  return fail("Not found.", 404);
}

async function serveStatic(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const url = new URL(request.url), pathname = url.pathname === "/" || /^\/s\/[A-Za-z0-9_-]{32,64}\/?$/.test(url.pathname) ? "/index.html" : url.pathname;
  if (pathname.split("/").some((part) => part === "." || part === "..") || !/^\/[a-zA-Z0-9_./-]+$/.test(pathname)) return new Response("Bad path", { status: 400 });
  if (env.ASSETS) return env.ASSETS.fetch(new Request(new URL(pathname, url), request));
  const object = await env.STATIC.get("site" + pathname);
  if (!object) return new Response("Not found", { status: 404 });
  const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
  const ext = pathname.slice(pathname.lastIndexOf("."));
  const headers = new Headers({ "content-type": types[ext] ?? "application/octet-stream", "cache-control": pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache", "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" });
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env);
      return await serveStatic(request, env, ctx);
    } catch (error) {
      console.error(JSON.stringify({ service: "screennote", path: new URL(request.url).pathname, error: error instanceof Error ? error.message : String(error) }));
      return fail("ScreenNote couldn't complete that request. Your local recording remains safe.", 500);
    }
  },
  async scheduled(_controller: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      const now = Math.floor(Date.now() / 1000);
      const { results } = await env.DB.prepare("SELECT r.id, r.object_key FROM recordings r JOIN shares s ON s.recording_id = r.id WHERE s.expires_at <= ? OR s.revoked_at IS NOT NULL LIMIT 100")
        .bind(now).all<{ id: string; object_key: string }>();
      for (const row of results) {
        await env.MEDIA.delete(row.object_key);
        await env.DB.prepare("DELETE FROM recordings WHERE id = ?").bind(row.id).run();
      }
      await env.DB.prepare("DELETE FROM guest_sessions WHERE expires_at <= ?").bind(now).run();
      await env.DB.prepare("DELETE FROM share_access_sessions WHERE expires_at <= ?").bind(now).run();
    })());
  }
};