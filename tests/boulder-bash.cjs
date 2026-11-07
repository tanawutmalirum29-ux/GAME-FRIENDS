'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('boulder-bash.js','utf8');
const context={window:{},Date,Math};
vm.runInNewContext(code,context,{filename:'boulder-bash.js'});
const G=context.window.BoulderBash;
assert.ok(G.setup&&G.update&&G.draw&&G.hud&&G.sweptHit);
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
