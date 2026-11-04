'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const engineSource=fs.readFileSync('chickens.js','utf8');
const host=vm.createContext({window:{}});
vm.runInContext(engineSource,host,{filename:'chickens.js'});
const chickens=host.window.Chickens;
assert.ok(chickens,'CHICKENS engine is exported');
const C=chickens.constants;
assert.equal(C.playerSpeed,172);
assert.equal(C.chickenSpeed,183);
assert.equal(C.depositTime,.3);
assert.equal(C.punchCooldown,1);
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
for(const n of [1,2,4,8,12]){
  const {players,round,state}=make(n);
  assert.equal(state.pens.length,n);
  assert.equal(new Set(state.pens.map(p=>p.ownerId)).size,n);
  assert.equal(state.targetFree,Math.max(9,Math.round(n*4.5)));
  assert.equal(state.chickens.length,state.targetFree);
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
  round.phase='playing';state.chickens=[c];state.targetFree=1;
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
  state.chickens=[c];state.targetFree=1;
  chickens.update(.016,round,players);
  assert.equal([a,b].filter(p=>p.carriedChickenId===c.id).length,1);
  assert.equal(c.status,'carried');
}
// Gate geometry: brushing or passing outside the true aperture does not count.
{
  const x=make(2),{round,players,state}=x;
  const p=players[0],pen=state.pens[0],c=state.chickens[0];
  round.phase='playing';state.chickens=[c];state.targetFree=1;
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
// Strict 0.30-second dwell, reset upon withdrawal, and give points to the owner.
{
  const x=make(2),{round,players,state}=x,[carrier,owner]=players;
  const pen=state.pens[1],c=state.chickens[0];
  round.phase='playing';state.chickens=[c];state.targetFree=1;
  c.status='carried';c.carrierId=carrier.id;carrier.carriedChickenId=c.id;
  placeAtGate(state,carrier,pen);
  run(round,players,.15);
  assert.equal(owner.score,0);
  carrier.x=state.center.x;carrier.y=state.center.y;
  run(round,players,.02);
  assert.equal(c.depositFor,0,'withdrawal resets continuous dwell');
  placeAtGate(state,carrier,pen);
  run(round,players,.14);
  assert.equal(owner.score,0);
  run(round,players,.15);
  assert.equal(owner.score,0,'0.29 sec is too short');
  run(round,players,.02);
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
// Punching drops the carried chicken, never stuns or slows the target.
{
  const x=make(2),{round,players,state}=x,[attacker,victim]=players;
  round.phase='playing';state.targetFree=1;
  const c=state.chickens[0];state.chickens=[c];
  attacker.x=state.center.x-38;attacker.y=state.center.y;
  victim.x=state.center.x;victim.y=state.center.y;
  attacker.dir={x:1,y:0};victim.dir={x:1,y:0};
  c.status='carried';c.carrierId=victim.id;victim.carriedChickenId=c.id;
  attacker.input.action=true;
  chickens.update(.016,round,players);
  assert.equal(victim.carriedChickenId,null);
  assert.equal(c.status,'free');
  assert.ok(c.invulnerable>0,'cannot immediately re-catch');
  assert.equal(victim.stun,0);
  assert.equal(attacker.chickenAttackCooldown>0,true);
  run(round,players,1.12);
  assert.equal(attacker.chickenAttackCooldown,0,'hold A cannot retrigger');
  assert.equal(attacker.chickenPunchFlash,0,'no repeated punch flash while held');
}
// Disconnect cleanup must release chickens without destroying fixed pens.
{
  const x=make(2),{round,players,state}=x;
  const c=state.chickens[0],p=players[0],penCount=state.pens.length;
  round.phase='playing';state.chickens=[c];state.targetFree=1;
  c.status='carried';c.carrierId=p.id;p.carriedChickenId=c.id;
  p.active=false;
  chickens.update(.016,round,players);
  assert.equal(c.status,'free');
  assert.equal(state.pens.length,penCount);
}
// Bots use the same physics/dwell logic and deposit through the physical gate.
{
  const x=make(1),{round,players,state}=x,p=players[0];
  round.phase='playing';p.isBot=true;state.targetFree=1;
  const c=state.chickens[0];state.chickens=[c];
  c.status='carried';c.carrierId=p.id;p.carriedChickenId=c.id;
  run(round,players,4);
  assert.ok(p.score>=1,'bot must reach the gate and dwell 0.30sec');
  assert.equal(c.status,'penned','the originally carried chicken must enter the pen');
}
// Pauses are enforced by the game dispatcher: engine cannot update in results.
{
  const x=make(1),{round,players,state}=x;
  round.phase='results';const old=state.remaining;
  assert.equal(chickens.update(.1,round,players),null);
  assert.equal(state.remaining,old);
}
console.log('CHICKENS physics, gates, deposits, combat, lifecycle and bots: OK');
