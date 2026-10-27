export const REVIEW_STATES=['needs-feedback','changes-requested','approved'];
export const reviewLabel=s=>({'needs-feedback':'Needs feedback','changes-requested':'Changes requested',approved:'Approved'}[s]||'Needs feedback');
export function filterRecordings(clips,{query='',status='all',sort='newest'}={}){
 const q=query.trim().toLocaleLowerCase();
 const result=clips.filter(c=>(!q||String(c.title).toLocaleLowerCase().includes(q))&&(status==='all'||status==='shared'&&c.shared&&!c.revoked&&!c.cloudDeleted&&c.expiresAt>Date.now()||status==='local'&&!!c.blob&&(!c.shared||c.revoked||c.cloudDeleted||c.expiresAt<=Date.now())||status===(c.reviewStatus||'needs-feedback')));
 return result.sort((a,b)=>sort==='title'?String(a.title).localeCompare(String(b.title)):sort==='oldest'?a.createdAt-b.createdAt:b.createdAt-a.createdAt);
}
