import React, { useEffect } from "react";
import { ArrowLeft, ArrowUpRight, Download, Scissors, Share2, X } from "lucide-react";
import type { Clip } from "./library";
type Props={clip:Clip;url:string;onClose:()=>void;onEdit:()=>void;onShare:()=>void;onDownload:()=>void;onDelete:()=>void};
export default function PreviewWorkspace({clip,url,onClose,onEdit,onShare,onDownload,onDelete}:Props){
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key)},[onClose]);
 return <section className="preview-workspace" role="dialog" aria-modal="true" aria-labelledby="preview-heading">
  <header><button onClick={onClose}><ArrowLeft size={16}/> Library</button><div><h2 id="preview-heading">{clip.title}</h2><p>{Math.floor(clip.duration/60)}:{String(Math.floor(clip.duration%60)).padStart(2,"0")} · {(clip.size/1048576).toFixed(1)} MB · Private on this device</p></div><button aria-label="Close preview" onClick={onClose}><X size={18}/></button></header>
  <div className="preview-workspace-content"><video src={url} controls playsInline preload="metadata"/><aside><span className="eyebrow">REVIEW BEFORE YOU SHARE</span><h3>Watch it through first.</h3><p>Your original remains private on this device. Make edits or add context before publishing a temporary copy.</p><button className="preview-primary" onClick={onEdit}><Scissors size={16}/> Open editor</button><button onClick={onShare}><Share2 size={16}/> Share temporarily</button><button onClick={onDownload}><Download size={16}/> Download original</button><button className="preview-delete" onClick={onDelete}>Delete recording</button></aside></div>
 </section>
}