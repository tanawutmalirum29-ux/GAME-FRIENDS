/* Page-specific lightweight entrypoint. The production host welcome screen
 * is interactive without fetching the full multiplayer application bundle. */
(()=>{
'use strict';
// Development/test HTML still loads the app.js compatibility bundle normally.
if(document.querySelector('script[defer][src^="./app.js"]'))return;
let loadPromise=null,delayedChoice=null,preflightJob=null;
const params=new URLSearchParams(location.search);
let saved=false;
try{saved=Boolean(sessionStorage.getItem('gf-host-room-v2')||
 sessionStorage.getItem('gf-offline-room-v1'));}catch(_){}
const validJoin=/^[A-Z2-9]{6}$/.test(String(params.get('join')||'').toUpperCase());
const needHostAssets=params.get('host')==='1'&&!validJoin;
const bundle=needHostAssets?'app.js':'app-controller.js';
// Prevent an old cached Host/Controller from reconnecting before noticing an
// already published deployment. A short timeout keeps offline entry usable.
async function preflightRestore(){
 const loaded=String(window.GAME_DEPLOY_ID||'');
 if(!/^[a-z0-9._-]{7,64}$/i.test(loaded))return false;
 const controller=typeof AbortController==='function'?new AbortController():null;
 const timer=setTimeout(()=>controller?.abort(),1200);
 try{
  const url=new URL('./deployment.json',document.baseURI);
  url.searchParams.set('_gf_check',String(Date.now()));
  const response=await fetch(url.href,{cache:'no-store',
   headers:{'Cache-Control':'no-cache'},...(controller?{signal:controller.signal}:{})});
  if(!response.ok)return false;
  const data=await response.json(),next=String(data?.deployId||'');
  if(!/^[a-z0-9._-]{7,64}$/i.test(next)||next===loaded)return false;
  let prior=null;
  try{prior=JSON.parse(sessionStorage.getItem('gf-reloaded-deploy')||'null');}catch(_){}
  if(prior?.id===next&&prior.from===loaded&&Date.now()-prior.at<25000)return false;
  try{sessionStorage.setItem('gf-reloaded-deploy',JSON.stringify({id:next,from:loaded,at:Date.now()}));}catch(_){}
  const fresh=new URL(location.href);
  fresh.searchParams.set('gf_refresh',Date.now().toString(36));
  location.replace(fresh.href);
  return true;
 }catch(_){return false;}
 finally{clearTimeout(timer);}
}
function loadApp(){
 if(loadPromise)return loadPromise;
 loadPromise=Promise.resolve().then(()=>{
  if(needHostAssets){
   if(!window.GameHostRuntime)throw Error('Host runtime loader is missing');
   return window.GameHostRuntime.ensure();
  }
 }).then(()=>new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  const url=new URL('./'+bundle,document.baseURI);
  script.src=url.href;script.async=true;
  script.onload=resolve;
  script.onerror=()=>{script.remove();reject(Error('Application bundle download failed: '+bundle));};
  document.head.append(script);
 })).catch(error=>{loadPromise=null;throw error;});
 return loadPromise;
}
const welcome=params.get('host')==='1'&&!params.get('join')&&!saved;
if(!welcome){
 // Check before opening PeerJS: reconnecting from a stale Core prevents a
 // safe full reload until everyone leaves the room.
 void preflightRestore().then(redirecting=>{
  if(!redirecting)return loadApp();
 }).catch(error=>console.error('App startup failed',error));
 return;
}
// The welcome view has not opened a room and is always safe to refresh.
let preflightFinished=false;
window.GAME_CAN_AUTO_RELOAD=()=>!loadPromise&&preflightFinished;
preflightJob=preflightRestore().finally(()=>{preflightFinished=true;});
const host=document.getElementById('hostBtn'),offline=document.getElementById('offlineBtn');
function onChoice(event){
 event.preventDefault();event.stopImmediatePropagation();
 if(delayedChoice)return;
 delayedChoice=event.currentTarget;
 const button=delayedChoice;
 button.disabled=true;
 const status=document.getElementById('netStatus');
 if(status)status.textContent='กำลังเตรียมหน้าจอเล่นเกม...';
 if(button===host){
  // Production first host tap downloads the app before startHost is defined.
  const curtain=document.getElementById('transitionLoading');
  if(curtain){
   document.getElementById('transitionLoadingTitle').textContent='กำลังสร้างห้อง';
   document.getElementById('transitionLoadingDetail').textContent='กำลังเตรียมระบบเชื่อมต่อและฉากล็อบบี้...';
   curtain.classList.remove('hidden');
  }
 }
 // Preserve the user's fullscreen gesture before asynchronous script loading.
 try{
  if(!navigator.standalone&&!document.fullscreenElement&&
     typeof document.documentElement.requestFullscreen==='function'){
   const promise=document.documentElement.requestFullscreen({navigationUI:'hide'});
   if(promise?.catch)promise.catch(()=>{});
  }
 }catch(_){}
 void preflightJob.then(redirecting=>redirecting?null:loadApp()).then(result=>{
  if(result===null)return; // A fresh document navigation is already underway.
  host.removeEventListener('click',onChoice,true);
  offline.removeEventListener('click',onChoice,true);
  button.disabled=false;
  button.click();
 }).catch(error=>{
  document.getElementById('transitionLoading')?.classList.add('hidden');
  button.disabled=false;delayedChoice=null;
  const status=document.getElementById('netStatus');
  if(status)status.textContent='โหลดแอปไม่สำเร็จ • ลองอีกครั้ง';
  console.error('App startup failed',error);
 });
}
host?.addEventListener('click',onChoice,true);
offline?.addEventListener('click',onChoice,true);
})();
