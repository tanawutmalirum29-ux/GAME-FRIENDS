function renderLeaderboard(){
  const root=$('leaderboard');root.replaceChildren();
  const active=round?players.filter(p=>p.active):[];
  const count=Math.max(1,active.length);
  root.style.setProperty('--leader-count',String(count));
  root.style.setProperty('--leader-cols',String(Math.min(12,count)));
  root.style.setProperty('--leader-cols-compact',String(Math.min(6,count)));
  root.style.setProperty('--leader-rows','1');
  if(!round||round.mode==='board')return;
  const engine=round.pluginEngine||gameEngine(round.mode);
  // The active round pins a game engine. Its own roster renderer owns any
  // special item SVG, elimination banner or score metric; the Core does not
  // need to know the game's ID.
  if(typeof engine?.renderRoster==='function'){
    engine.renderRoster(root,active,round);
    return;
  }
  // Native plug-ins without a bespoke renderer use their optional getRoster()
  // data. An unknown ID receives a proper live score, never the Ghost HUD.
  const incoming=typeof engine?.getRoster==='function'?engine.getRoster(round,active):null;
  const entries=new Map(Array.isArray(incoming)?incoming.filter(item=>
    item&&typeof item.id==='string').map(item=>[item.id,item]):[]);
  const scoreOf=p=>{
    const item=entries.get(p.id);
    const amount=Number(item?.value);
    return Number.isFinite(amount)?amount:Number(p.score)||0;
  };
  active.sort((a,b)=>scoreOf(b)-scoreOf(a)||String(a.id).localeCompare(String(b.id)));
  for(const p of active){
    const item=entries.get(p.id);
    const box=document.createElement('div');box.className='leader-chip';
    if(item?.eliminated===true)box.classList.add('shockwave-eliminated');
    const dot=document.createElement('span');dot.className='circle';dot.style.background=p.color;
    const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;
    const metric=document.createElement('small');metric.className='leader-role';
    metric.textContent=typeof item?.label==='string'?item.label:scoreOf(p)+' คะแนน';
    const status=document.createElement('span');status.className='leader-item-slot';
    status.textContent=typeof item?.status==='string'?item.status:'';
    box.append(dot,name,metric,status);root.append(box);
  }
}
// All minigame clocks and survivor counts are painted ONLY here, after engines
// finish their scene: one badge, one position, no in-engine duplicates.
// SHOCKWAVE intentionally never displays a numerical warning timer.
function hostClockValue(r,engine){
  if(!r||r.mode==='board')return null;
  // Game-owned display policy replaces per-game mode checks in shared HUD.
  const badge=engine?.hudBadge||{};
  if(r.phase==='countdown'){
    if(badge.duringCountdown==='players')return null;
    return Number.isFinite(r.countdown)?Math.max(0,r.countdown):null;
  }
  if(r.phase!=='playing'||badge.duringPlay==='players')return null;
  // Elapsed time is NOT a countdown: multiplayer survival shows the live
  // headcount instead. Solo survival still uses round.remaining above.
  return Number.isFinite(r.remaining)?Math.max(0,r.remaining):null;
}
function drawGame(t){
  if(!round)return;
  syncArenaResolution();
  const engine=gameEngine(round.mode);
  engine.draw(g,t,round,players);
  if(round.mode==='board')return; // BOARD PARTY has a separate HUD.
  const seconds=hostClockValue(round,engine);
  if(seconds!==null){
    window.PartyArenaScenes?.clock?.(g,seconds);
  }else if(round.phase==='playing'||
    (round.phase==='countdown'&&engine?.hudBadge?.duringCountdown==='players')){
    // No countdown: use only the shared SVG person and survivor total.
    const survivors=engine.hud?.(players,round)?.survivors;
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
