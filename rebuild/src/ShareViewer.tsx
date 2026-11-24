import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Check, Clock3, LockKeyhole, MessageCircle, Send, ShieldCheck, Video } from "lucide-react";
import { findShareByToken } from "./library";
import { shareRequest } from "./sharing";
import "./styles.css";

type Comment = { id:string; parentId:string|null; viewerLabel:string; body:string; time:number; createdAt:number; resolved:number; deletedAt:number|null };
type Share = { title:string; mimeType:string; size:number; duration:number; expiresAt:number; passwordRequired:boolean };
function identity(token:string) {
  const key = "screennote-author-" + token;
  let value = localStorage.getItem(key);
  if (!value) { const bytes=crypto.getRandomValues(new Uint8Array(32)); value=btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); localStorage.setItem(key,value); }
  return value;
}
const timeLabel=(n:number)=>{const m=Math.floor(n/60),s=Math.floor(n%60);return m+":"+String(s).padStart(2,"0");};
const dateLabel=(n:number)=>new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(n*1000);
function ShareViewer({token}:{token:string}) {
  const [share,setShare]=useState<Share|null>(null),[comments,setComments]=useState<Comment[]>([]),[password,setPassword]=useState(""),[locked,setLocked]=useState(false),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  const [text,setText]=useState(""),[replyTo,setReplyTo]=useState<string|null>(null),[time,setTime]=useState(0),[ownerKey,setOwnerKey]=useState<string|null>(null);
  const video=useRef<HTMLVideoElement>(null);
  const authorKey=useMemo(()=>identity(token),[token]);
  async function load() {
    setLoading(true);setError("");
    try {
      const data=await shareRequest<Share>(token);setShare(data);setLocked(false);
      const discussion=await shareRequest<{comments:Comment[]}>(token,"/comments");setComments(discussion.comments);
      const local=await findShareByToken(token);setOwnerKey(local?.share?.ownerKey??null);
    } catch(e) {
      if ((e as {status?:number}).status===401) setLocked(true);
      else setError(e instanceof Error?e.message:"This ScreenNote is unavailable.");
    } finally {setLoading(false);}
  }
  useEffect(()=>{void load();},[token]);
  async function unlock(event:React.FormEvent) {
    event.preventDefault();setError("");
    try {await shareRequest(token,"/access",{method:"POST",body:JSON.stringify({password})});await load();}
    catch(e){setError(e instanceof Error?e.message:"That password didn't work.");}
  }
  function seek(seconds:number) { if(video.current){video.current.currentTime=seconds;void video.current.play();setTime(seconds);} }
  async function send(event:React.FormEvent) {
    event.preventDefault();if(!text.trim())return;
    try {
      await shareRequest(token,"/comments",{method:"POST",body:JSON.stringify({authorKey,text:text.trim(),time:Math.floor(video.current?.currentTime??time),parentId:replyTo,viewerLabel:"Guest"})});
      setText("");setReplyTo(null);const next=await shareRequest<{comments:Comment[]}>(token,"/comments");setComments(next.comments);
    } catch(e){setError(e instanceof Error?e.message:"Couldn't post your comment.");}
  }
  async function resolve(id:string,value:boolean) {
    if(!ownerKey)return;
    try {await shareRequest(token,"/comments/"+id+"/resolve",{method:"PATCH",body:JSON.stringify({ownerKey,resolved:value})});setComments(old=>old.map(c=>c.id===id?{...c,resolved:value?1:0}:c));}
    catch(e){setError(e instanceof Error?e.message:"Couldn't update this thread.");}
  }
  function thread(items:Comment[],parent:string|null=null,depth=0):React.ReactNode {
    return items.filter(c=>c.parentId===parent).map(c=><article className={"share-comment "+(depth?"reply":"")} key={c.id}>
      <div className="share-comment-meta"><strong>{c.viewerLabel||"Guest"}</strong><button className="timestamp-link" onClick={()=>seek(c.time)}>{timeLabel(c.time)}</button><span>{dateLabel(c.createdAt)}</span></div>
      <p>{c.deletedAt?"This comment was removed.":c.body}</p>
      {!c.deletedAt&&<button className="text-action" onClick={()=>{setReplyTo(c.id);seek(c.time);}}>Reply</button>}
      {depth===0&&ownerKey&&!c.deletedAt&&<button className="text-action" onClick={()=>resolve(c.id,!c.resolved)}>{c.resolved?"Reopen":"Resolve"}</button>}
      {c.resolved===1&&<span className="resolved-tag"><Check size={12}/> Resolved</span>}
      {thread(items,c.id,depth+1)}
    </article>);
  }
  const activeBubbles=comments.filter(c=>!c.parentId&&!c.deletedAt&&!c.resolved&&Math.abs(c.time-time)<4);
  if(loading)return <main className="share-page"><div className="share-loading">Opening your ScreenNote…</div></main>;
  if(locked)return <main className="share-page"><form className="password-gate" onSubmit={unlock}><div className="share-brand"><span className="brand-mark"><Video size={17}/></span> screen<span>note</span></div><div className="share-lock"><LockKeyhole size={22}/></div><h1>This ScreenNote is private.</h1><p>Enter the password shared with you to watch and join the conversation.</p><label>Password<input type="password" autoFocus value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter sharing password"/></label><button className="button primary" type="submit">Unlock video <LockKeyhole size={15}/></button>{error&&<p className="share-error">{error}</p>}</form></main>;
  if(error&&!share)return <main className="share-page"><div className="share-ended"><ShieldCheck size={25}/><h1>This moment has ended.</h1><p>{error}</p><span>ScreenNote links are temporary by design.</span></div></main>;
  if(!share)return null;
  return <main className="share-page">
    <header className="share-topbar"><div className="share-brand"><span className="brand-mark"><Video size={17}/></span> screen<span>note</span></div><span className="temporary-label"><Clock3 size={14}/> Temporary share</span></header>
    <div className="share-layout"><section className="share-main"><div className="share-heading"><span className="eyebrow">A MOMENT, SHARED</span><h1>{share.title}</h1><p>Watch the clip. Leave a note at the exact moment that matters.</p></div>
      <div className="share-video-wrap"><video ref={video} src={"/api/share/"+token+"/media"} controls playsInline preload="metadata" onTimeUpdate={e=>setTime(e.currentTarget.currentTime)}/>{activeBubbles.map((c,i)=><button key={c.id} className="playback-bubble" style={{bottom:(20+Math.min(3,i)*52)+"px"}} onClick={()=>seek(c.time)}><MessageCircle size={14}/>{c.body.slice(0,90)}</button>)}</div>
      <div className="share-video-meta"><span>{timeLabel(share.duration)} · {Math.ceil(share.size/1024/1024)} MB</span><span>Available until {new Date(share.expiresAt*1000).toLocaleString()}</span></div>
      <form className="share-comment-form" onSubmit={send}><div className="comment-composer-title">{replyTo?"Reply to this moment":"Add a timestamped note"} <span>at {timeLabel(Math.floor(video.current?.currentTime??time))}</span></div><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="What should the team notice here?" rows={3}/><div className="comment-composer-actions">{replyTo&&<button type="button" className="text-action" onClick={()=>setReplyTo(null)}>Cancel reply</button>}<button className="button primary" type="submit" disabled={!text.trim()}><Send size={15}/> Post comment</button></div></form>
      {error&&<p className="share-error">{error}</p>}
    </section><aside className="share-discussion"><div className="discussion-title"><div><span className="eyebrow">THE CONVERSATION</span><h2>{comments.filter(c=>!c.deletedAt).length} comments</h2></div><span className="discussion-mark"><MessageCircle size={17}/></span></div><div className="discussion-list">{comments.length?thread(comments):<div className="discussion-empty"><MessageCircle size={22}/><strong>No comments yet.</strong><p>Start the conversation at the moment that matters.</p></div>}</div></aside></div>
    <footer className="share-footer"><span><ShieldCheck size={14}/> No account required to watch.</span><span>This link ends automatically.</span></footer>
  </main>;
}
export default ShareViewer;
