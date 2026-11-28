(()=> {
  if(window.__screennoteReproCapsule)return;
  let active=false,startedAt=0,packet=null;
  const allowedKeys=new Set(["Enter","Escape","Tab","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "]);
  function safePageUrl(){try{const u=new URL(location.href);u.username="";u.password="";u.search="";u.hash="";return u.href}catch{return location.origin}}
  function targetInfo(node){
    const el=node instanceof Element?node:null;if(!el)return{tag:"UNKNOWN"};
    const tag=el.tagName.toUpperCase(),role=(el.getAttribute("role")||"").slice(0,64);
    const isControl=/^(BUTTON|A)$/.test(tag)||role==="button"||role==="link";
    const label=(el.getAttribute("aria-label")||el.getAttribute("title")||(isControl?el.textContent:"")||"").replace(/\\s+/g," ").trim().slice(0,80);
    return{tag,role,label};
  }
  function ignoreTarget(node){const el=node instanceof Element?node:null;return !el||Boolean(el.closest("input,textarea,select,[contenteditable=true],[contenteditable='']"))}
  function push(step){if(packet&&packet.steps.length<500)packet.steps.push(step)}
  function click(event){if(!active||ignoreTarget(event.target))return;const el=event.target instanceof Element?event.target.closest("button,a,[role=button],[role=link],input,select,textarea,[tabindex]")||event.target:event.target;push({atMs:Math.max(0,Math.round(performance.now()-startedAt)),action:"click",target:targetInfo(el)})}
  function key(event){if(!active||event.repeat||ignoreTarget(event.target))return;const key=event.key===" "?"Space":event.key;if(!allowedKeys.has(event.key))return;push({atMs:Math.max(0,Math.round(performance.now()-startedAt)),action:"key",key,target:targetInfo(event.target)})}
  function start(){if(active)return{started:false};packet={schema:"screennote.repro-capsule",version:1,createdAt:new Date().toISOString(),durationMs:0,page:{url:safePageUrl(),title:(document.title||"").slice(0,200),userAgent:navigator.userAgent.slice(0,300),viewport:{width:innerWidth,height:innerHeight}},steps:[]};startedAt=performance.now();active=true;document.addEventListener("click",click,true);document.addEventListener("keydown",key,true);return{started:true}}
  function stop(){if(!packet)return null;if(active){active=false;document.removeEventListener("click",click,true);document.removeEventListener("keydown",key,true);packet.durationMs=Math.max(0,Math.round(performance.now()-startedAt))}return packet}
  window.__screennoteReproCapsule={start,stop,isActive:()=>active};
})();