let db;
export async function open(){db=await new Promise((resolve,reject)=>{const r=indexedDB.open('screennote',1);r.onupgradeneeded=()=>{r.result.createObjectStore('clips',{keyPath:'id'});r.result.createObjectStore('drafts',{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Device storage is unavailable. Use a normal browser window.'))});return db}
export function transact(names,fn){return new Promise((resolve,reject)=>{const t=db.transaction(names,'readwrite');try{fn(t)}catch(e){t.abort();reject(e)}t.oncomplete=resolve;t.onerror=()=>reject(Error('Device storage is full or unavailable. Download your recording before closing.'));t.onabort=()=>reject(Error('Could not save to this device. Download your recording before closing.'))})}
export function all(name='clips'){return new Promise((resolve,reject)=>{const r=db.transaction(name).objectStore(name).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export const put=c=>transact(['clips'],t=>t.objectStore('clips').put(c));
export const saveDraft=d=>transact(['drafts'],t=>t.objectStore('drafts').put(d));
export const finish=(clip,draftId)=>transact(['clips','drafts'],t=>{t.objectStore('clips').put(clip);t.objectStore('drafts').delete(draftId)});
export const remove=id=>transact(['clips'],t=>t.objectStore('clips').delete(id));
