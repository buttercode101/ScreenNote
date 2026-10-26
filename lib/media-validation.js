import {Input, BufferSource, MP4, WEBM, EncodedPacketSink} from 'mediabunny';
import {MAX_BYTES, MAX_SECONDS} from './rules.js';

const invalid = () => Object.assign(Error('This upload does not contain a valid video. Re-export it as MP4 or WebM and try again. Your local copy is safe.'), {status: 400});

// Read complete packet payloads, not just the filename, MIME or magic bytes.
// This is bounded container/track validation, not a universal codec decoder.
export async function inspectMedia(bytes, expected) {
  if (!bytes.length || bytes.length > MAX_BYTES || bytes.length !== expected.size) throw invalid();
  const input = new Input({source: new BufferSource(bytes), formats: [expected.type === 'video/mp4' ? MP4 : WEBM]});
  try {
    const tracks = await input.getTracks();
    if (!tracks.length || tracks.length > 8) throw invalid();
    const video = await input.getPrimaryVideoTrack();
    if (!video || !video.codec || !video.displayWidth || !video.displayHeight
      || video.displayWidth > 16384 || video.displayHeight > 16384) throw invalid();
    let videoPackets = 0, packets = 0, duration = 0;
    const deadline = Date.now() + 8000;
    for (const track of tracks) {
      for await (const packet of new EncodedPacketSink(track).packets()) {
        if (++packets > 100000 || Date.now() > deadline || !packet.data.length
          || !Number.isFinite(packet.timestamp) || !Number.isFinite(packet.duration)) throw invalid();
        if (track === video) videoPackets++;
        duration = Math.max(duration, packet.timestamp + packet.duration);
        if (duration > MAX_SECONDS + 1) throw invalid();
      }
    }
    if (!videoPackets || duration <= 0 || Math.abs(duration - expected.duration) > 1) throw invalid();
    return {width: video.displayWidth, height: video.displayHeight, duration};
  } catch (error) {
    if (error.status) throw error;
    throw invalid();
  } finally {
    input.dispose();
  }
}

export async function validatePublishedMedia(url, expected, fetcher = fetch) {
  let response;try{response=await fetcher(url,{signal:AbortSignal.timeout(20000)})}catch{throw Object.assign(Error('Could not verify this upload. Keep your local copy and retry.'),{status:503})}
  if (!response.ok || !response.body) throw Object.assign(Error('Could not verify this upload. Keep your local copy and retry.'), {status: 503});
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > expected.size || size > MAX_BYTES) throw invalid();
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return inspectMedia(bytes, expected);
}
