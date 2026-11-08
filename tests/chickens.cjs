'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const engineSource=fs.readFileSync('chickens.js','utf8');
const host=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync('arena-art.js','utf8'),host,{filename:'arena-art.js'});
vm.runInContext(fs.readFileSync('player-avatar.js','utf8'),host,{filename:'player-avatar.js'});
vm.runInContext(fs.readFileSync('combat-motion.js','utf8'),host,{filename:'combat-motion.js'});
vm.runInContext(fs.readFileSync('character-system.js','utf8'),host,{filename:'character-system.js'});
vm.runInContext(fs.readFileSync('farm-ice-art.js','utf8'),host,{filename:'farm-ice-art.js'});
vm.runInContext(engineSource,host,{filename:'chickens.js'});
const chickens=host.window.Chickens;
assert.ok(chickens,'CHICKENS engine is exported');
const C=chickens.constants;
assert.ok(Math.abs(C.playerSpeed-172*.7)<1e-8,'player movement reduced 30%');
assert.ok(Math.abs(C.chickenSpeed-191*.7)<1e-8,'chicken escape speed reduced 30%');
assert.ok(Math.abs(C.panicChickenSpeed-217*.7)<1e-8,'panic speed reduced 30%');
assert.ok(Math.abs(C.idleChickenSpeed-96*.7)<1e-8,'idle movement reduced 30%');
assert.ok(Math.abs(C.chickenTurnRate-8.2*.7)<1e-8,'turning reduced 30%');
assert.ok(Math.abs(C.chickenFlapRate-16*.7)<1e-8,'flapping reduced 30%');
assert.equal(C.chickenRadius,8.3);
assert.equal(C.depositTime,.15);
assert.equal(C.punchCooldown,host.window.PartyCombatMotion.ATTACK.cooldown);
const playersFor=n=>Array.from({length:n},(_,i)=>({
  id:'p'+i,name:'Player '+i,color:'#'+String(100000+i*11273),
  type:'remote',active:true,isBot:false,score:0,alive:true,
  input:{left:false,right:false,jump:false,down:false,action:false,axisX:0,axisY:0}
}));
const make=n=>{
  const players=playersFor(n),round={mode:'chickens',phase:'countdown'};
  chickens.setup(round,players);
  return {players,round,state:round.chickens};
};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const placeAtGate=(state,p,pen)=>{
  p.x=state.center.x+pen.normal.x*(state.radius-16);
  p.y=state.center.y+pen.normal.y*(state.radius-16);
  p.dir={...pen.normal};
};
const run=(round,players,t)=>{
  let left=t;
  while(left>1e-8){const step=Math.min(left,.08);chickens.update(step,round,players);left-=step;}
};
// Test all supported match sizes, owner association, distribution and time.
for(let n=1;n<=12;n++){
  const {players,round,state}=make(n);
  assert.equal(state.pens.length,n);
  assert.equal(new Set(state.pens.map(p=>p.ownerId)).size,n);
  const quota=n*5+1,initial=Math.min(20,quota);
  assert.equal(state.totalChickens,quota,'five chickens per player plus a deciding bird');
  assert.equal(state.totalChickens%n,1%n,'full-flock total does not divide evenly between players');
  assert.equal(state.spawnLimit,initial,'at most twenty live chickens');
  assert.equal(state.chickens.length,initial);
  assert.equal(state.spawnedCount,initial);
  assert.equal(state.remainingReserve,quota-initial);
  assert.equal(state.scoredCount,0);
  assert.equal(state.world.w,n<=4?960:n<=8?1200:1440);
  assert.equal(state.world.h,n<=4?540:n<=8?675:810);
  assert.equal(state.remaining,n<=4?20:n<=8?30:40);
  assert.equal(round.countdown,3);
  assert.deepEqual(Array.from(state.pens,p=>p.ownerId),players.map(p=>p.id));
  for(const chicken of state.chickens){
    assert.equal(chicken.status,'free');
    assert.ok(dist(chicken,state.center)<=state.radius-25,'spawn inside arena');
    assert.ok(players.every(p=>dist(chicken,p)>15),'spawn outside player collisions');
  }
  for(let i=0;i<state.pens.length;i++) {
    const pen=state.pens[i];
    assert.ok(pen.gateWidth>=66);
    assert.equal(pen.ownerId,players[i].id);
    assert.equal(pen.color,players[i].color);
  }
  // Every new round must discard old score, carrying state and chickens.
  players[0].score=25;players[0].carriedChickenId=2;
  const prev=state;
  chickens.setup(round,players);
  assert.notEqual(round.chickens,prev);
  assert.equal(players[0].score,0);
  assert.equal(players[0].carriedChickenId,null);
}
// Catch on physical overlap, never by a threat-sensing radius.
{
  const x=make(1),{round,players,state}=x,p=players[0],c=state.chickens[0];
  round.phase='playing';state.chickens=[c];
  c.x=p.x+100;c.y=p.y;c.invulnerable=0;
  chickens.update(.016,round,players);
  assert.equal(p.carriedChickenId,null,'no remote pickup');
  c.x=p.x+12;c.y=p.y;
  chickens.update(.016,round,players);
  assert.equal(p.carriedChickenId,c.id);
  assert.equal(c.status,'carried');
  assert.equal(c.carrierId,p.id);
  assert.ok(dist(c,{x:p.x+p.dir.x*C.carryOffset,y:p.y+p.dir.y*C.carryOffset})<.001);
}
// Carrying a single chicken, no accidental double-carrier race.
{
  const x=make(2),{round,players,state}=x,[a,b]=players;
  round.phase='playing';
  const c=state.chickens[0];
  a.x=state.center.x;b.x=a.x+14;a.y=b.y=state.center.y;
  c.x=a.x+7;c.y=a.y;
  state.chickens=[c];
  chickens.update(.016,round,players);
  assert.equal([a,b].filter(p=>p.carriedChickenId===c.id).length,1);
  assert.equal(c.status,'carried');
}
// Gate geometry: brushing or passing outside the true aperture does not count.
{
  const x=make(2),{round,players,state}=x;
  const p=players[0],pen=state.pens[0],c=state.chickens[0];
  round.phase='playing';state.chickens=[c];
  c.status='carried';c.carrierId=p.id;p.carriedChickenId=c.id;
  p.x=state.center.x;p.y=state.center.y;p.dir={...pen.normal};
  run(round,players,.45);
  assert.equal(p.score,0,'no credit in center arena');
  const point={x:pen.gatePosition.x+pen.normal.x*20+
      pen.tangent.x*(pen.gateWidth/2+5),
    y:pen.gatePosition.y+pen.normal.y*20+
      pen.tangent.y*(pen.gateWidth/2+5)};
  assert.equal(chickens.gateInside(state,pen,point),false,'outside gate side');
  assert.equal(chickens.gateInside(state,pen,pen.gatePosition),false,'no gate penetration');
}
// Strict 0.15-second dwell, reset upon withdrawal, and give points to the owner.
{
  const x=make(2),{round,players,state}=x,[carrier,owner]=players;
  const pen=state.pens[1],c=state.chickens[0];
  round.phase='playing';state.chickens=[c];
  c.status='carried';c.carrierId=carrier.id;carrier.carriedChickenId=c.id;
  placeAtGate(state,carrier,pen);
  run(round,players,.07);
  assert.equal(owner.score,0);
  carrier.x=state.center.x;carrier.y=state.center.y;
  run(round,players,.02);
  assert.equal(c.depositFor,0,'withdrawal resets continuous dwell');
  placeAtGate(state,carrier,pen);
  run(round,players,.07);
  assert.equal(owner.score,0);
  run(round,players,.06);
  assert.equal(owner.score,0,'0.13 sec is too short');
  run(round,players,.03);
  assert.equal(owner.score,1);
  assert.equal(carrier.score,0);
  assert.equal(pen.points,1);
  assert.equal(c.status,'penned');
  assert.equal(c.carrierId,null);
  assert.equal(c.penId,pen.id);
  assert.equal(carrier.carriedChickenId,null);
  const originalScore=owner.score;
  run(round,players,.9);
  assert.equal(owner.score,originalScore,'same chicken only scores once');
}
// Normal shared punches stun for 0.8s, color the stars after the attacker and drop carried chickens.
{
  const x=make(2),{round,players,state}=x,[attacker,victim]=players;
  round.phase='playing';
  const c=state.chickens[0];state.chickens=[c];
  attacker.x=state.center.x-38;attacker.y=state.center.y;
  victim.x=state.center.x;victim.y=state.center.y;
  attacker.dir={x:1,y:0};victim.dir={x:1,y:0};
  c.status='carried';c.carrierId=victim.id;victim.carriedChickenId=c.id;
  attacker.input.action=true;
  chickens.update(.016,round,players);
  assert.equal(victim.carriedChickenId,c.id,'normal punch has shared visible windup');
  run(round,players,.20);
  assert.equal(victim.carriedChickenId,null);
  assert.equal(c.status,'free');
  assert.ok(c.invulnerable>0,'cannot immediately re-catch');
  assert.ok(victim.stun>.6&&victim.stun<=.8,'normal hit stuns for 0.8 seconds');
  assert.equal(victim.stunColor,attacker.color,'stars use hitter color');
  assert.equal(attacker.chickenAttackCooldown>0,true);
  run(round,players,1.12);
  assert.equal(attacker.chickenAttackCooldown,0,'hold A cannot retrigger');
  assert.equal(attacker.chickenPunchFlash,0,'no repeated punch flash while held');
}
// Disconnect cleanup must release chickens without destroying fixed pens.
{
  const x=make(2),{round,players,state}=x;
  const c=state.chickens[0],p=players[0],penCount=state.pens.length;
  round.phase='playing';state.chickens=[c];
  c.status='carried';c.carrierId=p.id;p.carriedChickenId=c.id;
  p.active=false;
  chickens.update(.016,round,players);
  assert.equal(c.status,'free');
  assert.equal(state.pens.length,penCount);
}
// Bots use the same physics/dwell logic and deposit through the physical gate.
{
  const x=make(1),{round,players,state}=x,p=players[0];
  round.phase='playing';p.isBot=true;
  const c=state.chickens[0];state.chickens=[c];
  c.status='carried';c.carrierId=p.id;p.carriedChickenId=c.id;
  run(round,players,4);
  assert.ok(p.score>=1,'bot must reach the gate and dwell 0.30sec');
  assert.equal(c.status,'penned','the originally carried chicken must enter the pen');
}
// Finite chicken economy: 20 active chickens maximum, including any in hands.
// Scoring retires one permanently and releases only one new chicken from the
// finite reserve; after 61 deposits with 12 players no chicken can respawn.
{
  const {state,round,players}=make(12),p=players[0],pen=state.pens[0];
  round.phase='playing';
  players.slice(1).forEach(q=>q.active=false);
  assert.equal(state.spawnedCount,20);
  assert.equal(state.remainingReserve,41);
  let originalId=state.chickens[0].id;
  state.chickens[0].status='carried';
  state.chickens[0].carrierId=p.id;
  p.carriedChickenId=originalId;
  chickens.update(.016,round,players);
  assert.equal(state.spawnedCount,20,'carrying is counted in active cap');
  chickens.dropChicken(state,p);
  chickens.update(.016,round,players);
  assert.equal(state.spawnedCount,20,'dropping is not a score, so no refill');
  for(let i=0;i<61;i++){
    const c=p.carriedChickenId!=null
      ?state.chickens.find(c=>c.id===p.carriedChickenId)
      :state.chickens.find(c=>c.status==='free');
    assert.ok(c,'a live chicken is available until quota is exhausted');
    c.status='carried';c.carrierId=p.id;p.carriedChickenId=c.id;
    placeAtGate(state,p,pen);
    // Stop on this bird's deposit. Running .34s can legally collect and deposit
    // a second randomly nearby bird (two .15s dwells), making the fixture flaky.
    for(let elapsed=0;elapsed<.34&&c.status!=='penned';elapsed+=1/120)
      chickens.update(1/120,round,players);
    assert.equal(c.status,'penned','the selected bird reaches the physical pen');
    assert.equal(state.scoredCount,i+1,'each deposit retires exactly one chicken');
    assert.equal(p.score,i+1,'each retired chicken scores once');
    assert.equal(state.spawnedCount+state.remainingReserve,61,'cannot mint extra chickens');
    assert.ok(state.spawnedCount<=61,'lifetime spawn cap');
    assert.ok(state.chickens.filter(x=>x.status==='free'||x.status==='carried').length<=20,
      'never more than 20 chickens in play');
    assert.equal(state.chickens.filter(x=>x.status==='penned').length,state.scoredCount);
  }
  assert.equal(state.remainingReserve,0);
  assert.equal(state.spawnedCount,61);
  assert.equal(state.chickens.length,61);
  assert.equal(state.chickens.filter(x=>x.status==='free'||x.status==='carried').length,0);
  run(round,players,1);
  assert.equal(state.chickens.length,61,'all 61 are gone for the entire round');
  assert.equal(state.scoredCount,61);
}
// Last bird deposited triggers results immediately even with time left.
// An empty field must NOT end the round while someone is still carrying
// the final bird.
{
  const {round,players,state}=make(2),p=players[0],pen=state.pens[0];
  round.phase='playing';
  const last=state.chickens[state.chickens.length-1];
  for(const c of state.chickens){
    if(c===last)continue;
    c.status='penned';c.penId=pen.id;
  }
  state.scoredCount=state.totalChickens-1;
  state.remainingReserve=0;
  last.status='carried';last.carrierId=p.id;p.carriedChickenId=last.id;
  placeAtGate(state,p,pen);
  for(let i=0;i<2;i++){
    assert.equal(chickens.update(.06,round,players),null,
      'bird in hand is unfinished until the deposit dwell completes');
  }
  assert.equal(state.scoredCount,state.totalChickens-1);
  assert.equal(chickens.update(.06,round,players),'winner',
    'last deposited bird finishes the round before the time limit');
  assert.equal(state.scoredCount,state.totalChickens);
  assert.equal(last.status,'penned');
  assert.equal(p.carriedChickenId,null);
  assert.ok(state.remaining>19,'clock still has time when the winner is chosen');
  assert.equal(chickens.update(.016,round,players),'winner',
    'completed flock stays finished without changing the score');
  assert.equal(state.scoredCount,state.totalChickens);
}
// The clock is still the fallback ending if there are chickens left.
{
  const {round,players,state}=make(2);
  round.phase='playing';state.remaining=.03;
  assert.equal(chickens.update(.08,round,players),'winner');
  assert.equal(state.remaining,0);
  assert.ok(state.scoredCount<state.totalChickens);
}
// Pauses are enforced by the game dispatcher: engine cannot update in results.
{
  const x=make(1),{round,players,state}=x;
  round.phase='results';const old=state.remaining;
  assert.equal(chickens.update(.1,round,players),null);
  assert.equal(state.remaining,old);
}
// A carried bird must draw a foreground icon and not disappear behind the carrier.
{
 const {round,players,state}=make(2),p=players[0],c=state.chickens[0];
 c.status='carried';c.carrierId=p.id;p.carriedChickenId=c.id;
 state.chickens=[c];p.dir={x:1,y:0};
 c.x=p.x+C.carryOffset;c.y=p.y;
 const words=[],circles=[],translations=[];
 const ctx=new Proxy({},{
  get(_obj,key){
   if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
   if(key==='fillText')return (...args)=>words.push(args);
   if(key==='arc')return (...args)=>circles.push(args);
   if(key==='translate')return (...args)=>translations.push(args);
   return ()=>{};
  },set(){return true;}
 });
 chickens.draw(ctx,.4,round,players);
 assert.equal(words.some(x=>x[0]==='ไก่'),false,'the actual held bird is visible without a floating caption');
 assert.ok(translations.some(x=>Math.abs(x[0]-c.x)<1e-8),
   'carried sprite is drawn at its actual carry position');
}
console.log('CHICKENS physics, gates, deposits, combat, lifecycle and bots: OK');
// A held bird must point at the same gate location in all four directions.
for(const dir of [{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}]){
 const player={x:480,y:270,dir};
 const bird={x:player.x+dir.x*C.carryOffset,y:player.y+dir.y*C.carryOffset,
   dir,status:'carried',flap:0};
 const moves=[];
 const ctx=new Proxy({},{get(_target,key){return (...args)=>{if(key==='translate')moves.push(args);};},set(){return true;}});
 chickens.drawHeldChicken(ctx,bird,player,1);
 assert.ok(moves.some(([x,y])=>x===bird.x&&y===bird.y),
   'overhead carried art has no screen-up offset from the deposit coordinates');
}
