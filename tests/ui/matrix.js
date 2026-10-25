const frame=document.getElementById('app-frame'),scenario=document.getElementById('scenario'),width=document.getElementById('width'),lag=document.getElementById('lag');
for(const w of [320,360,390,480,481,600,767,768,834,835,1024,1025,1150,1151,1600,1601,1920])width.add(new Option(w,w,w===390,w===390));
width.onchange=()=>frame.style.width=width.value+'px';
function load(){frame.src='/fixture.html?case='+scenario.value+'&lag='+lag.value+'&run='+Date.now()}
scenario.onchange=load;lag.onchange=load;document.getElementById('reset').onclick=load;load();

document.getElementById('height').onchange=e=>frame.style.height=e.target.value+'px';
