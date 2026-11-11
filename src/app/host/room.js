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
let lastHostVideoFrameAt=0;
function renderHostVideoFrames(){
  if(!round||hostVideoCalls.size===0)return;
  // Copy at most 30 frames/s instead of resampling all streams on every
  // high-refresh-rate host paint. This never changes game physics/timing.
  const now=typeof performance!=='undefined'?performance.now():Date.now();
  if(now-lastHostVideoFrameAt<33)return;
  lastHostVideoFrameAt=now;
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
  if(round?.mode==='board'&&conn?.boardMinimapCapable===true){stopHostVideoCall(conn);return;}
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
    c.open&&c.playerId&&c.previewEnabled===true&&
    !(round?.mode==='board'&&c.boardMinimapCapable===true)&&!c.videoReady&&
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
    if(image.length>24000){
      remotePreviewCanvas.width=128;remotePreviewCanvas.height=72;
      remotePreviewContext.drawImage(canvas,0,0,128,72);
      image=remotePreviewCanvas.toDataURL('image/jpeg',.14);
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
  if(typeof window!=='undefined'&&window.PartyPlaza&&!window.PartyPlaza.inZone(p,'ready_area'))return false;
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
const failedControllerStatusEngines=new WeakSet();
function sendPlayerInventory(conn){
 // The pinned engine owns its status, never a list of game IDs in Host Core.
 if(!conn||!conn.playerId||!round||
    !['countdown','playing','paused'].includes(networkPhase()))return;
 const p=players.find(q=>q.id===conn.playerId);
 if(!p)return;
 let engine,packet;
 try{
  engine=gameEngine(round.mode);
  packet=engine?.getControllerPacket?.(p,round,players);
 }catch(error){
  // A broken status hook cannot tear down a connected multiplayer room.
  if(engine&&(typeof engine==='object'||typeof engine==='function')&&
     !failedControllerStatusEngines.has(engine)){
   failedControllerStatusEngines.add(engine);
   console.warn('Game controller status hook failed',round.mode,error);
  }
  return;
 }
 if(!packet||typeof packet!=='object'||Array.isArray(packet)||
    typeof packet.t!=='string'||!packet.t)return;
 // The Host always owns room mode and phase, even for untrusted packet fields.
 send(conn,{...packet,mode:round.mode,phase:networkPhase()});
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
  const columns=!usesVirtualLandscape()&&window.matchMedia?.('(orientation:portrait) and (max-width:720px)')?.matches?2:3;
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
  window.PartyPlaza?.sync(players);
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
  const {x:px,y:py}=arenaPointer(e);
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
  // Rotate the joystick vector back into the landscape game world.
   const rotated=arenaIsRotated(),sx=e.clientX-cx,sy=e.clientY-cy;
   let dx=(rotated?sy:sx)/max,dy=(rotated?-sx:sy)/max;
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
  stopHostReconnect();
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
  const paint=()=>{
    if(!onlineHost||roomCode!==code)return;
    box.replaceChildren();
    if(typeof QRCode==='function'){
      try{
        new QRCode(box,{text:link,width:256,height:256,correctLevel:QRCode.CorrectLevel.M});
        return;
      }catch(error){console.warn('QR generation failed',error);}
    }
    box.textContent='QR ไม่พร้อม • คัดลอกลิงก์เชิญด้านล่างได้';
  };
  if(typeof QRCode==='function'){paint();return;}
  // The room and copyable invite are ready without waiting for a second CDN.
  box.textContent='กำลังเตรียม QR • ใช้ลิงก์เชิญได้ทันที';
  const ensureQr=window.GameRuntimeDeps?.ensureQr;
  if(ensureQr){
    void ensureQr().then(()=>{
      // Give the browser a chance to paint the room before QR canvas work.
      requestAnimationFrame(()=>{if(roomCode===code)paint();});
    }).catch(error=>{
      console.warn('QR library unavailable',error);
      if(onlineHost&&roomCode===code)paint();
    });
  }else paint();
}

function fastAxisSessionToken(){
 const bytes=new Uint8Array(16);
 if(!window.crypto?.getRandomValues)return null;
 window.crypto.getRandomValues(bytes);
 return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
function acceptFastAxisConnection(conn){
 const meta=conn?.metadata;
 const player=meta?.kind==='gf-axis-v1'&&typeof meta.playerId==='string'&&
   typeof meta.token==='string'&&/^[a-f0-9]{32}$/.test(meta.token)?
   players.find(p=>p.id===meta.playerId&&p.conn?.peer===conn.peer&&
     p.conn?.fastAxisToken===meta.token):null;
 if(!player){try{conn.close();}catch(_){}return;}
 const primary=player.conn,guard=createFastAxisIngressGuard();
 const cleanup=()=>{
  guard.dispose();
  if(primary.fastAxisConn===conn){
    primary.fastAxisConn=null;primary.fastAxisLastAt=0;
    // Avoid a held direction when the unacknowledged fast path disappears.
    player.input.axisX=0;player.input.axisY=0;
  }
 };
 conn.on('open',()=>{
  // Only true unordered zero-retransmission RTCDataChannels qualify.
  const dc=conn.dataChannel;
  if(primary!==player.conn||dc?.ordered!==false||dc?.maxRetransmits!==0){
   try{conn.close();}catch(_){}return;
  }
  if(primary.fastAxisConn&&primary.fastAxisConn!==conn)
   try{primary.fastAxisConn.close();}catch(_){}
  primary.fastAxisConn=conn;primary.fastAxisLastAt=0;
  send(primary,{t:'axis-ready'});
 });
 conn.on('data',packet=>{
  if(primary.fastAxisConn!==conn||player.conn!==primary||
     !conn.open||!guard.accept(packet)||!round||round.paused)return;
  const x=Math.max(-1,Math.min(1,packet.x)),y=Math.max(-1,Math.min(1,packet.y));
  primary.fastAxisX=x;primary.fastAxisY=y;primary.fastAxisLastAt=Date.now();
  player.lastInputAt=Date.now();
  if(round.mode==='board'&&boardSession){
   const board=boardSession;
   if(packet.turnId!==board.turnId||packet.mapId!==board.map.id||
      window.BoardParty.current(board)?.id!==player.id||
      primary.boardCameraGestureToken===board.turnId)return;
   const previous=board.inputs[player.id];
   const held=previous?.turnId===board.turnId?previous:{};
   window.BoardParty.input(board,player.id,{
    turnId:board.turnId,mapId:board.map.id,
    actionId:(board.lastActions[player.id]??-1)+1,
    keys:{axisX:x,axisY:y,action:held.a===true,alt:held.b===true,cancel:held.c===true}
   });
  }else if(round.phase==='playing'){
   player.input.axisX=x;player.input.axisY=y;
  }
 });
 conn.on('close',cleanup);conn.on('error',cleanup);
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
  const turnBootstrap=partyIceCredentialsReady();
  if(turnBootstrap){
    const initialAttempt=hostOpenAttempt,initialView=currentView;
    $('hostBtn').disabled=true;
    setStatus('กำลังเตรียมการเชื่อมต่อเครือข่าย...');
    void turnBootstrap.then(()=>{
      if(initialAttempt===hostOpenAttempt&&initialView===currentView)
        startHost(retries,resumeCode,expectedAttempt);
    });
    return;
  }
  const attempt=expectedAttempt??++hostOpenAttempt;
  if(expectedAttempt===null)resetHostReconnect();
  const code=resumeCode||randomCode();
  if(!resumeCode)deleteSession(OFFLINE_SESSION);
  $('hostBtn').disabled=true;setStatus('กำลังสร้างห้อง...');
  const peer=new Peer('gf-party-'+code,partyPeerOptions());
  hostPeer=peer;
  peer.on('open',()=>{
    if(hostPeer!==peer||attempt!==hostOpenAttempt)return;
    resetHostReconnect();
    if(onlineHost){
      setStatus('เชื่อมต่อเซิร์ฟเวอร์ห้อง '+code+' อีกครั้ง');
      return; // Preserve players, round, board HP/inventory and the game view.
    }
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
    if(conn.metadata?.kind==='gf-axis-v1'){acceptFastAxisConnection(conn);return;}
    hostConnections.add(conn);
    const ingress=createControllerIngressGuard();
    conn.on('data',msg=>{
      if(!ingress.accept(msg))return;
      if(msg.t==='join'&&!conn.playerId){
        if(!gfConnectionCompatible(msg)){
          send(conn,{t:'reject',reason:'ชุดโค้ดจอยไม่ตรงกับโฮสต์ • ออกจากห้องแล้วอัปเดตแอป',...gfConnectionHello()});
          return;
        }
        const token=typeof msg.clientToken==='string'&&msg.clientToken.length>=12&&msg.clientToken.length<=100?msg.clientToken:null;
        let p=token?players.find(q=>q.type==='remote'&&q.clientToken===token):null;
        if(p){
          cancelSeat(p.id);
          if(p.conn&&p.conn!==conn){const old=p.conn;p.conn=null;try{old.close()}catch(_){}}
          p.conn=conn;
          // Restores control after timed AI handoff in NORMAL and BOARD modes.
          // Do not reset game-specific state: same score, position and HP.
          p.isBot=false;p.input=blankInput();
          if(boardSession){const bp=boardSession.players.find(q=>q.id===p.id);if(bp)bp.isBot=false;delete boardSession.lastActions[p.id];delete boardSession.inputs[p.id];}
        }else{
          if(boardSession){send(conn,{t:'reject',reason:'BOARD PARTY กำลังเล่นอยู่ • เข้าร่วมได้เมื่อกลับล็อบบี้'});return;}
          if(players.length>=MAX_PLAYERS){send(conn,{t:'reject',reason:'ห้องเต็มแล้ว (สูงสุด '+MAX_PLAYERS+' คน)'});return;}
          p=makePlayer(msg.name,'remote',conn);
          if(!p)return;
          p.clientToken=token;
          if(round&&round.phase!=='results')p.active=false;
        }
        conn.playerId=p.id;conn.previewEnabled=false;conn.boardMinimapCapable=false;
        conn.boardMiniMapSession=null;conn.fastAxisToken=fastAxisSessionToken();
        conn.fastAxisConn=null;conn.fastAxisLastAt=0;p.lastInputAt=Date.now();
        send(conn,{t:'welcome',id:p.id,name:p.name,color:p.color,mode:round?round.mode:'ghost',phase:networkPhase(),choice:p.choice,active:p.active,axisToken:conn.fastAxisToken,
          ...gfConnectionHello(),pluginHash:round?.pluginHash||null,
          boardMapId:boardSession?.map.id||null});
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
        if(msg.enabled){
          conn.boardMinimapCapable=msg.minimap===true;
          if(round){startHostVideoCall(conn);sendBoardMiniMap(conn);}
        }
        else{conn.boardMinimapCapable=false;stopHostVideoCall(conn);}
      }else if(msg.t==='board-camera-mode'&&conn.playerId){
        const s=boardSession;
        const valid=round?.mode==='board'&&round.phase==='playing'&&!round.paused&&s&&
          msg.turnId===s.turnId&&msg.mapId===s.map.id&&
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
          msg.turnId!==s.turnId||msg.mapId!==s.map.id||
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
        send(conn,{t:'plaza-picker',open:false});
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
         if(Number.isSafeInteger(msg.actionId)&&Number.isFinite(msg.clientAt)&&
            p.lastInputAt-(conn.lastInputAckAt||0)>=250){
           conn.lastInputAckAt=p.lastInputAt;
           send(conn,{t:'input-ack',actionId:msg.actionId,clientAt:msg.clientAt});
         }
        if(Number.isSafeInteger(msg.actionId)){
          if(msg.actionId<=(conn.lastReliableActionId??-1))return;
          conn.lastReliableActionId=msg.actionId;
        }
        if(round?.mode==='board'&&boardSession){
          const locked=conn.boardCameraGestureToken===boardSession.turnId;
          const input=locked?{...msg,keys:{...msg.keys,left:false,right:false,jump:false,
            down:false,axisX:0,axisY:0,
             ...(boardSession.phase==='ready'?{action:false,alt:false,cancel:false}:{})}}:msg;
          if(conn.fastAxisConn?.open){
            // Independent server sequence prevents unordered axis updates from
            // suppressing a later reliable A/B/C button transition.
            input.actionId=(boardSession.lastActions[p.id]??-1)+1;
            if(Date.now()-(conn.fastAxisLastAt||0)<250){
              input.keys.axisX=conn.fastAxisX||0;input.keys.axisY=conn.fastAxisY||0;
            }
          }
          window.BoardParty.input(boardSession,p.id,input);return;
        }
        for(const k of INPUT_NAMES)p.input[k]=msg.keys&&msg.keys[k]===true;
        if(!(conn.fastAxisConn?.open&&Date.now()-(conn.fastAxisLastAt||0)<250)){
          p.input.axisX=Number.isFinite(msg.keys&&msg.keys.axisX)?clamp(msg.keys.axisX,-1,1):0;
          p.input.axisY=Number.isFinite(msg.keys&&msg.keys.axisY)?clamp(msg.keys.axisY,-1,1):0;
        }
      }
    });
    function lost(){
      ingress.dispose();
      if(conn.fastAxisConn)try{conn.fastAxisConn.close();}catch(_){}
      conn.fastAxisToken=null;conn.fastAxisConn=null;
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
    if(hostPeer!==peer||attempt!==hostOpenAttempt)return;
    if(onlineHost)recoverHostSignal(peer,attempt);
    else setStatus('กำลังติดต่อเซิร์ฟเวอร์ห้องเดิม...',true);
  });
  peer.on('close',()=>{
    if(hostPeer!==peer||attempt!==hostOpenAttempt)return;
    // PeerJS "close" means destroyed; never erase a live game/room because
    // the library closed after a transient network error.
    stopHostReconnect();
    setStatus('การเชื่อมต่อห้องหยุดทำงาน • สถานะเกมยังถูกเก็บไว้',true);
  });
  peer.on('error',err=>{
    if(hostPeer!==peer||attempt!==hostOpenAttempt)return;
    const type=String(err?.type||'unknown');
    const fatal=new Set(['browser-incompatible','invalid-id','invalid-key','ssl-unavailable']);
    const signaling=new Set(['network','socket-error','socket-closed','server-error','disconnected']);
    if(onlineHost){
      if(fatal.has(type)||type==='unavailable-id'||peer.destroyed){
        stopHostReconnect();
        setStatus('ไม่สามารถเชื่อมต่อห้องเดิม: '+type+' • สถานะเกมยังอยู่',true);
      }else if(peer.open&&!peer.disconnected&&!signaling.has(type)){
        // peer-unavailable, per-connection WebRTC and unknown errors do
        // not imply a lost signaling socket. Do not disrupt other clients.
        setStatus('ข้อผิดพลาดการเชื่อมต่อย่อย: '+type+' • ห้องยังเปิดอยู่',true);
      }else{
        if(!peer.disconnected)try{peer.disconnect();}catch(_){}
        recoverHostSignal(peer,attempt);
      }
      return; // No transient/fatal Peer error destroys active room or inventory.
    }
    // No players have joined yet. Retry the SAME room code, never a new ID.
    if(retries<HOST_RECONNECT_MAX&&!fatal.has(type)&&!peer.destroyed&&type!=='unavailable-id'){
      hostPeer=null;try{peer.destroy();}catch(_){}
      const delay=Math.min(16000,1000*2**retries);
      hostRetryTimeout=setTimeout(()=>{
        hostRetryTimeout=null;
        if(attempt===hostOpenAttempt)startHost(retries+1,code,attempt);
      },Math.round(delay*(1+Math.random()*.2)));
      setStatus('กำลังคืนห้องเดิม ('+(retries+1)+'/'+HOST_RECONNECT_MAX+')',true);
      return;
    }
    // An initial unrecoverable ID cannot yet have active WebRTC channels;
    // still keep any restored room snapshot for manual recovery.
    stopHostReconnect();
    if(type==='unavailable-id'&&retries<HOST_RECONNECT_MAX){
      hostPeer=null;try{peer.destroy();}catch(_){}
      hostRetryTimeout=setTimeout(()=>{
        hostRetryTimeout=null;
        if(attempt===hostOpenAttempt)startHost(retries+1,code,attempt);
      },1200+retries*350);
      return;
    }
    $('hostBtn').disabled=false;
    setStatus('เชื่อมต่อห้อง '+code+' ไม่สำเร็จ: '+type,true);
  });
}
function copyInvite(){
  const value=$('roomUrl').value;if(!value)return;
  const done=()=>{const b=$('copyBtn');b.textContent='คัดลอกแล้ว';setTimeout(()=>b.textContent='คัดลอกลิงก์',1600);};
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(value).then(done).catch(()=>{ $('roomUrl').select();document.execCommand('copy');done();});}
  else{$('roomUrl').select();document.execCommand('copy');done();}
}
let phoneSelectionOpen=false;
let plazaPickerOpen=false;
let myChosenMode=null;
