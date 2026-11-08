'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({window:{},console});
vm.runInContext(fs.readFileSync('party-arena-scenes.js','utf8'),ctx,{filename:'party-arena-scenes.js'});
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
test('Rainbow spawn chance is reduced to 2% without changing normal balloon population',()=>{
 assert.equal(K.constants.rainbowChance,.02);
 assert.equal(K.constants.rainbowDuration,10,'rainbow ability duration is unaffected');
 for(let n=1;n<=12;n++){
  const {s}=game(n,900+n);
  assert.equal(normal(s).length,s.targetCount,'normal balloon quota is unchanged');
  assert.ok(s.balloons.filter(b=>b.kind==='rainbow').length<=1,'at most one active rainbow balloon');
 }
});
test('1–12 players: world, circular spawn, normal balloon quotas and unique ids',()=>{
 for(let n=1;n<=12;n++)for(let seed=1;seed<=12;seed++){
  const {ps,s}=game(n,seed),conf=K.dimensions(n),ns=normal(s);
  assert.equal(ns.length,conf.count);
  assert.equal(ps.length,n);assert.equal(new Set(s.balloons.map(b=>b.id)).size,s.balloons.length);
  assert.ok(maxDifference(counts(s))<=1,'color quotas differ by at most one');
  assert.ok(ps.every(p=>K.inside(s,p.x,p.y,K.scales.playerRadius)));
  assert.ok(ns.every(b=>K.inside(s,b.x,b.y,b.radius)));
  for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++)
   assert.ok(Math.hypot(ns[i].x-ns[j].x,ns[i].y-ns[j].y)>=ns[i].radius+ns[j].radius+7);
  for(const b of ns)for(const p of ps)assert.ok(Math.hypot(b.x-p.x,b.y-p.y)>b.radius+K.scales.playerRadius);
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
 for(let i=0;i<4;i++){
  p.km.cooldown=0;assert.equal(K.startAttack(s,p),true);
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
test('Visible silver lance tip and swept hitbox share the same world position',()=>{
 const {ps,s,round}=game(2,256),p=ps[0];p.km.angle=0;p.dir={x:1,y:0};
 const old=K.lanceTip(p,p.km);
 assert.ok(Math.abs(old.x-(p.x+59*K.scales.rider))<.001);
 assert.ok(Math.abs(old.y-(p.y+13*K.scales.rider))<.001);
 const b=normal(s)[0],id=b.id;b.x=p.x+64;b.y=p.y+13*K.scales.rider;
 // Remove other balloons to isolate a single true tip-to-balloon contact.
 s.balloons=[b];p.input={action:true};
 K.step(1/60,round,ps);
 assert.equal(b.state,'popped');
 assert.equal(s.balloons.some(q=>q.id===id),false);
 assert.equal(p.score,K.effectiveOwner(s,b)===p.id?1:-1);
});
test('Rainbow override is visual/score only, never changes base ownership',()=>{
 const {ps,s}=game(3,25),owner=ps[0],other=ps[1];
 const rainbow=s.balloons.find(b=>b.kind==='rainbow')|| (K.spawnRainbow(s,ps),s.balloons.find(b=>b.kind==='rainbow'));
 assert.ok(rainbow);K.startAttack(s,owner);K.popBalloon(s,rainbow,owner);
 assert.equal(s.rainbowOwnerId,owner.id);assert.equal(s.rainbowUntil,s.clock+10);
 assert.ok(s.balloons.every(b=>b.kind!=='rainbow'));
 const b=normal(s).find(b=>b.baseOwnerId===other.id),base=b.baseColor;
 assert.equal(K.effectiveOwner(s,b),owner.id);assert.equal(K.effectiveColor(s,b),owner.color);
 owner.km.cooldown=0;K.startAttack(s,owner);
 K.popBalloon(s,b,owner);assert.equal(owner.score,1);
 assert.equal(b.baseColor,base);assert.equal(b.state,'popped');
 const another=normal(s).find(b=>b.baseOwnerId===other.id);
 s.clock+=.1;const previously=another.baseColor;
 s.rainbowUntil=s.clock-.001;
 assert.equal(K.effectiveColor(s,another),previously);
 assert.equal(s.balloons.includes(b),false);
});
test('Rainbow is the only balloon hit even when a normal balloon follows in the same sweep',()=>{
 const {ps,s}=game(2,410),p=ps[0],normalTarget=normal(s).find(q=>q.baseOwnerId===ps[1].id);
 const rainbow=s.balloons.find(b=>b.kind==='rainbow')||(K.spawnRainbow(s,ps),s.balloons.find(b=>b.kind==='rainbow'));
 assert.ok(rainbow);
 // Deliberately keep the normal balloon FIRST in array order, but Rainbow
 // physically nearer along the lance path.
 s.balloons=[normalTarget,rainbow];
 const start={x:p.x+20,y:p.y},end={x:p.x+140,y:p.y};
 rainbow.x=p.x+55;rainbow.y=p.y;normalTarget.x=p.x+100;normalTarget.y=p.y;
 K.startAttack(s,p);K.strike(s,p,ps,start,end);
 assert.equal(s.rainbowOwnerId,p.id);
 assert.equal(normalTarget.state,'active','rainbow consumes the entire one-balloon quota');
 assert.equal(p.score,0);
 p.km.cooldown=0;K.startAttack(s,p);
 K.strike(s,p,ps,start,end);
 assert.equal(normalTarget.state,'popped');assert.equal(p.score,1);
});
test('Rainbow respawn preserves baseColor and expired override never restores popped items',()=>{
 const {ps,s}=game(4,91),owner=ps[0];
 const rb=s.balloons.find(b=>b.kind==='rainbow')||(K.spawnRainbow(s,ps),s.balloons.find(b=>b.kind==='rainbow'));
 K.startAttack(s,owner);K.popBalloon(s,rb,owner);
 const b=normal(s)[0],id=b.id;
 owner.km.cooldown=0;K.startAttack(s,owner);K.popBalloon(s,b,owner);
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
  for(let j=0;j<75;j++){
   p.km.cooldown=0;K.startAttack(s,p);
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

test('50% movement and dash, 70% rider/hitboxes, 120% balloons use shared constants',()=>{
 assert.equal(K.scales.speed,.5);assert.equal(K.scales.rider,.7);
 assert.equal(K.scales.balloon,1.2);assert.equal(K.scales.playerRadius,22*.7);
 assert.equal(K.scales.lanceTipRadius,8*.7);
 const {ps,round,s}=game(3,83),p=ps[0];p.km.angle=0;
 p.input={axisX:1,axisY:0,action:false};
 const x=p.x,dt=1/60;
 K.step(dt,round,ps);
 const previousBaseSpeed=Math.min(240,s.world.h*.3);
 const expected=previousBaseSpeed*.5*(dt*12)*dt;
 assert.ok(Math.abs(p.x-x-expected)<.00001,'authoritative displacement is half the original');
 const y=p.y;p.km.cooldown=0;K.startAttack(s,p);
 p.km.angle=0;K.step(dt,round,ps);
 assert.ok(p.vx<previousBaseSpeed+K.constants.thrustDash,
  'dash speed is reduced as well');
 assert.equal(p.y,y,'east-facing joust should not alter y');
 for(const b of normal(s))assert.equal(b.radius,(ps.length>=10?21:ps.length>=7?19:16)*1.2);
});
test('Swept contact selects first balloon and consumes exactly one hit across multiple frames',()=>{
 const {ps,s}=game(3,93),p=ps[0],balls=normal(s).slice(0,5);
 s.balloons=[...balls];for(let i=0;i<balls.length;i++){
  balls[i].x=p.x+20+i*37;balls[i].y=p.y;
 }
 K.startAttack(s,p);const score=p.score;
 K.strike(s,p,ps,{x:p.x-20,y:p.y},{x:p.x+200,y:p.y});
 assert.equal(balls[0].state,'popped');
 assert.equal(s.balloons.length,4);
 assert.equal(Math.abs(p.score-score),1);
 K.strike(s,p,ps,{x:p.x-20,y:p.y},{x:p.x+200,y:p.y});
 assert.equal(s.balloons.length,4,'second frame of same thrust cannot pop anything');
 assert.equal(p.km.balloonHitConsumed,true);
 p.km.cooldown=0;assert.equal(K.startAttack(s,p),true);
 assert.equal(p.km.balloonHitConsumed,false);
 K.strike(s,p,ps,{x:p.x-20,y:p.y},{x:p.x+200,y:p.y});
 assert.equal(balls[1].state,'popped');
 assert.equal(s.balloons.length,3);
});
test('First boundary contact wins even if the second balloon center projects earlier',()=>{
 const {ps,s}=game(2,182),p=ps[0],a=normal(s)[0],b=normal(s)[1];
 s.balloons=[b,a];
 a.x=p.x+45;a.y=p.y;a.radius=9;
 b.x=p.x+49;b.y=p.y;b.radius=30;
 K.startAttack(s,p);K.strike(s,p,ps,{x:p.x,y:p.y},{x:p.x+90,y:p.y});
 assert.equal(b.state,'popped','large balloon intersects the swept tip earlier');
 assert.equal(a.state,'active');
});
test('Holding A beyond cooldown makes only one attack until release and re-press',()=>{
 const {ps,round,s}=game(1,201),p=ps[0];
 s.balloons=[];p.input={axisX:0,axisY:0,action:true};
 for(let i=0;i<90;i++)K.step(1/60,round,ps);
 assert.equal(s.nextAttackId,1);
 p.input.action=false;K.step(1/60,round,ps);
 p.input.action=true;K.step(1/60,round,ps);
 assert.equal(s.nextAttackId,2);
});
test('Physical balloon drift is independent, dt-based, bounded and never pops on contact',()=>{
 const {ps,round,s}=game(12,144),b=s.balloons[0];
 const first={x:b.x,y:b.y,phase:b.floatPhase},popped=s.popped;
 assert.ok(s.balloons.some(c=>c.driftVelocity!==b.driftVelocity));
 for(let i=0;i<600;i++){
  K.step(1/60,round,ps);
  for(const balloon of s.balloons){
   assert.ok(K.inside(s,balloon.x,balloon.y,balloon.radius+2),
    'balloons stay inside the fence');
   assert.ok(Math.hypot(balloon.vx,balloon.vy)<=30.00001,'speed cap enforced');
  }
 }
 assert.ok(Math.hypot(b.x-first.x,b.y-first.y)>1,'balloon floats in world space');
 assert.ok(b.floatPhase>first.phase&&Number.isFinite(b.bobOffset));
 assert.equal(s.popped,popped,'unattacked contacts never pop');
 const x=game(2,214),y=game(2,214);
 for(let i=0;i<240;i++)x.ps[0].input.axisX=1,y.ps[0].input.axisX=1,
   K.step(1/60,x.round,x.ps),K.step(1/60,y.round,y.ps);
 assert.equal(x.s.balloons[0].x,y.s.balloons[0].x,'deterministic fixed-step drift');
});
test('Player spacing and lance collision share scaled visual geometry',()=>{
 const {ps,round,s}=game(2,152),a=ps[0],b=ps[1];
 a.x=s.center.x;a.y=s.center.y;b.x=s.center.x+1;b.y=s.center.y;
 a.input={};b.input={};
 K.step(1/60,round,ps);
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=K.scales.playerRadius*2-.3);
 const tip=K.lanceTip(a,{angle:0});
 assert.equal(tip.x,a.x+59*.7);
 assert.equal(tip.y,a.y+13*.7);
});
test('Rainbow gradient covers full clipped body; no extra status HUD appears',()=>{
 const {ps,round,s}=game(2,170),p=ps[0];
 const rb=s.balloons.find(b=>b.kind==='rainbow')||(K.spawnRainbow(s,ps),s.balloons.find(b=>b.kind==='rainbow'));
 assert.ok(rb);
 const gradientStops=[],texts=[],ops=[];
 const paint=new Proxy({},{
  get(_o,key){
   if(key==='createLinearGradient')return ()=>({addColorStop:(p,c)=>gradientStops.push([p,c])});
   if(key==='createRadialGradient')return ()=>({addColorStop(){}});
   if(key==='clip')return ()=>ops.push('clip');
   if(key==='fillText')return (str,x,y)=>texts.push([str,x,y]);
   return ()=>{};
  },set(){return true;}
 });
 s.balloons=[rb];s.effects=[];
 K.draw(paint,0,round,ps);
 assert.ok(ops.includes('clip'),'rainbow gradient is clipped inside the balloon');
 assert.ok(gradientStops.some(([p])=>p===1)&&gradientStops.some(([p])=>p===0));
 assert.ok(gradientStops.length>=7,'seven distinct internal gradient stops');
 assert.equal(texts.filter(t=>t[0]==='RAINBOW POWER').length,0);
 s.rainbowOwnerId=p.id;s.rainbowUntil=s.clock+7.8;
 texts.length=0;K.draw(paint,0,round,ps);
 assert.equal(texts.some(t=>t[0]==='RAINBOW POWER'),false,
  'rainbow state is visual gameplay, never a second HUD');
 assert.ok(Math.abs((s.rainbowUntil-s.clock)-7.8)<1e-6,
  'rainbow effect keeps its actual expiration timer internally');
 s.clock=s.rainbowUntil+.1;s.rainbowOwnerId=null;
 texts.length=0;K.draw(paint,0,round,ps);
 assert.equal(texts.some(t=>t[0]==='RAINBOW POWER'),false);
 assert.ok(!s.obstacles,'scenery has no invisible gameplay colliders');
});

test('Bot-controlled knight approaches a target and pierces one balloon with real lance geometry',()=>{
 const {ps,round,s}=game(2,314),bot=ps[0];
 bot.isBot=true;bot.km.angle=0;
 const target=normal(s).find(b=>b.baseOwnerId===bot.id);
 assert.ok(target);
 s.balloons=[target];
 target.x=bot.x+58;target.y=bot.y;
 const before=bot.x;
 K.step(1/60,round,ps);
 assert.ok(bot.x>before,'bot obeys the same dt-driven movement');
 assert.equal(bot.km.attackId,1,'bot initiated A joust autonomously');
 assert.equal(target.state,'popped','the visible spear tip hits its intended balloon');
 assert.equal(bot.score,1);
});

console.log('KNIGHT MATCH:',tests.length,'suites passed');
