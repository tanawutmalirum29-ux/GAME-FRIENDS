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
const TOURNAMENT_GAMES=['tanks','soccer','rally','paint','brawl','stars','lava'];
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
  ['home','game','controller'].forEach(v=>$(v).classList.toggle('hidden',v!==view));
  syncZoomPolicy();
  window.scrollTo(0,0);
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
    hp:3,score:0,total:0,alive:true,active:false,invulnerable:0,cooldown:0,dash:0,attack:0,latch:false,respawn:0};
  players.push(p);renderRoster();return p;
}
function removePlayer(id) {
  const at=players.findIndex(p=>p.id===id);
  if(at<0)return;
  const p=players[at];
  players.splice(at,1);
  // Remove from roster BEFORE closing, which can synchronously emit a close event.
  if(p.conn&&p.conn.open){try{p.conn.close();}catch(e){}}
  renderRoster();renderPads();broadcastRoster();
}
function playerPublic(p){return {id:p.id,name:p.name,color:p.color,type:p.type,active:p.active};}
function send(conn,msg){if(conn&&conn.open){try{conn.send(msg);}catch(e){/* peer disconnected */}}}
function broadcast(msg){hostConnections.forEach(c=>send(c,msg));}
function broadcastRoster(){
  broadcast({t:'roster',players:players.map(playerPublic),phase:round?round.phase:'lobby',mode:round?round.mode:$('mode').value});
}
function renderRoster(){
  const el=$('roster');el.replaceChildren();
  $('rosterCount').textContent=players.length+'/'+MAX_PLAYERS;
  $('addLocalBtn').disabled=players.length>=MAX_PLAYERS;
  $('startBtn').disabled=players.length<1;
  if(!players.length){const p=document.createElement('p');p.className='empty';p.textContent='ยังไม่มีผู้เล่น เพิ่มจอยบนหน้าจอหรือส่ง QR Code ให้เพื่อน';el.append(p);return;}
  players.forEach(p=>{
    const item=document.createElement('div');item.className='roster-item';
    const color=document.createElement('span');color.className='swatch';color.style.background=p.color;
    const name=document.createElement('b');name.textContent=p.name;
    const type=document.createElement('small');type.textContent=p.type==='local'?'จอยบนจอ':'มือถือ';
    const kick=document.createElement('button');kick.type='button';kick.textContent='×';kick.title='เอาผู้เล่นออก';kick.setAttribute('aria-label','เอา '+p.name+' ออกจากห้อง');
    kick.addEventListener('click',()=>removePlayer(p.id));
    item.append(color,name,type,kick);el.append(item);
  });
}
function addLocal(){
  const localCount=players.filter(p=>p.type==='local').length;
  if(players.length>=MAX_PLAYERS)return;
  makePlayer('หน้าจอ '+(localCount+1),'local');
  renderPads();broadcastRoster();
}
function resetInputs(){
  players.forEach(p=>{for(const k of INPUT_NAMES)p.input[k]=false;p.input.axisX=0;p.input.axisY=0;p.latch=false;});
}
function closeHost(){
  onlineHost=false;roomCode='';$('roomPanel').classList.add('hidden');$('hostBtn').disabled=false;
  hostConnections.forEach(c=>{send(c,{t:'closed'});try{c.close();}catch(e){}});
  hostConnections.clear();
  if(hostPeer){try{hostPeer.destroy();}catch(e){}hostPeer=null;}
  for(const p of players.filter(p=>p.type==='remote')){players.splice(players.indexOf(p),1);}
  renderRoster();setStatus('พร้อมเล่น');
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
    try{new QRCode(box,{text:link,width:126,height:126,correctLevel:QRCode.CorrectLevel.M});return;}catch(e){}
  }
  box.textContent='QR ไม่พร้อม กรุณาคัดลอกลิงก์';
}
function startHost(retries=0){
  if(onlineHost){$('roomPanel').scrollIntoView({behavior:'smooth'});return;}
  if(typeof Peer!=='function'){setStatus('โหลดระบบเชื่อมต่อไม่สำเร็จ',true);alert('ยังโหลด PeerJS ไม่ได้ ตรวจสอบอินเทอร์เน็ต แล้วโหลดหน้าใหม่ (โหมดเล่นบนจอยังใช้ได้)');return;}
  if(location.protocol==='file:'){alert('โปรดเปิดเว็บไซต์ผ่าน HTTPS เพื่อใช้มือถือเป็นจอย');return;}
  const code=randomCode();
  $('hostBtn').disabled=true;setStatus('กำลังสร้างห้อง...');
  const peer=new Peer('gf-party-'+code,{debug:0});
  hostPeer=peer;
  peer.on('open',()=>{
    if(hostPeer!==peer)return;
    roomCode=code;onlineHost=true;$('roomCode').textContent=code;
    $('roomPanel').classList.remove('hidden');$('hostBtn').disabled=false;
    renderQr(code);setStatus('เปิดห้อง '+code);
    $('roomPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
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
        send(conn,{t:'welcome',id:p.id,name:p.name,color:p.color,mode:round?round.mode:$('mode').value});
        broadcastRoster();
      }else if(msg.t==='input'&&conn.playerId){
        const p=players.find(p=>p.id===conn.playerId);
        if(!p)return;
        p.lastInputAt=Date.now();
        for(const k of INPUT_NAMES)p.input[k]=msg.keys&&msg.keys[k]===true;
        p.input.axisX=Number.isFinite(msg.keys&&msg.keys.axisX)?clamp(msg.keys.axisX,-1,1):0;
        p.input.axisY=Number.isFinite(msg.keys&&msg.keys.axisY)?clamp(msg.keys.axisY,-1,1):0;
      }
    });
    conn.on('close',()=>{hostConnections.delete(conn);if(conn.playerId)removePlayer(conn.playerId);});
    conn.on('error',()=>{hostConnections.delete(conn);if(conn.playerId)removePlayer(conn.playerId);});
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
function safePeerDestroy(){if(controllerConn){try{controllerConn.close();}catch(e){}controllerConn=null;}
  if(controllerPeer){try{controllerPeer.destroy();}catch(e){}controllerPeer=null;}}
function controllerState(msg,bad=false){$('joinMessage').textContent=msg;$('controllerState').textContent=msg;setStatus(msg,bad);}
function joinRoom(){
  if(typeof Peer!=='function'){controllerState('ไม่สามารถโหลดระบบจอยออนไลน์ได้',true);return;}
  const code=new URLSearchParams(location.search).get('join');
  if(!code||!/^[A-Z2-9]{6}$/.test(code)){controllerState('รหัสห้องไม่ถูกต้อง',true);return;}
  const name=cleanName($('nick').value);$('nick').value=name;sessionStorage.setItem('gf-nick',name);
  void requestLandscape();
  $('joinBtn').disabled=true;controllerState('กำลังเชื่อมต่อห้อง '+code+'...');
  disconnectRequested=false;safePeerDestroy();
  const peer=new Peer(undefined,{debug:0});
  controllerPeer=peer;
  peer.on('open',()=>{
    if(controllerPeer!==peer)return;
    const conn=peer.connect('gf-party-'+code,{reliable:true,serialization:'json'});
    controllerConn=conn;
    conn.on('open',()=>{send(conn,{t:'join',name});controllerState('กำลังรอห้องรับผู้เล่น...');});
    conn.on('data',data=>{
      if(!data||typeof data!=='object')return;
      if(data.t==='welcome'){
        controllerId=data.id;controllerReady=true;
        $('controllerName').textContent=data.name;$('controllerAvatar').style.background=data.color;
        $('joinForm').classList.add('hidden');$('controllerActive').classList.remove('hidden');
        controllerState('เชื่อมต่อแล้ว • รอเจ้าของห้องเริ่มเกม');
        document.body.classList.add('controller-playing');
        syncZoomPolicy();
        showControllerMode(data.mode);sendInputs();
      }else if(data.t==='reject'){
        controllerState(data.reason||'ห้องไม่รับผู้เล่น',true);$('joinBtn').disabled=false;
        safePeerDestroy();
      }else if(data.t==='roster'){
        showControllerMode(data.mode);
        const self=(data.players||[]).find(p=>p.id===controllerId);
        $('controllerState').textContent=data.phase==='playing'?(self&&self.active?'กำลังเล่น • '+(MODES[data.mode]||'เกม'):'รอรอบถัดไป'):data.phase==='countdown'?'เกมกำลังจะเริ่ม':data.phase==='results'?'จบรอบแล้ว • รอรอบใหม่':'กำลังรอเจ้าของห้องเริ่มเกม';
      }else if(data.t==='state'){
        showControllerMode(data.mode);
        $('controllerState').textContent=data.phase==='playing'?'กำลังเล่น • เหลือ '+Math.ceil(data.remaining)+' วินาที':data.phase==='results'?'จบรอบแล้ว':'รอเริ่มรอบ';
      }else if(data.t==='closed'){
        controllerState('เจ้าของห้องปิดห้องแล้ว',true);
      }
    });
    conn.on('close',()=>controllerDisconnected());
    conn.on('error',()=>controllerDisconnected());
  });
  peer.on('error',err=>{controllerState('เชื่อมต่อไม่ได้ ('+(err.type||'network')+') ตรวจสอบรหัส/อินเทอร์เน็ต',true);$('joinBtn').disabled=false;});
}
function controllerDisconnected(){
  if(disconnectRequested)return;
  controllerReady=false;controllerId=null;for(const k of INPUT_NAMES)controllerKeys[k]=false;
  controllerKeys.axisX=0;controllerKeys.axisY=0;releaseStick();
  document.body.classList.remove('controller-playing');
  clearPortraitFallback();
  syncZoomPolicy();
  $('joinForm').classList.remove('hidden');$('controllerActive').classList.add('hidden');
  $('joinBtn').disabled=false;
  controllerState('ขาดการเชื่อมต่อ กรุณากดเข้าร่วมใหม่',true);
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
    'อนาล็อกเดิน 4 ทิศ • A '+labels[0]+' • B '+labels[1]:
    'อนาล็อกซ้าย/ขวา • ดันขึ้นหรือกด B เพื่อกระโดด • A '+labels[0];
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
function bindAnalogStick(base,knob,target){
  let pointerId=null;
  const reset=()=>{
    pointerId=null;target.axisX=0;target.axisY=0;
    knob.style.transform='translate(-50%,-50%)';
    base.classList.remove('is-active');sendInputs();
  };
  const move=(e)=>{
    const box=base.getBoundingClientRect();
    const cx=box.left+box.width/2,cy=box.top+box.height/2;
    const travel=Math.max(1,Math.min(box.width,box.height)*.285);
    const dx=e.clientX-cx,dy=e.clientY-cy;
    // CSS rotate(90deg) changes physical pointer axes; undo it before sending
    // game-space movement so 'right' on the sideways UI still means right.
    const rotated=document.body.classList.contains('portrait-fallback')&&isPortraitScreen();
    const localX=rotated?dy:dx,localY=rotated?-dx:dy;
    const distance=Math.hypot(localX,localY),factor=distance>travel?travel/distance:1;
    let x=localX*factor/travel,y=localY*factor/travel;
    if(Math.hypot(x,y)<.14){x=0;y=0;}
    x=Math.round(x*100)/100;y=Math.round(y*100)/100;
    // Canonicalize negative zero after inverse 90-degree rotation.
    if(x===0)x=0;if(y===0)y=0;
    knob.style.transform='translate(calc(-50% + '+Math.round(x*travel)+'px),calc(-50% + '+Math.round(y*travel)+'px))';
    if(Math.abs(target.axisX-x)>.01||Math.abs(target.axisY-y)>.01){
      target.axisX=x;target.axisY=y;sendInputs();
    }
  };
  base.addEventListener('pointerdown',e=>{
    if(pointerId!==null)return;
    e.preventDefault();pointerId=e.pointerId;
    try{base.setPointerCapture(pointerId);}catch(_){}
    base.classList.add('is-active');move(e);
  });
  base.addEventListener('pointermove',e=>{
    if(e.pointerId!==pointerId)return;e.preventDefault();move(e);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture']){
    base.addEventListener(type,e=>{if(e.pointerId===pointerId)reset();});
  }
  base.addEventListener('contextmenu',e=>e.preventDefault());
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
function renderPads(){
  const root=$('localPads');root.replaceChildren();
  players.filter(p=>p.type==='local').forEach((p,i)=>{
    const card=document.createElement('div');card.className='local-pad';
    const heading=document.createElement('h4');heading.style.color=p.color;
    heading.textContent=p.name+(i===0?' • WASD + Space':i===1?' • ลูกศร + Enter':' • แตะปุ่ม');
    const group=document.createElement('div');group.className='pad-buttons';
    [['left','◀','movement'],['right','▶','movement'],['jump','▲','jump-btn'],['down','▼','jump-btn'],['alt','B','jump-btn'],['action','A','attack-btn']].forEach(spec=>{
      const b=document.createElement('button');b.type='button';b.className='control-btn '+spec[2];b.dataset.control=spec[0];b.textContent=spec[1];b.setAttribute('aria-label',spec[0]+' '+p.name);bindControl(b,p.input,p.id);group.append(b);
    });
    card.append(heading,group);root.append(card);
  });
  $('localPads').parentElement.classList.toggle('hidden',!players.some(p=>p.type==='local'));
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
  const mode=typeof forcedMode==='string'?forcedMode:$('mode').value,duration=Number($('duration').value)||60;
  round={mode,duration,remaining:duration,phase:'countdown',countdown:3.25,stars:[],starClock:0};
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
  $('replayBtn').textContent=tournament?'รอบถัดไป':'เล่นอีกครั้ง';
  renderPads();setView('game');renderLeaderboard();broadcastRoster();
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
  if(!round)return;
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
  round.phase='results';resetInputs();broadcastRoster();
  const ranked=players.filter(p=>p.active).sort((a,b)=>b.score-a.score);
  if(tournament){
    let sharedRank=0;
    ranked.forEach((p,i)=>{
      if(i>0&&p.score!==ranked[i-1].score)sharedRank=i;
      p.total=(p.total||0)+Math.max(1,ranked.length-sharedRank);
    });
    if(tournament.index===tournament.schedule.length-1){
      $('replayBtn').textContent='เริ่มทัวร์นาเมนต์ใหม่';
    }else{
      $('replayBtn').textContent='เกมถัดไป ('+(tournament.index+2)+'/'+tournament.schedule.length+')';
    }
  }else{$('replayBtn').textContent='เล่นอีกครั้ง';}
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
  const dt=Math.min(.045,Math.max(0,(ts-frameLast)/1000||.016));frameLast=ts;graphicsClock+=dt;
  if(currentView==='game'&&round){
    updateRound(dt);drawGame(graphicsClock);
    hudClock+=dt;
    if(hudClock>.22){
      const seconds=Math.max(0,Math.ceil(round.remaining));
      $('timer').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
      renderLeaderboard();hudClock=0;
    }
    networkClock+=dt;
    if(networkClock>.85){
      broadcast({t:'state',phase:round.phase,remaining:round.remaining,mode:round.mode});
      networkClock=0;
    }
  }
  requestAnimationFrame(animate);
}

$('addLocalBtn').addEventListener('click',addLocal);
$('hostBtn').addEventListener('click',()=>startHost());
function beginParty(){
  if($('sessionMode').value==='tournament'){
    const shuffled=[...TOURNAMENT_GAMES];
    for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
    tournament={schedule:shuffled.slice(0,5),index:0};
    players.forEach(p=>p.total=0);
    startRound(tournament.schedule[0]);
  }else{tournament=null;startRound();}
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
  beginParty();
});
$('startBtn').addEventListener('click',beginParty);
$('copyBtn').addEventListener('click',copyInvite);
$('exitBtn').addEventListener('click',()=>{tournament=null;round=null;resetInputs();setView('home');renderRoster();broadcastRoster();});
$('backBtn').addEventListener('click',()=>{tournament=null;round=null;resetInputs();setView('home');renderRoster();broadcastRoster();});
$('replayBtn').addEventListener('click',advanceParty);
function selectMiniGame(mode){
  if(!MODES[mode])return;
  $('mode').value=mode;
  document.querySelectorAll('[data-game]').forEach(btn=>{
    const active=btn.dataset.game===mode;
    btn.classList.toggle('selected',active);
    btn.setAttribute('aria-pressed',String(active));
  });
  const details={stars:'เก็บดาวแข่งกัน',brawl:'ตะลุมบอนแย่งคะแนน',lava:'เอาชีวิตรอดจากลาวา',
    tanks:'รถถังยิงกันมุมบน',soccer:'สองทีมแข่งยิงประตู',rally:'รถแข่งผ่านจุดตรวจ',paint:'แย่งยึดพื้นที่สี'};
  $('selectedGameText').textContent=$('sessionMode').value==='tournament'?
    'TOURNAMENT • ระบบสุ่ม 5 จาก 7 มินิเกมเพื่อสะสมคะแนน':
    'เลือกแล้ว: '+MODES[mode]+' • '+details[mode];
  broadcastRoster();
}
document.querySelectorAll('[data-game]').forEach(btn=>btn.addEventListener('click',()=>selectMiniGame(btn.dataset.game)));
$('sessionMode').addEventListener('change',()=>{
  const isTourney=$('sessionMode').value==='tournament';
  $('gameCards').parentElement.classList.toggle('tournament-selected',isTourney);
  selectMiniGame($('mode').value);
});
$('landscapeBtn').addEventListener('click',()=>{void requestLandscape();});
$('rotateRetryBtn').addEventListener('click',()=>{void requestLandscape();});
$('portraitFallbackBtn').addEventListener('click',enablePortraitFallback);
$('portraitRestoreBtn').addEventListener('click',()=>{
  clearPortraitFallback();
  void requestLandscape();
});
$('joinBtn').addEventListener('click',joinRoom);
$('nick').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom();});
$('leaveBtn').addEventListener('click',()=>{
  disconnectRequested=true;safePeerDestroy();controllerReady=false;for(const k of INPUT_NAMES)controllerKeys[k]=false;
  clearPortraitFallback();document.body.classList.remove('controller-playing');
  syncZoomPolicy();
  const u=new URL(window.location.href);u.search='';window.location.assign(u.href);
});
document.querySelectorAll('#controllerActive [data-control]').forEach(btn=>bindControl(btn,controllerKeys,'remote'));
bindAnalogStick($('joystickBase'),$('joystickKnob'),controllerKeys);
setInterval(sendInputs,100);
window.addEventListener('beforeunload',()=>{safePeerDestroy();if(hostPeer)hostPeer.destroy();});

const joinCode=new URLSearchParams(location.search).get('join');
if(joinCode){
  setView('controller');$('joinCode').textContent=joinCode.toUpperCase();
  $('nick').value=sessionStorage.getItem('gf-nick')||'';
  setStatus('พร้อมเชื่อมจอย');
}else{
  setView('home');renderRoster();renderPads();selectMiniGame($('mode').value||'stars');
}
requestAnimationFrame(animate);
})();