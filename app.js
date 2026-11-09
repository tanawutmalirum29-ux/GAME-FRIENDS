(() => {
'use strict';

const $ = (id) => document.getElementById(id);
const MAX_PLAYERS = 12;
// High-contrast identity palette. Earlier entries are spaced out intentionally,
// keeping 2–6-player matches legible, not just the full 12-player roster.
const COLORS = ['#c62222','#36d9e5','#215a94','#d7b000','#f53695','#f57a00',
 '#36d595','#000094','#009400','#b800f5','#008484','#94004a'];
// Past sessions may contain older pastel IDs: migrate instead of losing players.
const LEGACY_COLORS = ['#ff628c','#3fe4ef','#ffcf62','#ae94ff','#7fe5a0',
 '#ff9b64','#7fb4ff','#f283e9','#e5ed78','#83e1c8','#f8a9b6','#c4aafa'];
function pickUnusedColor(){
  // Never choose randomly among colors that look similar in a small room.
  const inUse = new Set(players.map(player => player.color));
  return COLORS.find(color => !inUse.has(color)) || null;
}
const MODES = {ghost:'GHOST ATTACK',chickens:'CHICKENS',fruit_memory:'FRUIT MEMORY',shockwave:'SHOCKWAVE',color_switch:'COLOR SWITCH',pizza_time:'PIZZA TIME',knight_match:'KNIGHT MATCH',boulder_bash:'BOULDER BASH',snow_brawl:'SNOW BRAWL',shopping_time:'SHOPPING TIME',witching_snake:'WITCHING SNAKE',lawn_mower:'LAWN MOWER',color_claim:'COLOR CLAIM',ice_race:'ICE RACE',gladiators:'GLADIATORS'};
const ENGINES={ghost:'GhostAttack',chickens:'Chickens',fruit_memory:'FruitMemory',shockwave:'Shockwave',color_switch:'ColorSwitch',pizza_time:'PizzaTime',knight_match:'KnightMatch',boulder_bash:'BoulderBash',snow_brawl:'SnowBrawl',shopping_time:'ShoppingTime',witching_snake:'WitchingSnake',lawn_mower:'LawnMower',color_claim:'ColorClaim',ice_race:'IceRace',gladiators:'Gladiators'};
const gameEngine=mode=>mode==='board'?BOARD_ENGINE:
 (round?.mode===mode&&round?.pluginEngine)||window.GamePlatform?.engine(mode)||
 (Object.hasOwn(ENGINES,mode)&&ENGINES[mode]?window[ENGINES[mode]]:null);
const modesFor=kind=>Object.keys(MODES).filter(id=>{
 const platform=window.GamePlatform;
 if(!platform||!platform.revision)return true;
 return !!platform.descriptor(id)?.modes.includes(kind);
});
function syncGameCatalog(){
 const platform=window.GamePlatform;
 if(!platform?.revision)return;
 for(const game of platform.games()){
  MODES[game.id]=game.name;ENGINES[game.id]=game.global;
 }
 const permitted=modesFor('normal');
 for(const player of players){
  if(player.choice&&!permitted.includes(player.choice))player.choice=permitted[0]||null;
 }
 renderModeChoices();
 if(currentView==='hostLobby'){renderRoster();broadcastRoster();}
 if(boardSession&&round?.mode==='board')warmBoardGames();
}
const BOARD_ENGINE={draw:(g,t)=>window.BoardArt.draw(g,t,boardSession),hud:()=>({survivors:boardSession?.players.length||0})};

function gameCover(mode){
 const cover=document.createElement('span');
 cover.className='mode-cover';
 const picture=window.PartyGameCovers.svg(mode);
 if(picture)cover.innerHTML=picture;
 else{
  const uri=window.GamePlatform?.descriptor(mode)?.coverUrl;
  if(uri){const img=document.createElement('img');img.src=uri;img.alt='';cover.append(img);}
  else{
    cover.classList.add('mode-cover-generic');
    cover.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4 39 25 60 32 39 39 32 60 25 39 4 32 25 25Z" fill="#bce8ff" stroke="#5479ab" stroke-width="2"/></svg>';
  }
 }
 cover.setAttribute('aria-hidden','true');
 return cover;
}
function renderModeChoices(){
 const host=$('phoneGameChoices');
 for(const [id,name] of Object.entries(MODES)){
  if(!modesFor('normal').includes(id)||
     [...document.querySelectorAll('[data-pick]')].some(b=>b.dataset.pick===id))continue;
  const button=document.createElement('button');
  button.type='button';button.dataset.pick=id;button.className='phone-game-choice';
  button.setAttribute('aria-pressed','false');button.textContent=name;
  button.addEventListener('click',()=>onPhoneGamePick(id));host.append(button);
 }
 for(const button of document.querySelectorAll('[data-pick]')){
  const mode=button.dataset.pick;
  const enabled=modesFor('normal').includes(mode);
  button.hidden=!enabled;button.disabled=!enabled;
  button.classList.toggle('hidden',!enabled);
  if(!Object.hasOwn(MODES,mode)||!enabled)continue;
  const label=document.createElement('span');label.className='mode-choice-title';
  label.textContent=MODES[mode];button.replaceChildren(gameCover(mode),label);
  button.title=MODES[mode];
 }
}

// The match list is nominated by phone players rather than a fixed tournament deck.
let tournament=null;
let gameSelection=null;
let selectedSessionMode='queue';
// Each connected phone may vote A once to start; local bots are ready by default.
const lobbyReadyVotes=new Set();
let boardSession=null,boardStateToken=null,boardStateClock=0;
let controllerSessionMode='queue',controllerBoard=null,controllerActionId=0;
let boardCameraController=null;
const KEYS = [
  {left:'KeyA',right:'KeyD',jump:'KeyW',down:'KeyS',action:'Space',alt:'ShiftLeft',cancel:'KeyC'},
  {left:'ArrowLeft',right:'ArrowRight',jump:'ArrowUp',down:'ArrowDown',action:'Enter',alt:'ShiftRight',cancel:'Slash'}
];
const INPUT_NAMES = ['left','right','jump','down','action','alt','cancel'];
let players = [], nextId=1, round=null, roomCode='', hostPeer=null, controllerPeer=null, controllerConn=null;
let hostConnections = new Set(), onlineHost=false, currentView='home', frameLast=0, graphicsClock=0, hudClock=0, networkClock=0, inventoryClock=0;
let controllerKeys={left:false,right:false,jump:false,down:false,action:false,alt:false,cancel:false,axisX:0,axisY:0}, controllerId=null, controllerReady=false;
let controllerGameMode=null,controllerGamePhase='lobby',controllerPlayerActive=false,controllerPlayerEliminated=false;
let controllerResultVotes={next:0,lobby:0,total:0,nextLabel:'เกมถัดไป',backLabel:'กลับล็อบบี้',autoNextSeconds:null};
let controllerLobbyVotes={ready:0,total:0,selfReady:false};
let disconnectRequested=false;
const HOST_SESSION='gf-host-room-v2',OFFLINE_SESSION='gf-offline-room-v1';
const PHONE_SESSION='gf-phone-room-v2',PHONE_TOKEN='gf-phone-token-v2';
const seatTimers=new Map();let reconnectTimer=null,reconnectTries=0;
// An obsolete PeerJS retry must never reopen a room that was closed.
let hostOpenAttempt=0,hostRetryTimeout=null;
function getSession(k){try{return JSON.parse(sessionStorage.getItem(k)||'null')}catch(_){return null}}
function putSession(k,v){try{sessionStorage.setItem(k,JSON.stringify(v));return !!sessionStorage.getItem(k)}catch(_){return false}}
function deleteSession(k){try{sessionStorage.removeItem?.(k)}catch(_){}}
function makeToken(){
 let t=getSession(PHONE_TOKEN);
 if(typeof t!=='string'||t.length<12){
  t=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
  putSession(PHONE_TOKEN,t);
 }
 return t;
}
const stablePhoneToken=makeToken();
const compactPlayer=p=>({id:p.id,name:p.name,color:p.color,type:p.type,
 choice:p.choice,token:p.clientToken||null,total:p.total||0});
function saveHost(){
 if(!onlineHost||!roomCode)return false;
 return putSession(HOST_SESSION,{code:roomCode,players:players.map(compactPlayer),
  nextId,selectedSessionMode,autoNext:$('autoNext').checked});
}
function saveOffline(){
 if(onlineHost||currentView!=='hostLobby')return false;
 return putSession(OFFLINE_SESSION,{players:players.filter(p=>p.isBot).map(compactPlayer),
  nextId,selectedSessionMode,autoNext:$('autoNext').checked});
}
function savePhone(){
 const code=parseRoomCode($('roomCodeInput').value);
 return !!(controllerReady&&code)&&putSession(PHONE_SESSION,{code,name:$('nick').value});
}
function restorePlayers(list){
 if(!Array.isArray(list)||list.length>MAX_PLAYERS)return;
 const originalColors=new Set(),ids=new Set();
 players=[];
 for(const a of list){
  if(!a||!/^p\d+$/.test(String(a.id))||ids.has(a.id)||
     !['local','remote'].includes(a.type))continue;
  const savedColor=String(a.color||'').toLowerCase();
  if((!COLORS.includes(savedColor)&&!LEGACY_COLORS.includes(savedColor))||
     originalColors.has(savedColor))continue;
  // Existing new-palette colors are stable; old pastel colors migrate without
  // changing player IDs, names, totals, selections or reconnection tokens.
  const color=COLORS.includes(savedColor)&&!players.some(p=>p.color===savedColor)
   ?savedColor:pickUnusedColor();
  if(!color)continue;
  ids.add(a.id);originalColors.add(savedColor);
  players.push({id:a.id,name:cleanName(a.name),color,type:a.type,
   clientToken:a.token||null,conn:null,input:blankInput(),x:480,y:270,vx:0,vy:0,face:1,
   score:0,total:Number(a.total)||0,choice:Object.hasOwn(MODES,a.choice)?a.choice:null,
   ghost:false,item:null,selecting:false,targetId:null,alive:true,active:false,isBot:a.type==='local'});
 }
 nextId=Math.max(nextId,...players.map(p=>Number(p.id.slice(1))+1));
}
function cancelSeat(id){
 const t=seatTimers.get(id);
 if(t!==undefined&&typeof clearTimeout==='function')clearTimeout(t);
 seatTimers.delete(id);
}
function holdSeat(p){
 if(!p||p.type!=='remote'||p.conn)return;
 cancelSeat(p.id);
 seatTimers.set(p.id,setTimeout(()=>{
  seatTimers.delete(p.id);
  const q=players.find(q=>q.id===p.id);
  if(q&&!q.conn){
   if(boardSession){q.isBot=true;const bp=boardSession.players.find(p=>p.id===q.id);if(bp)bp.isBot=true;}
   else removePlayer(p.id);
  }
 },60000));
}
const canvas=$('arena'), g=canvas.getContext('2d');
function arenaContentRect(rect){
 const width=Number(rect.width)||960,height=Number(rect.height)||540;
 // BOARD PARTY extends its logical map vertically instead of letterboxing
 // the fixed 16:9 world. Keep 960 X units and a uniform physical pixel scale.
 if(round?.mode==='board'&&boardSession&&height/width>540/960){
  return {left:rect.left,top:rect.top,scale:width/960,height:960*height/width};
 }
 const scale=Math.min(width/960,height/540);
 return {left:rect.left+(width-960*scale)/2,top:rect.top+(height-540*scale)/2,scale,height:540};
}
// Host map gestures: drag to pan, pinch to zoom and tap nodes in Debug mode.
// Game input remains exclusively on the controller; pause freezes simulation.
{
 const pointers=new Map();let pinchDistance=0,gestureMoved=false,downAt=null;
 const enabled=()=>round?.mode==='board'&&!!boardSession&&!!window.BoardArt?.canPan(boardSession);
 const coords=e=>{const rect=arenaContentRect(canvas.getBoundingClientRect());
   return {x:(e.clientX-rect.left)/rect.scale,y:(e.clientY-rect.top)/rect.scale};};
 canvas.addEventListener('pointerdown',e=>{
  if(!enabled())return;
  const pt=coords(e),top=94;
  if(pt.x<0||pt.x>960||pt.y<top||pt.y>(boardSession.camera.viewHeight||540)-88)return;
  e.preventDefault();pointers.set(e.pointerId,pt);
  if(pointers.size===1){downAt=pt;gestureMoved=false;pinchDistance=0;}
  else if(pointers.size===2){const q=[...pointers.values()];
   pinchDistance=Math.hypot(q[0].x-q[1].x,q[0].y-q[1].y)||1;gestureMoved=true;}
  try{canvas.setPointerCapture(e.pointerId);}catch(_){}
 });
 canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  if(!enabled()){pointers.clear();return;}
  e.preventDefault();
  const old=pointers.get(e.pointerId),pt=coords(e);pointers.set(e.pointerId,pt);
  if(pointers.size===2){
   const q=[...pointers.values()],newDistance=Math.hypot(q[0].x-q[1].x,q[0].y-q[1].y)||1;
   if(pinchDistance>0&&hostCanControlBoardZoom())window.BoardArt.zoom(boardSession,newDistance/pinchDistance);
   pinchDistance=newDistance;gestureMoved=true;
  }else{
   const dx=pt.x-old.x,dy=pt.y-old.y;
   if(Math.hypot(pt.x-downAt.x,pt.y-downAt.y)>7)gestureMoved=true;
   window.BoardArt.pan(boardSession,dx,dy);
  }
 });
 const release=e=>{
  if(!pointers.has(e.pointerId))return;
  const pt=coords(e);pointers.delete(e.pointerId);
  if(!pointers.size){
   if(!gestureMoved&&enabled())window.BoardArt.inspect(boardSession,pt.x,pt.y);
   downAt=null;pinchDistance=0;
  }
 };
 for(const name of ['pointerup','pointercancel','lostpointercapture'])
  canvas.addEventListener(name,release);
}
// The game world stays at 960x540. Increase the bitmap resolution of the
// *host canvas* to match the screen instead of stretching 960 physical pixels
// across Retina tablets/large monitors. This changes graphics only: coordinates,
// speeds, physics, HUD geometry and the controller's video quality are unchanged.
const ARENA_WIDTH=960,ARENA_HEIGHT=540,MAX_ARENA_SCALE=3;
let arenaResolutionDirty=true,arenaLastDpr=0,arenaLastModeKey='',arenaLastBoxKey='';
function markArenaResolutionDirty(){arenaResolutionDirty=true;}
function syncArenaResolution(){
 const rawDpr=Number(window.devicePixelRatio);
 const dpr=Number.isFinite(rawDpr)&&rawDpr>0?rawDpr:1;
 // Keep the dense 8–12 player board at a still-sharp 2.4x bitmap cap.
 // Its many SVG characters and full terrain would otherwise push tablet GPU
 // memory well above the smaller mini-games. Other games retain 3x quality.
 const denseBoard=round?.mode==='board'&&boardSession?.players.length>=8;
 const modeKey=denseBoard?'board-dense':round?.mode==='board'?'board':'normal';
 const box=canvas.getBoundingClientRect?.();
 const boxKey=(Number(box?.width)||0)+'x'+(Number(box?.height)||0);
 if(!arenaResolutionDirty&&arenaLastDpr===dpr&&arenaLastModeKey===modeKey&&arenaLastBoxKey===boxKey)return;
 arenaResolutionDirty=false;arenaLastDpr=dpr;arenaLastModeKey=modeKey;arenaLastBoxKey=boxKey;
 const boardActive=round?.mode==='board'&&!!boardSession;
 const content=arenaContentRect(box||{width:960,height:540,left:0,top:0});
 if(boardActive){
  const oldHeight=boardSession.camera.viewHeight||540;
  boardSession.camera.viewHeight=content.height;
  if(Math.abs(oldHeight-content.height)>.1&&boardSession.camera.overview)window.BoardArt?.overview?.(boardSession);
 }
 if(boardActive&&box?.width){
  const toolScale=content.scale,originX=content.left,originY=content.top;
  $('boardTools').style.cssText='left:'+(originX+600*toolScale)+'px;top:'+(originY+99*toolScale)+'px;transform:scale('+toolScale+');';
  $('pauseBtn').style.cssText='left:'+(originX+921*toolScale)+'px;top:'+(originY+101*toolScale)+'px;transform:scale('+toolScale+');';
   // Right-align the full-size red Exit button with the tiny Pause control.
   $('boardExitBtn').style.cssText='left:'+(originX+872*toolScale)+'px;top:'+(originY+135*toolScale)+'px;transform:scale('+toolScale+');';
 }else {$('pauseBtn').style.cssText='';$('boardExitBtn').style.cssText='';}
 // Long/short sides are intentional: portrait fallback may rotate the
 // host canvas by 90 degrees without changing the game world's coordinates.
 const longSide=Math.max(Number(box?.width)||0,Number(box?.height)||0);
 const shortSide=Math.min(Number(box?.width)||0,Number(box?.height)||0);
 const displayScale=longSide>0&&shortSide>0?
   Math.max(longSide/ARENA_WIDTH,shortSide/ARENA_HEIGHT):1;
 const logicalHeight=boardActive?content.height:ARENA_HEIGHT;
 const screenScale=boardActive&&box?.width?content.scale:displayScale;
 // Cap the portrait/split-screen board bitmap budget at 3.6 MP.
 const bitmapBudget=boardActive?Math.sqrt(3600000/(ARENA_WIDTH*logicalHeight)):MAX_ARENA_SCALE;
 const scale=Math.min(denseBoard?2.4:MAX_ARENA_SCALE,bitmapBudget,Math.max(1,screenScale*dpr));
 const width=Math.round(ARENA_WIDTH*scale);
 const height=Math.round(logicalHeight*scale);
 if(canvas.width!==width||canvas.height!==height){
   canvas.width=width;canvas.height=height;
 }
 // Setting canvas.width/height clears all context state. Restore the
 // pixel-to-world transform so existing game engines still draw 960x540.
 g.setTransform(width/ARENA_WIDTH,0,0,height/logicalHeight,0,0);
 g.imageSmoothingEnabled=true;
 g.imageSmoothingQuality='high';
}
window.addEventListener('resize',markArenaResolutionDirty);
window.addEventListener('orientationchange',markArenaResolutionDirty);
window.visualViewport?.addEventListener?.('resize',markArenaResolutionDirty);
document.addEventListener('fullscreenchange',markArenaResolutionDirty);
document.addEventListener('webkitfullscreenchange',markArenaResolutionDirty);
canvas.addEventListener('contextrestored',markArenaResolutionDirty);
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const cleanName=(value)=>String(value||'').trim().replace(/[<>]/g,'').slice(0,14)||'เพื่อนใหม่';
const blankInput=()=>({left:false,right:false,jump:false,down:false,action:false,alt:false,cancel:false,axisX:0,axisY:0});
function setStatus(text,bad=false){$('netStatus').textContent=text;$('netDot').classList.toggle('bad',bad);}

let toastHandle=null,pendingConfirmation=null;
function showToast(message,bad=false){
 const box=$('uiToast');box.textContent=message;
 box.classList.toggle('bad',!!bad);box.classList.add('visible');
 if(toastHandle!==null&&typeof clearTimeout==='function')clearTimeout(toastHandle);
 toastHandle=setTimeout(()=>box.classList.remove('visible'),3000);
}
function confirmAction(message,{title='ยืนยันการทำรายการ',confirmLabel='ตกลง',danger=false}={}){
 if(pendingConfirmation)return Promise.resolve(false);
 $('uiModalTitle').textContent=title;
 $('uiConfirmBtn').textContent=confirmLabel;
 $('uiConfirmBtn').classList.toggle('confirm-danger',danger);
 $('uiModalText').textContent=message;$('uiModal').classList.remove('hidden');
 return new Promise(resolve=>{pendingConfirmation=resolve;});
}
function finishConfirmation(answer){
 $('uiModal').classList.add('hidden');
 $('uiModalTitle').textContent='ยืนยันการทำรายการ';
 $('uiConfirmBtn').textContent='ตกลง';
 $('uiConfirmBtn').classList.remove('confirm-danger');
 const resolve=pendingConfirmation;pendingConfirmation=null;
 if(resolve)resolve(answer);
}

// Only lock page zoom while playing. Keep the lobby and nickname form accessible.
const FREE_VIEWPORT='width=device-width,initial-scale=1,viewport-fit=cover';
const LOCKED_VIEWPORT='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
const gameZoomLocked=()=>currentView==='game'||(currentView==='controller'&&controllerReady);
// Browser/OS chrome cannot be hidden by page gestures. Installed iOS Home
// Screen Web Apps run standalone; offer that supported path for Chrome users.
const isIOSBrowser=()=>{
 const ua=String(navigator?.userAgent||''),platform=String(navigator?.platform||'');
 return /iPad|iPhone|iPod/.test(ua)||(platform==='MacIntel'&&Number(navigator?.maxTouchPoints)>1);
};
const isStandaloneWebApp=()=>navigator?.standalone===true||
  !!window.matchMedia?.('(display-mode: standalone)')?.matches||
  !!window.matchMedia?.('(display-mode: fullscreen)')?.matches;
