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
      await platform.ensure(mode);
      selection.ready=true;
    })().catch(error=>{selection.error=error;});
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
$('backBtn').addEventListener('click',onResultBack);
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

