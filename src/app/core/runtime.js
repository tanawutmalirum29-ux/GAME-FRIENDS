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
// The legacy bridge is generated from each game's manifest, not authored here.
const MODES=Object.fromEntries(Object.entries(LEGACY_GAME_DATA).map(([id,game])=>[id,game.name]));
const ENGINES=Object.fromEntries(Object.entries(LEGACY_GAME_DATA).map(([id,game])=>[id,game.global]));
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
 if(currentView==='controller')showControllerMode(controllerGameMode);
}
const BOARD_ENGINE={draw:(g,t)=>window.BoardArt.draw(g,t,boardSession),hud:()=>({survivors:boardSession?.players.length||0})};

function gameCover(mode){
 const cover=document.createElement('span');
 cover.className='mode-cover';
 // A versioned, game-owned cover is independent of Core and can hot-update
 // alongside the engine. The legacy inline SVG is for development fallback.
 const uri=window.GamePlatform?.descriptor(mode)?.coverUrl;
 if(uri){
  const img=document.createElement('img');img.src=uri;img.alt='';
  img.width=320;img.height=180;img.decoding='async';
  cover.append(img);
 }else{
  const picture=window.PartyGameCovers?.svg?.(mode);
  if(picture)cover.innerHTML=picture;
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
let controllerResultVotes={next:0,lobby:0,total:0,nextLabel:'เกมถัดไป',backLabel:'กลับล็อบบี้',autoNextSeconds:null,voteWaitSeconds:0};
let controllerLobbyVotes={ready:0,total:0,selfReady:false};
let disconnectRequested=false;
// Optional, deployment-supplied short-lived TURN credentials. Without them,
// leave PeerJS defaults intact rather than advertising STUN as a TURN fix.
// Both host and controllers must use the same ICE configuration.
function partyPeerOptions(){
 const servers=window.GF_ICE_SERVERS;
 if(!Array.isArray(servers))return {debug:0};
 const iceServers=servers.slice(0,8).filter(server=>{
  if(!server||typeof server!=='object')return false;
  const urls=Array.isArray(server.urls)?server.urls:[server.urls];
  return urls.length>0&&urls.length<=4&&urls.every(url=>
   typeof url==='string'&&url.length<256&&/^(stun|stuns|turn|turns):/i.test(url));
 }).map(server=>({
  urls:server.urls,
  ...(typeof server.username==='string'?{username:server.username}:{}),
  ...(typeof server.credential==='string'?{credential:server.credential}:{})
 }));
 return iceServers.length?{debug:0,config:{iceServers}}:{debug:0};
}

 // An optional public endpoint issues coturn REST credentials for each Peer
 // lifecycle. No shared TURN secret is ever present in browser source.
 let partyIceFetch=null,partyIceExpiry=0,partyIceLastAttempt=0,partyIceTimer=null;
 function partyIceUpdatePeers(servers){
  for(const peer of [hostPeer,controllerPeer]){
   if(!peer?.options)return;
   try{peer.options.config={...peer.options.config,iceServers:servers};}catch(_){}
  }
 }
 function partyIceRefreshLater(expiresAt){
  if(partyIceTimer!==null)clearTimeout(partyIceTimer);
  partyIceTimer=setTimeout(()=>{
   partyIceTimer=null;
   const pending=partyIceCredentialsReady();
   if(pending)void pending.catch(()=>{});
  },Math.max(30000,expiresAt-Date.now()-90000));
 }
 // Return null for unconfigured/fresh/cooldown paths, Promise only when an
 // asynchronous fetch is actually required. Existing offline and smoke flows
 // keep their synchronous Peer creation behavior.
 function partyIceCredentialsReady(){
  const setting=window.GF_TURN_CREDENTIALS_ENDPOINT;
  if(typeof setting!=='string'||!setting.trim())return null;
  const now=Date.now();
  if(partyIceExpiry-now>90000)return null;
  if(partyIceFetch)return partyIceFetch;
  if(now-partyIceLastAttempt<30000)return null;
  let endpoint;
  try{
   endpoint=new URL(setting,window.location?.href||location.href);
   if(endpoint.protocol!=='https:'&&!(endpoint.hostname==='localhost'&&endpoint.protocol==='http:'))
    return null;
  }catch(_){return null;}
  partyIceLastAttempt=now;
  partyIceFetch=(async()=>{
   const abort=typeof AbortController==='function'?new AbortController():null;
   const timeout=abort?setTimeout(()=>abort.abort(),4000):null;
   try{
    const response=await fetch(endpoint.href,{method:'GET',credentials:'omit',
      cache:'no-store',signal:abort?.signal});
    if(!response.ok)throw Error('TURN endpoint returned HTTP '+response.status);
    const data=await response.json();
    if(!data||!Array.isArray(data.iceServers)||!Number.isFinite(data.expiresAt)||
       data.expiresAt<Date.now()+60000||data.expiresAt>Date.now()+3600000||
       !data.iceServers.some(entry=>{
        const urls=Array.isArray(entry?.urls)?entry.urls:[entry?.urls];
        return urls.some(url=>typeof url==='string'&&/^turns?:/i.test(url));
       }))throw Error('TURN endpoint returned invalid/expired ICE data');
    const before=window.GF_ICE_SERVERS;
    window.GF_ICE_SERVERS=data.iceServers;
    const validated=partyPeerOptions().config?.iceServers;
    if(!validated){window.GF_ICE_SERVERS=before;throw Error('Invalid ICE configuration');}
    partyIceExpiry=data.expiresAt;
    partyIceUpdatePeers(validated);
    partyIceRefreshLater(partyIceExpiry);
   }catch(error){
    if(partyIceExpiry<=Date.now()){
     partyIceExpiry=0;window.GF_ICE_SERVERS=null;
    }
    console.warn('TURN credentials unavailable; using direct PeerJS ICE fallback',error);
    if(hostPeer||controllerPeer)partyIceRefreshLater(Date.now()+120000);
   }finally{
    if(timeout!==null)clearTimeout(timeout);
    partyIceFetch=null;
   }
  })();
  return partyIceFetch;
 }

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
 choice:p.choice,cosmetic:window.PartyCosmetics?.normalize?.(p.cosmetic)||'none',
 token:p.clientToken||null,total:p.total||0});
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
 const cosmetics=typeof window!=='undefined'?window.PartyCosmetics:null;
 // Reserve valid saved choices before migrating an undressed or duplicate seat.
 const reservedCosmetics=new Set(list.map(p=>cosmetics?.normalize?.(p?.cosmetic)).filter(id=>id&&id!=='none'));
 const claimedCosmetics=new Set();
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
  const savedCosmetic=cosmetics?.normalize?.(a.cosmetic)||'none';
  const cosmetic=savedCosmetic!=='none'&&!claimedCosmetics.has(savedCosmetic)
    ?savedCosmetic
    :cosmetics?.randomAvailable?.(new Set([...reservedCosmetics,...claimedCosmetics]))||'white-rope-wrap';
  claimedCosmetics.add(cosmetic);
  players.push({id:a.id,name:cleanName(a.name),color,type:a.type,
   clientToken:a.token||null,conn:null,input:blankInput(),x:480,y:270,vx:0,vy:0,face:1,
   score:0,total:Number(a.total)||0,choice:Object.hasOwn(MODES,a.choice)?a.choice:null,
   ghost:false,item:null,selecting:false,targetId:null,alive:true,active:false,
    cosmetic,
    isBot:a.type==='local'});
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
   if(boardSession){
    // Keep the same physical player/board identity while a remote seat is offline.
    q.isBot=true;q.input=blankInput();
    const bp=boardSession.players.find(p=>p.id===q.id);
    if(bp)bp.isBot=true;
   }else if(round&&['countdown','playing'].includes(round.phase)&&q.active){
    // A 60-second loss during NORMAL PARTY must not splice an active
    // participant out of the engine's immutable per-round roster.
    // Game-owned AI is initialized lazily on its first bot simulation tick.
    q.isBot=true;q.input=blankInput();
   }else removePlayer(p.id);
  }
 },60000));
}
const canvas=$('arena'), g=canvas.getContext('2d');
// Read UNTRANSFORMED landscape CSS pixels. CSS rotation transposes
// getBoundingClientRect and used to break BOARD drag, pinch and map hit-tests.
function arenaIsRotated(){return physicalPortrait()&&currentView==='game';}
function arenaLayoutRect(visual){
 if(!arenaIsRotated())return {left:visual.left,top:visual.top,
  width:Number(visual.width)||960,height:Number(visual.height)||540,rotated:false};
 return {left:0,top:0,width:Number(canvas.clientWidth)||Number(visual.height)||960,
  height:Number(canvas.clientHeight)||Number(visual.width)||540,rotated:true};
}
function arenaContentRect(rect){
 const frame=arenaLayoutRect(rect),{width,height}=frame;
 if(round?.mode==='board'&&boardSession&&height/width>540/960){
  return {left:frame.left,top:frame.top,scale:width/960,height:960*height/width};
 }
 const scale=Math.min(width/960,height/540);
 return {left:frame.left+(width-960*scale)/2,
  top:frame.top+(height-540*scale)/2,scale,height:540};
}
function arenaPointer(e){
 const visual=canvas.getBoundingClientRect(),frame=arenaLayoutRect(visual),
  content=arenaContentRect(visual);
 // Inverse of CSS rotate(90deg): screen Y -> local X, -screen X -> local Y.
 const x=frame.rotated?(e.clientY-visual.top)*frame.width/Math.max(1,visual.height):e.clientX;
 const y=frame.rotated?(visual.right-e.clientX)*frame.height/Math.max(1,visual.width):e.clientY;
 return {x:(x-content.left)/content.scale,y:(y-content.top)/content.scale};
}
// Host map gestures: drag to pan, pinch to zoom and tap nodes in Debug mode.
// Game input remains exclusively on the controller; pause freezes simulation.
{
 const pointers=new Map();let pinchDistance=0,gestureMoved=false,downAt=null;
 const enabled=()=>round?.mode==='board'&&!!boardSession&&!!window.BoardArt?.canPan(boardSession);
 const coords=e=>arenaPointer(e);
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
let arenaResolutionDirty=true,arenaLastDpr=0,arenaLastModeKey='',arenaLastBoxKey='',arenaLastViewportKey='';
function markArenaResolutionDirty(){arenaResolutionDirty=true;}
function syncArenaResolution(){
 // Standalone iPadOS may resume with a changed visual viewport but NO window
 // resize event. Cheap numeric checks every frame avoid forced layout reads
 // while still invalidating the stale portrait-shaped BOARD bitmap.
 const vv=window.visualViewport;
 const viewportKey=[window.innerWidth,window.innerHeight,vv?.width,vv?.height,
  vv?.scale,arenaIsRotated()].join('|');
 if(viewportKey!==arenaLastViewportKey){
  arenaLastViewportKey=viewportKey;markArenaResolutionDirty();
 }
 const rawDpr=Number(window.devicePixelRatio);
 const dpr=Number.isFinite(rawDpr)&&rawDpr>0?rawDpr:1;
 // Keep the dense 8–12 player board at a still-sharp 2.4x bitmap cap.
 // Its many SVG characters and full terrain would otherwise push tablet GPU
 // memory well above the smaller mini-games. Other games retain 3x quality.
 const denseBoard=round?.mode==='board'&&boardSession?.players.length>=8;
 const modeKey=denseBoard?'board-dense':round?.mode==='board'?'board':'normal';
 // A forced layout read on EVERY animation frame is expensive on mobile Safari.
 // setView, resize, orientation, fullscreen and DPR changes invalidate the cache.
 if(!arenaResolutionDirty&&arenaLastDpr===dpr&&arenaLastModeKey===modeKey)return;
 const box=canvas.getBoundingClientRect?.();
 const layoutBox=arenaLayoutRect(box||{left:0,top:0,width:960,height:540});
 const boxKey=layoutBox.width+'x'+layoutBox.height+':'+arenaIsRotated();
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
  // BOARD icon row, left to right: Exit, Show ID, Pause.
  // Coordinates stay in 960-wide canvas space and follow the existing scale.
  $('boardExitBtn').style.cssText='left:'+(originX+849*toolScale)+'px;top:'+(originY+101*toolScale)+'px;transform:scale('+toolScale+');';
  $('boardTools').style.cssText='left:'+(originX+885*toolScale)+'px;top:'+(originY+101*toolScale)+'px;transform:scale('+toolScale+');';
  $('pauseBtn').style.cssText='left:'+(originX+921*toolScale)+'px;top:'+(originY+101*toolScale)+'px;transform:scale('+toolScale+');';
 }else {$('pauseBtn').style.cssText='';$('boardExitBtn').style.cssText='';}
 // Long/short sides are intentional: portrait fallback may rotate the
 // host canvas by 90 degrees without changing the game world's coordinates.
 const longSide=Math.max(Number(box?.width)||0,Number(box?.height)||0);
 const shortSide=Math.min(Number(box?.width)||0,Number(box?.height)||0);
 const displayScale=longSide>0&&shortSide>0?
   Math.max(longSide/ARENA_WIDTH,shortSide/ARENA_HEIGHT):1;
 const logicalHeight=boardActive?content.height:ARENA_HEIGHT;
 const screenScale=boardActive&&layoutBox.width?content.scale:displayScale;
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
// Safari's restored canvas size may change without a window resize.
// Observe changes in element boxes without per-frame layout reflow.
if(typeof ResizeObserver==='function'){
 const arenaObserver=new ResizeObserver(()=>markArenaResolutionDirty());
 arenaObserver.observe(canvas);
 arenaObserver.observe($('game'));
}
document.addEventListener('fullscreenchange',markArenaResolutionDirty);
document.addEventListener('webkitfullscreenchange',markArenaResolutionDirty);
canvas.addEventListener('contextrestored',markArenaResolutionDirty);
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
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

// Host HOME, room lobby and gameplay are fixed-screen interfaces, NOT zoomable
// documents. Only the unjoined controller's code/name form uses a free viewport.
const FREE_VIEWPORT='width=device-width,initial-scale=1,viewport-fit=cover';
const LOCKED_VIEWPORT='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
const gameZoomLocked=()=>['home','hostLobby','game'].includes(currentView)||
 (currentView==='controller'&&controllerReady);
// Browser/OS chrome cannot be hidden by page gestures. Installed iOS Home
// Screen Web Apps run standalone; offer that supported path for Chrome users.
const isIOSBrowser=()=>{
 const ua=String(navigator?.userAgent||''),platform=String(navigator?.platform||'');
 return /iPad|iPhone|iPod/.test(ua)||(platform==='MacIntel'&&Number(navigator?.maxTouchPoints)>1);
};
const isStandaloneWebApp=()=>navigator?.standalone===true||
  !!window.matchMedia?.('(display-mode: standalone)')?.matches||
  !!window.matchMedia?.('(display-mode: fullscreen)')?.matches;
// One orientation policy for installed Host/Controller apps and web Host rooms.
 // Native orientation lock is best effort; CSS rotation covers unsupported iOS.
 const physicalPortrait=()=>{
  const match=window.matchMedia?.('(orientation: portrait)');
  return typeof match?.matches==='boolean'?match.matches:
    Number(window.innerHeight)>Number(window.innerWidth);
 };
 const usesVirtualLandscape=()=>document.body.classList.contains('gf-virtual-landscape');
 // Camera APIs and QR decoder use physical viewport coordinates. Never rotate
 // the entire page while the scanner is open: iOS WebKit otherwise rotates
 // the <video> but not its underlying sensor/decoder coordinate system.
 const isRoomScannerActive=()=>{
  const scanner=document.getElementById('roomScannerPanel');
  return !!scanner&&!scanner.classList.contains('hidden');
 };
 function syncLandscapePresentation(){
  const active=!isRoomScannerActive()&&physicalPortrait()&&
   (isStandaloneWebApp()||currentView==='hostLobby'||currentView==='game');
  const was=usesVirtualLandscape();
  document.body.classList.toggle('gf-virtual-landscape',active);
  document.documentElement?.classList?.toggle?.('gf-landscape-screen',active);
  if(was!==active)markArenaResolutionDirty();
  if(currentView==='controller'&&controllerReady){
   if(typeof followDeviceOrientation==='function')followDeviceOrientation();
   if(typeof syncControllerVisibleViewport==='function')syncControllerVisibleViewport();
  }
 }
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
  window.PartyPlaza?.setActive(view==='hostLobby');
  syncLandscapePresentation();
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
// Orientation state follows physical rotation, URL bars and installation mode.
 window.addEventListener('orientationchange',syncLandscapePresentation);
 window.addEventListener('resize',syncLandscapePresentation);
 window.addEventListener('pageshow',syncLandscapePresentation);
 window.visualViewport?.addEventListener?.('resize',syncLandscapePresentation);
 // An installed iPadOS Host can be suspended while locked in landscape. Its
 // CSS/visual viewport settles over several frames when it is foregrounded.
 // Reapply orientation, zoom policy and canvas bitmap measurements without
 // changing map camera zoom, turn state, positions or game simulation.
 let foregroundRecoverySerial=0;
 function recoverForegroundPresentation(){
  if(document.hidden)return;
  const serial=++foregroundRecoverySerial;
  const restore=()=>{
   if(serial!==foregroundRecoverySerial||document.hidden)return;
   syncLandscapePresentation();syncZoomPolicy();markArenaResolutionDirty();
  };
  restore();
  // Use delayed tasks rather than requestAnimationFrame: Safari may already
  // have an intentionally suspended frame queue on initial launch/resume.
  // Never replace or steal the Host's single pending game-render callback.
  window.setTimeout(restore,80);
  window.setTimeout(restore,240);
  window.setTimeout(restore,600);
 }
 window.addEventListener('pageshow',recoverForegroundPresentation);
 window.addEventListener('focus',recoverForegroundPresentation);
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)recoverForegroundPresentation();
 });
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
