import {createHash,timingSafeEqual} from 'node:crypto';
import {validId,commentInput,text,publicClip} from './rules.js';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const digest=v=>createHash('sha256').update(v).digest('hex');
function matches(value,expected){if(typeof value!=='string'||value.length<40||value.length>100||typeof expected!=='string')return false;const a=Buffer.from(digest(value)),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b)}
function rootOf(comments,c){const seen=new Set();while(c.parentId){if(seen.has(c.id))throw fail('This thread is unavailable.',409);seen.add(c.id);const p=comments.find(x=>x.id===c.parentId);if(!p)break;c=p}return c}
export const commentOperations=['comment','edit-comment','delete-comment','resolve-thread'];
// Called inside the recording's compare-and-swap transaction. No author capability is public.
export function applyCommentAction(d,op,body,now=Date.now()){
 if(d.status!=='published'||d.expiresAt<now)throw fail('This link has expired or is no longer shared.',404);
 d.comments||=[];
 const creator=matches(body.owner,d.ownerHash);
 if(op==='comment'){
  const comment=commentInput(body,d),eventId=body.eventId;
  if(!validId(eventId))throw fail('Invalid reply identity.');
  if(body.authorKey!==undefined&&!/^[a-f0-9]{64}$/.test(body.authorKey))throw fail('Invalid comment management key.');
  if(d.comments.some(x=>x.id===eventId))return publicClip(d);
  if(d.comments.length>=100)throw fail('This clip has reached 100 comments and replies.');
  if(comment.parentId){const parent=d.comments.find(x=>x.id===comment.parentId);if(!parent||parent.deleted)throw fail('This reply is no longer available. Refresh the conversation.',409);comment.time=parent.time;rootOf(d.comments,parent).resolved=false}
  d.comments.push({...comment,id:eventId,createdAt:now,creator,...(body.authorKey?{authorHash:digest(body.authorKey)}:{})});
 }else{
  if(!validId(body.commentId))throw fail('Choose an existing comment.');
  const c=d.comments.find(x=>x.id===body.commentId);if(!c)throw fail('Comment not found.',404);
  const author=matches(body.authorKey,c.authorHash);
  if(op==='resolve-thread'){
   const root=rootOf(d.comments,c);
   if(!creator&&!matches(body.authorKey,root.authorHash))throw fail('Only the thread author or video creator can resolve this thread.',403);
   if(typeof body.resolved!=='boolean')throw fail('Choose whether this thread is resolved.');
   root.resolved=body.resolved;
  }else{
   if(!author&&!(creator&&op==='delete-comment'))throw fail('This browser cannot change this comment.',403);
   if(op==='delete-comment'){c.deleted=true;c.text='';c.name='Deleted comment';c.editedAt=now}
   else if(op==='edit-comment'){
    if(c.deleted)throw fail('This comment was deleted.',409);
    if(body.expectedVersion!==(c.editedAt||c.createdAt))throw fail('This comment changed. Refresh before editing again.',409);
    c.text=text(body.text,500,true);c.editedAt=Math.max(now,(c.editedAt||c.createdAt)+1);
   }
  }
 }
 d.discussionRevision=(d.discussionRevision||0)+1;
 return publicClip(d);
}
