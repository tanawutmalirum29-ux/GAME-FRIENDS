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
const MODES = { stars:'STAR RUSH', brawl:'BRAWL ARENA', lava:'LAVA RUN', tanks:'TANK BLAST',soccer:'FOOTBALL',rally:'MICRO RALLY',paint:'COLOR CLASH' };
const TOPDOWN = ['tanks','soccer','rally','paint'];
// The match list is nominated by phone players rather than a fixed tournament deck.
let tournament=null;
const KEYS = [
  {left:'KeyA',right:'KeyD',jump:'KeyW',down:'KeyS',action:'Space',alt:'ShiftLeft'},
  {left:'ArrowLeft',right:'ArrowRight',jump:'ArrowUp',down:'ArrowDown',action:'Enter',alt:'ShiftRight'}
];
const INPUT_NAMES = ['left','right','jump','down','action','alt'];
const WORLD = {w:960,h:540,ground:470,gravity:1050};
const platforms = [
  {x:90,y:376,w:185,h:14}, {x:393,y:326,w:180,h:14}, {x:684,y:376,w:185,h:14},
  {x:255,y:245,w:155,h:14}, {x:555,y:245,w:155,h:14}
];
let players = [], nextId=1, round=null, roomCode='', hostPeer=null, controllerPeer=null, controllerConn=null;
let hostConnections = new Set(), onlineHost=false, currentView='home', frameLast=0, graphicsClock=0, hudClock=0, networkClock=0;
let controllerKeys={left:false,right:false,jump:false,down:false,action:false,alt:false,axisX:0,axisY:0}, controllerId=null, controllerReady=false;
let disconnectRequested=false;
const canvas=$('arena'), g=canvas.getContext('2d');
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const cleanName=(value)=>String(value||'').trim().replace(/[<>]/g,'').slice(0,14)||'เพื่อนใหม่';
const blankInput=()=>({left:false,right:false,jump:false,down:false,action:false,alt:false,axisX:0,axisY:0});
function setStatus(text,bad=false){$('netStatus').textContent=text;$('netDot').classList.toggle('bad',bad);}
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
  ['home','hostLobby','game','controller'].forEach(v=>$(v).classList.toggle('hidden',v!==view));
  document.body.classList.toggle('host-playing',view==='game');
  syncZoomPolicy();
  window.scrollTo(0,0);
}
function requestHostFullscreen(){
  // Fullscreen the persistent DOCUMENT root, not the #game view.
  // Hiding #game when returning to the QR lobby would otherwise force browsers
  // to leave Fullscreen, even when the user never asked to leave it.
  // On iOS browsers without Element.requestFullscreen, the fixed-viewport CSS
  // remains the fallback, and OS-level fullscreen behavior is browser-owned.
  const root=document.documentElement;
  if(root&&root.requestFullscreen&&!document.fullscreenElement){
    try{
      const result=root.requestFullscreen({navigationUI:'hide'});
      if(result&&result.catch)result.catch(()=>{});
    }catch(_){/* CSS full-viewport fallback remains active. */}
  }
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
  const p={id:'p'+nextId++,name:cleanName(name),type:type,color,conn:conn||null,
    input:blankInput(),x:480,y:WORLD.ground,vx:0,vy:0,grounded:true,face:1,
    hp:3,score:0,total:0,choice:type==='local'?'stars':null,
    alive:true,active:false,invulnerable:0,cooldown:0,dash:0,attack:0,latch:false,respawn:0};
  players.push(p);renderRoster();return p;
}
function removePlayer(id) {
  const at=players.findIndex(p=>p.id===id);
  if(at<0)return;
  const p=players[at];
  if(p.conn)stopHostVideoCall(p.conn);
  players.splice(at,1);
  // Remove from roster BEFORE closing, which can synchronously emit a close event.
  if(p.conn&&p.conn.open){try{p.conn.close();}catch(e){}}
  renderRoster();broadcastRoster();
}
function playerPublic(p){return {id:p.id,name:p.name,color:p.color,type:p.type,active:p.active,choice:p.choice};}
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
    mode:round?round.mode:'stars',selectionOpen:!round});
}
function nominatedGames(){
  return players.map(p=>p.choice).filter(mode=>Object.hasOwn(MODES,mode));
}
function updateHostQueue(){
  const picks=nominatedGames();
  const waiting=players.length-picks.length;
  // Show individual game names only beside their player; this line is status only.
  $('hostQueue').textContent=!players.length?'รอผู้เล่นเข้าห้อง':
    !picks.length?'รอผู้เล่นเลือกมินิเกม • 0/'+players.length+' คน':
    'เลือกแล้ว '+picks.length+'/'+players.length+' คน • '+
      (waiting?'รออีก '+waiting+' คน':'พร้อมสุ่มเล่น '+picks.length+' รอบ (รวมเกมซ้ำ)');
  $('hostQueue').title=$('hostQueue').textContent;
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
  $('rosterCount').textContent=players.length+'/'+MAX_PLAYERS;
  $('addLocalBtn').disabled=players.length>=MAX_PLAYERS;
  $('startBtn').disabled=players.length<1||nominatedGames().length!==players.length;
  updateHostQueue();
  if(!players.length){const p=document.createElement('p');p.className='empty';p.textContent='ยังไม่มีผู้เล่น ชวนเพื่อนสแกน QR Code หรือเพิ่มผู้เล่นคีย์บอร์ด';el.append(p);return;}
  players.forEach(p=>{
    const item=document.createElement('div');item.className='roster-item';
    item.title=p.name+' — '+(MODES[p.choice]||'ยังไม่ได้เลือกเกม');
    const color=document.createElement('span');color.className='swatch';color.style.background=p.color;
    const name=document.createElement('b');name.textContent=p.name;
    const type=document.createElement('small');type.textContent=p.type==='local'?'คีย์บอร์ด':'มือถือ';
    const chosen=document.createElement('span');chosen.className='roster-pick'+(p.choice?' picked':'');
    chosen.textContent=p.choice?MODES[p.choice]:'ยังไม่เลือกเกม';
    chosen.title=p.choice?MODES[p.choice]:'ยังไม่ได้เลือกเกม';
    const kick=document.createElement('button');kick.type='button';kick.textContent='×';kick.title='เอาผู้เล่นออก';kick.setAttribute('aria-label','เอา '+p.name+' ออกจากห้อง');
    kick.addEventListener('click',()=>removePlayer(p.id));
    item.append(color,name,type,chosen,kick);el.append(item);
  });
}
function addLocal(){
  const localCount=players.filter(p=>p.type==='local').length;
  if(players.length>=MAX_PLAYERS)return;
  makePlayer('หน้าจอ '+(localCount+1),'local');
  broadcastRoster();
}
function resetInputs(){
  players.forEach(p=>{for(const k of INPUT_NAMES)p.input[k]=false;p.input.axisX=0;p.input.axisY=0;p.latch=false;});
}
function closeHost(){
  stopAllHostVideoCalls();
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
    try{new QRCode(box,{text:link,width:230,height:230,correctLevel:QRCode.CorrectLevel.M});return;}catch(e){}
  }
  box.textContent='QR ไม่พร้อม กรุณาคัดลอกลิงก์';
}
function startHost(retries=0){
  if(onlineHost){setView('hostLobby');return;}
  if(typeof Peer!=='function'){setStatus('โหลดระบบเชื่อมต่อไม่สำเร็จ',true);alert('ยังโหลด PeerJS ไม่ได้ ตรวจสอบอินเทอร์เน็ต แล้วโหลดหน้าใหม่ (โหมดเล่นบนจอยังใช้ได้)');return;}
  if(location.protocol==='file:'){alert('โปรดเปิดเว็บไซต์ผ่าน HTTPS เพื่อใช้มือถือเป็นจอย');return;}
  const code=randomCode();
  $('hostBtn').disabled=true;setStatus('กำลังสร้างห้อง...');
  const peer=new Peer('gf-party-'+code,{debug:0});
  hostPeer=peer;
  peer.on('open',()=>{
    if(hostPeer!==peer)return;
    roomCode=code;onlineHost=true;$('roomCode').textContent=code;
    $('roomPanel').classList.remove('hidden');$('offlineRoomHint').classList.add('hidden');
    $('hostBtn').disabled=false;$('hostRoomBadge').textContent='ROOM '+code;
    renderQr(code);setStatus('เปิดห้อง '+code);
    setView('hostLobby');renderRoster();broadcastRoster();
  });
  peer.on('connection',conn=>{
    if(hostPeer!==peer){conn.close();return;}
    hostConnections.add(conn);
    conn.on('data',msg=>{
      if(!msg||typeof msg!=='object')return;
      if(msg.t==='join'&&!conn.playerId){
        if(players.length>=MAX_PLAYERS){send(conn,{t:'reject',reason:'ห้องเต็มแล้ว (สูงสุด 12 คน)'});return;}
        const p=makePlayer(msg.name,'remote',conn);
        if(!p)return;
        conn.playerId=p.id;p.lastInputAt=Date.now();
        if(round&&round.phase!=='results')p.active=false;
        send(conn,{t:'welcome',id:p.id,name:p.name,color:p.color,mode:round?round.mode:'stars',phase:networkPhase(),choice:p.choice});
        broadcastRoster();
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
    conn.on('close',()=>{stopHostVideoCall(conn);hostConnections.delete(conn);if(conn.playerId)removePlayer(conn.playerId);});
    conn.on('error',()=>{stopHostVideoCall(conn);hostConnections.delete(conn);if(conn.playerId)removePlayer(conn.playerId);});
  });
  peer.on('disconnected',()=>setStatus('สัญญาณเซิร์ฟเวอร์ขาดชั่วคราว',true));
  peer.on('error',err=>{
    if(hostPeer!==peer)return;
    if(err.type==='unavailable-id'&&retries<3){
      try{peer.destroy();}catch(e){}
      hostPeer=null;startHost(retries+1);return;
    }
    setStatus('เปิดห้องไม่สำเร็จ: '+(err.type||'network'),true);
    closeHost();setStatus('เปิดห้องไม่สำเร็จ',true);
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
  $('leaveConfirm').classList.add('hidden');
  resetPhonePreview();
  void stopRoomScanner();
  // Switching/leaving rooms must not cancel the user's fullscreen or
  // orientation lock. The join form still renders inside #controller.
  safePeerDestroy();
  controllerReady=false;controllerId=null;
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
}
function joinRoom(){
  if(typeof Peer!=='function'){controllerState('ไม่สามารถโหลดระบบจอยออนไลน์ได้',true);return;}
  const code=parseRoomCode($('roomCodeInput').value);
  if(!code){controllerState('รหัสห้องไม่ถูกต้อง กรุณากรอก 6 ตัวหรือสแกน QR',true);return;}
  selectRoomCode(code);
  const name=cleanName($('nick').value);$('nick').value=name;rememberNickname();
  void stopRoomScanner();
  void requestLandscape();
  $('joinBtn').disabled=true;controllerState('กำลังเชื่อมต่อห้อง '+code+'...');
  disconnectRequested=true;safePeerDestroy();
  disconnectRequested=false;
  const peer=new Peer(undefined,{debug:0});
  controllerPeer=peer;
  peer.on('open',()=>{
    if(controllerPeer!==peer)return;
    const conn=peer.connect('gf-party-'+code,{reliable:true,serialization:'json'});
    controllerConn=conn;
    conn.on('open',()=>{send(conn,{t:'join',name});controllerState('กำลังรอห้องรับผู้เล่น...');});
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
        $('leaveConfirm').classList.add('hidden');
        resetPhonePreview();
        $('controllerName').textContent=data.name;$('controllerAvatar').style.background=data.color;
        $('joinForm').classList.add('hidden');$('controllerActive').classList.remove('hidden');
        controllerState('เชื่อมต่อแล้ว • รอเจ้าของห้องเริ่มเกม');
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
        updatePhoneGamePicker(data.phase,self&&self.choice);
        $('controllerState').textContent=data.phase==='paused'?'จอหลักหยุดเกมชั่วคราว':
          data.phase==='playing'?(self&&self.active?'กำลังเล่น • '+(MODES[data.mode]||'เกม'):'รอรอบถัดไป'):
          data.phase==='countdown'?'เกมกำลังจะเริ่ม':data.phase==='results'?'จบรอบแล้ว • รอรอบใหม่':
          'กำลังรอเจ้าของห้องเริ่มเกม';
      }else if(data.t==='state'){
        showControllerMode(data.mode);
        if(data.phase!=='lobby')updatePhoneGamePicker(data.phase,myChosenMode);
        $('controllerState').textContent=data.phase==='paused'?'หยุดเกมชั่วคราว • รอเจ้าของห้อง':
          data.phase==='playing'?'กำลังเล่น • เหลือ '+Math.ceil(data.remaining)+' วินาที':
          data.phase==='results'?'จบรอบแล้ว':'รอเริ่มรอบ';
      }else if(data.t==='closed'){
        controllerState('เจ้าของห้องปิดห้องแล้ว',true);
      }
    });
    conn.on('close',()=>{if(controllerConn===conn)controllerDisconnected();});
    conn.on('error',()=>{if(controllerConn===conn)controllerDisconnected();});
  });
  peer.on('error',err=>{
    if(controllerPeer!==peer)return;
    controllerState('เชื่อมต่อไม่ได้ ('+(err.type||'network')+') ตรวจสอบรหัส/อินเทอร์เน็ต',true);
    $('joinBtn').disabled=false;
  });
}
function controllerDisconnected(){
  if(disconnectRequested)return;
  resetControllerForRoomChange('ขาดการเชื่อมต่อ กดเข้าร่วมห้องเดิมหรือเปลี่ยนห้องได้');
}
function showControllerMode(mode){
  const topdown=TOPDOWN.includes(mode);
  const actions={
    stars:['DASH','JUMP'],brawl:['PUNCH','JUMP'],lava:['DASH','JUMP'],
    tanks:['FIRE','DODGE'],soccer:['KICK','SPRINT'],
    rally:['BOOST','BRAKE'],paint:['PAINT','DASH']
  };
  const labels=actions[mode]||['ACTION','JUMP'];
  $('buttonALabel').textContent=labels[0];
  $('buttonBLabel').textContent=labels[1];
  $('controllerModeName').textContent=MODES[mode]||'MINI GAME';
  $('controllerHelp').textContent=topdown?
    'แตะพื้นที่ซ้ายจุดไหนก็ได้แล้วลาก • A '+labels[0]+' • B '+labels[1]:
    'แตะพื้นที่ซ้ายตรงไหนก็ได้แล้วลาก • ดันขึ้นหรือกด B เพื่อกระโดด • A '+labels[0];
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
// Request landscape after a user gesture; iOS Safari may deny orientation lock.
async function requestLandscape(){
  const panel=$('controller');
  try{
    if(panel.requestFullscreen&&!document.fullscreenElement)await panel.requestFullscreen();
  }catch(_){/* fullscreen unavailable */ }
  try{
    if(window.screen&&window.screen.orientation&&window.screen.orientation.lock)
      await window.screen.orientation.lock('landscape');
  }catch(_){/* portrait overlay is the fallback */ }
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
    zone.classList.remove('is-active');
    sendInputs();
  };
  const move=e=>{
    // Movement is measured from the first touch, not a fixed screen position.
    // CSS rotated portrait mode needs inverse rotation of the finger delta.
    const dx=e.clientX-originX,dy=e.clientY-originY;
    const localX=rotated()?dy:dx,localY=rotated()?-dx:dy;
    const box=base.getBoundingClientRect();
    const travel=Math.max(1,Math.min(box.width,box.height)*.285);
    const len=Math.hypot(localX,localY),factor=len>travel?travel/len:1;
    let x=Math.round(localX*factor/travel*100)/100;
    let y=Math.round(localY*factor/travel*100)/100;
    if(Math.hypot(x,y)<.14){x=0;y=0;}
    if(x===0)x=0;if(y===0)y=0;
    knob.style.transform='translate(calc(-50% + '+Math.round(x*travel)+'px),calc(-50% + '+Math.round(y*travel)+'px))';
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
  const locals=players.filter(p=>p.type==='local');
  KEYS.forEach((mapping,i)=>{const p=locals[i];if(!p)return;for(const k of INPUT_NAMES)if(e.code===mapping[k]){p.input[k]=true;e.preventDefault();}});
});
document.addEventListener('keyup',e=>{
  const locals=players.filter(p=>p.type==='local');
  KEYS.forEach((mapping,i)=>{const p=locals[i];if(!p)return;for(const k of INPUT_NAMES)if(e.code===mapping[k]){p.input[k]=false;e.preventDefault();}});
});
window.addEventListener('blur',()=>{
  resetInputs();for(const k of INPUT_NAMES)controllerKeys[k]=false;
  releaseStick();sendInputs();
  document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));
});
function startRound(forcedMode=null){
  if(!players.length)return;
  $('results').classList.add('hidden');
  const mode=Object.hasOwn(MODES,forcedMode)?forcedMode:'stars',duration=Number($('duration').value)||60;
  round={mode,duration,remaining:duration,phase:'countdown',paused:false,countdown:3.25,stars:[],starClock:0};
  players.forEach((p,i)=>{
    p.active=true;p.alive=true;p.x=55+((i+.5)*850/players.length);p.y=WORLD.ground;
    p.vx=0;p.vy=0;p.score=0;p.hp=3;p.grounded=true;p.face=i%2? -1:1;p.cooldown=0;p.attack=0;p.dash=0;p.latch=false;p.respawn=0;p.invulnerable=0;p.input=blankInput();
  });
  if(mode==='stars'){for(let i=0;i<5;i++)spawnStar();}
  if(TOPDOWN.includes(mode)){
    if(!window.PartyMiniGames)throw Error('minigames.js failed to load');
    window.PartyMiniGames.setup(round,players);
  }
  const subtitles={
    stars:'คว้าดาวให้มากที่สุด',brawl:'ตะลุมบอนแย่งคะแนน',lava:'ใครอยู่รอดคนสุดท้าย',
    tanks:'รถถังยิงกันบนสนาม',soccer:'สองทีมแย่งยิงประตู',rally:'ผ่านจุดตรวจให้ครบเพื่อทำรอบ',paint:'ระบายสีแย่งพื้นที่'
  };
  $('gameMode').textContent=MODES[mode];$('gameTitle').textContent=subtitles[mode];
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
  for(const conn of hostConnections)startHostVideoCall(conn);
}
function spawnStar(){
  if(!round)return;
  const surfaces=[{x:38,y:WORLD.ground,w:884},...platforms];
  const s=surfaces[Math.floor(Math.random()*surfaces.length)];
  round.stars.push({x:rand(s.x+23,s.x+s.w-23),y:s.y-35,spin:rand(0,6.28)});
}
function updatePlayers(dt){
  for(const p of players){
    if(!p.active)continue;
    p.cooldown=Math.max(0,p.cooldown-dt);p.attack=Math.max(0,p.attack-dt);
    p.dash=Math.max(0,p.dash-dt);p.invulnerable=Math.max(0,p.invulnerable-dt);
    if(!p.alive){
      if(round.mode==='brawl'){
        p.respawn-=dt;
        if(p.respawn<=0){p.alive=true;p.hp=3;p.x=rand(110,850);p.y=140;p.vx=0;p.vy=0;p.invulnerable=1.4;}
      }
      continue;
    }
    const input=p.input||blankInput();
    const analog=Number.isFinite(input.axisX)?input.axisX:0;
    const move=Math.abs(analog)>.05?analog:Number(input.right)-Number(input.left);
    if(move)p.face=Math.sign(move);
    if((input.jump||input.alt||input.axisY<-.55)&&p.grounded){p.vy=-510;p.grounded=false;}
    if(input.action&&!p.latch&&p.cooldown<=0){
      if(round.mode==='brawl'){
        p.cooldown=.47;p.attack=.20;
        for(const enemy of players){
          if(enemy===p||!enemy.active||!enemy.alive||enemy.invulnerable>0)continue;
          const dx=enemy.x-p.x,dy=Math.abs(enemy.y-p.y);
          if(Math.abs(dx)<67&&dy<68&&dx*p.face>-13){
            enemy.hp--;enemy.invulnerable=.62;enemy.vx=p.face*360;enemy.vy=-270;enemy.grounded=false;
            p.score+=1;
            if(enemy.hp<=0){enemy.alive=false;enemy.respawn=1.45;p.score+=2;}
          }
        }
      }else{
        p.cooldown=1.1;p.dash=.24;
      }
    }
    p.latch=input.action;
    p.vx=move*245+(p.dash>0?p.face*330:0);
    const prevY=p.y;
    p.vy+=WORLD.gravity*dt;
    p.x=clamp(p.x+p.vx*dt,21,WORLD.w-21);
    p.y+=p.vy*dt;
    p.grounded=false;
    if(p.vy>=0){
      for(const s of platforms){
        if(p.x>s.x-13&&p.x<s.x+s.w+13&&prevY<=s.y+4&&p.y>=s.y&&p.y<s.y+50){
          p.y=s.y;p.vy=0;p.grounded=true;break;
        }
      }
      if(p.y>=WORLD.ground){p.y=WORLD.ground;p.vy=0;p.grounded=true;}
    }
    if(round.mode==='lava'){
      const lavaY=520-(1-round.remaining/round.duration)*305;
      if(p.y>=lavaY-5){p.alive=false;p.active=true;p.input=blankInput();}
      else p.score+=dt;
    }
  }
}
function updateRound(dt){
  if(!round||round.paused)return;
  if(round.phase==='countdown'){
    round.countdown-=dt;
    $('gameBanner').textContent=round.countdown>0?String(Math.ceil(round.countdown)):'GO!';
    if(round.countdown<=0){round.phase='playing';$('gameBanner').textContent='';broadcastRoster();}
    return;
  }
  if(round.phase!=='playing')return;
  // A controller losing connectivity must not continue moving forever.
  for(const p of players){
    if(p.type==='remote'&&Date.now()-(p.lastInputAt||0)>900){
      for(const key of INPUT_NAMES)p.input[key]=false;
      p.input.axisX=0;p.input.axisY=0;
    }
  }
  round.remaining=Math.max(0,round.remaining-dt);
  if(TOPDOWN.includes(round.mode))window.PartyMiniGames.update(dt,round,players);
  else updatePlayers(dt);
  if(round.mode==='stars'){
    for(let i=round.stars.length-1;i>=0;i--){
      const s=round.stars[i];s.spin+=dt*2.8;
      for(const p of players){
        if(!p.active||!p.alive)continue;
        if(Math.hypot(p.x-s.x,p.y-27-s.y)<34){p.score+=1;round.stars.splice(i,1);break;}
      }
    }
    round.starClock-=dt;
    if(round.stars.length<5&&round.starClock<=0){spawnStar();round.starClock=.85;}
  }
  if(round.mode==='lava'&&players.filter(p=>p.active&&p.alive).length<=1){endRound();return;}
  if(round.remaining<=0)endRound();
}
function endRound(){
  if(!round||round.phase==='results')return;
  round.phase='results';round.paused=false;resetInputs();broadcastRoster();
  $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
  const ranked=players.filter(p=>p.active).sort((a,b)=>b.score-a.score);
  if(tournament){
    let sharedRank=0;
    ranked.forEach((p,i)=>{
      if(i>0&&p.score!==ranked[i-1].score)sharedRank=i;
      p.total=(p.total||0)+Math.max(1,ranked.length-sharedRank);
    });
    if(tournament.index===tournament.schedule.length-1){
      $('replayBtn').textContent='สุ่มชุดใหม่จากตัวเลือกเดิม';
    }else{
      $('replayBtn').textContent='เกมถัดไป ('+(tournament.index+2)+'/'+tournament.schedule.length+')';
    }
  }else{$('replayBtn').textContent='สุ่มเล่นใหม่';}
  round.autoNextRemaining=tournament&&tournament.index+1<tournament.schedule.length&&$('autoNext').checked?7:0;
  const list=$('resultList');list.replaceChildren();
  ranked.forEach((p,i)=>{
    const r=document.createElement('div');r.className='result-player';
    const n=document.createElement('div');n.textContent=(i===0?'🏆 ':String(i+1)+'. ')+p.name;n.style.color=p.color;
    const score=document.createElement('span');
    const roundScore=round.mode==='lava'?p.score.toFixed(1)+' วินาที':Math.floor(p.score)+' คะแนน';
    score.textContent=tournament?roundScore+' • รวม '+p.total:roundScore;
    r.append(n,score);list.append(r);
  });
  if(tournament&&tournament.index===tournament.schedule.length-1&&ranked.length){
    const overall=[...ranked].sort((a,b)=>b.total-a.total);
    list.replaceChildren();
    overall.forEach((p,i)=>{
      const item=document.createElement('div');item.className='result-player';
      const name=document.createElement('div');name.textContent=(i+1)+'. '+p.name;name.style.color=p.color;
      const score=document.createElement('span');score.textContent=p.total+' คะแนนรวม';
      item.append(name,score);list.append(item);
    });
    const heading=document.createElement('div');heading.className='tournament-header';
    heading.textContent='แชมป์ทัวร์นาเมนต์: '+overall[0].name;
    list.prepend(heading);
  }
  $('results').classList.remove('hidden');$('gameBanner').textContent='';renderLeaderboard();
}
function renderLeaderboard(){
  const root=$('leaderboard');root.replaceChildren();if(!round)return;
  players.filter(p=>p.active).sort((a,b)=>b.score-a.score).forEach(p=>{
    const box=document.createElement('div');box.className='leader-chip';
    const c=document.createElement('span');c.className='circle';c.style.background=p.color;
    const name=document.createElement('span');name.textContent=p.name+(p.alive?'':' (OUT)');
    const score=document.createElement('small');score.textContent=round.mode==='lava'?p.score.toFixed(0)+'s':Math.floor(p.score)+' pts';
    box.append(c,name,score);root.append(box);
  });
}
function drawBackdrop(t){
  const bg=g.createLinearGradient(0,0,0,WORLD.h);bg.addColorStop(0,'#18234d');bg.addColorStop(.8,'#29315b');bg.addColorStop(1,'#151b37');
  g.fillStyle=bg;g.fillRect(0,0,960,540);
  for(let i=0;i<42;i++){
    const x=(i*137+41)%960,y=(i*59+31)%260;
    g.fillStyle='rgba(199,229,255,'+(.24+.22*Math.sin(t*.7+i))+')';g.fillRect(x,y,2,2);
  }
  g.fillStyle='#293764';g.beginPath();g.moveTo(0,440);
  for(let x=0;x<=960;x+=20)g.lineTo(x,405+Math.sin(x*.012+t*.08)*24);
  g.lineTo(960,540);g.lineTo(0,540);g.fill();
  g.fillStyle='#263351';g.fillRect(0,WORLD.ground,960,70);
  for(let x=0;x<960;x+=40){g.strokeStyle='#344468';g.strokeRect(x,WORLD.ground,40,70);}
  g.fillStyle='#59dce8';g.fillRect(0,WORLD.ground,960,7);
  for(const s of platforms){
    g.shadowColor='#42cde0';g.shadowBlur=13;g.fillStyle='#3a4d79';g.fillRect(s.x,s.y,s.w,s.h);
    g.fillStyle='#83edff';g.fillRect(s.x,s.y,s.w,4);g.shadowBlur=0;
    g.fillStyle='#17203e';g.fillRect(s.x+7,s.y+s.h,s.w-14,7);
  }
}
function starPath(x,y,r,spin){
  g.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2+spin,rr=i%2?r*.48:r;const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;if(i===0)g.moveTo(px,py);else g.lineTo(px,py);}g.closePath();
}
function drawPlayer(p,t){
  if(!p.active)return;
  if(!p.alive){
    g.save();g.globalAlpha=.6;g.fillStyle=p.color;g.font='bold 13px system-ui';g.textAlign='center';g.fillText(p.name+' OUT',p.x,Math.min(p.y,450)-40);g.restore();return;
  }
  g.save();
  if(p.invulnerable>0&&Math.sin(t*28)>0)g.globalAlpha=.55;
  const x=p.x,y=p.y,wave=p.grounded?Math.sin(t*12+p.x/35)*Math.min(9,Math.abs(p.vx)/24):6;
  g.fillStyle='#0006';g.beginPath();g.ellipse(x,WORLD.ground+9,26,7,0,0,Math.PI*2);g.fill();
  g.strokeStyle='#10182c';g.lineCap='round';g.lineJoin='round';g.lineWidth=11;
  g.beginPath();g.moveTo(x,y-35);g.lineTo(x-11-wave,y);g.moveTo(x,y-35);g.lineTo(x+13+wave,y);g.stroke();
  g.strokeStyle=p.color;g.lineWidth=7;g.stroke();
  g.strokeStyle='#10182c';g.lineWidth=12;
  g.beginPath();g.moveTo(x,y-59);g.lineTo(x-20,y-40-wave*.3);g.moveTo(x,y-59);g.lineTo(x+21*p.face,y-41+(p.attack>0?-16:0));g.stroke();
  g.strokeStyle=p.color;g.lineWidth=8;g.stroke();
  g.strokeStyle='#0c122b';g.lineWidth=14;g.beginPath();g.moveTo(x,y-68);g.lineTo(x,y-32);g.stroke();
  g.strokeStyle=p.color;g.lineWidth=9;g.stroke();
  g.shadowColor=p.color;g.shadowBlur=16;g.fillStyle=p.color;g.strokeStyle='#12162c';g.lineWidth=5;
  g.beginPath();g.arc(x,y-84,15,0,Math.PI*2);g.fill();g.stroke();g.shadowBlur=0;
  g.fillStyle='#11162d';g.beginPath();g.arc(x+p.face*6,y-86,2.6,0,Math.PI*2);g.fill();
  if(p.attack>0){g.strokeStyle='#ffe48c';g.lineWidth=6;g.beginPath();g.arc(x+p.face*22,y-52,30,p.face===1?-.9:2.2,p.face===1?.9:4.1);g.stroke();}
  g.font='bold 14px system-ui';g.textAlign='center';g.strokeStyle='#10172a';g.lineWidth=4;g.strokeText(p.name,x,y-114);g.fillStyle='white';g.fillText(p.name,x,y-114);
  if(round&&round.mode==='brawl'){
    for(let i=0;i<3;i++){g.fillStyle=i<p.hp?'#ff617c':'#4a526e';g.fillRect(x-20+i*14,y-107,11,5);}
  }
  g.restore();
}
function drawGame(t){
  if(!round)return;
  if(TOPDOWN.includes(round.mode)){
    g.clearRect(0,0,960,540);
    window.PartyMiniGames.draw(g,t,round,players);
    return;
  }
  g.clearRect(0,0,960,540);
  drawBackdrop(t);
  if(round.mode==='stars'){
    for(const s of round.stars){
      g.save();g.shadowColor='#ffdb66';g.shadowBlur=23;g.fillStyle='#ffe07d';starPath(s.x,s.y,19,s.spin);g.fill();g.restore();
    }
  }
  if(round.mode==='lava'){
    const height=(1-round.remaining/round.duration)*305;
    const y=520-height;
    const lava=g.createLinearGradient(0,y,0,540);lava.addColorStop(0,'#ffd26b');lava.addColorStop(.12,'#ff704c');lava.addColorStop(1,'#bf244f');
    g.fillStyle=lava;g.beginPath();g.moveTo(0,y);
    for(let x=0;x<=960;x+=15)g.lineTo(x,y+Math.sin(x*.03+t*4)*7);
    g.lineTo(960,540);g.lineTo(0,540);g.closePath();g.fill();
    g.fillStyle='#ffd97b';
    for(let i=0;i<22;i++){const x=(i*121+17)%960,yy=y+15+(i*34)%180;if(yy<540){g.beginPath();g.arc(x,yy+Math.sin(t*3+i)*4,3+(i%3),0,Math.PI*2);g.fill();}}
  }
  players.forEach(p=>drawPlayer(p,t));
  g.fillStyle='#dce9ff';g.font='bold 14px system-ui';g.textAlign='left';
  g.fillText(round.mode==='stars'?'วิ่งเก็บดาว!':round.mode==='brawl'?'HIT เพื่อทำคะแนน!':'อย่าแตะลาวา!',22,30);
  if(round.phase==='results'){g.fillStyle='#1019329c';g.fillRect(0,0,960,540);}
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
      const seconds=Math.max(0,Math.ceil(round.remaining));
      $('timer').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
      renderLeaderboard();hudClock=0;
    }
    remotePreviewClock+=dt;
    if(remotePreviewClock>=1.1&&!round.paused){
      remotePreviewClock=0;
      broadcastGamePreview();
    }
    networkClock+=dt;
    if(networkClock>.85){
      broadcast({t:'state',phase:networkPhase(),remaining:round.remaining,mode:round.mode});
      networkClock=0;
    }
  }
  requestAnimationFrame(animate);
}

