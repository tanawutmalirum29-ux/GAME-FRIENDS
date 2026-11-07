'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('boulder-bash.js','utf8');
const context={window:{},Date,Math};
vm.runInNewContext(code,context,{filename:'boulder-bash.js'});
const G=context.window.BoulderBash;
assert.ok(G.setup&&G.update&&G.draw&&G.hud&&G.sweptHit&&G.spawnWave);
assert.equal(G.config.rockChance,.35,'colored boulder roll is 35%');
function make(n,bot=false){return Array.from({length:n},(_,i)=>({
 id:'p'+i,name:'Player '+i,color:'#ffad63',type:bot?'local':'remote',isBot:bot,active:false,
 input:{axisX:0,axisY:0,action:false},score:0
}));}
function game(n,seed=17,bot=false){const ps=make(n,bot),round={phase:'playing',paused:false,boulderSeed:seed};
 const s=G.setup(round,ps);return {ps,round,s};}
const tick=(x,n=1)=>{for(let i=0;i<n;i++)G.update(1/60,x.round,x.ps);};
for(let n=1;n<=12;n++){
 const x=game(n);assert.equal(x.ps.length,n);
 assert.ok(x.ps.every(p=>p.active&&p.bb.alive&&p.x>=G.config.radius));
 assert.equal(new Set(x.ps.map(p=>p.x+','+p.y)).size,n,'distinct safe spawns');
 assert.equal(G.hud(x.ps,x.round).survivors,n);
}
{
 const x=game(2);x.round.phase='countdown';x.ps[0].input.axisX=1;
 const before=x.ps[0].x;G.update(1,x.round,x.ps);
 assert.equal(x.ps[0].x,before,'countdown freezes movement');
 x.round.phase='playing';tick(x,5);
 assert.ok(x.ps[0].x>before,'joystick drives character');
 x.ps[0].input.axisX=0;const drift=x.ps[0].x;tick(x,3);
 assert.ok(x.ps[0].x>drift,'player slides after releasing joystick');
}
{
 const x=game(2);const [a,b]=x.ps;
 a.x=280;a.y=270;b.x=309;b.y=270;a.dir={x:1,y:0};
 a.input.action=true;tick(x);
 assert.ok(b.vx>0,'A push transfers impulse');
 assert.equal(b.stun||0,0,'push must not stun');
 const previous=b.vx;tick(x);
 assert.ok(b.vx<=previous+1e-6,'A cannot spam every frame');
}
{
 const x=game(3);
 x.s.rocks=[];const p=x.ps[0],r=G.rockAt(x.s,p.y);
 r.oldX=p.x+90;r.oldY=p.y;r.x=p.x-90;r.y=p.y;
 assert.ok(G.sweptHit(p,r,p.x,p.y),'swept collision prevents tunneling');
 G.eliminate(x.s,p,r);G.eliminate(x.s,p,r);
 assert.equal(p.bb.mode,'spectator');assert.equal(p.bb.alive,false);
 const owned=G.rockAt(x.s,p.y,p);assert.equal(p.bb.mode,'rock');assert.equal(p.bb.rockId,owned.id);
 assert.equal(owned.ownerId,p.id);assert.ok(owned.vx<0);
 p.input.axisX=1;p.input.axisY=1;const old=owned.vx;
 x.s.rocks=[owned];tick(x,3);
 assert.ok(owned.vx<old,'player cannot force rock back uphill');
 owned.x=-owned.r;tick(x,1);assert.equal(p.bb.mode,'spectator');
 assert.equal(p.bb.rockId,null,'rock exit releases control');
}
{
 const x=game(4),r=G.rockAt(x.s,x.ps[0].y);
 G.eliminate(x.s,x.ps[0],r);G.eliminate(x.s,x.ps[1],r);
 assert.equal(x.ps[0].bb.eliminatedTick,x.ps[1].bb.eliminatedTick);
 G.eliminate(x.s,x.ps[2],r);G.finish(x.s,x.round,x.ps);
 assert.equal(x.s.winnerIds[0],x.ps[3].id);
 assert.equal(x.s.ranking.find(q=>q.id===x.ps[0].id).rank,
  x.s.ranking.find(q=>q.id===x.ps[1].id).rank,'same-step death ties');
 assert.equal(G.update(.1,x.round,x.ps),'winner');
}
{
 const x=game(1);tick(x,2);
 assert.equal(x.s.finished,false,'solo game must not end on start');
 x.s.clock=59.99;tick(x,2);assert.equal(x.s.finished,true,'solo survives 60 seconds');
}
{
 // Multiple colored rocks can coexist, but not two belonging to one player.
 const x=game(5);G.eliminate(x.s,x.ps[0]);G.eliminate(x.s,x.ps[1]);
 const one=G.rockAt(x.s,260,x.ps[0]),two=G.rockAt(x.s,360,x.ps[1]);
 assert.equal(x.ps[0].bb.rockId,one.id);
 assert.equal(x.ps[1].bb.rockId,two.id);
 const normal=G.rockAt(x.s,180,x.ps[0]);
 assert.equal(normal.ownerId,null,'cannot assign a second controlled rock to one player');
 assert.equal(x.ps[0].bb.rockId,one.id);
 one.x=-one.r;tick(x,1);
 assert.equal(x.ps[0].bb.rockId,null,'exiting boulder releases its owner');
 assert.equal(x.ps[1].bb.rockId,two.id,'other players retain their colored rocks');
}
{
 // Batch spawn should sometimes produce more than one rock on the same tick.
 let multi=false;
 for(let seed=1;seed<=100&&!multi;seed++){
  const x=game(5,seed);x.s.nextSpawn=0;tick(x);
  if(x.s.warnings.length>1){
   multi=true;
   assert.ok(x.s.warnings.every(w=>w.delay>0),'wave warnings start together');
  }
 }
 assert.ok(multi,'spawner supports multiple rocks in one simultaneous wave');
}
{
 // Reservations must prevent one eliminated owner from appearing twice in a batch.
 const x=game(5,61);G.eliminate(x.s,x.ps[0]);G.eliminate(x.s,x.ps[1]);
 G.eliminate(x.s,x.ps[2]);
 for(let i=0;i<12;i++)G.spawnWarning(x.s);
 const colored=x.s.warnings.map(w=>w.ownerId).filter(Boolean);
 assert.equal(new Set(colored).size,colored.length,'pending colored rocks have distinct owners');
 assert.ok(x.s.warnings.length>1,'ordinary and colored rocks coexist in pending spawns');
 // Make all warnings resolve together; each reserved owner gets only one rock.
 x.s.warnings.forEach(w=>w.delay=0);
 tick(x,1);
 const owners=x.s.rocks.map(r=>r.ownerId).filter(Boolean);
 assert.equal(new Set(owners).size,owners.length,'active colored boulders have distinct owners');
}
{
 // Independent per-rock 35% roll (with one permanently eligible player).
 const x=game(5,42);G.eliminate(x.s,x.ps[0]);
 let colored=0;
 for(let i=0;i<1000;i++){
  x.s.warnings.length=0;
  G.spawnWarning(x.s);
  if(x.s.warnings[0]?.ownerId===x.ps[0].id)colored++;
 }
 assert.ok(colored>=290&&colored<=410,'35% spawn rate within deterministic statistical range: '+colored);
}
{
 // Smooth steering: no instant reversal of orientation over one physics frame.
 const x=game(3,23,true),bot=x.ps[0];bot.bb.homeX=bot.x+60;bot.bb.homeY=bot.y+80;
 tick(x,10);
 const start=Math.atan2(bot.dir.y,bot.dir.x);
 bot.bb.homeX=bot.x-400;bot.bb.homeY=bot.y-400;
 tick(x);
 const end=Math.atan2(bot.dir.y,bot.dir.x);
 const diff=Math.abs(Math.atan2(Math.sin(end-start),Math.cos(end-start)));
 assert.ok(diff<=6/60+1e-6,'bot heading turns at a capped speed, no visible flickering');
}

for(const n of [2,6,12]){
 for(const seed of [1,7,18]){
  const x=game(n,seed,true);
  for(let i=0;i<60*30&&!x.s.finished;i++)tick(x);
  assert.ok(x.s.rocks.length<=G.config.rockLimit);
  assert.ok(x.ps.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  assert.ok(x.s.rocks.every(r=>Number.isFinite(r.x)&&Number.isFinite(r.y)));
 }
}
console.log('BOULDER BASH: physics, spawns, collision, steering, elimination, solo and 1-12 bot simulation passed');
