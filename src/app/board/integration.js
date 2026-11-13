
 // BOARD controller minimap: immutable road topology once per board session,
 // then at most twelve lightweight live positions at roughly 12 Hz.
 let boardMiniMapClock=0,boardMiniMapCache=null;
 function boardMiniMapTopology(){
   const s=boardSession;if(!s)return null;
   if(boardMiniMapCache?.session===s.id)return boardMiniMapCache;
   const ids=Object.keys(s.map.nodes),byId=new Map(ids.map((id,i)=>[id,i]));
   const nodes=ids.map(id=>{
     const p=s.map.nodes[id].position;
     return [Math.round(p.x),Math.round(p.y)];
   });
   const links=[];
   for(const [i,id] of ids.entries())for(const next of s.map.nodes[id].nextNodes)
     if(byId.has(next))links.push([i,byId.get(next)]);
   boardMiniMapCache={session:s.id,
     packet:{t:'board-minimap-map',session:s.id,mapId:s.map.id,
       width:s.map.width,height:s.map.height,nodes,links}};
   return boardMiniMapCache;
 }
 // BOARD positions are identical for all connected controllers. Build the
 // immutable packet once per simulation tick instead of once per remote peer.
 let boardPositionCache=null,boardLastPositionKey='',boardLastPositionAt=0;
 function boardMiniMapPositions(s){
   if(boardPositionCache?.session===s.id&&boardPositionCache.time===s.time&&
      boardPositionCache.turnId===s.turnId)return boardPositionCache.packet;
   const active=window.BoardParty.current(s);
   const packet={t:'board-minimap-positions',session:s.id,turnId:s.turnId,
     activeId:active?.id||null,
     players:s.players.map(p=>{
       const v=window.BoardItems.position(s,p);
       return [p.id,Math.round(v.x),Math.round(v.y),p.color];
     })};
   boardPositionCache={session:s.id,time:s.time,turnId:s.turnId,packet};
   return packet;
 }
 function sendBoardMiniMap(conn,positions=null){
   const s=boardSession;
   if(!s||round?.mode!=='board'||!conn?.open||!conn.playerId||
      conn.previewEnabled!==true||conn.boardMinimapCapable!==true)return;
   // Never queue stale minimap frames ahead of actual controller state.
   if((conn.dataChannel?.bufferedAmount||0)>32768)return;
   const cache=boardMiniMapTopology();
   if(conn.boardMiniMapSession!==cache.session){
     send(conn,cache.packet);
     conn.boardMiniMapSession=cache.session;
   }
   send(conn,positions||boardMiniMapPositions(s));
 }
 function broadcastBoardMiniMap(dt){
   boardMiniMapClock+=Math.min(.1,Math.max(0,Number(dt)||0));
   if(boardMiniMapClock<1/12)return;
   boardMiniMapClock=0;
   const s=boardSession;
   if(!s||round?.mode!=='board')return;
   const observers=[...hostConnections].filter(conn=>
     conn.open&&conn.playerId&&conn.previewEnabled===true&&
     conn.boardMinimapCapable===true);
   if(!observers.length)return;
   const packet=boardMiniMapPositions(s);
   const key=JSON.stringify([packet.session,packet.turnId,packet.activeId,packet.players]);
   // A turn-based BOARD is often completely still for seconds. Keep a 1 Hz
   // heartbeat, but preserve ~12 Hz whenever a player actually moves.
   if(key===boardLastPositionKey&&s.time-boardLastPositionAt<1)return;
   boardLastPositionKey=key;boardLastPositionAt=s.time;
   for(const conn of observers)sendBoardMiniMap(conn,packet);
 }
 let phoneMiniMap=null,phoneMiniMapPositions=null;
 function showPhoneMiniMap(){
   const visible=controllerPreviewEnabled&&controllerGameMode==='board'&&!!phoneMiniMap;
   const canvas=$('controllerBoardMinimap');
   canvas.classList.toggle('hidden',!visible);
   if(!visible)return;
   $('controllerPreviewImage').classList.add('hidden');
   $('controllerPreviewVideo').classList.add('hidden');
   $('controllerPreviewPlaceholder').classList.add('hidden');
   renderPhoneMiniMap();
 }
 function receivePhoneMiniMapMap(packet){
   if(!packet||typeof packet.session!=='string'||packet.session.length>120||
      !Array.isArray(packet.nodes)||packet.nodes.length>600||
      !Array.isArray(packet.links)||packet.links.length>1000||
      !Number.isFinite(packet.width)||!Number.isFinite(packet.height)||
      packet.width<=0||packet.height<=0||packet.width>100000||packet.height>100000)return;
   if(!packet.nodes.every(n=>Array.isArray(n)&&n.length===2&&n.every(v=>
      Number.isFinite(v)&&v>=0&&v<=100000)))return;
   if(!packet.links.every(l=>Array.isArray(l)&&l.length===2&&l.every(i=>
      Number.isSafeInteger(i)&&i>=0&&i<packet.nodes.length)))return;
   phoneMiniMap={session:packet.session,width:packet.width,height:packet.height,
      nodes:packet.nodes,links:packet.links};
   phoneMiniMapPositions=null;showPhoneMiniMap();
 }
 function receivePhoneMiniMapPositions(packet){
   if(!phoneMiniMap||packet?.session!==phoneMiniMap.session||
      !Array.isArray(packet.players)||packet.players.length>12||
      !packet.players.every(p=>Array.isArray(p)&&p.length===4&&
        typeof p[0]==='string'&&p[0].length<50&&
        Number.isFinite(p[1])&&Number.isFinite(p[2])&&
        typeof p[3]==='string'&&/^#[a-fA-F0-9]{6}$/.test(p[3])))return;
   phoneMiniMapPositions=packet;
   showPhoneMiniMap();
 }
 function renderPhoneMiniMap(){
   const canvas=$('controllerBoardMinimap'),map=phoneMiniMap;
   if(!map||!canvas||typeof canvas.getContext!=='function')return;
   const ctx=canvas.getContext('2d');
   if(!ctx)return;
   const w=canvas.width,h=canvas.height;
   ctx.fillStyle='#0b1927';ctx.fillRect(0,0,w,h);
   const players=phoneMiniMapPositions?.players||[];
   const mine=players.find(p=>p[0]===controllerId);
   // Follow the local player without requiring full-board JPEG retransmission.
   const worldW=Math.min(map.width,Math.max(1150,map.width*.37));
   const worldH=Math.min(map.height,Math.max(670,map.height*.37));
   const focusX=mine?.[1]??map.width/2,focusY=mine?.[2]??map.height/2;
   const left=Math.max(0,Math.min(map.width-worldW,focusX-worldW/2));
   const top=Math.max(0,Math.min(map.height-worldH,focusY-worldH/2));
   const scale=Math.min((w-16)/worldW,(h-16)/worldH);
   const originX=(w-worldW*scale)/2,originY=(h-worldH*scale)/2;
   const project=(x,y)=>[originX+(x-left)*scale,originY+(y-top)*scale];
   ctx.beginPath();
   ctx.strokeStyle='#728ba3';ctx.lineWidth=2.5;ctx.lineCap='round';
   for(const [a,b] of map.links){
     const u=map.nodes[a],v=map.nodes[b];
     if(Math.max(u[0],v[0])<left||Math.min(u[0],v[0])>left+worldW||
        Math.max(u[1],v[1])<top||Math.min(u[1],v[1])>top+worldH)continue;
     const [x,y]=project(u[0],u[1]),[x2,y2]=project(v[0],v[1]);
     ctx.moveTo(x,y);ctx.lineTo(x2,y2);
   }
   ctx.stroke();
   ctx.fillStyle='#d5e8e9';
   for(const n of map.nodes){
     if(n[0]<left||n[0]>left+worldW||n[1]<top||n[1]>top+worldH)continue;
     const [x,y]=project(...n);
     ctx.beginPath();ctx.arc(x,y,1.8,0,Math.PI*2);ctx.fill();
   }
   for(const p of players){
     const [x,y]=project(p[1],p[2]);
     if(x<0||x>w||y<0||y>h)continue;
     const own=p[0]===controllerId,active=p[0]===phoneMiniMapPositions.activeId;
     ctx.beginPath();ctx.fillStyle=p[3];ctx.arc(x,y,own?8:5.8,0,Math.PI*2);ctx.fill();
     ctx.strokeStyle=own?'#ffffff':active?'#ffe49a':'#142536';
     ctx.lineWidth=own?2.5:2;ctx.stroke();
   }
   ctx.fillStyle='#eaf8ff';ctx.font='bold 12px system-ui';
   ctx.fillText('BOARD • ตำแหน่งสด',9,17);
   ctx.font='10px system-ui';ctx.fillText(players.length+'/12',w-38,17);
 }
function boardRegistry(){return Object.fromEntries(modesFor('board').map(id=>{
 const platform=window.GamePlatform,d=platform?.descriptor(id);
 if(d&&(players.length<d.players.min||players.length>d.players.max))return [id,null];
 const engine=gameEngine(id);
 if(engine&&(!d||platform.ready(id)))return [id,engine];
 if(!d)return [id,engine];
 const unavailable=()=>{throw Error('Minigame not preloaded: '+id);};
 return [id,{minPlayers:d.players.min,maxPlayers:d.players.max,
  setup:unavailable,update:unavailable,draw:unavailable}];
}));}
// Prefetch minigame engines during the BOARD session, not on the initial PWA
// route. A single in-flight download avoids starving low-bandwidth controllers.
let boardWarmBusy=false,boardWarmTimer=null;
function warmBoardGames(){
 const platform=window.GamePlatform;
 if(!platform?.revision||round?.mode!=='board'||!boardSession||
    document.hidden||navigator?.connection?.saveData||gameSelection||
    boardWarmBusy||boardWarmTimer!==null)return;
 const rejected=new Set(platform.getRejected?.().map(r=>r.id)||[]);
 const candidates=platform.games('board').filter(g=>
  players.length>=g.players.min&&players.length<=g.players.max&&
  !platform.ready(g.id)&&!rejected.has(g.id));
 if(!candidates.length)return;
 boardWarmBusy=true;
 void platform.ensure(candidates[0].id)
  .catch(error=>console.warn('Board game prewarm unavailable: '+candidates[0].id,error))
  .finally(()=>{
    boardWarmBusy=false;
    if(round?.mode==='board'&&boardSession&&!document.hidden){
      boardWarmTimer=setTimeout(()=>{boardWarmTimer=null;warmBoardGames();},12000);
    }
  });
}
function prewarmBoardCore(){
 const core=window.BoardRuntime;
 if(selectedSessionMode!=='board'||boardSession||round||!core||core.ready())return;
 // The on-demand loader deduplicates script requests; clicking Start attaches
 // its own completion callback to the SAME promise.
 void core.ensure().catch(error=>console.warn('BOARD prewarm unavailable',error));
}
let boardCatalogPending=false,boardCorePending=null;
function beginBoard(){
  const platform=window.GamePlatform;
  // Production no longer downloads legacy minigame engines at initial page load.
  // Wait for the versioned registry rather than mistaking them for missing games.
  if(window.GAME_CORE_HASH&&platform&&!platform.revision){
    if(boardCatalogPending)return;
    boardCatalogPending=true;
    void platform.refresh().then(()=>{
      boardCatalogPending=false;
      if(currentView!=='hostLobby'||selectedSessionMode!=='board'||!players.length)return;
      if(platform.revision)beginBoard();
      else showToast('กำลังรอรายชื่อมินิเกมจากเซิร์ฟเวอร์',true);
    }).catch(error=>{
      boardCatalogPending=false;
      showToast('โหลดรายชื่อมินิเกมไม่สำเร็จ: '+String(error?.message||error).slice(0,100),true);
    });
    return;
  }
  // Fetch BOARD core only for BOARD; preserve the idle lobby while loading.
  const core=window.BoardRuntime;
  if(core&&!core.ready()){
    if(boardCorePending)return boardCorePending;
    showToast('กำลังเตรียม BOARD PARTY • เปิดเกมให้อัตโนมัติเมื่อพร้อม');
    const sessionMode=selectedSessionMode;
    boardCorePending=core.ensure().then(()=>{
      boardCorePending=null;
      if(currentView==='hostLobby'&&!round&&!boardSession&&players.length&&
         selectedSessionMode===sessionMode)return beginBoard();
    }).catch(error=>{
      boardCorePending=null;
      console.error('BOARD PARTY asset load failed',error);
      showToast('โหลด BOARD PARTY ไม่สำเร็จ: '+String(error?.message||error).slice(0,100),true);
    });
    return boardCorePending;
  }
  const required=['BoardMap','BoardDice','BoardItems','BoardBots','BoardMinigame','BoardParty','BoardArt','PartyPlayerAvatar'];
  if(required.some(name=>!window[name])){showToast('โหลด BOARD PARTY ไม่ครบ กรุณาโหลดหน้าใหม่',true);return;}
  if(!window.BoardMinigame.eligible(boardRegistry(),players.length).length){showToast('ไม่มีมินิเกมที่พร้อมเล่น',true);return;}
  try{
    tournament=null;gameSelection=null;
    boardSession=window.BoardParty.create(players);
    // BOARD makes its own player copies: pass visual wardrobe identity through
    // without modifying the generated BOARD engine or its gameplay rules.
    for(const bp of boardSession.players){
      const original=players.find(p=>p.id===bp.id);
      bp.cosmetic=window.PartyCosmetics?.normalize?.(original?.cosmetic)||'none';
    }
     boardMiniMapCache=null;boardMiniMapClock=0;
    boardSession.camera.lowDetail=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
     boardSession.camera.manualDetail=boardSession.camera.lowDetail;
     boardSession.camera.autoDetailEngaged=false;
    window.BoardArt.overview(boardSession);
    players.forEach(p=>{p.active=true;});
    window.PartyPlayerAvatar.preload(boardSession.players);
    showBoard();warmBoardGames();requestHostFullscreen();
  }catch(error){
    console.error('BOARD PARTY start failed',error);returnToLobby();
    showToast('เริ่ม BOARD PARTY ไม่สำเร็จ: '+String(error?.message||error).slice(0,100),true);
  }
}
// Host-screen zoom requires a local human in their OWN BOARD turn; remote
// players zoom only from their authenticated phones.
function hostCanControlBoardZoom(){
 const s=boardSession,p=s&&window.BoardParty?.current(s);
 return !!(round?.mode==='board'&&round.phase==='playing'&&p&&
   (players.some(q=>q.id===p.id&&q.type==='local'&&!q.isBot)||s.players.every(q=>q.isBot))&&
   window.BoardArt?.canPan?.(s));
}
// The three BOARD controls belong only to the live map, never to its
// standings/rewards, dice-order overlay, roulette or a minigame.
const BOARD_MAP_TOOL_PHASES=new Set([
 'overview','intro_zoom','round_order','ready','dice','move_ready',
 'branch','moving','aim','car','rocket','lucky_roulette','effect','returning'
]);
function boardMapToolsActive(){
 return currentView==='game'&&round?.mode==='board'&&round.phase==='playing'&&
  !!boardSession&&!gameSelection&&BOARD_MAP_TOOL_PHASES.has(boardSession.phase);
}
function refreshBoardTools(){
 const active=boardMapToolsActive();
 $('boardTools').classList.toggle('hidden',!active);
 // Exit must be available during normal BOARD play, not only while paused.
 $('boardExitBtn').classList.toggle('hidden',!active);
 // Normal-party pause is independent. During BOARD and its nested minigame
 // these three controls must share the exact same map-only visibility.
 if(boardSession||round?.mode==='board')
  $('pauseBtn').classList.toggle('hidden',!active);
 if(active){
  // Debug overlays are local to the Host and never change BOARD rules or
  // network state. Leave the ID button visible in human and bot rooms.
  $('boardNodeDebugBtn').setAttribute('aria-pressed',String(!!boardSession.camera.debugNodes));
 }
 if(active&&round.paused){
  $('pauseBtn').title='เล่นต่อ';$('pauseBtn').setAttribute('aria-label','เล่นต่อ');
  $('pauseBtn').classList.add('board-resume');
 }else{
  $('pauseBtn').title='หยุดเกม';$('pauseBtn').setAttribute('aria-label','หยุดเกม');
  $('pauseBtn').classList.remove('board-resume');
 }
}
function showBoard(){
  round={mode:'board',phase:'playing',paused:false,remaining:null,autoNextRemaining:0};
  resetInputs();boardStateToken=null;
  $('gameRoulette').classList.add('hidden');$('results').classList.add('hidden');
  $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.remove('hidden');
  $('boardExitBtn').classList.remove('hidden');
  $('pauseBtn').setAttribute('aria-expanded','false');$('gameBanner').textContent='';
  document.body.classList.add('board-playing');
  setView('game');
  // Paint the order/result screen in the Start event itself. Safari can delay
  // its first animation frame during fullscreen; old minigame clips must not survive.
  canvas.width=canvas.width;markArenaResolutionDirty();refreshBoardTools();drawGame(graphicsClock);
  renderLeaderboard();broadcastRoster();renderBotTestPad();
  remotePreviewClock=1.1;
  for(const conn of hostConnections){startHostVideoCall(conn);sendBoardMiniMap(conn);}
}
function updateBoard(dt){
  const s=boardSession;if(!s||round.phase==='results')return;
  const previousToolbarPhase=s.phase;
  // Local human keys follow the same sequence- and turn-checked path.
  for(const p of players.filter(p=>p.type==='local'&&!p.isBot)){
    const keys={...p.input,axisX:p.input.axisX||Number(p.input.right)-Number(p.input.left),axisY:p.input.axisY||Number(p.input.down)-Number(p.input.jump)};
    window.BoardParty.input(s,p.id,{turnId:s.turnId,actionId:(s.lastActions[p.id]??0)+1,keys});
  }
  // Board is turn-based: catch up to elapsed wall-clock time in short,
  // bounded steps. Never let low FPS stretch control timeouts indefinitely.
  let pending=Math.max(0,Math.min(1,Number(dt)||0));
  for(let ticks=0;ticks<20&&pending>1e-6;ticks++){
    const step=Math.min(.05,pending);
    window.BoardParty.update(s,step);
    pending-=step;
    if(s.phase==='minigame_pending'||s.phase==='minigame'||s.phase==='finished')break;
  }
  // DOM updates only when a BOARD phase changes. Canvas overlay phases
  // must immediately hide the previous map's Exit/ID/Pause controls.
  if(s.phase!==previousToolbarPhase)refreshBoardTools();
   if(s.phase==='minigame_pending'){
    const mode=window.BoardMinigame.pick(boardRegistry(),s.players.length,s.lastMinigame,s.rng);
    if(!mode)throw Error('No compatible minigame');
    s.savedBoard=window.BoardParty.snapshot(s);
    s.failedMinigames=new Set();
    if(window.BoardParty.minigameStarted(s,mode))beginGameSelection(mode);
    return;
  }
  if(s.phase==='finished'){if(s.time-s.phaseAt>=1.8)finishBoard();return;}
  boardStateClock+=dt;
  const stateKey=s.turnId+':'+s.phase+':'+window.BoardParty.remainingSteps(s,window.BoardParty.current(s)?.id);
  if(boardStateToken!==stateKey||boardStateClock>.2){broadcastBoardState();boardStateClock=0;boardStateToken=stateKey;}
  broadcastBoardMiniMap(dt);
}
function broadcastBoardState(){
  if(!boardSession||round?.mode!=='board')return;
  for(const conn of hostConnections){
    // Send controller metadata once for this board, not with every live frame.
    if(conn.boardItemMetaSession!==boardSession.id){
      send(conn,{t:'board-item-meta',sessionId:boardSession.id,
        ids:window.BoardItems.ids.slice(),
        names:Object.fromEntries(window.BoardItems.ids.map(id=>[id,window.BoardItems.names[id]||id]))});
      conn.boardItemMetaSession=boardSession.id;
    }
    const p=boardSession.players.find(p=>p.id===conn.playerId);if(!p)continue;
    send(conn,{t:'board-state',sessionId:boardSession.id,mapId:boardSession.map.id,phase:networkPhase(),turnId:boardSession.turnId,boardPhase:boardSession.phase,
      round:boardSession.roundNumber,hp:p.hp,usedRound:p.usedRound||0,stepsRemaining:window.BoardParty.remainingSteps(boardSession,p.id),shieldTurns:window.BoardParty.isProtected(boardSession,p)?1:0,
      canZoom:round.phase==='playing'&&!round.paused&&window.BoardParty.current(boardSession)?.id===p.id&&
        window.BoardArt.canPan(boardSession),
      item:window.BoardItems.names[p.item]||'ไม่มีไอเทม',
      bag:window.BoardItems.bag(p).slice(),actionIndex:p.actionIndex||0,bagMessage:p.bagMessage||'',
      ...window.BoardParty.controls(boardSession,p.id)});
  }
}
let phoneBoardItemMeta=null;
function validBoardItemMeta(packet){
 if(!packet||typeof packet.sessionId!=='string'||packet.sessionId.length>120||
    !Array.isArray(packet.ids)||packet.ids.length<6||packet.ids.length>60||
    new Set(packet.ids).size!==packet.ids.length||
    !packet.ids.every(id=>typeof id==='string'&&/^[a-z][a-z0-9-]*$/.test(id))||
    !packet.names||typeof packet.names!=='object'||Array.isArray(packet.names))return false;
 return packet.ids.every(id=>Object.hasOwn(packet.names,id)&&
  typeof packet.names[id]==='string'&&packet.names[id].length>0&&packet.names[id].length<=80);
}
function receiveBoardItemMeta(packet){
 if(!validBoardItemMeta(packet))return;
 phoneBoardItemMeta={sessionId:packet.sessionId,ids:packet.ids.slice(),
  names:Object.fromEntries(packet.ids.map(id=>[id,packet.names[id]]))};
 if(controllerBoard?.sessionId===packet.sessionId)renderPhoneBoard();
}
function receiveBoardState(info){
  const previousToken=controllerBoard?.turnId;
  controllerBoard=info;setControllerGameContext('board',info.phase,true);
  if(info.phase!=='results')renderPhoneBoard();
  // A release sent with the previous token may have been rejected by the host.
  // Resend the physical button/stick state as soon as the new control phase arrives.
  if(info.phase==='playing'&&info.turnId!==previousToken)sendInputs();
}
function renderPhoneBoard(){
 const info=controllerBoard;if(!info||controllerGameMode!=='board')return;
 $('buttonA').disabled=false;$('buttonB').disabled=false;
 for(const cls of ['chickens-mode','fruit-memory-mode','color-switch-mode','shockwave-mode','has-target'])$('controllerButtons').classList.remove(cls);
 // The existing on-screen C button cancels either UFO or bomber targeting.
 // Reuse the aim-layout class so the control stays visible on narrow phones.
 const itemAim=info.boardPhase==='aim'&&info.c==='ยกเลิก';
 $('controllerButtons').classList.toggle('board-bomber-aim',itemAim);
 $('buttonC').disabled=!itemAim;
 $('buttonCLabel').textContent=itemAim?'ยกเลิก':'';
 $('buttonC').setAttribute('aria-label',itemAim?'C ยกเลิกการเล็งไอเทม':'C');
 $('targetCycleControls').classList.add('hidden');
 for(const id of ['buttonA','buttonB']){$(id).classList.remove('cooldown-active','color-boost-ready');$(id).style.removeProperty('--cooldown-sweep');}
 $('controllerModeName').textContent='BOARD PARTY • ROUND '+info.round;
 $('buttonALabel').textContent=info.a||'';$('buttonBLabel').textContent=info.b||'';
 $('buttonA').setAttribute('aria-label','A '+(info.a||''));$('buttonB').setAttribute('aria-label','B '+(info.b||''));
 $('controllerHelp').textContent=info.boardPhase==='ready'&&boardCameraController?.enabled()?
    'ดูแผนที่ • ลากจอยเพื่อเลื่อน / หุบกางเพื่อซูม • ดับเบิลแท็บเพื่อกลับกระเป๋า':info.help||'';
 $('controllerInventory').classList.toggle('hidden',controllerGamePhase!=='playing'||
   (info.boardPhase==='ready'&&!!boardCameraController?.enabled()));
 const bag=Array.isArray(info.bag)?info.bag:[],ready=info.boardPhase==='ready';
 const items=phoneBoardItemMeta&&phoneBoardItemMeta.sessionId===info.sessionId?
  phoneBoardItemMeta:window.BoardItems||window.PartyBoardItemMeta;
 if(!items){$('controllerState').textContent='กำลังโหลดข้อมูลกระเป๋าเกม...';return;}
 const options=['roll',...items.ids],stock=Object.fromEntries(items.ids.map(id=>[id,0]));
 for(const id of bag)if(Object.hasOwn(stock,id))stock[id]++;
 const selected=ready&&Number.isInteger(info.actionIndex)?Math.max(0,Math.min(options.length-1,info.actionIndex)):0;
 $('controllerRole').textContent='HP '+info.hp+'/100 • เหลือ '+(info.stepsRemaining||0)+' ก้าว • ไอเทม '+bag.length+' ชิ้น'+(info.shieldTurns?' • โล่ป้องกัน':'');
 const host=$('inventoryItem');host.classList.remove('pizza-order-icons','board-bag-icons');host.replaceChildren();
 host.classList.add('board-bag-icons');
 const svg=window.PartyUiArt,doc=host.ownerDocument||document;
 const rollIcon='<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="7" width="22" height="22" rx="5" fill="#fff4dc" stroke="#d2a85b" stroke-width="2"/><rect x="24" y="18" width="20" height="20" rx="5" fill="#f9f5ec" stroke="#d2a85b" stroke-width="2"/><g fill="#4c5e73"><circle cx="10" cy="13" r="2.5"/><circle cx="20" cy="23" r="2.5"/><circle cx="30" cy="24" r="2.5"/><circle cx="38" cy="32" r="2.5"/></g></svg>';
 for(let i=0;i<options.length;i++){
   const id=options[i],qty=id==='roll'?null:stock[id],cell=doc.createElement('span');
   const locked=id!=='roll'&&info.usedRound===info.round;
   cell.className='board-bag-item'+(qty===0?' is-empty':'')+(locked?' is-locked':'')+(ready&&i===selected&&!locked&&qty!==0?' is-selected':'');
   cell.innerHTML=id==='roll'?rollIcon:svg?.svg(id)||'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true"><path fill="#9bdad6" stroke="#357382" stroke-width="3" d="M24 3 44 13v22L24 45 4 35V13Z"/><circle cx="24" cy="24" r="8" fill="#f9f4dc"/></svg>';
   cell.title=id==='roll'?'ทอยลูกเต๋า':items.names[id]||id;
   cell.setAttribute('aria-label',cell.title+(qty===null?'':' จำนวน '+qty));
   if(qty!==null){
     const badge=doc.createElement('span');
     badge.className='board-item-count';badge.textContent=String(qty);
     cell.append(badge);
   }
   host.append(cell);
 }
 const guide=$('inventoryGuide');
 const mapInspection=info.boardPhase==='ready'&&!!boardCameraController?.enabled();
 const slot=options[selected]||'roll';
 guide.textContent=mapInspection?'กำลังดูแผนที่ • ดับเบิลแท็บบนจอยอีกครั้งเพื่อเปิดกระเป๋า':info.boardPhase==='aim'?
   'เล็งเป้า • A '+(info.a||'ยืนยัน')+' • B '+(info.b||'ไม่ใช้')+' • C '+(info.c||'ยกเลิก'):
   ready?(info.usedRound===info.round?'ใช้ไอเทมแล้ว 1 ชิ้น • A ทอยลูกเต๋าต่อ':
     'เลือก: '+(slot==='roll'?'ทอยลูกเต๋า':items.names[slot]||slot)+
     ' • A '+(info.a||'ยืนยัน')+' • B '+(info.b||'เปลี่ยนไอเทม')+
     (info.bagMessage?' • '+info.bagMessage:'')):
   'ทอยลูกเต๋า + ไอเทม '+items.ids.length+' ชนิด';
 $('controllerState').textContent=info.help||'';
}
