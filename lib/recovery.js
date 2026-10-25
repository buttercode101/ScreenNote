import {validId} from './rules.js';
export function recoveryDocument(clips, origin) {
  const keys = clips.filter(c => (c.shared || c.revoked || c.uploadAttempted) && !c.cloudDeleted)
    .map(c => ({id:c.id, owner:c.owner}));
  return JSON.stringify({format:'screennote-recovery',version:1,origin,keys},null,2);
}
export function recoveryKeys(raw, origin) {
  if (typeof raw !== 'string' || raw.length > 524288) throw Error('Use a ScreenNote recovery file smaller than 512 KB.');
  let data;try {data=JSON.parse(raw)} catch {throw Error('This is not valid recovery JSON. Paste the complete recovery file.');}
  if (!data || data.format!=='screennote-recovery' || data.version!==1 || data.origin!==origin || !Array.isArray(data.keys) || !data.keys.length || data.keys.length>128)
    throw Error('Use a recovery file exported from this ScreenNote address, with 1–128 keys.');
  const ids=new Set();return data.keys.map(k=>{
    if (!k || !validId(k.id) || typeof k.owner!=='string' || !/^[a-f0-9]{64}$/.test(k.owner) || ids.has(k.id))
      throw Error('The recovery file contains an invalid or duplicate key.');
    ids.add(k.id);return {id:k.id,owner:k.owner};
  });
}
