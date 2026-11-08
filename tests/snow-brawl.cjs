'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('snow-brawl.js','utf8');
const ctx=vm.createContext({window:{PartyPlayerAvatar:{draw(){}}},Math,Date});
vm.runInContext(fs.readFileSync('farm-ice-art.js','utf8'),ctx,{filename:'farm-ice-art.js'});
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
 const g=match(n),expected=n<=2?188:n<=4?216:n<=6?244:n<=9?276:312;
 assert.equal(g.s.radius,expected,'arena scales with 1–12 participants');
 assert.equal(g.ps.length,n);
 assert.equal(new Set(g.ps.map(p=>p.x.toFixed(5)+','+p.y.toFixed(5))).size,n);
 assert.ok(g.ps.every(p=>Math.hypot(p.x,p.y)+C.playerRadius*.75<g.s.radius),
  'each spawn must start inside the actual elimination boundary');
 assert.ok(g.ps.every(p=>Math.abs(g.s.radius-Math.hypot(p.x,p.y)-g.s.radius*.1)<1e-7),
  'each spawn is exactly 10% of the arena radius inward from the edge');
 assert.ok(g.ps.every(p=>p.snow.alive&&p.snow.ballId===null));
 assert.equal(G.hud(g.ps,g.round).survivors,n);
 if(n>1){
  const rs=g.ps.map(p=>Math.hypot(p.x,p.y));
  assert.ok(Math.max(...rs)-Math.min(...rs)<1e-6,'equal spawn distance from center');
 }
}

// Character scale is deliberately local to SNOW BRAWL. Visuals and physics
// must grow together, without modifying the shared sprite or other modes.
{
 assert.equal(C.playerRadius,19.2,'16 world-unit player radius increased by exactly 20%');
 assert.equal(C.avatarScale,1.2,'shared 52px avatar is drawn 20% larger only here');
 const g=match(2),person=g.ps[0];
 let drawing=null;
 const previous=ctx.window.PartyPlayerAvatar.draw;
 ctx.window.PartyPlayerAvatar.draw=(_canvas,p,opts)=>{
  if(p===person)drawing={...opts};
 };
 const gradient={addColorStop(){}};
 const context=new Proxy({}, {get(_,key){
  if(key==='createLinearGradient'||key==='createRadialGradient')return()=>gradient;
  return()=>{};
 },set(){return true;}});
 G.draw(context,1,g.round,g.ps);
 assert.equal(drawing?.scale,1.2,'actual avatar renderer receives new scale');
 assert.equal(drawing?.label,false,'player names stay in the shared roster, away from snowballs');
 ctx.window.PartyPlayerAvatar.draw=previous;
 const q=g.ps[1];
 person.x=-18;person.y=0;q.x=18;q.y=0;
 G.resolveBodies(g.s,g.ps);
 assert.ok(Math.hypot(q.x-person.x,q.y-person.y)>=C.playerRadius*2-1e-6,
  'player-to-player collisions use the enlarged radius');
 const snow=G.makeBall(g.s,person);
 assert.ok(Math.abs(Math.hypot(snow.x-person.x,snow.y-person.y)-
  (C.playerRadius+C.baseRadius+5))<1e-6,
  'new 20% larger player also pushes their snowball farther forward');
 assert.equal(C.maxMoveSpeed,109.8,'walking speed is 40% below the previous 183 units/second');
 assert.equal(C.rollSmallSpeed,320,'snowball launch speed remains unchanged');
 assert.equal(C.rollLargeSpeed,224,'snowball size speed balance remains unchanged');
}