let hostFullscreenWasEntered=false;
function syncWebAppHelp(){
 const show=currentView==='game'&&isIOSBrowser()&&!isStandaloneWebApp();
 $('webAppHelpBtn').classList.toggle('hidden',!show);
 if(!show){
  $('webAppHelp').classList.add('hidden');
  $('webAppHelpBtn').setAttribute('aria-expanded','false');
 }
}
function syncFullscreenRecovery(){
 const show=currentView==='game'&&hostFullscreenWasEntered&&
   !document.fullscreenElement&&!isStandaloneWebApp();
 $('restoreHostFullscreenBtn').classList.toggle('hidden',!show);
}
function syncZoomPolicy(){
  const locked=gameZoomLocked();
  $('viewportMeta').setAttribute('content',locked?LOCKED_VIEWPORT:FREE_VIEWPORT);
  document.body.classList.toggle('zoom-locked',locked);
}
function setView(view) {
  currentView=view;
  if(view==='game')markArenaResolutionDirty();
  ['home','hostLobby','game','controller'].forEach(v=>$(v).classList.toggle('hidden',v!==view));
  document.body.classList.toggle('host-playing',view==='game');
  if(view!=='game')hostFullscreenWasEntered=false;
  syncZoomPolicy();syncWebAppHelp();syncFullscreenRecovery();
  // A joined QR link can open directly on the room-code form; try native
  // landscape without blocking the form if automatic rotation is disallowed.
  if(view==='controller'&&!controllerReady)tryLandscapeOrientation();
  window.scrollTo(0,0);
  window.GameAutoUpdate?.onSafePoint();
}
function tryLandscapeOrientation(){
  // Browsers may require fullscreen plus a direct user gesture. Failure must
  // never block the game, the room-code form or other controls.
  try{
    const lock=window.screen?.orientation?.lock;
    if(typeof lock!=='function')return;
    const result=lock.call(window.screen.orientation,'landscape');
    if(result&&typeof result.catch==='function')result.catch(()=>{});
  }catch(_){/* The device/browser controls physical orientation. */}
}
// Restore the original fullscreen behavior on any browser that supports it.
// Browser/OS permission prompts remain under the browser's control.
function requestHostFullscreen(){
  // A Home Screen Web App already has no browser bars. Entering the native
  // Fullscreen API again would reintroduce iOS swipe-to-dismiss behavior.
  if(isStandaloneWebApp()){tryLandscapeOrientation();return;}
  const root=document.documentElement;
  let request=null;
  try{
    if(root&&root.requestFullscreen&&!document.fullscreenElement)
      request=root.requestFullscreen({navigationUI:'hide'});
  }catch(_){/* Browser may deny native fullscreen. */}
  if(request&&typeof request.then==='function')
    request.then(()=>{
      if(document.fullscreenElement)hostFullscreenWasEntered=true;
      syncFullscreenRecovery();tryLandscapeOrientation();
    },()=>{syncFullscreenRecovery();tryLandscapeOrientation();});
  else {syncFullscreenRecovery();tryLandscapeOrientation();}
}
function trackHostFullscreen(){
 if(document.fullscreenElement===document.documentElement)
  hostFullscreenWasEntered=true;
 syncFullscreenRecovery();
}
document.addEventListener('fullscreenchange',trackHostFullscreen);
document.addEventListener('webkitfullscreenchange',trackHostFullscreen);
// Safari may ignore viewport scaling hints for gesture zoom; guard native gestures
// only in gameplay, without preventing Pointer Events on analog and A/B buttons.
for(const type of ['gesturestart','gesturechange','gestureend']){
  document.addEventListener(type,e=>{if(gameZoomLocked()&&e.cancelable)e.preventDefault();},{passive:false});
}
document.addEventListener('touchmove',e=>{
  if(gameZoomLocked()&&e.touches&&e.touches.length>1&&e.cancelable)e.preventDefault();
},{passive:false});
// Block document scrolling/rubber-banding during a host game, but keep
// Pointer Events for map panning, canvas input and the user's normal taps.
document.addEventListener('touchmove',e=>{
  if(currentView==='game'&&e.cancelable&&e.target?.closest?.('#game'))
    e.preventDefault();
},{passive:false,capture:true});
document.addEventListener('dblclick',e=>{
  if(gameZoomLocked()&&e.cancelable)e.preventDefault();
},{passive:false});
// Ignore the browser's default double-tap zoom for the canvas, local pads and
// controller buttons. Do not cancel regular taps or button click events.
let lastGameTapTime=0,lastGameTapTarget=null;
document.addEventListener('touchend',e=>{
  if(!gameZoomLocked()||!e.cancelable||!e.target||typeof e.target.closest!=='function')return;
  if(!e.target.closest('#arena,.game-frame,.pad-buttons,.controller-buttons'))return;
  const now=Date.now();
  if(e.changedTouches&&e.changedTouches.length===1&&lastGameTapTarget===e.target&&now-lastGameTapTime<310){
    e.preventDefault();
  }
  lastGameTapTime=now;lastGameTapTarget=e.target;
},{passive:false});
function randomCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789', data=new Uint8Array(6);
  if(window.crypto&&crypto.getRandomValues)crypto.getRandomValues(data);
  else for(let i=0;i<6;i++)data[i]=Math.floor(Math.random()*256);
  return Array.from(data,x=>chars[x%chars.length]).join('');
}
function makePlayer(name,type,conn) {
  if(players.length>=MAX_PLAYERS)return null;
  const color=pickUnusedColor();
  if(!color)return null;
  const p={id:'p'+nextId++,name:cleanName(name),type,color,conn:conn||null,
    input:blankInput(),x:480,y:270,vx:0,vy:0,face:1,score:0,total:0,
    choice:type==='local'?'ghost':null,
    ghost:false,item:null,selecting:false,targetId:null,alive:true,active:false,
    isBot:type==='local'};
  players.push(p);renderRoster();return p;
}
function removePlayer(id) {
  const at=players.findIndex(p=>p.id===id);
  if(at<0)return;
  cancelSeat(id);
  lobbyReadyVotes.delete(id);
  const p=players[at];
  if(p.conn)stopHostVideoCall(p.conn);
  if(boardSession&&boardSession.phase!=='finished'){
    p.isBot=true;p.input=blankInput();const bp=boardSession.players.find(q=>q.id===id);if(bp)bp.isBot=true;
    if(p.conn?.open)try{p.conn.close();}catch(_){}
    p.conn=null;renderRoster();broadcastRoster();return;
  }
  players.splice(at,1);
  if(round?.mode==='shockwave'&&round.phase==='playing'){
    window.Shockwave.checkWinner(round.shockwave,players);
    if(round.shockwave.finished)endRound();
  }
  // Remove from roster BEFORE closing, which can synchronously emit a close event.
  if(p.conn&&p.conn.open){try{p.conn.close();}catch(e){}}
  renderRoster();broadcastRoster();
  if(['results','summary'].includes(round?.phase))renderResultVotes(true);
}
function playerPublic(p){return {id:p.id,name:p.name,color:p.color,type:p.type,active:p.active,choice:p.choice,eliminated:!!((round?.mode==='shockwave'&&p.active&&!p.shockAlive)||(round?.mode==='witching_snake'&&p.active&&!p.ws?.alive)||(round?.mode==='gladiators'&&p.active&&!p.gladiator?.alive))};}
function send(conn,msg){if(conn&&conn.open){try{conn.send(msg);}catch(e){/* peer disconnected */}}}
function broadcast(msg){hostConnections.forEach(c=>send(c,msg));}
// Low-bandwidth game view for phone controllers (no microphone, no screen capture).
// Reuses the authoritative host canvas and transmits a small compressed frame.
const remotePreviewCanvas=document.createElement('canvas');
remotePreviewCanvas.width=256;
remotePreviewCanvas.height=144;
const remotePreviewContext=remotePreviewCanvas.getContext('2d',{alpha:false});
let remotePreviewClock=0;
// Native WebRTC MediaStreams are sent at the user's selected resolution.
// 12 parallel streams may exceed consumer uplink bandwidth; still-picture
// fallback remains available when media negotiation or capture is unsupported.
// Video quality controls ONLY the number of output pixels, never frame rate.
// captureStream() without a frameRate tracks canvas changes at the browser's
// natural rate; the game loop never throttles frames according to this setting.
// Browsers/encoders/networks may still adapt delivered FPS independently.
const VIDEO_QUALITY={
  low:{width:256,height:144},
  medium:{width:960,height:540},
  high:{width:1280,height:720},
  auto:null
};
function normalizeAutoHeight(value){
  const n=Number(value);
  if(!Number.isFinite(n)||n<=0)return 540;
  // Bound allocations from untrusted controller metadata. Choose even pixels.
  return Math.round(Math.max(144,Math.min(2160,n))/2)*2;
}
const hostVideoSources=new Map();
const hostVideoCalls=new Map();
function getHostVideoSource(quality,autoHeight){
  const selected=Object.hasOwn(VIDEO_QUALITY,quality)?quality:'medium';
  const h=selected==='auto'?normalizeAutoHeight(autoHeight):VIDEO_QUALITY[selected].height;
  const spec=selected==='auto'?{width:Math.round(h*16/9/2)*2,height:h}:VIDEO_QUALITY[selected];
  // Sharing sources by pixel dimensions avoids extra encoding work when users
  // choose equal effective resolution through different quality settings.
  const key=spec.width+'x'+spec.height;
  if(hostVideoSources.has(key))return hostVideoSources.get(key);
  const sourceCanvas=document.createElement('canvas');
  sourceCanvas.width=spec.width;sourceCanvas.height=spec.height;
  const context=sourceCanvas.getContext('2d',{alpha:false});
  if(!context||typeof sourceCanvas.captureStream!=='function')return null;
  let stream;
  try{
    context.drawImage(canvas,0,0,spec.width,spec.height);
    stream=sourceCanvas.captureStream();
  }catch(_){return null;}
  const source={canvas:sourceCanvas,context,stream};
  hostVideoSources.set(key,source);
  return source;
}
function releaseHostVideoSourcesWhenIdle(){
  if(hostVideoCalls.size!==0)return;
  // Stop captureStream tracks when no phone is watching.
  for(const source of hostVideoSources.values()){
    if(source.stream?.getTracks)source.stream.getTracks().forEach(track=>{
      try{track.stop();}catch(_){}
    });
  }
  hostVideoSources.clear();
}
function renderHostVideoFrames(){
  if(!round||hostVideoCalls.size===0)return;
  for(const source of hostVideoSources.values()){
    try{source.context.drawImage(canvas,0,0,source.canvas.width,source.canvas.height);}
    catch(_){}
  }
}
function stopHostVideoCall(conn){
  const call=hostVideoCalls.get(conn);
  hostVideoCalls.delete(conn);
  if(call)try{call.close();}catch(_){}
  conn.videoReady=false;
  releaseHostVideoSourcesWhenIdle();
}
function stopAllHostVideoCalls(){
  for(const conn of [...hostVideoCalls.keys()])stopHostVideoCall(conn);
  for(const source of hostVideoSources.values()){
    if(source.stream&&source.stream.getTracks)
      source.stream.getTracks().forEach(track=>{try{track.stop();}catch(_){}});
  }
  hostVideoSources.clear();
}
function startHostVideoCall(conn){
  if(!round||round.phase==='roulette'||!hostPeer||!onlineHost||!conn||!conn.open||!conn.playerId||conn.previewEnabled!==true)return;
  stopHostVideoCall(conn);
  conn.videoReady=false;
  const quality=Object.hasOwn(VIDEO_QUALITY,conn.videoQuality)?conn.videoQuality:'medium';
  const source=getHostVideoSource(quality,conn.videoAutoHeight);
  if(!source||typeof hostPeer.call!=='function')return;
  try{
    const call=hostPeer.call(conn.peer,source.stream,{metadata:{type:'game-video',quality}});
    if(!call)return;
    hostVideoCalls.set(conn,call);
    call.on('close',()=>{
      if(hostVideoCalls.get(conn)!==call)return;
      hostVideoCalls.delete(conn);conn.videoReady=false;
      releaseHostVideoSourcesWhenIdle();
    });
    call.on('error',()=>{
      if(hostVideoCalls.get(conn)!==call)return;
      hostVideoCalls.delete(conn);conn.videoReady=false;
      releaseHostVideoSourcesWhenIdle();
    });
  }catch(_){/* Fall back to the low-rate JPEG preview. */}
}
function broadcastGamePreview(){
  if(!round||!onlineHost||!remotePreviewContext||hostConnections.size===0)return;
  const active=[...hostConnections].filter(c=>
    c.open&&c.playerId&&c.previewEnabled===true&&!c.videoReady&&
    (!c.dataChannel||c.dataChannel.bufferedAmount<65536));
  if(!active.length||typeof remotePreviewCanvas.toDataURL!=='function')return;
  try{
    remotePreviewContext.drawImage(canvas,0,0,256,144);
    let image=remotePreviewCanvas.toDataURL('image/jpeg',.28);
    // Keep PeerJS packets small for slow mobile connections.
    if(image.length>24000){
      remotePreviewCanvas.width=192;remotePreviewCanvas.height=108;
      remotePreviewContext.drawImage(canvas,0,0,192,108);
      image=remotePreviewCanvas.toDataURL('image/jpeg',.2);
      // Resize back immediately so no subsequent frames are cropped.
      remotePreviewCanvas.width=256;remotePreviewCanvas.height=144;
    }
    if(!image.startsWith('data:image/jpeg;base64,')||image.length>24000)return;
    const packet={t:'preview',image,mode:round.mode};
    active.forEach(conn=>send(conn,packet));
  }catch(_){/* Some browsers may not support encoding; game input stays usable. */}
}
function networkPhase(){return round?(round.paused?'paused':round.phase):'lobby';}
function lobbyReadySnapshot(){
  // Votes from removed seats are dropped; bot seats count as ready without a phone.
  const seats=new Set(players.map(p=>p.id));
  for(const id of lobbyReadyVotes)if(!seats.has(id))lobbyReadyVotes.delete(id);
  return {
    ready:players.filter(p=>p.isBot||lobbyReadyVotes.has(p.id)).length,
    total:players.length,
    voted:[...lobbyReadyVotes]
  };
}
function castLobbyReadyVote(conn){
  if(round||gameSelection||currentView!=='hostLobby'||!conn?.playerId)return false;
  const p=players.find(p=>p.id===conn.playerId&&p.conn===conn&&p.type==='remote');
  if(!p)return false;
  if(lobbyReadyVotes.has(p.id))lobbyReadyVotes.delete(p.id);
  else lobbyReadyVotes.add(p.id);
  renderRoster();
  broadcastRoster();
  const count=lobbyReadySnapshot();
  // Only an explicit A press starts a unanimous lobby, never a player removal.
  if(count.total>0&&count.ready===count.total&&!$('startBtn').disabled)beginParty();
  return true;
}
function broadcastRoster(){
  broadcast({t:'roster',players:players.map(playerPublic),phase:networkPhase(),
    mode:round?round.mode:'ghost',selectionOpen:!round&&selectedSessionMode!=='board',
    sessionMode:selectedSessionMode,lobbyReady:lobbyReadySnapshot()});
  if(round?.mode==='board')broadcastBoardState();
  if(onlineHost)saveHost();else saveOffline();
}
function nominatedGames(){
  return players.map(p=>p.choice).filter(mode=>Object.hasOwn(MODES,mode));
}
function updateHostQueue(){$('hostQueue').textContent='';}
function sendPlayerInventory(conn){
  // Game-specific metadata must never leak into the lobby or another game's UI.
  if(!conn||!conn.playerId||!round||
     !['countdown','playing','paused'].includes(networkPhase()))return;
  const p=players.find(q=>q.id===conn.playerId);
  if(!p)return;
  if(round.mode==='snow_brawl'){
     const sb=p.snow||{},held=round.snowBrawl?.balls.find(b=>b.id===sb.ballId);
     send(conn,{t:'snow-status',mode:round.mode,phase:networkPhase(),
       alive:!!sb.alive,windup:Math.max(0,sb.windup||0),flat:Math.max(0,sb.flat||0),
       ballRadius:held?.r||0,survivors:round.snowBrawl?.roster.filter(q=>q.active&&q.snow?.alive).length||0});
     return;
   }
   if(round.mode==='boulder_bash'){
    const b=p.bb||{};
    send(conn,{t:'boulder-status',mode:round.mode,phase:networkPhase(),
      status:b.mode||'alive',cooldown:b.pushCooldown||0,
      survivorCount:round.boulderBash?.roster.filter(q=>q.active&&q.bb?.alive).length||0});
    return;
  }
  if(round.mode==='color_claim'){
    send(conn,{t:'claim-status',mode:round.mode,phase:networkPhase(),percent:p.score||0,
      frozen:window.ColorClaim.freezeActive(round.colorClaim,p),
      eliminated:!!p.cc?.eliminated,alive:!!p.cc?.alive});return;
  }
  if(round.mode==='gladiators'){
    const st=p.gladiator||{},ball=st.ball||{};
    send(conn,{t:'gladiators-status',mode:round.mode,phase:networkPhase(),alive:!!st.alive,
      survivors:window.Gladiators.hud(players,round).survivors,
      ball:{x:ball.x||0,y:ball.y||0,vx:ball.vx||0,vy:ball.vy||0},
      chain:{x:st.anchorX||0,y:st.anchorY||0},eliminatedTick:st.eliminatedTick});return;
  }
  if(round.mode==='witching_snake'){
     send(conn,{t:'witch-status',mode:round.mode,phase:networkPhase(),alive:!!p.ws?.alive,stars:p.ws?.stars||0});return;
   }
   if(round.mode==='ice_race'){
    send(conn,{t:'ice-status',mode:round.mode,phase:networkPhase(),score:p.score||0,
      nextCheckpoint:p.ice?.nextCheckpoint??1,falling:p.ice?.state==='falling'});return;
   }
   if(round.mode==='lawn_mower'){
    const status=window.LawnMower.playerStatus(p);
    if(status)send(conn,{t:'lawn-status',phase:networkPhase(),...status});
    return;
   }
   if(round.mode==='shopping_time'){
    const status=window.ShoppingTime.playerStatus(p);
    if(status)send(conn,{t:'shopping-status',phase:networkPhase(),...status});
    return;
  }
  if(round.mode==='pizza_time'){
    const status=window.PizzaTime.playerStatus(p);
    if(status)send(conn,{t:'pizza-status',phase:networkPhase(),...status});
    return;
  }
  if(round.mode==='fruit_memory'){
    send(conn,{t:'fruit-status',mode:round.mode,phase:networkPhase(),
      cooldown:Math.max(0,p.fruitCooldown||0),eliminated:!p.fruitAlive,stun:p.fruitStun||0});return;
  }
  if(round.mode==='chickens'){
    send(conn,{t:'chicken-status',mode:round.mode,phase:networkPhase(),
      cooldown:Math.max(0,p.chickenAttackCooldown||0),
      carrying:p.carriedChickenId!=null});
    return;
  }
  if(round.mode==='color_switch'){
    const cs=p.cs||{};
    send(conn,{t:'color-status',mode:round.mode,phase:networkPhase(),score:p.score||0,
      stun:cs.stunRemaining||0,cooldownA:cs.punchCooldown||0,
      cooldownB:cs.blastCooldown||0,
      bankedScore:cs.bankedScore||0,territoryScore:cs.territoryScore||0});return;
  }
  if(round.mode==='shockwave'){
     send(conn,{t:'shockwave-status',mode:round.mode,phase:networkPhase(),eliminated:!p.shockAlive,wave:round.shockwave?.wave||0});return;
   }
   if(round.mode!=='ghost')return;
  const info=window.GhostAttack.itemStatus(players).find(q=>q.id===p.id);
  if(info)send(conn,{t:'inventory',mode:round.mode,phase:networkPhase(),...info});
}
function broadcastPlayerInventories(){
  for(const conn of hostConnections)sendPlayerInventory(conn);
}
function renderPauseChoiceList(){
  const box=$('gameChoiceList');box.replaceChildren();
  for(const p of players){
    const row=document.createElement('div');row.className='game-choice-row';
    row.textContent=p.name+' — '+(MODES[p.choice]||'ยังไม่ได้เลือก');
    row.style.borderLeftColor=p.color;box.append(row);
  }
}
function renderRoster(){
  const el=$('roster');el.replaceChildren();
  const bots=players.filter(p=>p.isBot);
  const changeAll=$('cycleAllBotsBtn');
  const canBulkSelect=bots.length>0&&selectedSessionMode!=='board'&&!round;
  changeAll.classList.toggle('hidden',bots.length===0||selectedSessionMode==='board');
  document.body.classList.toggle('board-lobby',selectedSessionMode==='board');
  changeAll.disabled=!canBulkSelect;
  changeAll.textContent='เปลี่ยนเกม '+bots.length+' ตัว';
  changeAll.setAttribute('aria-label','เปิดรายการเลือกเกมสำหรับบอท '+bots.length+' ตัว');
  changeAll.setAttribute('aria-haspopup','dialog');
  changeAll.setAttribute('aria-expanded',String(!$('bulkBotPicker').classList.contains('hidden')));
  changeAll.title='เลือกเกมหนึ่งเกมสำหรับบอททุกตัว โดยไม่เปลี่ยนเกมของผู้เล่นมือถือ';
  if(!canBulkSelect)closeBulkBotPicker(false);
  $('rosterCount').textContent=players.length+'/'+MAX_PLAYERS;
  // Reserve ALL twelve positions from room creation. Joined players replace
  // numbered placeholders, never change the number or size of grid rows.
  const columns=window.matchMedia?.('(orientation:portrait) and (max-width:720px)')?.matches?2:3;
  el.style.setProperty('--roster-cols',String(columns));
  el.style.setProperty('--roster-rows',String(MAX_PLAYERS/columns));
  $('addLocalBtn').disabled=players.length>=MAX_PLAYERS;
  $('startBtn').disabled=players.length<1||(selectedSessionMode==='queue'&&nominatedGames().length!==players.length);
  const readyCount=lobbyReadySnapshot();
  const startText=selectedSessionMode==='board'?'เริ่ม BOARD PARTY':selectedSessionMode==='endless'?'เริ่มเล่นทุกเกม ▶':'สุ่มและเริ่มเล่น ▶';
  $('startBtn').textContent=startText+'  '+readyCount.ready+'/'+readyCount.total;
  updateHostQueue();
  players.forEach(p=>{
    const item=document.createElement('div');item.className='roster-item';
    item.title=p.name+' — '+(MODES[p.choice]||'ยังไม่ได้เลือกเกม');
    const color=document.createElement('span');color.className='swatch';color.style.background=p.color;
    const name=document.createElement('b');name.textContent=p.name;
    const type=document.createElement('small');type.textContent=p.isBot?'บอท':'มือถือ';
    const chosen=document.createElement('span');chosen.className='roster-pick'+(p.choice?' picked':'');
    if(selectedSessionMode==='board'){chosen.textContent='พร้อมผจญภัยบนกระดาน';}
    else if(p.choice){
      const label=document.createElement('span');label.className='mode-choice-title';
      label.textContent=MODES[p.choice];chosen.append(gameCover(p.choice),label);
    }else chosen.textContent='ยังไม่เลือกเกม';
    chosen.title=p.choice?MODES[p.choice]:'ยังไม่ได้เลือกเกม';
    if(p.isBot&&selectedSessionMode!=='board'){
      chosen.title='คลิกหรือกด Enter เพื่อสลับเกมของบอท';
      chosen.tabIndex=0;chosen.setAttribute('role','button');
      chosen.setAttribute('aria-label','เปลี่ยนเกม '+p.name+' ปัจจุบัน '+(MODES[p.choice]||'ยังไม่เลือก'));
      const cycle=()=>{
        if(round)return;
        const modes=modesFor('normal');p.choice=modes[(modes.indexOf(p.choice)+1)%modes.length];
        renderRoster();broadcastRoster();
      };
      chosen.addEventListener('click',cycle);
      chosen.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){e.preventDefault();cycle();}
      });
    }
    const kick=document.createElement('button');kick.type='button';kick.textContent='×';kick.title='เอาผู้เล่นออก';kick.setAttribute('aria-label','เอา '+p.name+' ออกจากห้อง');
    kick.addEventListener('click',()=>removePlayer(p.id));
    item.append(color,name,type,chosen,kick);el.append(item);
  });
  // All unoccupied positions remain visible, including in a brand-new room.
  // They use the SAME fixed grid tracks as the real player cards.
  for(let slot=players.length;slot<MAX_PLAYERS;slot++){
    const item=document.createElement('div');
    item.className='roster-item roster-empty';
    item.title='ช่องผู้เล่น '+(slot+1)+' • รอผู้เล่น';
    item.setAttribute('aria-label','ช่องผู้เล่น '+(slot+1)+' รอผู้เล่น');
    const marker=document.createElement('span');marker.className='swatch';
    const name=document.createElement('b');name.textContent='ช่อง '+(slot+1);
    const waiting=document.createElement('span');
    waiting.className='roster-pick roster-waiting';
    waiting.textContent='รอผู้เล่น';
    item.append(marker,name,waiting);
    el.append(item);
  }
  if(onlineHost)saveHost();else saveOffline();
}
// Host-only modal: choose a specific game for all local bots without cycling.
function closeBulkBotPicker(returnFocus=true){
  const overlay=$('bulkBotPicker');
  if(overlay.classList.contains('hidden'))return;
  overlay.classList.add('hidden');
  $('cycleAllBotsBtn').setAttribute('aria-expanded','false');
  if(returnFocus&&currentView==='hostLobby')$('cycleAllBotsBtn').focus?.();
}
function openBulkBotPicker(){
  if(round||currentView!=='hostLobby'||selectedSessionMode==='board')return;
  const bots=players.filter(p=>p.isBot);
  if(!bots.length)return;
  const overlay=$('bulkBotPicker'),choices=$('bulkBotPickerChoices');
  choices.replaceChildren();
  $('bulkBotPickerTitle').textContent='เลือกเกมให้บอท '+bots.length+' ตัว';
  const common=bots.every(p=>p.choice===bots[0].choice)?bots[0].choice:null;
  let focusChoice=null;
  for(const [mode,title] of Object.entries(MODES)){
    if(!modesFor('normal').includes(mode))continue;
    const button=document.createElement('button');
    button.type='button';
    button.className='bulk-bot-game-choice';
    button.dataset.mode=mode;
    const selected=mode===common;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
    button.setAttribute('aria-label',title+' • เลือกให้บอททั้งหมด');
    const label=document.createElement('span');
    label.className='bulk-bot-game-name';label.textContent=title;
    button.append(gameCover(mode),label);
    button.addEventListener('click',()=>{
      if(overlay.classList.contains('hidden')||round||currentView!=='hostLobby'||
         selectedSessionMode==='board')return;
      const currentBots=players.filter(p=>p.isBot);
      if(!currentBots.length){closeBulkBotPicker(false);return;}
      currentBots.forEach(p=>{p.choice=mode;lobbyReadyVotes.delete(p.id);});
      closeBulkBotPicker(false);
      renderRoster();
      broadcastRoster();
      $('cycleAllBotsBtn').focus?.();
    });
    choices.append(button);
    if(selected||!focusChoice)focusChoice=button;
  }
  overlay.classList.remove('hidden');
  $('cycleAllBotsBtn').setAttribute('aria-expanded','true');
  focusChoice?.focus?.();
}
function addLocal(){
  if(players.length>=MAX_PLAYERS){showToast('ห้องเต็ม '+MAX_PLAYERS+' คน',true);return;}
  let number=1;while(players.some(p=>p.name==='บอท '+number))number++;
  makePlayer('บอท '+number,'local');broadcastRoster();
}
// On-host test pad: a local bot can be temporarily piloted without adding a seat.
// Minigames already honor p.isBot; BOARD PARTY has a distinct copied bot flag.
let possessedBotId=null,botUnlimitedBackup=null,botTestClock=0;
const botPadKeys={axisX:0,axisY:0,action:false,alt:false,cancel:false};
function canUseBotTest(){
 return players.length>0&&players.every(p=>p.type==='local'&&(p.isBot||p.id===possessedBotId));
}
function botBoardPlayer(id=possessedBotId){
 return boardSession?.players.find(p=>p.id===id)||null;
}
function applyBotPadKeys(){
 const p=players.find(p=>p.id===possessedBotId);
 if(!p||p.isBot)return;
 p.input=p.input||blankInput();
 p.input.axisX=botPadKeys.axisX;p.input.axisY=botPadKeys.axisY;
 p.input.left=botPadKeys.axisX<-.3;p.input.right=botPadKeys.axisX>.3;
 p.input.jump=botPadKeys.axisY<-.3;p.input.down=botPadKeys.axisY>.3;
 p.input.action=botPadKeys.action;p.input.alt=botPadKeys.alt;p.input.cancel=botPadKeys.cancel;
}
function clearBotPadKeys(){
 botPadKeys.axisX=0;botPadKeys.axisY=0;botPadKeys.action=false;botPadKeys.alt=false;botPadKeys.cancel=false;
 const knob=$('botTestKnob');if(knob)knob.style.transform='translate(-50%,-50%)';
 for(const id of ['botTestA','botTestB','botTestC'])$(id).classList.remove('pressed');
 applyBotPadKeys();
}
function disableInfiniteBotItems(){
 if(!botUnlimitedBackup)return;
 const bp=botBoardPlayer(botUnlimitedBackup.id);
 if(bp){
  bp.debugUnlimitedItems=false;
  // Test-only injected rewards never permanently leak into ordinary gameplay.
  bp.bag=[...botUnlimitedBackup.bag];
  bp.item=botUnlimitedBackup.item;
  bp.usedRound=botUnlimitedBackup.usedRound;
  bp.actionIndex=0;bp.bagMessage='';
 }
 botUnlimitedBackup=null;
}
function releaseBotPossession(){
 if(!possessedBotId)return;
 clearBotPadKeys();
 disableInfiniteBotItems();
 const id=possessedBotId,p=players.find(p=>p.id===id),bp=botBoardPlayer(id);
 if(p){p.isBot=true;p.input=blankInput();}
 if(bp){
  bp.isBot=true;delete boardSession.inputs[id];
  // An AI takeover must never inherit a half-aimed cast from a human.
  // Refund the unchanged item and resume this turn from the roll selector.
  if(boardSession.phase==='aim'&&boardSession.skill&&window.BoardParty.current(boardSession)?.id===id){
   window.BoardParty.ready(boardSession);
   bp.actionIndex=0;bp.botItemAttemptKey=boardSession.roundNumber+':'+boardSession.turnIndex;
  }
 }
 possessedBotId=null;
 renderBotTestPad();
}
function possessBot(id){
 if(!round||currentView!=='game'||!canUseBotTest())return false;
 const p=players.find(q=>q.id===id&&q.type==='local');
 if(!p||(p.id!==possessedBotId&&!p.isBot))return false;
 if(possessedBotId&&possessedBotId!==id)releaseBotPossession();
 possessedBotId=id;p.isBot=false;p.input=blankInput();
 const bp=botBoardPlayer(id);if(bp){bp.isBot=false;delete boardSession.inputs[id];}
 clearBotPadKeys();renderBotTestPad();return true;
}
function toggleInfiniteBotItems(){
 if(!possessedBotId||round?.mode!=='board'||!boardSession||round.phase!=='playing')return false;
 const bp=botBoardPlayer();
 if(!bp||bp.isBot)return false;
 if(botUnlimitedBackup){disableInfiniteBotItems();renderBotTestPad();return true;}
 const inventory=window.BoardItems.bag(bp);
 botUnlimitedBackup={id:bp.id,bag:[...inventory],item:bp.item,usedRound:bp.usedRound};
 for(const item of window.BoardItems.ids)if(!inventory.includes(item))window.BoardItems.add(bp,item);
 bp.debugUnlimitedItems=true;bp.actionIndex=0;bp.bagMessage='';
 renderBotTestPad();return true;
}
// Read-only scene inspection is ONLY for the all-bot local host and GHOST ATTACK.
function canInspectGhostMap(){
 return currentView==='game'&&round?.mode==='ghost'&&!!round.ghost&&
  !gameSelection&&!['results','summary'].includes(round.phase)&&canUseBotTest();
}
function renderGhostMapInspector(){
 const eligible=canInspectGhostMap(),state=round?.ghost;
 const active=eligible&&!!state.showObstacleIds;
 $('botGhostIdsBtn').classList.toggle('hidden',!eligible);
 $('botGhostIdsBtn').setAttribute('aria-pressed',String(active));
 $('ghostMapInspector').classList.toggle('hidden',!active);
 if(!active)return;
 const info=window.GhostAttack.mapInfo(round);
 $('ghostMapName').textContent='GHOST ATTACK · '+info.name;
 $('ghostMapDetails').textContent='แมพ '+info.id+' · '+info.width+' × '+info.height+
  ' · สิ่งกีดขวาง '+info.count+' ชิ้น';
 const prop=state.obstacles.find(o=>o.id===state.selectedObstacleId);
 $('ghostObjectDetails').textContent=prop?
  'ID '+prop.id+' · '+prop.kind+' (แบบ '+(prop.variant||0)+') · X '+Math.round(prop.x)+
  ' Y '+Math.round(prop.y)+' · '+Math.round(prop.w)+' × '+Math.round(prop.h):
  'แตะวัตถุบนแมพเพื่อดู ID ประเภท พิกัดและขนาด';
}
function renderBotTestPad(){
 const el=$('botTestPad');if(!el)return;
 const eligible=canUseBotTest(),active=eligible&&!!possessedBotId&&!!players.find(p=>p.id===possessedBotId);
 if(!eligible&&possessedBotId){releaseBotPossession();return;}
 const visible=eligible&&currentView==='game'&&!!round&&!gameSelection&&
  !['results','summary'].includes(round.phase);
 el.classList.toggle('hidden',!visible);
 $('botPossessBtn').classList.toggle('hidden',active);
 $('botTestControls').classList.toggle('hidden',!active);
 $('botTestName').classList.toggle('hidden',!active);
 $('botNextBtn').classList.toggle('hidden',!active||players.length<2);
 $('botReleaseBtn').classList.toggle('hidden',!active);
 const board=round?.mode==='board'&&!!boardSession;
 $('botUnlimitedBtn').classList.toggle('hidden',!active||!board);
 $('botUnlimitedBtn').setAttribute('aria-pressed',String(!!botUnlimitedBackup));
 $('botUnlimitedBtn').disabled=board&&round?.phase!=='playing';
 $('botTestName').textContent=players.find(p=>p.id===possessedBotId)?.name||'';
 renderGhostMapInspector();
}
function bindHostBotPad(){
 $('botGhostIdsBtn').addEventListener('click',()=>{
  if(!canInspectGhostMap())return;
  const state=round.ghost;
  state.showObstacleIds=!state.showObstacleIds;
  state.selectedObstacleId=null;
  renderGhostMapInspector();
  drawGame(graphicsClock);
 });
 // Tap a prop on the host arena: map screen pixels to collision coordinates.
 // Ignore drags, multi-finger gestures and taps outside the actual arena.
 const ghostTapStarts=new Map();
 canvas.addEventListener('pointerdown',e=>{
  if(canInspectGhostMap()&&round.ghost.showObstacleIds)
   ghostTapStarts.set(e.pointerId,{x:e.clientX,y:e.clientY});
 });
 canvas.addEventListener('pointerup',e=>{
  const start=ghostTapStarts.get(e.pointerId);ghostTapStarts.delete(e.pointerId);
  if(!start||!canInspectGhostMap()||!round.ghost.showObstacleIds||
   Math.hypot(e.clientX-start.x,e.clientY-start.y)>10)return;
  const rect=arenaContentRect(canvas.getBoundingClientRect());
  const px=(e.clientX-rect.left)/rect.scale,py=(e.clientY-rect.top)/rect.scale;
  if(px<0||px>960||py<0||py>540)return;
  const world=round.ghost.world;
  const hit=window.GhostAttack.obstacleAt(round,px*world.w/960,py*world.h/540);
  round.ghost.selectedObstacleId=hit?.id||null;
  renderGhostMapInspector();
  drawGame(graphicsClock);
 });
 for(const ev of ['pointercancel','lostpointercapture'])
  canvas.addEventListener(ev,e=>ghostTapStarts.delete(e.pointerId));
 $('botPossessBtn').addEventListener('click',()=>{
  const first=players.find(p=>p.type==='local'&&p.isBot);
  if(first)possessBot(first.id);
 });
 $('botNextBtn').addEventListener('click',()=>{
  const list=players.filter(p=>p.type==='local');
  const index=list.findIndex(p=>p.id===possessedBotId);
  if(index>=0)possessBot(list[(index+1)%list.length].id);
 });
 $('botReleaseBtn').addEventListener('click',releaseBotPossession);
 $('botUnlimitedBtn').addEventListener('click',toggleInfiniteBotItems);
 const stick=$('botTestStick'),knob=$('botTestKnob');let pointer=null;
 const update=e=>{
  const rect=stick.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
  const max=Math.max(22,Math.min(rect.width,rect.height)*.37);
  let dx=(e.clientX-cx)/max,dy=(e.clientY-cy)/max;
  const len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}
  if(len<.12)dx=dy=0;
  botPadKeys.axisX=Math.round(dx*100)/100;botPadKeys.axisY=Math.round(dy*100)/100;
  knob.style.transform='translate(calc(-50% + '+Math.round(dx*max*.8)+'px),calc(-50% + '+Math.round(dy*max*.8)+'px))';
  applyBotPadKeys();
 };
 const release=e=>{
  if(pointer===null||e.pointerId!==pointer)return;
  pointer=null;botPadKeys.axisX=0;botPadKeys.axisY=0;
  knob.style.transform='translate(-50%,-50%)';applyBotPadKeys();
 };
 stick.addEventListener('pointerdown',e=>{
  if(!possessedBotId||pointer!==null)return;
  e.preventDefault();pointer=e.pointerId;
  try{stick.setPointerCapture(pointer);}catch(_){}
  update(e);
 });
 stick.addEventListener('pointermove',e=>{if(e.pointerId===pointer){e.preventDefault();update(e);}});
 for(const evt of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(evt,release);
 stick.addEventListener('contextmenu',e=>e.preventDefault());
 for(const [id,key] of [['botTestA','action'],['botTestB','alt'],['botTestC','cancel']]){
  const btn=$(id),ids=new Set();
  btn.addEventListener('pointerdown',e=>{
   if(!possessedBotId)return;
   e.preventDefault();ids.add(e.pointerId);
   try{btn.setPointerCapture(e.pointerId);}catch(_){}
   botPadKeys[key]=true;btn.classList.add('pressed');applyBotPadKeys();
  });
  const releaseButton=e=>{
   if(!ids.delete(e.pointerId))return;
   e.preventDefault?.();botPadKeys[key]=ids.size>0;
   btn.classList.toggle('pressed',botPadKeys[key]);applyBotPadKeys();
  };
  for(const evt of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(evt,releaseButton);
  btn.addEventListener('contextmenu',e=>e.preventDefault());
 }
 window.addEventListener('blur',clearBotPadKeys);
}
bindHostBotPad();
function resetInputs(){
  players.forEach(p=>{for(const k of INPUT_NAMES)p.input[k]=false;p.input.axisX=0;p.input.axisY=0;p.latch=false;});
}
function closeHost({goHome=true}={}){
  lobbyReadyVotes.clear();
  ++hostOpenAttempt;
  if(hostRetryTimeout!==null){clearTimeout(hostRetryTimeout);hostRetryTimeout=null;}
  releaseBotPossession();
  stopAllHostVideoCalls();
  for(const id of [...seatTimers.keys()])cancelSeat(id);
  deleteSession(HOST_SESSION);
  onlineHost=false;roomCode='';$('roomPanel').classList.add('hidden');$('hostBtn').disabled=false;
  $('hostRoomBadge').textContent='ห้องปิดแล้ว';
  hostConnections.forEach(c=>{send(c,{t:'closed'});try{c.close();}catch(e){}});
  hostConnections.clear();
  if(hostPeer){const oldPeer=hostPeer;hostPeer=null;try{oldPeer.destroy();}catch(e){}}
  for(const p of players.filter(p=>p.type==='remote')){players.splice(players.indexOf(p),1);}
  tournament=null;gameSelection=null;round=null;boardSession=null;boardStateToken=null;
  document.body.classList.remove('board-playing');
  $('boardTools').classList.add('hidden');
  $('gameRoulette').classList.add('hidden');$('pauseMenu').classList.add('hidden');
  renderRoster();setStatus('พร้อมเล่น');
  // A closed room has no usable QR code or seats: return to the host HOME.
  if(goHome&&(currentView==='hostLobby'||currentView==='game'))setView('home');
}
function shareUrl(code){
  const u=new URL(window.location.href);
  u.search='';u.hash='';u.searchParams.set('join',code);return u.href;
}
function renderQr(code){
  const link=shareUrl(code);
  $('roomUrl').value=link;
  const box=$('qrBox');box.replaceChildren();
  if(typeof QRCode==='function'){
    try{new QRCode(box,{text:link,width:256,height:256,correctLevel:QRCode.CorrectLevel.M});return;}catch(e){}
  }
  box.textContent='QR ไม่พร้อม กรุณาคัดลอกลิงก์';
}
let hostNetworkLoad=null;
function startHost(retries=0,resumeCode=null,expectedAttempt=null){
  if(expectedAttempt!==null&&expectedAttempt!==hostOpenAttempt)return;
  if(onlineHost){setView('hostLobby');return;}
  if(typeof Peer!=='function'){
    const deps=window.GameRuntimeDeps;
    if(deps){
      if(hostNetworkLoad)return;
      const initialAttempt=hostOpenAttempt;
      $('hostBtn').disabled=true;setStatus('กำลังโหลดการเชื่อมต่อออนไลน์...');
      hostNetworkLoad=deps.ensureHost().then(()=>{
        hostNetworkLoad=null;
        if(initialAttempt===hostOpenAttempt&&currentView==='home')
          startHost(retries,resumeCode,expectedAttempt);
      }).catch(error=>{
        hostNetworkLoad=null;$('hostBtn').disabled=false;
        setStatus('โหลดระบบเชื่อมต่อไม่สำเร็จ',true);
        showToast('โหลดเครือข่ายไม่สำเร็จ: '+String(error.message||error),true);
      });
      return;
    }
    closeHost();setStatus('โหลดระบบเชื่อมต่อไม่สำเร็จ',true);
    showToast('ยังโหลด PeerJS ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วโหลดหน้าใหม่',true);return;
  }
  if(location.protocol==='file:'){
    closeHost();showToast('โปรดเปิดเว็บไซต์ผ่าน HTTPS เพื่อใช้มือถือเป็นจอย',true);return;
  }
  const attempt=expectedAttempt??++hostOpenAttempt;
  const code=resumeCode||randomCode();
  if(!resumeCode)deleteSession(OFFLINE_SESSION);
  $('hostBtn').disabled=true;setStatus('กำลังสร้างห้อง...');
  const peer=new Peer('gf-party-'+code,{debug:0});
  hostPeer=peer;
  peer.on('open',()=>{
    if(hostPeer!==peer||attempt!==hostOpenAttempt)return;
    roomCode=code;onlineHost=true;$('roomCode').textContent=code;
    deleteSession(OFFLINE_SESSION);
    $('roomPanel').classList.remove('hidden');$('offlineRoomHint').classList.add('hidden');
    $('hostBtn').disabled=false;$('hostRoomBadge').textContent='ROOM '+code;
    setView('hostLobby');
    renderQr(code);setStatus('เปิดห้อง '+code);
    renderRoster();broadcastRoster();
    for(const p of players)if(p.type==='remote'&&!p.conn)holdSeat(p);
  });
  peer.on('connection',conn=>{
    if(hostPeer!==peer){conn.close();return;}
    hostConnections.add(conn);
    conn.on('data',msg=>{
      if(!msg||typeof msg!=='object')return;
      if(msg.t==='join'&&!conn.playerId){
        const token=typeof msg.clientToken==='string'&&msg.clientToken.length>=12&&msg.clientToken.length<=100?msg.clientToken:null;
        let p=token?players.find(q=>q.type==='remote'&&q.clientToken===token):null;
        if(p){
          cancelSeat(p.id);
          if(p.conn&&p.conn!==conn){const old=p.conn;p.conn=null;try{old.close()}catch(_){}}
          p.conn=conn;
          if(boardSession){p.isBot=false;const bp=boardSession.players.find(q=>q.id===p.id);if(bp)bp.isBot=false;delete boardSession.lastActions[p.id];delete boardSession.inputs[p.id];}
        }else{
          if(boardSession){send(conn,{t:'reject',reason:'BOARD PARTY กำลังเล่นอยู่ • เข้าร่วมได้เมื่อกลับล็อบบี้'});return;}
          if(players.length>=MAX_PLAYERS){send(conn,{t:'reject',reason:'ห้องเต็มแล้ว (สูงสุด '+MAX_PLAYERS+' คน)'});return;}
          p=makePlayer(msg.name,'remote',conn);
          if(!p)return;
          p.clientToken=token;
          if(round&&round.phase!=='results')p.active=false;
        }
        conn.playerId=p.id;conn.previewEnabled=false;p.lastInputAt=Date.now();
        send(conn,{t:'welcome',id:p.id,name:p.name,color:p.color,mode:round?round.mode:'ghost',phase:networkPhase(),choice:p.choice,active:p.active});
        broadcastRoster();
        if(['results','summary'].includes(round?.phase))renderResultVotes(true);
      }else if(msg.t==='leave'&&conn.playerId){
        // Explicit leave is NOT a temporary connection loss. Remove the seat
        // immediately, then acknowledge it before closing the data channel.
        const id=conn.playerId;conn.playerId=null;
        const leaving=players.find(p=>p.id===id&&p.conn===conn);
        if(leaving)leaving.conn=null;
        stopHostVideoCall(conn);
        removePlayer(id);
        send(conn,{t:'leave-ack',id});
        setTimeout(()=>{try{if(conn.open)conn.close();}catch(_){}},300);
      }else if(msg.t==='video-ready'&&conn.playerId){
        if(conn.previewEnabled===true&&msg.quality===conn.videoQuality)conn.videoReady=true;
      }else if(msg.t==='preview-toggle'&&conn.playerId&&typeof msg.enabled==='boolean'){
        conn.previewEnabled=msg.enabled;
        if(msg.enabled){if(round)startHostVideoCall(conn);}
        else stopHostVideoCall(conn);
      }else if(msg.t==='board-camera-mode'&&conn.playerId){
        const s=boardSession;
        const valid=round?.mode==='board'&&round.phase==='playing'&&!round.paused&&s&&
          msg.turnId===s.turnId&&msg.mapVersion===s.map.version&&
          window.BoardParty.current(s)?.id===conn.playerId&&
          (s.phase==='ready'||(['move_ready','branch','moving'].includes(s.phase)&&s.move?.kind==='walk'))&&
          window.BoardArt?.canPan?.(s)&&
          players.some(p=>p.id===conn.playerId&&p.conn===conn&&p.active&&!p.isBot);
        if(!valid){conn.boardCameraGestureToken=null;return;}
        if(typeof msg.enabled!=='boolean')return;
        conn.boardCameraGestureToken=msg.enabled?s.turnId:null;
        const c=s.camera;
        // Do not call BoardArt.follow here: that API deliberately resets zoom.
        c.manualZoom=c.zoom;c.explore=false;c.panned=!!msg.enabled;
         c.bagMapInspect=s.phase==='ready'&&msg.enabled;
        if(!msg.enabled)c.rescuedOffscreen=false;
      }else if(msg.t==='board-camera-gesture'&&conn.playerId){
        const s=boardSession;
        if(round?.mode!=='board'||round.phase!=='playing'||round.paused||!s||
          msg.turnId!==s.turnId||msg.mapVersion!==s.map.version||
          conn.boardCameraGestureToken!==s.turnId||
          !(s.phase==='ready'||(['move_ready','branch','moving'].includes(s.phase)&&s.move?.kind==='walk'))||
          window.BoardParty.current(s)?.id!==conn.playerId||
          !window.BoardArt?.canPan?.(s)||
          !players.some(p=>p.id===conn.playerId&&p.conn===conn&&p.active&&!p.isBot))return;
        if(msg.kind==='pan'){
          const dx=Number(msg.dx),dy=Number(msg.dy);
          if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.abs(dx)>320||Math.abs(dy)>240)return;
          window.BoardArt.pan(s,dx,dy);
        }else if(msg.kind==='pinch'){
          const scale=Number(msg.scale);
          if(!Number.isFinite(scale)||scale<.75||scale>1.35)return;
          window.BoardArt.zoom(s,scale);
        }
      }else if(msg.t==='board-camera-zoom'&&conn.playerId){
        // Only an authenticated controller in an active BOARD game may
        // zoom the HOST map. Never interpret this packet as movement/A/B/C.
        if(round?.mode!=='board'||round.phase!=='playing'||round.paused||!boardSession||
           ![1,-1].includes(msg.direction)||!window.BoardArt?.canPan?.(boardSession))return;
        // Always validate on the host; spoofed zoom packets from spectators
        // cannot alter the shared camera even if they bypass the phone UI.
        if(window.BoardParty.current(boardSession)?.id!==conn.playerId)return;
        const player=players.find(p=>p.id===conn.playerId&&p.conn===conn);
        if(!player||!player.active)return;
        const now=Date.now();
        if(now-(conn.lastBoardCameraZoomAt||0)<100)return;
        conn.lastBoardCameraZoomAt=now;
        window.BoardArt.zoom(boardSession,msg.direction>0?1.25:.8);
        refreshBoardTools();
      }else if(msg.t==='video-quality'&&conn.playerId){
        if(!Object.hasOwn(VIDEO_QUALITY,msg.quality))return;
        const autoHeight=msg.quality==='auto'?normalizeAutoHeight(msg.autoHeight):null;
        const changed=conn.videoQuality!==msg.quality||
          (msg.quality==='auto'&&conn.videoAutoHeight!==autoHeight);
        conn.videoQuality=msg.quality;
        conn.videoAutoHeight=autoHeight;
        if(round&&conn.previewEnabled===true&&(changed||!hostVideoCalls.has(conn)))startHostVideoCall(conn);
      }else if(msg.t==='pick'&&conn.playerId){
        if(round||selectedSessionMode==='board'||currentView!=='hostLobby'||!modesFor('normal').includes(msg.mode))return;
        const p=players.find(p=>p.id===conn.playerId&&p.conn===conn);
        if(!p||p.choice===msg.mode)return;
        p.choice=msg.mode;lobbyReadyVotes.delete(p.id);renderRoster();broadcastRoster();
      }else if(msg.t==='lobby-ready'&&conn.playerId){
        castLobbyReadyVote(conn);
      }else if(msg.t==='result-vote'&&conn.playerId){
        castResultVote(conn,msg.choice);
      }else if(msg.t==='target-cycle'&&conn.playerId){
        if(!round||round.phase!=='playing'||round.paused)return;
        if(msg.direction!==1&&msg.direction!==-1)return;
        const p=players.find(q=>q.id===conn.playerId&&q.conn===conn);
        if(p&&round.mode==='ghost'&&window.GhostAttack.cycleTarget(round.ghost,players,p,msg.direction))
          sendPlayerInventory(conn);
      }else if(msg.t==='input'&&conn.playerId){
        if(round&&round.paused)return;
        const p=players.find(p=>p.id===conn.playerId&&p.conn===conn);
        if(!p)return;
        p.lastInputAt=Date.now();
        if(round?.mode==='board'&&boardSession){
          const locked=conn.boardCameraGestureToken===boardSession.turnId;
          const input=locked?{...msg,keys:{...msg.keys,left:false,right:false,jump:false,
            down:false,axisX:0,axisY:0,
             ...(boardSession.phase==='ready'?{action:false,alt:false,cancel:false}:{})}}:msg;
          window.BoardParty.input(boardSession,p.id,input);return;
        }
        for(const k of INPUT_NAMES)p.input[k]=msg.keys&&msg.keys[k]===true;
        p.input.axisX=Number.isFinite(msg.keys&&msg.keys.axisX)?clamp(msg.keys.axisX,-1,1):0;
        p.input.axisY=Number.isFinite(msg.keys&&msg.keys.axisY)?clamp(msg.keys.axisY,-1,1):0;
      }
    });
    function lost(){
      stopHostVideoCall(conn);hostConnections.delete(conn);
      if(!onlineHost||!conn.playerId)return;
      const p=players.find(q=>q.id===conn.playerId&&q.conn===conn);
      if(!p)return;
      p.conn=null;p.input=blankInput();lobbyReadyVotes.delete(p.id);holdSeat(p);
      renderRoster();broadcastRoster();
      if(['results','summary'].includes(round?.phase))renderResultVotes(true);
    }
    conn.on('close',lost);conn.on('error',lost);
  });
  peer.on('disconnected',()=>{
    if(hostPeer===peer&&attempt===hostOpenAttempt)
      setStatus('สัญญาณเซิร์ฟเวอร์ขาดชั่วคราว',true);
    // A temporary signaling disconnect is not a room closure.
  });
  peer.on('close',()=>{
    if(hostPeer!==peer||attempt!==hostOpenAttempt)return;
    closeHost();
    showToast('ห้องปิดแล้ว • กลับหน้าหลัก',true);
  });
  peer.on('error',err=>{
    if(hostPeer!==peer||attempt!==hostOpenAttempt)return;
    if(err.type==='unavailable-id'&&retries<(resumeCode?12:3)){
      hostPeer=null;try{peer.destroy()}catch(_){}
      hostRetryTimeout=setTimeout(()=>{
        hostRetryTimeout=null;
        if(attempt===hostOpenAttempt)startHost(retries+1,resumeCode,attempt);
      },resumeCode?1200+retries*350:250);
      return;
    }
    const type=err?.type||'network';
    closeHost(); // Clears stale saved sessions, peers, board and lobby view.
    setStatus('เปิดห้องไม่สำเร็จ: '+type,true);
    showToast(resumeCode?'คืนห้องเดิมไม่ได้ • กลับหน้าหลัก':'เปิดห้องไม่สำเร็จ • กลับหน้าหลัก',true);
  });
}
function copyInvite(){
  const value=$('roomUrl').value;if(!value)return;
  const done=()=>{const b=$('copyBtn');b.textContent='คัดลอกแล้ว';setTimeout(()=>b.textContent='คัดลอกลิงก์',1600);};
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(value).then(done).catch(()=>{ $('roomUrl').select();document.execCommand('copy');done();});}
  else{$('roomUrl').select();document.execCommand('copy');done();}
}
let phoneSelectionOpen=false;
let myChosenMode=null;
function updatePhoneGamePicker(phase,choice){
  phoneSelectionOpen=phase==='lobby'&&controllerReady&&controllerSessionMode!=='board';
  myChosenMode=Object.hasOwn(MODES,choice)?choice:null;
  $('phoneGamePicker').classList.toggle('hidden',!phoneSelectionOpen);
  // Picker and live game use the same permanent preview frame dimensions.
  // During selection the joystick hit zone is disabled so all seven
  // mini-game buttons stay tappable, including those on the left.
  $('controllerButtons').classList.toggle('is-picking',phoneSelectionOpen);
  // No joystick movement while selecting a game.
  if(phoneSelectionOpen)releaseStick();
  renderControllerPreviewToggle();
  for(const button of document.querySelectorAll('[data-pick]')){
    const selected=button.dataset.pick===myChosenMode;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  }
  $('phoneChoiceStatus').textContent=myChosenMode?
    'เลือก '+MODES[myChosenMode]+' แล้ว • รอเจ้าของห้องสุ่มเกม':
    'เลือกหนึ่งเกม • เปลี่ยนใจก่อนเริ่มเล่นได้';
}
let controllerMediaCall=null;
let videoStreamActive=false;
let controllerPreviewEnabled=false; // Default OFF on every fresh page load.
const VIDEO_QUALITY_CYCLE=['high','medium','low','auto'];
const VIDEO_QUALITY_TEXT={
  high:{short:'ส',long:'สูง · 720p'},
  medium:{short:'ก',long:'กลาง · 540p'},
  low:{short:'ต',long:'ต่ำ · 144p'},
  auto:{short:'A',long:'อัตโนมัติตามหน้าจอ'}
};
let controllerVideoQuality='medium';
let lastControllerAutoHeight=null;
function controllerAutoHeight(){
  // CSS screen pixels × device pixel ratio estimate the display's native pixels.
  // Never mistake browser support/actual network throughput for a guaranteed FPS.
  const screen=window.screen||{};
  const dims=[Number(screen.width),Number(screen.height)];
  const viewport=[Number(window.innerWidth),Number(window.innerHeight)];
  const usable=dims.every(n=>Number.isFinite(n)&&n>0)?dims:viewport;
  const shortSide=usable.every(n=>Number.isFinite(n)&&n>0)?Math.min(...usable):540;
  const dpr=Number(window.devicePixelRatio);
  return normalizeAutoHeight(shortSide*(Number.isFinite(dpr)&&dpr>0?dpr:1));
}
function videoQualityPacket(quality){
  if(quality==='auto'){
    const height=controllerAutoHeight();
    lastControllerAutoHeight=height;
    return {t:'video-quality',quality,autoHeight:height};
  }
  lastControllerAutoHeight=null;
  return {t:'video-quality',quality};
}
function savedVideoQuality(){
  try{
    const name=window.localStorage.getItem('gf-video-quality-v1');
    if(Object.hasOwn(VIDEO_QUALITY,name))return name;
  }catch(_){}
  return 'medium';
}
function renderVideoQualityButton(){
  const quality=VIDEO_QUALITY_TEXT[controllerVideoQuality]||VIDEO_QUALITY_TEXT.medium;
  const button=$('videoQualityBtn');
  button.textContent=quality.short;
  button.title='คุณภาพภาพ '+quality.long+' · กดเพื่อเปลี่ยนระดับ';
  button.setAttribute('aria-label',button.title);
  button.dataset.quality=controllerVideoQuality;
}
function setControllerVideoQuality(quality){
  if(!Object.hasOwn(VIDEO_QUALITY,quality))return;
  controllerVideoQuality=quality;
  renderVideoQualityButton();
  try{window.localStorage.setItem('gf-video-quality-v1',quality);}catch(_){}
  if(controllerReady&&controllerPreviewEnabled)send(controllerConn,videoQualityPacket(quality));
}
function renderControllerPreviewToggle(){
  const btn=$('videoPreviewToggleBtn');
  btn.textContent=controllerPreviewEnabled?'จอเปิด':'จอปิด';
  btn.dataset.preview=controllerPreviewEnabled?'on':'off';
  btn.setAttribute('aria-pressed',String(controllerPreviewEnabled));
  btn.setAttribute('aria-label',controllerPreviewEnabled?'จอพรีวิวเปิดอยู่ กดเพื่อปิด':'จอพรีวิวปิดอยู่ กดเพื่อเปิด');
  btn.title=controllerPreviewEnabled?'ปิดจอพรีวิวของจอย':'เปิดจอพรีวิวของจอย';
  // Keep the lobby game-picker clickable even while the preview is off.
  $('controllerPreviewOff').classList.toggle('hidden',controllerPreviewEnabled||phoneSelectionOpen);
}
function setControllerPreviewEnabled(enabled){
  controllerPreviewEnabled=enabled===true;
  if(!controllerPreviewEnabled){
    stopControllerVideo();
    resetPhonePreview();
  }else if(controllerReady){
    // Quality preference is passed first, before asking the host to stream.
    send(controllerConn,videoQualityPacket(controllerVideoQuality));
  }
  renderControllerPreviewToggle();
  if(controllerReady)send(controllerConn,{t:'preview-toggle',enabled:controllerPreviewEnabled});
}
function stopControllerVideo(){
  const call=controllerMediaCall;
  controllerMediaCall=null;
  videoStreamActive=false;
  if(call)try{call.close();}catch(_){}
  const video=$('controllerPreviewVideo');
  try{video.pause();}catch(_){}
  video.srcObject=null;
  video.classList.add('hidden');
  $('videoStartBtn').classList.add('hidden');
}
function showControllerVideo(stream,call){
  if(controllerMediaCall!==call||!controllerPreviewEnabled||!stream)return;
  const video=$('controllerPreviewVideo');
  video.srcObject=stream;
  video.muted=true;
  video.playsInline=true;
  video.classList.remove('hidden');
  $('controllerPreviewImage').classList.add('hidden');
  $('controllerPreviewPlaceholder').classList.add('hidden');
  videoStreamActive=true;
  if(typeof video.play==='function'){
    try{
      const p=video.play();
      if(p&&p.then)p.then(()=>{
        if(controllerMediaCall!==call||!controllerPreviewEnabled)return;
        send(controllerConn,{t:'video-ready',quality:call.metadata?.quality||'medium'});
      }).catch(()=>{$('videoStartBtn').classList.remove('hidden');});
    }catch(_){$('videoStartBtn').classList.remove('hidden');}
  }
}
function resetPhonePreview(){
  $('controllerPreviewImage').src='';
  $('controllerPreviewImage').classList.add('hidden');
  if(!videoStreamActive)$('controllerPreviewPlaceholder').classList.remove('hidden');
}
function receivePhonePreview(image){
  if(!controllerPreviewEnabled||videoStreamActive)return;
  if(typeof image!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image)||image.length>24000)return;
  $('controllerPreviewImage').src=image;
  $('controllerPreviewImage').classList.remove('hidden');
  $('controllerPreviewPlaceholder').classList.add('hidden');
}
function safePeerDestroy(){
  stopControllerVideo();
  const conn=controllerConn,peer=controllerPeer;
  controllerConn=null;controllerPeer=null;
  if(conn){try{conn.close();}catch(e){}}
  if(peer){try{peer.destroy();}catch(e){}}
}
function controllerState(msg,bad=false){$('joinMessage').textContent=msg;$('controllerState').textContent=msg;setStatus(msg,bad);}
function getSavedNickname(){
  try{return window.localStorage.getItem('gf-nick')||sessionStorage.getItem('gf-nick')||'';}
  catch(_){try{return sessionStorage.getItem('gf-nick')||'';}catch(__){return '';}}
}
function rememberNickname(){
  const value=$('nick').value.trim().slice(0,14);
  if(!value)return;
  try{window.localStorage.setItem('gf-nick',value);}catch(_){}
  try{sessionStorage.setItem('gf-nick',value);}catch(_){}
}
function parseRoomCode(value){
  const raw=String(value||'').trim();
  let code=raw.toUpperCase();
  if(!/^[A-Z2-9]{6}$/.test(code)){
    try{
      const parsed=new URL(raw);
      if(!['https:','http:'].includes(parsed.protocol))return null;
      code=String(parsed.searchParams.get('join')||'').toUpperCase();
    }catch(_){return null;}
  }
  return /^[A-Z2-9]{6}$/.test(code)?code:null;
}
function selectRoomCode(code){
  const parsed=parseRoomCode(code);
  if(!parsed)return false;
  $('roomCodeInput').value=parsed;
  $('joinCode').textContent=parsed;
  // Change URL without opening a new tab or reloading the current controller.
  try{
    const url=new URL(window.location.href);
    url.searchParams.set('join',parsed);
    window.history.replaceState(null,'',url.href);
  }catch(_){}
  return true;
}
// One active phone controller per browser profile: new Chrome QR tabs may still
// open, but an active new tab releases the previous controller cleanly.
const controllerTabToken=String(Date.now())+'-'+Math.random().toString(36).slice(2);
let controllerChannel=null;
try{
  if(typeof window.BroadcastChannel==='function'){
    controllerChannel=new window.BroadcastChannel('gf-controller-active-v1');
    controllerChannel.onmessage=event=>{
      const msg=event.data;
      if(msg&&msg.type==='active-controller'&&msg.token!==controllerTabToken&&controllerReady)
        resetControllerForRoomChange('จอยถูกย้ายไปแท็บใหม่แล้ว สามารถสแกนหรือกรอกรหัสห้องเพื่อกลับมาเล่นได้');
    };
  }
}catch(_){}
function announceControllerTakeover(){
  try{if(controllerChannel)controllerChannel.postMessage({type:'active-controller',token:controllerTabToken});}
  catch(_){}
}
const QR_READER_CDN='https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
let qrLibraryPromise=null,activeQrSession=null;
function loadQrLibrary(){
  if(typeof window.Html5Qrcode==='function')return Promise.resolve();
  if(!qrLibraryPromise){
    qrLibraryPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=QR_READER_CDN;script.async=true;
      script.onload=()=>typeof window.Html5Qrcode==='function'?resolve():reject(new Error('QR scanner unavailable'));
      script.onerror=()=>reject(new Error('QR scanner could not be downloaded'));
      document.head.appendChild(script);
    }).catch(error=>{qrLibraryPromise=null;throw error;});
  }
  return qrLibraryPromise;
}
async function releaseQrSession(session){
  if(!session)return;
  if(session.started){try{await session.started;}catch(_){}}
  if(session.reader){
    try{await session.reader.stop();}catch(_){}
    try{session.reader.clear();}catch(_){}
  }
}
async function stopRoomScanner(){
  const session=activeQrSession;
  activeQrSession=null;
  $('roomScannerPanel').classList.add('hidden');
  await releaseQrSession(session);
}
async function startRoomScanner(){
  await stopRoomScanner();
  const session={reader:null,started:null,found:false};
  activeQrSession=session;
  $('roomScannerPanel').classList.remove('hidden');
  $('scanRoomStatus').textContent='กำลังเปิดกล้องเพื่อสแกน QR...';
  try{
    await loadQrLibrary();
    if(activeQrSession!==session)return;
    const config=window.Html5QrcodeSupportedFormats?
      {formatsToSupport:[window.Html5QrcodeSupportedFormats.QR_CODE]}:{};
    session.reader=new window.Html5Qrcode('roomQrReader',config);
    session.started=session.reader.start({facingMode:'environment'},{fps:8,qrbox:220},decoded=>{
      if(activeQrSession!==session||session.found)return;
      const code=parseRoomCode(decoded);
      if(!code){$('scanRoomStatus').textContent='QR ไม่ใช่รหัสห้อง GAME-FRIENDS';return;}
      session.found=true;
      void (async()=>{
        await stopRoomScanner();
        if(selectRoomCode(code))joinRoom();
      })();
    },()=>{});
    await session.started;
    if(activeQrSession===session)$('scanRoomStatus').textContent='ส่องกล้องไปยัง QR Code ห้องใหม่';
  }catch(_){
    if(activeQrSession===session){
      $('scanRoomStatus').textContent='เปิดกล้องไม่สำเร็จ ตรวจสอบสิทธิ์กล้องหรือกรอกรหัส 6 ตัวแทน';
      await releaseQrSession(session);
      if(activeQrSession===session)activeQrSession=null;
    }
  }
}
function resetControllerForRoomChange(message,awaitLeaveAck=false){
  disconnectRequested=true;
  if(reconnectTimer!==null&&typeof clearTimeout==='function')clearTimeout(reconnectTimer);
  reconnectTimer=null;reconnectTries=0;
  deleteSession(PHONE_SESSION);
  // A PeerJS DataConnection send may be queued; destroying the Peer
  // immediately used to drop the leave packet before the host could see it.
  const leavingConn=controllerConn;
  if(leavingConn?.open)send(leavingConn,{t:'leave'});
  $('leaveConfirm').classList.add('hidden');
  resetPhonePreview();
  void stopRoomScanner();
  // Switching/leaving rooms must not cancel the user's fullscreen or
  // orientation lock. The join form still renders inside #controller.
  if(awaitLeaveAck&&leavingConn?.open){
    // Keep the old data channel alive until the host acknowledges removal.
    // Fail-safe timeout prevents a dead room from trapping the controller.
    stopControllerVideo();
    setTimeout(()=>{
      if(controllerConn===leavingConn)safePeerDestroy();
    },1000);
  }else safePeerDestroy();
  controllerReady=false;controllerId=null;
  setControllerGameContext(null,'lobby',false);
  for(const k of INPUT_NAMES)controllerKeys[k]=false;
  controllerKeys.axisX=0;controllerKeys.axisY=0;
  clearPortraitFallback();
  document.body.classList.remove('controller-playing');
  syncZoomPolicy();
  $('controllerActive').classList.add('hidden');
  $('joinForm').classList.remove('hidden');
  $('joinBtn').disabled=false;
  controllerReady=false;updatePhoneGamePicker('closed',null);
  controllerState(message||'เลือกห้องใหม่ได้เลย โดยไม่ต้องเปิดแท็บใหม่');
  window.GameAutoUpdate?.onSafePoint();
}
let controllerNetworkLoad=null;
function joinRoom(recovery=false){
  recovery=recovery===true;
  if(typeof Peer!=='function'){
    const deps=window.GameRuntimeDeps;
    if(deps){
      if(controllerNetworkLoad)return;
      const code=$('roomCodeInput').value,view=currentView;
      $('joinBtn').disabled=true;controllerState('กำลังโหลดระบบจอยออนไลน์...');
      controllerNetworkLoad=deps.ensureController().then(()=>{
        controllerNetworkLoad=null;
        $('joinBtn').disabled=false;
        if(currentView===view&&view==='controller'&&$('roomCodeInput').value===code)
          joinRoom(recovery);
      }).catch(error=>{
        controllerNetworkLoad=null;$('joinBtn').disabled=false;
        controllerState('โหลดระบบจอยไม่สำเร็จ: '+String(error.message||error),true);
      });
      return;
    }
    controllerState('ไม่สามารถโหลดระบบจอยออนไลน์ได้',true);return;
  }
  if(!recovery)reconnectTries=0;
  if(reconnectTimer!==null&&typeof clearTimeout==='function')clearTimeout(reconnectTimer);
  reconnectTimer=null;
  const code=parseRoomCode($('roomCodeInput').value);
  if(!code){controllerState('รหัสห้องไม่ถูกต้อง กรุณากรอก 6 ตัวหรือสแกน QR',true);return;}
  selectRoomCode(code);
  const name=cleanName($('nick').value);$('nick').value=name;rememberNickname();
  void stopRoomScanner();
  if(!recovery)void requestLandscape();
  $('joinBtn').disabled=true;controllerState((recovery?'กำลังกลับเข้าห้อง ':'กำลังเชื่อมต่อห้อง ')+code+'...');
  disconnectRequested=true;safePeerDestroy();
  disconnectRequested=false;
  const peer=new Peer(undefined,{debug:0});
  controllerPeer=peer;
  peer.on('open',()=>{
    if(controllerPeer!==peer)return;
    const conn=peer.connect('gf-party-'+code,{reliable:true,serialization:'json'});
    controllerConn=conn;
    conn.on('open',()=>{send(conn,{t:'join',name,clientToken:stablePhoneToken});controllerState('กำลังรอห้องรับผู้เล่น...');});
    peer.on('call',call=>{
      if(controllerPeer!==peer||call.peer!=='gf-party-'+code||!controllerPreviewEnabled){
        try{call.close();}catch(_){}
        return;
      }
      stopControllerVideo();
      controllerMediaCall=call;
      call.on('stream',stream=>showControllerVideo(stream,call));
      call.on('close',()=>{
        if(controllerMediaCall!==call)return;
        stopControllerVideo();resetPhonePreview();
      });
      call.on('error',()=>{
        if(controllerMediaCall!==call)return;
        stopControllerVideo();resetPhonePreview();
      });
      try{call.answer();}catch(_){stopControllerVideo();}
    });
    conn.on('data',data=>{
      if(controllerConn!==conn||!data||typeof data!=='object')return;
      if(data.t==='leave-ack'&&disconnectRequested){
        safePeerDestroy();return;
      }
      if(data.t==='welcome'){
        controllerId=data.id;controllerReady=true;
        reconnectTries=0;
        if(reconnectTimer!==null&&typeof clearTimeout==='function')clearTimeout(reconnectTimer);
        reconnectTimer=null;savePhone();
        $('leaveConfirm').classList.add('hidden');
        resetPhonePreview();
        $('controllerName').textContent=data.name;$('controllerAvatar').style.background=data.color;
     $('controllerAvatar').innerHTML=window.PartyPlayerAvatar?.svgForFront(data.color)||'';
        $('joinForm').classList.add('hidden');$('controllerActive').classList.remove('hidden');
        controllerState('เชื่อมต่อแล้ว • รอเจ้าของห้องเริ่มเกม');
        $('controllerInventory').classList.remove('is-ghost');
        setControllerGameContext(data.mode,data.phase||'lobby',!!data.active);
        document.body.classList.add('controller-playing');
        syncControllerVisibleViewport();
        syncZoomPolicy();
        showControllerMode(data.mode);
        updatePhoneGamePicker(data.phase||'lobby',data.choice||null);
        // Quality is remembered, but the live preview starts OFF on a fresh
        // controller page to save bandwidth and device battery.
        setControllerVideoQuality(savedVideoQuality());
        setControllerPreviewEnabled(controllerPreviewEnabled);
        sendInputs();announceControllerTakeover();
      }else if(data.t==='preview'){
        if(controllerReady)receivePhonePreview(data.image);
      }else if(data.t==='preview-reset'){
        resetPhonePreview();
      }else if(data.t==='reject'){
        controllerState(data.reason||'ห้องไม่รับผู้เล่น',true);$('joinBtn').disabled=false;
        safePeerDestroy();
      }else if(data.t==='board-state'){
        receiveBoardState(data);
      }else if(data.t==='roster'){
        controllerSessionMode=data.sessionMode||'queue';
        const ready=data.lobbyReady||{};
        controllerLobbyVotes={
          ready:Math.max(0,Math.min(MAX_PLAYERS,Number(ready.ready)||0)),
          total:Math.max(0,Math.min(MAX_PLAYERS,Number(ready.total)||0)),
          selfReady:Array.isArray(ready.voted)&&ready.voted.includes(controllerId)
        };
        showControllerMode(data.mode);
        const self=(data.players||[]).find(p=>p.id===controllerId);
        setControllerGameContext(data.mode,data.phase,!!(self&&self.active));
         controllerPlayerEliminated=!!(data.mode==='shockwave'&&self?.eliminated);
        updatePhoneGamePicker(data.phase,self&&self.choice);
        $('controllerState').textContent=data.phase==='paused'?'จอหลักหยุดเกมชั่วคราว':
          data.phase==='playing'?(self&&self.eliminated?'ตกรอบ • ดูเกมต่อ':self&&self.active?'กำลังเล่น • '+(MODES[data.mode]||'เกม'):'รอรอบถัดไป'):
          data.phase==='roulette'?'กำลังสุ่มเกมรอบถัดไป':data.phase==='countdown'?'เกมกำลังจะเริ่ม':data.phase==='summary'?'กำลังดูคะแนนรวม • กด B กลับล็อบบี้':data.phase==='results'?'จบรอบแล้ว • รอรอบใหม่':
          (controllerLobbyVotes.selfReady?'พร้อมแล้ว • กด A อีกครั้งเพื่อยกเลิก':'กด A เพื่อโหวตเริ่มเกม')+
          ' • '+controllerLobbyVotes.ready+'/'+controllerLobbyVotes.total+' พร้อม';
      }else if(data.t==='result-votes'){
        if(controllerReady&&['results','summary'].includes(controllerGamePhase)){
          controllerResultVotes={
            next:Math.max(0,Math.min(MAX_PLAYERS,Number(data.next)||0)),
            lobby:Math.max(0,Math.min(MAX_PLAYERS,Number(data.lobby)||0)),
            total:Math.max(0,Math.min(MAX_PLAYERS,Number(data.total)||0)),
            nextLabel:typeof data.nextLabel==='string'?data.nextLabel:'เกมถัดไป',
            backLabel:typeof data.backLabel==='string'?data.backLabel:'กลับล็อบบี้',
            autoNextSeconds:Number.isFinite(data.autoNextSeconds)&&data.autoNextSeconds>0?
              Math.ceil(data.autoNextSeconds):null
          };
          showControllerMode(controllerGameMode);
          $('controllerState').textContent='กด A เพื่อเล่นต่อ หรือ B เพื่อ'+controllerResultVotes.backLabel;
        }
      }else if(data.t==='inventory'){
        renderPhoneInventory(data);
       }else if(data.t==='lawn-status'){
        renderPhoneLawnStatus(data);
      }else if(data.t==='shopping-status'){
        renderPhoneShoppingStatus(data);
      }else if(data.t==='pizza-status'){
        renderPhonePizzaStatus(data);
      }else if(data.t==='fruit-status'){
        if(controllerReady&&controllerGameMode==='fruit_memory'&&data.mode==='fruit_memory'){
          const seconds=Math.max(0,Math.min(1.2,Number(data.cooldown)||0));
          $('buttonA').disabled=!!data.eliminated;
          $('buttonA').classList.toggle('cooldown-active',seconds>.03);
          $('buttonA').style.setProperty('--cooldown-sweep',Math.round(seconds/1.2*360)+'deg');
          if(data.eliminated)$('controllerState').textContent='ตกรอบ • ดูการแข่งขันต่อ';
          else if(data.stun>0)$('controllerState').textContent='ถูกสตั้น • '+Number(data.stun).toFixed(1)+' วิ';
        }
       }else if(data.t==='snow-status'){
          if(controllerReady&&controllerGameMode==='snow_brawl'&&data.mode==='snow_brawl'){
            const windup=Math.max(0,Number(data.windup)||0),flat=Math.max(0,Number(data.flat)||0);
            $('buttonA').disabled=!data.alive||flat>.01||windup>.01;
            $('buttonA').classList.toggle('cooldown-active',windup>.01);
            $('buttonA').style.setProperty('--cooldown-sweep',Math.round(Math.min(1,windup/.15)*360)+'deg');
            $('controllerRole').textContent=data.alive?'ผู้รอดชีวิต':'ตกรอบ';
            $('controllerState').textContent=!data.alive?'ตกน้ำ • ตกรอบ':
              flat>.01?'ถูกลูกหิมะทับ • ฟื้นใน '+flat.toFixed(1)+' วิ':
              windup>.01?'เตรียมปล่อยลูกหิมะ • '+windup.toFixed(1)+' วิ':
              'รอด '+data.survivors+' คน • A ปล่อยลูกหิมะ • B ไม่ใช้';
          }
        }else if(data.t==='claim-status'){
          if(controllerReady&&controllerGameMode==='color_claim')
            $('controllerState').textContent=data.eliminated?'COLOR CLAIM • พื้นที่หมด • ตกรอบถาวร':
              'COLOR CLAIM • '+Number(data.percent||0).toFixed(1)+'%'+
              (!data.alive?' • รอเกิดใหม่':data.frozen?' • แช่แข็ง':'');
        }else if(data.t==='ice-status'){
          if(controllerReady&&controllerGameMode==='ice_race')
            $('controllerState').textContent='เช็กพอยต์ '+data.score+' คะแนน'+(data.falling?' • กำลังเกิดใหม่':'');
        }else if(data.t==='gladiators-status'){
          if(controllerReady&&controllerGameMode==='gladiators'&&data.mode==='gladiators'){
           controllerPlayerEliminated=!data.alive;
           $('controllerRole').textContent=data.alive?'ผู้รอดชีวิต':'ตกรอบ';
           $('controllerState').textContent=data.alive?'GLADIATORS • รอด '+data.survivors+' คน':'ตกรอบ • ดูเกมต่อ';
          }
        }else if(data.t==='witch-status'){
          if(controllerReady&&controllerGameMode==='witching_snake')
           $('controllerState').textContent=data.alive?'บินหลบเส้นแสง • ดาว '+data.stars:'ตกรอบ • ดูเกมต่อ';
        }else if(data.t==='boulder-status'){
         if(controllerReady&&controllerGameMode==='boulder_bash'&&data.mode==='boulder_bash'){
           const mode=data.status||'alive',cd=Math.max(0,Number(data.cooldown)||0);
           $('buttonA').disabled=mode!=='alive';
           $('buttonA').classList.toggle('cooldown-active',mode==='alive'&&cd>.03);
           $('buttonA').style.setProperty('--cooldown-sweep',Math.round(Math.min(1,cd/.6)*360)+'deg');
           $('controllerRole').textContent=mode==='rock'?'หินสีของคุณ':mode==='alive'?'ผู้รอดชีวิต':'ตกรอบ';
           $('controllerState').textContent=mode==='rock'?'กำลังควบคุมหิน • เลี้ยวด้วยอนาล็อก':
             mode==='spectator'?'ตกรอบ • รอโอกาสเกิดเป็นหิน':
             'หลบหิน • A ผลัก • เหลือ '+data.survivorCount+' คน';
         }
       }else if(data.t==='shockwave-status'){
         if(controllerReady&&controllerGameMode==='shockwave'&&data.mode==='shockwave'){
            controllerPlayerEliminated=!!data.eliminated;
            $('controllerState').textContent=data.eliminated?'ตกรอบ • ดูเกมต่อ':'SHOCKWAVE • WAVE '+data.wave;
          }
        }else if(data.t==='color-status'){
         if(controllerReady&&controllerGameMode==='color_switch'&&data.mode==='color_switch'){
           const ca=Math.max(0,Math.min(1.1,Number(data.cooldownA)||0));
           const cb=Math.max(0,Math.min(2.8,Number(data.cooldownB)||0));
           for(const [button,seconds,max] of [[$('buttonA'),ca,1.1],[$('buttonB'),cb,2.8]]){
             button.classList.toggle('cooldown-active',seconds>.03);
             button.style.setProperty('--cooldown-sweep',Math.round(seconds/max*360)+'deg');
           }
           $('buttonBLabel').textContent='ระเบิดสี';
           $('buttonB').classList.remove('color-boost-ready');
           $('buttonB').title=cb>.03?'รอ '+cb.toFixed(1)+' วิ':'พร้อมระเบิด 3×3';
           $('controllerState').textContent='คะแนน '+(data.score||0)+
             (data.stun>0?' • สตั้น '+Number(data.stun).toFixed(1)+' วิ':'');
         }
       }else if(data.t==='chicken-status'){
        if(controllerReady&&controllerPlayerActive&&controllerGameMode==='chickens'&&
          data.mode==='chickens'){
          const seconds=Math.max(0,Math.min(1,Number(data.cooldown)||0));
          $('buttonA').classList.toggle('cooldown-active',seconds>.03);
          $('buttonA').style.setProperty('--cooldown-sweep',Math.round(seconds*360)+'deg');
          $('buttonA').title=seconds>.03?'รอตีอีก '+seconds.toFixed(1)+' วิ':'พร้อมตี';
        }
      }else if(data.t==='state'){
        showControllerMode(data.mode);
        setControllerGameContext(data.mode,data.phase,controllerPlayerActive);
        if(data.phase!=='lobby')updatePhoneGamePicker(data.phase,myChosenMode);
        $('controllerState').textContent=data.phase==='paused'?'หยุดเกมชั่วคราว • รอเจ้าของห้อง':
          data.phase==='playing'?(data.mode==='fruit_memory'?'FRUIT MEMORY • รอด '+(data.survivors??'?')+' คน':data.mode==='chickens'?'กำลังไล่จับไก่ • เหลือ '+Math.ceil(data.remaining||0)+' วิ':data.mode==='shockwave'?(controllerPlayerEliminated?'ตกรอบ • ดูเกมต่อ':'SHOCKWAVE • รอด '+(data.survivors??'?')+' คน'):data.mode==='color_switch'?'COLOR SWITCH • เหลือ '+Math.ceil(data.remaining||0)+' วิ':data.mode==='color_claim'?'COLOR CLAIM • เหลือ '+Math.ceil(data.remaining||0)+' วิ':data.mode==='boulder_bash'?'BOULDER BASH • รอด '+(data.survivors??'?')+' คน':data.mode==='witching_snake'?'WITCHING SNAKE • รอด '+(data.survivors??'?')+' คน':data.mode==='ice_race'?'ICE RACE • เหลือ '+Math.ceil(data.remaining||0)+' วิ':data.mode==='lawn_mower'?'LAWN MOWER • เหลือ '+Math.ceil(data.remaining||0)+' วิ':data.mode==='shopping_time'?'SHOPPING TIME • เหลือ '+Math.ceil(data.remaining||0)+' วิ':data.mode==='gladiators'?'GLADIATORS • รอด '+(data.survivors??'?')+' คน':'ผีกำลังไล่จับ • มนุษย์เหลือ '+(data.survivors??'?')+' คน'):
          data.phase==='results'?'จบรอบแล้ว • พบผู้ชนะ':'รอเริ่มรอบ';
        if(data.mode==='board'&&data.phase==='playing')renderPhoneBoard();
      }else if(data.t==='closed'){
        resetControllerForRoomChange('เจ้าของห้องปิดห้องแล้ว');
      }
    });
    conn.on('close',()=>{if(controllerConn===conn)controllerDisconnected();});
    conn.on('error',()=>{if(controllerConn===conn)controllerDisconnected();});
  });
  peer.on('error',err=>{
    if(controllerPeer!==peer)return;
    controllerState('เชื่อมต่อไม่ได้ ('+(err.type||'network')+') • กำลังลองใหม่',true);
    retryPhone();
  });
}
function retryPhone(){
 if(disconnectRequested||reconnectTimer!==null)return;
 if(!parseRoomCode($('roomCodeInput').value))return;
 if(reconnectTries>=14){
   resetControllerForRoomChange('กลับเข้าห้องไม่สำเร็จ กรุณากดเข้าห้องเดิมเพื่อลองอีกครั้ง');
   return;
 }
 reconnectTries++;
 controllerState('กำลังเชื่อมต่อห้องเดิมใหม่ ('+reconnectTries+'/14)');
 reconnectTimer=setTimeout(()=>{
   reconnectTimer=null;
   if(!disconnectRequested)joinRoom(true);
 },Math.min(4800,1000+reconnectTries*360));
}
function controllerDisconnected(){
 if(disconnectRequested)return;
 retryPhone();
}
function isLiveGameContext(){
  return controllerReady&&controllerPlayerActive&&['ghost','pizza_time','shopping_time','lawn_mower','board','boulder_bash','snow_brawl'].includes(controllerGameMode)&&
    ['countdown','playing','paused'].includes(controllerGamePhase);
}
function setControllerGameContext(mode,phase,active){
  controllerGameMode=mode||null;
  if(mode!=='shockwave'||!['countdown','playing','paused'].includes(phase))controllerPlayerEliminated=false;
  const previousControllerPhase=controllerGamePhase;
  controllerGamePhase=phase||'lobby';
  // Remote board camera tools are never shown in a minigame or room lobby.
  const boardZoomActive=controllerReady&&mode==='board'&&
   controllerGamePhase==='playing'&&controllerBoard?.canZoom===true;
  for(const id of ['controllerBoardZoomInBtn','controllerBoardZoomOutBtn']){
   $(id).classList.toggle('hidden',!boardZoomActive);
   $(id).disabled=!boardZoomActive;
  }
  if(!['results','summary'].includes(controllerGamePhase)||
     !['results','summary'].includes(previousControllerPhase))
    controllerResultVotes={next:0,lobby:0,total:0,nextLabel:'เกมถัดไป',backLabel:'กลับล็อบบี้',autoNextSeconds:null};
  controllerPlayerActive=!!active;
  // Revoke camera mode when the walking turn ends or the owner loses control.
  if(boardCameraController?.enabled()&&(!controllerReady||mode!=='board'||
      controllerGamePhase!=='playing'||!controllerPlayerActive||
      controllerBoard?.canZoom!==true||
      !['ready','move_ready','branch','moving'].includes(controllerBoard?.boardPhase)))
    boardCameraController.reset();
  const visible=isLiveGameContext();
  document.body.classList.toggle('pizza-controller-game',visible&&mode==='pizza_time');
  $('controllerInventory').classList.toggle('hidden',!visible);
  if(!visible){
    // Clear stale items on results, lobby, switching rooms or future game modes.
    $('controllerInventory').classList.remove('is-ghost');
    $('controllerRole').textContent='';
    $('inventoryItem').replaceChildren();
    $('inventoryItem').classList.remove('pizza-order-icons','board-bag-icons');
    $('inventoryGuide').replaceChildren();
    $('targetCycleControls').classList.add('hidden');
    $('controllerButtons').classList.remove('has-target','board-bomber-aim');
    $('buttonC').disabled=true;
    $('targetName').textContent='ไม่มีเป้าหมาย';
  }
  showControllerMode(controllerGameMode);
}
function showControllerMode(mode){
  if(mode==='board'&&controllerBoard&&!['results','summary'].includes(controllerGamePhase)){renderPhoneBoard();return;}
  const playing=controllerReady&&controllerPlayerActive&&
    ['countdown','playing','paused'].includes(controllerGamePhase);
  const ghost=playing&&mode==='ghost',chickens=playing&&mode==='chickens';
  const fruit=playing&&mode==='fruit_memory',shockwave=playing&&mode==='shockwave',colorSwitch=playing&&mode==='color_switch',knight=playing&&mode==='knight_match',boulder=playing&&mode==='boulder_bash',snow=playing&&mode==='snow_brawl';
  const lobbyVoting=controllerReady&&controllerGamePhase==='lobby'&&controllerLobbyVotes.total>0;
  const voting=controllerReady&&['results','summary'].includes(controllerGamePhase)&&controllerPlayerActive;
  const aLabel=lobbyVoting?(controllerLobbyVotes.selfReady?'ยกเลิกพร้อม':'พร้อมเริ่ม')+
    ' '+controllerLobbyVotes.ready+'/'+controllerLobbyVotes.total:
    voting?(controllerResultVotes.nextLabel==='สุ่มชุดใหม่จากตัวเลือกเดิม'?'เล่นชุดใหม่':
    controllerResultVotes.nextLabel)+
    (controllerResultVotes.autoNextSeconds!==null?' • อีก '+controllerResultVotes.autoNextSeconds+' วิ':'')+
    ' '+controllerResultVotes.next+'/'+controllerResultVotes.total:
    ghost?'ตีสตั้น':chickens?'ตีให้ไก่หล่น':fruit?'ต่อย':colorSwitch?'ต่อย':knight?'แทงทวน':boulder?'ผลัก':snow?'ปล่อยหิมะ':'';
  const bLabel=voting?controllerResultVotes.backLabel+' '+controllerResultVotes.lobby+'/'+controllerResultVotes.total:
    ghost?($('controllerButtons').classList.contains('has-target')?
    'ยืนยันสโลว์':'ใช้ไอเทม'):colorSwitch?'ระเบิดสี':'';
  $('controllerButtons').classList.remove('board-bomber-aim');
  $('buttonC').disabled=true;
  $('controllerButtons').classList.toggle('chickens-mode',chickens);
  $('controllerButtons').classList.toggle('fruit-memory-mode',fruit);
  $('controllerButtons').classList.toggle('color-switch-mode',colorSwitch);
  if(!colorSwitch){
    $('buttonB').classList.remove('cooldown-active','color-boost-ready');
    $('buttonB').style.removeProperty('--cooldown-sweep');$('buttonB').title='';
  }
   $('controllerButtons').classList.toggle('shockwave-mode',shockwave);
  if(!chickens&&!fruit&&!colorSwitch&&!snow){
    $('buttonA').classList.remove('cooldown-active');
    $('buttonA').style.removeProperty('--cooldown-sweep');
    $('buttonA').title='';
  }
  if(!fruit)$('buttonA').disabled=false;
   if((mode==='witching_snake'||mode==='lawn_mower'||mode==='color_claim'||mode==='ice_race'||mode==='gladiators')&&playing){$('buttonA').disabled=true;$('buttonB').disabled=true;}
   else $('buttonB').disabled=false;
  $('buttonALabel').textContent=aLabel;
  $('buttonBLabel').textContent=bLabel;
  $('buttonA').setAttribute('aria-label',aLabel?'ปุ่ม A '+aLabel:'ปุ่ม A');
  $('buttonB').setAttribute('aria-label',bLabel?'ปุ่ม B '+bLabel:'ปุ่ม B');
  $('controllerModeName').textContent=playing?(MODES[mode]||''):'';
  $('controllerHelp').textContent=lobbyVoting?'กด A เพื่อโหวตเริ่มเกม • ครบทุกคนแล้วเกมเริ่มอัตโนมัติ':ghost?
    'ลากจากที่ว่างเพื่อเดิน • A ตีสตั้น • B ใช้ไอเทม':
    chickens?'วิ่งชนไก่เพื่อจับ • เอาหัวไก่จุ่มในคอก 0.15 วิ • A ตีให้ไก่หล่น':
    fruit?'จำผลไม้แล้ววิ่งไปยังช่องที่ถูกต้อง • ดันกันได้ • A ต่อยให้สตั้น':
    colorSwitch?'วิ่งทาสีสะสมคะแนน • A ต่อยสตั้น • B ระเบิดสี 3×3 • เก็บกล่องทองสะสมคะแนน':
     shockwave?'แตะช่องระเบิดแม้แค่ปลายแขนก็ตกรอบ • หนีให้ทั้งตัวพ้นช่องแดง':
     mode==='color_claim'?'ลากเส้นสีออกนอกเขตแล้วกลับมาปิดวง • ตัดเส้นคู่แข่งให้ตาย • เก็บเกล็ดหิมะเพื่อแช่แข็งทุกคน 4 วิ • A/B ไม่ใช้':
     mode==='gladiators'?'เดิน หมุน และเปลี่ยนทิศเพื่อเหวี่ยงลูกตุ้มหนาม • โซ่ไม่ฆ่า • A/B ไม่ใช้':
     mode==='witching_snake'?'เลี้ยวไม้กวาดด้วยจอย • หลบหางเวทมนตร์และขอบสนาม • ดาวเพิ่มความยาวหาง • A/B ไม่ใช้':
      mode==='ice_race'?'เลื่อนน้ำแข็งลื่นมาก • ดริฟต์วนผ่านเช็กพอยต์ตามลำดับ • ตกแล้วเกิดใหม่ • A/B ไม่ใช้':
      mode==='lawn_mower'?'ขับรถตัดหญ้าด้วยจอย • สุ่มพระอาทิตย์ 1–3 ดวง • ดวงละ 5 คะแนน • A/B ไม่ใช้':
      mode==='snow_brawl'?'เดินปั้นลูกหิมะ • A หยุดเตรียม 0.15 วิแล้วปล่อย • B ไม่ใช้ • ผลักคู่แข่งตกเกาะ':
      mode==='boulder_bash'?'ทางลาดหิมะลื่น • A ผลักโดยไม่สตั้น • หลบหินจากขวา • ตกรอบแล้วมีโอกาสบังคับหิน':
     mode==='knight_match'?'ควบม้าใช้ทวนแทงลูกโป่งสีตัวเอง +1 สีอื่น -1 • A แทง / B ไม่ใช้':
      mode==='shopping_time'?'เข็นรถรับของสูงสุด 5 ชิ้น ไป CHECKOUT ชิ้นละ 1 คะแนน • หลบระเบิด -5 • A/B ไม่ใช้':
      mode==='pizza_time'?'รับวัตถุดิบทีละชิ้น กลับไปส่งเชฟ • เดินรับชนิดใหม่เพื่อเปลี่ยนของ • A/B ไม่ใช้':
    'ลากนิ้วบนพื้นที่ว่างเพื่อเคลื่อนที่';
}
function renderPhoneLawnStatus(info){
  if(!isLiveGameContext()||controllerGameMode!=='lawn_mower'||!info||
    info.id!==controllerId||info.phase!==controllerGamePhase)return;
  $('controllerInventory').classList.remove('is-ghost');
  $('controllerRole').textContent='คะแนน '+info.score+' • พระอาทิตย์ '+info.suns+' ดวง';
  $('inventoryItem').textContent=info.score+' คะแนน';
  $('inventoryGuide').textContent='บังคับด้วยจอย • A/B ไม่ใช้';
  $('targetCycleControls').classList.add('hidden');
 }
 function renderPhoneShoppingStatus(info){
 if(!isLiveGameContext()||controllerGameMode!=='shopping_time'||!info||
   info.id!==controllerId||info.phase!==controllerGamePhase)return;
 $('controllerInventory').classList.remove('is-ghost');
 $('controllerRole').textContent='คะแนน '+info.score+' • รถเข็น '+info.count+'/5';
 $('inventoryItem').classList.remove('pizza-order-icons','board-bag-icons');
 $('inventoryItem').textContent=info.count+'/5';
 $('inventoryGuide').textContent=info.stun>0?'โดนระเบิด • สตั้น '+info.stun.toFixed(1)+' วิ':
   'เก็บสินค้า → CHECKOUT • ระเบิด -5 • A/B ไม่ใช้';
 $('targetCycleControls').classList.add('hidden');
}
function renderPhonePizzaStatus(info){
 if(!isLiveGameContext()||controllerGameMode!=='pizza_time'||!info||
    info.id!==controllerId||info.phase!==controllerGamePhase)return;
 const art=window.PizzaIngredientArt,names=art.names;
 $('controllerInventory').classList.remove('is-ghost');
 $('controllerRole').textContent='ออร์เดอร์ '+(info.delivered?.length||0)+'/2 • '+(info.score||0)+' คะแนน';
 const items=$('inventoryItem');
 items.classList.remove('board-bag-icons');
 items.classList.add('pizza-order-icons');
 art.appendRow(items,info.order||[],info.delivered||[],{size:17,showName:true});
 const guide=$('inventoryGuide');
 guide.replaceChildren();
 if(info.held){
   const item=art.item(document,info.held,{size:15});
   if(item)guide.append(item);
   const text=document.createElement('span');
   text.textContent='ถือ '+(names[info.held]||'วัตถุดิบ')+' • ส่งเชฟหรือสลับที่โต๊ะอื่น';
   guide.append(text);
 }else{
   guide.textContent='มือว่าง • เดินไปรับวัตถุดิบ';
 }
 $('targetCycleControls').classList.add('hidden');
 $('controllerButtons').classList.remove('has-target');
}
function renderPhoneInventory(info){
  if(!isLiveGameContext()||!info||info.id!==controllerId||
     info.mode!==controllerGameMode||info.phase!==controllerGamePhase)return;
  if(controllerGameMode!=='ghost')return;
  const names=window.GhostAttack.ITEM_NAMES;
  const isGhost=!!info.ghost;
  $('controllerRole').textContent=isGhost?'ผี':'มนุษย์';
  $('controllerInventory').classList.toggle('is-ghost',isGhost);
  $('inventoryItem').classList.remove('pizza-order-icons','board-bag-icons');
  $('inventoryItem').textContent=isGhost?'เป้าหมาย: ไล่จับมนุษย์':
    'ไอเทม: '+(names[info.item]||'ว่าง');
  $('inventoryGuide').textContent=isGhost?'แตะมนุษย์เพื่อเปลี่ยนเป็นผี':
    info.selecting?'ใช้ ▲ ▼ เลือกเพื่อน · B ยืนยัน':
    info.item==='slow'?'B เพื่อเลือกเพื่อน':
    info.item?'B เพื่อใช้':'';
  $('targetCycleControls').classList.toggle('hidden',!info.selecting);
  $('controllerButtons').classList.toggle('has-target',!!info.selecting);
  $('targetName').textContent=info.targetName||'ไม่มีเป้าหมาย';
  showControllerMode(info.mode);
}
function sendInputs(){
 if(!controllerReady)return;
 const keys={...controllerKeys};
 // Never let a delayed heartbeat or a stale held stick move a walking avatar
 // while that player's controller is in camera inspection mode.
 if(boardCameraController?.enabled()){
   keys.axisX=0;keys.axisY=0;keys.left=false;keys.right=false;keys.jump=false;keys.down=false;
   if(controllerBoard?.boardPhase==='ready'){keys.action=false;keys.alt=false;keys.cancel=false;}
 }
 send(controllerConn,{t:'input',keys,turnId:controllerBoard?.turnId,mapVersion:controllerBoard?.mapVersion,actionId:++controllerActionId});
}
function isPortraitScreen(){
  if(window.matchMedia)return window.matchMedia('(orientation: portrait)').matches;
  return Number(window.innerHeight)>Number(window.innerWidth);
}
// Safari on iPhone can resize or offset the actually visible area when its
// address bar/toolbar moves, without matching 100dvw/100dvh immediately.
// Bound the phone gamepad to the visual viewport, never the oversized layout
// viewport. The CSS fallback still works on browsers missing this API.
function syncControllerVisibleViewport(){
  const style=$('controller')?.style;
  if(typeof style?.setProperty!=='function')return;
  const view=window.visualViewport;
  const w=Number(view?.width)||Number(window.innerWidth);
  const h=Number(view?.height)||Number(window.innerHeight);
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return;
  const left=Number(view?.offsetLeft)||0,top=Number(view?.offsetTop)||0;
  style.setProperty('--gf-controller-visible-width',w+'px');
  style.setProperty('--gf-controller-visible-height',h+'px');
  style.setProperty('--gf-controller-visible-left',left+'px');
  style.setProperty('--gf-controller-visible-top',top+'px');
}
// iOS fires visualViewport.resize independently of window.resize when the
// Safari controls retract or expand; address both and orientation changes.
window.addEventListener('resize',syncControllerVisibleViewport);
window.addEventListener('orientationchange',syncControllerVisibleViewport);
window.addEventListener('pageshow',syncControllerVisibleViewport);
window.visualViewport?.addEventListener?.('resize',syncControllerVisibleViewport);
window.visualViewport?.addEventListener?.('scroll',syncControllerVisibleViewport);
// Opt-in only: by default the existing real-landscape controller remains unchanged.
function clearPortraitFallback(){
  releaseStick();
  document.body.classList.remove('portrait-fallback');
  $('portraitRestoreBtn').classList.add('hidden');
}
function enablePortraitFallback(){
  if(!controllerReady||!isPortraitScreen())return;
  releaseStick();
  document.body.classList.add('portrait-fallback');
  syncControllerVisibleViewport();
  $('portraitRestoreBtn').classList.remove('hidden');
}
// If the phone is eventually rotated, return to the normal landscape gamepad.
function followDeviceOrientation(){
  if(!isPortraitScreen()&&document.body.classList.contains('portrait-fallback'))
    clearPortraitFallback();
}
window.addEventListener('orientationchange',followDeviceOrientation);
window.addEventListener('resize',followDeviceOrientation);
// Request landscape from both the join form and the live controller. If a
// browser rejects the lock, leave the form usable and let the player rotate.
function requestLandscape(){
  const panel=$('controller');
  let request=null;
  try{
    if(panel.requestFullscreen&&!document.fullscreenElement)
      request=panel.requestFullscreen();
  }catch(_){/* Fullscreen is not available on this device. */}
  if(request&&typeof request.then==='function')
    return request.then(tryLandscapeOrientation,tryLandscapeOrientation);
  tryLandscapeOrientation();
  return Promise.resolve();
}
let releaseStick=()=>{};
function bindAnalogStick(zone,base,knob,target){
  let pointerId=null,originX=0,originY=0;
  const hintStorageKey='gf-joystick-hint-seen-v1';
  let hintDismissed=false;
  try{hintDismissed=window.localStorage.getItem(hintStorageKey)==='1';}catch(_){}
  if(hintDismissed)zone.classList.add('hint-dismissed');
  const dismissHint=()=>{
    if(hintDismissed)return;
    hintDismissed=true;
    zone.classList.add('hint-dismissed');
    try{window.localStorage.setItem(hintStorageKey,'1');}catch(_){}
  };
  const rotated=()=>document.body.classList.contains('portrait-fallback')&&isPortraitScreen();
  const reset=()=>{
    pointerId=null;originX=0;originY=0;
    target.axisX=0;target.axisY=0;
    knob.style.transform='translate(-50%,-50%)';
    zone.classList.remove('is-active','is-moving');
    sendInputs();
  };
  const move=e=>{
    // Movement is measured from the first touch, not a fixed screen position.
    // CSS rotated portrait mode needs inverse rotation of the finger delta.
    const dx=e.clientX-originX,dy=e.clientY-originY;
    const localX=rotated()?dy:dx,localY=rotated()?-dx:dy;
    const box=base.getBoundingClientRect();
    // Input force derives from finger distance, not the visual ring's size.
    const travel=64;
    const knobTravel=Math.max(12,Math.min(box.width,box.height)*.28);
    const len=Math.hypot(localX,localY),factor=len>travel?travel/len:1;
    let x=Math.round(localX*factor/travel*100)/100;
    let y=Math.round(localY*factor/travel*100)/100;
    if(Math.hypot(x,y)<.14){x=0;y=0;}
    zone.classList.toggle('is-moving',Math.hypot(x,y)>=.14);
    if(x===0)x=0;if(y===0)y=0;
    knob.style.transform='translate(calc(-50% + '+Math.round(x*knobTravel)+'px),calc(-50% + '+Math.round(y*knobTravel)+'px))';
    if(target.axisX!==x||target.axisY!==y){
      target.axisX=x;target.axisY=y;sendInputs();
    }
  };
  zone.addEventListener('pointerdown',e=>{
    if(pointerId!==null||!controllerReady)return;
    e.preventDefault();
    dismissHint();
    pointerId=e.pointerId;
    originX=e.clientX;originY=e.clientY;
    // Place the visual ring exactly under the finger in LOCAL UI coordinates,
    // including when the entire gamepad is CSS-rotated 90 degrees.
    const box=zone.getBoundingClientRect();
    const halfX=box.left+box.width/2,halfY=box.top+box.height/2;
    const localWidth=rotated()?box.height:box.width;
    const localHeight=rotated()?box.width:box.height;
    const offsetX=rotated()?e.clientY-halfY:e.clientX-halfX;
    const offsetY=rotated()?-(e.clientX-halfX):e.clientY-halfY;
    base.style.left=(localWidth/2+offsetX)+'px';
    base.style.top=(localHeight/2+offsetY)+'px';
    knob.style.transform='translate(-50%,-50%)';
    zone.classList.add('is-active');
    target.axisX=0;target.axisY=0;
    try{zone.setPointerCapture(pointerId);}catch(_){}
    sendInputs();
  });
  zone.addEventListener('pointermove',e=>{
    if(e.pointerId!==pointerId)return;
    e.preventDefault();move(e);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture']){
    zone.addEventListener(type,e=>{if(e.pointerId===pointerId)reset();});
  }
  zone.addEventListener('contextmenu',e=>e.preventDefault());
  releaseStick=reset;
}
function bindControl(btn, target, id){
  const key=btn.dataset.control;if(!key)return;
  // Use the full, nonoverlapping A/B half of the right-side control column
  // instead of making players aim for the small circular button. The circle
  // remains visual feedback; its parent catches touches all the way to edges.
  const touchZone=btn.parentElement?.classList?.contains('face-button-wrap')?
    btn.parentElement:btn;
  const activePointers=new Set();
  const change=(pressed)=>{
    if(target[key]===pressed)return;
    target[key]=pressed;btn.classList.toggle('pressed',pressed);
    if(id==='remote'){
      if(pressed&&key==='action'&&controllerReady&&controllerGamePhase==='lobby')
        send(controllerConn,{t:'lobby-ready'});
      if(pressed&&controllerReady&&controllerPlayerActive&&['results','summary'].includes(controllerGamePhase)){
        const choice=key==='action'?'next':key==='alt'?'lobby':null;
        if(choice)send(controllerConn,{t:'result-vote',choice});
      }
      sendInputs();
    }
  };
  touchZone.addEventListener('pointerdown',e=>{
    if(btn.disabled)return;
    e.preventDefault();
    const pointer=e.pointerId??0;
    activePointers.add(pointer);
    try{touchZone.setPointerCapture(pointer);}catch(_){}
    change(true);
  });
  const release=e=>{
    const pointer=e.pointerId??0;
    if(!activePointers.delete(pointer))return;
    e.preventDefault?.();
    change(activePointers.size>0);
  };
  touchZone.addEventListener('pointerup',release);
  touchZone.addEventListener('pointercancel',release);
  touchZone.addEventListener('lostpointercapture',release);
  touchZone.addEventListener('contextmenu',e=>e.preventDefault());
}
document.addEventListener('keydown',e=>{
  if(currentView!=='game'||e.target.matches('input,select,textarea'))return;
  const locals=players.filter(p=>p.type==='local'&&!p.isBot);
  KEYS.forEach((mapping,i)=>{const p=locals[i];if(!p)return;for(const k of INPUT_NAMES)if(e.code===mapping[k]){p.input[k]=true;e.preventDefault();}});
});
document.addEventListener('keyup',e=>{
  const locals=players.filter(p=>p.type==='local'&&!p.isBot);
  KEYS.forEach((mapping,i)=>{const p=locals[i];if(!p)return;for(const k of INPUT_NAMES)if(e.code===mapping[k]){p.input[k]=false;e.preventDefault();}});
});
window.addEventListener('blur',()=>{
  resetInputs();for(const k of INPUT_NAMES)controllerKeys[k]=false;
  releaseStick();sendInputs();
  document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));
});

