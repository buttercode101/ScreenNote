import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  appendRecordingChunk,
  beginRecordingSession,
  deleteRecordingSession,
  getClip,
  listRecoverableSessions,
  restoreRecordingSession
} from "../src/library";

describe("local recording recovery", () => {
  it("persists chunks and restores an interrupted recording", async () => {
    const session = {
      id: "session-1",
      title: "Product walkthrough",
      createdAt: 1000,
      mimeType: "video/webm",
      chunkCount: 0,
      totalBytes: 0,
      updatedAt: 1000
    };
    await beginRecordingSession(session);
    await appendRecordingChunk(session.id, new Blob(["first"]), 0);
    await appendRecordingChunk(session.id, new Blob(["second"]), 1);

    const pending = await listRecoverableSessions();
    expect(pending).toHaveLength(1);
    expect(pending[0].chunkCount).toBe(2);
    expect(pending[0].totalBytes).toBe(11);

    await restoreRecordingSession(session.id);
    const clip = await getClip(session.id);
    expect(clip?.title).toContain("(recovered)");
    expect(await clip?.blob.text()).toBe("firstsecond");
    expect(await listRecoverableSessions()).toHaveLength(0);
  });

  it("can discard a recovery session and its chunks", async () => {
    await beginRecordingSession({
      id: "session-2", title: "Untitled", createdAt: 1000, mimeType: "video/webm",
      chunkCount: 0, totalBytes: 0, updatedAt: 1000
    });
    await appendRecordingChunk("session-2", new Blob(["data"]), 0);
    await deleteRecordingSession("session-2");
    expect(await listRecoverableSessions()).toHaveLength(0);
  });
});