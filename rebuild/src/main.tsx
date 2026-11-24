import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, ArrowDownToLine, ArrowUpRight, Check, ChevronDown, CircleHelp, Clapperboard, Clock3, FileVideo2, FolderOpen, LayoutGrid, Mic, Moon, MoreHorizontal, Pause, Play, Plus, Search, Settings2, Share2, ShieldCheck, Sparkles, Sun, Trash2, Video, X } from "lucide-react";
import { deleteClip, listClips, saveClip, type Clip } from "./library";
import { ScreenRecorder } from "./recorder";
import "./styles.css";

const recorder = new ScreenRecorder();
const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};
const formatDate = (time: number) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(time);
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function App() {
  const [clips, setClips] = useState<Omit<Clip, "blob">[]>([]);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [mic, setMic] = useState(true);
  const [systemAudio, setSystemAudio] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dark, setDark] = useState(false);
  const [query, setQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => setClips(await listClips());
  useEffect(() => { refresh().catch(() => setMessage("Your browser's local storage is unavailable.")); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);

  const visibleClips = useMemo(() => clips.filter((clip) => clip.title.toLowerCase().includes(query.toLowerCase())), [clips, query]);

  async function start() {
    setMessage("");
    setBusy(true);
    try {
      await recorder.start({ microphone: mic, systemAudio }, setSeconds);
      setRecording(true);
      setPaused(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start recording.");
    } finally { setBusy(false); }
  }

  async function finish() {
    setBusy(true);
    try {
      const result = await recorder.stop();
      const clip: Clip = {
        id: crypto.randomUUID(),
        title: `Screen recording — ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(Date.now())}`,
        createdAt: Date.now(),
        duration: result.duration,
        size: result.blob.size,
        mimeType: result.mimeType,
        blob: result.blob
      };
      await saveClip(clip);
      await refresh();
      setMessage("Recording saved privately on this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this recording.");
    } finally {
      setRecording(false); setPaused(false); setSeconds(0); setBusy(false);
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) {
      setMessage("Choose an MP4, WebM or MOV video.");
      return;
    }
    const clip: Clip = { id: crypto.randomUUID(), title: file.name.replace(/\.[^.]+$/, ""), createdAt: Date.now(), duration: 0, size: file.size, mimeType: file.type, blob: file };
    try { await saveClip(clip); await refresh(); setMessage("Video added to your private library."); }
    catch { setMessage("Could not save this file. Check available device storage."); }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function download(id: string) {
    const clip = await (await import("./library")).getClip(id);
    if (!clip) return;
    const url = URL.createObjectURL(clip.blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${clip.title.replace(/[^a-z0-9-_ ]/gi, "").trim() || "screennote"}.webm`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this recording from this device? This cannot be undone.")) return;
    await deleteClip(id); await refresh();
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
        <a className="nav-item" href="mailto:hello@buttercode.systems"><CircleHelp size={17}/> Help & feedback</a>
        <div className="profile-row"><div className="avatar">S</div><div><strong>Personal space</strong><span>Guest workspace</span></div><MoreHorizontal size={18}/></div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> Overview</div><div className="top-actions"><span className="secure-label"><ShieldCheck size={14}/> Private by default</span><button className="icon-button" aria-label="Toggle appearance" onClick={() => setDark(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><button className="avatar small" aria-label="Guest workspace">S</button></div></header>
      <div className="page-wrap">
        <section className="welcome-row"><div><div className="eyebrow">YOUR CREATIVE WORKSPACE</div><h1>Make it clear.<br/><span>Show what you mean.</span></h1><p className="intro">Capture a moment, explain an idea, and bring everyone onto the same page.</p></div><div className="welcome-art" aria-hidden="true"><div className="art-window"><div className="art-bar"><i/><i/><i/></div><div className="art-screen"><div className="art-sidebar"/><div className="art-content"><div/><div/><div/><div/></div><div className="art-cursor"/></div><div className="art-play"><Play size={15} fill="currentColor"/></div></div><div className="art-caption">A clearer way to communicate</div></div></section>

        <section className="capture-panel">
          <div className="capture-copy"><div className="capture-icon"><Video size={21}/></div><div><h2>{recording ? "You're recording" : "Start with a recording"}</h2><p>{recording ? "Take your time. Your recording is being captured in this tab." : "Record your screen or bring in a video you already have."}</p></div></div>
          {recording ? <div className="record-controls"><div className="recording-indicator"><span/>{formatTime(seconds)} {paused ? "PAUSED" : "RECORDING"}</div><button className="button secondary" onClick={() => { if (paused) recorder.resume(); else recorder.pause(); setPaused(!paused); }}>{paused ? <Play size={16}/> : <Pause size={16}/>} {paused ? "Resume" : "Pause"}</button><button className="button danger" disabled={busy} onClick={finish}><Check size={16}/> Finish</button></div> : <div className="capture-actions"><label className="toggle-option"><input type="checkbox" checked={mic} onChange={(e) => setMic(e.target.checked)}/><Mic size={15}/> Microphone</label><label className="toggle-option"><input type="checkbox" checked={systemAudio} onChange={(e) => setSystemAudio(e.target.checked)}/> System audio</label><button className="button primary" disabled={busy} onClick={start}><span className="record-dot"/>{busy ? "Preparing…" : "Record screen"} <ArrowUpRight size={16}/></button></div>}
        </section>

        {message && <div className="notice" role="status"><Check size={16}/>{message}<button onClick={() => setMessage("")} aria-label="Dismiss"><X size={15}/></button></div>}

        <section className="library-section" id="library">
          <div className="section-heading"><div><div className="eyebrow">YOUR LIBRARY</div><h2>Recent recordings <span className="count-badge">{clips.length}</span></h2></div><div className="library-tools"><label className="search-box"><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a recording" aria-label="Search recordings"/></label><button className="button secondary import-button" onClick={() => fileRef.current?.click()}><Plus size={16}/> Import</button></div></div>
          {visibleClips.length ? <div className="clip-grid">{visibleClips.map((clip) => <article className="clip-card" key={clip.id}><div className="clip-thumb"><div className="thumb-lines"><span/><span/><span/></div><button className="thumb-play" onClick={() => download(clip.id)} aria-label={`Download ${clip.title}`}><ArrowDownToLine size={18}/></button><span className="duration">{clip.duration ? formatTime(clip.duration) : "Imported"}</span></div><div className="clip-info"><div><h3 title={clip.title}>{clip.title}</h3><p><Clock3 size={13}/>{formatDate(clip.createdAt)} <span>·</span> {formatBytes(clip.size)}</p></div><button className="icon-button" onClick={() => remove(clip.id)} aria-label={`Delete ${clip.title}`}><Trash2 size={16}/></button></div></article>)}</div> : <div className="empty-state"><div className="empty-icon"><Clapperboard size={25}/></div><h3>{query ? "No matching recordings" : "Your next great explanation starts here."}</h3><p>{query ? "Try a different search." : "Record your screen or import a video. Your library is private and stays on this device."}</p><div className="empty-actions"><button className="button primary" disabled={busy || recording} onClick={start}><Video size={16}/> Record your screen</button><button className="button secondary" onClick={() => fileRef.current?.click()}><Plus size={16}/> Import a video</button></div></div>}
        </section>

        <section className="bottom-note"><div className="note-icon"><Sparkles size={18}/></div><div><strong>A little more clarity goes a long way.</strong><p>ScreenNote is being rebuilt. Local recording and your private library are the first foundation; secure sharing and AI-powered knowledge tools are coming next.</p></div><span className="build-label"><Activity size={13}/> EARLY BUILD</span></section>
        <footer><span>© {new Date().getFullYear()} ScreenNote</span><span>Made for clear communication.</span><a href="/privacy">Privacy</a></footer>
      </div>
    </main>
    <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => importFile(e.target.files?.[0])}/>
  </div>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);