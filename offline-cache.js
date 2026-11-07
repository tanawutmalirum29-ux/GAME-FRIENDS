/* Register local asset caching without changing multiplayer lifecycle. */
(()=>{
'use strict';
if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
let registration=null;
const ready=navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'})
  .then(r=>{registration=r;return r;}).catch(()=>null);
window.GameOfflineCache=Object.freeze({
  ready,
  async checkForUpdate(){
    const r=registration||await ready;
    if(!r)return false;
    try{await r.update();return !!r.waiting;}catch(_){return false;}
  },
  activateWhenSafe(){
    const r=registration;
    if(r?.waiting)r.waiting.postMessage({type:'GF_ACTIVATE_WHEN_SAFE'});
  }
});
})();
