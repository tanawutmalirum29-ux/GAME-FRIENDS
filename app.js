(() => {
'use strict';

const $ = (id) => document.getElementById(id);
const MAX_PLAYERS = 12;
const COLORS = ['#ff628c','#3fe4ef','#ffcf62','#ae94ff','#7fe5a0','#ff9b64','#7fb4ff','#f283e9','#e5ed78','#83e1c8','#f8a9b6','#c4aafa'];
let lastAssignedColor = null;
function pickUnusedColor(){
  // Assign randomly, but never repeat another player's color in this room.
  const inUse = new Set(players.map(player => player.color));
  const available = COLORS.filter(color => !inUse.has(color));
  if (!available.length) return null;
  const fresh = available.filter(color => color !== lastAssignedColor);
  const pool = fresh.length ? fresh : available;
  const color = pool[Math.floor(Math.random() * pool.length)];
  lastAssignedColor = color;
  return color;
}
const MODES = {ghost:'GHOST ATTACK',chickens:'CHICKENS',fruit_memory:'FRUIT MEMORY',shockwave:'SHOCKWAVE',color_switch:'COLOR SWITCH'};
const ENGINES={ghost:'GhostAttack',chickens:'Chickens',fruit_memory:'FruitMemory',shockwave:'Shockwave',color_switch:'ColorSwitch'};
const gameEngine=mode=>Object.hasOwn(ENGINES,mode)?window[ENGINES[mode]]:null;

const MODE_COVER_SVG={
 ghost:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90" class="mode-cover-svg" aria-hidden="true">
 <rect width="160" height="90" rx="10" fill="#11283f"/>
 <circle cx="124" cy="23" r="14" fill="#c6e7ff"/>
 <path d="M0 78 28 54 47 67 69 44 92 68 117 48 160 73V90H0" fill="#21516b"/>
 <path d="M54 15c-16 0-26 12-26 27v20q0 9 8 9 6 0 9-6 7 11 13 0 7 10 13 0 5 8 10 4V42C81 26 69 15 54 15Z" fill="#eaf7ff"/>
 <circle cx="45" cy="39" r="4" fill="#19344e"/><circle cx="64" cy="39" r="4" fill="#19344e"/>
 <path d="M46 53q8 8 17 0" fill="none" stroke="#19344e" stroke-width="3" stroke-linecap="round"/>
 <circle cx="117" cy="63" r="6" fill="#65e9bf"/>
 <path d="M117 69v12m-9-7 18-1m-9 7-7 8m7-8 7 8" fill="none" stroke="#65e9bf" stroke-width="4" stroke-linecap="round"/>
 <circle cx="143" cy="62" r="5" fill="#ff8cae"/>
 <path d="M143 67v11m-7-7 14 2m-7 5-6 8m6-8 7 8" fill="none" stroke="#ff8cae" stroke-width="3" stroke-linecap="round"/>
 </svg>`
 ,fruit_memory:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90" class="mode-cover-svg" aria-hidden="true"><rect width="160" height="90" rx="10" fill="#143955"/><g fill="#366b88" stroke="#c1dfea" stroke-width="2"><rect x="12" y="15" width="41" height="43" rx="4"/><rect x="59" y="15" width="42" height="43" rx="4"/><rect x="107" y="15" width="41" height="43" rx="4"/></g><circle cx="33" cy="37" r="14" fill="#f4506b"/><path d="M33 23c3-8 8-10 14-6" fill="none" stroke="#69c781" stroke-width="4"/><circle cx="80" cy="37" r="14" fill="#f9a03e"/><path d="M80 23c3-8 8-10 14-6" fill="none" stroke="#69c781" stroke-width="4"/><path d="M116 28q7 20 26 5-7 20-27 6Z" fill="#ffda63"/><text x="80" y="80" font-size="14" font-weight="900" text-anchor="middle" fill="#fff">FRUIT MEMORY</text></svg>'
 ,chickens:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90" class="mode-cover-svg" aria-hidden="true"><rect width="160" height="90" rx="10" fill="#24664d"/><circle cx="80" cy="46" r="35" fill="#6aaa60"/><path d="M15 72 40 61v-18h17m46 0h17v18l25 11" fill="none" stroke="#e9ce90" stroke-width="5"/><path d="M67 50q-13-12 0-22t25 0q13 12 0 22z" fill="#fff4d2" stroke="#c39161" stroke-width="2"/><circle cx="87" cy="31" r="9" fill="#fff5de"/><path d="m94 33 10 4-10 4" fill="#ffce57"/><circle cx="89" cy="29" r="2" fill="#222"/><path d="M78 19q-2-8 5-6t6 9" fill="#ef585a"/><path d="M56 62v9m39-9v9" stroke="#e3b15c" stroke-width="3"/><text x="80" y="84" font-size="12" font-weight="900" text-anchor="middle" fill="#fff">CHICKENS</text></svg>'
 ,shockwave:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90" class="mode-cover-svg" aria-hidden="true"><rect width="160" height="90" rx="10" fill="#10263c"/><g fill="#28778a" stroke="#a4eaf5" stroke-width="1.5"><path d="M12 23h41v27H12zM60 23h41v27H60zM108 23h40v27h-40zM12 55h41v26H12zM60 55h41v26H60z"/></g><path d="M108 55h40v26h-40z" fill="#df4855" stroke="#ffcd82" stroke-width="3"/><path d="m115 62 9 12-11 4m11-4 14-12" fill="none" stroke="#ffe0bb" stroke-width="3"/><circle cx="79" cy="9" r="7" fill="#ffdc9b"/><path d="M76 17h8l8 10-6 5-6-7-7 8-8-5z" fill="#ffe18a"/></svg>'
 ,color_switch:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90" class="mode-cover-svg" aria-hidden="true"><rect width="160" height="90" rx="10" fill="#3a754f"/><rect x="21" y="6" width="118" height="77" rx="6" fill="#6c4838" stroke="#edd49d" stroke-width="4"/><g stroke="#3e2c35" stroke-width="1.5"><path d="M22 25h116M22 44h116M22 63h116M45 7v75M68 7v75M91 7v75M114 7v75"/></g><path d="M24 9h19v14H24zM47 27h19v15H47zM70 46h19v15H70zM93 27h19v15H93zM116 65h20v15h-20z" fill="#4de4d1"/><path d="M70 9h19v14H70zM116 27h20v15h-20zM24 46h19v15H24zM93 65h19v15H93z" fill="#ff6b9c"/><rect x="96" y="12" width="17" height="15" rx="3" fill="#9e6ff7"/><path d="m104 14 2 4 5 1-4 3 1 4-4-2-4 2 1-4-3-3 5-1Z" fill="#ffe27c"/><circle cx="58" cy="53" r="7" fill="#ffeb79"/><path d="M54 48h8l2 13H52z" fill="#f8dfaa"/><text x="80" y="87" font-size="11" font-weight="900" text-anchor="middle" fill="#fff">COLOR SWITCH</text></svg>'
};
function gameCover(mode){
 const cover=document.createElement('span');
 cover.className='mode-cover';
 cover.innerHTML=MODE_COVER_SVG[mode]||'';
 cover.setAttribute('aria-hidden','true');
 return cover;
}
function renderModeChoices(){
 for(const button of document.querySelectorAll('[data-pick]')){
  const mode=button.dataset.pick;
  if(!Object.hasOwn(MODES,mode))continue;
  const label=document.createElement('span');label.className='mode-choice-title';
  label.textContent=MODES[mode];button.replaceChildren(gameCover(mode),label);
  button.title=MODES[mode];
 }
}

// The match list is nominated by phone players rather than a fixed tournament deck.
let tournament=null;
let selectedSessionMode='queue';
const KEYS = [
  {left:'KeyA',right:'KeyD',jump:'KeyW',down:'KeyS',action:'Space',alt:'ShiftLeft'},
  {left:'ArrowLeft',right:'ArrowRight',jump:'ArrowUp',down:'ArrowDown',action:'Enter',alt:'ShiftRight'}
];
const INPUT_NAMES = ['left','right','jump','down','action','alt'];
let players = [], nextId=1, round=null, roomCode='', hostPeer=null, controllerPeer=null, controllerConn=null;
let hostConnections = new Set(), onlineHost=false, currentView='home', frameLast=0, graphicsClock=0, hudClock=0, networkClock=0, inventoryClock=0;
let controllerKeys={left:false,right:false,jump:false,down:false,action:false,alt:false,axisX:0,axisY:0}, controllerId=null, controllerReady=false;
let controllerGameMode=null,controllerGamePhase='lobby',controllerPlayerActive=false,controllerPlayerEliminated=false;
let disconnectRequested=false;
const HOST_SESSION='gf-host-room-v2',OFFLINE_SESSION='gf-offline-room-v1';
const PHONE_SESSION='gf-phone-room-v2',PHONE_TOKEN='gf-phone-token-v2';
const seatTimers=new Map();let reconnectTimer=null,reconnectTries=0;
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
 const colors=new Set(),ids=new Set();
 players=[];
 for(const a of list){
  if(!a||!/^p\d+$/.test(String(a.id))||ids.has(a.id)||!COLORS.includes(a.color)||
     colors.has(a.color)||!['local','remote'].includes(a.type))continue;
  ids.add(a.id);colors.add(a.color);
  players.push({id:a.id,name:cleanName(a.name),color:a.color,type:a.type,
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
  if(q&&!q.conn)removePlayer(p.id);
 },60000));
}
const canvas=$('arena'), g=canvas.getContext('2d');
// The game world stays at 960x540. Increase the bitmap resolution of the
// *host canvas* to match the screen instead of stretching 960 physical pixels
// across Retina tablets/large monitors. This changes graphics only: coordinates,
// speeds, physics, HUD geometry and the controller's video quality are unchanged.
const ARENA_WIDTH=960,ARENA_HEIGHT=540,MAX_ARENA_SCALE=3;
let arenaResolutionDirty=true,arenaLastDpr=0;
function markArenaResolutionDirty(){arenaResolutionDirty=true;}
function syncArenaResolution(){
 const rawDpr=Number(window.devicePixelRatio);
 const dpr=Number.isFinite(rawDpr)&&rawDpr>0?rawDpr:1;
 if(!arenaResolutionDirty&&arenaLastDpr===dpr)return;
 arenaResolutionDirty=false;arenaLastDpr=dpr;
 const box=canvas.getBoundingClientRect?.();
 // Long/short sides are intentional: portrait fallback may rotate the
 // host canvas by 90 degrees without changing the game world's coordinates.
 const longSide=Math.max(Number(box?.width)||0,Number(box?.height)||0);
 const shortSide=Math.min(Number(box?.width)||0,Number(box?.height)||0);
 const displayScale=longSide>0&&shortSide>0?
   Math.max(longSide/ARENA_WIDTH,shortSide/ARENA_HEIGHT):1;
 const scale=Math.min(MAX_ARENA_SCALE,Math.max(1,displayScale*dpr));
 const width=Math.round(ARENA_WIDTH*scale);
 const height=Math.round(ARENA_HEIGHT*scale);
 if(canvas.width!==width||canvas.height!==height){
   canvas.width=width;canvas.height=height;
 }
 // Setting canvas.width/height clears all context state. Restore the
 // pixel-to-world transform so existing game engines still draw 960x540.
 g.setTransform(width/ARENA_WIDTH,0,0,height/ARENA_HEIGHT,0,0);
 g.imageSmoothingEnabled=true;
 g.imageSmoothingQuality='high';
}
window.addEventListener('resize',markArenaResolutionDirty);
window.addEventListener('orientationchange',markArenaResolutionDirty);
window.visualViewport?.addEventListener?.('resize',markArenaResolutionDirty);
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const cleanName=(value)=>String(value||'').trim().replace(/[<>]/g,'').slice(0,14)||'เพื่อนใหม่';
const blankInput=()=>({left:false,right:false,jump:false,down:false,action:false,alt:false,axisX:0,axisY:0});
function setStatus(text,bad=false){$('netStatus').textContent=text;$('netDot').classList.toggle('bad',bad);}

let toastHandle=null,pendingConfirmation=null;
function showToast(message,bad=false){
 const box=$('uiToast');box.textContent=message;
 box.classList.toggle('bad',!!bad);box.classList.add('visible');
 if(toastHandle!==null&&typeof clearTimeout==='function')clearTimeout(toastHandle);
 toastHandle=setTimeout(()=>box.classList.remove('visible'),3000);
}
function confirmAction(message){
 if(pendingConfirmation)return Promise.resolve(false);
 $('uiModalText').textContent=message;$('uiModal').classList.remove('hidden');
 return new Promise(resolve=>{pendingConfirmation=resolve;});
}
function finishConfirmation(answer){
 $('uiModal').classList.add('hidden');
 const resolve=pendingConfirmation;pendingConfirmation=null;
 if(resolve)resolve(answer);
}

// Only lock page zoom while playing. Keep the lobby and nickname form accessible.
const FREE_VIEWPORT='width=device-width,initial-scale=1,viewport-fit=cover';
const LOCKED_VIEWPORT='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
const gameZoomLocked=()=>currentView==='game'||(currentView==='controller'&&controllerReady);
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
  syncZoomPolicy();
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
  const root=document.documentElement;
  let request=null;
  try{
    if(root&&root.requestFullscreen&&!document.fullscreenElement)
      request=root.requestFullscreen({navigationUI:'hide'});
  }catch(_){/* Browser may deny native fullscreen. */}
  if(request&&typeof request.then==='function')
    request.then(tryLandscapeOrientation,tryLandscapeOrientation);
  else tryLandscapeOrientation();
}
// Safari may ignore viewport scaling hints for gesture zoom; guard native gestures
// only in gameplay, without preventing Pointer Events on analog and A/B buttons.
for(const type of ['gesturestart','gesturechange','gestureend']){
  document.addEventListener(type,e=>{if(gameZoomLocked()&&e.cancelable)e.preventDefault();},{passive:false});
}
document.addEventListener('touchmove',e=>{
  if(gameZoomLocked()&&e.touches&&e.touches.length>1&&e.cancelable)e.preventDefault();
},{passive:false});
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
  const p=players[at];
  if(p.conn)stopHostVideoCall(p.conn);
  players.splice(at,1);
  if(round?.mode==='shockwave'&&round.phase==='playing'){
    window.Shockwave.checkWinner(round.shockwave,players);
    if(round.shockwave.finished)endRound();
  }
  // Remove from roster BEFORE closing, which can synchronously emit a close event.
  if(p.conn&&p.conn.open){try{p.conn.close();}catch(e){}}
  renderRoster();broadcastRoster();
}
function playerPublic(p){return {id:p.id,name:p.name,color:p.color,type:p.type,active:p.active,choice:p.choice,eliminated:!!(round?.mode==='shockwave'&&p.active&&!p.shockAlive)};}
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
  if(!round||!hostPeer||!onlineHost||!conn||!conn.open||!conn.playerId)return;
  stopHostVideoCall(conn);
  conn.videoReady=false;
  const quality=Object.hasOwn(VIDEO_QUALITY,conn.videoQuality)?conn.videoQuality:'medium';
  const source=getHostVideoSource(quality,conn.videoAutoHeight);
  if(!source||typeof hostPeer.call!=='function')return;
  try{
    const call=hostPeer.call(conn.peer,source.stream,{metadata:{type:'game-video',quality}});
    if(!call)return;
    hostVideoCalls.set(conn,call);
    call.on('close',()=>{if(hostVideoCalls.get(conn)===call)hostVideoCalls.delete(conn);});
    call.on('error',()=>{if(hostVideoCalls.get(conn)===call)hostVideoCalls.delete(conn);});
  }catch(_){/* Fall back to the low-rate JPEG preview. */}
}
function broadcastGamePreview(){
  if(!round||!onlineHost||!remotePreviewContext||hostConnections.size===0)return;
  const active=[...hostConnections].filter(c=>
    c.open&&c.playerId&&!c.videoReady&&
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
function broadcastRoster(){
  broadcast({t:'roster',players:players.map(playerPublic),phase:networkPhase(),
    mode:round?round.mode:'ghost',selectionOpen:!round});
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
      cooldownB:cs.blastCooldown||0,boost:!!cs.powerBoostReady});return;
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
  const choices=Object.keys(MODES);
  const firstBotChoice=bots[0]?.choice;
  const nextChoice=choices[(choices.indexOf(firstBotChoice)+1)%choices.length];
  changeAll.classList.toggle('hidden',bots.length===0);
  changeAll.disabled=bots.length===0||!!round;
  changeAll.textContent='เปลี่ยนบอท '+bots.length+' ตัว → '+MODES[nextChoice];
  changeAll.setAttribute('aria-label','ตั้งเกมบอททุกตัวเป็น '+MODES[nextChoice]);
  changeAll.title='กดครั้งเดียวเพื่อเปลี่ยนเกมของบอททั้งหมดเป็น '+MODES[nextChoice]+' โดยไม่เปลี่ยนเกมของผู้เล่นมือถือ';
  $('rosterCount').textContent=players.length+'/'+MAX_PLAYERS;
  // Reserve ALL twelve positions from room creation. Joined players replace
  // numbered placeholders, never change the number or size of grid rows.
  const columns=window.matchMedia?.('(orientation:portrait) and (max-width:720px)')?.matches?2:3;
  el.style.setProperty('--roster-cols',String(columns));
  el.style.setProperty('--roster-rows',String(MAX_PLAYERS/columns));
  $('addLocalBtn').disabled=players.length>=MAX_PLAYERS;
  $('startBtn').disabled=players.length<1||nominatedGames().length!==players.length;
  updateHostQueue();
  players.forEach(p=>{
    const item=document.createElement('div');item.className='roster-item';
    item.title=p.name+' — '+(MODES[p.choice]||'ยังไม่ได้เลือกเกม');
    const color=document.createElement('span');color.className='swatch';color.style.background=p.color;
    const name=document.createElement('b');name.textContent=p.name;
    const type=document.createElement('small');type.textContent=p.isBot?'บอท':'มือถือ';
    const chosen=document.createElement('span');chosen.className='roster-pick'+(p.choice?' picked':'');
    if(p.choice){
      const label=document.createElement('span');label.className='mode-choice-title';
      label.textContent=MODES[p.choice];chosen.append(gameCover(p.choice),label);
    }else chosen.textContent='ยังไม่เลือกเกม';
    chosen.title=p.choice?MODES[p.choice]:'ยังไม่ได้เลือกเกม';
    if(p.isBot){
      chosen.title='คลิกหรือกด Enter เพื่อสลับเกมของบอท';
      chosen.tabIndex=0;chosen.setAttribute('role','button');
      chosen.setAttribute('aria-label','เปลี่ยนเกม '+p.name+' ปัจจุบัน '+(MODES[p.choice]||'ยังไม่เลือก'));
      const cycle=()=>{
        if(round)return;
        const modes=Object.keys(MODES);p.choice=modes[(modes.indexOf(p.choice)+1)%modes.length];
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
function addLocal(){
  if(players.length>=MAX_PLAYERS){showToast('ห้องเต็ม '+MAX_PLAYERS+' คน',true);return;}
  let number=1;while(players.some(p=>p.name==='บอท '+number))number++;
  makePlayer('บอท '+number,'local');broadcastRoster();
}
function resetInputs(){
  players.forEach(p=>{for(const k of INPUT_NAMES)p.input[k]=false;p.input.axisX=0;p.input.axisY=0;p.latch=false;});
}
function closeHost(){
  stopAllHostVideoCalls();
  for(const id of [...seatTimers.keys()])cancelSeat(id);
  deleteSession(HOST_SESSION);
  onlineHost=false;roomCode='';$('roomPanel').classList.add('hidden');$('hostBtn').disabled=false;
  $('hostRoomBadge').textContent='ห้องปิดแล้ว';
  hostConnections.forEach(c=>{send(c,{t:'closed'});try{c.close();}catch(e){}});
  hostConnections.clear();
  if(hostPeer){try{hostPeer.destroy();}catch(e){}hostPeer=null;}
  for(const p of players.filter(p=>p.type==='remote')){players.splice(players.indexOf(p),1);}
  tournament=null;round=null;renderRoster();setStatus('พร้อมเล่น');
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
function startHost(retries=0,resumeCode=null){
  if(onlineHost){setView('hostLobby');return;}
  if(typeof Peer!=='function'){setStatus('โหลดระบบเชื่อมต่อไม่สำเร็จ',true);showToast('ยังโหลด PeerJS ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วโหลดหน้าใหม่',true);return;}
  if(location.protocol==='file:'){showToast('โปรดเปิดเว็บไซต์ผ่าน HTTPS เพื่อใช้มือถือเป็นจอย',true);return;}
  const code=resumeCode||randomCode();
  if(!resumeCode)deleteSession(OFFLINE_SESSION);
  $('hostBtn').disabled=true;setStatus('กำลังสร้างห้อง...');
  const peer=new Peer('gf-party-'+code,{debug:0});
  hostPeer=peer;
  peer.on('open',()=>{
    if(hostPeer!==peer)return;
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
        }else{
          if(players.length>=MAX_PLAYERS){send(conn,{t:'reject',reason:'ห้องเต็มแล้ว (สูงสุด '+MAX_PLAYERS+' คน)'});return;}
          p=makePlayer(msg.name,'remote',conn);
          if(!p)return;
          p.clientToken=token;
          if(round&&round.phase!=='results')p.active=false;
        }
        conn.playerId=p.id;p.lastInputAt=Date.now();
        send(conn,{t:'welcome',id:p.id,name:p.name,color:p.color,mode:round?round.mode:'ghost',phase:networkPhase(),choice:p.choice,active:p.active});
        broadcastRoster();
      }else if(msg.t==='leave'&&conn.playerId){
        const id=conn.playerId;conn.playerId=null;
        removePlayer(id);
      }else if(msg.t==='video-ready'&&conn.playerId){
        if(msg.quality===conn.videoQuality)conn.videoReady=true;
      }else if(msg.t==='video-quality'&&conn.playerId){
        if(!Object.hasOwn(VIDEO_QUALITY,msg.quality))return;
        const autoHeight=msg.quality==='auto'?normalizeAutoHeight(msg.autoHeight):null;
        const changed=conn.videoQuality!==msg.quality||
          (msg.quality==='auto'&&conn.videoAutoHeight!==autoHeight);
        conn.videoQuality=msg.quality;
        conn.videoAutoHeight=autoHeight;
        if(round&&(changed||!hostVideoCalls.has(conn)))startHostVideoCall(conn);
      }else if(msg.t==='pick'&&conn.playerId){
        if(round||currentView!=='hostLobby'||!Object.hasOwn(MODES,msg.mode))return;
        const p=players.find(p=>p.id===conn.playerId&&p.conn===conn);
        if(!p||p.choice===msg.mode)return;
        p.choice=msg.mode;renderRoster();broadcastRoster();
      }else if(msg.t==='target-cycle'&&conn.playerId){
        if(!round||round.phase!=='playing'||round.paused)return;
        if(msg.direction!==1&&msg.direction!==-1)return;
        const p=players.find(q=>q.id===conn.playerId&&q.conn===conn);
        if(p&&round.mode==='ghost'&&window.GhostAttack.cycleTarget(round.ghost,players,p,msg.direction))
          sendPlayerInventory(conn);
      }else if(msg.t==='input'&&conn.playerId){
        if(round&&round.paused)return;
        const p=players.find(p=>p.id===conn.playerId);
        if(!p)return;
        p.lastInputAt=Date.now();
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
      p.conn=null;p.input=blankInput();holdSeat(p);
      renderRoster();broadcastRoster();
    }
    conn.on('close',lost);conn.on('error',lost);
  });
  peer.on('disconnected',()=>setStatus('สัญญาณเซิร์ฟเวอร์ขาดชั่วคราว',true));
  peer.on('error',err=>{
    if(hostPeer!==peer)return;
    if(err.type==='unavailable-id'&&retries<(resumeCode?12:3)){
      try{peer.destroy()}catch(_){}
      hostPeer=null;setTimeout(()=>startHost(retries+1,resumeCode),resumeCode?1200+retries*350:250);
      return;
    }
    setStatus('เปิดห้องไม่สำเร็จ: '+(err.type||'network'),true);
    if(resumeCode){$('hostBtn').disabled=false;showToast('คืนห้องเดิมไม่ได้ ลองโหลดใหม่',true)}
    else{closeHost();setStatus('เปิดห้องไม่สำเร็จ',true)}
  });
}
function copyInvite(){
  const value=$('roomUrl').value;if(!value)return;
  const done=()=>{const b=$('copyBtn');b.textContent='คัดลอกแล้ว ✓';setTimeout(()=>b.textContent='คัดลอกลิงก์',1600);};
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(value).then(done).catch(()=>{ $('roomUrl').select();document.execCommand('copy');done();});}
  else{$('roomUrl').select();document.execCommand('copy');done();}
}
let phoneSelectionOpen=false;
let myChosenMode=null;
function updatePhoneGamePicker(phase,choice){
  phoneSelectionOpen=phase==='lobby'&&controllerReady;
  myChosenMode=Object.hasOwn(MODES,choice)?choice:null;
  $('phoneGamePicker').classList.toggle('hidden',!phoneSelectionOpen);
  // Picker and live game use the same permanent preview frame dimensions.
  // During selection the joystick hit zone is disabled so all seven
  // mini-game buttons stay tappable, including those on the left.
  $('controllerButtons').classList.toggle('is-picking',phoneSelectionOpen);
  // No joystick movement while selecting a game.
  if(phoneSelectionOpen)releaseStick();
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
  if(controllerReady)send(controllerConn,videoQualityPacket(quality));
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
  if(controllerMediaCall!==call||!stream)return;
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
        if(controllerMediaCall!==call)return;
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
  if(videoStreamActive)return;
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
function resetControllerForRoomChange(message){
  disconnectRequested=true;
  if(reconnectTimer!==null&&typeof clearTimeout==='function')clearTimeout(reconnectTimer);
  reconnectTimer=null;reconnectTries=0;
  deleteSession(PHONE_SESSION);
  // Explicit leave removes the seat. A refresh does not send this packet.
  send(controllerConn,{t:'leave'});
  $('leaveConfirm').classList.add('hidden');
  resetPhonePreview();
  void stopRoomScanner();
  // Switching/leaving rooms must not cancel the user's fullscreen or
  // orientation lock. The join form still renders inside #controller.
  safePeerDestroy();
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
function joinRoom(recovery=false){
  recovery=recovery===true;
  if(typeof Peer!=='function'){controllerState('ไม่สามารถโหลดระบบจอยออนไลน์ได้',true);return;}
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
      if(controllerPeer!==peer||call.peer!=='gf-party-'+code){
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
      if(data.t==='welcome'){
        controllerId=data.id;controllerReady=true;
        reconnectTries=0;
        if(reconnectTimer!==null&&typeof clearTimeout==='function')clearTimeout(reconnectTimer);
        reconnectTimer=null;savePhone();
        $('leaveConfirm').classList.add('hidden');
        resetPhonePreview();
        $('controllerName').textContent=data.name;$('controllerAvatar').style.background=data.color;
        $('joinForm').classList.add('hidden');$('controllerActive').classList.remove('hidden');
        controllerState('เชื่อมต่อแล้ว • รอเจ้าของห้องเริ่มเกม');
        $('controllerInventory').classList.remove('is-ghost');
        setControllerGameContext(data.mode,data.phase||'lobby',!!data.active);
        document.body.classList.add('controller-playing');
        syncZoomPolicy();
        showControllerMode(data.mode);
        updatePhoneGamePicker(data.phase||'lobby',data.choice||null);
        // Keep the previously chosen quality between rooms and reloads.
        setControllerVideoQuality(savedVideoQuality());
        sendInputs();announceControllerTakeover();
      }else if(data.t==='preview'){
        if(controllerReady)receivePhonePreview(data.image);
      }else if(data.t==='preview-reset'){
        resetPhonePreview();
      }else if(data.t==='reject'){
        controllerState(data.reason||'ห้องไม่รับผู้เล่น',true);$('joinBtn').disabled=false;
        safePeerDestroy();
      }else if(data.t==='roster'){
        showControllerMode(data.mode);
        const self=(data.players||[]).find(p=>p.id===controllerId);
        setControllerGameContext(data.mode,data.phase,!!(self&&self.active));
         controllerPlayerEliminated=!!(data.mode==='shockwave'&&self?.eliminated);
        updatePhoneGamePicker(data.phase,self&&self.choice);
        $('controllerState').textContent=data.phase==='paused'?'จอหลักหยุดเกมชั่วคราว':
          data.phase==='playing'?(self&&self.eliminated?'ตกรอบ • ดูเกมต่อ':self&&self.active?'กำลังเล่น • '+(MODES[data.mode]||'เกม'):'รอรอบถัดไป'):
          data.phase==='countdown'?'เกมกำลังจะเริ่ม':data.phase==='results'?'จบรอบแล้ว • รอรอบใหม่':
          'กำลังรอเจ้าของห้องเริ่มเกม';
      }else if(data.t==='inventory'){
        renderPhoneInventory(data);
      }else if(data.t==='fruit-status'){
        if(controllerReady&&controllerGameMode==='fruit_memory'&&data.mode==='fruit_memory'){
          const seconds=Math.max(0,Math.min(1.2,Number(data.cooldown)||0));
          $('buttonA').disabled=!!data.eliminated;
          $('buttonA').classList.toggle('cooldown-active',seconds>.03);
          $('buttonA').style.setProperty('--cooldown-sweep',Math.round(seconds/1.2*360)+'deg');
          if(data.eliminated)$('controllerState').textContent='ตกรอบ • ดูการแข่งขันต่อ';
          else if(data.stun>0)$('controllerState').textContent='ถูกสตั้น • '+Number(data.stun).toFixed(1)+' วิ';
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
           $('buttonBLabel').textContent=data.boost?'ระเบิด 4×4 ★':'ระเบิดสี';
           $('buttonB').classList.toggle('color-boost-ready',!!data.boost);
           $('buttonB').title=cb>.03?'รอ '+cb.toFixed(1)+' วิ':data.boost?'พร้อมระเบิด 4×4':'พร้อมระเบิด 3×3';
           $('controllerState').textContent=data.stun>0?'สตั้น '+Number(data.stun).toFixed(1)+' วิ':
             'พื้นที่ '+data.score+' ช่อง'+(data.boost?' • มีพลัง 4×4':'');
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
          data.phase==='playing'?(data.mode==='fruit_memory'?'FRUIT MEMORY • รอด '+(data.survivors??'?')+' คน':data.mode==='chickens'?'กำลังไล่จับไก่ • เหลือ '+Math.ceil(data.remaining||0)+' วิ':data.mode==='shockwave'?(controllerPlayerEliminated?'ตกรอบ • ดูเกมต่อ':'SHOCKWAVE • รอด '+(data.survivors??'?')+' คน'):data.mode==='color_switch'?'COLOR SWITCH • เหลือ '+Math.ceil(data.remaining||0)+' วิ':'ผีกำลังไล่จับ • มนุษย์เหลือ '+(data.survivors??'?')+' คน'):
          data.phase==='results'?'จบรอบแล้ว • พบผู้ชนะ':'รอเริ่มรอบ';
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
  return controllerReady&&controllerPlayerActive&&controllerGameMode==='ghost'&&
    ['countdown','playing','paused'].includes(controllerGamePhase);
}
function setControllerGameContext(mode,phase,active){
  controllerGameMode=mode||null;
  if(mode!=='shockwave'||!['countdown','playing','paused'].includes(phase))controllerPlayerEliminated=false;
  controllerGamePhase=phase||'lobby';
  controllerPlayerActive=!!active;
  const visible=isLiveGameContext();
  $('controllerInventory').classList.toggle('hidden',!visible);
  if(!visible){
    // Clear stale items on results, lobby, switching rooms or future game modes.
    $('controllerInventory').classList.remove('is-ghost');
    $('controllerRole').textContent='';
    $('inventoryItem').textContent='';
    $('inventoryGuide').textContent='';
    $('targetCycleControls').classList.add('hidden');
    $('controllerButtons').classList.remove('has-target');
    $('targetName').textContent='ไม่มีเป้าหมาย';
  }
  showControllerMode(controllerGameMode);
}
function showControllerMode(mode){
  const playing=controllerReady&&controllerPlayerActive&&
    ['countdown','playing','paused'].includes(controllerGamePhase);
  const ghost=playing&&mode==='ghost',chickens=playing&&mode==='chickens';
  const fruit=playing&&mode==='fruit_memory',shockwave=playing&&mode==='shockwave',colorSwitch=playing&&mode==='color_switch';
  const aLabel=ghost?'ตีสตั้น':chickens?'ตีให้ไก่หล่น':fruit?'ต่อย':colorSwitch?'ต่อย':'';
  const bLabel=ghost?($('controllerButtons').classList.contains('has-target')?
    'ยืนยันสโลว์':'ใช้ไอเทม'):colorSwitch?'ระเบิดสี':'';
  $('controllerButtons').classList.toggle('chickens-mode',chickens);
  $('controllerButtons').classList.toggle('fruit-memory-mode',fruit);
  $('controllerButtons').classList.toggle('color-switch-mode',colorSwitch);
  if(!colorSwitch){
    $('buttonB').classList.remove('cooldown-active','color-boost-ready');
    $('buttonB').style.removeProperty('--cooldown-sweep');$('buttonB').title='';
  }
   $('controllerButtons').classList.toggle('shockwave-mode',shockwave);
  if(!chickens&&!fruit&&!colorSwitch){
    $('buttonA').classList.remove('cooldown-active');
    $('buttonA').style.removeProperty('--cooldown-sweep');
    $('buttonA').title='';
  }
  if(!fruit)$('buttonA').disabled=false;
  $('buttonALabel').textContent=aLabel;
  $('buttonBLabel').textContent=bLabel;
  $('buttonA').setAttribute('aria-label',aLabel?'ปุ่ม A '+aLabel:'ปุ่ม A');
  $('buttonB').setAttribute('aria-label',bLabel?'ปุ่ม B '+bLabel:'ปุ่ม B');
  $('controllerModeName').textContent=playing?(MODES[mode]||''):'';
  $('controllerHelp').textContent=ghost?
    'ลากจากที่ว่างเพื่อเดิน • A ตีสตั้น • B ใช้ไอเทม':
    chickens?'วิ่งชนไก่เพื่อจับ • เอาหัวไก่จุ่มในคอก 0.15 วิ • A ตีให้ไก่หล่น':
    fruit?'จำผลไม้แล้ววิ่งไปยังช่องที่ถูกต้อง • ดันกันได้ • A ต่อยให้สตั้น':
    colorSwitch?'วิ่งทาสีชิงพื้นที่ • A ต่อยสตั้น • B ระเบิดสี 3×3 / 4×4':
     shockwave?'แตะช่องระเบิดแม้แค่ปลายแขนก็ตกรอบ • หนีให้ทั้งตัวพ้นช่องแดง':
    'ลากนิ้วบนพื้นที่ว่างเพื่อเคลื่อนที่';
}
function renderPhoneInventory(info){
  if(!isLiveGameContext()||!info||info.id!==controllerId||
     info.mode!==controllerGameMode||info.phase!==controllerGamePhase)return;
  const names=window.GhostAttack.ITEM_NAMES;
  const isGhost=!!info.ghost;
  $('controllerRole').textContent=isGhost?'ผี':'มนุษย์';
  $('controllerInventory').classList.toggle('is-ghost',isGhost);
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
function sendInputs(){if(!controllerReady)return;send(controllerConn,{t:'input',keys:{...controllerKeys}});}
function isPortraitScreen(){
  if(window.matchMedia)return window.matchMedia('(orientation: portrait)').matches;
  return Number(window.innerHeight)>Number(window.innerWidth);
}
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
  const change=(pressed)=>{if(target[key]===pressed)return;target[key]=pressed;btn.classList.toggle('pressed',pressed);if(id==='remote')sendInputs();};
  btn.addEventListener('pointerdown',e=>{e.preventDefault();try{btn.setPointerCapture(e.pointerId);}catch(x){}change(true);});
  btn.addEventListener('pointerup',e=>{e.preventDefault();change(false);});
  btn.addEventListener('pointercancel',()=>change(false));
  btn.addEventListener('lostpointercapture',()=>change(false));
  btn.addEventListener('contextmenu',e=>e.preventDefault());
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
function startRound(forcedMode=null){
  if(!players.length)return;
  if(forcedMode!==null&&!Object.hasOwn(MODES,forcedMode)){
    showToast('ไม่รู้จักเกมที่เลือก: '+String(forcedMode));return;
  }
  const mode=forcedMode??'ghost';
  const engine=gameEngine(mode);
  if(!engine)throw Error(mode+' engine failed to load');
  $('results').classList.add('hidden');
  round={mode,phase:'countdown',paused:false,countdown:mode==='shockwave'?2:3,remaining:null,autoNextRemaining:0,
    rules:{viewMode:'topdown'}};
  window.PartyPlayerAvatar.preload(players);
  engine.setup(round,players);
  $('results').querySelector('.eyebrow').textContent=MODES[mode];
  $('results').querySelector('h2').textContent=mode==='ghost'?'ผู้รอดคนสุดท้าย!':(mode==='fruit_memory'||mode==='shockwave')?'ผู้รอดชีวิตคนสุดท้าย!':mode==='color_switch'?'ผู้ครอบครองพื้นที่มากที่สุด!':'จับไก่ให้ได้มากที่สุด!';
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
  renderLeaderboard();broadcastRoster();
  broadcastPlayerInventories();
  for(const conn of hostConnections)startHostVideoCall(conn);
}
function updateRound(dt){
  if(!round||round.paused)return;
  if(round.phase==='countdown'){
    if(round.mode==='ghost')window.GhostAttack.update(dt,round,players);
     if(round.mode==='shockwave')window.Shockwave.update(dt,round,players);
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
function endRound(){
  if(!round||round.phase==='results')return;
   if(round.mode==='color_switch'){endColorSwitchRound();return;}
  if(round.mode==='chickens'){endChickensRound();return;}
  if(round.mode==='fruit_memory'){endFruitMemoryRound();return;}
   if(round.mode==='shockwave'){endShockwaveRound();return;}
  round.phase='results';round.paused=false;resetInputs();broadcastRoster();
  $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
  const ranked=players.filter(p=>p.active).sort((a,b)=>{
    if(a.id===round.ghost.winnerId)return -1;
    if(b.id===round.ghost.winnerId)return 1;
    return b.score-a.score;
  });
  if(tournament){
    ranked.forEach((p,i)=>p.total=(p.total||0)+Math.max(1,ranked.length-i));
    $('replayBtn').textContent=tournament.index===tournament.schedule.length-1?
      'สุ่มชุดใหม่จากตัวเลือกเดิม':
      'เกมถัดไป ('+(tournament.index+2)+'/'+tournament.schedule.length+')';
  }else $('replayBtn').textContent='เล่นอีกครั้ง';
  round.autoNextRemaining=tournament&&tournament.index+1<tournament.schedule.length&&$('autoNext').checked?7:0;
  const list=$('resultList');list.replaceChildren();
  ranked.forEach((p,i)=>{
    const row=document.createElement('div');row.className='result-player';
    const label=document.createElement('div');
    const winner=p.id===round.ghost.winnerId;
    label.textContent=(winner?'🏆 ':'')+(i+1)+'. '+p.name;
    label.style.color=p.color;
    const detail=document.createElement('span');
    detail.textContent=(winner?'ผู้รอดคนสุดท้าย':p.ghost?'กลายเป็นผี':'รอด')+
      (tournament?' • รวม '+p.total+' คะแนน':'');
    row.append(label,detail);list.append(row);
  });
  if(tournament&&tournament.index===tournament.schedule.length-1&&ranked.length){
    const overall=[...ranked].sort((a,b)=>b.total-a.total);
    list.replaceChildren();
    overall.forEach((p,i)=>{
      const row=document.createElement('div');row.className='result-player';
      const name=document.createElement('div');name.textContent=(i+1)+'. '+p.name;
      name.style.color=p.color;
      const score=document.createElement('span');score.textContent=p.total+' คะแนนรวม';
      row.append(name,score);list.append(row);
    });
    const heading=document.createElement('div');heading.className='tournament-header';
    heading.textContent='ผู้ชนะรวม: '+overall[0].name;list.prepend(heading);
  }
  $('results').classList.remove('hidden');$('gameBanner').textContent='';
  renderLeaderboard();
}

function endShockwaveRound(){
 const s=round.shockwave;round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const ranked=players.filter(p=>p.active).sort((a,b)=>
   Number(b.id===s.winnerId)-Number(a.id===s.winnerId)||
   (b.shockEliminatedAt||0)-(a.shockEliminatedAt||0));
 const rankOf=p=>p.id===s.winnerId?1:1+ranked.filter(q=>
   q.id===s.winnerId||(q.shockEliminatedAt||0)>(p.shockEliminatedAt||0)).length;
 if(tournament){
   ranked.forEach(p=>p.total=(p.total||0)+Math.max(1,ranked.length-rankOf(p)+1));
   $('replayBtn').textContent=tournament.index===tournament.schedule.length-1?
     'สุ่มชุดใหม่จากตัวเลือกเดิม':'เกมถัดไป ('+(tournament.index+2)+'/'+tournament.schedule.length+')';
 }else $('replayBtn').textContent='เล่นอีกครั้ง';
 round.autoNextRemaining=tournament&&tournament.index+1<tournament.schedule.length&&$('autoNext').checked?7:0;
 const winner=ranked.find(p=>p.id===s.winnerId);
 $('results').querySelector('h2').textContent=winner?'ผู้ชนะ: '+winner.name:'ไม่มีผู้ชนะ';
 const list=$('resultList');list.replaceChildren();
 ranked.forEach(p=>{
   const row=document.createElement('div');row.className='result-player';
   const name=document.createElement('div');name.style.color=p.color;
   name.textContent=(p.id===s.winnerId?'★ ':'')+rankOf(p)+'. '+p.name;
   const detail=document.createElement('span');
   detail.textContent=(p.id===s.winnerId?'ผู้รอดคนสุดท้าย':'ตกรอบ Wave '+(p.shockEliminatedWave||s.wave))+
     (tournament?' • รวม '+p.total+' คะแนน':'');
   row.append(name,detail);list.append(row);
 });
 if(tournament&&tournament.index===tournament.schedule.length-1&&ranked.length){
   const overall=[...ranked].sort((a,b)=>b.total-a.total);list.replaceChildren();
   overall.forEach((p,i)=>{
     const row=document.createElement('div');row.className='result-player';
     const name=document.createElement('div');name.textContent=(i+1)+'. '+p.name;name.style.color=p.color;
     const score=document.createElement('span');score.textContent=p.total+' คะแนนรวม';
     row.append(name,score);list.append(row);
   });
   const joint=overall.filter(p=>p.total===overall[0].total);
   const heading=document.createElement('div');heading.className='tournament-header';
   heading.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
   list.prepend(heading);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 renderLeaderboard();
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
   ranked.forEach(p=>{
     const position=byId.get(p.id)?.rank||ranked.length;
     p.total=(p.total||0)+Math.max(1,ranked.length-position+1);
   });
   $('replayBtn').textContent=tournament.index===tournament.schedule.length-1?
     'สุ่มชุดใหม่จากตัวเลือกเดิม':'เกมถัดไป ('+(tournament.index+2)+'/'+tournament.schedule.length+')';
 }else $('replayBtn').textContent='เล่นอีกครั้ง';
 round.autoNextRemaining=tournament&&tournament.index+1<tournament.schedule.length&&$('autoNext').checked?7:0;
 $('results').querySelector('h2').textContent=winners.length===1?'ผู้ชนะ: '+winners[0].name:'คะแนนเสมอ!';
 const list=$('resultList');list.replaceChildren();
 ranked.forEach(p=>{
   const row=document.createElement('div');row.className='result-player';
   const name=document.createElement('div');name.style.color=p.color;
   name.textContent=(s.winnerIds.includes(p.id)?'★ ':'')+(byId.get(p.id)?.rank||1)+'. '+p.name;
   const score=document.createElement('span');
   score.textContent=p.score+' ช่อง'+(tournament?' • รวม '+p.total+' คะแนน':'');
   row.append(name,score);list.append(row);
 });
 if(tournament&&tournament.index===tournament.schedule.length-1&&ranked.length){
   const overall=[...ranked].sort((a,b)=>b.total-a.total||String(a.id).localeCompare(String(b.id)));
   list.replaceChildren();
   overall.forEach(p=>{
     const row=document.createElement('div');row.className='result-player';
     const name=document.createElement('div');name.textContent=(1+overall.filter(q=>q.total>p.total).length)+'. '+p.name;name.style.color=p.color;
     const score=document.createElement('span');score.textContent=p.total+' คะแนนรวม';
     row.append(name,score);list.append(row);
   });
   const joint=overall.filter(p=>p.total===overall[0].total);
   const heading=document.createElement('div');heading.className='tournament-header';
   heading.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
   list.prepend(heading);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 renderLeaderboard();
}
function endChickensRound(){
  round.phase='results';round.paused=false;resetInputs();broadcastRoster();
  $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
  const ranked=players.filter(p=>p.active).sort((a,b)=>b.score-a.score);
  const best=ranked[0]?.score??0;
  const winners=ranked.filter(p=>p.score===best);
  if(tournament){
    ranked.forEach(p=>{
      const rank=ranked.findIndex(q=>q.score===p.score);
      p.total=(p.total||0)+Math.max(1,ranked.length-rank);
    });
    $('replayBtn').textContent=tournament.index===tournament.schedule.length-1?
      'สุ่มชุดใหม่จากตัวเลือกเดิม':
      'เกมถัดไป ('+(tournament.index+2)+'/'+tournament.schedule.length+')';
  }else $('replayBtn').textContent='เล่นอีกครั้ง';
  round.autoNextRemaining=tournament&&tournament.index+1<tournament.schedule.length&&$('autoNext').checked?7:0;
  $('results').querySelector('h2').textContent=winners.length===1?
    'ผู้ชนะ: '+winners[0].name:'คะแนนเสมอ!';
  const list=$('resultList');list.replaceChildren();
  ranked.forEach((p,i)=>{
    const row=document.createElement('div');row.className='result-player';
    const name=document.createElement('div');name.style.color=p.color;
    name.textContent=(p.score===best?'★ ':'')+(i+1)+'. '+p.name;
    const score=document.createElement('span');
    score.textContent=p.score+' ไก่'+(tournament?' • รวม '+p.total+' คะแนน':'');
    row.append(name,score);list.append(row);
  });
  if(tournament&&tournament.index===tournament.schedule.length-1&&ranked.length){
    const overall=[...ranked].sort((a,b)=>b.total-a.total);
    list.replaceChildren();
    overall.forEach((p,i)=>{
      const row=document.createElement('div');row.className='result-player';
      const name=document.createElement('div');name.style.color=p.color;
      name.textContent=(i+1)+'. '+p.name;
      const score=document.createElement('span');score.textContent=p.total+' คะแนนรวม';
      row.append(name,score);list.append(row);
    });
    const joint=overall.filter(p=>p.total===overall[0].total);
    const heading=document.createElement('div');heading.className='tournament-header';
    heading.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
    list.prepend(heading);
  }
  $('results').classList.remove('hidden');$('gameBanner').textContent='';
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
    ranked.forEach(p=>p.total=(p.total||0)+Math.max(1,ranked.length-rankOf(p)+1));
    $('replayBtn').textContent=tournament.index===tournament.schedule.length-1?
      'สุ่มชุดใหม่จากตัวเลือกเดิม':
      'เกมถัดไป ('+(tournament.index+2)+'/'+tournament.schedule.length+')';
  }else $('replayBtn').textContent='เล่นอีกครั้ง';
  round.autoNextRemaining=tournament&&tournament.index+1<tournament.schedule.length&&$('autoNext').checked?7:0;
  const winner=ranked.find(p=>p.id===winnerId);
  $('results').querySelector('h2').textContent=winner?
    'ผู้ชนะ: '+winner.name:s.tieIds?.length?'เสมอ! ไม่มีผู้รอด':'ไม่มีผู้ชนะ';
  const list=$('resultList');list.replaceChildren();
  ranked.forEach(p=>{
    const row=document.createElement('div');row.className='result-player';
    const name=document.createElement('div');name.style.color=p.color;
    name.textContent=(p.id===winnerId?'★ ':'')+rankOf(p)+'. '+p.name;
    const detail=document.createElement('span');
    const tied=!winnerId&&s.tieIds?.includes(p.id);
    detail.textContent=(p.id===winnerId?'ผู้รอดคนสุดท้าย':
      tied?'อันดับร่วม • ตกรอบพร้อมกัน รอบ '+(p.fruitEliminatedRound||s.rounds):
      'ตกรอบ รอบ '+(p.fruitEliminatedRound||s.rounds))+
      (tournament?' • รวม '+p.total+' คะแนน':'');
    row.append(name,detail);list.append(row);
  });
  if(tournament&&tournament.index===tournament.schedule.length-1&&ranked.length){
    const overall=[...ranked].sort((a,b)=>b.total-a.total||String(a.id).localeCompare(String(b.id)));
    // Preserve individual finishing-order rows above the tournament total.
    const heading=document.createElement('div');heading.className='tournament-header';
    const joint=overall.filter(p=>p.total===overall[0].total);
    heading.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:
      'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
    list.append(heading);
    overall.forEach((p,i)=>{
      const row=document.createElement('div');row.className='result-player';
      const name=document.createElement('div');name.style.color=p.color;
      const competitionRank=1+overall.filter(q=>q.total>p.total).length;
      name.textContent=competitionRank+'. '+p.name;
      const score=document.createElement('span');score.textContent=p.total+' คะแนนรวม';
      row.append(name,score);list.append(row);
    });
  }
  $('results').classList.remove('hidden');$('gameBanner').textContent='';
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
  if(!round)return;
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
       const score=document.createElement('small');score.className='leader-role';score.textContent=p.score+' ช่อง';
       const status=document.createElement('span');status.className='leader-item-slot';
       status.textContent=p.cs?.powerBoostReady?'★':p.cs?.stunRemaining>0?'สตั้น':'';
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
function drawGame(t){
  if(!round)return;
  syncArenaResolution();
  gameEngine(round.mode).draw(g,t,round,players);
}
function animate(ts){
  const dt=Math.min(.045,Math.max(0,(ts-frameLast)/1000||.016));frameLast=ts;
  if(currentView==='game'&&round){
    if(!round.paused)graphicsClock+=dt;
    updateRound(dt);drawGame(graphicsClock);
    renderHostVideoFrames();
    if(round&&round.phase==='results'&&round.autoNextRemaining>0){
      round.autoNextRemaining=Math.max(0,round.autoNextRemaining-dt);
      if(round.autoNextRemaining===0)advanceParty();
      else $('replayBtn').textContent='เกมถัดไป ('+(tournament.index+2)+'/'+tournament.schedule.length+
        ') • อีก '+Math.ceil(round.autoNextRemaining)+' วิ';
    }
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
  requestAnimationFrame(animate);
}

function broadcastGameState(){
  if(!round)return;
  broadcast({t:'state',phase:networkPhase(),
    survivors:gameEngine(round.mode).hud(players,round).survivors,remaining:round.remaining,mode:round.mode});
}
function pauseGame(){
  if(currentView!=='game'||!round||round.phase==='results'||round.paused)return;
  renderPauseChoiceList();
  round.paused=true;
  resetInputs();
  $('pauseMenu').classList.remove('hidden');
  $('pauseBtn').setAttribute('aria-expanded','true');
  broadcastRoster();
  broadcastGameState();
}
function resumeGame(){
  if(!round||!round.paused)return;
  resetInputs();
  round.paused=false;
  $('pauseMenu').classList.add('hidden');
  $('pauseBtn').setAttribute('aria-expanded','false');
  broadcastRoster();
  broadcastGameState();
}
function returnToLobby(){
  tournament=null;round=null;resetInputs();
  stopAllHostVideoCalls();
  broadcast({t:'preview-reset'});
  $('pauseMenu').classList.add('hidden');
  $('pauseBtn').setAttribute('aria-expanded','false');
  // Keep document-root fullscreen during lobby/round transitions.
  setView('hostLobby');renderRoster();broadcastRoster();
}
$('pauseBtn').addEventListener('click',pauseGame);
$('resumeBtn').addEventListener('click',resumeGame);
document.addEventListener('keydown',e=>{
  if(currentView==='game'&&(e.code==='Escape'||e.code==='KeyP')){
    e.preventDefault();
    if(round&&round.paused)resumeGame();
    else pauseGame();
  }
});
$('addLocalBtn').addEventListener('click',addLocal);
$('cycleAllBotsBtn').addEventListener('click',()=>{
  // In the lobby, apply the next choice of the first bot to ALL local bots
  // in one action. Real/remote players retain their independently chosen game.
  if(round||currentView!=='hostLobby')return;
  const bots=players.filter(p=>p.isBot);
  if(!bots.length)return;
  const choices=Object.keys(MODES);
  const mode=choices[(choices.indexOf(bots[0].choice)+1)%choices.length];
  bots.forEach(p=>{p.choice=mode;});
  renderRoster();
  broadcastRoster();
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
function beginParty(){
  const picks=nominatedGames();
  if(!picks.length||picks.length!==players.length)return;
  const shuffled=shuffleGames(picks);
  if(selectedSessionMode==='queue'){
    tournament={schedule:shuffled,index:0};
    players.forEach(p=>p.total=0);
    startRound(tournament.schedule[0]);
  }else{
    tournament=null;
    startRound(shuffled[0]);
  }
}
function advanceParty(){
  if(tournament&&tournament.index+1<tournament.schedule.length){
    tournament.index++;startRound(tournament.schedule[tournament.index]);
  }else beginParty();
}
function openOfflineLobby(){
 if(onlineHost)closeHost();
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
 if(onlineHost)closeHost();
 deleteSession(HOST_SESSION);deleteSession(OFFLINE_SESSION);
 tournament=null;round=null;setView('home');
}
$('closeRoomBtn').addEventListener('click',()=>{
 if(!onlineHost){closeHostRoom();return;}
 confirmAction('ปิดห้องนี้และตัดการเชื่อมต่อจอยมือถือทุกเครื่อง?')
  .then(yes=>{if(yes)closeHostRoom();});
});
$('copyBtn').addEventListener('click',copyInvite);
$('exitBtn').addEventListener('click',returnToLobby);
$('backBtn').addEventListener('click',returnToLobby);
$('replayBtn').addEventListener('click',advanceParty);
document.querySelectorAll('[data-session-mode]').forEach(button=>{
 button.addEventListener('click',()=>{
  selectedSessionMode=button.dataset.sessionMode==='quick'?'quick':'queue';
  for(const other of document.querySelectorAll('[data-session-mode]')){
   const active=other.dataset.sessionMode===selectedSessionMode;
   other.classList.toggle('active',active);
   other.setAttribute('aria-pressed',String(active));
  }
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
document.querySelectorAll('[data-pick]').forEach(button=>button.addEventListener('click',()=>{
  const mode=button.dataset.pick;
  if(!phoneSelectionOpen||!controllerReady||!Object.hasOwn(MODES,mode))return;
  updatePhoneGamePicker('lobby',mode);
  send(controllerConn,{t:'pick',mode});
}));
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
$('videoStartBtn').addEventListener('click',()=>{
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
  resetControllerForRoomChange('ออกจากห้องแล้ว • กรอกรหัสใหม่หรือสแกน QR เพื่อเข้าร่วม');
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
 selectedSessionMode=snapshot.selectedSessionMode==='quick'?'quick':'queue';
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
  setView('hostLobby');renderRoster();
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