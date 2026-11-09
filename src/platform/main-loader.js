/* Page-specific lightweight entrypoint. The production host welcome screen
 * is interactive without fetching the full multiplayer application bundle. */
(()=>{
'use strict';
// Development/test HTML still loads the app.js compatibility bundle normally.
if(document.querySelector('script[defer][src^="./app.js"]'))return;
let loadPromise=null,delayedChoice=null;
const params=new URLSearchParams(location.search);
let saved=false;
try{saved=Boolean(sessionStorage.getItem('gf-host-room-v2')||
 sessionStorage.getItem('gf-offline-room-v1'));}catch(_){}
const validJoin=/^[A-Z2-9]{6}$/.test(String(params.get('join')||'').toUpperCase());
const needHostAssets=params.get('host')==='1'&&!validJoin;
const bundle=needHostAssets?'app.js':'app-controller.js';
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
 // A controller link and an existing room must restore immediately.
 void loadApp().catch(error=>console.error('App startup failed',error));
 return;
}
const host=document.getElementById('hostBtn'),offline=document.getElementById('offlineBtn');
function onChoice(event){
 event.preventDefault();event.stopImmediatePropagation();
 if(delayedChoice)return;
 delayedChoice=event.currentTarget;
 const button=delayedChoice;
 button.disabled=true;
 // Preserve the user's fullscreen gesture before asynchronous script loading.
 try{
  if(!navigator.standalone&&!document.fullscreenElement&&
     typeof document.documentElement.requestFullscreen==='function'){
   const promise=document.documentElement.requestFullscreen({navigationUI:'hide'});
   if(promise?.catch)promise.catch(()=>{});
  }
 }catch(_){}
 void loadApp().then(()=>{
  host.removeEventListener('click',onChoice,true);
  offline.removeEventListener('click',onChoice,true);
  button.disabled=false;
  button.click();
 }).catch(error=>{
  button.disabled=false;delayedChoice=null;
  const status=document.getElementById('netStatus');
  if(status)status.textContent='โหลดแอปไม่สำเร็จ • ลองอีกครั้ง';
  console.error('App startup failed',error);
 });
}
host?.addEventListener('click',onChoice,true);
offline?.addEventListener('click',onChoice,true);
})();
