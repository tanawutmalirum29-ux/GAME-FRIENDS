/* Page-specific lightweight entrypoint. The production host welcome screen
 * is interactive without fetching the full multiplayer application bundle. */
(()=>{
'use strict';
// Development/test HTML still loads the app.js compatibility bundle normally.
if(document.querySelector('script[defer][src^="./app.js"]'))return;
let loadPromise=null,delayedChoice=null;
function loadApp(){
 if(loadPromise)return loadPromise;
 loadPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  const url=new URL('./app.js',document.baseURI);
  if(window.GAME_BUILD_VERSION)url.searchParams.set('v',String(window.GAME_BUILD_VERSION));
  script.src=url.href;script.async=true;
  script.onload=resolve;
  script.onerror=()=>{script.remove();reject(Error('Application bundle download failed'));};
  document.head.append(script);
 }).catch(error=>{loadPromise=null;throw error;});
 return loadPromise;
}
const params=new URLSearchParams(location.search);
let saved=false;
try{saved=Boolean(sessionStorage.getItem('gf-host-room-v2')||
 sessionStorage.getItem('gf-offline-room-v1'));}catch(_){}
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
