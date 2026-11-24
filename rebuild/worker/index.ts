type Bindings = { DB: D1Database; MEDIA: R2Bucket; ASSETS: Fetcher };
const SESSION_COOKIE = "sn_guest";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(data, { status, headers: { "cache-control": "no-store", ...headers } });

function cookie(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie") ?? "";
  const entry = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(name + "="));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function owner(request: Request, env: Bindings): Promise<string | null> {
  const token = cookie(request, SESSION_COOKIE);
  if (!token || token.length > 128) return null;
  const tokenHash = await hash(token);
  const session = await env.DB.prepare("SELECT token_hash FROM guest_sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(tokenHash, Math.floor(Date.now() / 1000)).first<{ token_hash: string }>();
  return session?.token_hash ?? null;
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function handleApi(request: Request, env: Bindings): Promise<Response> {
  const url = new URL(request.url);
  if (!sameOrigin(request)) return json({ error: "Cross-origin request rejected" }, 403);

  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({ status: "ok", service: "screennote", version: "rebuild-dev" });
  }

  if (url.pathname === "/api/session" && request.method === "GET") {
    const existing = await owner(request, env);
    if (existing) return json({ status: "guest", expiresIn: SESSION_SECONDS });
    const token = crypto.randomUUID() + crypto.randomUUID();
    const tokenHash = await hash(token);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("INSERT INTO guest_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)")
      .bind(tokenHash, now, now + SESSION_SECONDS).run();
    return json({ status: "guest", expiresIn: SESSION_SECONDS }, 200, {
      "set-cookie": `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`
    });
  }

  const ownerHash = await owner(request, env);
  if (!ownerHash) return json({ error: "A guest session is required" }, 401);

  if (url.pathname === "/api/recordings" && request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT id, title, mime_type AS mimeType, byte_size AS size, duration_seconds AS duration, status, created_at AS createdAt FROM recordings WHERE owner_token_hash = ? ORDER BY created_at DESC LIMIT 100"
    ).bind(ownerHash).all();
    return json({ recordings: results });
  }

  if (url.pathname === "/api/recordings" && request.method === "POST") {
    const body = await request.json<{ title?: string; mimeType?: string; size?: number }>().catch(() => null);
    if (!body || typeof body.title !== "string" || !body.title.trim() || body.title.length > 120) return json({ error: "A valid recording title is required" }, 400);
    if (!Number.isSafeInteger(body.size) || !body.size || body.size! < 1 || body.size! > MAX_UPLOAD_BYTES) return json({ error: "Recording exceeds the 100 MB upload limit" }, 413);
    const mime = typeof body.mimeType === "string" ? body.mimeType : "";
    if (!["video/webm", "video/mp4", "video/quicktime"].includes(mime)) return json({ error: "Unsupported video format" }, 415);
    const id = crypto.randomUUID();
    const key = `recordings/${ownerHash.slice(0, 16)}/${id}`;
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("INSERT INTO recordings (id, owner_token_hash, title, object_key, mime_type, byte_size, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'uploading', ?, ?)")
      .bind(id, ownerHash, body.title.trim(), key, mime, body.size, now, now).run();
    return json({ id, uploadUrl: `/api/recordings/${id}/media` }, 201);
  }

  const match = url.pathname.match(/^\/api\/recordings\/([a-f0-9-]{36})(?:\/(media))?$/i);
  if (match && request.method === "PUT" && match[2] === "media") {
    const row = await env.DB.prepare("SELECT object_key, mime_type, byte_size FROM recordings WHERE id = ? AND owner_token_hash = ? AND status = 'uploading'")
      .bind(match[1], ownerHash).first<{ object_key: string; mime_type: string; byte_size: number }>();
    if (!row) return json({ error: "Recording upload not found" }, 404);
    const length = Number(request.headers.get("content-length") ?? 0);
    if (!request.body || !length || length !== row.byte_size || length > MAX_UPLOAD_BYTES) return json({ error: "Upload size did not match the reservation" }, 400);
    const type = request.headers.get("content-type")?.split(";")[0] ?? "";
    if (type !== row.mime_type) return json({ error: "Upload content type did not match the reservation" }, 415);
    await env.MEDIA.put(row.object_key, request.body, { httpMetadata: { contentType: row.mime_type } });
    await env.DB.prepare("UPDATE recordings SET status = 'ready', updated_at = ? WHERE id = ? AND owner_token_hash = ?")
      .bind(Math.floor(Date.now() / 1000), match[1], ownerHash).run();
    return json({ id: match[1], status: "ready" });
  }

  if (match && request.method === "DELETE" && !match[2]) {
    const row = await env.DB.prepare("SELECT object_key FROM recordings WHERE id = ? AND owner_token_hash = ?")
      .bind(match[1], ownerHash).first<{ object_key: string }>();
    if (!row) return json({ error: "Recording not found" }, 404);
    await env.MEDIA.delete(row.object_key);
    await env.DB.prepare("DELETE FROM recordings WHERE id = ? AND owner_token_hash = ?").bind(match[1], ownerHash).run();
    return json({ deleted: true });
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(JSON.stringify({ message: "ScreenNote request failed", path: url.pathname, error: error instanceof Error ? error.message : String(error) }));
      return json({ error: "The request could not be completed" }, 500);
    }
  }
};