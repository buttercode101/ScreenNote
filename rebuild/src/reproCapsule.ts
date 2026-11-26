export type ReproCapsuleStep = {
  atMs: number;
  action: "click" | "key";
  target: { tag?: string; role?: string; label?: string };
  key?: string;
};
export type ReproCapsule = {
  schema: "screennote.repro-capsule";
  version: 1;
  createdAt: string;
  durationMs: number;
  page: { url: string; title: string; userAgent: string; viewport: { width: number; height: number } };
  steps: ReproCapsuleStep[];
};
const record=(value:unknown):value is Record<string,unknown>=>typeof value==="object"&&value!==null&&!Array.isArray(value);
const text=(value:unknown,max:number)=>typeof value==="string"?value.trim().slice(0,max):"";
const number=(value:unknown,min:number,max:number)=>typeof value==="number"&&Number.isFinite(value)&&value>=min&&value<=max?value:null;
const allowedKeys=new Set(["Enter","Escape","Tab","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"]);
export function parseReproCapsule(input:unknown):ReproCapsule {
  if(!record(input)||input.schema!=="screennote.repro-capsule"||input.version!==1)throw new Error("This is not a supported ScreenNote Repro Capsule (v1).");
  const page=input.page;
  if(!record(page)||!record(page.viewport))throw new Error("The capsule is missing page or viewport details.");
  const rawUrl=text(page.url,2048);
  let url:URL;
  try{url=new URL(rawUrl)}catch{throw new Error("The capsule page URL is invalid.");}
  if(url.protocol!=="http:"&&url.protocol!=="https:")throw new Error("Only HTTP and HTTPS page URLs can be imported.");
  url.username="";url.password="";url.search="";url.hash="";
  const width=number(page.viewport.width,1,10000),height=number(page.viewport.height,1,10000);
  if(width===null||height===null)throw new Error("The capsule viewport dimensions are invalid.");
  const createdAt=text(input.createdAt,64);
  if(!createdAt||!Number.isFinite(Date.parse(createdAt)))throw new Error("The capsule capture date is invalid.");
  const durationMs=number(input.durationMs,0,3*60*60*1000);
  if(durationMs===null)throw new Error("The capsule duration is invalid.");
  if(!Array.isArray(input.steps)||input.steps.length>500)throw new Error("A capsule may contain at most 500 steps.");
  const steps:ReproCapsuleStep[]=input.steps.map((raw,index)=>{
    if(!record(raw))throw new Error("Capsule step "+(index+1)+" is invalid.");
    const atMs=number(raw.atMs,0,durationMs);
    if(atMs===null||(raw.action!=="click"&&raw.action!=="key"))throw new Error("Capsule step "+(index+1)+" has an invalid time or action.");
    const target=record(raw.target)?raw.target:{};
    const safeTarget={tag:text(target.tag,32).toUpperCase(),role:text(target.role,64),label:text(target.label,120)};
    if(raw.action==="key"){
      const key=text(raw.key,24);
      if(!allowedKeys.has(key))throw new Error("Capsule step "+(index+1)+" contains an unsupported key.");
      return{atMs,action:"key",target:safeTarget,key};
    }
    return{atMs,action:"click",target:safeTarget};
  });
  return{schema:"screennote.repro-capsule",version:1,createdAt,durationMs,page:{url:url.href,title:text(page.title,200),userAgent:text(page.userAgent,300),viewport:{width,height}},steps};
}
export function formatReproCapsuleSteps(capsule:ReproCapsule):string {
  if(!capsule.steps.length)return "No interaction steps were captured.";
  return capsule.steps.map((step,index)=>{
    const minutes=Math.floor(step.atMs/60000),seconds=Math.floor(step.atMs/1000)%60,millis=step.atMs%1000;
    const stamp=minutes+":"+String(seconds).padStart(2,"0")+"."+String(millis).padStart(3,"0");
    const label=step.target.label?" “"+step.target.label+"”":"";
    const target=step.target.role||step.target.tag?" ("+[step.target.role,step.target.tag].filter(Boolean).join(" · ")+")":"";
    const action=step.action==="click"?"Click"+label+target:"Press "+step.key;
    return(index+1)+". ["+stamp+"] "+action;
  }).join("\n");
}