// BOARD PARTY owns a session, not a seventh entry in the minigame registry.
// Catalog entries are eligible even when their engine bytes have not been
// fetched. The selected game is loaded and validated before the reel ends.
function boardRegistry(){return Object.fromEntries(modesFor('board').map(id=>{
 const platform=window.GamePlatform,d=platform?.descriptor(id);
 if(d&&(players.length<d.players.min||players.length>d.players.max))return [id,null];
 const engine=gameEngine(id);
 if(engine&&(!d||platform.ready(id)))return [id,engine];
 if(!d)return [id,engine];
 const unavailable=()=>{throw Error('Minigame not preloaded: '+id);};
 return [id,{minPlayers:d.players.min,maxPlayers:d.players.max,
  setup:unavailable,update:unavailable,draw:unavailable}];
}));}
function warmBoardGames(){
 const platform=window.GamePlatform;
 if(!platform?.revision||round?.mode!=='board'||navigator?.connection?.saveData)return;
 // Warm only two candidates per visit. Never download every game just to open
 // BOARD PARTY on a metered mobile connection.
 const candidates=platform.games('board').filter(g=>
  players.length>=g.players.min&&players.length<=g.players.max&&!platform.ready(g.id));
 for(const game of candidates.slice(0,2)){
  void platform.ensure(game.id).catch(error=>console.warn('Board game unavailable: '+game.id,error));
 }
}
let boardCatalogPending=false,boardCorePending=null;
function beginBoard(){
  const platform=window.GamePlatform;
  // Production no longer downloads legacy minigame engines at initial page load.
  // Wait for the versioned registry rather than mistaking them for missing games.
  if(window.GAME_CORE_VERSION&&platform&&!platform.revision){
    if(boardCatalogPending)return;
    boardCatalogPending=true;
    void platform.refresh().then(()=>{
      boardCatalogPending=false;
      if(currentView!=='hostLobby'||selectedSessionMode!=='board'||!players.length)return;
      if(platform.revision)beginBoard();
      else showToast('กำลังรอรายชื่อมินิเกมจากเซิร์ฟเวอร์',true);
    }).catch(error=>{
      boardCatalogPending=false;
      showToast('โหลดรายชื่อมินิเกมไม่สำเร็จ: '+String(error?.message||error).slice(0,100),true);
    });
    return;
  }
  // Fetch BOARD core only for BOARD; preserve the idle lobby while loading.
  const core=window.BoardRuntime;
  if(core&&!core.ready()){
    if(boardCorePending)return boardCorePending;
    const sessionMode=selectedSessionMode;
    boardCorePending=core.ensure().then(()=>{
      boardCorePending=null;
      if(currentView==='hostLobby'&&!round&&!boardSession&&players.length&&
         selectedSessionMode===sessionMode)return beginBoard();
    }).catch(error=>{
      boardCorePending=null;
      console.error('BOARD PARTY asset load failed',error);
      showToast('โหลด BOARD PARTY ไม่สำเร็จ: '+String(error?.message||error).slice(0,100),true);
    });
    return boardCorePending;
  }
  const required=['BoardMap','BoardDice','BoardItems','BoardBots','BoardMinigame','BoardParty','BoardArt','PartyPlayerAvatar'];
  if(required.some(name=>!window[name])){showToast('โหลด BOARD PARTY ไม่ครบ กรุณาโหลดหน้าใหม่',true);return;}
  if(!window.BoardMinigame.eligible(boardRegistry(),players.length).length){showToast('ไม่มีมินิเกมที่พร้อมเล่น',true);return;}
  try{
    tournament=null;gameSelection=null;
    boardSession=window.BoardParty.create(players);
    boardSession.camera.lowDetail=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
    window.BoardArt.overview(boardSession);
    players.forEach(p=>{p.active=true;});
    window.PartyPlayerAvatar.preload(boardSession.players);
    showBoard();warmBoardGames();requestHostFullscreen();
  }catch(error){
    console.error('BOARD PARTY start failed',error);returnToLobby();
    showToast('เริ่ม BOARD PARTY ไม่สำเร็จ: '+String(error?.message||error).slice(0,100),true);
  }
}
// Host-screen zoom requires a local human in their OWN BOARD turn; remote
// players zoom only from their authenticated phones.
function hostCanControlBoardZoom(){
 const s=boardSession,p=s&&window.BoardParty?.current(s);
 return !!(round?.mode==='board'&&round.phase==='playing'&&p&&
   (players.some(q=>q.id===p.id&&q.type==='local'&&!q.isBot)||s.players.every(q=>q.isBot))&&
   window.BoardArt?.canPan?.(s));
}
function refreshBoardTools(){
 const active=round?.mode==='board'&&!!boardSession;
 $('boardTools').classList.toggle('hidden',!active);
 if(active){
  const c=boardSession.camera;
  const botsOnly=boardSession.players.every(p=>p.isBot);
   if(!botsOnly){c.debugNodes=false;c.selectedId=null;}
   $('boardNodeDebugBtn').classList.toggle('hidden',!botsOnly);
   $('boardNodeDebugBtn').setAttribute('aria-pressed',String(botsOnly&&!!c.debugNodes));
  $('boardEffectsBtn').setAttribute('aria-pressed',String(!!c.lowDetail));
  $('boardStartDiceBtn').classList.add('hidden'); // Automatic 2-second panorama, no manual start required.
  const canZoom=hostCanControlBoardZoom();
  // Overview/follow change zoom implicitly; treat them as zoom controls too.
  $('boardFollowBtn').disabled=['overview','intro_zoom'].includes(boardSession.phase)||!canZoom;
  $('boardOverviewBtn').disabled=boardSession.phase==='intro_zoom'||
    (boardSession.phase!=='overview'&&!canZoom);
  $('boardZoomInBtn').disabled=!canZoom;$('boardZoomOutBtn').disabled=!canZoom;
 }
 if(active&&round.paused){
  $('pauseBtn').title='เล่นต่อ';$('pauseBtn').setAttribute('aria-label','เล่นต่อ');
  $('pauseBtn').classList.add('board-resume');
 }else{
  $('pauseBtn').title='หยุดเกม';$('pauseBtn').setAttribute('aria-label','หยุดเกม');
  $('pauseBtn').classList.remove('board-resume');
 }
}
function showBoard(){
  round={mode:'board',phase:'playing',paused:false,remaining:null,autoNextRemaining:0};
  resetInputs();boardStateToken=null;
  $('gameRoulette').classList.add('hidden');$('results').classList.add('hidden');
  $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.remove('hidden');
  $('boardExitBtn').classList.add('hidden');
  $('pauseBtn').setAttribute('aria-expanded','false');$('gameBanner').textContent='';
  document.body.classList.add('board-playing');
  setView('game');
  // Paint the order/result screen in the Start event itself. Safari can delay
  // its first animation frame during fullscreen; old minigame clips must not survive.
  canvas.width=canvas.width;markArenaResolutionDirty();refreshBoardTools();drawGame(graphicsClock);
  renderLeaderboard();broadcastRoster();renderBotTestPad();
  remotePreviewClock=1.1;
  for(const conn of hostConnections)startHostVideoCall(conn);
}
function updateBoard(dt){
  const s=boardSession;if(!s||round.phase==='results')return;
  // Local human keys follow the same sequence- and turn-checked path.
  for(const p of players.filter(p=>p.type==='local'&&!p.isBot)){
    const keys={...p.input,axisX:p.input.axisX||Number(p.input.right)-Number(p.input.left),axisY:p.input.axisY||Number(p.input.down)-Number(p.input.jump)};
    window.BoardParty.input(s,p.id,{turnId:s.turnId,actionId:(s.lastActions[p.id]??0)+1,keys});
  }
  // Board is turn-based: catch up to elapsed wall-clock time in short,
  // bounded steps. Never let low FPS stretch control timeouts indefinitely.
  let pending=Math.max(0,Math.min(1,Number(dt)||0));
  for(let ticks=0;ticks<20&&pending>1e-6;ticks++){
    const step=Math.min(.05,pending);
    window.BoardParty.update(s,step);
    pending-=step;
    if(s.phase==='minigame_pending'||s.phase==='minigame'||s.phase==='finished')break;
  }
  refreshBoardTools();
   if(s.phase==='minigame_pending'){
    const mode=window.BoardMinigame.pick(boardRegistry(),s.players.length,s.lastMinigame,s.rng);
    if(!mode)throw Error('No compatible minigame');
    s.savedBoard=window.BoardParty.snapshot(s);
    if(window.BoardParty.minigameStarted(s,mode))beginGameSelection(mode);
    return;
  }
  if(s.phase==='finished'){if(s.time-s.phaseAt>=1.8)finishBoard();return;}
  boardStateClock+=dt;
  const stateKey=s.turnId+':'+s.phase+':'+window.BoardParty.remainingSteps(s,window.BoardParty.current(s)?.id);
  if(boardStateToken!==stateKey||boardStateClock>.2){broadcastBoardState();boardStateClock=0;boardStateToken=stateKey;}
}
function broadcastBoardState(){
  if(!boardSession||round?.mode!=='board')return;
  for(const conn of hostConnections){
    const p=boardSession.players.find(p=>p.id===conn.playerId);if(!p)continue;
    send(conn,{t:'board-state',mapVersion:boardSession.map.version,phase:networkPhase(),turnId:boardSession.turnId,boardPhase:boardSession.phase,
      round:boardSession.roundNumber,hp:p.hp,usedRound:p.usedRound||0,stepsRemaining:window.BoardParty.remainingSteps(boardSession,p.id),shieldTurns:window.BoardParty.isProtected(boardSession,p)?1:0,
      canZoom:round.phase==='playing'&&!round.paused&&window.BoardParty.current(boardSession)?.id===p.id&&
        window.BoardArt.canPan(boardSession),
      item:window.BoardItems.names[p.item]||'ไม่มีไอเทม',
      bag:window.BoardItems.bag(p).slice(),actionIndex:p.actionIndex||0,bagMessage:p.bagMessage||'',
      ...window.BoardParty.controls(boardSession,p.id)});
  }
}
function receiveBoardState(info){
  const previousToken=controllerBoard?.turnId;
  controllerBoard=info;setControllerGameContext('board',info.phase,true);
  if(info.phase!=='results')renderPhoneBoard();
  // A release sent with the previous token may have been rejected by the host.
  // Resend the physical button/stick state as soon as the new control phase arrives.
  if(info.phase==='playing'&&info.turnId!==previousToken)sendInputs();
}
function renderPhoneBoard(){
 const info=controllerBoard;if(!info||controllerGameMode!=='board')return;
 $('buttonA').disabled=false;$('buttonB').disabled=false;
 for(const cls of ['chickens-mode','fruit-memory-mode','color-switch-mode','shockwave-mode','has-target'])$('controllerButtons').classList.remove(cls);
 // The existing on-screen C button cancels either UFO or bomber targeting.
 // Reuse the aim-layout class so the control stays visible on narrow phones.
 const itemAim=info.boardPhase==='aim'&&info.c==='ยกเลิก';
 $('controllerButtons').classList.toggle('board-bomber-aim',itemAim);
 $('buttonC').disabled=!itemAim;
 $('buttonCLabel').textContent=itemAim?'ยกเลิก':'';
 $('buttonC').setAttribute('aria-label',itemAim?'C ยกเลิกการเล็งไอเทม':'C');
 $('targetCycleControls').classList.add('hidden');
 for(const id of ['buttonA','buttonB']){$(id).classList.remove('cooldown-active','color-boost-ready');$(id).style.removeProperty('--cooldown-sweep');}
 $('controllerModeName').textContent='BOARD PARTY • ROUND '+info.round;
 $('buttonALabel').textContent=info.a||'';$('buttonBLabel').textContent=info.b||'';
 $('buttonA').setAttribute('aria-label','A '+(info.a||''));$('buttonB').setAttribute('aria-label','B '+(info.b||''));
 $('controllerHelp').textContent=info.boardPhase==='ready'&&boardCameraController?.enabled()?
    'ดูแผนที่ • ลากจอยเพื่อเลื่อน / หุบกางเพื่อซูม • ดับเบิลแท็บเพื่อกลับกระเป๋า':info.help||'';
 $('controllerInventory').classList.toggle('hidden',controllerGamePhase!=='playing'||
   (info.boardPhase==='ready'&&!!boardCameraController?.enabled()));
 const bag=Array.isArray(info.bag)?info.bag:[],ready=info.boardPhase==='ready';
 const items=window.BoardItems||window.PartyBoardItemMeta;
 if(!items){$('controllerState').textContent='กำลังโหลดข้อมูลกระเป๋าเกม...';return;}
 const options=['roll',...items.ids],stock=Object.fromEntries(items.ids.map(id=>[id,0]));
 for(const id of bag)if(Object.hasOwn(stock,id))stock[id]++;
 const selected=ready&&Number.isInteger(info.actionIndex)?Math.max(0,Math.min(options.length-1,info.actionIndex)):0;
 $('controllerRole').textContent='HP '+info.hp+'/100 • เหลือ '+(info.stepsRemaining||0)+' ก้าว • ไอเทม '+bag.length+' ชิ้น'+(info.shieldTurns?' • โล่ป้องกัน':'');
 const host=$('inventoryItem');host.classList.remove('pizza-order-icons','board-bag-icons');host.replaceChildren();
 host.classList.add('board-bag-icons');
 const svg=window.PartyUiArt,doc=host.ownerDocument||document;
 const rollIcon='<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="7" width="22" height="22" rx="5" fill="#fff4dc" stroke="#d2a85b" stroke-width="2"/><rect x="24" y="18" width="20" height="20" rx="5" fill="#f9f5ec" stroke="#d2a85b" stroke-width="2"/><g fill="#4c5e73"><circle cx="10" cy="13" r="2.5"/><circle cx="20" cy="23" r="2.5"/><circle cx="30" cy="24" r="2.5"/><circle cx="38" cy="32" r="2.5"/></g></svg>';
 for(let i=0;i<options.length;i++){
   const id=options[i],qty=id==='roll'?null:stock[id],cell=doc.createElement('span');
   const locked=id!=='roll'&&info.usedRound===info.round;
   cell.className='board-bag-item'+(qty===0?' is-empty':'')+(locked?' is-locked':'')+(ready&&i===selected&&!locked&&qty!==0?' is-selected':'');
   cell.innerHTML=id==='roll'?rollIcon:svg?.svg(id)||'';
   cell.title=id==='roll'?'ทอยลูกเต๋า':items.names[id]||id;
   cell.setAttribute('aria-label',cell.title+(qty===null?'':' จำนวน '+qty));
   if(qty!==null){
     const badge=doc.createElement('span');
     badge.className='board-item-count';badge.textContent=String(qty);
     cell.append(badge);
   }
   host.append(cell);
 }
 const guide=$('inventoryGuide');
 const mapInspection=info.boardPhase==='ready'&&!!boardCameraController?.enabled();
 const slot=options[selected]||'roll';
 guide.textContent=mapInspection?'กำลังดูแผนที่ • ดับเบิลแท็บบนจอยอีกครั้งเพื่อเปิดกระเป๋า':info.boardPhase==='aim'?
   'เล็งเป้า • A '+(info.a||'ยืนยัน')+' • B '+(info.b||'ไม่ใช้')+' • C '+(info.c||'ยกเลิก'):
   ready?(info.usedRound===info.round?'ใช้ไอเทมแล้ว 1 ชิ้น • A ทอยลูกเต๋าต่อ':
     'เลือก: '+(slot==='roll'?'ทอยลูกเต๋า':items.names[slot]||slot)+
     ' • A '+(info.a||'ยืนยัน')+' • B '+(info.b||'เปลี่ยนไอเทม')+
     (info.bagMessage?' • '+info.bagMessage:'')):
   'ทอยลูกเต๋า + ไอเทมทั้ง 6 ชนิด';
 $('controllerState').textContent=info.help||'';
}
function finishBoard(){
  round.phase='results';round.paused=false;resetInputs();renderBotTestPad();
  $('pauseBtn').classList.add('hidden');
  const s=boardSession,ranked=[...s.players].sort((a,b)=>s.map.nodes[b.currentNodeId].progress-s.map.nodes[a.currentNodeId].progress);
  $('results').querySelector('.eyebrow').textContent='BOARD PARTY • FINISH';
  $('results').querySelector('h2').textContent='ผู้ชนะ: '+s.players.filter(p=>s.winnerIds.includes(p.id)).map(p=>p.name).join(' / ');
  const list=$('resultList');list.replaceChildren();
  for(const p of ranked){
    const progress=s.map.nodes[p.currentNodeId].progress,rank=1+ranked.filter(q=>s.map.nodes[q.currentNodeId].progress>progress).length;
    const row=document.createElement('div');row.className='result-player';
    const name=document.createElement('div');name.textContent='อันดับ '+rank+' • '+p.name;name.style.color=p.color;
    const note=document.createElement('small');note.textContent=Math.round(progress/s.map.length*100)+'% • HP '+p.hp+'/'+window.BoardParty.MAX_HP;
    row.append(name,note);list.append(row);
  }
  $('results').classList.remove('hidden');broadcastRoster();beginResultVoting();
}

