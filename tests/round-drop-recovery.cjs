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
   possessedBotId:null,round:{mode:'mole_mayhem',phase:'playing',paused:false},
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
simulate().then(()=>{
 seatExpiry();boardRecovery();
 console.log('ROUND DROP RECOVERY PASS: seven game AI transitions, seat expiry, BOARD cancellation');
}).catch(error=>{console.error(error);process.exitCode=1;});
