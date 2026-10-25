// Recovery is best effort; losing it must never take away in-memory recording controls.
export function createDraftWriter(save, warn) {
  let chain=Promise.resolve(), failed=false;
  return {
    save(snapshot) {
      if(failed)return chain;
      chain=chain.then(()=>{if(!failed)return save(snapshot)}).catch(()=>{
        if(!failed){failed=true;warn()}
      });
      return chain;
    },
    flush(){return chain}
  };
}
