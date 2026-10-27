import {MAX_BYTES,MAX_SECONDS,LOCAL_MAX_BYTES,LOCAL_MAX_SECONDS} from './rules.js';
export const PROFILES = {
 saver: {label:'Data saver',width:960,fps:15,video:350000,audio:48000},
 balanced: {label:'Balanced',width:1280,fps:24,video:600000,audio:64000},
 clear: {label:'Clear text',width:1920,fps:24,video:1600000,audio:64000}
};
export const profileFor = name => PROFILES[name] || PROFILES.balanced;
export function recordingStats(bytes,seconds,profile='balanced') {
 const rate=seconds>2&&bytes>0?bytes/seconds:(profileFor(profile).video+profileFor(profile).audio)/8;
 return {bytes,seconds,remaining:Math.max(0,Math.min(LOCAL_MAX_SECONDS-seconds,(LOCAL_MAX_BYTES-bytes)/rate)),
 shareRemaining:Math.max(0,Math.min(MAX_SECONDS-seconds,(MAX_BYTES-bytes)/rate)),
 shareable:bytes<=MAX_BYTES&&seconds<=MAX_SECONDS,rate};
}
export function sharingProblem(clip) {
 const size=clip.blob?.size??clip.size??0;
 if(clip.duration>MAX_SECONDS)return 'This video is longer than 10 minutes. Trim a shorter copy to share; your original stays here.';
 if(size>MAX_BYTES)return 'This video is larger than 50 MB. Make a smaller copy to share; your original stays here.';
 return '';
}
export const stopMessage = reason => ({size:'Saved: the 250 MB local recording limit was reached.',duration:'Saved: the 30-minute local recording limit was reached.',source:'Saved: screen sharing ended.',error:'Recording stopped unexpectedly. The captured video is saved.',user:'Recording saved.'}[reason]||'Recording saved.');
