'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('snow-brawl.js','utf8');
const ctx=vm.createContext({window:{PartyPlayerAvatar:{draw(){}}},Math,Date});
vm.runInContext(code,ctx,{filename:'snow-brawl.js'});
const G=ctx.window.SnowBrawl,C=G.config;
assert.ok(G.setup&&G.update&&G.draw&&G.hud&&G.resolveBodies&&G.contactTime);
const make=(n,bot=false)=>Array.from({length:n},(_,i)=>({
 id:'sb'+i,name:'Snow '+i,color:'#51afe9',type:bot?'local':'remote',
 isBot:bot,active:false,input:{axisX:0,axisY:0,action:false},vx:0,vy:0,score:0
}));
function match(n,bot=false){
 const ps=make(n,bot),round={phase:'playing',paused:false};
 const s=G.setup(round,ps);return{ps,round,s};
}
const tick=(g,n=1,dt=1/60)=>{for(let i=0;i<n;i++)G.update(dt,g.round,g.ps);};
for(let n=1;n<=12;n++){
 const g=match(n),expected=n<=2?235:n<=4?270:n<=6?305:n<=9?345:390;
 assert.equal(g.s.radius,expected,'arena scales with 1–12 participants');
 assert.equal(g.ps.length,n);
 assert.equal(new Set(g.ps.map(p=>p.x.toFixed(5)+','+p.y.toFixed(5))).size,n);
 assert.ok(g.ps.every(p=>Math.hypot(p.x,p.y)+C.playerRadius<g.s.radius));
 assert.ok(g.ps.every(p=>p.snow.alive&&p.snow.ballId===null));
 assert.equal(G.hud(g.ps,g.round).survivors,n);
 if(n>1){
  const rs=g.ps.map(p=>Math.hypot(p.x,p.y));
  assert.ok(Math.max(...rs)-Math.min(...rs)<1e-6,'equal spawn distance from center');
 }
}
assert.equal(C.windup,.4);
assert.equal(C.baseRadius,12);assert.equal(C.maxRadius,44);
assert.equal(G.growthRadius(0),12);
assert.equal(G.growthRadius(C.growthDistance),44);
assert.equal(G.growthRadius(C.growthDistance*20),44);
assert.ok(G.ballMass(44)>G.ballMass(12),'mass follows volume');
assert.ok(G.rollSpeed(12)>G.rollSpeed(44),'small snowballs roll faster');
assert.ok(G.rollSpeed(12)/G.rollSpeed(44)<=1.5,'speed ratio capped at 1.5x');
assert.ok(G.rollSpeed(12)/G.rollSpeed(44)>1,'size affects travel speed');
{
 const one=match(2),two=match(2);
 const p=one.ps[0],q=two.ps[0];
 const giant=G.makeBall(two.s,q);
 giant.distanceRolled=99999;giant.r=44;giant.mass=G.ballMass(44);
 p.input.axisX=1;q.input.axisX=1;
 tick(one,20);tick(two,20);
 assert.ok(Math.abs(p.vx-q.vx)<1e-7,
   'heavy snowball does not change walking acceleration or max speed');
 assert.ok(Math.abs(p.x-q.x)<1e-7,
   'heavy snowball does not slow the actual movement of its owner');
}
{
 const g=match(2),p=g.ps[0];p.input.axisX=1;
 tick(g,35);
 const b=G.ballFor(g.s,p);
 assert.ok(b,'walking creates an independent front snowball');
 assert.ok(b.r>C.baseRadius,'actual movement grows the snowball');
 assert.equal(p.snow.phase,'COLLECTING');
 const before=b.r;p.input.axisX=0;
 tick(g,100); // slight inertia travel cannot grant unbounded growth while idle.
 assert.equal(b.r,before,'releasing the stick stops snow accumulation');
 assert.ok(b.r<=C.maxRadius);
 // The owner must not overlap their snowball.
 assert.ok(Math.hypot(b.x-p.x,b.y-p.y)>=C.playerRadius+b.r-1e-6);
}
{
 const g=match(2),p=g.ps[0];p.input.axisX=1;
 tick(g,8);let ball=G.ballFor(g.s,p);
 assert.ok(ball);
 p.input.action=true;tick(g);
 assert.equal(p.snow.phase,'WINDUP');assert.equal(ball.state,'WINDUP');
 assert.equal(p.vx,0,'charging throw stops walking');
 tick(g,22);
 assert.equal(ball.state,'WINDUP','throw cannot bypass 0.4s windup');
 tick(g,3);
 assert.equal(ball.state,'ROLLING','release occurs automatically');
 assert.equal(p.snow.ballId,null);
 assert.ok(Math.abs(Math.hypot(ball.vx,ball.vy)-G.rollSpeed(ball.r))<1e-6);
 const n=g.s.balls.length;
 tick(g,10);assert.equal(g.s.balls.length,n,'holding A cannot throw again instantly');
}
{
 const g=match(2),p=g.ps[0];p.input.axisX=1;
 tick(g,5);const ball=G.ballFor(g.s,p);
 G.release(g.s,p,ball);
 assert.equal(ball.state,'ROLLING');
 assert.equal(p.snow.ballId,null,'can accumulate next snowball while shot is in flight');
 // The release is an independent moving object: no drag/rolling friction.
 const initial=Math.hypot(ball.vx,ball.vy);
 tick(g,10);
 assert.equal(ball.state,'ROLLING');
 assert.ok(Math.abs(Math.hypot(ball.vx,ball.vy)-initial)<1e-6,
  'released snowball speed stays constant even over time');
 const far=match(2),p2=far.ps[0],ball2=G.makeBall(far.s,p2);
 ball2.r=44;ball2.mass=G.ballMass(44);
 G.release(far.s,p2,ball2);
 assert.ok(Math.hypot(ball.vx,ball.vy)/Math.hypot(ball2.vx,ball2.vy)<=1.5);
}
{
 // Two independent released snowballs collide once and both disappear.
 const g=match(2);
 const a={id:501,state:'ROLLING',ownerId:null,x:-18,y:0,oldX:-18,oldY:0,
  r:12,mass:G.ballMass(12),vx:320,vy:0,age:0,ttl:6,angle:0};
 const b={...a,id:502,x:18,oldX:18,vx:-320};
 g.s.balls=[a,b];
 tick(g,2);
 assert.equal(g.s.balls.length,0,'snowballs smash one another and are removed');
 assert.ok(g.s.effects.length>0);
}
{
 // One released ball gives its physical momentum to its first human target.
 const g=match(2),p=g.ps[0],q=g.ps[1];
 const a={id:600,state:'ROLLING',ownerId:q.id,x:p.x-40,y:p.y,
  oldX:p.x-40,oldY:p.y,r:18,mass:G.ballMass(18),
  vx:320,vy:0,age:0,ttl:6,angle:0};
 g.s.balls=[a];
 tick(g,6);
 assert.ok(p.kvx>0,'impact transfers positive X momentum to target');
 assert.ok(!g.s.balls.some(b=>b.id===600),'shot breaks at first contact');
 assert.equal(p.snow.flat,0,'normal projectile never applies Snow Crush');
}
{
 // Player-to-player chain uses each participant's current velocity.
 const g=match(3),[a,b,c]=g.ps;
 for(const p of g.ps){p.x=0;p.y=0;p.vx=0;p.vy=0;p.kvx=0;p.kvy=0;}
 a.x=-28;b.x=0;c.x=28;
 a.kvx=360;
 const initial=a.kvx+b.kvx+c.kvx;
 G.resolveBodies(g.s,g.ps);
 assert.ok(b.kvx>0,'first human collision receives part of source momentum');
 assert.ok(c.kvx>0,'the second person can transmit momentum to the third');
 assert.ok(a.kvx<360,'A loses momentum instead of copying it to B');
 assert.ok(Math.abs(a.kvx+b.kvx+c.kvx-initial)<1e-7,
  'chain impulses conserve total momentum (no created energy)');
}
{
 // Forming snowball can crush a different human without killing them.
 const g=match(2),[owner,victim]=g.ps;
 owner.x=-35;owner.y=0;victim.x=0;victim.y=0;
 victim.snow.oldX=victim.x;victim.snow.oldY=victim.y;
 const b=G.makeBall(g.s,owner);
 b.x=-21;b.y=0;b.oldX=-30;b.oldY=0;b.vx=250;b.vy=0;
 G.solveBallCollisions(g.s,g.ps);
 assert.ok(victim.snow.flat>0,'moving held snowball flattens victim');
 assert.ok(victim.snow.alive,'Snow Crush is not elimination');
 assert.equal(b.state,'DESTROYED','crushing snowball breaks immediately');
 tick(g,65);
 assert.equal(victim.snow.flat,0,'flattened player automatically recovers');
}
{
 // Simultaneous falls tie, surviving players win, and solo lasts sixty seconds.
 const g=match(4),[a,b,c,d]=g.ps;
 a.x=g.s.radius+30;b.x=-g.s.radius-30;
 tick(g);
 assert.equal(a.snow.alive,false);
 assert.equal(b.snow.alive,false);
 assert.equal(a.snow.eliminatedTick,b.snow.eliminatedTick);
 c.x=g.s.radius+50;tick(g);
 assert.equal(g.s.finished,true);
 assert.deepEqual([...g.s.winnerIds],[d.id]);
 const ranks=Object.fromEntries(g.s.ranking.map(q=>[q.id,q.rank]));
 assert.equal(ranks[a.id],ranks[b.id],'same-frame deaths tie');
 assert.equal(ranks[d.id],1);
 const solo=match(1);
 tick(solo,2);assert.equal(solo.s.finished,false);
 solo.s.clock=59.98;tick(solo,2);
 assert.equal(solo.s.finished,true);
 assert.deepEqual([...solo.s.winnerIds],[solo.ps[0].id]);
}
{
 // Same fixed physics trajectory regardless of calling update at 30 vs 60 fps.
 const a=match(2),b=match(2);
 for(const x of [a,b])x.ps[0].input.axisY=1;
 tick(a,30,1/60);tick(b,15,1/30);
 assert.ok(Math.abs(a.ps[0].x-b.ps[0].x)<1e-7);
 assert.ok(Math.abs(a.ps[0].y-b.ps[0].y)<1e-7);
 assert.ok(Math.abs(a.s.clock-b.s.clock)<1e-7);
}
{
 // Draw is isolated from physics; canvas state is restored after every frame.
 const g=match(2);let saves=0,restores=0;
 const gradient={addColorStop(){}};
 const context=new Proxy({}, {get(_,key){
  if(key==='save')return ()=>{saves++};
  if(key==='restore')return ()=>{restores++};
  if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>gradient;
  return ()=>{};
 },set(){return true;}});
 G.draw(context,1,g.round,g.ps);
 assert.equal(saves,restores,'canvas context stack must be balanced');
}
{
 // Stress: up to 12 bots, 60Hz physics, no NaNs or runaway velocities.
 for(const n of [1,2,6,12]){
  const g=match(n,true);
  for(let i=0;i<120*60&&!g.s.finished;i++)tick(g);
  assert.ok(g.ps.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  assert.ok(g.ps.every(p=>Number.isFinite(p.kvx)&&Number.isFinite(p.kvy)));
  assert.ok(g.s.balls.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)));
  assert.ok(g.s.balls.every(b=>Math.hypot(b.vx,b.vy)<500));
 }
}
console.log('SNOW BRAWL PASS: 1–12 spawns, no weight slowdown, constant rolling speed <= 1.5x, windup, crush, physical chain collisions and bots');
