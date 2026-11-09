/* Reload only at a safe point when a new deployment arrives.
 * Stable asset filenames are revalidated by hosting cache headers. */
(()=>{
'use strict';
const loaded=String(window.GAME_DEPLOY_ID||'');
if(!loaded||loaded==='development')return;
let pending='',inflight=null,reloading=false,notified=false;
function safe(){
 try{return window.GAME_CAN_AUTO_RELOAD?.()===true;}
 catch(_){return false;}
}
function onSafePoint(){
 if(!pending||reloading||!safe())return false;
 // No deployment IDs in document URLs. Guard stale-CDN reload loops in
 // session storage without changing the address bar or dropping live rooms.
 try{if(sessionStorage.getItem('gf-reloaded-deploy')===pending)return false;}
 catch(_){}
 if(window.GAME_PREPARE_AUTO_RELOAD?.()===false)return false;
 try{sessionStorage.setItem('gf-reloaded-deploy',pending);}catch(_){}
 reloading=true;
 window.location.replace(window.location.href);
 return true;
}
async function check(){
 if(reloading||document.hidden||inflight)return inflight||false;
 inflight=(async()=>{
  try{
   const url=new URL('./deployment.json',window.location.href);
   const response=await fetch(url.href,{cache:'no-store'});
   if(!response.ok)return false;
   const manifest=await response.json();
   const next=String(manifest?.deployId||'');
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
 getPendingDeployment:()=>pending,
 getCurrentDeployment:()=>loaded
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){onSafePoint();void check();}});
window.addEventListener('focus',()=>{onSafePoint();void check();});
window.addEventListener('pageshow',()=>{onSafePoint();void check();});
setInterval(()=>{onSafePoint();void check();},45000);
setTimeout(()=>{void check();},4500);
})();
