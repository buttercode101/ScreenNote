import {LOCAL_MAX_BYTES,isVideo} from './rules.js';
// Some device file providers omit MIME or use application/octet-stream.
// Infer only supported extensions, verify their container header, then let the browser decode.
export async function importMedia(file){
 if(file.size>LOCAL_MAX_BYTES)throw Error('Choose a video up to 250 MB for local editing. Your file has not been uploaded.');
 const declared=String(file.type||'').split(';')[0].toLowerCase();
 const type=['video/mp4','video/webm'].includes(declared)?declared:(!declared||declared==='application/octet-stream')?(/\.mp4$/i.test(file.name)?'video/mp4':/\.webm$/i.test(file.name)?'video/webm':''):'';
 if(!type)throw Error('Choose an MP4 or WebM video.');
 if(!isVideo(new Uint8Array(await file.slice(0,16).arrayBuffer()),type))throw Error('This file is not a valid MP4 or WebM video. Nothing was uploaded.');
 return{blob:new Blob([file],{type}),type};
}
