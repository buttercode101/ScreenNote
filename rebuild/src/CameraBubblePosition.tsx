import React, { useRef } from "react";
import { cameraBubbleFootprint } from "./recorder";
type Props={size:number;x:number;y:number;disabled?:boolean;onChange:(x:number,y:number)=>void};
export default function CameraBubblePosition({size,x,y,disabled=false,onChange}:Props){
  const stage=useRef<HTMLDivElement>(null),grab=useRef({x:0,y:0});
  const bounds=cameraBubbleFootprint(size);
  const clamp=(value:number,max:number)=>Math.max(0,Math.min(max,value));
  const update=(clientX:number,clientY:number)=>{
    const rect=stage.current?.getBoundingClientRect();if(!rect||!rect.width||!rect.height)return;
    const nextX=clamp((clientX-rect.left-grab.current.x)/rect.width,1-bounds.width);
    const nextY=clamp((clientY-rect.top-grab.current.y)/rect.height,1-bounds.height);
    onChange(Number(nextX.toFixed(3)),Number(nextY.toFixed(3)));
  };
  const onPointerDown=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(disabled||!stage.current)return;const rect=stage.current.getBoundingClientRect();
    grab.current={x:event.clientX-rect.left-x*rect.width,y:event.clientY-rect.top-y*rect.height};
    event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();
  };
  const onKeyDown=(event:React.KeyboardEvent<HTMLDivElement>)=>{
    if(disabled)return;const step=event.shiftKey?.05:.01;
    let nextX=x,nextY=y;
    if(event.key==="ArrowLeft")nextX-=step;else if(event.key==="ArrowRight")nextX+=step;else if(event.key==="ArrowUp")nextY-=step;else if(event.key==="ArrowDown")nextY+=step;else if(event.key==="Home"){nextX=0;nextY=0;}else if(event.key==="End"){nextX=1-bounds.width;nextY=1-bounds.height;}else return;
    event.preventDefault();onChange(Number(clamp(nextX,1-bounds.width).toFixed(3)),Number(clamp(nextY,1-bounds.height).toFixed(3)));
  };
  return <div className="camera-position-preview"><div className="camera-position-stage" ref={stage} role="group" aria-label="16 by 9 screen preview">
    <span className="camera-position-screen-label">SCREEN</span><div className="camera-position-lines" aria-hidden="true"><i/><i/><i/><i/></div>
    <div className="camera-bubble-handle" role="slider" tabIndex={disabled?-1:0} aria-label="Camera bubble position" aria-disabled={disabled} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(x*100)} aria-valuetext={`Horizontal ${Math.round(x*100)}%, vertical ${Math.round(y*100)}%`} onPointerDown={onPointerDown} onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))update(event.clientX,event.clientY)}} onPointerUp={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}} onPointerCancel={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}} onKeyDown={onKeyDown} style={{left:`${x*100}%`,top:`${y*100}%`,width:`${bounds.width*100}%`,height:`${bounds.height*100}%`}}><span/></div>
  </div><p>Drag the camera bubble into place, or focus it and use the arrow keys. Shift + arrow moves farther.</p></div>;
}