function broadcastGameState(){
  if(!round)return;
  broadcast({t:'state',phase:networkPhase(),remaining:round.remaining,mode:round.mode});
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
  if($('sessionMode').value==='queue'){
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
$('offlineBtn').addEventListener('click',()=>{
  if(onlineHost&&!confirm('ปิดห้องออนไลน์และถอดจอยมือถือทั้งหมดเพื่อเล่นออฟไลน์?'))return;
  if(onlineHost)closeHost();
  if(!players.length){addLocal();addLocal();}
  $('hostRoomBadge').textContent='OFFLINE';
  $('roomPanel').classList.add('hidden');
  $('offlineRoomHint').classList.remove('hidden');
  setView('hostLobby');renderRoster();
});
$('startBtn').addEventListener('click',beginParty);
$('closeRoomBtn').addEventListener('click',()=>{
  if(onlineHost&&!confirm('ปิดห้องนี้และตัดการเชื่อมต่อจอยมือถือทุกเครื่อง?'))return;
  if(onlineHost)closeHost();
  tournament=null;round=null;setView('home');
});
$('copyBtn').addEventListener('click',copyInvite);
$('exitBtn').addEventListener('click',returnToLobby);
$('backBtn').addEventListener('click',returnToLobby);
$('replayBtn').addEventListener('click',advanceParty);
$('sessionMode').addEventListener('change',()=>{
  updateHostQueue();
});
$('landscapeBtn').addEventListener('click',()=>{void requestLandscape();});
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
// This is deliberate UX routing, NOT server authentication.
// A malicious client can fabricate the host parameter in a static web app.
// Real host authorization requires a backend-issued identity/token.
if(launchedHost&&!joinCode){
  setView('home');renderRoster();
}else{
  // Root URLs without a room, including after deleting ?join=..., are join-only.
  setView('controller');
  if(joinCode)selectRoomCode(joinCode);
  $('nick').value=getSavedNickname();
  setStatus('พร้อมเข้าร่วมห้อง • กรอกรหัสหรือสแกน QR');
}
requestAnimationFrame(animate);
})();