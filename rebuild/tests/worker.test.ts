import { beforeEach, describe, expect, it } from "vitest";
import worker from "../worker/index";

class FakeD1 {
  sessions = new Set<string>();
  recordings = new Map<string, { id: string; owner: string; title: string; object_key: string; mime_type: string; byte_size: number; status: string; created_at: number }>();

  prepare(sql: string) {
    const db = this;
    return {
      bind(...values: unknown[]) {
        return {
          async first() {
            if (sql.includes("SELECT token_hash FROM guest_sessions")) {
              const tokenHash = String(values[0]);
              return db.sessions.has(tokenHash) ? { token_hash: tokenHash } : null;
            }
            if (sql.includes("SELECT object_key, mime_type, byte_size FROM recordings")) {
              const row = db.recordings.get(String(values[0]));
              return row && row.owner === String(values[1]) && row.status === "uploading"
                ? { object_key: row.object_key, mime_type: row.mime_type, byte_size: row.byte_size }
                : null;
            }
            if (sql.includes("SELECT object_key FROM recordings")) {
              const row = db.recordings.get(String(values[0]));
              return row && row.owner === String(values[1]) ? { object_key: row.object_key } : null;
            }
            return null;
          },
          async run() {
            if (sql.startsWith("INSERT INTO guest_sessions")) db.sessions.add(String(values[0]));
            if (sql.startsWith("INSERT INTO recordings")) {
              const [id, owner, title, object_key, mime_type, byte_size, created_at] = values as [string,string,string,string,string,number,number,number];
              db.recordings.set(id, { id, owner, title, object_key, mime_type, byte_size, status: "uploading", created_at });
            }
            if (sql.startsWith("UPDATE recordings")) {
              const [updatedAt, id, owner] = values as [number,string,string];
              const row = db.recordings.get(id);
              if (row && row.owner === owner) row.status = "ready";
            }
            if (sql.startsWith("DELETE FROM recordings")) db.recordings.delete(String(values[0]));
            return { success: true };
          },
          async all() {
            if (sql.includes("FROM recordings WHERE owner_token_hash")) {
              return { results: [...db.recordings.values()].filter((row) => row.owner === String(values[0])) };
            }
            return { results: [] };
          }
        };
      }
    };
  }
}

const makeEnv = () => {
  const DB = new FakeD1();
  const uploaded: { key?: string; size?: number; type?: string } = {};
  const deleted: string[] = [];
  const MEDIA = {
    async put(key: string, body: ReadableStream<Uint8Array>, options: { httpMetadata: { contentType: string } }) {
      const bytes = await new Response(body).arrayBuffer();
      uploaded.key = key; uploaded.size = bytes.byteLength; uploaded.type = options.httpMetadata.contentType;
    },
    async delete(key: string) { deleted.push(key); }
  };
  return { env: { DB, MEDIA, STATIC: {} }, DB, uploaded, deleted };
};

async function guestSession(env: ReturnType<typeof makeEnv>["env"]) {
  const response = await worker.fetch(new Request("https://screennote.test/api/session"), env as never, {} as never);
  const cookie = response.headers.get("set-cookie")!;
  return { cookie: cookie.split(";")[0] };
}

describe("ScreenNote Worker API", () => {
  let state: ReturnType<typeof makeEnv>;
  beforeEach(() => { state = makeEnv(); });

  it("serves a health response without requiring a session", async () => {
    const response = await worker.fetch(new Request("https://screennote.test/api/health"), state.env as never, {} as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", service: "screennote" });
  });

  it("rejects cross-origin session creation", async () => {
    const response = await worker.fetch(new Request("https://screennote.test/api/session", {
      headers: { origin: "https://attacker.test" }
    }), state.env as never, {} as never);
    expect(response.status).toBe(403);
    expect(state.DB.sessions.size).toBe(0);
  });

  it("creates a guest session and requires it for recording creation", async () => {
    const session = await guestSession(state.env);
    expect(session.cookie).toContain("sn_guest=");
    const response = await worker.fetch(new Request("https://screennote.test/api/recordings", {
      method: "POST",
      headers: { origin: "https://screennote.test", cookie: session.cookie, "content-type": "application/json" },
      body: JSON.stringify({ title: "Walkthrough", mimeType: "video/webm", size: 4 })
    }), state.env as never, {} as never);
    expect(response.status).toBe(201);
    const body = await response.json() as { id: string; uploadUrl: string };
    expect(body.id).toMatch(/^[a-f0-9-]{36}$/i);
    expect(body.uploadUrl).toBe(`/api/recordings/${body.id}/media`);
  });

  it("streams an owned recording into R2 and rejects mismatched upload size", async () => {
    const session = await guestSession(state.env);
    const create = await worker.fetch(new Request("https://screennote.test/api/recordings", {
      method: "POST",
      headers: { origin: "https://screennote.test", cookie: session.cookie, "content-type": "application/json" },
      body: JSON.stringify({ title: "Clip", mimeType: "video/webm", size: 4 })
    }), state.env as never, {} as never);
    const { id } = await create.json() as { id: string };

    const mismatch = await worker.fetch(new Request(`https://screennote.test/api/recordings/${id}/media`, {
      method: "PUT",
      headers: { origin: "https://screennote.test", cookie: session.cookie, "content-type": "video/webm", "content-length": "3" },
      body: "abc"
    }), state.env as never, {} as never);
    expect(mismatch.status).toBe(400);

    const upload = await worker.fetch(new Request(`https://screennote.test/api/recordings/${id}/media`, {
      method: "PUT",
      headers: { origin: "https://screennote.test", cookie: session.cookie, "content-type": "video/webm", "content-length": "4" },
      body: "test"
    }), state.env as never, {} as never);
    expect(upload.status).toBe(200);
    expect(state.uploaded.size).toBe(4);
    expect(state.uploaded.type).toBe("video/webm");
  });
});