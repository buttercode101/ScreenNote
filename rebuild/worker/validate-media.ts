import { Input, BufferSource, MP4, WEBM, EncodedPacketSink } from "mediabunny";
// @ts-ignore - shared browser-safe validation constants
import { MAX_BYTES, MAX_SECONDS, isVideo } from "../legacy/lib/rules.js";

const invalid=()=>Object.assign(new Error("This upload does not contain a valid video. Keep your local copy and re-export as MP4 or WebM."),{status:400});
export async function inspectNativeMedia(bytes:Uint8Array,expected:{type:string;size:number;duration:number}){
 if(!bytes.length||bytes.length>MAX_BYTES||bytes.length!==expected.size||!isVideo(bytes,expected.type))throw invalid();
 const input=new Input({source:new BufferSource(bytes),formats:[expected.type==="video/mp4"?MP4:WEBM]});
 try{
  if(!await input.canRead())throw invalid();
  const tracks=await input.getTracks();
  if(!tracks.length||tracks.length>8)throw invalid();
  const video=await input.getPrimaryVideoTrack();
  if(!video||!video.codec||!video.displayWidth||!video.displayHeight||video.displayWidth>16384||video.displayHeight>16384)throw invalid();
  const duration=await input.getDurationFromMetadata(tracks);
  if(duration===null||!Number.isFinite(duration)||duration<=0||duration>MAX_SECONDS+1||Math.abs(duration-expected.duration)>1)throw invalid();
  const videoSink=new EncodedPacketSink(video);
  const probes=[await videoSink.getFirstPacket(),await videoSink.getPacket(duration*0.25),await videoSink.getPacket(duration*0.5),await videoSink.getPacket(Math.max(0,duration-0.05)),await videoSink.getPacket(Infinity)];
  const valid=probes.filter((packet,i,all)=>packet&&packet.data.length&&Number.isFinite(packet.timestamp)&&Number.isFinite(packet.duration)&&packet.timestamp+packet.duration<=duration+1);
  if(!valid.length)throw invalid();
  // Probe the first and last packets of every audio track as well; this is a bounded
  // structural check that avoids a 100k-packet full scan on Workers' CPU budget.
  for(const track of tracks.filter((x:any)=>x.type==="audio")){
   const sink=new EncodedPacketSink(track),first=await sink.getFirstPacket(),last=await sink.getPacket(Infinity);
   if(!first||!last||!first.data.length||!last.data.length||!Number.isFinite(last.timestamp)||last.timestamp>duration+1)throw invalid();
  }
  return{width:video.displayWidth,height:video.displayHeight,duration};
 }catch(error){if((error as any)?.status)throw error;throw invalid()}finally{input.dispose()}
}
