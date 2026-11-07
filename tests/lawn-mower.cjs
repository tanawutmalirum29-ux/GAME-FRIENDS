/* node tests/lawn-mower.cjs — gameplay, fairness, bots and integration checks. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const sandbox={window:{},Math,Date};
for(const f of ['character-system.js','lawn-mower.js'])
 vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),sandbox,{filename:f});
const G=sandbox.window.LawnMower;
assert.equal(G.config.speed,72.5,'half of previous 145-unit/second mowing speed');
assert.equal(G.config.mowerHalfWidth,22);
assert.equal(G.config.mowerHalfLength,31);
assert.ok(['setup','update','draw','hud','playerStatus','finish','cutTuft'].every(k=>typeof G[k]==='function'));
const make=(n,bots=true)=>Array.from({length:n},(_,i)=>({
 id:'p'+i,name:'Player '+i,color:['#ee3344','#33ddbb','#ffe34b'][i%3],active:false,isBot:bots,
 input:{axisX:0,axisY:0,action:false,alt:false},score:0
}));
function start(n,seed=1001,bots=true){const ps=make(n,bots),round={phase:'playing',paused:false,lawnSeed:seed};
 const s=G.setup(round,ps);return {ps,round,s};}
for(const n of [1,2,4,6,7,9,12]){
 const {s,ps,round}=start(n);
 assert.equal(s.kind,n<=6?'small':'large');
 assert.equal(s.duration,n<=6?30:60);
 assert.equal(s.grass.length>500,true,'field must contain dense physical clumps');
 assert.equal(new Set(ps.map(p=>p.x.toFixed(2)+':'+p.y.toFixed(2))).size,n,'spawn points unique');
 assert.ok(ps.every(p=>p.active&&p.mower&&p.score===0));
 const t=s.remaining;round.paused=true;G.update(1,round,ps);assert.equal(s.remaining,t);
 round.paused=false;
 const steps=s.duration*60;
 for(let k=0;k<steps+2;k++){
  G.update(1/60,round,ps);
  if(k%7===0)for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
   const hit=G.mowerOverlap(ps[i],ps[j]);
   assert.ok(!hit||hit.depth<.02,'car bodies never visibly intersect, n='+n+' frame '+k);
  }
 }
 assert.equal(s.finished,true,'round ends by clock or fully cleared lawn');
 assert.ok(s.elapsed<=s.duration+1e-7);
 assert.ok(['cleared','timeout'].includes(s.finishReason));
 if(s.finishReason==='cleared')assert.equal(s.cutTotal,s.grass.length);
 assert.equal(s.remaining,0);
 assert.equal(round.remaining,0);
 assert.ok(ps.every(p=>p.score%5===0),'all scores are multiples of five');
 assert.ok(ps.every(p=>p.score>0),'every bot earns real suns at this seed; n='+n);
 assert.ok(s.cutTotal>0,'bots physically cut grass');
 assert.equal(s.grass.filter(t=>t.cut).length,s.cutTotal,'unique grass-cut accounting');
 assert.equal(s.ranking.length,n);
 assert.equal(s.winnerIds.length>=1,true);
 assert.equal(G.update(1/60,round,ps),'winner');
 assert.equal(G.hud(ps,round).remaining,0);
 assert.equal(G.playerStatus(ps[0]).mode,'lawn_mower');
}
// Whole rotated bodies, including riders, wheels and mowing units, must collide.
{const {s,ps}=start(2,201,false),a=ps[0],b=ps[1],f=s.field;
 const cx=f.x+f.w/2,cy=f.y+f.h/2;
 a.x=cx;a.y=cy;b.x=cx;b.y=cy+35;
 a.mower.heading=0;b.mower.heading=0;
 assert.ok(G.mowerOverlap(a,b),'chassis collide even where 17px player circles miss');
 G.resolveMowerCollisions(s,ps);
 assert.equal(G.mowerOverlap(a,b),null,'side-by-side vehicles cannot overlap');
 assert.ok(Math.abs(b.y-a.y)>=44,'all 44 units of physical mower width are solid');
}
// Opposing mowers halt against each other and never swap positions/tunnel through.
{const {s,ps,round}=start(2,202,false),a=ps[0],b=ps[1],f=s.field;
 a.x=f.x+f.w/2-60;b.x=f.x+f.w/2+60;
 a.y=b.y=f.y+f.h/2;
 a.mower.heading=0;b.mower.heading=Math.PI;
 a.input.axisX=1;b.input.axisX=-1;
 let touched=false;
 for(let k=0;k<220;k++){
  G.update(1/60,round,ps);
  assert.ok(a.x<b.x,'head-on colliders must never pass each other');
  const hit=G.mowerOverlap(a,b);
  assert.ok(!hit||hit.depth<.02,'head-on mowing units stay separated');
  if(b.x-a.x<63)touched=true;
 }
 assert.ok(touched,'opposing cars make contact');
}
// Diagonal chassis remain inside the playable field on every edge.
{const {s,ps,round}=start(1,204,false),p=ps[0],f=s.field;
 p.x=f.x+3;p.y=f.y+4;p.mower.heading=Math.PI/4;
 p.input.axisX=-1;p.input.axisY=-1;
 for(let i=0;i<50;i++){
  G.update(1/60,round,ps);
  const ext=G.mowerExtents(p);
  assert.ok(p.x-ext.x>=f.x-.001&&p.y-ext.y>=f.y-.001);
  assert.ok(p.x+ext.x<=f.x+f.w+.001&&p.y+ext.y<=f.y+f.h+.001);
 }
}
// When the very last grass tuft is cut, finish immediately without using timer.
{const {s,ps,round}=start(2,203,false);
 for(const tuft of s.grass)G.cutTuft(s,ps[0],tuft);
 assert.equal(s.cutTotal,s.grass.length);
 assert.equal(G.update(1/60,round,ps),'winner');
 assert.equal(s.finished,true);
 assert.equal(s.finishReason,'cleared');
 assert.ok(s.elapsed<1,'no 30s wait after mowing the field');
 assert.equal(round.remaining,0);
 assert.equal(s.ranking[0].id,ps[0].id);
}
// A single clump pays once even if two cars both cross it.
{const {s,ps}=start(2,99,false),tuft=s.grass[0];
 assert.equal(G.cutTuft(s,ps[0],tuft),true);
 const score=ps[0].score;
 assert.equal(G.cutTuft(s,ps[0],tuft),false);
 assert.equal(G.cutTuft(s,ps[1],tuft),false);
 assert.equal(ps[0].score,score);assert.equal(ps[1].score,0);
}
// No idling, no button-only shortcuts, and joystick cuts real lawn.
{const {s,ps,round}=start(1,147,false),p=ps[0];
 for(let i=0;i<150;i++){p.input.action=true;p.input.alt=true;G.update(1/60,round,ps);}
 assert.equal(s.cutTotal||0,0,'buttons and idle do not cut');
 p.input.axisX=1;p.input.axisY=0;
 for(let i=0;i<80;i++)G.update(1/60,round,ps);
 assert.ok(s.cutTotal>0);
}
// Distribution of 0/1/2/3 sun outcomes approximates 55/15/15/15.
{let hist=[0,0,0,0],sample=0;
 for(let seed=10;seed<28;seed++){
  const {s,ps}=start(1,seed,false),p=ps[0];
  for(const tuft of s.grass){
   const was=p.score;
   G.cutTuft(s,p,tuft);
   const amount=(p.score-was)/5;
   assert.ok([0,1,2,3].includes(amount));hist[amount]++;sample++;
  }
 }
 for(const [i,expected] of [0.55,.15,.15,.15].entries())
  assert.ok(Math.abs(hist[i]/sample-expected)<.026,'sun distribution '+i+': '+hist[i]+'/'+sample);
}
// Board + browser deployment references must remain in sync.
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),
 html=fs.readFileSync(path.join(root,'index.html'),'utf8'),
 board=fs.readFileSync(path.join(root,'board-minigame.js'),'utf8'),
 build=fs.readFileSync(path.join(root,'scripts/build-static.cjs'),'utf8');
for(const re of [/lawn_mower:'LawnMower'/,/endLawnMowerRound/,/renderPhoneLawnStatus/,/lawn-status/])assert.match(app,re);
assert.match(html,/data-pick="lawn_mower"/);assert.match(html,/src="\.\/lawn-mower\.js"/);
assert.match(board,/case 'lawn_mower':/);assert.match(build,/'lawn-mower\.js'/);
console.log('LAWN MOWER: 50% speed, solid rotated chassis, fast grass-clear finish, 1–12 bots, odds and integration PASS');