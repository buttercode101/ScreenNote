// @ts-nocheck
import { Input, BufferSource, MP4, WEBM, EncodedPacketSink } from "mediabunny";
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
  // Probe only the first three encoded packets on the video track. The full packet
  // scan used by the Node reference is too expensive for a low-CPU Worker request;
  // container indexes, duration, track metadata and initial packet structure are checked.
  const videoSink=new EncodedPacketSink(video);let firstVideo:any=null,count=0;
  for await(const packet of videoSink.packets()){if(!packet.data.length||!Number.isFinite(packet.timestamp)||!Number.isFinite(packet.duration)||packet.timestamp+packet.duration>duration+1)throw invalid();firstVideo=packet;if(++count>=3)break}
  if(!firstVideo)throw invalid();
  for(const track of tracks.filter((x:any)=>x.type==="audio")){
   const sink=new EncodedPacketSink(track);let firstAudio:any=null;
   for await(const packet of sink.packets()){firstAudio=packet;break}
   if(!firstAudio||!firstAudio.data.length||!Number.isFinite(firstAudio.timestamp)||!Number.isFinite(firstAudio.duration))throw invalid();
  }
  return{width:video.displayWidth,height:video.displayHeight,duration};
 }catch(error){if((error as any)?.status)throw error;throw invalid()}finally{input.dispose()}
}
