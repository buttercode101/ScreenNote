import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, ArrowDownToLine, ArrowUpRight, Check, ChevronDown, CircleHelp, Download, Camera, Clapperboard, Clock3, FileVideo2, FolderOpen, LayoutGrid, Mic, Moon, MoreHorizontal, Pause, Play, Plus, Scissors, Search, Settings2, Share2, ShieldCheck, Sparkles, Sun, Trash2, Video, X } from "lucide-react";
import { appendRecordingChunk, beginRecordingSession, deleteClip, deleteRecordingSession, finalizeRecordingSession, getClip, listClips, listRecoverableSessions, restoreRecordingSession, saveClip, type Clip, type RecoverySession } from "./library";
import { ScreenRecorder, supportedMimeType, type RecordingResult } from "./recorder";
import { newOwnerKey, publishRecording } from "./sharing";
import { clampTrimRange, trimVideoElement } from "./trim";
import ShareViewer from "./ShareViewer";
import PrivacyPage from "./PrivacyPage";
import EditorWorkspace from "./EditorWorkspace";
import PreviewWorkspace from "./PreviewWorkspace";
import "./styles.css";

const recorder = new ScreenRecorder();
const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};
const formatDate = (time: number) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(time);
async function readVideoDuration(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => { const duration = video.duration; video.src = ""; resolve(Number.isFinite(duration) ? Math.ceil(duration) : 0); };
      video.onerror = () => resolve(0);
      video.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function App() {
  const [clips, setClips] = useState<Omit<Clip, "blob">[]>([]);
  const [recoverable, setRecoverable] = useState<RecoverySession[]>([]);
  const activeSessionId = useRef<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(false);
  const [systemAudio, setSystemAudio] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dark, setDark] = useState(() => { try { return localStorage.getItem("screennote-theme") === "dark"; } catch { return false; } });
  const [query, setQuery] = useState("");
  const [previewClip, setPreviewClip] = useState<Clip | null>(null);
  const [previewMode, setPreviewMode] = useState<"preview" | "edit">("preview");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [trimming, setTrimming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [expiryDays, setExpiryDays] = useState(3);
  const [sharePassword, setSharePassword] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [recoveryData, setRecoveryData] = useState("");
  const recoveryFileRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const [nextClips, nextRecoverable] = await Promise.all([listClips(), listRecoverableSessions()]);
    setClips(nextClips);
    setRecoverable(nextRecoverable);
  };
  useEffect(() => { refresh().catch(() => setMessage("Your browser's local storage is unavailable.")); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; try { localStorage.setItem("screennote-theme", dark ? "dark" : "light"); } catch { /* Appearance remains usable when storage is blocked. */ } }, [dark]);
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => setMessage("Offline support could not be enabled in this browser."));
    }
  }, []);

  const visibleClips = useMemo(() => clips.filter((clip) => clip.title.toLowerCase().includes(query.toLowerCase())), [clips, query]);

  async function start() {
    setMessage("");
    setBusy(true);
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const title = `Screen recording — ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(createdAt)}`;
    try {
      await beginRecordingSession({ id, title, createdAt, mimeType: supportedMimeType() || "video/webm", chunkCount: 0, totalBytes: 0, updatedAt: createdAt });
      activeSessionId.current = id;
      await recorder.start(
        { microphone: mic, systemAudio, camera },
        setSeconds,
        (chunk, index) => appendRecordingChunk(id, chunk, index)
      );
      setRecording(true);
      setPaused(false);
    } catch (error) {
      await deleteRecordingSession(id).catch(() => undefined);
      activeSessionId.current = null;
      setMessage(error instanceof Error ? error.message : "Could not start recording.");
    } finally { setBusy(false); }
  }

  async function persistResult(result: RecordingResult) {
    const id = activeSessionId.current ?? crypto.randomUUID();
    const createdAt = Date.now();
    const clip: Clip = {
      id,
      title: `Screen recording — ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(createdAt)}`,
      createdAt,
      duration: result.duration,
      size: result.blob.size,
      mimeType: result.mimeType,
      blob: result.blob
    };
    if (activeSessionId.current) await finalizeRecordingSession(id, clip);
    else await saveClip(clip);
    activeSessionId.current = null;
    await refresh();
    setMessage("Recording saved privately on this device.");
  }

  useEffect(() => {
    const handleExternalStop = (event: Event) => {
      const result = (event as CustomEvent<RecordingResult>).detail;
      setRecording(false); setPaused(false); setSeconds(0);
      void persistResult(result).catch(() => setMessage("The recording could not be saved locally."));
    };
    window.addEventListener("screennote:recording-finished", handleExternalStop);
    return () => window.removeEventListener("screennote:recording-finished", handleExternalStop);
  }, []);

  async function finish() {
    setBusy(true);
    try {
      const result = await recorder.stop();
      await persistResult(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this recording.");
    } finally {
      setRecording(false); setPaused(false); setSeconds(0); setBusy(false);
    }
  }

  async function recoverSession(id: string) {
    try {
      await restoreRecordingSession(id);
      await refresh();
      setMessage("Your interrupted recording was recovered.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not recover this recording.");
    }
  }

  async function discardSession(id: string) {
    if (!window.confirm("Discard this unfinished recording and its saved chunks?")) return;
    try { await deleteRecordingSession(id); await refresh(); }
    catch { setMessage("Could not discard the unfinished recording."); }
  }

  async function importFile(file?: File) {
    if (!file) return;
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) {
      setMessage("Choose an MP4, WebM or MOV video.");
      return;
    }
    try { const duration = await readVideoDuration(file); const clip: Clip = { id: crypto.randomUUID(), title: file.name.replace(/\\.[^.]+$/, ""), createdAt: Date.now(), duration, size: file.size, mimeType: file.type, blob: file }; await saveClip(clip); await refresh(); setMessage("Video added to your private library."); }
    catch { setMessage("Could not save this file. Check available device storage."); }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function openPreview(id: string) {
    setPreviewMode("preview");
    const clip = await getClip(id);
    if (!clip) { setMessage("This recording is no longer available on this device."); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewClip(clip);
    setTrimStart(0); setTrimEnd(clip.duration);
    setPreviewUrl(URL.createObjectURL(clip.blob));
  }

  async function openEditor(id: string) {
    await openPreview(id);
    setPreviewMode("edit");
  }

  async function saveTrimmedCopy() {
    if (!previewClip || !previewVideoRef.current) return;
    setTrimming(true);
    try {
      const range = clampTrimRange(trimStart, trimEnd, previewClip.duration);
      const blob = await trimVideoElement(previewVideoRef.current, range);
      const trimmed: Clip = { id: crypto.randomUUID(), title: previewClip.title + " — trimmed", createdAt: Date.now(), duration: Math.round(range.duration), size: blob.size, mimeType: blob.type, blob };
      await saveClip(trimmed); await refresh();
      setMessage("Trimmed copy saved locally. Your original is unchanged.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Couldn't trim this video."); }
    finally { setTrimming(false); }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewClip(null);
  }

  useEffect(() => {
    if (!previewClip) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closePreview(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewClip, previewUrl]);

  async function download(id: string) {
    const clip = await (await import("./library")).getClip(id);
    if (!clip) return;
    const url = URL.createObjectURL(clip.blob);
    const a = document.createElement("a");
    a.href = url; const extension = clip.mimeType === "video/mp4" ? "mp4" : clip.mimeType === "video/quicktime" ? "mov" : "webm"; a.download = `${clip.title.replace(/[^a-z0-9-_ ]/gi, "").trim() || "screennote"}.${extension}`;
    a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function shareClip(id: string) {
    const clip = await getClip(id);
    if (clip?.share && clip.share.expiresAt * 1000 > Date.now()) {
      const url = new URL(clip.share.url, location.origin).toString();
      setShareLink(url); await navigator.clipboard?.writeText(url).catch(() => undefined);
      return;
    }
    setPublishId(id);
  }

  async function publishSelected() {
    if (!publishId) return;
    setPublishing(true); setMessage("");
    try {
      const clip = await getClip(publishId);
      if (!clip) throw new Error("This local recording is no longer available.");
      if (!clip.duration || clip.duration > 600) throw new Error("This clip needs a valid duration of 10 minutes or less before it can be shared.");
      if (clip.share) {
        const stopped = await fetch("/api/share/" + clip.share.token + "/manage", { method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerKey: clip.share.ownerKey }) });
        if (!stopped.ok) throw new Error("The previous share could not be ended. Your existing link and local recording are unchanged.");
      }
      const ownerKey = newOwnerKey();
      const result = await publishRecording(clip, expiryDays, sharePassword, ownerKey);
      const detailsResponse = await fetch("/api/share/" + result.token + "/details", { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerKey, details: { annotations: clip.annotations || [], captions: clip.captions || [], chapters: clip.chapters || [], report: clip.report || null } }) });
      if (!detailsResponse.ok) {
        await fetch("/api/share/" + result.token + "/manage", { method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerKey }) }).catch(() => undefined);
        throw new Error("The video uploaded, but its review context could not be saved. The incomplete share was rolled back; your local original is safe.");
      }
      const next = { ...clip, share: { recordingId: result.id, token: result.token, url: result.url, ownerKey, expiresAt: result.expiresAt } };
      await saveClip(next); await refresh();
      const fullUrl = new URL(result.url, location.origin).toString();
      setShareLink(fullUrl);
      setRecoveryData(JSON.stringify({ format: "screennote-share-recovery", version: 1, shareToken: result.token, ownerKey, recordingId: result.id, expiresAt: result.expiresAt }, null, 2));
      await navigator.clipboard?.writeText(fullUrl).catch(() => undefined);
      setPublishId(null); setSharePassword("");
      setMessage("Your temporary link is ready. The link has been copied if clipboard access is available.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Couldn't publish this recording."); }
    finally { setPublishing(false); }
  }

  async function importRecovery(file?: File) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data?.format !== "screennote-share-recovery" || data.version !== 1 || typeof data.shareToken !== "string" || !/^[A-Za-z0-9_-]{32,64}$/.test(data.shareToken) || typeof data.ownerKey !== "string" || !/^[a-f0-9]{64}$/.test(data.ownerKey)) throw new Error("This is not a valid ScreenNote recovery key.");
      localStorage.setItem("screennote-recovery-" + data.shareToken, data.ownerKey);
      setMessage("Private recovery key imported. You can now manage this share from its viewer link.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not read this recovery key."); }
    finally { if (recoveryFileRef.current) recoveryFileRef.current.value = ""; }
  }

  async function stopSharing(id: string) {
    const clip = await getClip(id);
    if (!clip?.share) return;
    try {
      const response = await fetch("/api/share/" + clip.share.token + "/manage", { method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerKey: clip.share.ownerKey }) });
      if (!response.ok) throw new Error("The shared copy could not be removed. Try again.");
      const next = { ...clip }; delete next.share; await saveClip(next); await refresh();
      setMessage("Sharing stopped. The shared video and its discussion have been deleted. Your local original is still here.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Couldn't stop sharing."); }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this recording from this device? This cannot be undone.")) return;
    try {
      const clip = await getClip(id);
      if (clip?.share) {
        const stopped = await fetch("/api/share/" + clip.share.token + "/manage", { method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerKey: clip.share.ownerKey }) });
        if (!stopped.ok) throw new Error("The shared copy could not be removed. Your local recording and recovery key have been kept.");
      }
      await deleteClip(id);
      await refresh();
      setMessage("Recording deleted from this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't delete this recording. Your local copy is still here.");
    }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="ScreenNote home"><span className="brand-mark"><Video size={18}/></span><span>screen<span className="brand-light">note</span></span></a>
      <div className="workspace-label">WORKSPACE <span className="local-pill"><span/> LOCAL</span></div>
      <nav className="side-nav" aria-label="Main navigation">
        <a className="nav-item active" href="#library"><LayoutGrid size={17}/> Overview</a>
        <a className="nav-item" href="#library"><Clapperboard size={17}/> My recordings <span className="nav-count">{clips.length}</span></a>
        <button className="nav-item" onClick={() => fileRef.current?.click()}><FolderOpen size={17}/> Import a video</button>
      </nav>
      <div className="sidebar-bottom">
        <div className="privacy-card"><ShieldCheck size={18}/><div><strong>Your recordings stay yours.</strong><p>Saved privately on this device until you choose to share.</p></div></div>
        <button className="nav-item" onClick={() => setShowSettings(!showSettings)}><Settings2 size={17}/> Preferences</button>
        <button className="nav-item" onClick={() => setDark(!dark)}>{dark ? <Sun size={17}/> : <Moon size={17}/>} {dark ? "Light appearance" : "Dark appearance"}</button>
        <button className="nav-item" onClick={() => recoveryFileRef.current?.click()}><ShieldCheck size={17}/> Restore share key</button><a className="nav-item" href="mailto:hello@buttercode.systems"><CircleHelp size={17}/> Help & feedback</a>
        <div className="profile-row"><div className="avatar">S</div><div><strong>Personal space</strong><span>Guest workspace</span></div><MoreHorizontal size={18}/></div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> Overview</div><div className="top-actions"><span className="secure-label"><ShieldCheck size={14}/> Private by default</span><button className="icon-button" aria-label="Toggle appearance" onClick={() => setDark(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><span className="avatar small" aria-label="Guest workspace">S</span></div></header>
      <div className="page-wrap">
        <section className="welcome-row"><div><div className="eyebrow">YOUR CREATIVE WORKSPACE</div><h1>Make it clear.<br/><span>Show what you mean.</span></h1><p className="intro">Capture a moment, explain an idea, and bring everyone onto the same page.</p></div><div className="welcome-art" aria-hidden="true"><div className="art-window"><div className="art-bar"><i/><i/><i/></div><div className="art-screen"><div className="art-sidebar"/><div className="art-content"><div/><div/><div/><div/></div><div className="art-cursor"/></div><div className="art-play"><Play size={15} fill="currentColor"/></div></div><div className="art-caption">A clearer way to communicate</div></div></section>

        {recoverable.map((session) => <div className="notice recovery-notice" role="status" key={session.id}>
          <div className="recovery-copy"><strong>An unfinished recording was found.</strong><span>{session.title} · {formatBytes(session.totalBytes)} saved locally</span></div>
          <div className="recovery-actions"><button className="button secondary" onClick={() => recoverSession(session.id)}>Recover</button><button className="button secondary" onClick={() => discardSession(session.id)}>Discard</button></div>
        </div>)}

        <section className="capture-panel">
          <div className="capture-copy"><div className="capture-icon"><Video size={21}/></div><div><h2>{recording ? "You're recording" : "Start with a recording"}</h2><p>{recording ? "Take your time. Your recording is being captured in this tab." : "Record your screen or bring in a video you already have."}</p></div></div>
          {recording ? <div className="record-controls"><div className="recording-indicator"><span/>{formatTime(seconds)} {paused ? "PAUSED" : "RECORDING"}</div><button className="button secondary" onClick={() => { if (paused) recorder.resume(); else recorder.pause(); setPaused(!paused); }}>{paused ? <Play size={16}/> : <Pause size={16}/>} {paused ? "Resume" : "Pause"}</button><button className="button danger" disabled={busy} onClick={finish}><Check size={16}/> Finish</button></div> : <div className="capture-actions"><label className="toggle-option"><input type="checkbox" checked={mic} onChange={(e) => setMic(e.target.checked)}/><Mic size={15}/> Microphone</label><label className="toggle-option"><input type="checkbox" checked={systemAudio} onChange={(e) => setSystemAudio(e.target.checked)}/> System audio</label><label className="toggle-option"><input type="checkbox" checked={camera} onChange={(e) => setCamera(e.target.checked)}/><Camera size={15}/> Camera bubble</label><button className="button primary" disabled={busy} onClick={start}><span className="record-dot"/>{busy ? "Preparing…" : "Record screen"} <ArrowUpRight size={16}/></button></div>}
        </section>

        {message && <div className="notice" role="status"><Check size={16}/>{message}<button onClick={() => setMessage("")} aria-label="Dismiss"><X size={15}/></button></div>}

        <section className="library-section" id="library">
          <div className="section-heading"><div><div className="eyebrow">YOUR LIBRARY</div><h2>Recent recordings <span className="count-badge">{clips.length}</span></h2></div><div className="library-tools"><label className="search-box"><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a recording" aria-label="Search recordings"/></label><button className="button secondary import-button" onClick={() => fileRef.current?.click()}><Plus size={16}/> Import</button></div></div>
          {visibleClips.length ? <div className="clip-grid">{visibleClips.map((clip) => <article className="clip-card" key={clip.id}><div className="clip-thumb"><div className="thumb-lines"><span/><span/><span/></div><button className="thumb-play" onClick={() => openPreview(clip.id)} aria-label={`Play ${clip.title}`}><Play size={18} fill="currentColor"/></button><span className="duration">{clip.duration ? formatTime(clip.duration) : "Imported"}</span></div><div className="clip-info"><div><h3 title={clip.title}>{clip.title}</h3><p><Clock3 size={13}/>{formatDate(clip.createdAt)} <span>·</span> {formatBytes(clip.size)}</p></div><div className="clip-actions"><button className="button secondary clip-text-action" onClick={() => openPreview(clip.id)}><Play size={14}/> Preview</button><button className="button secondary clip-text-action" onClick={() => openEditor(clip.id)}><Scissors size={14}/> Edit</button>{clip.share && clip.share.expiresAt * 1000 > Date.now() && <button className="icon-button" onClick={() => stopSharing(clip.id)} aria-label={`Stop sharing ${clip.title}`} title="Stop sharing"><ShieldCheck size={16}/></button>}<button className="icon-button" onClick={() => shareClip(clip.id)} aria-label={`Share ${clip.title}`}><Share2 size={16}/></button><button className="icon-button" onClick={() => remove(clip.id)} aria-label={`Delete ${clip.title}`}><Trash2 size={16}/></button></div></div></article>)}</div> : <div className="empty-state"><div className="empty-icon"><Clapperboard size={25}/></div><h3>{query ? "No matching recordings" : "Your next great explanation starts here."}</h3><p>{query ? "Try a different search." : "Record your screen or import a video. Your library is private and stays on this device."}</p><div className="empty-actions"><button className="button primary" disabled={busy || recording} onClick={start}><Video size={16}/> Record your screen</button><button className="button secondary" onClick={() => fileRef.current?.click()}><Plus size={16}/> Import a video</button></div></div>}
        </section>

        <section className="bottom-note"><div className="note-icon"><Sparkles size={18}/></div><div><strong>A little more clarity goes a long way.</strong><p>Record locally. Share temporarily. Keep the conversation tied to the exact moment—and let it end when you do.</p></div><span className="build-label"><Activity size={13}/> TEMPORARY BY DESIGN</span></section>
        <footer><span>© {new Date().getFullYear()} ScreenNote</span><span>Made for clear communication.</span><a href="/privacy">Privacy</a></footer>
      </div>
    </main>
    {previewClip && previewUrl && (previewMode === "edit" ? <EditorWorkspace clip={previewClip} url={previewUrl} onClose={closePreview} onUpdated={refresh} onShare={() => shareClip(previewClip.id)} onDownload={() => download(previewClip.id)} onDelete={async () => { await remove(previewClip.id); closePreview(); }} /> : <PreviewWorkspace clip={previewClip} url={previewUrl} onClose={closePreview} onEdit={() => setPreviewMode("edit")} onShare={() => shareClip(previewClip.id)} onDownload={() => download(previewClip.id)} onDelete={async () => { await remove(previewClip.id); closePreview(); }} />)}
    {publishId && <div className="modal-backdrop" role="presentation" onClick={() => !publishing && setPublishId(null)}><section className="publish-modal" role="dialog" aria-modal="true" aria-labelledby="publish-title" onClick={e=>e.stopPropagation()}>
      <div className="publish-modal-head"><div><span className="eyebrow">SHARE A MOMENT</span><h2 id="publish-title">Make a temporary link</h2><p>Your original stays on this device. Only this shared copy is uploaded.</p></div><button className="icon-button" onClick={()=>setPublishId(null)} aria-label="Close share settings"><X size={18}/></button></div>
      <label className="field-label">Link expires after<select value={expiryDays} onChange={e=>setExpiryDays(Number(e.target.value))}><option value={1}>1 day</option><option value={3}>3 days</option><option value={7}>7 days</option></select></label>
      <label className="field-label">Password protection <span className="optional-label">Optional</span><input type="password" minLength={8} maxLength={128} value={sharePassword} onChange={e=>setSharePassword(e.target.value)} placeholder="Add a password (8+ characters)"/></label>
      <div className="privacy-explainer"><ShieldCheck size={17}/><span>Viewers don't need an account. Your shared copy and discussion are deleted when the link expires or you stop sharing.</span></div>
      <button className="button primary publish-submit" disabled={publishing || (sharePassword.length>0&&sharePassword.length<8)} onClick={publishSelected}>{publishing?"Uploading securely…":"Publish temporary link"} <ArrowUpRight size={16}/></button>
    </section></div>}
    {shareLink && <div className="share-link-toast" role="status"><div><strong>Temporary link ready</strong><span>{shareLink}</span></div><a className="button secondary" href={shareLink} target="_blank" rel="noopener noreferrer">Open preview</a><button className="button secondary" onClick={()=>navigator.clipboard?.writeText(shareLink)}>Copy link</button><button className="button secondary" onClick={()=>{const url=URL.createObjectURL(new Blob([recoveryData],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="screennote-recovery.json";a.click();URL.revokeObjectURL(url);}}>Recovery key</button><button className="icon-button" onClick={()=>setShareLink("")} aria-label="Dismiss"><X size={16}/></button></div>}
    <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => importFile(e.target.files?.[0])}/><input ref={recoveryFileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importRecovery(e.target.files?.[0])}/>
  </div>;
}

const root = createRoot(document.getElementById("root")!);
const shareToken = window.location.pathname.split("/")[2] ?? "";
const isSharePath = window.location.pathname.startsWith("/s/") && /^[A-Za-z0-9_-]{32,64}$/.test(shareToken);
const isPrivacyPath = window.location.pathname === "/privacy";
root.render(<React.StrictMode>{isSharePath ? <ShareViewer token={shareToken} /> : isPrivacyPath ? <PrivacyPage /> : <App />}</React.StrictMode>);