// Shared presentation rules: legacy flat comments remain independent threads.
export function discussionThreads(comments=[]){
 const byId=new Map(comments.map(c=>[c.id,c])),groups=new Map();
 for(const comment of comments){
  let root=comment;const seen=new Set([root.id]);
  while(root.parentId&&byId.has(root.parentId)&&!seen.has(root.parentId)){root=byId.get(root.parentId);seen.add(root.id)}
  if(!groups.has(root.id))groups.set(root.id,{root,items:[]});
  groups.get(root.id).items.push(comment);
 }
 return [...groups.values()].map(t=>({...t,items:t.items.sort((a,b)=>a.createdAt-b.createdAt)})).sort((a,b)=>(a.root.time-b.root.time)||(a.root.createdAt-b.root.createdAt));
}
export function bubbleThreads(comments,time,window=5){return discussionThreads(comments).filter(t=>!t.root.deleted&&!t.root.resolved&&time>=t.root.time&&time<t.root.time+window)}
export function timelineGroups(comments,start,end,bins=24){
 const groups=new Map();for(const t of discussionThreads(comments).filter(t=>!t.root.deleted)){
 const ratio=Math.max(0,Math.min(1,(t.root.time-start)/Math.max(.25,end-start))),bin=Math.min(bins-1,Math.floor(ratio*bins));
 if(!groups.has(bin))groups.set(bin,{ratio,threads:[]});groups.get(bin).threads.push(t);
 }return [...groups.values()];
}