function startRound(forcedMode=null){
  document.body.classList.remove('board-playing');
  gameSelection=null;
  $('gameRoulette').classList.add('hidden');
  if(!players.length)return;
  if(forcedMode!==null&&!Object.hasOwn(MODES,forcedMode)){
    showToast('ไม่รู้จักเกมที่เลือก: '+String(forcedMode));return;
  }
  const mode=forcedMode??'ghost';
  const engine=gameEngine(mode);
  if(!engine||typeof engine.setup!=='function'||typeof engine.draw!=='function'){
    showToast('โหลดเอนจิน '+(MODES[mode]||mode)+' ไม่สำเร็จ • ตรวจ Deploy แล้วเปิดเว็บใหม่',true);
    return;
  }
  $('results').classList.add('hidden');
  round={mode,pluginEngine:engine,pluginHash:window.GamePlatform?.descriptor(mode)?.hash||null,phase:'countdown',paused:false,countdown:mode==='shockwave'?2:3,remaining:null,autoNextRemaining:0,
    rules:{viewMode:'topdown'}};
  try{
    // Reset cross-minigame punch state before each new match.
    for(const p of players){p.stun=0;p.punchCooldown=0;window.PartyCombatMotion.reset(p);}
    window.PartyPlayerAvatar.preload(players);
    engine.setup(round,players);
  }catch(error){
    console.error('Game setup failed',mode,error);
    round=null;
    showToast('เริ่ม '+(MODES[mode]||mode)+' ไม่สำเร็จ: '+String(error?.message||error).slice(0,100),true);
    return;
  }
  $('results').querySelector('.eyebrow').textContent=MODES[mode];
  $('results').querySelector('h2').textContent=mode==='ghost'?'ผู้รอดคนสุดท้าย!':(mode==='fruit_memory'||mode==='shockwave')?'ผู้รอดชีวิตคนสุดท้าย!':mode==='color_switch'?'ผู้ทำคะแนนสูงสุด!':mode==='color_claim'?'ผู้ยึดพื้นที่มากที่สุด!':mode==='ice_race'?'ผ่านเช็กพอยต์มากที่สุด!':mode==='lawn_mower'?'ผู้สะสมพระอาทิตย์มากที่สุด!':mode==='shopping_time'?'คิดเงินให้ได้คะแนนสูงสุด!':mode==='pizza_time'?'ส่งพิซซ่าให้ได้มากที่สุด!':mode==='knight_match'?'แทงลูกโป่งสีตัวเองให้มากที่สุด!':(mode==='boulder_bash'||mode==='snow_brawl'||mode==='witching_snake'||mode==='gladiators')?'ผู้รอดชีวิตคนสุดท้าย!':'จับไก่ให้ได้มากที่สุด!';
  // Countdown and player count now live in the solid map-corner HUD.
  $('gameBanner').textContent='';
  $('replayBtn').textContent=tournament?'เกมถัดไป':'เล่นอีกครั้ง';
  $('pauseMenu').classList.add('hidden');
  $('pauseBtn').classList.remove('hidden');
  $('pauseBtn').setAttribute('aria-expanded','false');
  setView('game');
  requestHostFullscreen();
  remotePreviewClock=1.1;
  stopAllHostVideoCalls();
  broadcast({t:'preview-reset'});
  renderLeaderboard();broadcastRoster();renderBotTestPad();
  broadcastPlayerInventories();
  for(const conn of hostConnections)startHostVideoCall(conn);
}
function updateRound(dt){
  if(!round||round.paused)return;
  if(round.mode==='board'){updateBoard(dt);return;}
  if(round.phase==='countdown'){
    if(round.mode==='ghost')window.GhostAttack.update(dt,round,players);
     if(round.mode==='shockwave')window.Shockwave.update(dt,round,players);
    if(round.mode==='fruit_memory')window.FruitMemory.update(dt,round,players);
    round.countdown=Math.max(0,round.countdown-dt);
    $('gameBanner').textContent='';
    if(round.countdown===0){
      round.phase='playing';
      if(round.mode==='ghost')round.ghost.ghostSpawned=true;
      $('gameBanner').textContent='';
      broadcastRoster();
    }
    return;
  }
  if(round.phase!=='playing')return;
  // A controller dropping packets does not drift forever.
  for(const p of players){
    if(p.type==='remote'&&Date.now()-(p.lastInputAt||0)>900){
      for(const k of INPUT_NAMES)p.input[k]=false;
      p.input.axisX=0;p.input.axisY=0;
    }
  }
  const result=gameEngine(round.mode).update(dt,round,players);
  if(result==='winner')endRound();
}

