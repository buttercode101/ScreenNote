import type { ShareVersion } from "./library";
export type CurrentShare = { recordingId:string; token:string; url:string; ownerKey:string; expiresAt:number; version?:number; publishedAt?:number };
export function planShareVersion(current:CurrentShare|undefined,history:ShareVersion[],keepPrevious:boolean,now:number,title:string){
  const currentVersion=current?(current.version??1):0;
  const maxVersion=Math.max(currentVersion,...history.map(item=>item.version),0);
  const version=maxVersion+1;
  const canKeep=Boolean(current&&current.expiresAt*1000>now);
  const previous:ShareVersion|null=current&&canKeep?{...current,version:current.version??currentVersion,publishedAt:current.publishedAt??now,title}:null;
  const previousKept=Boolean(previous&&keepPrevious);
  const nextHistory=previousKept&&previous?[previous,...history.filter(item=>item.token!==previous.token).sort((a,b)=>b.version-a.version)].slice(0,10):history;
  return{version,history:nextHistory,previousToRevoke:current&&!previousKept?current:null,previousKept:previousKept?previous:null};
}
