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
function recoverMinigameLoadFailure(mode,error){
 const reason=String(error?.message||error||'unknown').slice(0,90);
 // An unavailable game must never strand the active BOARD session or force
 // a skipped round when another already-verified minigame can run.
 if(boardSession?.phase==='minigame'){
  const failed=boardSession.failedMinigames||(boardSession.failedMinigames=new Set());
  failed.add(mode);
  const platform=window.GamePlatform;
  const alternatives=platform?.games('board').filter(game=>
   !failed.has(game.id)&&platform.ready(game.id)&&
   boardSession.players.length>=game.players.min&&
   boardSession.players.length<=game.players.max) || [];
  if(alternatives.length){
   const fallback=alternatives.find(game=>game.id!==boardSession.lastMinigame)||alternatives[0];
   boardSession.lastMinigame=fallback.id;
   showToast('เกม '+(MODES[mode]||mode)+' โหลดไม่สำเร็จ • เปลี่ยนเป็น '+fallback.name,true);
   beginGameSelection(fallback.id);
   if(gameSelection)return;
  }
  if(window.BoardParty?.minigameCancelled?.(boardSession)){
   showBoard();
   showToast('ข้าม '+(MODES[mode]||mode)+' • ยังไม่มีมินิเกมที่โหลดได้: '+reason,true);
   return;
  }
 }
 returnToLobby();
 showToast('โหลดมินิเกมไม่สำเร็จ: '+reason,true);
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
  if(platform&&(!!window.GAME_CORE_HASH||platform.descriptor(mode))&&
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
      gameSelection=null;
      recoverMinigameLoadFailure(selection.mode,selection.error);return;
    }
    if(!selection.ready){
      $('rouletteMessage').textContent='กำลังเตรียมเกมเวอร์ชันล่าสุด…';return;
    }
    const mode=selection.mode;
    gameSelection=null;
    $('gameRoulette').classList.add('hidden');
    startRound(mode);
    if(!round)recoverMinigameLoadFailure(mode,Error('Game setup failed'));
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
  if(selectedSessionMode==='board')prewarmBoardCore();
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
$('joinBtn').addEventListener('click',()=>{
 // Screen Orientation/fullscreen requests require the original user gesture,
 // before asynchronous PeerJS and TURN handshakes consume it.
 void requestLandscape();
 joinRoom();
});
$('nick').addEventListener('input',rememberNickname);
$('nick').addEventListener('keydown',e=>{if(e.key==='Enter'){void requestLandscape();joinRoom();}});
$('roomCodeInput').addEventListener('input',()=>{
  $('roomCodeInput').value=$('roomCodeInput').value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);
});
$('roomCodeInput').addEventListener('keydown',e=>{if(e.key==='Enter'){void requestLandscape();joinRoom();}});
$('switchRoomBtn').addEventListener('click',()=>{
  resetControllerForRoomChange('เปลี่ยนห้องในแท็บเดิมได้เลย สแกน QR หรือกรอกรหัสใหม่');
});
renderModeChoices();
window.addEventListener('gameplatform:catalog',syncGameCatalog);
syncGameCatalog();
function onPhoneGamePick(mode){
  if(!phoneSelectionOpen||!controllerReady||!modesFor('normal').includes(mode))return;
  plazaPickerOpen=false;updatePhoneGamePicker('lobby',mode);
  send(controllerConn,{t:'pick',mode});
}
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
        if(controllerMediaCall)activateControllerVideoIfReady(controllerMediaCall);
      }).catch(()=>{});
    }catch(_){}
  }
});
// Coalesce BOARD camera gesture deltas into at most one update per paint.
 let pendingCameraGesture=null,cameraGestureFrame=0;
 const flushCameraGesture=()=>{
  cameraGestureFrame=0;
  const packet=pendingCameraGesture;pendingCameraGesture=null;
  if(!packet||!controllerReady||!controllerConn?.open||!boardCameraController?.enabled())return;
  send(controllerConn,{t:'board-camera-gesture',...packet,
    turnId:controllerBoard?.turnId,mapId:controllerBoard?.mapId});
 };
 const queueCameraGesture=gesture=>{
  if(pendingCameraGesture&&pendingCameraGesture.kind===gesture.kind){
   if(gesture.kind==='pan'){
    pendingCameraGesture.dx=clamp(pendingCameraGesture.dx+gesture.dx,-320,320);
    pendingCameraGesture.dy=clamp(pendingCameraGesture.dy+gesture.dy,-240,240);
   }else pendingCameraGesture.scale=clamp(pendingCameraGesture.scale*gesture.scale,.75,1.35);
  }else{
   if(pendingCameraGesture)flushCameraGesture();
   pendingCameraGesture={...gesture};
  }
  if(!cameraGestureFrame)cameraGestureFrame=requestAnimationFrame(flushCameraGesture);
 };
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
  isRotated:()=>isPortraitScreen()&&(document.body.classList.contains('portrait-fallback')||usesVirtualLandscape()),
  releaseStick:()=>releaseStick(),
  onMode:(enabled,notify)=>{
    $('boardCameraModeHint').classList.toggle('hidden',!enabled);
    if(!enabled)pendingCameraGesture=null;
     if(controllerBoard?.boardPhase==='ready')renderPhoneBoard();
    if(notify&&controllerConn?.open)
      send(controllerConn,{t:'board-camera-mode',enabled,
        turnId:controllerBoard?.turnId,mapId:controllerBoard?.mapId});
  },
  onGesture:gesture=>{
    if(!controllerReady||!controllerConn?.open)return;
    queueCameraGesture(gesture);
  }
});
setInterval(sendInputs,100);
window.addEventListener('beforeunload',()=>{
  void stopRoomScanner();safePeerDestroy();
  try{if(controllerChannel)controllerChannel.close();}catch(_){}
  stopHostReconnect();
  if(hostPeer)hostPeer.destroy();
});