// Result decisions are host-authoritative. Connected human controllers count;
// bots have no joypad and must never prevent a unanimous decision.
function resultVoters(){
  return players.filter(p=>p.type==='remote'&&p.active&&p.conn?.open&&p.conn.playerId===p.id);
}
function resultNextLabel(){
  if(!tournament)return 'เล่นอีกครั้ง';
  if(tournament.endless)return 'เกมถัดไป';
  return tournament.index+1<tournament.schedule.length?'เกมถัดไป':'สุ่มชุดใหม่จากตัวเลือกเดิม';
}
// Rank 1 earns 11, rank 2 earns 10 and rank 12 earns 0, always using
// twelve as the fixed scale (even if a room has fewer players).
function pointsForRank(rank,count){
  return tournament?.endless?Math.max(0,MAX_PLAYERS-rank):Math.max(1,count-rank+1);
}
function awardRoundPoints(ordered,rankOf){
  if(!tournament)return;
  for(const p of ordered){
    const points=pointsForRank(rankOf(p),ordered.length);
    p.total=(p.total||0)+points;
    p.lastRoundPoints=points;
  }
}
function totalScoreNote(p){
  if(!tournament)return '';
  return tournament.endless?' • +'+(p.lastRoundPoints||0)+' แต้ม • รวม '+p.total+' คะแนน':
    ' • รวม '+p.total+' คะแนน';
}
function canAutoAdvanceResults(){
  return !!(tournament&&(tournament.endless||tournament.index+1<tournament.schedule.length)&&$('autoNext').checked);
}
function resultBackLabel(){
  if(round?.phase==='summary')return 'กลับล็อบบี้';
  return tournament?.endless?'สรุปคะแนน':'กลับล็อบบี้';
}
function resultVoteSnapshot(){
  if(!round||!['results','summary'].includes(round.phase))return null;
  if(!round.resultVotes)round.resultVotes={next:new Set(),lobby:new Set()};
  const valid=new Set(resultVoters().map(p=>p.id));
  for(const name of ['next','lobby'])
    for(const id of round.resultVotes[name])if(!valid.has(id))round.resultVotes[name].delete(id);
  return {t:'result-votes',
    next:round.resultVotes.next.size,lobby:round.resultVotes.lobby.size,
    total:valid.size,nextLabel:resultNextLabel(),backLabel:resultBackLabel(),
    // The same authoritative 7-second auto-next timer drives the host button
    // and each connected phone's A label. Votes do not pause or reset it.
    autoNextSeconds:round.phase==='results'&&round.autoNextRemaining>0?Math.ceil(round.autoNextRemaining):null};
}
function renderResultVotes(sendUpdate=false){
  const v=resultVoteSnapshot();if(!v)return;
  const seconds=v.autoNextSeconds!==null?' • อีก '+v.autoNextSeconds+' วิ':'';
  // Align A/B on the left, action text in the center and votes on the right.
  // The accessibility label contains the full sentence for screen readers.
  const next=$('replayBtn'),back=$('backBtn');
  next.textContent=v.nextLabel+seconds;
  next.dataset.action='A';next.dataset.votes=v.next+'/'+v.total;
  next.setAttribute('aria-label','A '+next.textContent+' '+next.dataset.votes);
  back.textContent=v.backLabel;
  back.dataset.action='B';back.dataset.votes=v.lobby+'/'+v.total;
  back.setAttribute('aria-label','B '+v.backLabel+' '+back.dataset.votes);
  // Only broadcast when the displayed second changes or a vote changes;
  // never spam all controllers on every animation frame.
  if(sendUpdate||round.lastBroadcastAutoNextSeconds!==v.autoNextSeconds){
    round.lastBroadcastAutoNextSeconds=v.autoNextSeconds;
    broadcast(v);
  }
}

