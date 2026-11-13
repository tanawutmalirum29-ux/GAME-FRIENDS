function finishBoard(){
  round.phase='results';round.paused=false;resetInputs();renderBotTestPad();
  $('pauseBtn').classList.add('hidden');
  refreshBoardTools();
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
  round={mode,pluginEngine:engine,pluginHash:window.GamePlatform?.descriptor(mode)?.hash||null,phase:'countdown',paused:false,countdown:Number.isFinite(engine.countdownSeconds)?engine.countdownSeconds:3,remaining:null,autoNextRemaining:0,
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
  $('results').querySelector('h2').textContent=engine.resultTitle||'ผลการแข่งขัน';
  // Countdown and player count now live in the solid map-corner HUD.
  $('gameBanner').textContent='';
  $('replayBtn').textContent=tournament?'เกมถัดไป':'เล่นอีกครั้ง';
  $('pauseMenu').classList.add('hidden');
  $('pauseBtn').classList.remove('hidden');
  $('pauseBtn').setAttribute('aria-expanded','false');
  setView('game');
  // An active BOARD minigame is not the board map.
  refreshBoardTools();
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
    if(round.pluginEngine?.updateDuringCountdown)round.pluginEngine.update(dt,round,players);
    round.countdown=Math.max(0,round.countdown-dt);
    $('gameBanner').textContent='';
    if(round.countdown===0){
      round.phase='playing';
      round.pluginEngine?.onCountdownFinished?.(round,players);
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
