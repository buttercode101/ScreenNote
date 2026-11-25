import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Check, Clock3, Heart, Lightbulb, LockKeyhole, MessageCircle, Send, ShieldCheck, Sparkles, Video } from "lucide-react";
import { findShareByToken, type Annotation } from "./library";
import { visibleAnnotations } from "./annotationTiming";
import { newOwnerKey, shareRequest } from "./sharing";
// @ts-expect-error Shared browser-safe enrichment module has no declaration file.
import { captionsVTT } from "../legacy/lib/enrichment.js";
import "./styles.css";

type Comment = { isMine?:boolean; anchorX:number|null; anchorY:number|null; id:string; parentId:string|null; viewerLabel:string; body:string; time:number; createdAt:number; resolved:number; deletedAt:number|null };
type Share = { title:string; mimeType:string; size:number; duration:number; expiresAt:number; passwordRequired:boolean };
type ReviewDecision = "approved" | "changes-requested" | "question";
type GuestReview = { reviewerLabel:string; decision:ReviewDecision; comment:string; time:number; createdAt:number; updatedAt:number };
type ShareDetails = { reviewBrief?:{purpose?:string;focus?:string;expectedOutcome?:string;requestedAction?:"review"|"approve"|"reproduce"|"fix"}|null; annotations?:Annotation[]; captions?:{start:number;end:number;text:string}[]; chapters?:{time:number;title:string}[]; report?:{url:string;steps:string;expected:string;actual:string;environment:string}|null; reviewStatus?:"needs-feedback"|"changes-requested"|"approved" };
const memoryIdentities = new Map<string,string>();
function storedIdentity(key:string,create:()=>string) {
  try { let value=localStorage.getItem(key);if(!value){value=create();localStorage.setItem(key,value)}return value; }
  catch { let value=memoryIdentities.get(key);if(!value){value=create();memoryIdentities.set(key,value)}return value; }
}
function voterIdentity(token:string) { return storedIdentity("screennote-voter-"+token,newOwnerKey); }
function reviewerIdentity(token:string) { return storedIdentity("screennote-reviewer-"+token,newOwnerKey); }
const reviewDecisionLabel=(decision:ReviewDecision)=>decision==="approved"?"Looks good":decision==="changes-requested"?"Needs changes":"Question";
function identity(token:string) {
  return storedIdentity("screennote-author-"+token,()=>{const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")});
}
const timeLabel=(n:number)=>{const m=Math.floor(n/60),s=Math.floor(n%60);return m+":"+String(s).padStart(2,"0");};
const dateLabel=(n:number)=>new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(n*1000);
function ShareViewer({token}:{token:string}) {
  const [share,setShare]=useState<Share|null>(null),[comments,setComments]=useState<Comment[]>([]),[password,setPassword]=useState(""),[locked,setLocked]=useState(false),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  const [text,setText]=useState(""),[replyTo,setReplyTo]=useState<string|null>(null),[time,setTime]=useState(0),[ownerKey,setOwnerKey]=useState<string|null>(null),[annotateMode,setAnnotateMode]=useState(false),[annotation,setAnnotation]=useState<{x:number;y:number}|null>(null),[details,setDetails]=useState<ShareDetails>({}),[transcriptQuery,setTranscriptQuery]=useState("");
  const [captionUrl,setCaptionUrl]=useState<string|null>(null);
  const [reactions,setReactions]=useState({like:0,thanks:0,idea:0});
  const [myReaction,setMyReaction]=useState("");
  const [reviews,setReviews]=useState<GuestReview[]>([]),[myReview,setMyReview]=useState<GuestReview|null>(null),[reviewDecision,setReviewDecision]=useState<ReviewDecision>("question"),[reviewComment,setReviewComment]=useState(""),[reviewLabel,setReviewLabel]=useState(""),[reviewBusy,setReviewBusy]=useState(false),[reviewMessage,setReviewMessage]=useState("");
  const video=useRef<HTMLVideoElement>(null);
  const authorKey=useMemo(()=>identity(token),[token]);
  async function load() {
    setLoading(true);setError("");
    try {
      const data=await shareRequest<Share>(token);setShare(data);setLocked(false);
      const discussion=await shareRequest<{comments:Comment[]}>(token,"/comments",{headers:{"x-sn-author-key":authorKey}});setComments(discussion.comments);
      const context=await shareRequest<{details:ShareDetails}>(token,"/details");setDetails(context.details||{});
      const votes=await shareRequest<{counts:{like:number;thanks:number;idea:number};myReaction:string}>(token,"/reactions",{headers:{"x-voter-key":voterIdentity(token)}});setReactions(votes.counts);setMyReaction(votes.myReaction);
      const reviewData=await shareRequest<{reviews:GuestReview[];myReview:GuestReview|null}>(token,"/reviews",{headers:{"x-reviewer-key":reviewerIdentity(token)}});setReviews(reviewData.reviews||[]);setMyReview(reviewData.myReview||null);setReviewDecision(reviewData.myReview?.decision||"question");setReviewComment(reviewData.myReview?.comment||"");setReviewLabel(reviewData.myReview?.reviewerLabel==="Guest"?"":reviewData.myReview?.reviewerLabel||"");
      const local=await findShareByToken(token);setOwnerKey(local?.share?.ownerKey??localStorage.getItem("screennote-recovery-"+token));
    } catch(e) {
      if ((e as {status?:number}).status===401) setLocked(true);
      else setError(e instanceof Error?e.message:"This ScreenNote is unavailable.");
    } finally {setLoading(false);}
  }
  useEffect(()=>{void load();},[token]);
  useEffect(()=>{if(!details.captions?.length){setCaptionUrl(null);return}const url=URL.createObjectURL(new Blob([captionsVTT(details.captions)],{type:"text/vtt"}));setCaptionUrl(url);return()=>URL.revokeObjectURL(url)},[details.captions]);
  async function unlock(event:React.FormEvent) {
    event.preventDefault();setError("");
    try {await shareRequest(token,"/access",{method:"POST",body:JSON.stringify({password})});await load();}
    catch(e){setError(e instanceof Error?e.message:"That password didn't work.");}
  }
  function seek(seconds:number) { if(video.current){video.current.currentTime=seconds;void video.current.play();setTime(seconds);} }
  function placeAnnotation(event:React.MouseEvent<HTMLDivElement>) {
    if(!annotateMode)return;
    const rect=event.currentTarget.getBoundingClientRect();
    setAnnotation({x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))});
  }
  async function react(reaction:"like"|"thanks"|"idea"|""){
    try{const result=await shareRequest<{counts:{like:number;thanks:number;idea:number};myReaction:string}>(token,"/reactions",{method:"POST",body:JSON.stringify({voterKey:voterIdentity(token),reaction})});setReactions(result.counts);setMyReaction(result.myReaction)}
    catch(e){setError(e instanceof Error?e.message:"Could not save your reaction.")}
  }
  function downloadReviewPacket() {
    if(!ownerKey||!share)return;
    const lines=["# ScreenNote review packet","",`**Recording:** ${share.title}`,`**Review status:** ${details.reviewStatus||"needs-feedback"}`,`**Shared link:** ${window.location.href}`,`**Duration:** ${timeLabel(share.duration)}`,`**Link expiry:** ${dateLabel(share.expiresAt)}`,""];
    if(details.reviewBrief){
      lines.push("## Review brief","");
      if(details.reviewBrief.purpose)lines.push("**Purpose:** "+details.reviewBrief.purpose);
      if(details.reviewBrief.focus)lines.push("**Focus areas:** "+details.reviewBrief.focus);
      if(details.reviewBrief.expectedOutcome)lines.push("**Expected outcome:** "+details.reviewBrief.expectedOutcome);
      if(details.reviewBrief.requestedAction)lines.push("**Requested action:** "+details.reviewBrief.requestedAction);
      lines.push("");
    }
    lines.push("## Guest decisions","");
    if(reviews.length)for(const review of reviews)lines.push(`### ${review.reviewerLabel} — ${reviewDecisionLabel(review.decision)}`,`**At:** ${timeLabel(review.time)} · ${dateLabel(review.updatedAt)}`,review.comment||"_No note provided._","");
    else lines.push("_No guest decisions yet._","");
    const visibleComments=comments.filter(comment=>!comment.deletedAt);
    lines.push("## Timestamped discussion","");
    if(visibleComments.length)for(const comment of visibleComments)lines.push(`### ${timeLabel(comment.time)} — ${comment.viewerLabel}`,comment.parentId?"**Reply**":"**Comment**",comment.body,comment.resolved?"_Thread resolved._":"_Thread open._","");
    else lines.push("_No comments yet._","");
    if(details.report){lines.push("## Bug report","",`**Page:** ${details.report.url||"Not supplied"}`,`**Steps:** ${details.report.steps}`,`**Expected:** ${details.report.expected}`,`**Actual:** ${details.report.actual}`,`**Environment:** ${details.report.environment}`,"");}
    if(details.chapters?.length){lines.push("## Chapters","");for(const chapter of details.chapters)lines.push(`- ${timeLabel(chapter.time)} — ${chapter.title}`);lines.push("");}
    if(details.captions?.length){lines.push("## Captions","");for(const caption of details.captions)lines.push(`- ${timeLabel(caption.start)}–${timeLabel(caption.end)}: ${caption.text}`);lines.push("");}
    lines.push("---","_Exported from ScreenNote. Guest names are self-entered and not verified._");
    const blob=new Blob([lines.join("\n")],{type:"text/markdown;charset=utf-8"}),url=URL.createObjectURL(blob),anchor=document.createElement("a");
    anchor.href=url;anchor.download="screennote-review-packet.md";anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1500);
    setReviewMessage("Review packet downloaded.");
  }
  async function updateReviewStatus(status:"needs-feedback"|"changes-requested"|"approved") {
    if(!ownerKey)return;
    setReviewBusy(true);setReviewMessage("");
    const next={...details,reviewStatus:status};
    try {
      await shareRequest(token,"/details",{method:"PUT",body:JSON.stringify({ownerKey,details:next})});
      setDetails(next);
      setReviewMessage(status==="approved"?"Review marked complete.":status==="changes-requested"?"Review marked as changes requested.":"Review reopened.");
    } catch(e){setError(e instanceof Error?e.message:"Couldn't update review status.");}
    finally{setReviewBusy(false);}
  }
  async function submitReview(event:React.FormEvent) {
    event.preventDefault();
    if(reviewDecision!=="approved"&&!reviewComment.trim())return;
    setReviewBusy(true);setReviewMessage("");
    try {
      await shareRequest(token,"/reviews",{method:"POST",body:JSON.stringify({reviewerKey:reviewerIdentity(token),reviewerLabel:reviewLabel.trim(),decision:reviewDecision,comment:reviewComment.trim(),time:Math.floor(video.current?.currentTime??time)})});
      const next=await shareRequest<{reviews:GuestReview[];myReview:GuestReview|null}>(token,"/reviews",{headers:{"x-reviewer-key":reviewerIdentity(token)}});
      setReviews(next.reviews||[]);setMyReview(next.myReview||null);setReviewMessage("Your review decision has been saved.");
    } catch(e){setError(e instanceof Error?e.message:"Couldn't save your review decision.");}
    finally{setReviewBusy(false);}
  }
  async function send(event:React.FormEvent) {
    event.preventDefault();if(!text.trim())return;
    try {
      await shareRequest(token,"/comments",{method:"POST",body:JSON.stringify({authorKey,text:text.trim(),time:Math.floor(video.current?.currentTime??time),parentId:replyTo,viewerLabel:"Guest",anchorX:annotation?.x,anchorY:annotation?.y})});
      setText("");setReplyTo(null);setAnnotation(null);setAnnotateMode(false);const next=await shareRequest<{comments:Comment[]}>(token,"/comments",{headers:{"x-sn-author-key":authorKey}});setComments(next.comments);
    } catch(e){setError(e instanceof Error?e.message:"Couldn't post your comment.");}
  }
  async function editComment(comment:Comment) {
    const value=window.prompt("Edit your comment",comment.body);
    if(value===null||!value.trim())return;
    try { await shareRequest(token,"/comments/"+comment.id,{method:"PATCH",body:JSON.stringify({authorKey,text:value.trim()})}); const next=await shareRequest<{comments:Comment[]}>(token,"/comments",{headers:{"x-sn-author-key":authorKey}});setComments(next.comments); }
    catch(e){setError(e instanceof Error?e.message:"Couldn't edit this comment.");}
  }
  async function deleteComment(comment:Comment) {
    if(!window.confirm("Delete this comment? Replies will remain in the thread."))return;
    try { await shareRequest(token,"/comments/"+comment.id,{method:"DELETE",body:JSON.stringify({authorKey})}); const next=await shareRequest<{comments:Comment[]}>(token,"/comments",{headers:{"x-sn-author-key":authorKey}});setComments(next.comments); }
    catch(e){setError(e instanceof Error?e.message:"Couldn't delete this comment.");}
  }
  function buildThread(parentId:string|null):unknown[] {
    return comments.filter(comment=>comment.parentId===parentId).map(comment=>({
      id:comment.id, author:comment.viewerLabel, text:comment.body,
      timestampSeconds:comment.time, timestampLabel:timeLabel(comment.time),
      resolved:!!comment.resolved, deleted:!!comment.deletedAt,
      replies:buildThread(comment.id)
    }));
  }
  function exportHandoff() {
    if (!share) return;
    const payload = {
      schema: "screennote.agent-handoff",
      version: 1,
      product: "ScreenNote",
      title: share.title,
      media: { mimeType: share.mimeType, sizeBytes: share.size, durationSeconds: share.duration, downloadPath: "/api/share/" + token + "/media" },
      share: { expiresAt: new Date(share.expiresAt * 1000).toISOString(), passwordProtected: share.passwordRequired },
      discussion: buildThread(null),
      reviewStatus: details.reviewStatus || "needs-feedback",
      reviewBrief: details.reviewBrief || null,
      videoAnnotations: details.annotations || [],
      captions: details.captions || [],
      chapters: details.chapters || [],
      bugReport: details.report || null,
      keyframes: [],
      annotations: comments.filter(comment => comment.anchorX !== null && comment.anchorX !== undefined).map(comment => ({ commentId: comment.id, timestampSeconds: comment.time, x: comment.anchorX, y: comment.anchorY, text: comment.body })),
      exportedAt: new Date().toISOString(),
      instructions: "Use the timestamped discussion to inspect the corresponding moment in the accompanying video. Treat comments as review context, not verified facts."
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "screennote-agent-handoff.json"; anchor.click(); URL.revokeObjectURL(url);
  }
  function downloadVideo() {
    const anchor = document.createElement("a"); anchor.href = "/api/share/" + token + "/media"; const extension = share?.mimeType === "video/mp4" ? "mp4" : share?.mimeType === "video/quicktime" ? "mov" : "webm"; anchor.download = (share?.title || "screennote").replace(/[^a-z0-9-_ ]/gi, "").trim() + "." + extension; anchor.click();
  }
  async function stopShare() {
    if(!ownerKey||!window.confirm("Stop sharing now? The shared video and its entire conversation will be deleted."))return;
    try { await shareRequest(token,"/manage",{method:"DELETE",body:JSON.stringify({ownerKey})}); setShare(null); setComments([]); setError("You stopped sharing. The shared video and conversation have ended."); }
    catch(e){setError(e instanceof Error?e.message:"Couldn't stop sharing.");}
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
      {!c.deletedAt&&<button className="text-action" onClick={()=>{setReplyTo(c.id);seek(c.time);}}>Reply</button>}{c.isMine&&!c.deletedAt&&<><button className="text-action" onClick={()=>editComment(c)}>Edit</button><button className="text-action" onClick={()=>deleteComment(c)}>Delete</button></>}
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
    <header className="share-topbar"><div className="share-brand"><span className="brand-mark"><Video size={17}/></span> screen<span>note</span></div><span className="temporary-label"><Clock3 size={14}/> Temporary share</span><div className="share-header-actions"><button className="text-action" onClick={exportHandoff}>Export handoff</button><button className="text-action" onClick={downloadVideo}>Download video</button>{ownerKey&&<button className="text-action" onClick={stopShare}>Stop sharing</button>}</div></header>
    <div className="share-layout"><section className="share-main"><div className="share-heading"><span className="eyebrow">A MOMENT, SHARED</span>{details.reviewStatus&&<span className={"shared-review-status "+details.reviewStatus}>{details.reviewStatus==="approved"?"Approved":details.reviewStatus==="changes-requested"?"Changes requested":"Needs feedback"}</span>}<h1>{share.title}</h1><p>Watch the clip. Leave a note at the exact moment that matters.</p></div>
      {details.reviewBrief&&(details.reviewBrief.purpose||details.reviewBrief.focus||details.reviewBrief.expectedOutcome)&&<section className="share-review-brief" aria-label="Review brief"><span className="eyebrow">REVIEW BRIEF</span>{details.reviewBrief.purpose&&<h2>{details.reviewBrief.purpose}</h2>}{details.reviewBrief.focus&&<p><strong>Focus:</strong> {details.reviewBrief.focus}</p>}{details.reviewBrief.expectedOutcome&&<p><strong>Expected outcome:</strong> {details.reviewBrief.expectedOutcome}</p>}<span className="brief-action">Requested: {({review:"Review and give feedback",approve:"Approve",reproduce:"Reproduce this issue",fix:"Help fix this"} as const)[details.reviewBrief.requestedAction||"review"]}</span></section>}
      <div className={"share-video-wrap "+(annotateMode?"annotate-mode":"")} onClick={placeAnnotation}><video ref={video} src={"/api/share/"+token+"/media"} controls playsInline preload="metadata" onTimeUpdate={e=>setTime(e.currentTarget.currentTime)}>{captionUrl&&<track kind="captions" src={captionUrl} srcLang="en" label="Owner captions" default/>}</video>{!!details.annotations?.length&&<svg className="shared-annotation-overlay" viewBox="0 0 1000 562" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="sn-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#ff6b35"/></marker></defs>{visibleAnnotations(details.annotations,time).map((mark,i)=>{const x=mark.x*1000,y=mark.y*562,w=mark.w*1000,h=mark.h*562;if(mark.kind==="arrow")return <line key={i} x1={x} y1={y} x2={x+w} y2={y+h} stroke="#ff6b35" strokeWidth="5" markerEnd="url(#sn-arrowhead)"/>;return <rect key={i} x={x} y={y} width={w} height={h} className={"shared-mark "+mark.kind}/>})}</svg>}{comments.filter(c=>c.anchorX!==null&&c.anchorX!==undefined&&c.anchorY!==null&&Math.abs(c.time-time)<1.5&&!c.deletedAt).map(c=><button key={"pin-"+c.id} className="frame-annotation-pin" style={{left:(c.anchorX!*100)+"%",top:(c.anchorY!*100)+"%"}} title={c.body} onClick={e=>{e.stopPropagation();seek(c.time);}}/>)}{annotation&&<span className="pending-annotation-pin" style={{left:(annotation.x*100)+"%",top:(annotation.y*100)+"%"}}/>}{annotateMode&&<button className="annotation-layer" aria-label="Choose a point on the video frame" onClick={e=>{e.preventDefault();e.stopPropagation();placeAnnotation(e as unknown as React.MouseEvent<HTMLDivElement>);}}/>}{activeBubbles.map((c,i)=><button key={c.id} className="playback-bubble" style={{bottom:(20+Math.min(3,i)*52)+"px"}} onClick={()=>seek(c.time)}><MessageCircle size={14}/>{c.body.slice(0,90)}</button>)}</div>
      <div className="share-video-meta"><span>{timeLabel(share.duration)} · {Math.ceil(share.size/1024/1024)} MB</span><span>Available until {new Date(share.expiresAt*1000).toLocaleString()}</span></div>
      <section className="share-reactions" aria-label="Quick reactions"><span className="eyebrow">QUICK REACTION</span><div>
        <button className={myReaction==="like"?"active":""} aria-pressed={myReaction==="like"} onClick={()=>react(myReaction==="like"?"":"like")}><Heart size={15}/> Like <b>{reactions.like}</b></button>
        <button className={myReaction==="thanks"?"active":""} aria-pressed={myReaction==="thanks"} onClick={()=>react(myReaction==="thanks"?"":"thanks")}><Sparkles size={15}/> Thanks <b>{reactions.thanks}</b></button>
        <button className={myReaction==="idea"?"active":""} aria-pressed={myReaction==="idea"} onClick={()=>react(myReaction==="idea"?"":"idea")}><Lightbulb size={15}/> Idea <b>{reactions.idea}</b></button>
      </div></section>
      {(details.chapters?.length||details.captions?.length||details.report)?<section className="shared-context" aria-label="Video context">
        {details.chapters?.length?<div><span className="eyebrow">CHAPTERS</span><div className="shared-chapters">{details.chapters.map((chapter,i)=><button key={i} onClick={()=>seek(chapter.time)}><span>{timeLabel(chapter.time)}</span>{chapter.title}</button>)}</div></div>:null}
        {details.captions?.length?<div><span className="eyebrow">SEARCH THE TRANSCRIPT</span><input value={transcriptQuery} onChange={e=>setTranscriptQuery(e.target.value)} placeholder="Find a word or phrase"/><div className="shared-transcript">{details.captions.filter(cue=>cue.text.toLocaleLowerCase().includes(transcriptQuery.toLocaleLowerCase())).map((cue,i)=><button key={i} onClick={()=>seek(cue.start)}><span>{timeLabel(cue.start)}</span>{cue.text}</button>)}</div></div>:null}
        {details.report?<div className="shared-report"><span className="eyebrow">BUG REPORT</span>{details.report.url&&<p><strong>Page</strong> {details.report.url}</p>}{details.report.steps&&<p><strong>Reproduction steps</strong><br/>{details.report.steps}</p>}{details.report.expected&&<p><strong>Expected</strong><br/>{details.report.expected}</p>}{details.report.actual&&<p><strong>Actual</strong><br/>{details.report.actual}</p>}{details.report.environment&&<p><strong>Environment</strong><br/>{details.report.environment}</p>}</div>:null}
      </section>:null}
      <form className="share-comment-form" onSubmit={send}><div className="comment-composer-title">{replyTo?"Reply to this moment":"Add a timestamped note"} <span>at {timeLabel(Math.floor(video.current?.currentTime??time))}</span></div><div className="annotation-controls"><button type="button" className={"text-action "+(annotateMode?"active":"")} onClick={()=>{setAnnotateMode(!annotateMode);setAnnotation(null);}}>{annotateMode?"Cancel frame point":"Pin a point on the frame"}</button>{annotation&&<span>Frame point attached</span>}</div><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="What should the team notice here?" rows={3}/><div className="comment-composer-actions">{replyTo&&<button type="button" className="text-action" onClick={()=>setReplyTo(null)}>Cancel reply</button>}<button className="button primary" type="submit" disabled={!text.trim()}><Send size={15}/> Post comment</button></div></form>
      {error&&<p className="share-error">{error}</p>}
    </section><aside className="share-discussion"><div className="discussion-title"><div><span className="eyebrow">THE CONVERSATION</span><h2>{comments.filter(c=>!c.deletedAt).length} comments</h2></div><span className="discussion-mark"><MessageCircle size={17}/></span></div><section className="guest-review-panel" aria-label="Review decision"><div className="guest-review-panel-head"><span className="eyebrow">REVIEW RESPONSE</span><strong>{myReview?"Update your decision":"Help close the loop"}</strong></div><p className="review-panel-intro">Choose a response and keep your note tied to this moment in the video.</p><div className="review-decision-options"><button type="button" aria-pressed={reviewDecision==="approved"} onClick={()=>setReviewDecision("approved")}>Looks good</button><button type="button" aria-pressed={reviewDecision==="changes-requested"} onClick={()=>setReviewDecision("changes-requested")}>Needs changes</button><button type="button" aria-pressed={reviewDecision==="question"} onClick={()=>setReviewDecision("question")}>Ask a question</button></div><form className="guest-review-form" onSubmit={submitReview}><label className="field-label">Name shown to reviewers<input aria-label="Reviewer display name" maxLength={40} value={reviewLabel} onChange={e=>setReviewLabel(e.target.value)} placeholder="Guest"/></label><label className="field-label">Review note<textarea aria-label="Review note" maxLength={500} rows={3} value={reviewComment} onChange={e=>setReviewComment(e.target.value)} placeholder={reviewDecision==="approved"?"Optional note":"Add a note to explain your response"} /></label><button className="button primary" type="submit" disabled={reviewBusy||(reviewDecision!=="approved"&&!reviewComment.trim())}>{reviewBusy?"Saving…":myReview?"Update decision":"Save decision"}</button>{reviewMessage&&<p className="review-save-status" role="status">{reviewMessage}</p>}</form>{reviews.length>0&&<div className="review-response-list"><h3>Guest responses</h3>{reviews.map((review,i)=><article key={review.createdAt+"-"+i}><div><strong>{review.reviewerLabel}</strong><span>{reviewDecisionLabel(review.decision)}</span></div>{review.comment&&<p>{review.comment}</p>}<button type="button" className="review-time" onClick={()=>seek(review.time)}>{timeLabel(review.time)}</button></article>)}</div>}{ownerKey&&<div className="review-owner-actions"><span className="eyebrow">CREATOR CONTROLS</span><div><button type="button" className="button secondary" onClick={downloadReviewPacket}>Download review packet</button><button type="button" className="button secondary" disabled={reviewBusy} onClick={()=>updateReviewStatus("changes-requested")}>Mark changes requested</button><button type="button" className="button primary" disabled={reviewBusy} onClick={()=>updateReviewStatus(details.reviewStatus==="approved"?"needs-feedback":"approved")}>{details.reviewStatus==="approved"?"Reopen review":"Mark complete"}</button></div></div>}</section><div className="discussion-list">{comments.length?thread(comments):<div className="discussion-empty"><MessageCircle size={22}/><strong>No comments yet.</strong><p>Start the conversation at the moment that matters.</p></div>}</div></aside></div>
    <footer className="share-footer"><span><ShieldCheck size={14}/> No account required to watch.</span><span>This link ends automatically.</span></footer>
  </main>;
}
export default ShareViewer;