function layoutFinalResults(){
  // Keep legacy label/score nodes first: voting, accessibility and game engines
  // consume those. The new vector portrait and rank plaque are decorative.
  const list=$('resultList');
  const children=Array.from(list.children);
  const rows=children.filter(el=>String(el.className||'').split(/\s+/).includes('result-player'));
  const hasHeading=children.some(el=>String(el.className||'').split(/\s+/).includes('tournament-header'));
  const width=Number(window.innerWidth)||960;
  // Fill full rows from the BOTTOM. Any short row belongs at the TOP and
  // is centered, so 5 players become [1] / [2 3 4 5] rather than leaving
  // 3 dead slots beside the fifth-place card. Two micro-tracks per card make
  // a 1/2/3-card top row mathematically centered without resizing cards.
  const maxColumns=rows.length<=4?
    Math.max(1,Math.min(rows.length-1,width>=620?3:2)):
    width>=1060?4:width>=620?3:2;
  const columns=Math.max(1,Math.min(rows.length||1,maxColumns));
  const lines=Math.max(1,Math.ceil(rows.length/columns));
  const topCount=rows.length%columns||columns;
  list.style.setProperty('--result-cols',String(columns));
  list.style.setProperty('--result-tracks',String(columns*2));
  list.style.setProperty('--result-rows',String(lines));
  list.dataset.count=String(rows.length);
  list.dataset.cols=String(columns);
  list.dataset.topCount=String(topCount);
  list.classList.toggle('has-heading',hasHeading);
  const roster=round?.mode==='board'&&boardSession?boardSession.players:players;
  rows.forEach((row,index)=>{
    // Rank order in DOM is untouched for screen readers and result voting.
    // Only its CSS position changes. The header occupies grid row 1.
    const top=index<topCount;
    const visualRow=top?0:1+Math.floor((index-topCount)/columns);
    const slot=top?index:(index-topCount)%columns;
    const track=1+2*slot+(top?columns-topCount:0);
    row.style.gridColumn=track+' / span 2';
    row.style.gridRow=String(visualRow+1+(hasHeading?1:0));
    row.style.setProperty('--rank-delay',String(index));

    const label=row.children[0],detail=row.children[1];
    // Result engines still supply the original rank/name label. Preserve it as
    // metadata so repeated responsive layouts never lose the real competition
    // rank after we display only the player's name on the plaque.
    const name=String(row.dataset.rankSource||label?.textContent||'');
    if(!row.dataset.rankSource)row.dataset.rankSource=name;
    const color=label?.style?.color||'#9fb9da';
    const match=name.match(/อันดับ\s*(\d+)|(?:^|\s)(\d+)\.\s*/);
    const rank=Number(match?.[1]||match?.[2]||index+1);
    row.dataset.rank=String(rank);
    row.classList.toggle('is-winner',rank===1);
    row.classList.toggle('is-podium',rank<=3);
    row.style.setProperty('--result-accent',color);
    // Distinct player-owned banner colors, NEVER fixed purple/silver/green by rank.
    const playerName=(name.includes(' • ')?name.split(' • ').pop():
      name.replace(/^(?:ผู้ชนะ\s*)?อันดับ\s*\d+(?:\s*ร่วม)?\s*[.\-–]?\s*/, '')).trim();
    // The shiny 1ST/2ND/3RD ordinal already communicates position. The text
    // line should be just "บอท 4", never "อันดับ 1 • บอท 4".
    if(label){label.textContent=playerName;label.title=playerName;}
    const p=roster.find(q=>q.name===playerName&&q.color===color)||
      roster.find(q=>q.name===playerName)||{color};
    row.dataset.playerId=String(p.id||'');
    let portrait=Array.from(row.children).find(x=>x.className==='result-avatar');
    if(!portrait){
      portrait=document.createElement('div');
      portrait.className='result-avatar';portrait.setAttribute('aria-hidden','true');
      row.append(portrait);
    }
    // The SVG is locally authored, colors strictly match the validated player.
    portrait.innerHTML=window.PartyPlayerAvatar?.svgForFront(p.color)||'';
    let badge=Array.from(row.children).find(x=>x.className==='result-ordinal');
    if(!badge){
      badge=document.createElement('div');
      badge.className='result-ordinal';badge.setAttribute('aria-hidden','true');
      row.append(badge);
    }
    const suffix=rank%100>=11&&rank%100<=13?'TH':rank%10===1?'ST':rank%10===2?'ND':rank%10===3?'RD':'TH';
    badge.textContent=String(rank)+suffix;
    row.title=name+' • '+(detail?.textContent||'');
    row.setAttribute('aria-label',row.title);
  });
}


