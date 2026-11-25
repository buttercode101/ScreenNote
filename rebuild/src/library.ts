export type Clip = {
  id: string;
  title: string;
  createdAt: number;
  duration: number;
  size: number;
  mimeType: string;
  blob: Blob;
  share?: { recordingId: string; token: string; url: string; ownerKey: string; expiresAt: number };
  annotations?: Annotation[];
  captions?: CaptionCue[];
  chapters?: Chapter[];
  report?: BugReport | null;
  reviewStatus?: "needs-feedback" | "changes-requested" | "approved";
};

export type Annotation = { kind: "rectangle" | "arrow" | "highlight" | "blur" | "redact"; x: number; y: number; w: number; h: number };
export type CaptionCue = { start: number; end: number; text: string };
export type Chapter = { time: number; title: string };
export type BugReport = { url: string; steps: string; expected: string; actual: string; environment: string };

export type RecoverySession = {
  id: string;
  title: string;
  createdAt: number;
  mimeType: string;
  chunkCount: number;
  totalBytes: number;
  updatedAt: number;
};

type RecordingChunk = { id: string; sessionId: string; index: number; blob: Blob; size: number };

const DB_NAME = "screennote-local";
const VERSION = 2;
const CLIPS = "clips";
const SESSIONS = "sessions";
const CHUNKS = "chunks";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CLIPS)) {
        const store = db.createObjectStore(CLIPS, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(SESSIONS)) {
        db.createObjectStore(SESSIONS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(CHUNKS)) {
        const store = db.createObjectStore(CHUNKS, { keyPath: "id" });
        store.createIndex("sessionId", "sessionId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local library"));
    request.onblocked = () => reject(new Error("Close other ScreenNote tabs to update local recording storage"));
  });
}

export async function listClips(): Promise<Omit<Clip, "blob">[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(CLIPS, "readonly").objectStore(CLIPS).getAll();
    request.onsuccess = () => resolve((request.result as Clip[])
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ blob: _blob, ...clip }) => clip));
    request.onerror = () => reject(request.error);
  });
}

export async function listFullClips(): Promise<Clip[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(CLIPS, "readonly").objectStore(CLIPS).getAll();
    request.onsuccess = () => resolve((request.result as Clip[]).sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error);
  });
}

export async function saveClip(clip: Clip): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CLIPS, "readwrite");
    tx.objectStore(CLIPS).put(clip);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save recording"));
    tx.onabort = () => reject(tx.error ?? new Error("Saving recording was interrupted"));
  });
}

export async function getClip(id: string): Promise<Clip | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(CLIPS, "readonly").objectStore(CLIPS).get(id);
    request.onsuccess = () => resolve(request.result as Clip | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteClip(id: string): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CLIPS, "readwrite");
    tx.objectStore(CLIPS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function beginRecordingSession(session: RecoverySession): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSIONS, "readwrite");
    tx.objectStore(SESSIONS).put(session);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not prepare recording recovery"));
  });
}

export async function appendRecordingChunk(sessionId: string, blob: Blob, index: number): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SESSIONS, CHUNKS], "readwrite");
    const sessions = tx.objectStore(SESSIONS);
    const request = sessions.get(sessionId);
    request.onsuccess = () => {
      const session = request.result as RecoverySession | undefined;
      if (!session) {
        tx.abort();
        return;
      }
      const chunk: RecordingChunk = {
        id: sessionId + ":" + String(index).padStart(8, "0"),
        sessionId,
        index,
        blob,
        size: blob.size
      };
      tx.objectStore(CHUNKS).put(chunk);
      session.chunkCount = Math.max(session.chunkCount, index + 1);
      session.totalBytes += blob.size;
      session.updatedAt = Date.now();
      sessions.put(session);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not preserve recording chunk"));
    tx.onabort = () => reject(tx.error ?? new Error("Recording recovery storage is full or unavailable"));
  });
}

export async function listRecoverableSessions(): Promise<RecoverySession[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(SESSIONS, "readonly").objectStore(SESSIONS).getAll();
    request.onsuccess = () => resolve((request.result as RecoverySession[]).sort((a, b) => b.updatedAt - a.updatedAt));
    request.onerror = () => reject(request.error);
  });
}

export async function deleteRecordingSession(sessionId: string): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SESSIONS, CHUNKS], "readwrite");
    const chunks = tx.objectStore(CHUNKS).index("sessionId").getAllKeys(sessionId);
    chunks.onsuccess = () => {
      for (const key of chunks.result) tx.objectStore(CHUNKS).delete(key);
      tx.objectStore(SESSIONS).delete(sessionId);
    };
    chunks.onerror = () => reject(chunks.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function finalizeRecordingSession(sessionId: string, clip: Clip): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CLIPS, SESSIONS, CHUNKS], "readwrite");
    tx.objectStore(CLIPS).put(clip);
    const chunks = tx.objectStore(CHUNKS).index("sessionId").getAllKeys(sessionId);
    chunks.onsuccess = () => {
      for (const key of chunks.result) tx.objectStore(CHUNKS).delete(key);
      tx.objectStore(SESSIONS).delete(sessionId);
    };
    chunks.onerror = () => reject(chunks.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not finalize recording"));
    tx.onabort = () => reject(tx.error ?? new Error("Could not finalize recording"));
  });
}

export async function restoreRecordingSession(sessionId: string): Promise<void> {
  const db = await database();
  const session = await new Promise<RecoverySession | undefined>((resolve, reject) => {
    const request = db.transaction(SESSIONS, "readonly").objectStore(SESSIONS).get(sessionId);
    request.onsuccess = () => resolve(request.result as RecoverySession | undefined);
    request.onerror = () => reject(request.error);
  });
  if (!session) throw new Error("This recovery session is no longer available");
  const chunks = await new Promise<RecordingChunk[]>((resolve, reject) => {
    const request = db.transaction(CHUNKS, "readonly").objectStore(CHUNKS).index("sessionId").getAll(sessionId);
    request.onsuccess = () => resolve((request.result as RecordingChunk[]).sort((a, b) => a.index - b.index));
    request.onerror = () => reject(request.error);
  });
  if (!chunks.length) throw new Error("No recoverable video data was found");
  const blob = new Blob(chunks.map((chunk) => chunk.blob), { type: session.mimeType });
  await finalizeRecordingSession(sessionId, {
    id: session.id,
    title: session.title + " (recovered)",
    createdAt: session.createdAt,
    duration: Math.max(0, chunks.length),
    size: blob.size,
    mimeType: session.mimeType,
    blob
  });
}
export async function findShareByToken(token: string): Promise<Clip | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(CLIPS, "readonly").objectStore(CLIPS).getAll();
    request.onsuccess = () => resolve((request.result as Clip[]).find((clip) => clip.share?.token === token));
    request.onerror = () => reject(request.error);
  });
}
