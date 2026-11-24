export type Clip = {
  id: string;
  title: string;
  createdAt: number;
  duration: number;
  size: number;
  mimeType: string;
  blob: Blob;
};

const DB_NAME = "screennote-local";
const STORE = "clips";
const VERSION = 1;

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local library"));
  });
}

export async function listClips(): Promise<Omit<Clip, "blob">[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as Clip[])
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ blob: _blob, ...clip }) => clip));
    request.onerror = () => reject(request.error);
  });
}

export async function saveClip(clip: Clip): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(clip);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save recording"));
    tx.onabort = () => reject(tx.error ?? new Error("Saving recording was interrupted"));
  });
}

export async function getClip(id: string): Promise<Clip | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as Clip | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteClip(id: string): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}