function showCumulativeScores(){
  if(!tournament?.endless||!round||round.phase!=='results')return false;
  // The player requested a scoreboard: stop auto-advance while it is open.
  round.autoNextRemaining=0;
  round.phase='summary';
  round.paused=false;
  const list=$('resultList');list.replaceChildren();
  const ranked=players.filter(p=>p.active).sort((a,b)=>
    (b.total||0)-(a.total||0)||String(a.id).localeCompare(String(b.id)));
  const heading=document.createElement('div');heading.className='tournament-header';
  heading.textContent='คะแนนสะสมหลังจบ '+(tournament.roundsPlayed+1)+' เกม • อันดับร่วมได้คะแนนเท่ากัน';
  list.append(heading);
  for(const p of ranked){
    const rank=1+ranked.filter(q=>(q.total||0)>(p.total||0)).length;
    const tied=ranked.filter(q=>(q.total||0)===(p.total||0)).length>1;
    const row=document.createElement('div');row.className='result-player';
    const label=document.createElement('div');
    label.style.color=p.color;
    label.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
    const score=document.createElement('span');
    score.textContent=(p.total||0)+' คะแนนสะสม • เกมล่าสุด +'+(p.lastRoundPoints||0);
    row.append(label,score);list.append(row);
  }
  $('results').querySelector('.eyebrow').textContent='ALL GAMES • SCOREBOARD';
  $('results').querySelector('h2').textContent='ตารางคะแนนรวม';
  $('results').classList.remove('hidden');
  broadcastRoster();
  beginResultVoting();
  return true;
}
function onResultBack(){
  if(round?.phase==='summary'){returnToLobby();return;}
  if(round?.phase==='results'&&tournament?.endless){
    showCumulativeScores();return;
  }
  returnToLobby();
}
function beginResultVoting(){
  layoutFinalResults();
  round.resultVotes={next:new Set(),lobby:new Set()};
  renderResultVotes(true);
}
function castResultVote(conn,choice){
  if(!round||!['results','summary'].includes(round.phase)||!['next','lobby'].includes(choice))return;
  const voter=resultVoters().find(p=>p.id===conn.playerId&&p.conn===conn);
  if(!voter)return;
  const votes=round.resultVotes||(round.resultVotes={next:new Set(),lobby:new Set()});
  for(const name of ['next','lobby'])votes[name].delete(voter.id);
  votes[choice].add(voter.id);
  const snapshot=resultVoteSnapshot();
  renderResultVotes(true);
  // Unanimity acts instantly. Host buttons and the countdown still work.
  if(snapshot.total>0&&snapshot[choice]===snapshot.total){
    if(choice==='next')advanceParty();
    else onResultBack();
  }
}
function endPluginRound(){
 const results=round.pluginEngine.getResult(round,players),active=players.filter(p=>p.active);
 if(!Array.isArray(results)||results.length!==active.length)throw Error('Incomplete plugin result');
 const scores=new Map();
 for(const item of results){
  if(!item||typeof item.id!=='string'||scores.has(item.id)||
   typeof item.value!=='number'||Number.isNaN(item.value))throw Error('Invalid plugin result');
  scores.set(item.id,item);
 }
 if(active.some(p=>!scores.has(p.id)))throw Error('Result missing a participant');
 const value=p=>scores.get(p.id).value;
 const ranked=active.slice().sort((a,b)=>value(b)-value(a)||String(a.id).localeCompare(String(b.id)));
 const rank=p=>1+ranked.filter(q=>value(q)>value(p)).length;
 awardRoundPoints(ranked,rank);
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 const winners=ranked.filter(p=>rank(p)===1);
 $('results').querySelector('h2').textContent=winners.length===1?'ผู้ชนะ: '+winners[0].name:'เสมอ • อันดับ 1 ร่วม';
 const list=$('resultList');list.replaceChildren();
 for(const p of ranked){
  const item=scores.get(p.id),row=document.createElement('div');
  row.className='result-player';
  const label=document.createElement('div');label.style.color=p.color;
  label.textContent='อันดับ '+rank(p)+(winners.length>1&&rank(p)===1?' ร่วม':'')+' • '+p.name;
  const detail=document.createElement('span');
  detail.textContent=(typeof item.label==='string'?item.label:
    value(p)===Infinity?'ผู้รอดชีวิต':value(p)+' คะแนน')+totalScoreNote(p);
  row.append(label,detail);list.append(row);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endRound(){
  if(!round||round.phase==='results')return;
  if(boardSession?.phase==='minigame'){
    const ranking=window.BoardMinigame.ranking(round,players);
    // Ignore duplicate end notifications: board state accepts one result only.
    if(window.BoardParty.minigameEnded(boardSession,ranking))showBoard();
    return;
  }
  // After returning to the board, any delayed minigame "end" callback must
  // not open the normal results page a second time.
  if(boardSession&&round.mode==='board')return;
  if(round.pluginEngine?.getResult&&round.mode!=='ghost'){endPluginRound();return;}
   if(round.mode==='color_claim'){endColorClaimRound();return;}
   if(round.mode==='snow_brawl'){endSnowBrawlRound();return;}
   if(round.mode==='boulder_bash'){endBoulderBashRound();return;}
    if(round.mode==='gladiators'){endGladiatorsRound();return;}
    if(round.mode==='witching_snake'){endWitchingSnakeRound();return;}

   if(round.mode==='lawn_mower'){endLawnMowerRound();return;}
   if(round.mode==='ice_race'){endShoppingTimeRound();return;}
   if(round.mode==='shopping_time'){endShoppingTimeRound();return;}
   if(round.mode==='pizza_time'){endPizzaTimeRound();return;}
   if(round.mode==='knight_match'){endKnightMatchRound();return;}
   if(round.mode==='color_switch'){endColorSwitchRound();return;}
  if(round.mode==='chickens'){endChickensRound();return;}
  if(round.mode==='fruit_memory'){endFruitMemoryRound();return;}
   if(round.mode==='shockwave'){endShockwaveRound();return;}
  round.phase='results';round.paused=false;resetInputs();broadcastRoster();
  $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
  // Same infection frame OR same 0.1-second score -> shared competition rank.
  // When all humans are infected, winnerId is a fallback, not proof of a solo winner.
  const finishValue=p=>!p.ghost?Infinity:
    Math.floor((Number.isFinite(p.infectedAt)?p.infectedAt:
      Number.isFinite(p.survival)?p.survival:0)*10+1e-7);
  const ranked=players.filter(p=>p.active).sort((a,b)=>
    finishValue(b)-finishValue(a)||String(a.id).localeCompare(String(b.id)));
  const rankOf=p=>1+ranked.filter(q=>finishValue(q)>finishValue(p)).length;
  const first=ranked.filter(p=>rankOf(p)===1);
  $('results').querySelector('h2').textContent=first.length>1?
    'เสมอ! อันดับ 1 ร่วม':first[0]&&!first[0].ghost?
      'ผู้รอดคนสุดท้าย!':'อยู่รอดนานที่สุด!';
  awardRoundPoints(ranked,rankOf);
  round.autoNextRemaining=canAutoAdvanceResults()?7:0;
  const list=$('resultList');list.replaceChildren();
  ranked.forEach(p=>{
    const rank=rankOf(p),tied=ranked.filter(q=>rankOf(q)===rank).length>1;
    const row=document.createElement('div');row.className='result-player';
    const label=document.createElement('div');
    label.textContent=(rank===1?'ผู้ชนะ ':'')+'อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
    label.style.color=p.color;
    const detail=document.createElement('span');
    detail.textContent=(p.ghost?'ตกรอบ':'ผู้รอดคนสุดท้าย')+
      (p.ghost&&Number.isFinite(p.infectedAt)?' • '+p.infectedAt.toFixed(1)+' วิ':'')+
      totalScoreNote(p);
    row.append(label,detail);list.append(row);
  });
  if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
    const overall=[...ranked].sort((a,b)=>b.total-a.total);
    list.replaceChildren();
    overall.forEach(p=>{
      const row=document.createElement('div');row.className='result-player';
      const rank=1+overall.filter(q=>q.total>p.total).length;
      const name=document.createElement('div');name.textContent='อันดับ '+rank+'. '+p.name;
      name.style.color=p.color;
      const score=document.createElement('span');score.textContent=p.total+' คะแนนรวม';
      row.append(name,score);list.append(row);
    });
    const heading=document.createElement('div');heading.className='tournament-header';
    const top=overall.filter(p=>p.total===overall[0].total);
    heading.textContent=top.length===1?'ผู้ชนะรวม: '+top[0].name:
      'คะแนนรวมเสมอ: '+top.map(p=>p.name).join(', ');list.prepend(heading);
  }
  $('results').classList.remove('hidden');$('gameBanner').textContent='';
  beginResultVoting();
  renderLeaderboard();
}

function endColorClaimRound(){
 const state=round.colorClaim;
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const value=p=>state.counts[p.cc?.slot]||0;
 const ranked=players.filter(p=>p.active).slice().sort((a,b)=>value(b)-value(a)||String(a.id).localeCompare(String(b.id)));
 const rankOf=p=>1+ranked.filter(q=>value(q)>value(p)).length;
 awardRoundPoints(ranked,rankOf);
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 const winners=ranked.filter(p=>rankOf(p)===1);
 $('results').querySelector('h2').textContent=winners.length===1?
  'ผู้ชนะ: '+winners[0].name:'เสมอ! อันดับ 1 ร่วม';
 const list=$('resultList');list.replaceChildren();
 const render=(people,totals=false)=>{
  const score=p=>totals?(p.total||0):value(p);
  for(const p of people){
   const rank=1+people.filter(q=>score(q)>score(p)).length;
   const tied=people.filter(q=>score(q)===score(p)).length>1;
   const row=document.createElement('div');row.className='result-player';
   const label=document.createElement('div');label.style.color=p.color;
   label.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
   const detail=document.createElement('span');
   detail.textContent=totals?p.total+' คะแนนรวม':
    p.score.toFixed(2)+'% ของสนาม'+(p.cc?.eliminated?' • พื้นที่หมด • ตกรอบถาวร':'')+totalScoreNote(p);
   row.append(label,detail);list.append(row);
  }
 };
 render(ranked);
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
  const overall=ranked.slice().sort((a,b)=>b.total-a.total||String(a.id).localeCompare(String(b.id)));
  list.replaceChildren();render(overall,true);
  const joint=overall.filter(p=>p.total===overall[0].total);
  const head=document.createElement('div');head.className='tournament-header';
  head.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:
   'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
  list.prepend(head);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endGladiatorsRound(){
 const s=round.gladiators;
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const value=p=>p.gladiator?.alive?Infinity:(p.gladiator?.eliminatedTick??-1);
 const ranked=players.filter(p=>p.active).slice().sort((a,b)=>value(b)-value(a)||String(a.id).localeCompare(String(b.id)));
 const rankOf=p=>1+ranked.filter(q=>value(q)>value(p)).length;
 awardRoundPoints(ranked,rankOf);
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 const top=ranked.filter(p=>rankOf(p)===1);
 $('results').querySelector('h2').textContent=ranked.length===1?
  (top[0]?.gladiator?.alive?'รอดชีวิตครบ 60 วินาที!':'เอาตัวรอดไม่สำเร็จ'):
  top.length>1?'เสมอ! อันดับ 1 ร่วม':
  top[0]?.gladiator?.alive?'ผู้ชนะ: '+top[0].name:'อยู่รอดนานที่สุด: '+top[0]?.name;
 const list=$('resultList');list.replaceChildren();
 const show=(people,useTotal=false)=>{
  const get=p=>useTotal?p.total:value(p);
  for(const p of people){
   const rank=1+people.filter(q=>get(q)>get(p)).length;
   const tied=people.some(q=>q!==p&&get(q)===get(p));
   const row=document.createElement('div');row.className='result-player';
   const label=document.createElement('div');label.style.color=p.color;
   label.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
   const detail=document.createElement('span');
   detail.textContent=useTotal?p.total+' คะแนนรวม':
    (p.gladiator?.alive?'ผู้รอดชีวิต':'ตกรอบ')+' • '+
     (p.gladiator?.eliminatedAt??s.clock).toFixed(1)+' วิ'+totalScoreNote(p);
   row.append(label,detail);list.append(row);
  }
 };
 show(ranked);
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
  list.replaceChildren();const overall=ranked.slice().sort((a,b)=>b.total-a.total);
  show(overall,true);
  const leaders=overall.filter(p=>p.total===overall[0].total);
  const title=document.createElement('div');title.className='tournament-header';
  title.textContent=leaders.length>1?'คะแนนรวมเสมอ: '+leaders.map(p=>p.name).join(', '):
   'ผู้ชนะรวม: '+leaders[0].name;list.prepend(title);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endWitchingSnakeRound(){
 const state=round.witchingSnake;
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const ranked=players.filter(p=>p.active).slice().sort((a,b)=>
  Number(!!b.ws?.alive)-Number(!!a.ws?.alive)||
  (b.ws?.eliminatedTick??0)-(a.ws?.eliminatedTick??0)||
  String(a.id).localeCompare(String(b.id)));
 const value=p=>p.ws?.alive?Infinity:(p.ws?.eliminatedTick??0);
 const rankOf=p=>1+ranked.filter(q=>value(q)>value(p)).length;
 awardRoundPoints(ranked,rankOf);
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 const top=ranked.filter(p=>rankOf(p)===1);
 $('results').querySelector('h2').textContent=ranked.length===1?
  (top[0]?.ws?.alive?'เอาตัวรอดครบ 60 วินาที!':'เอาตัวรอดไม่สำเร็จ'):
  top.length>1?'เสมอ! อันดับ 1 ร่วม':
  top[0]?.ws?.alive?'ผู้ชนะ: '+top[0].name:'อยู่รอดนานที่สุด: '+top[0]?.name;
 const list=$('resultList');list.replaceChildren();
 const show=(people,useTotal=false)=>{
  const get=q=>useTotal?q.total:value(q);
  for(const p of people){
   const rank=1+people.filter(q=>get(q)>get(p)).length;
   const tied=people.filter(q=>get(q)===get(p)).length>1;
   const row=document.createElement('div');row.className='result-player';
   const label=document.createElement('div');label.style.color=p.color;
   label.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
   const detail=document.createElement('span');
   detail.textContent=useTotal?p.total+' คะแนนรวม':
    (p.ws?.alive?'รอดชีวิต':'ตกรอบ')+' • '+(p.ws?.eliminatedAt??state.clock).toFixed(1)+
    ' วิ • ดาว '+(p.ws?.stars||0)+totalScoreNote(p);
   row.append(label,detail);list.append(row);
  }
 };
 show(ranked);
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
  list.replaceChildren();const overall=ranked.slice().sort((a,b)=>b.total-a.total);
  show(overall,true);
  const first=overall.filter(p=>p.total===overall[0].total);
  const header=document.createElement('div');header.className='tournament-header';
  header.textContent=first.length===1?'ผู้ชนะรวม: '+first[0].name:
   'คะแนนรวมเสมอ: '+first.map(p=>p.name).join(', ');
  list.prepend(header);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endShockwaveRound(){
 const s=round.shockwave;round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const winners=new Set(s.winnerIds?.length?s.winnerIds:(s.winnerId?[s.winnerId]:[]));
 const value=p=>winners.has(p.id)?Infinity:(p.shockEliminatedAt||0);
 const ranked=players.filter(p=>p.active).sort((a,b)=>
   value(b)-value(a)||String(a.id).localeCompare(String(b.id)));
 const rankOf=p=>1+ranked.filter(q=>value(q)>value(p)).length;
 if(tournament){
   awardRoundPoints(ranked,rankOf);
   $('replayBtn').textContent=tournament.index===tournament.schedule.length-1?
     'สุ่มชุดใหม่จากตัวเลือกเดิม':'เกมถัดไป ('+(tournament.index+2)+'/'+tournament.schedule.length+')';
 }else $('replayBtn').textContent='เล่นอีกครั้ง';
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 const firstPlace=ranked.filter(p=>winners.has(p.id));
 $('results').querySelector('h2').textContent=firstPlace.length>1?
   'ผู้ชนะร่วม: '+firstPlace.map(p=>p.name).join(' / '):
   firstPlace.length?'ผู้ชนะ: '+firstPlace[0].name:'ไม่มีผู้ชนะ';
 const list=$('resultList');list.replaceChildren();
 ranked.forEach(p=>{
   const row=document.createElement('div');row.className='result-player';
   const name=document.createElement('div');name.style.color=p.color;
   name.textContent='อันดับ '+rankOf(p)+' • '+p.name;
   const detail=document.createElement('span');
   detail.textContent=(winners.has(p.id)?(firstPlace.length>1?'อันดับ 1 ร่วม':'ผู้รอดคนสุดท้าย'):'ตกรอบ Wave '+(p.shockEliminatedWave||s.wave))+
     totalScoreNote(p);
   row.append(name,detail);list.append(row);
 });
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
   const overall=[...ranked].sort((a,b)=>b.total-a.total);list.replaceChildren();
   overall.forEach((p,i)=>{
     const row=document.createElement('div');row.className='result-player';
     const name=document.createElement('div');name.textContent='อันดับ '+(1+overall.filter(q=>q.total>p.total).length)+' • '+p.name;name.style.color=p.color;
     const score=document.createElement('span');score.textContent=p.total+' คะแนนรวม';
     row.append(name,score);list.append(row);
   });
   const joint=overall.filter(p=>p.total===overall[0].total);
   const heading=document.createElement('div');heading.className='tournament-header';
   heading.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
   list.prepend(heading);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
  beginResultVoting();
  renderLeaderboard();
}
function endSnowBrawlRound(){
 const state=round.snowBrawl,byId=new Map(state.ranking.map(x=>[x.id,x]));
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const ranked=players.filter(p=>p.active).sort((a,b)=>
  (byId.get(a.id)?.rank||99)-(byId.get(b.id)?.rank||99)||
  String(a.id).localeCompare(String(b.id)));
 const winners=ranked.filter(p=>state.winnerIds.includes(p.id));
 awardRoundPoints(ranked,p=>byId.get(p.id)?.rank||ranked.length);
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 $('results').querySelector('h2').textContent=winners.length===1?'ผู้ชนะ: '+winners[0].name:
  winners.length>1?'เสมอ • อันดับ 1 ร่วม':'ไม่มีผู้รอดชีวิต';
 const list=$('resultList');list.replaceChildren();
 const render=(people,useTotal=false)=>{
  const value=p=>useTotal?(p.total||0):-(byId.get(p.id)?.rank||people.length);
  for(const p of people){
   const rank=1+people.filter(q=>value(q)>value(p)).length;
   const tied=people.filter(q=>value(q)===value(p)).length>1;
   const row=document.createElement('div');row.className='result-player';
   const name=document.createElement('div');name.style.color=p.color;
   name.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
   const detail=document.createElement('span');
   detail.textContent=useTotal?p.total+' คะแนนรวม':
     (p.snow?.alive?'รอดชีวิต':(p.snow?.eliminatedAt||0).toFixed(1)+' วินาที')+totalScoreNote(p);
   row.append(name,detail);list.append(row);
  }
 };
 render(ranked);
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
  list.replaceChildren();const overall=[...ranked].sort((a,b)=>b.total-a.total);
  render(overall,true);
  const joint=overall.filter(p=>p.total===overall[0].total);
  const heading=document.createElement('div');heading.className='tournament-header';
  heading.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:
   'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
  list.prepend(heading);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endBoulderBashRound(){
 const s=round.boulderBash,byId=new Map(s.ranking.map(r=>[r.id,r]));
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const ranked=players.filter(p=>p.active).sort((a,b)=>(byId.get(a.id)?.rank||99)-(byId.get(b.id)?.rank||99));
 const winners=ranked.filter(p=>s.winnerIds.includes(p.id));
 awardRoundPoints(ranked,p=>byId.get(p.id)?.rank||ranked.length);
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 $('results').querySelector('h2').textContent=winners.length===1?'ผู้ชนะ: '+winners[0].name:
   winners.length>1?'เสมอ • อันดับ 1 ร่วม':'ไม่มีผู้รอดชีวิต';
 const list=$('resultList');list.replaceChildren();
 const render=(people,useTotal=false)=>{
   const score=p=>useTotal?p.total:-(byId.get(p.id)?.rank||ranked.length);
   for(const p of people){
     const rank=1+people.filter(q=>score(q)>score(p)).length;
     const tied=people.some(q=>q!==p&&score(q)===score(p));
     const row=document.createElement('div');row.className='result-player';
     const name=document.createElement('div');name.style.color=p.color;
     name.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
     const note=document.createElement('span');
     note.textContent=useTotal?p.total+' คะแนนรวม':
       (p.bb?.alive?'รอดชีวิต':(p.bb?.eliminatedAt||0).toFixed(1)+' วินาที')+totalScoreNote(p);
     row.append(name,note);list.append(row);
   }
 };
 render(ranked);
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
   list.replaceChildren();const overall=[...ranked].sort((a,b)=>b.total-a.total);
   render(overall,true);
   const joint=overall.filter(p=>p.total===overall[0].total);
   const heading=document.createElement('div');heading.className='tournament-header';
   heading.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
   list.prepend(heading);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endColorSwitchRound(){
 const s=round.colorSwitch;
 window.ColorSwitch.calculateFinalRanking(s,players);
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const byId=new Map(s.ranking.map(r=>[r.id,r]));
 const ranked=players.filter(p=>p.active).sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));
 const winners=ranked.filter(p=>s.winnerIds.includes(p.id));
 if(tournament){
   awardRoundPoints(ranked,p=>byId.get(p.id)?.rank||ranked.length);
   $('replayBtn').textContent=tournament.index===tournament.schedule.length-1?
     'สุ่มชุดใหม่จากตัวเลือกเดิม':'เกมถัดไป ('+(tournament.index+2)+'/'+tournament.schedule.length+')';
 }else $('replayBtn').textContent='เล่นอีกครั้ง';
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 $('results').querySelector('h2').textContent=winners.length===1?'ผู้ชนะ: '+winners[0].name:'คะแนนเสมอ!';
 const list=$('resultList');list.replaceChildren();
 ranked.forEach(p=>{
   const row=document.createElement('div');row.className='result-player';
   const name=document.createElement('div');name.style.color=p.color;
   const rank=byId.get(p.id)?.rank||1;
    const tied=ranked.filter(q=>(byId.get(q.id)?.rank||1)===rank).length>1;
    name.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
   const score=document.createElement('span');
   score.textContent=p.score+' คะแนน'+totalScoreNote(p);
   row.append(name,score);list.append(row);
 });
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
   const overall=[...ranked].sort((a,b)=>b.total-a.total||String(a.id).localeCompare(String(b.id)));
   list.replaceChildren();
   overall.forEach(p=>{
     const row=document.createElement('div');row.className='result-player';
     const name=document.createElement('div');name.textContent='อันดับ '+(1+overall.filter(q=>q.total>p.total).length)+' • '+p.name;name.style.color=p.color;
     const score=document.createElement('span');score.textContent=p.total+' คะแนนรวม';
     row.append(name,score);list.append(row);
   });
   const joint=overall.filter(p=>p.total===overall[0].total);
   const heading=document.createElement('div');heading.className='tournament-header';
   heading.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
   list.prepend(heading);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
  beginResultVoting();
  renderLeaderboard();
}
function endKnightMatchRound(){
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const ranked=players.filter(p=>p.active).sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));
 const top=ranked[0]?.score??0,winners=ranked.filter(p=>p.score===top);
 awardRoundPoints(ranked,p=>1+ranked.filter(q=>q.score>p.score).length);
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 $('results').querySelector('h2').textContent=winners.length===1?'ผู้ชนะ: '+winners[0].name:'คะแนนเสมอ • อันดับ 1 ร่วม';
 const list=$('resultList');list.replaceChildren();
 const show=(people,useTotal=false)=>people.forEach(p=>{
  const value=q=>useTotal?q.total:q.score;
  const rank=1+people.filter(q=>value(q)>value(p)).length;
  const row=document.createElement('div');row.className='result-player';
  const label=document.createElement('div');label.style.color=p.color;
  label.textContent='อันดับ '+rank+(people.filter(q=>value(q)===value(p)).length>1?' ร่วม':'')+' • '+p.name;
  const score=document.createElement('span');score.textContent=value(p)+(useTotal?' คะแนนรวม':' คะแนน')+(useTotal?'':totalScoreNote(p));
  row.append(label,score);list.append(row);
 });
 show(ranked);
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
  list.replaceChildren();
  const overall=[...ranked].sort((a,b)=>b.total-a.total||String(a.id).localeCompare(String(b.id)));
  show(overall,true);
  const first=overall.filter(p=>p.total===overall[0].total);
  const title=document.createElement('div');title.className='tournament-header';
  title.textContent=first.length===1?'ผู้ชนะรวม: '+first[0].name:'คะแนนรวมเสมอ: '+first.map(p=>p.name).join(', ');
  list.prepend(title);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endLawnMowerRound(){
  endShoppingTimeRound();
}
function endShoppingTimeRound(){
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const ranked=players.filter(p=>p.active).sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));
 const top=ranked[0]?.score??0,winners=ranked.filter(p=>p.score===top);
 awardRoundPoints(ranked,p=>1+ranked.filter(q=>q.score>p.score).length);
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 $('results').querySelector('h2').textContent=winners.length===1?'ผู้ชนะ: '+winners[0].name:'คะแนนเสมอ • อันดับ 1 ร่วม';
 const list=$('resultList');list.replaceChildren();
 const show=(people,useTotal=false)=>people.forEach(p=>{
   const value=q=>useTotal?q.total:q.score;
   const rank=1+people.filter(q=>value(q)>value(p)).length;
   const tied=people.filter(q=>value(q)===value(p)).length>1;
   const row=document.createElement('div');row.className='result-player';
   const label=document.createElement('div');label.style.color=p.color;
   label.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
   const score=document.createElement('span');
   score.textContent=useTotal?p.total+' คะแนนรวม':p.score+' คะแนน'+totalScoreNote(p);
   row.append(label,score);list.append(row);
 });
 show(ranked);
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
   list.replaceChildren();
   const overall=[...ranked].sort((a,b)=>b.total-a.total||String(a.id).localeCompare(String(b.id)));
   show(overall,true);
   const first=overall.filter(p=>p.total===overall[0].total);
   const title=document.createElement('div');title.className='tournament-header';
   title.textContent=first.length===1?'ผู้ชนะรวม: '+first[0].name:'คะแนนรวมเสมอ: '+first.map(p=>p.name).join(', ');
   list.prepend(title);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endPizzaTimeRound(){
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const ranked=players.filter(p=>p.active).sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));
 const top=ranked[0]?.score??0,winners=ranked.filter(p=>p.score===top);
 awardRoundPoints(ranked,p=>1+ranked.filter(q=>q.score>p.score).length);
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 $('results').querySelector('h2').textContent=winners.length===1?'ผู้ชนะ: '+winners[0].name:'คะแนนเสมอ • อันดับ 1 ร่วม';
 const list=$('resultList');list.replaceChildren();
 const show=(people,useTotal=false)=>people.forEach(p=>{
   const value=q=>useTotal?q.total:q.score;
   const rank=1+people.filter(q=>value(q)>value(p)).length;
   const tied=people.filter(q=>value(q)===value(p)).length>1;
   const row=document.createElement('div');row.className='result-player';
   const label=document.createElement('div');label.style.color=p.color;
   label.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
   const score=document.createElement('span');
   score.textContent=useTotal?p.total+' คะแนนรวม':p.score+' ออร์เดอร์'+totalScoreNote(p);
   row.append(label,score);list.append(row);
 });
 show(ranked);
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
   list.replaceChildren();
   const overall=[...ranked].sort((a,b)=>b.total-a.total||String(a.id).localeCompare(String(b.id)));
   show(overall,true);
   const first=overall.filter(p=>p.total===overall[0].total);
   const title=document.createElement('div');title.className='tournament-header';
   title.textContent=first.length===1?'ผู้ชนะรวม: '+first[0].name:'คะแนนรวมเสมอ: '+first.map(p=>p.name).join(', ');
   list.prepend(title);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endChickensRound(){
  round.phase='results';round.paused=false;resetInputs();broadcastRoster();
  $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
  const ranked=players.filter(p=>p.active).sort((a,b)=>b.score-a.score);
  const best=ranked[0]?.score??0;
  const winners=ranked.filter(p=>p.score===best);
  if(tournament){
    awardRoundPoints(ranked,p=>1+ranked.filter(q=>q.score>p.score).length);
    $('replayBtn').textContent=tournament.index===tournament.schedule.length-1?
      'สุ่มชุดใหม่จากตัวเลือกเดิม':
      'เกมถัดไป ('+(tournament.index+2)+'/'+tournament.schedule.length+')';
  }else $('replayBtn').textContent='เล่นอีกครั้ง';
  round.autoNextRemaining=canAutoAdvanceResults()?7:0;
  $('results').querySelector('h2').textContent=winners.length===1?
    'ผู้ชนะ: '+winners[0].name:'คะแนนเสมอ!';
  const list=$('resultList');list.replaceChildren();
  ranked.forEach((p,i)=>{
    const row=document.createElement('div');row.className='result-player';
    const name=document.createElement('div');name.style.color=p.color;
    const rank=1+ranked.filter(q=>q.score>p.score).length;
    name.textContent='อันดับ '+rank+
      (ranked.filter(q=>q.score===p.score).length>1?' ร่วม':'')+' • '+p.name;
    const score=document.createElement('span');
    score.textContent=p.score+' ไก่'+totalScoreNote(p);
    row.append(name,score);list.append(row);
  });
  if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
    const overall=[...ranked].sort((a,b)=>b.total-a.total);
    list.replaceChildren();
    overall.forEach((p,i)=>{
      const row=document.createElement('div');row.className='result-player';
      const name=document.createElement('div');name.style.color=p.color;
      name.textContent='อันดับ '+(1+overall.filter(q=>q.total>p.total).length)+' • '+p.name;
      const score=document.createElement('span');score.textContent=p.total+' คะแนนรวม';
      row.append(name,score);list.append(row);
    });
    const joint=overall.filter(p=>p.total===overall[0].total);
    const heading=document.createElement('div');heading.className='tournament-header';
    heading.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
    list.prepend(heading);
  }
  $('results').classList.remove('hidden');$('gameBanner').textContent='';
  beginResultVoting();
  renderLeaderboard();
}
function endFruitMemoryRound(){
  const s=round.fruitMemory;
  round.phase='results';round.paused=false;resetInputs();broadcastRoster();
  $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
  const winnerId=s.winnerId;
  // Competition ranking: people who fell together share a rank, and players
  // eliminated in earlier memory rounds always place below later survivors.
  const finishWave=p=>p.id===winnerId?Infinity:
    (p.fruitEliminatedRound||p.fruitRounds||0);
  const ranked=players.filter(p=>p.active).sort((a,b)=>
    finishWave(b)-finishWave(a)||String(a.id).localeCompare(String(b.id)));
  const rankOf=p=>1+ranked.filter(q=>finishWave(q)>finishWave(p)).length;
  if(tournament){
    awardRoundPoints(ranked,rankOf);
    $('replayBtn').textContent=tournament.index===tournament.schedule.length-1?
      'สุ่มชุดใหม่จากตัวเลือกเดิม':
      'เกมถัดไป ('+(tournament.index+2)+'/'+tournament.schedule.length+')';
  }else $('replayBtn').textContent='เล่นอีกครั้ง';
  round.autoNextRemaining=canAutoAdvanceResults()?7:0;
  const winner=ranked.find(p=>p.id===winnerId);
  $('results').querySelector('h2').textContent=winner?
    'ผู้ชนะ: '+winner.name:s.tieIds?.length?'เสมอ! ไม่มีผู้รอด':'ไม่มีผู้ชนะ';
  const list=$('resultList');list.replaceChildren();
  ranked.forEach(p=>{
    const row=document.createElement('div');row.className='result-player';
    const name=document.createElement('div');name.style.color=p.color;
    name.textContent='อันดับ '+rankOf(p)+' • '+p.name;
    const detail=document.createElement('span');
    const tied=!winnerId&&s.tieIds?.includes(p.id);
    detail.textContent=(p.id===winnerId?'ผู้รอดคนสุดท้าย':
      tied?'อันดับร่วม • ตกรอบพร้อมกัน รอบ '+(p.fruitEliminatedRound||s.rounds):
      'ตกรอบ รอบ '+(p.fruitEliminatedRound||s.rounds))+
      totalScoreNote(p);
    row.append(name,detail);list.append(row);
  });
  if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
    const overall=[...ranked].sort((a,b)=>b.total-a.total||String(a.id).localeCompare(String(b.id)));
    // The old design appended twelve more total rows after the twelve
    // round rows (24 rows), hiding some names on compact screens. Show the
    // complete final tournament ranking instead, as every other mode does.
    list.replaceChildren();
    const heading=document.createElement('div');heading.className='tournament-header';
    const joint=overall.filter(p=>p.total===overall[0].total);
    heading.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:
      'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
    list.prepend(heading);
    overall.forEach((p,i)=>{
      const row=document.createElement('div');row.className='result-player';
      const name=document.createElement('div');name.style.color=p.color;
      const competitionRank=1+overall.filter(q=>q.total>p.total).length;
      name.textContent='อันดับ '+competitionRank+' • '+p.name;
      const score=document.createElement('span');score.textContent=p.total+' คะแนนรวม';
      row.append(name,score);list.append(row);
    });
  }
  $('results').classList.remove('hidden');$('gameBanner').textContent='';
  beginResultVoting();
  renderLeaderboard();
}
function renderLeaderboard(){
  const root=$('leaderboard');root.replaceChildren();
  const active=round?players.filter(p=>p.active):[];
  const count=Math.max(1,active.length);
  root.style.setProperty('--leader-count',String(count));
  root.style.setProperty('--leader-cols',String(Math.min(12,count)));
  root.style.setProperty('--leader-cols-compact',String(Math.min(6,count)));
  root.style.setProperty('--leader-rows','1');
  if(!round||round.mode==='board')return;
  if(round.mode==='color_claim'){
    active.sort((a,b)=>(round.colorClaim.counts[b.cc?.slot]||0)-
      (round.colorClaim.counts[a.cc?.slot]||0)||String(a.id).localeCompare(String(b.id)));
    for(const p of active){
      const box=document.createElement('div');box.className='leader-chip';
      const dot=document.createElement('span');dot.className='circle';dot.style.background=p.color;
      const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;
      const score=document.createElement('small');score.className='leader-role';
      score.textContent=(p.score||0).toFixed(1)+'%';
      const status=document.createElement('span');status.className='leader-item-slot';
      status.textContent=p.cc?.eliminated?'ตกรอบถาวร':!p.cc?.alive?'เกิดใหม่':
        window.ColorClaim.freezeActive(round.colorClaim,p)?'แช่แข็ง':'';
      box.append(dot,name,score,status);root.append(box);
    }
    return;
  }
  if(round.mode==='gladiators'){
   const ordered=active.slice().sort((a,b)=>
     Number(!!b.gladiator?.alive)-Number(!!a.gladiator?.alive)||
     (b.gladiator?.eliminatedTick??0)-(a.gladiator?.eliminatedTick??0));
   for(const p of ordered){
    const box=document.createElement('div');box.className='leader-chip';
    if(!p.gladiator?.alive)box.classList.add('shockwave-eliminated');
    const dot=document.createElement('span');dot.className='circle';dot.style.background=p.color;
    const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;
    const status=document.createElement('small');status.className='leader-role';
    status.textContent=p.gladiator?.alive?'รอด':'ตกรอบ';
    const empty=document.createElement('span');empty.className='leader-item-slot';
    box.append(dot,name,status,empty);root.append(box);
   }
   return;
  }
    if(round.mode==='witching_snake'){
   const ordered=[...active].sort((a,b)=>Number(!!b.ws?.alive)-Number(!!a.ws?.alive)||
    (b.ws?.eliminatedTick??0)-(a.ws?.eliminatedTick??0));
   for(const p of ordered){
    const box=document.createElement('div');box.className='leader-chip';
    if(!p.ws?.alive)box.classList.add('shockwave-eliminated');
    const dot=document.createElement('span');dot.className='circle';dot.style.background=p.color;
    const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;
    const role=document.createElement('small');role.className='leader-role';
    role.textContent=p.ws?.alive?'รอด • ดาว '+p.ws.stars:'ตกรอบ';
    const item=document.createElement('span');item.className='leader-item-slot';
    box.append(dot,name,role,item);root.append(box);
   }
   return;
  }
if(round.mode==='snow_brawl'){
     const ordered=[...active].sort((a,b)=>Number(b.snow?.alive)-Number(a.snow?.alive)||
       (b.snow?.eliminatedTick||0)-(a.snow?.eliminatedTick||0));
     for(const p of ordered){
       const box=document.createElement('div');box.className='leader-chip';
       if(!p.snow?.alive)box.classList.add('shockwave-eliminated');
       const dot=document.createElement('span');dot.className='circle';dot.style.background=p.color;
       const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;
       const role=document.createElement('small');role.className='leader-role';
       role.textContent=p.snow?.alive?(p.snow?.flat>0?'ถูกทับ':'รอด'):'ตกน้ำ';
       const empty=document.createElement('span');empty.className='leader-item-slot';
       box.append(dot,name,role,empty);root.append(box);
     }
     return;
   }
   if(round.mode==='boulder_bash'){
     const ordered=[...active].sort((a,b)=>Number(b.bb?.alive)-Number(a.bb?.alive)||
       (b.bb?.eliminatedTick||0)-(a.bb?.eliminatedTick||0));
     for(const p of ordered){
       const box=document.createElement('div');box.className='leader-chip';
       if(!p.bb?.alive)box.classList.add('shockwave-eliminated');
       const dot=document.createElement('span');dot.className='circle';dot.style.background=p.color;
       const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;
       const role=document.createElement('small');role.className='leader-role';
       role.textContent=p.bb?.alive?'รอด':p.bb?.mode==='rock'?'ควบคุมหิน':'ตกรอบ';
       const empty=document.createElement('span');empty.className='leader-item-slot';empty.textContent=' ';
       box.append(dot,name,role,empty);root.append(box);
     }
     return;
   }
   if(round.mode==='knight_match'){
    active.sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id))).forEach(p=>{
      const box=document.createElement('div');box.className='leader-chip knight-leader';
      const color=document.createElement('span');color.className='circle';color.style.background=p.color;
      const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;name.title=p.name;
      const score=document.createElement('small');score.className='leader-role';score.textContent=(p.score??0)+' คะแนน';
      const info=document.createElement('span');info.className='leader-item-slot';
      info.textContent=p.km?.stun>0?'สตั้น':round.knightMatch?.rainbowOwnerId===p.id?'RAINBOW '+Math.ceil(Math.max(0,round.knightMatch.rainbowUntil-round.knightMatch.clock))+'s':'';
      box.append(color,name,score,info);root.append(box);
    });return;
  }
  if(round.mode==='ice_race'){
    active.sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id))).forEach(p=>{
      const box=document.createElement('div');box.className='leader-chip';
      const color=document.createElement('span');color.className='circle';color.style.background=p.color;
      const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;
      const score=document.createElement('small');score.className='leader-role';score.textContent=(p.score||0)+' คะแนน';
      const info=document.createElement('span');info.className='leader-item-slot';
      info.textContent=p.ice?.state==='falling'?'ตกน้ำ':'CP '+((p.ice?.nextCheckpoint??1)+1)+'/4';
      box.append(color,name,score,info);root.append(box);
    });return;
   }
   if(round.mode==='lawn_mower'){
     active.sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id))).forEach(p=>{
       const box=document.createElement('div');box.className='leader-chip';
       const color=document.createElement('span');color.className='circle';color.style.background=p.color;
       const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;
       const score=document.createElement('small');score.className='leader-role';score.textContent=p.score+' คะแนน';
       const suns=document.createElement('span');suns.className='leader-item-slot';
       suns.textContent=(p.mower?.suns||0)+' ดวง';
       box.append(color,name,score,suns);root.append(box);
     });return;
   }
  if(round.mode==='shopping_time'){
     active.sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id))).forEach(p=>{
       const box=document.createElement('div');box.className='leader-chip';
       const color=document.createElement('span');color.className='circle';color.style.background=p.color;
       const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;name.title=p.name;
       const score=document.createElement('small');score.className='leader-role';score.textContent=p.score+' คะแนน';
       const load=document.createElement('span');load.className='leader-item-slot';
       load.textContent=p.shopping?.stun>0?'สตั้น':(p.shopping?.basket.length||0)+'/5';
       box.append(color,name,score,load);root.append(box);
     });return;
   }
   if(round.mode==='pizza_time'){
    active.sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id))).forEach(p=>{
      const box=document.createElement('div');box.className='leader-chip pizza-leader';
      const color=document.createElement('span');color.className='circle';color.style.background=p.color;
      const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;name.title=p.name;
      const score=document.createElement('small');score.className='leader-role';score.textContent=(p.score||0)+' คะแนน';
      const status=document.createElement('span');status.className='leader-item-slot';
      const order=p.pizza?.order||[],sent=p.pizza?.delivered||[];
      status.classList.add('pizza-order-icons');
      window.PizzaIngredientArt.appendRow(status,order,sent,{size:18});
      status.title=p.pizza?.held?'ถือ '+(window.PizzaIngredientArt.names[p.pizza.held]||'วัตถุดิบ'):'ยังไม่ได้ถือ';
      box.append(color,name,score,status);root.append(box);
    });return;
  }
  if(round.mode==='fruit_memory'){
    active.sort((a,b)=>Number(b.fruitAlive)-Number(a.fruitAlive)||b.fruitRounds-a.fruitRounds).forEach(p=>{
      const box=document.createElement('div');box.className='leader-chip fruit-leader';
      if(!p.fruitAlive)box.classList.add('fruit-eliminated');
      const color=document.createElement('span');color.className='circle';color.style.background=p.color;
      const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;name.title=p.name;
      const role=document.createElement('small');role.className='leader-role';
      role.textContent=p.fruitAlive?(p.fruitStun>0?'สตั้น':'รอด'):'ตกรอบ';
      const info=document.createElement('span');info.className='leader-item-slot';
      info.textContent='รอบ '+(p.fruitRounds||0);
      box.append(color,name,role,info);root.append(box);
    });return;
  }
  if(round.mode==='shockwave'){
    active.sort((a,b)=>Number(b.shockAlive)-Number(a.shockAlive)||(b.shockEliminatedAt||0)-(a.shockEliminatedAt||0)).forEach(p=>{
      const box=document.createElement('div');box.className='leader-chip shockwave-leader';
      if(!p.shockAlive)box.classList.add('shockwave-eliminated');
      const color=document.createElement('span');color.className='circle';color.style.background=p.color;
      const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;name.title=p.name;
      const status=document.createElement('small');status.className='leader-role';status.textContent=p.shockAlive?'รอด':'ตกรอบ';
      const info=document.createElement('span');info.className='leader-item-slot';info.textContent='Wave '+(round.shockwave?.wave||0);
      box.append(color,name,status,info);root.append(box);
    });return;
  }
   if(round.mode==='color_switch'){
     active.sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id))).forEach(p=>{
       const box=document.createElement('div');box.className='leader-chip color-switch-leader';
       const color=document.createElement('span');color.className='circle';color.style.background=p.color;
       const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;name.title=p.name;
       const score=document.createElement('small');score.className='leader-role';score.textContent='คะแนน '+p.score;
       const status=document.createElement('span');status.className='leader-item-slot';
       status.textContent=p.cs?.stunRemaining>0?'สตั้น':'';
       box.append(color,name,score,status);root.append(box);
     });return;
   }

  if(round.mode==='chickens'){
    active.sort((a,b)=>b.score-a.score).forEach(p=>{
      const box=document.createElement('div');box.className='leader-chip chicken-leader';
      const color=document.createElement('span');color.className='circle';color.style.background=p.color;
      const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;name.title=p.name;
      const score=document.createElement('small');score.className='leader-role';score.textContent=p.score+' คะแนน';
      const info=document.createElement('span');info.className='leader-item-slot';info.textContent=p.carriedChickenId!=null?'กำลังอุ้มไก่':'—';
      box.append(color,name,score,info);root.append(box);
    });
    return;
  }
  active.sort((a,b)=>Number(a.ghost)-Number(b.ghost)).forEach(p=>{
    const box=document.createElement('div');box.className='leader-chip';
    const color=document.createElement('span');
    color.className='circle';color.style.background=p.color;
    const name=document.createElement('span');
    name.className='leader-name';name.textContent=p.name;name.title=p.name;
    if(round.mode==='ghost'&&p.ghost){
      name.style.color='#ff454f';name.classList.add('ghost-name');
    }
    const role=document.createElement('small');role.className='leader-role';
    role.textContent=p.ghost?'ผี':p.stun>0?'สตั้น':'คน';
    const itemSlot=document.createElement('span');
    itemSlot.className='leader-item-slot';
    const held=round.mode==='ghost'&&!p.ghost?p.item:null;
    const itemSvg=held&&window.GhostAttack.ITEM_SVG[held];
    if(itemSvg){
      itemSlot.classList.add('leader-held-icon');
      itemSlot.innerHTML=itemSvg;
      const full=window.GhostAttack.ITEM_NAMES[held]||held;
      itemSlot.title=full;
      itemSlot.setAttribute('role','img');
      itemSlot.setAttribute('aria-label',full);
      box.title=p.name+' · '+role.textContent+' · ถือ '+full;
    }else{
      itemSlot.classList.add('leader-empty-item');
      itemSlot.textContent='—';
      itemSlot.setAttribute('aria-hidden','true');
      box.title=p.name+' · '+role.textContent;
    }
    // Visual rows: name (top), human/ghost status, then SVG icon only.
    box.append(color,name,role,itemSlot);
    root.append(box);
  });
}
// All minigame clocks and survivor counts are painted ONLY here, after engines
// finish their scene: one badge, one position, no in-engine duplicates.
// SHOCKWAVE intentionally never displays a numerical warning timer.
function hostClockValue(r){
  if(!r||r.mode==='board'||r.mode==='shockwave')return null;
  if(r.phase==='countdown')return Number.isFinite(r.countdown)?Math.max(0,r.countdown):null;
  if(r.mode==='fruit_memory'||r.phase!=='playing')return null;
  if(Number.isFinite(r.remaining))return Math.max(0,r.remaining);
  // Elapsed time is NOT a countdown: multiplayer survival shows the live
  // headcount instead. Solo survival still uses round.remaining above.
  return null;
}
function drawGame(t){
  if(!round)return;
  syncArenaResolution();
  gameEngine(round.mode).draw(g,t,round,players);
  if(round.mode==='board')return; // BOARD PARTY has a separate HUD.
  const seconds=hostClockValue(round);
  if(seconds!==null){
    window.PartyArenaScenes?.clock?.(g,seconds);
  }else if(round.phase==='playing'||round.mode==='shockwave'||round.mode==='fruit_memory'){
    // No countdown: use only the shared SVG person and survivor total.
    const survivors=gameEngine(round.mode).hud?.(players,round)?.survivors;
    if(Number.isFinite(survivors)){
      window.PartyArenaScenes?.playerCount?.(g,survivors);
    }
  }
}
function animate(ts){
  const elapsed=Math.max(0,(ts-frameLast)/1000||.016);
  const dt=Math.min(.045,elapsed);
  // Minigame physics remain unchanged; only BOARD PARTY uses real elapsed time.
  const boardDt=Math.min(1,elapsed);
  frameLast=ts;
  try{
   if(currentView==='game'&&gameSelection){
    // Board-to-minigame roulette also follows wall-clock time on slow devices.
    updateGameSelection(boardSession?boardDt:dt);
   }else if(currentView==='game'&&round){
    if(!round.paused)graphicsClock+=dt;
    if(possessedBotId)applyBotPadKeys();
    updateRound(round.mode==='board'?boardDt:dt);drawGame(graphicsClock);
    renderHostVideoFrames();
    if(round&&round.phase==='results'&&round.autoNextRemaining>0){
      round.autoNextRemaining=Math.max(0,round.autoNextRemaining-dt);
      if(round.autoNextRemaining===0)advanceParty();
      else renderResultVotes();
    }
    botTestClock+=dt;
    if(botTestClock>.2){botTestClock=0;renderBotTestPad();}
    hudClock+=dt;
    if(hudClock>.22){
      renderLeaderboard();hudClock=0;
    }
    inventoryClock+=dt;
    if(inventoryClock>=.28){
      inventoryClock=0;
      broadcastPlayerInventories();
    }
    remotePreviewClock+=dt;
    if(remotePreviewClock>=1.1&&!round.paused){
      remotePreviewClock=0;
      broadcastGamePreview();
    }
    networkClock+=dt;
    if(networkClock>.85){
      broadcast({t:'state',phase:networkPhase(),
        survivors:gameEngine(round.mode).hud(players,round).survivors,remaining:round.remaining,mode:round.mode});
      networkClock=0;
    }
   }
  }catch(error){
    console.error('Game frame failed',round?.mode,error);
    const mode=round?.mode;
    if(mode){
      returnToLobby();
      showToast((MODES[mode]||mode)+' หยุดเพราะมีข้อผิดพลาด: '+String(error?.message||error).slice(0,100),true);
    }
  }
  requestAnimationFrame(animate);
}

