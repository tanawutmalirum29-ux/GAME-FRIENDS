/* Updates idle pages against the deployed Amplify build, without dropping
   an active match or PeerJS connection. */
(()=>{
'use strict';
const loaded=String(window.GAME_BUILD_VERSION||'');
if(!loaded||loaded==='development')return;
let pending='',inflight=null,reloading=false,notified=false;
function safe(){
  try{return window.GAME_CAN_AUTO_RELOAD?.()===true;}
  catch(_){return false;}
}
function onSafePoint(){
  if(!pending||reloading||!safe())return false;
  const url=new URL(window.location.href);
  // Do not reload-loop while a CDN still serves an obsolete index.html.
  if(url.searchParams.get('_gf_build')===pending)return false;
  if(window.GAME_PREPARE_AUTO_RELOAD?.()===false)return false;
  reloading=true;
  url.searchParams.set('_gf_build',pending);
  window.location.replace(url.href);
  return true;
}
async function check(){
  if(reloading||document.hidden||inflight)return inflight||false;
  inflight=(async()=>{
    try{
      const url=new URL('./version.json',window.location.href);
      url.searchParams.set('_',String(Date.now()));
      const response=await fetch(url.href,{cache:'no-store'});
      if(!response.ok)return false;
      const manifest=await response.json();
      const next=String(manifest?.version||'');
      if(!/^[a-z0-9._-]{7,64}$/i.test(next)||next===loaded)return false;
      pending=next;
      if(onSafePoint())return true;
      if(!notified){notified=true;window.GAME_NOTIFY_UPDATE?.();}
      return true;
    }catch(_){return false;}
    finally{inflight=null;}
  })();
  return inflight;
}
window.GameAutoUpdate=Object.freeze({
  check,onSafePoint,
  getPendingVersion:()=>pending,
  getCurrentVersion:()=>loaded
});
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden){onSafePoint();void check();}
});
window.addEventListener('focus',()=>{onSafePoint();void check();});
window.addEventListener('pageshow',()=>{onSafePoint();void check();});
setInterval(()=>{onSafePoint();void check();},45000);
setTimeout(()=>{void check();},4500);
})();
