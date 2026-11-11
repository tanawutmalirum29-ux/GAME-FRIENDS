/* Live same-core patches at 45-second cadence; full-core reloads are safe-point only.
 * A stale cached tab must keep retrying: one reload attempt is not permanent. */
(()=>{
'use strict';
const loaded=String(window.GAME_DEPLOY_ID||'');
if(!loaded||loaded==='development')return;
const RETRY_AFTER_MS=25_000,RELOAD_KEY='gf-reloaded-deploy',BUST_KEY='gf_refresh';
let pending='',inflight=null,reloading=false,notified='',lastCheckAt=0,liveRefresh=null;
function readAttempt(){
 try{
  const value=sessionStorage.getItem(RELOAD_KEY);
  if(!value)return null;
  const parsed=JSON.parse(value);
  if(parsed&&typeof parsed.id==='string'&&Number.isFinite(parsed.at))
   return parsed;
 }catch(_){}
 // An old release wrote only a string and had no retry expiry.
 return null;
}
function clearSucceededAttempt(){
 try{
  if(sessionStorage.getItem(RELOAD_KEY)){
   const attempt=readAttempt();
   if(!attempt||attempt.id===loaded)sessionStorage.removeItem(RELOAD_KEY);
  }
 }catch(_){}
}
clearSucceededAttempt();
// The nonce is used ONLY during navigation to defeat stale HTML. Restore the
// original room/join URL immediately, including every existing query parameter.
try{
 const url=new URL(window.location.href);
 if(url.searchParams.has(BUST_KEY)){
  url.searchParams.delete(BUST_KEY);
  window.history?.replaceState?.(window.history.state,'',url.href);
 }
}catch(_){}
function safe(){
 try{return window.GAME_CAN_AUTO_RELOAD?.()===true;}
 catch(_){return false;}
}
function onSafePoint(){
 if(!pending||reloading||!safe())return false;
 const previous=readAttempt();
 if(previous?.id===pending&&previous.from===loaded&&
   Date.now()-previous.at<RETRY_AFTER_MS)return false;
 if(window.GAME_PREPARE_AUTO_RELOAD?.()===false)return false;
 try{sessionStorage.setItem(RELOAD_KEY,JSON.stringify({
  id:pending,from:loaded,at:Date.now()
 }));}catch(_){}
 reloading=true;
 const url=new URL(window.location.href);
 url.searchParams.set(BUST_KEY,Date.now().toString(36));
 window.location.replace(url.href);
 return true;
}
async function check(){
 if(reloading||document.hidden||inflight)return inflight||false;
 inflight=(async()=>{
  try{
   const url=new URL('./deployment.json',window.location.href);
   url.searchParams.set('_gf_check',String(Date.now()));
   const response=await fetch(url.href,{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
   if(!response.ok)return false;
   const manifest=await response.json(),next=String(manifest?.deployId||'');
   if(!/^[a-z0-9._-]{7,64}$/i.test(next))return false;
   lastCheckAt=Date.now();
   if(next===loaded){pending='';notified='';clearSucceededAttempt();return false;}
   pending=next;
   if(onSafePoint())return true;
   if(notified!==next){
    notified=next;window.GAME_NOTIFY_UPDATE?.();
   }
   return true;
  }catch(_){return false;}
  finally{inflight=null;}
 })();
 return inflight;
}
async function refreshLive(){
 if(liveRefresh)return liveRefresh;
 // Controllers and NORMAL-only lobbies do not download BOARD metadata on every
 // poll; entering BOARD explicitly refreshes its catalog independently.
 const boardRelevant=!!document.getElementById?.('boardMapSelector')&&
  (document.body?.classList?.contains('board-playing')||
   document.querySelector?.('[data-session-mode="board"]')?.classList?.contains('active'));
 liveRefresh=Promise.allSettled([
  Promise.resolve().then(()=>window.GamePlatform?.refresh?.()),
  Promise.resolve().then(()=>boardRelevant?window.BoardRuntime?.refreshMaps?.():undefined),
  Promise.resolve().then(()=>boardRelevant?window.BoardSystemPlugins?.refresh?.():undefined)
 ]).finally(()=>{liveRefresh=null;});
 return liveRefresh;
}
function updateWorker(){
 try{
  if(navigator?.serviceWorker?.getRegistration)
   void navigator.serviceWorker.getRegistration().then(r=>r?.update?.()).catch(()=>{});
 }catch(_){}
}
function poll(){
 if(document.hidden||reloading)return;
 onSafePoint();
 void check();
 void refreshLive();
}
function resume(){
 updateWorker();
 poll();
}
window.GameAutoUpdate=Object.freeze({
 check,poll,onSafePoint,refreshLive,
 getPendingDeployment:()=>pending,
 getCurrentDeployment:()=>loaded,
 getLastCheckAt:()=>lastCheckAt
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume();});
for(const event of ['focus','pageshow','online'])window.addEventListener(event,resume);
setInterval(resume,45000);
setTimeout(resume,0);
})();