function broadcastGameState(){
  if(!round||gameSelection)return;
  broadcast({t:'state',phase:networkPhase(),
    survivors:gameEngine(round.mode).hud(players,round).survivors,remaining:round.remaining,mode:round.mode});
}
function pauseGame(){
  if(currentView!=='game'||!round||gameSelection||round.phase==='results'||round.paused)return;
  renderPauseChoiceList();
  round.paused=true;
  resetInputs();clearBotPadKeys();
  if(round.mode==='board'&&boardSession){
    boardSession.camera.paused=true;
    $('pauseMenu').classList.add('hidden'); // Keep the frozen map touchable.
    $('boardExitBtn').classList.remove('hidden');
  }else {$('pauseMenu').classList.remove('hidden');$('boardExitBtn').classList.add('hidden');}
  $('pauseBtn').setAttribute('aria-expanded',String(round.mode!=='board'));
  refreshBoardTools();
  broadcastRoster();
  broadcastGameState();
}
function resumeGame(){
  if(!round||!round.paused)return;
  resetInputs();
  round.paused=false;
  if(round.mode==='board'&&boardSession){const s=boardSession;s.camera.paused=false;s.camera.overview=false;s.camera.manualZoom=null;s.inputs={};}
  $('pauseMenu').classList.add('hidden');
  $('boardExitBtn').classList.add('hidden');
  $('pauseBtn').setAttribute('aria-expanded','false');
  refreshBoardTools();
  broadcastRoster();
  broadcastGameState();
}
function returnToLobby(){
  lobbyReadyVotes.clear();
  releaseBotPossession();
  $('boardTools').classList.add('hidden');
  gameSelection=null;$('gameRoulette').classList.add('hidden');
  boardSession=null;boardStateToken=null;document.body.classList.remove('board-playing');
  $('pauseBtn').style.cssText='';$('boardExitBtn').style.cssText='';$('boardExitBtn').classList.add('hidden');$('pauseBtn').classList.remove('board-resume');
  tournament=null;round=null;resetInputs();
  stopAllHostVideoCalls();
  broadcast({t:'preview-reset'});
  $('pauseMenu').classList.add('hidden');
  $('pauseBtn').setAttribute('aria-expanded','false');
  // Keep document-root fullscreen during lobby/round transitions.
  setView('hostLobby');renderRoster();broadcastRoster();renderBotTestPad();
}
$('pauseBtn').addEventListener('click',()=>round?.paused?resumeGame():pauseGame());
$('boardExitBtn').addEventListener('click',()=>{
 if(round?.mode!=='board'||!round.paused||!boardSession)return;
 confirmAction('ต้องการออกจาก BOARD PARTY และกลับไปยังล็อบบี้หรือไม่? ความคืบหน้าบอร์ดเกมรอบนี้จะสิ้นสุด',{
  title:'ยืนยันออกจากบอร์ดเกม',confirmLabel:'ยืนยันออกเกม',danger:true
 }).then(confirmed=>{
  // Cancel leaves the board paused; only an explicit confirmation exits.
  if(confirmed&&round?.mode==='board'&&round.paused&&boardSession)returnToLobby();
 });
});
// Re-enter native fullscreen only after a real user click (required by the API).
$('restoreHostFullscreenBtn').addEventListener('click',()=>{
 if(currentView==='game')requestHostFullscreen();
});
$('webAppHelpBtn').addEventListener('click',()=>{
 const help=$('webAppHelp'),opened=help.classList.contains('hidden');
 help.classList.toggle('hidden',!opened);
 $('webAppHelpBtn').setAttribute('aria-expanded',String(opened));
});
$('boardOverviewBtn').addEventListener('click',()=>{
 if(round?.mode!=='board'||!boardSession||boardSession.phase==='intro_zoom'||
   (boardSession.phase!=='overview'&&!hostCanControlBoardZoom()))return;
 if(boardSession.phase!=='overview')pauseGame();
 window.BoardArt.overview(boardSession);refreshBoardTools();
});
$('boardStartDiceBtn').addEventListener('click',()=>{if(boardSession&&window.BoardParty.startOrder(boardSession))refreshBoardTools();});
$('boardFollowBtn').addEventListener('click',()=>{if(hostCanControlBoardZoom()){window.BoardArt.follow(boardSession);if(round.paused)resumeGame();refreshBoardTools();}});
$('boardEffectsBtn').addEventListener('click',()=>{if(boardSession){boardSession.camera.lowDetail=!boardSession.camera.lowDetail;refreshBoardTools();}});
$('boardZoomInBtn').addEventListener('click',()=>{if(hostCanControlBoardZoom())window.BoardArt.zoom(boardSession,1.25);});
$('boardZoomOutBtn').addEventListener('click',()=>{if(hostCanControlBoardZoom())window.BoardArt.zoom(boardSession,.8);});
$('boardNodeDebugBtn').addEventListener('click',()=>{if(boardSession&&boardSession.players.every(p=>p.isBot)){window.BoardArt.toggleDebug(boardSession);refreshBoardTools();}});
$('resumeBtn').addEventListener('click',resumeGame);
document.addEventListener('keydown',e=>{
  if(currentView==='game'&&(e.code==='Escape'||e.code==='KeyP')){
    e.preventDefault();
    if(round&&round.paused)resumeGame();
    else pauseGame();
  }
});
$('addLocalBtn').addEventListener('click',addLocal);
$('cycleAllBotsBtn').addEventListener('click',openBulkBotPicker);
$('bulkBotPickerClose').addEventListener('click',()=>closeBulkBotPicker());
$('bulkBotPicker').addEventListener('click',e=>{
  if(e.target===$('bulkBotPicker'))closeBulkBotPicker();
});
document.addEventListener('keydown',e=>{
  if($('bulkBotPicker').classList.contains('hidden'))return;
  if(e.key==='Escape'){e.preventDefault();closeBulkBotPicker();return;}
  if(e.key==='Tab'){
    const buttons=[...$('bulkBotPickerChoices').querySelectorAll('button'),$('bulkBotPickerClose')];
    const first=buttons[0],last=buttons[buttons.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});
$('hostBtn').addEventListener('click',()=>startHost());
function shuffleGames(items){
  const result=[...items];
  for(let i=result.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}

function pickRandomEndlessGame(previous=null,random=Math.random){
  // A fresh random choice for EVERY round, not a fixed six-game sequence.
  // Avoid showing the exact same game twice in a row for a better party flow.
  const all=modesFor('normal');
  const candidates=all.length>1?all.filter(mode=>mode!==previous):all;
  const draw=Number(random());
  const index=Math.min(candidates.length-1,Math.max(0,Math.floor((Number.isFinite(draw)?draw:0)*candidates.length)));
  return candidates[index];
}
function beginGameSelection(mode){
  if(!players.length||!modesFor(boardSession?'board':'normal').includes(mode)||gameSelection)return;
  // No actual engine starts until the reel settles; this also guards the
  // seven-second auto-next from launching twice during its last frame.
  const options=boardSession?window.BoardMinigame.eligible(boardRegistry(),players.length):tournament?.endless?modesFor('normal'):
    Array.from(new Set(tournament?.schedule||modesFor('normal')));
  const stage=$('gameRoulette'),track=$('rouletteTrack');
  track.replaceChildren();
  const width=Math.min(210,Math.max(130,Math.round((window.innerWidth||960)*.19)));
  // The green center frame and the selected game card share exactly one width.
  stage.style.setProperty('--roulette-card-width',width+'px');
  const gap=Math.round(width*.085);
  const winningIndex=9,totalCards=12;
  let previous=null,winner=null;
  for(let i=0;i<totalCards;i++){
    let choice=mode;
    if(i!==winningIndex){
      const available=options.filter(m=>m!==previous);
      const pool=available.length?available:options;
      choice=pool[Math.floor(Math.random()*pool.length)]||mode;
    }
    const card=document.createElement('div');card.className='roulette-option';
    card.dataset.mode=choice;
    card.style.width=width+'px';
    const name=document.createElement('strong');name.textContent=MODES[choice];
    card.append(gameCover(choice),name);
    track.append(card);
    if(i===winningIndex)winner=card;
    previous=choice;
  }
  track.style.gap=gap+'px';
  const initial=width/2,final=width/2+winningIndex*(width+gap);
  track.style.transform='translate3d(-'+initial+'px,0,0)';
  $('rouletteHeading').textContent='กำลังสุ่มเกม...';
  $('rouletteMessage').textContent='เกมที่จะเล่นกำลังเลื่อนเข้าตรงกลาง';
  stage.classList.remove('hidden');stage.classList.remove('is-selected');
  $('results').classList.add('hidden');
  $('pauseMenu').classList.add('hidden');
  $('pauseBtn').classList.add('hidden');
  $('gameBanner').textContent='';
  round={mode,phase:'roulette',paused:false,remaining:null,autoNextRemaining:0};
  resetInputs();
  gameSelection={mode,elapsed:0,spinDuration:1.45,holdDuration:1.18,
    initial,final,winningIndex,winner,track,ready:true,error:null};
  const platform=window.GamePlatform,selection=gameSelection;
  if(platform&&(!!window.GAME_CORE_VERSION||platform.descriptor(mode))&&
     (!platform.revision||!platform.ready(mode))){
    selection.ready=false;
    void (async()=>{
      if(!platform.revision)await platform.refresh();
      try{await platform.ensure(mode);}
      catch(error){
        // A catalog can change during the roulette. Retry its new hash once.
        if(String(error?.message||'').startsWith('Superseded plug-in version:')&&
           platform.descriptor(mode))await platform.ensure(mode);
        else throw error;
      }
      if(gameSelection===selection)selection.ready=true;
    })().catch(error=>{if(gameSelection===selection)selection.error=error;});
  }
  if(boardSession){gameSelection.spinDuration=2;gameSelection.holdDuration=1.4;}
  setView('game');
  // iOS fullscreen needs the original Start tap: request before the reel runs.
  requestHostFullscreen();
  broadcastRoster();
}
function updateGameSelection(dt){
  const selection=gameSelection;if(!selection)return;
  selection.elapsed+=dt;
  const progress=Math.min(1,selection.elapsed/selection.spinDuration);
  // Horizontal reel: accelerates at first, decelerates toward the middle.
  const eased=1-Math.pow(1-progress,4);
  const position=selection.initial+(selection.final-selection.initial)*eased;
  selection.track.style.transform='translate3d(-'+position.toFixed(2)+'px,0,0)';
  if(progress===1&&!selection.revealed){
    selection.revealed=true;
    selection.winner.classList.add('is-selected');
    $('gameRoulette').classList.add('is-selected');
    $('rouletteHeading').textContent=MODES[selection.mode];
    $('rouletteMessage').textContent='เกมที่สุ่มได้ในรอบนี้';
  }
  if(selection.elapsed>=selection.spinDuration+selection.holdDuration){
    if(selection.error){
      const message=String(selection.error?.message||selection.error);
      console.error('Minigame preload failed',selection.mode,selection.error);
      returnToLobby();showToast('โหลดมินิเกมไม่สำเร็จ: '+message.slice(0,100),true);return;
    }
    if(!selection.ready){
      $('rouletteMessage').textContent='กำลังเตรียมเกมเวอร์ชันล่าสุด…';return;
    }
    const mode=selection.mode;
    gameSelection=null;
    $('gameRoulette').classList.add('hidden');
    startRound(mode);
    if(!round) returnToLobby();
  }
}
function beginParty(){
  if(!players.length||gameSelection||(round&&!['results','summary'].includes(round.phase)))return;
  if(selectedSessionMode==='board'){beginBoard();return;}
  if(selectedSessionMode==='endless'){
    tournament={schedule:modesFor('normal'),index:0,endless:true,roundsPlayed:0,lastMode:null};
    players.forEach(p=>{p.total=0;p.lastRoundPoints=0;});
    const mode=pickRandomEndlessGame();
    tournament.lastMode=mode;
    beginGameSelection(mode);
    return;
  }
  const picks=nominatedGames();
  if(!picks.length||picks.length!==players.length)return;
  tournament={schedule:shuffleGames(picks),index:0,endless:false};
  players.forEach(p=>{p.total=0;p.lastRoundPoints=0;});
  beginGameSelection(tournament.schedule[0]);
}
function advanceParty(){
  if(gameSelection)return;
  if(boardSession){if(boardSession.phase==='finished')beginBoard();return;}
  if(tournament?.endless){
    tournament.roundsPlayed++;
    tournament.index=(tournament.index+1)%tournament.schedule.length;
    const mode=pickRandomEndlessGame(tournament.lastMode);
    tournament.lastMode=mode;
    beginGameSelection(mode);
  }else if(tournament&&tournament.index+1<tournament.schedule.length){
    tournament.index++;
    beginGameSelection(tournament.schedule[tournament.index]);
  }else beginParty();
}
function openOfflineLobby(){
 // Cancel any pending online-library handshake before entering offline mode.
 if(hostNetworkLoad){++hostOpenAttempt;$('hostBtn').disabled=false;}
 if(onlineHost||hostPeer||hostRetryTimeout!==null)closeHost({goHome:false});
 deleteSession(HOST_SESSION);
 if(!players.length){addLocal();addLocal();}
 $('hostRoomBadge').textContent='OFFLINE';
 $('roomPanel').classList.add('hidden');$('offlineRoomHint').classList.remove('hidden');
 setView('hostLobby');renderRoster();
}
$('offlineBtn').addEventListener('click',()=>{
 if(!onlineHost){openOfflineLobby();return;}
 confirmAction('ปิดห้องออนไลน์และถอดจอยมือถือทั้งหมดเพื่อเล่นออฟไลน์?')
  .then(yes=>{if(yes)openOfflineLobby();});
});
$('startBtn').addEventListener('click',beginParty);
function closeHostRoom(){
 if(onlineHost||hostPeer||hostRetryTimeout!==null)closeHost();
 deleteSession(HOST_SESSION);deleteSession(OFFLINE_SESSION);
 boardSession=null;document.body.classList.remove('board-playing');
 tournament=null;round=null;setView('home');
}
$('closeRoomBtn').addEventListener('click',()=>{
 if(!onlineHost){closeHostRoom();return;}
 confirmAction('ปิดห้องนี้และตัดการเชื่อมต่อจอยมือถือทุกเครื่อง?')
  .then(yes=>{if(yes)closeHostRoom();});
});
$('copyBtn').addEventListener('click',copyInvite);
$('exitBtn').addEventListener('click',returnToLobby);
// Results/scoring exists only in the Host bundle; bind lazily for Controller.
$('backBtn').addEventListener('click',()=>onResultBack());
$('replayBtn').addEventListener('click',advanceParty);
document.querySelectorAll('[data-session-mode]').forEach(button=>{
 button.addEventListener('click',()=>{
  selectedSessionMode=['endless','board'].includes(button.dataset.sessionMode)?button.dataset.sessionMode:'queue';
  lobbyReadyVotes.clear();
  renderRoster();
  for(const other of document.querySelectorAll('[data-session-mode]')){
   const active=other.dataset.sessionMode===selectedSessionMode;
   other.classList.toggle('active',active);
   other.setAttribute('aria-pressed',String(active));
  }
  broadcastRoster();
  if(onlineHost)saveHost();else saveOffline();
 });
});
$('autoNext').addEventListener('change',()=>{if(onlineHost)saveHost();else saveOffline();});
$('uiCancelBtn').addEventListener('click',()=>finishConfirmation(false));
$('uiConfirmBtn').addEventListener('click',()=>finishConfirmation(true));
$('uiModal').addEventListener('click',e=>{if(e.target===$('uiModal'))finishConfirmation(false);});
$('landscapeBtn').addEventListener('click',()=>{void requestLandscape();});
$('joinLandscapeBtn').addEventListener('click',()=>{void requestLandscape();});
$('rotateRetryBtn').addEventListener('click',()=>{void requestLandscape();});
$('portraitFallbackBtn').addEventListener('click',enablePortraitFallback);
$('portraitRestoreBtn').addEventListener('click',()=>{
  clearPortraitFallback();
  void requestLandscape();
});
$('joinBtn').addEventListener('click',joinRoom);
$('nick').addEventListener('input',rememberNickname);
$('nick').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom();});
$('roomCodeInput').addEventListener('input',()=>{
  $('roomCodeInput').value=$('roomCodeInput').value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);
});
$('roomCodeInput').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom();});
$('switchRoomBtn').addEventListener('click',()=>{
  resetControllerForRoomChange('เปลี่ยนห้องในแท็บเดิมได้เลย สแกน QR หรือกรอกรหัสใหม่');
});
renderModeChoices();
window.addEventListener('gameplatform:catalog',syncGameCatalog);
syncGameCatalog();
function onPhoneGamePick(mode){
  if(!phoneSelectionOpen||!controllerReady||!modesFor('normal').includes(mode))return;
  updatePhoneGamePicker('lobby',mode);
  send(controllerConn,{t:'pick',mode});
}
document.querySelectorAll('[data-pick]').forEach(button=>button.addEventListener('click',()=>onPhoneGamePick(button.dataset.pick)));
// These buttons control the HOST BOARD camera, not the tiny phone preview.
for(const [id,direction] of [['controllerBoardZoomInBtn',1],['controllerBoardZoomOutBtn',-1]]){
 $(id).addEventListener('click',()=>{
  if(!controllerReady||controllerGameMode!=='board'||
     controllerGamePhase!=='playing'||controllerBoard?.canZoom!==true)return;
  send(controllerConn,{t:'board-camera-zoom',direction});
 });
}
$('videoPreviewToggleBtn').addEventListener('click',()=>{
  setControllerPreviewEnabled(!controllerPreviewEnabled);
});
$('videoQualityBtn').addEventListener('click',()=>{
  const index=VIDEO_QUALITY_CYCLE.indexOf(controllerVideoQuality);
  setControllerVideoQuality(VIDEO_QUALITY_CYCLE[(index+1)%VIDEO_QUALITY_CYCLE.length]);
});
// Auto resolution updates when the device's available display pixels change.
// Sending an identical size on ordinary resize events would renegotiate needlessly.
window.addEventListener('resize',()=>{
  if(!controllerReady||controllerVideoQuality!=='auto')return;
  const next=controllerAutoHeight();
  if(next!==lastControllerAutoHeight)send(controllerConn,videoQualityPacket('auto'));
});
controllerVideoQuality=savedVideoQuality();
renderVideoQualityButton();
renderControllerPreviewToggle();
$('videoStartBtn').addEventListener('click',()=>{
  if(!controllerPreviewEnabled)return;
  const video=$('controllerPreviewVideo');
  if(typeof video.play==='function'){
    try{
      const p=video.play();
      if(p&&p.then)p.then(()=>{
        $('videoStartBtn').classList.add('hidden');
        if(controllerMediaCall)send(controllerConn,
          {t:'video-ready',quality:controllerMediaCall.metadata?.quality||'medium'});
      }).catch(()=>{});
    }catch(_){}
  }
});
const cyclePhoneTarget=(direction)=>{
  if(!controllerReady||!controllerConn||!controllerConn.open)return;
  send(controllerConn,{t:'target-cycle',direction});
};
$('targetPrevBtn').addEventListener('click',()=>cyclePhoneTarget(-1));
$('targetNextBtn').addEventListener('click',()=>cyclePhoneTarget(1));
document.addEventListener('keydown',e=>{
  if(currentView!=='game'||!round||round.phase!=='playing'||e.repeat)return;
  const locals=players.filter(p=>p.type==='local'&&!p.isBot);
  const controls=[['KeyQ','KeyE'],['Numpad8','Numpad2']];
  controls.forEach((keys,i)=>{
    const direction=e.code===keys[0]?-1:e.code===keys[1]?1:0;
    if(direction&&locals[i]){
      if(round.mode==='ghost'&&window.GhostAttack.cycleTarget(round.ghost,players,locals[i],direction))e.preventDefault();
    }
  });
});
$('scanRoomBtn').addEventListener('click',()=>{void startRoomScanner();});
$('cancelScanBtn').addEventListener('click',()=>{void stopRoomScanner();});
$('leaveBtn').addEventListener('click',()=>{
  if(!controllerReady)return;
  releaseStick();
  for(const k of INPUT_NAMES)controllerKeys[k]=false;
  controllerKeys.axisX=0;controllerKeys.axisY=0;
  sendInputs();
  $('leaveConfirm').classList.remove('hidden');
});
$('stayInRoomBtn').addEventListener('click',()=>{
  $('leaveConfirm').classList.add('hidden');
});
$('confirmLeaveBtn').addEventListener('click',()=>{
  // Leaving a room MUST remain a controller. Never redirect to the host UI.
  resetControllerForRoomChange('ออกจากห้องแล้ว • กรอกรหัสใหม่หรือสแกน QR เพื่อเข้าร่วม',true);
  $('roomCodeInput').value='';
  $('joinCode').textContent='------';
  try{
    const url=new URL(window.location.href);
    url.searchParams.delete('join');
    url.searchParams.delete('host');
    url.searchParams.set('controller','1');
    window.history.replaceState(null,'',url.href);
  }catch(_){}
  setView('controller');
});
document.querySelectorAll('#controllerActive [data-control]').forEach(btn=>bindControl(btn,controllerKeys,'remote'));
bindAnalogStick($('joystickZone'),$('joystickBase'),$('joystickKnob'),controllerKeys);
boardCameraController=window.BoardControllerCamera.attach($('joystickZone'),{
  allowed:()=>controllerReady&&controllerPlayerActive&&controllerGameMode==='board'&&
    controllerGamePhase==='playing'&&controllerBoard?.canZoom===true&&
    ['ready','move_ready','branch','moving'].includes(controllerBoard?.boardPhase),
  isRotated:()=>document.body.classList.contains('portrait-fallback')&&isPortraitScreen(),
  releaseStick:()=>releaseStick(),
  onMode:(enabled,notify)=>{
    $('boardCameraModeHint').classList.toggle('hidden',!enabled);
    if(controllerBoard?.boardPhase==='ready')renderPhoneBoard();
    if(notify&&controllerConn?.open)
      send(controllerConn,{t:'board-camera-mode',enabled,
        turnId:controllerBoard?.turnId,mapVersion:controllerBoard?.mapVersion});
  },
  onGesture:gesture=>{
    if(!controllerReady||!controllerConn?.open)return;
    send(controllerConn,{t:'board-camera-gesture',...gesture,
      turnId:controllerBoard?.turnId,mapVersion:controllerBoard?.mapVersion});
  }
});
setInterval(sendInputs,100);
window.addEventListener('beforeunload',()=>{
  void stopRoomScanner();safePeerDestroy();
  try{if(controllerChannel)controllerChannel.close();}catch(_){}
  if(hostPeer)hostPeer.destroy();
});

const entryParams=new URLSearchParams(location.search);
const joinCode=parseRoomCode(entryParams.get('join'));
const launchedHost=entryParams.get('host')==='1';
const savedHost=getSession(HOST_SESSION);
const savedOffline=getSession(OFFLINE_SESSION);
const savedPhone=getSession(PHONE_SESSION);
function restoreRoomOptions(snapshot){
 selectedSessionMode=['endless','board'].includes(snapshot.selectedSessionMode)?snapshot.selectedSessionMode:'queue';
 $('autoNext').checked=snapshot.autoNext!==false;
 for(const btn of document.querySelectorAll('[data-session-mode]')){
  const active=btn.dataset.sessionMode===selectedSessionMode;
  btn.classList.toggle('active',active);
  btn.setAttribute('aria-pressed',String(active));
 }
 restorePlayers(snapshot.players);
 nextId=Math.max(nextId,Number(snapshot.nextId)||1);
}
// Reloads and software updates restore the SAME view and room, not the home page.
// A newly opened invite still shows the name/code join form.
if(launchedHost&&!joinCode){
 if(savedHost&&parseRoomCode(savedHost.code)){
  restoreRoomOptions(savedHost);
  // Keep HOME visible until PeerJS confirms the restored room actually opens.
  // Never reveal a ghost "ห้องปิดแล้ว" lobby during failed restoration.
  setView('home');renderRoster();
  startHost(0,savedHost.code);
 }else if(savedOffline&&Array.isArray(savedOffline.players)){
  restoreRoomOptions(savedOffline);
  openOfflineLobby();
 }else{setView('home');renderRoster();}
}else{
 setView('controller');
 const code=joinCode||parseRoomCode(savedPhone?.code);
 if(code)selectRoomCode(code);
 $('nick').value=savedPhone?.name||getSavedNickname();
 setStatus('พร้อมเข้าร่วมห้อง • กรอกรหัสหรือสแกน QR');
 if(code&&savedPhone?.code===code)setTimeout(()=>joinRoom(true),250);
}
// The live in-memory game cannot survive host navigation. Defer updates
// while actually playing; all other host/controller pages can patch in place.
window.GAME_CAN_AUTO_RELOAD=()=>(
 (currentView==='home'&&!onlineHost&&!hostPeer&&!round)
 ||(currentView==='hostLobby'&&!round&&(
     onlineHost?saveHost():(!hostPeer&&saveOffline())
   ))
 ||(currentView==='controller'&&
   !['countdown','playing','paused'].includes(controllerGamePhase)&&
   (controllerReady?savePhone():true))
);
window.GAME_PREPARE_AUTO_RELOAD=()=>{
 if(currentView==='hostLobby')return onlineHost?saveHost():(!hostPeer&&saveOffline());
 if(currentView==='controller'&&controllerReady)return savePhone();
 return true;
};
window.GAME_NOTIFY_UPDATE=()=>showToast('มีแพตช์ใหม่ • ระบบจะอัปเดตเมื่อออกจากเกม');
requestAnimationFrame(animate);
})();
