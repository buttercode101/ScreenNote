import React,{useEffect,useState} from "react";
import {Film} from "lucide-react";
type Props={thumbnail?:Blob;title:string};
export default function ClipThumbnail({thumbnail,title}:Props){
 const [src,setSrc]=useState("");
 useEffect(()=>{if(!thumbnail){setSrc("");return}const url=URL.createObjectURL(thumbnail);setSrc(url);return()=>URL.revokeObjectURL(url)},[thumbnail]);
 return src?<img className="clip-thumbnail-image" src={src} alt={title+" preview frame"} loading="lazy" decoding="async"/>:<div className="clip-thumb-fallback" aria-label={title+" preview unavailable"}><Film size={27}/><span>SCREENNOTE</span></div>
}