// Changes must affect movement and the physical/visible island, not thrown snowball speeds.
assert.equal(C.arenaScale,.8);
assert.equal(C.spawnInset,.1);
{
 const g=match(2),p=g.ps[0];p.input.axisX=1;
 tick(g,28);
 assert.ok(Math.hypot(p.vx,p.vy)<=109.8+1e-7,'real movement cannot exceed reduced maximum speed');
 assert.ok(Math.hypot(p.vx,p.vy)>100,'player accelerates to new target speed');
}
{
 const g=match(2),scales=[];
 const gradient={addColorStop(){}};
 const ctx=new Proxy({}, {get(_,key){
  if(key==='createRadialGradient'||key==='createLinearGradient')return()=>gradient;
  if(key==='scale')return(x,y)=>{scales.push([x,y]);};
  return()=>{};
 },set(){return true;}});
 G.draw(ctx,0,g.round,g.ps);
 const scale=G.viewScale(g.s);
 assert.ok(Math.abs(scales[0][0]-scale)<1e-9,'snowball and character rendering share the arena camera');
 assert.ok(g.s.radius*scale>=225&&g.s.radius*scale<=226,'the snow surface fills the reference-sized island');
 const before=G.viewScale(g.s);g.s.radius*=.5;
 assert.equal(G.viewScale(g.s),before,'sudden death shrinks the island without zooming in');
}
assert.equal(C.windup,.15);
assert.equal(C.turnRate,3.6,'turning is intentionally slower than the previous 12rad/s');
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
 const g=match(1),p=g.ps[0];p.input.axisX=1;
 tick(g,8);let ball=G.ballFor(g.s,p);
 assert.ok(ball);
 p.input.action=true;tick(g);
 assert.equal(p.snow.phase,'WINDUP');assert.equal(ball.state,'WINDUP');
 assert.equal(p.vx,0,'charging throw stops walking');
 tick(g,7);
 assert.equal(ball.state,'WINDUP','throw cannot bypass 0.15s windup');
 tick(g,5);
 assert.equal(ball.state,'ROLLING','release occurs automatically');
 assert.equal(p.snow.ballId,null);
 assert.ok(Math.abs(Math.hypot(ball.vx,ball.vy)-G.rollSpeed(ball.r))<1e-6);
 const n=g.s.balls.length;
 tick(g,10);assert.equal(g.s.balls.length,n,'holding A cannot throw again instantly');
}
{
 const g=match(1),p=g.ps[0];p.input.axisX=1;
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
 // Rate-limited turning changes actual travel direction and keeps the held
 // physical snowball EXACTLY in front. No snap, teleport or sideways strafing.
 const g=match(1),p=g.ps[0];
 p.snow.faceX=1;p.snow.faceY=0;p.dir={x:1,y:0};
 const ball=G.makeBall(g.s,p);
 p.input.axisX=1;tick(g,8);
 const oldX=p.x,oldY=p.y;
 p.input.axisX=0;p.input.axisY=1;
 let maxStep=0;
 for(let i=0;i<20;i++){
  const beforeX=ball.x,beforeY=ball.y;
  tick(g);
  assert.equal(ball.state,'FORMING','turning does not cancel held ball');
  const dx=ball.x-p.x,dy=ball.y-p.y;
  const facing=p.snow.faceX*dx+p.snow.faceY*dy;
  assert.ok(facing>0,'ball always stays on the facing side');
  assert.ok(Math.abs(facing-(C.playerRadius+ball.r+4))<1e-6,
    'held ball is exactly at the rotating front contact point');
  const lateral=Math.abs(p.snow.faceX*dy-p.snow.faceY*dx);
  assert.ok(lateral<1e-6,'ball never trails beside or behind a sharp turn');
  const traveled=Math.hypot(ball.x-beforeX,ball.y-beforeY);
  maxStep=Math.max(maxStep,traveled);
  assert.ok(traveled<12,'the angular constraint cannot teleport the snowball');
 }
 assert.ok(p.snow.faceX>.15&&p.snow.faceY>.8,
  '20 fixed steps are not an instant ninety-degree snap');
 assert.ok(p.y>oldY&&p.x>oldX,'movement follows the smoothly turned body');
 assert.ok(maxStep<12);
 // Turning 180 degrees requires nearly a whole second rather than reversing
 // the character's velocity the same instant the analog changes direction.
 p.input.axisX=-1;p.input.axisY=0;
 const facingAtStart={x:p.snow.faceX,y:p.snow.faceY};
 tick(g);
 assert.ok(p.snow.faceX*facingAtStart.x+p.snow.faceY*facingAtStart.y>.99,
  'U-turn cannot instantly flip the character or held snowball');
}
{
// Crushing a person from the side OPPOSITE their held ball must not destroy
// the attacking, still-pushed snowball. The victim immediately loses theirs
// and cannot steer away during the 0.7-second crush (knockback may persist).
for(const direction of [1,-1]){
 const g=match(2),[attacker,victim]=g.ps;
 victim.x=0;victim.y=0;
 victim.snow.faceX=direction;victim.snow.faceY=0;
 victim.snow.oldX=0;victim.snow.oldY=0;
 attacker.x=-direction*66.37;attacker.y=0;
 attacker.snow.faceX=direction;attacker.snow.faceY=0;
 attacker.snow.oldX=attacker.x;attacker.snow.oldY=0;
 const pushed=G.makeBall(g.s,attacker);
 const defending=G.makeBall(g.s,victim);
 pushed.x=attacker.x+direction*(C.playerRadius+pushed.r+5);
 pushed.oldX=pushed.x-direction*1.83;
 pushed.y=pushed.oldY=0;
 pushed.vx=direction*C.maxMoveSpeed;pushed.vy=0;
 assert.ok(Math.hypot(pushed.x-defending.x,pushed.y-defending.y)>pushed.r+defending.r,
  'side-impact setup must not overlap the other snowball');
 G.solveBallCollisions(g.s,g.ps);
 assert.equal(pushed.state,'FORMING','pushed attacker snow survives crushing a person');
 assert.equal(attacker.snow.ballId,pushed.id,'attacker remains the holder after crush');
 assert.equal(defending.state,'DESTROYED','victim held snow breaks even on opposite-side crush');
 assert.equal(victim.snow.ballId,null,'victim immediately releases the destroyed ball');
 assert.equal(victim.snow.flat,C.flattenTime,'crush freezes the victim');
 const previousKnockback=victim.kvx;
 G.solveBallCollisions(g.s,g.ps);
 assert.equal(victim.kvx,previousKnockback,
  'one retained held snowball must not stack knockback on an immune victim');
 victim.input.axisX=direction;
 G.step(1/60,g.round,g.ps);
 assert.equal(victim.vx,0,'flattened victim cannot move under joystick input');
 assert.equal(victim.snow.ballId,null,'victim cannot form a new ball while flattened');
 assert.equal(attacker.snow.ballId,pushed.id,'attacker can continue pushing the same ball');
}
}
{
// True held-ball-to-held-ball contact still breaks BOTH balls, as before.
const g=match(2),[left,right]=g.ps;
left.x=-110;left.y=0;right.x=110;right.y=0;
left.snow.faceX=1;left.snow.faceY=0;
right.snow.faceX=-1;right.snow.faceY=0;
left.snow.oldX=left.x;left.snow.oldY=0;
right.snow.oldX=right.x;right.snow.oldY=0;
const a=G.makeBall(g.s,left),b=G.makeBall(g.s,right);
a.oldX=-18;a.x=-10;a.oldY=a.y=0;a.vx=480;
b.oldX=18;b.x=10;b.oldY=b.y=0;b.vx=-480;
G.solveBallCollisions(g.s,g.ps);
assert.equal(a.state,'DESTROYED','direct snowball contact breaks attacker ball');
assert.equal(b.state,'DESTROYED','direct snowball contact breaks defender ball');
assert.equal(left.snow.ballId,null);assert.equal(right.snow.ballId,null);
}
{
 // A fired snowball colliding with an opponent's UNRELEASED ball cancels both,
 // sends physical momentum into the holder, and interrupts charging.
 function impact(shotRadius,heldRadius,charging=false,heldFirst=false,movingToward=false){
  const g=match(2),[holder,shooter]=g.ps;
  holder.x=0;holder.y=0;shooter.x=-205;shooter.y=0;
  holder.vx=movingToward?-70:0;holder.vy=0;
  holder.kvx=holder.kvy=0;
  holder.snow.faceX=-1;holder.snow.faceY=0;
  holder.dir={x:-1,y:0};
  const held=G.makeBall(g.s,holder);
  held.r=heldRadius;held.mass=G.ballMass(heldRadius);
  const gap=C.playerRadius+heldRadius+4;
  held.x=-gap;held.y=0;held.oldX=held.x;held.oldY=held.y;
  if(charging){holder.snow.phase='WINDUP';holder.snow.windup=.12;held.state='WINDUP';}
  const shot={id:60000,state:'ROLLING',ownerId:shooter.id,
   x:held.x-held.r-shotRadius-2,y:0,
   oldX:held.x-held.r-shotRadius-2,oldY:0,
   r:shotRadius,mass:G.ballMass(shotRadius),
   vx:G.rollSpeed(shotRadius),vy:0,age:0,ttl:5.8,angle:0};
  g.s.balls=heldFirst?[held,shot]:[shot,held];
  tick(g);
  assert.equal(held.state,'DESTROYED',
   'held ball must break when a released ball strikes it');
  assert.equal(shot.state,'DESTROYED',
   'the fired ball must also break, cancelling the exchange');
  assert.equal(holder.snow.ballId,null,'holder must start collecting anew');
  assert.equal(holder.snow.phase,'COLLECTING','WINDUP must be cancelled on contact');
  assert.equal(holder.snow.windup,0,'no delayed shot after losing the snowball');
  assert.equal(holder.snow.alive,true,'a blocked snowball is a recoil, not a kill');
  assert.equal(holder.snow.flat,0,'block recoil is not Snow Crush');
  assert.ok(holder.kvx>0,'the shot pushes the HOLDER back, despite their held ball');
  assert.ok(g.s.effects.length>0,'the broken snowball pair has collision FX');
  return holder.kvx;
 }
 const small=impact(12,18,false,false);
 const reversed=impact(12,18,false,true);
 assert.ok(Math.abs(small-reversed)<1e-6,
  'impact direction and amount are independent of snowball array order');
 const large=impact(44,18,false,true);
 assert.ok(large>small*1.2,
  'snowball mass and speed must affect recoil, not a fixed knockback constant');
 const charged=impact(22,22,true);
 assert.ok(charged>0,'a charging player is still pushed by a fired snowball');
 const headOn=impact(12,18,false,false,true);
 assert.ok(headOn>small,'running into an incoming snowball increases recoil');
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
 assert.equal(b.state,'FORMING','crushing a person preserves the attacking snowball');
 owner.x=-120;owner.y=0;owner.vx=0;owner.vy=0; // Leave range, so the victim can recover.
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
console.log('SNOW BRAWL PASS: 1–12 spawns, 0.15s windup, slow turns/front-locked ball, holder recoil, constant rolling speed <= 1.5x, chain impulses and bots');
