'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({window:{},console});
vm.runInContext(fs.readFileSync('knight-match.js','utf8'),ctx,{filename:'knight-match.js'});
const K=ctx.window.KnightMatch,plain=x=>JSON.parse(JSON.stringify(x));
const colors=['#ff628c','#3fe4ef','#ffcf62','#ae94ff','#7fe5a0','#ff9b64','#7fb4ff','#f283e9','#e5ed78','#83e1c8','#f8a9b6','#c4aafa'];
const roster=n=>Array.from({length:n},(_,i)=>({id:'p'+i,name:'Knight '+(i+1),color:colors[i],active:true,input:{},isBot:false}));
const game=(n,seed=123)=>{const ps=roster(n),round={phase:'playing',mode:'knight_match',knightSeed:seed};
 K.setup(round,ps);return{ps,round,s:round.knightMatch};};
const tests=[];function test(name,fn){fn();tests.push(name);console.log('PASS',name);}
const normal=s=>s.balloons.filter(b=>b.kind==='normal'&&b.state==='active');
const counts=s=>s.owners.map(o=>normal(s).filter(b=>b.baseOwnerId===o.id).length);
const maxDifference=v=>Math.max(...v)-Math.min(...v);
test('1–12 players: world, circular spawn, normal balloon quotas and unique ids',()=>{
 for(let n=1;n<=12;n++)for(let seed=1;seed<=12;seed++){
  const {ps,s}=game(n,seed),conf=K.dimensions(n),ns=normal(s);
  assert.equal(ns.length,conf.count);
  assert.equal(ps.length,n);assert.equal(new Set(s.balloons.map(b=>b.id)).size,s.balloons.length);
  assert.ok(maxDifference(counts(s))<=1,'color quotas differ by at most one');
  assert.ok(ps.every(p=>K.inside(s,p.x,p.y,22)));
  assert.ok(ns.every(b=>K.inside(s,b.x,b.y,b.radius)));
  for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++)
   assert.ok(Math.hypot(ns[i].x-ns[j].x,ns[i].y-ns[j].y)>=ns[i].radius+ns[j].radius+7);
  for(const b of ns)for(const p of ps)assert.ok(Math.hypot(b.x-p.x,b.y-p.y)>b.radius+22);
 }
});
test('Twelve real player colors each begin with exactly 3 normal balloons',()=>{
 const {s}=game(12,916);
 assert.equal(s.targetCount,36);assert.deepEqual(counts(s),Array(12).fill(3));
 assert.deepEqual(plain([...new Set(normal(s).map(b=>b.baseColor))].sort()),plain([...colors].sort()));
});
test('Pop is an immediate removal, one score per balloon, with a new ID after the timer',()=>{
 const {ps,s}=game(3,52),p=ps[0],b=normal(s).find(q=>q.baseOwnerId===p.id);
 K.startAttack(s,p);const before=normal(s).length,old=b.id;
 assert.equal(K.popBalloon(s,b,p),true);
 assert.equal(b.state,'popped');assert.equal(s.balloons.includes(b),false);
 assert.equal(normal(s).length,before-1);assert.equal(p.score,1);
 assert.equal(K.popBalloon(s,b,p),false);assert.equal(p.score,1);
 assert.equal(s.respawnQueue.length,1);
 s.clock=s.respawnQueue[0].due-.1;K.replenish(s,ps);assert.equal(normal(s).length,before-1);
 s.clock=s.respawnQueue[0].due+.01;K.replenish(s,ps);
 assert.equal(normal(s).length,before);
 assert.equal(s.balloons.some(q=>q.id===old),false,'popped object never revived');
 assert.ok(normal(s).some(q=>q.id>old),'new object has a new id');
 assert.ok(maxDifference(counts(s))<=1);
});
test('Wrong owner is a real -1, negative scores never clamp to zero',()=>{
 const {ps,s}=game(2,77),p=ps[0];
 K.startAttack(s,p);
 for(let i=0;i<4;i++){
  const b=normal(s).find(q=>K.effectiveOwner(s,q)!==p.id);
  assert.ok(b);assert.equal(K.popBalloon(s,b,p),true);
 }
 assert.equal(p.score,-4);assert.equal(s.popped,4);
});
test('Horse proximity alone never pops a balloon or scores',()=>{
 const {ps,round,s}=game(2,178),p=ps[0],b=normal(s)[0];
 p.x=b.x;p.y=b.y;p.input={axisX:0,axisY:0,action:false};
 const old=s.popped,score=p.score;
 for(let i=0;i<35;i++)K.step(1/60,round,ps);
 assert.equal(s.popped,old);assert.equal(p.score,score);
 assert.equal(s.balloons.includes(b),true,'physical collision only pushes');
});
test('Lance swept segment pops only active hitbox contacts; same strike cannot double score',()=>{
 const {ps,s}=game(2,84),p=ps[0],b=normal(s).find(q=>q.baseOwnerId===p.id);
 K.startAttack(s,p);
 const before=p.score;
 K.strike(s,p,ps,{x:b.x-58,y:b.y},{x:b.x+58,y:b.y});
 assert.equal(b.state,'popped');assert.equal(p.score,before+1);
 K.strike(s,p,ps,{x:b.x-58,y:b.y},{x:b.x+58,y:b.y});
 assert.equal(p.score,before+1);
});
test('Rainbow override is visual/score only, never changes base ownership',()=>{
 const {ps,s}=game(3,25),owner=ps[0],other=ps[1];
 const rainbow=s.balloons.find(b=>b.kind==='rainbow')|| (K.spawnRainbow(s,ps),s.balloons.find(b=>b.kind==='rainbow'));
 assert.ok(rainbow);K.startAttack(s,owner);K.popBalloon(s,rainbow,owner);
 assert.equal(s.rainbowOwnerId,owner.id);assert.equal(s.rainbowUntil,s.clock+10);
 assert.ok(s.balloons.every(b=>b.kind!=='rainbow'));
 const b=normal(s).find(b=>b.baseOwnerId===other.id),base=b.baseColor;
 assert.equal(K.effectiveOwner(s,b),owner.id);assert.equal(K.effectiveColor(s,b),owner.color);
 K.popBalloon(s,b,owner);assert.equal(owner.score,1);
 assert.equal(b.baseColor,base);assert.equal(b.state,'popped');
 const another=normal(s).find(b=>b.baseOwnerId===other.id);
 s.clock+=.1;const previously=another.baseColor;
 s.rainbowUntil=s.clock-.001;
 assert.equal(K.effectiveColor(s,another),previously);
 assert.equal(s.balloons.includes(b),false);
});
test('Rainbow respawn preserves baseColor and expired override never restores popped items',()=>{
 const {ps,s}=game(4,91),owner=ps[0];
 const rb=s.balloons.find(b=>b.kind==='rainbow')||(K.spawnRainbow(s,ps),s.balloons.find(b=>b.kind==='rainbow'));
 K.startAttack(s,owner);K.popBalloon(s,rb,owner);
 const b=normal(s)[0],id=b.id;K.popBalloon(s,b,owner);
 s.clock=s.respawnQueue[0].due+.001;K.replenish(s,ps);
 const newborn=normal(s).find(q=>q.id>id&&q.spawnTime>=s.clock-.01);
 assert.ok(newborn,'normal replacement spawns under rainbow override');
 assert.equal(K.effectiveColor(s,newborn),owner.color);
 const base=newborn.baseColor;
 s.clock=s.rainbowUntil+.01;
 assert.equal(K.effectiveColor(s,newborn),base);
 assert.equal(s.balloons.some(q=>q.id===id),false);
 assert.ok(maxDifference(counts(s))<=1);
});
test('Rainbow owner stunned once per attack, timer loses 2 seconds, and immunity blocks repeat',()=>{
 const {ps,s}=game(3,7),attacker=ps[0],victim=ps[1];
 s.rainbowOwnerId=victim.id;s.rainbowUntil=s.clock+10;
 K.startAttack(s,attacker);
 // Prevent incidental normal balloon hits from changing test setup.
 s.balloons=[];
 const pathA={x:victim.x-80,y:victim.y},pathB={x:victim.x+80,y:victim.y};
 K.strike(s,attacker,ps,pathA,pathB);
 assert.equal(victim.km.stun,1);assert.equal(s.rainbowUntil,8);
 K.strike(s,attacker,ps,pathA,pathB);assert.equal(s.rainbowUntil,8);
 victim.km.stun=0;victim.km.immune=.5;
 K.startAttack(s,attacker);K.strike(s,attacker,ps,pathA,pathB);
 assert.equal(s.rainbowUntil,8);
});
test('Fixed 60-second clock, ranking accepts ties and negative scores',()=>{
 const {ps,round,s}=game(4,39);
 ps[0].score=-4;ps[1].score=-4;ps[2].score=2;ps[3].score=2;
 K.finish(s,round,ps);
 assert.equal(s.remaining,0);assert.deepEqual(plain(s.ranking.map(r=>r.rank)),[1,1,3,3]);
 assert.equal(s.winnerIds.length,2);
 const q=game(2,19);q.s.clock=59.99;q.s.remaining=.01;
 assert.equal(K.step(1/60,q.round,q.ps),undefined);assert.equal(q.s.finished,true);
 assert.equal(q.round.remaining,0);
});
test('Repeated combat and spawning never reuse IDs or resurrect old popped balloons',()=>{
 for(let n of [1,2,3,4,6,9,12]){
  const {ps,s,round}=game(n,101+n),p=ps[0],removed=new Set();
  K.startAttack(s,p);
  for(let j=0;j<75;j++){
   const b=normal(s)[Math.floor(j%normal(s).length)];
   if(!b)break;
   removed.add(b.id);assert.equal(K.popBalloon(s,b,p),true);
   s.clock+=.6;K.replenish(s,ps);
   assert.ok(s.balloons.every(b=>!removed.has(b.id)&&b.state==='active'));
   assert.ok(new Set(s.balloons.map(b=>b.id)).size===s.balloons.length);
  }
  s.clock+=3;K.replenish(s,ps);
  for(let j=0;j<300;j++)K.step(1/60,round,ps);
  assert.ok(s.balloons.every(b=>b.state==='active'&&!removed.has(b.id)));
  assert.ok(s.balloons.length<=s.targetCount+1);
 }
});
console.log('KNIGHT MATCH:',tests.length,'suites passed');
