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
