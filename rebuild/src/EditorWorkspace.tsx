import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Camera, Check, Download, Eraser, Highlighter, LockKeyhole, MessageSquareText, Pause, Play, RectangleHorizontal, Scissors, Share2, Trash2, Type, Undo2, X } from "lucide-react";
import { saveClip, type Annotation, type BugReport, type CaptionCue, type Chapter, type Clip } from "./library";
import { clampTrimRange, trimVideoElement } from "./trim";
import { createVideoThumbnail } from "./media";
import { trimAnnotations, visibleAnnotations } from "./annotationTiming";
import { useDialogFocus } from "./useDialogFocus";
import { formatReproCapsuleSteps, parseReproCapsule } from "./reproCapsule";
// @ts-expect-error Shared browser-safe JavaScript enrichment module has no declaration file.
import { captionsVTT, parseCaptions, parseChapters, reportMarkdown, trimExtras, validateExtras } from "../legacy/lib/enrichment.js";

type Props = {
  clip: Clip;
  url: string;
  onClose: () => void;
  onUpdated: () => void;
  onShare: () => void;
  shareLabel?:string;
  onDownload: () => void;
  onDelete: () => void;
};
const stamp=(n:number)=>{const m=Math.floor(n/60),s=Math.floor(n%60);return m+":"+String(s).padStart(2,"0")};
const initialReport=():BugReport=>({url:"",steps:"",expected:"",actual:"",environment:""});
const kinds: {kind:Annotation["kind"];label:string;icon:React.ReactNode}[]=[
  {kind:"rectangle",label:"Box",icon:<RectangleHorizontal size={15}/>},
  {kind:"arrow",label:"Arrow",icon:<ArrowUpRight size={15}/>},
  {kind:"highlight",label:"Highlight",icon:<Highlighter size={15}/>},
  {kind:"blur",label:"Blur",icon:<Eraser size={15}/>},
  {kind:"redact",label:"Redact",icon:<LockKeyhole size={15}/>}
];
function paint(ctx:CanvasRenderingContext2D,w:number,h:number,items:Annotation[],scratch?:HTMLCanvasElement){
  for(const a of items){const x=a.x*w,y=a.y*h,bw=a.w*w,bh=a.h*h;ctx.save();ctx.lineWidth=Math.max(2,w/320);ctx.strokeStyle="#ff6b35";ctx.fillStyle="rgba(255,210,40,.34)";
    if(a.kind==="redact"){ctx.fillStyle="#161a17";ctx.fillRect(x,y,bw,bh)}
    else if(a.kind==="blur"){const source=scratch||ctx.canvas;if(scratch){scratch.width=w;scratch.height=h;const copy=scratch.getContext("2d");copy?.drawImage(ctx.canvas,0,0)}ctx.save();ctx.beginPath();ctx.rect(x,y,bw,bh);ctx.clip();ctx.filter=`blur(${Math.max(8,w*.012)}px)`;ctx.drawImage(source,0,0);ctx.restore();ctx.fillStyle="rgba(20,25,20,.12)";ctx.fillRect(x,y,bw,bh)}
    else if(a.kind==="highlight")ctx.fillRect(x,y,bw,bh);
    else if(a.kind==="arrow"){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+bw,y+bh);const angle=Math.atan2(bh,bw),s=Math.max(12,w*.018);ctx.moveTo(x+bw-s*Math.cos(angle-.5),y+bh-s*Math.sin(angle-.5));ctx.lineTo(x+bw,y+bh);ctx.lineTo(x+bw-s*Math.cos(angle+.5),y+bh-s*Math.sin(angle+.5));ctx.stroke()}
    else ctx.strokeRect(x,y,bw,bh);ctx.restore();
  }
}
function EditorWorkspace({clip,url,onClose,onUpdated,onShare,shareLabel,onDownload,onDelete}:Props){
  const video=useRef<HTMLVideoElement>(null),overlay=useRef<HTMLCanvasElement>(null),file=useRef<HTMLInputElement>(null),capsuleFile=useRef<HTMLInputElement>(null);
  const [title,setTitle]=useState(clip.title),[activeTool,setActiveTool]=useState<Annotation["kind"]>("rectangle"),[drawMode,setDrawMode]=useState(false);
  const [marks,setMarks]=useState<Annotation[]>(clip.annotations||[]),[drawing,setDrawing]=useState<Annotation|null>(null),[tab,setTab]=useState<"edit"|"context">("edit");
  const [start,setStart]=useState(0),[end,setEnd]=useState(clip.duration),[busy,setBusy]=useState(false),[status,setStatus]=useState("");
  const [captionsText,setCaptionsText]=useState(()=>clip.captions?.length?captionsVTT(clip.captions):"");
  const [savedCaptions,setSavedCaptions]=useState<CaptionCue[]>(clip.captions||[]);
  const [pendingSeek,setPendingSeek]=useState<number|null>(null);
  const [chaptersText,setChaptersText]=useState(()=>clip.chapters?.map(c=>stamp(c.time)+" "+c.title).join("\n")||"");
  const [report,setReport]=useState<BugReport>(clip.report||initialReport());
  const [reviewStatus,setReviewStatus]=useState<NonNullable<Clip["reviewStatus"]>>(clip.reviewStatus||"needs-feedback");
  const [captionSearch,setCaptionSearch]=useState("");
  const [currentTime,setCurrentTime]=useState(0);
  const [trimPreview,setTrimPreview]=useState(false);
  const [titleEditing,setTitleEditing]=useState(false);
  const [playing,setPlaying]=useState(false);
  const [exportProgress,setExportProgress]=useState(0);
  const [showReport,setShowReport]=useState(false);
  const canvasFrame=useRef<number>(0);
  const dialogRef=useRef<HTMLElement|null>(null);
  useDialogFocus(dialogRef,true,onClose);
  const visibleCues=useMemo(()=> savedCaptions.filter(c=>c.text.toLocaleLowerCase().includes(captionSearch.toLocaleLowerCase())),[savedCaptions,captionSearch]);

  useEffect(()=>{const el=video.current,canvas=overlay.current;if(!el||!canvas)return;
    const render=()=>{const rect=canvas.getBoundingClientRect();const dpr=Math.min(window.devicePixelRatio||1,2);const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}const ctx=canvas.getContext("2d");if(ctx){ctx.clearRect(0,0,w,h);paint(ctx,w,h,[...visibleAnnotations(marks,currentTime),...(drawing?[drawing]:[])]);}canvasFrame.current=requestAnimationFrame(render)};
    canvasFrame.current=requestAnimationFrame(render);return()=>cancelAnimationFrame(canvasFrame.current);
  },[marks,drawing,currentTime]);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"&&!(event.target instanceof HTMLElement&&/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))){event.preventDefault();setMarks(old=>old.slice(0,-1))}};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key)},[]);
  useEffect(()=>{const el=video.current;if(!el)return;const update=()=>setCurrentTime(el.currentTime);const play=()=>setPlaying(true),pause=()=>setPlaying(false);el.addEventListener("timeupdate",update);el.addEventListener("play",play);el.addEventListener("pause",pause);return()=>{el.removeEventListener("timeupdate",update);el.removeEventListener("play",play);el.removeEventListener("pause",pause)}},[]);
  useEffect(()=>{if(tab!=="edit"||pendingSeek===null||!video.current)return;video.current.currentTime=pendingSeek;void video.current.play().catch(()=>{});setPendingSeek(null)},[tab,pendingSeek]);
  async function importReproCapsule(file:File){
    if(file.size>256*1024){setStatus("Repro Capsules must be 256 KB or smaller.");return}
    try{
      const capsule=parseReproCapsule(JSON.parse(await file.text()));
      const environment=[capsule.page.userAgent,capsule.page.viewport.width+"×"+capsule.page.viewport.height+" viewport"].filter(Boolean).join("\n");
      setReport(old=>({...old,url:capsule.page.url,steps:formatReproCapsuleSteps(capsule),environment}));
      setStatus("Repro Capsule imported locally. Review the URL, steps and environment; remove anything sensitive before saving or publishing.");
    }catch(error){setStatus(error instanceof Error?error.message:"This Repro Capsule could not be imported.");}
    finally{if(capsuleFile.current)capsuleFile.current.value="";}
  }
  function seekEditor(seconds:number){if(video.current){video.current.currentTime=seconds;void video.current.play().catch(()=>{})}else{setPendingSeek(seconds);setTab("edit")}}
  function point(e:React.PointerEvent<HTMLCanvasElement>){const r=e.currentTarget.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}}
  function beginMark(e:React.PointerEvent<HTMLCanvasElement>){if(!drawMode||e.button!==0)return;const p=point(e);setDrawing({kind:activeTool,x:p.x,y:p.y,w:0,h:0,time:Math.max(0,currentTime),duration:Math.max(0.1,Math.min(4,Math.max(0,(clip.duration||currentTime)-currentTime)))});e.currentTarget.setPointerCapture(e.pointerId)}
  function moveMark(e:React.PointerEvent<HTMLCanvasElement>){if(!drawing)return;const p=point(e);setDrawing(d=>d?{...d,w:Math.abs(p.x-d.x),h:Math.abs(p.y-d.y),x:d.kind==="arrow"?d.x:Math.min(d.x,p.x),y:d.kind==="arrow"?d.y:Math.min(d.y,p.y)}:null)}
  function endMark(e:React.PointerEvent<HTMLCanvasElement>){if(!drawing)return;const p=point(e);const next={...drawing,w:Math.abs(p.x-drawing.x),h:Math.abs(p.y-drawing.y),x:drawing.kind==="arrow"?drawing.x:Math.min(drawing.x,p.x),y:drawing.kind==="arrow"?drawing.y:Math.min(drawing.y,p.y)};if(next.w>.004||next.h>.004){setMarks(old=>old.length<40?[...old,next]:old);setStatus("Annotation added. Save changes to keep it.")}setDrawing(null)}
  async function saveContext(){setBusy(true);setStatus("");try{const duration=clip.duration||video.current?.duration||0;const extras=validateExtras({captions:captionsText.trim()?parseCaptions(captionsText,duration):[],chapters:parseChapters(chaptersText,duration),report},duration);const next={...clip,title:title.trim()||"Untitled recording",annotations:marks,reviewStatus,...extras};await saveClip(next);setSavedCaptions(extras.captions);onUpdated();setStatus("Changes saved privately on this device.")}catch(e){setStatus(e instanceof Error?e.message:"Could not save your changes.")}finally{setBusy(false)}}
  async function saveTrim(){if(!video.current)return;setBusy(true);setStatus("Creating a trimmed copy…");try{const range=clampTrimRange(start,end,clip.duration);const blob=await trimVideoElement(video.current,range);const extras=trimExtras({captions:clip.captions||[],chapters:clip.chapters||[],report:clip.report||null},range.start,range.end);const next:Clip={...clip,...extras,id:crypto.randomUUID(),title:(title.trim()||clip.title)+" — trimmed",createdAt:Date.now(),duration:Math.ceil(range.duration),size:blob.size,mimeType:blob.type,blob,annotations:trimAnnotations(marks,range.start,range.end),thumbnail:await createVideoThumbnail(blob)};await saveClip(next);onUpdated();setStatus("Trimmed copy saved. The original is unchanged.")}catch(e){setStatus(e instanceof Error?e.message:"Trim failed. Your original is unchanged.")}finally{setBusy(false)}}
  async function captureAnnotatedFrame(){const source=video.current;if(!source||source.readyState<2||!source.videoWidth||!source.videoHeight){setStatus("Wait for a video frame to load, then capture it.");return}try{const width=Math.min(source.videoWidth,1920),height=Math.round(width*source.videoHeight/source.videoWidth);const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Frame capture is unavailable.");ctx.drawImage(source,0,0,width,height);paint(ctx,width,height,visibleAnnotations(marks,source.currentTime),document.createElement("canvas"));const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error("Could not encode this frame.")),"image/png"));const safe=(title||"screennote").replace(/[^a-z0-9-_]+/gi,"-").replace(/^-+|-+$/g,"").slice(0,60)||"screennote";const href=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=href;anchor.download=`${safe}-frame-${Math.round(source.currentTime*1000)}ms.png`;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(href),1000);setStatus("Annotated frame saved as PNG. Nothing was uploaded.")}catch(error){setStatus(error instanceof Error?error.message:"Could not capture this frame.")}}
  async function saveMarkedCopy(){
    const source=video.current;if(!source||!marks.length)return;
    setBusy(true);setExportProgress(0);setStatus("Preparing annotated copy…");
    const previousControls=source.controls,originalTime=source.currentTime,wasPaused=source.paused;
    let raf=0,stream:MediaStream|undefined,sourceCapture:MediaStream|undefined,recorder:MediaRecorder|undefined,recorderDone:Promise<Blob>|undefined,recorderStarted=false;
    let sourceFailed=false;
    const stopRecorder=()=>{if(recorder&&recorder.state!=="inactive"){try{recorder.stop()}catch{/* Recorder may already be stopping. */}}};
    const seekTo=(time:number)=>new Promise<void>((resolve,reject)=>{
      if(Math.abs(source.currentTime-time)<.02)return resolve();
      let timer=0;const cleanup=()=>{window.clearTimeout(timer);source.removeEventListener("seeked",done);source.removeEventListener("error",fail)};
      const done=()=>{cleanup();resolve()},fail=()=>{cleanup();reject(new Error("Could not seek the source video."))};
      source.addEventListener("seeked",done,{once:true});source.addEventListener("error",fail,{once:true});
      timer=window.setTimeout(()=>{cleanup();reject(new Error("Seeking timed out. The original video is unchanged."))},8000);
      try{source.currentTime=time}catch{cleanup();reject(new Error("Could not seek the source video."))}
    });
    let onEnded=()=>stopRecorder();
    const onSourceError=()=>{sourceFailed=true;stopRecorder()};
    try{
      source.controls=false;source.pause();
      const captureSource=source as HTMLVideoElement&{captureStream?:()=>MediaStream;mozCaptureStream?:()=>MediaStream};
      const capture=captureSource.captureStream||captureSource.mozCaptureStream;
      if(!capture)throw new Error("This browser cannot export an annotated video. Download the original and keep annotations in your local project.");
      sourceCapture=capture.call(source);
      if(Number.isFinite(originalTime)&&originalTime>.02)await seekTo(0);
      const width=Math.min(source.videoWidth||1280,1920),height=Math.round(width*(source.videoHeight||720)/(source.videoWidth||1280));
      const canvas=document.createElement("canvas"),scratch=document.createElement("canvas");canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext("2d");if(!ctx)throw Error("Video rendering is unavailable.");
      stream=canvas.captureStream(30);for(const track of sourceCapture.getAudioTracks())stream.addTrack(track);
      const mime=["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"].find(type=>MediaRecorder.isTypeSupported(type));
      recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);const chunks:Blob[]=[];
      recorderDone=new Promise<Blob>((resolve,reject)=>{
        recorder!.ondataavailable=event=>{if(event.data.size)chunks.push(event.data)};
        recorder!.onstop=()=>resolve(new Blob(chunks,{type:recorder!.mimeType||"video/webm"}));
        recorder!.onerror=()=>reject(new Error("Annotated export failed."));
      });
      recorder.start(250);recorderStarted=true;
      source.addEventListener("ended",onEnded,{once:true});
      source.addEventListener("error",onSourceError,{once:true});
      const draw=()=>{
        if(source.readyState>=2)ctx.drawImage(source,0,0,width,height);else{ctx.fillStyle="#111";ctx.fillRect(0,0,width,height)}
        paint(ctx,width,height,visibleAnnotations(marks,source.currentTime),scratch);
        setExportProgress(source.duration?Math.min(1,source.currentTime/source.duration):0);
        if(source.ended)stopRecorder();else raf=requestAnimationFrame(draw);
      };
      raf=requestAnimationFrame(draw);await source.play();
      const blob=await Promise.race([recorderDone,new Promise<Blob>((_,reject)=>window.setTimeout(()=>reject(new Error("The annotated export timed out. The original remains unchanged.")),45000))]);if(sourceFailed)throw new Error("The source video failed during export. No incomplete copy was saved.");if(!blob.size)throw new Error("The annotated export was empty.");
      const next:Clip={...clip,id:crypto.randomUUID(),title:(title.trim()||clip.title)+" — annotated",createdAt:Date.now(),size:blob.size,mimeType:blob.type,blob,annotations:marks,thumbnail:await createVideoThumbnail(blob)};
      await saveClip(next);onUpdated();setStatus("Annotated copy saved. The original remains unchanged.");
    }catch(error){setStatus(error instanceof Error?error.message:"Could not export annotations. The original remains unchanged.")}
    finally{
      cancelAnimationFrame(raf);source.removeEventListener("ended",onEnded);source.removeEventListener("error",onSourceError);stopRecorder();
      if(recorderStarted&&recorderDone)await Promise.race([recorderDone.then(()=>undefined,()=>undefined),new Promise<void>(resolve=>window.setTimeout(resolve,2500))]);
      stream?.getTracks().forEach(track=>track.stop());sourceCapture?.getTracks().forEach(track=>track.stop());
      source.controls=previousControls;source.pause();
      if(Number.isFinite(originalTime))await seekTo(Math.min(originalTime,Number.isFinite(source.duration)?source.duration:originalTime)).catch(()=>undefined);
      if(!wasPaused&&!source.ended)await source.play().catch(()=>undefined);else source.pause();
      setBusy(false);setExportProgress(0);
    }
  }
  function timestampSrt(seconds:number){const ms=Math.max(0,Math.round(seconds*1000)),hours=Math.floor(ms/3600000),minutes=Math.floor(ms%3600000/60000),secs=Math.floor(ms%60000/1000),millis=ms%1000;return `${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(secs).padStart(2,"0")},${String(millis).padStart(3,"0")}`}
  function downloadText(content:string,name:string,type:string){const a=document.createElement("a"),blob=new Blob([content],{type}),href=URL.createObjectURL(blob);a.href=href;a.download=name;a.click();window.setTimeout(()=>URL.revokeObjectURL(href),1000)}
  function exportCaptions(format:"srt"|"vtt"){try{const cues:CaptionCue[]=parseCaptions(captionsText,clip.duration);if(!cues.length)throw new Error("Add valid captions before exporting.");const content=format==="vtt"?captionsVTT(cues):cues.map((cue,i)=>`${i+1}\n${timestampSrt(cue.start)} --> ${timestampSrt(cue.end)}\n${cue.text}`).join("\n\n");downloadText(content,(title||"screennote")+`.${format}`,format==="vtt"?"text/vtt":"application/x-subrip")}catch(error){setStatus(error instanceof Error?error.message:"Could not export captions.")}}
  function exportChapters(){try{const chapters=parseChapters(chaptersText,clip.duration);if(!chapters.length)throw new Error("Add valid chapters before exporting.");downloadText(JSON.stringify(chapters,null,2),(title||"screennote")+"-chapters.json","application/json")}catch(error){setStatus(error instanceof Error?error.message:"Could not export chapters.")}}
  function downloadReport(){try{const markdown=reportMarkdown({...clip,title,report,chapters:parseChapters(chaptersText,clip.duration),shared:false},location.origin);downloadText(markdown,"screennote-bug-report.md","text/markdown")}catch(error){setStatus(error instanceof Error?error.message:"Could not export the report.")}}
  return <section ref={dialogRef} className="editor-workspace" role="dialog" aria-modal="true" aria-labelledby="editor-title">
    <header className="editor-topline"><button className="editor-back" onClick={onClose}><ArrowLeft size={17}/> Library</button><div className="editor-title-wrap">{titleEditing?<input aria-label="Video title" value={title} maxLength={100} onChange={e=>setTitle(e.target.value)} onBlur={()=>setTitleEditing(false)} onKeyDown={e=>{if(e.key==="Enter")setTitleEditing(false)}} autoFocus/>:<button className="editor-title-button" title={title||"Untitled recording"} onClick={()=>setTitleEditing(true)}>{title||"Untitled recording"} <Type size={14}/></button>}<span>{stamp(clip.duration)} · {(clip.size/1048576).toFixed(1)} MB · stored locally</span></div><button className="icon-button" aria-label="Close editor" onClick={onClose}><X size={19}/></button></header>
    <div className="editor-tabs"><button className={tab==="edit"?"active":""} onClick={()=>setTab("edit")}><Scissors size={15}/> Edit & annotate</button><button className={tab==="context"?"active":""} onClick={()=>setTab("context")}><MessageSquareText size={15}/> Captions & context</button></div>
    {tab==="edit"?<div className="editor-body"><div className="editor-stage"><div className="editor-video-wrap"><video ref={video} src={url} controls playsInline preload="metadata" onTimeUpdate={e=>setCurrentTime(e.currentTarget.currentTime)} onLoadedMetadata={e=>setEnd(e.currentTarget.duration||clip.duration)}/><canvas ref={overlay} className="annotation-overlay" style={{pointerEvents:drawMode?"auto":"none",cursor:drawMode?"crosshair":"default"}} aria-label="Annotation drawing surface" onPointerDown={beginMark} onPointerMove={moveMark} onPointerUp={endMark} onPointerCancel={()=>setDrawing(null)}/><svg className="editor-blur-overlay" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">{visibleAnnotations(marks,currentTime).filter(mark=>mark.kind==="blur").map((mark,i)=><rect key={i} className="editor-blur-preview" x={mark.x*1000} y={mark.y*1000} width={mark.w*1000} height={mark.h*1000}/>)}</svg></div><div className="editor-timeline"><span>{stamp(currentTime)}</span><input aria-label="Video timeline" type="range" min="0" max={clip.duration||1} step=".1" value={Math.min(currentTime,clip.duration||0)} onChange={e=>{if(video.current)video.current.currentTime=Number(e.target.value)}}/><span>{stamp(clip.duration)}</span></div><div className="editor-toolbar"><span className="toolbar-label">MARK UP</span><button className={drawMode?"selected":""} aria-pressed={drawMode} onClick={()=>setDrawMode(!drawMode)}><Highlighter size={15}/>{drawMode?"Drawing on":"Draw mode"}</button>{kinds.map(k=><button key={k.kind} className={activeTool===k.kind?"selected":""} aria-pressed={activeTool===k.kind&&drawMode} onClick={()=>{setActiveTool(k.kind);setDrawMode(true)}}>{k.icon}{k.label}</button>)}<button onClick={()=>setMarks(old=>old.slice(0,-1))} disabled={!marks.length}><Undo2 size={15}/> Undo</button><button onClick={()=>setMarks([])} disabled={!marks.length}><Eraser size={15}/> Clear</button><button onClick={captureAnnotatedFrame} disabled={busy}><Camera size={15}/> Capture annotated frame</button></div><p className="editor-hint">Draw at the current playhead. New marks appear for up to 4 seconds, then disappear; older untimed marks remain throughout. Redaction is opaque.</p></div><aside className="editor-side"><section className="editor-card"><div className="eyebrow">TRIM A COPY</div><h3>Keep the useful part.</h3><p>The original is never overwritten. Choose a range and save a separate clip.</p><label>Start · seconds<input type="number" min="0" max={clip.duration} step=".1" value={start} onChange={e=>setStart(Number(e.target.value))}/></label><label>End · seconds<input type="number" min="0" max={clip.duration} step=".1" value={end} onChange={e=>setEnd(Number(e.target.value))}/></label><button className="editor-primary" disabled={busy} onClick={saveTrim}><Scissors size={15}/> Save trimmed copy</button></section><section className="editor-card"><div className="eyebrow">ANNOTATIONS</div><h3>{marks.length} marks on this video</h3><p>Marks are saved with their timestamps. Jump back to any mark or remove it individually.</p>{marks.length>0&&<div className="annotation-list" aria-label="Annotation list">{marks.map((mark,index)=><div className="annotation-row" key={index}><button aria-label={`Jump to ${mark.kind} mark ${index+1}`} onClick={()=>{if(video.current)video.current.currentTime=typeof mark.time==="number"?mark.time:0;setDrawMode(false)}}><span>{mark.kind}</span><time>{typeof mark.time==="number"?stamp(mark.time):"Full clip"}</time></button><button aria-label={`Delete mark ${index+1}`} onClick={()=>setMarks(old=>old.filter((_,i)=>i!==index))}><Trash2 size={14}/></button></div>)}</div>}<button className="editor-primary" disabled={busy||!marks.length} onClick={saveMarkedCopy}><Download size={15}/> Export annotated copy</button>{busy&&exportProgress>0&&<progress max="1" value={exportProgress}/>}</section><section className="editor-card editor-actions-card"><button onClick={saveContext} disabled={busy}><Check size={15}/> Save all changes</button><button onClick={onShare}><Share2 size={15}/> {shareLabel||"Share a reviewed copy"}</button><button onClick={onDownload}><ArrowDownToLine size={15}/> Download original</button><button className="danger" onClick={onDelete}><Trash2 size={15}/> Delete recording</button></section></aside></div>:<div className="context-editor"><section className="editor-card"><div className="eyebrow">OWNER-SUPPLIED CAPTIONS</div><h3>Make every moment understandable.</h3><p>Import an SRT or WebVTT file, or paste caption text. Automatic transcription is not enabled.</p><input ref={file} type="file" accept=".srt,.vtt,text/vtt,text/plain" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>20000){setStatus("Caption files must be 20 KB or smaller.");return}try{const raw=await f.text();parseCaptions(raw,clip.duration);setCaptionsText(raw);setStatus("Captions loaded. Save changes to apply them.")}catch(err){setStatus(err instanceof Error?err.message:"Invalid captions.")}finally{e.currentTarget.value=""}}}/><textarea rows={8} maxLength={20000} value={captionsText} onChange={e=>setCaptionsText(e.target.value)} placeholder={"WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nThe first step…"}/><div className="editor-inline-actions"><button onClick={()=>exportCaptions("vtt")} disabled={!captionsText.trim()}>Export WebVTT</button><button onClick={()=>exportCaptions("srt")} disabled={!captionsText.trim()}>Export SRT</button></div><div className="caption-search"><input value={captionSearch} onChange={e=>setCaptionSearch(e.target.value)} placeholder="Search saved transcript"/><span>{visibleCues.length} matches</span></div><div className="caption-results">{visibleCues.map((cue,i)=><button key={i} onClick={()=>seekEditor(cue.start)}><span>{stamp(cue.start)}</span>{cue.text}</button>)}</div></section><section className="editor-card"><div className="eyebrow">CHAPTERS</div><h3>Give longer videos a structure.</h3><p>One timestamp and title per line, for example 0:30 Checkout.</p><textarea rows={5} value={chaptersText} onChange={e=>setChaptersText(e.target.value)} placeholder={"0:00 Introduction\n0:30 The problem\n1:20 The fix"}/><div className="editor-inline-actions"><button onClick={exportChapters} disabled={!chaptersText.trim()}>Export chapters JSON</button></div></section><section className="editor-card"><div className="eyebrow">REVIEW STATUS</div><h3>Where does this review stand?</h3><p>Keep the handoff clear for everyone who opens the shared video.</p><select value={reviewStatus} onChange={e=>setReviewStatus(e.target.value as NonNullable<Clip["reviewStatus"]>)}><option value="needs-feedback">Needs feedback</option><option value="changes-requested">Changes requested</option><option value="approved">Approved</option></select></section><section className="editor-card"><div className="eyebrow">BUG REPORT</div><h3>Turn a recording into a useful handoff.</h3><p>Only details you choose to save are shared. An imported Repro Capsule contains a sanitized page URL (query and fragment removed), viewport/browser details and a click/key outline—not typed values, cookies, network logs or page body. Review and redact it before publishing. Saved context is visible to anyone with the video link.</p><label>Page URL<input value={report.url} onChange={e=>setReport(v=>({...v,url:e.target.value}))} placeholder="https://example.com/page"/></label><label>Reproduction steps<textarea rows={3} value={report.steps} onChange={e=>setReport(v=>({...v,steps:e.target.value}))}/></label><label>Expected result<textarea rows={2} value={report.expected} onChange={e=>setReport(v=>({...v,expected:e.target.value}))}/></label><label>Actual result<textarea rows={2} value={report.actual} onChange={e=>setReport(v=>({...v,actual:e.target.value}))}/></label><label>Environment (optional)<input value={report.environment} onChange={e=>setReport(v=>({...v,environment:e.target.value}))}/></label><input ref={capsuleFile} type="file" accept=".json,application/json" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void importReproCapsule(f)}}/><div className="editor-inline-actions"><button onClick={()=>capsuleFile.current?.click()}>Import Repro Capsule</button><button onClick={downloadReport}>Download report</button><button onClick={saveContext} disabled={busy}>Save context</button></div></section><section className="editor-card"><h3>Playback context</h3><p>Saved captions, chapters, annotations, review status and bug-report context are included with the shared copy.</p><button onClick={()=>setTab("edit")}><ArrowLeft size={15}/> Back to editing</button></section></div>}
    {status&&<div className="editor-status" role="status">{status}</div>}
  </section>
}
export default EditorWorkspace;
