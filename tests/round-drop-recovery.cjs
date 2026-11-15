/* Regression: 60-second remote seat expiry must not terminate a live match.
 * Covers mid-round bot allocation, human reclaim and BOARD cancellation. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=process.env.GAME_BUILD_ROOT||path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
globalThis.window={PartyCharacters:{
 activate(players){for(const p of players)p.active=true;},
 control(input={}){let x=Number(input.axisX)||0,y=Number(input.axisY)||0;
  const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}
  return{x,y,action:!!input.action,alt:!!input.alt};}
}};
const games=[
 ['mole-mayhem','mole'],
 ['countdown-drop','dyn'],
 ['candy-chaos','dyn'],
 ['scoop-rush','sr'],
 ['cannon-chaos','cn'],
 ['dynamite','dyn'],
 ['ufo-arena','ufo']
];
const mk=n=>Array.from({length:n},(_,i)=>({
 id:'p'+i,name:'Player'+i,type:'remote',color:'#d93c79',active:false,
 isBot:false,score:0,input:{axisX:0,axisY:0,action:false}
}));
async function simulate(){
 for(const [slug,field] of games){
  const game=(await import(pathToFileURL(path.join(root,'src/games',slug,'game.js')).href)).default;
  for(const n of [2,6,7,12]){
   const ps=mk(n),round={phase:'playing',paused:false,moleSeed:71,
    dynamiteSeed:71,cannonSeed:71,dropSeed:71,candySeed:71,
    ufoArenaSeed:71,scoopRushSeed:71};
   game.setup(round,ps);
   const player=ps[0],local=player[field];
   assert.ok(local,'initialized '+slug);
   assert.equal(local.bot,null,slug+' human starts without bot AI');
   player.isBot=true; // exactly what holdSeat performs after 60s
   game.update(1/60,round,ps);
   assert.equal(player[field],local,slug+' preserves game-owned physics state');
   assert.ok(local.bot,slug+' must allocate missing AI at first takeover tick');
   assert.ok(Number.isFinite(player.x)&&Number.isFinite(player.y),slug+' finite after takeover');
   const firstController=local.bot;
   for(let t=0;t<90;t++)game.update(1/60,round,ps);
   // Returning with the same token restores human control, not the whole round.
   player.isBot=false;player.input={axisX:0,axisY:0,action:false};
   game.update(1/60,round,ps);
   assert.equal(local.bot,firstController,slug+' rejoin does not reset score, HP or AI');
   player.isBot=true;
   game.update(1/60,round,ps);
   assert.equal(local.bot,firstController,slug+' second takeover reuses a safe controller');
   assert.ok(Number.isFinite(player.x)&&Number.isFinite(player.y),slug+' retained coordinates');
   assert.ok(ps.length===n,'fixed roster across AI transitions');
  }
 }
}
function seatExpiry(){
 const source=read('src/app/core/runtime.js');
 const i=source.indexOf('function holdSeat(p){');
 const j=source.indexOf('\nconst canvas=',i);
 assert.ok(i>=0&&j>i,'seat-expiry source is discoverable');
 const fn=source.slice(i,j);
 const scenario=(board,active,connected,playing=true)=>{
  let callback,removed=0;
  const p={id:'p0',type:'remote',active,conn:connected?{}:null,
   input:{axisX:1,action:true},isBot:false},bp={id:'p0',isBot:false};
  const ctx=vm.createContext({
   players:[p],boardSession:board?{players:[bp]}:null,
   round:playing?{phase:'playing'}:null,
   seatTimers:new Map(),setTimeout(f,ms){assert.equal(ms,60000);callback=f;return 42;},
   cancelSeat(){},blankInput(){return{axisX:0,action:false};},
   removePlayer(){removed++;}
  });
  vm.runInContext(fn,ctx);
  vm.runInContext('holdSeat(players[0]);',ctx);
  if(callback)callback();
  return{p,bp,removed};
 };
 let s=scenario(false,true,false);
 assert.equal(s.removed,0,'NORMAL active human stays in game');
 assert.equal(s.p.isBot,true,'NORMAL remote participant takes AI control');
 assert.equal(s.p.input.axisX,0,'stale joystick cleared');
 s=scenario(true,true,false);
 assert.equal(s.p.isBot,true,'BOARD remote participant takes AI control');
 assert.equal(s.bp.isBot,true,'BOARD token also changes to bot');
 s=scenario(false,true,false,false);
 assert.equal(s.removed,1,'abandoned idle lobby seats are eventually freed');
 s=scenario(false,true,true);
 assert.equal(s.removed,0,'reconnected seat cannot be taken over');
 assert.equal(s.p.isBot,false);
}
function boardRecovery(){
 const source=read('src/app/rounds/render.js');
 const i=source.indexOf('function animate(ts){'),j=source.indexOf('\nfunction broadcastGameState()',i);
 assert.ok(i>=0&&j>i,'host animation loop found');
 const animateSource=source.slice(i,j);
 const run=(board)=>{
  let returned=0,shown=0,cancelled=0,raf=0,notices=0;
  const boardState=board?{phase:'minigame'}:null;
  const ctx=vm.createContext({
   Math,frameLast:0,currentView:'game',gameSelection:null,graphicsClock:0,
   possessedBotId:null,drawFailureStreak:0,round:{mode:'mole_mayhem',phase:'playing',paused:false},
   boardSession:boardState,window:{BoardParty:{minigameCancelled(s){
    assert.equal(s,boardState);cancelled++;s.phase='standings';return true;}}},
   updateRound(){throw Error('simulated bad game update');},
   logRoundFault(){},showBoard(){shown++;},returnToLobby(){returned++;},
   showToast(){notices++;},requestAnimationFrame(){raf++;},MODES:{mole_mayhem:'MOLE MAYHEM'}
  });
  vm.runInContext(animateSource+'; animate(16);',ctx);
  return{returned,shown,cancelled,raf,notices};
 };
 let result=run(true);
 assert.equal(result.returned,0,'BOARD map is never wiped on a minigame fault');
 assert.equal(result.cancelled,1,'existing no-reward minigame cancellation is used');
 assert.equal(result.shown,1);
 assert.equal(result.raf,1,'render loop stays alive after a crash');
 result=run(false);
 assert.equal(result.returned,1,'normal round faults still have a controlled abort');
 assert.equal(result.raf,1);
}
function pluginDisposal(){
 const runtime=read('src/app/core/runtime.js');
 const start=runtime.indexOf('const disposedPluginRounds = new WeakSet();');
 const end=runtime.indexOf('\nfunction gameCover(',start);
 assert.ok(start>=0&&end>start,'round disposal helper source is discoverable');
 const errors=[];
 const context=vm.createContext({console:{error(...args){errors.push(args);}}});
 vm.runInContext(runtime.slice(start,end)+'\nthis.disposePluginRound=disposePluginRound;',context);
 const dispose=context.disposePluginRound;

 let calls=[];
 const primary={mode:'test',pluginEngine:{dispose(target,reason){
  calls.push({same:target===primary,reason});
 }}};
 assert.equal(dispose(primary,'next game selected'),true);
 assert.equal(dispose(primary,'returned to lobby'),false,'a round can only be disposed once');
 assert.deepEqual(calls,[{same:true,reason:'next game selected'}]);

 for(const hook of ['cleanup','teardown']){
  const legacy={pluginEngine:{[hook](target,reason){calls.push({hook,target,reason});}}};
  assert.equal(dispose(legacy,'legacy alias'),true,hook+' is supported');
  assert.equal(calls.at(-1).hook,hook);
 }
 const noHook={pluginEngine:{setup(){}}};
 assert.equal(dispose(noHook,'no disposer'),false,'engines without a cleanup hook remain valid');
 let lateCalls=0;
 noHook.pluginEngine.dispose=()=>{lateCalls++;};
 assert.equal(dispose(noHook,'hook attached'),true,'missing hooks are not permanently marked disposed');
 assert.equal(lateCalls,1);

 const broken={mode:'broken',pluginEngine:{dispose(){throw Error('expected cleanup failure');}}};
 assert.equal(dispose(broken,'test failure'),false,'cleanup failures are contained');
 assert.equal(dispose(broken,'second attempt'),false,'a failing disposer is not invoked repeatedly');
 assert.equal(errors.length,1,'cleanup errors are recorded once');

 const engine=read('src/app/rounds/engine.js');
 const startRound=engine.slice(engine.indexOf('function startRound('),engine.indexOf('\nfunction updateRound(',engine.indexOf('function startRound(')));
 assert.ok(startRound.indexOf("disposePluginRound(round,'starting next round')")<
  startRound.indexOf("round={mode,pluginEngine:engine"),'old round is disposed before replacement');
 assert.ok(startRound.indexOf("disposePluginRound(round,'setup failed')")<
  startRound.indexOf('round=null',startRound.indexOf('}catch(error){')),
  'partially initialized rounds are disposed before dropping the reference');

 const lobby=read('src/app/host/lobby.js');
 const selection=lobby.slice(lobby.indexOf('function beginGameSelection(mode){'),lobby.indexOf('\nfunction updateGameSelection(',lobby.indexOf('function beginGameSelection(mode){')));
 assert.ok(selection.indexOf("disposePluginRound(round,'next game selected')")<
  selection.indexOf("round={mode,phase:'roulette'"),'new selection disposes the previous round');

 const board=read('src/app/board/integration.js');
 const showBoard=board.slice(board.indexOf('function showBoard(){'),board.indexOf('\nfunction updateBoard(',board.indexOf('function showBoard(){')));
 assert.ok(showBoard.indexOf("disposePluginRound(round,'returned to BOARD PARTY')")<
  showBoard.indexOf("round={mode:'board'"),'BOARD minigame is disposed after its results are copied');

 const render=read('src/app/rounds/render.js');
 const lobbyReturn=render.slice(render.indexOf('function returnToLobby(){'),render.indexOf("\n$('pauseBtn').addEventListener",render.indexOf('function returnToLobby(){')));
 assert.ok(lobbyReturn.indexOf("disposePluginRound(round,'returned to lobby')")<
  lobbyReturn.indexOf('tournament=null;round=null'),'lobby exit disposes before clearing round state');

 const room=read('src/app/host/room.js');
 const close=room.slice(room.indexOf('function closeHost('),room.indexOf('\nfunction shareUrl(',room.indexOf('function closeHost(')));
 assert.ok(close.indexOf("disposePluginRound(round,'room closed')")<
  close.indexOf('tournament=null;gameSelection=null;round=null'),'room close disposes before clearing round state');

 const results=read('src/app/rounds/results.js');
 const finish=results.slice(results.indexOf('function endPluginRound(){'),results.indexOf('\nfunction endRound(){',results.indexOf('function endPluginRound(){')));
 assert.ok(!finish.includes('disposePluginRound'),'result collection must keep engine state alive for results/HUD');
}

simulate().then(()=>{
 seatExpiry();boardRecovery();pluginDisposal();
 console.log('ROUND DROP RECOVERY PASS: seat expiry, BOARD cancellation and one-shot minigame disposal lifecycle');
}).catch(error=>{console.error(error);process.exitCode=1;});
