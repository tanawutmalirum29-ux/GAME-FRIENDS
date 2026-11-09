/* SNOW BRAWL — host-authoritative 60Hz island survival.
 * Snowball weight NEVER modifies walking speed.
 * Released snowballs have NO surface/rolling friction: constant size-based
 * speed until impact, water exit or expiry. Smallest/fastest <= 1.5x largest.
 */
(()=>{
'use strict';
const TAU=Math.PI*2,STEP=1/60,WIDTH=960,HEIGHT=540,CX=480,CY=270;
const C=Object.freeze({
 playerRadius:19.2,avatarScale:1.2,playerMass:1,moveAcceleration:790,maxMoveSpeed:109.8,
 moveFriction:4.4,impactFriction:1.45,bodyRestitution:.18,
 baseRadius:12,maxRadius:44,growthDistance:920,windup:.15,
 turnRate:3.6, // rad/s: ~0.87s for a U-turn instead of the old 0.26s
 rollSmallSpeed:320,rollLargeSpeed:224,rollMaxAge:5.8,
 flattenTime:.7,flattenImmunity:.3,soloDuration:60,suddenDeathTime:90,
 shrinkSpeed:16,botSuddenDeathTime:45,maxImpactSpeed:560,
 // Keep the five player-count tiers, but reduce the real and visible island radius by 20%.
 arenaScale:.8,spawnInset:.1,
 sizes:[470,540,610,690,780]
});
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const mag=(x,y)=>Math.hypot(x,y);
const alive=players=>players.filter(p=>p.active&&p.snow?.alive);
const normal=(x,y,fallbackX=1,fallbackY=0)=>{const m=mag(x,y);return m>1e-9?{x:x/m,y:y/m}:{x:fallbackX,y:fallbackY};};
const inputVector=input=>{
 let x=Number(input?.axisX)||Number(!!input?.right)-Number(!!input?.left);
 let y=Number(input?.axisY)||Number(!!input?.down)-Number(!!input?.jump);
 if(!Number.isFinite(x))x=0;if(!Number.isFinite(y))y=0;
 const m=mag(x,y);return m>1?{x:x/m,y:y/m}:{x,y};
};
function islandRadius(count){return C.sizes[count<=2?0:count<=4?1:count<=6?2:count<=9?3:4]/2*C.arenaScale;}
function rollSpeed(radius){
 const t=clamp((radius-C.baseRadius)/(C.maxRadius-C.baseRadius),0,1);
 return C.rollSmallSpeed+(C.rollLargeSpeed-C.rollSmallSpeed)*t;
}
function ballMass(radius){
 // Relative normalized volume: preserves size-dependent momentum in gameplay units.
 return .28*Math.pow(radius/C.baseRadius,3);
}
function growthRadius(distance){
 return clamp(C.baseRadius+(C.maxRadius-C.baseRadius)*
  Math.sqrt(clamp(distance/C.growthDistance,0,1)),C.baseRadius,C.maxRadius);
}
function inside(s,x,y,margin=0){return mag(x,y)+margin<=s.radius;}
function setup(round,players){
 if(players.length<1||players.length>12)throw Error('SNOW BRAWL supports 1–12 players');
 const r=islandRadius(players.length);
 const s={clock:0,tick:0,accumulator:0,radius:r,baseRadius:r,balls:[],
  nextBallId:1,effects:[],finished:false,ranking:[],winnerIds:[],
  originalCount:players.length,roster:players,solo:players.length===1,
  suddenDeath:false,suddenDeathAt:null};
 round.snowBrawl=s;round.remaining=s.solo?C.soloDuration:null;window.FarmIceArt?.preload('snow');
 const n=players.length;
 // Spawn each player 10% of the island radius inward from its outer rim,
 // evenly distributed around the circumference (including solo sessions).
 const spawnR=r*(1-C.spawnInset);
 players.forEach((p,i)=>{
  const angle=-Math.PI/2+i*TAU/n;
  p.x=Math.cos(angle)*spawnR;p.y=Math.sin(angle)*spawnR;
  p.vx=0;p.vy=0;p.kvx=0;p.kvy=0;p.dir={x:-Math.cos(angle)||1,y:-Math.sin(angle)};
  p.face=p.dir.x<0?-1:1;p.active=true;p.score=0;
  p.snow={alive:true,ballId:null,phase:'COLLECTING',windup:0,
   flat:0,flatImmunity:0,prevA:false,rebuildCooldown:0,eliminatedTick:null,eliminatedAt:null,
   faceX:p.dir.x,faceY:p.dir.y,botOrbit:i%2?1:-1,botReplan:0,
   botTarget:null,botTargetUntil:0,botAim:false,shotsFired:0,
   botProbeX:p.x,botProbeY:p.y,botProbeAt:2.5,botAggroUntil:0};
 });
 return s;
}
function ballFor(s,p){return s.balls.find(b=>b.id===p.snow?.ballId&&b.state!=='DESTROYED')||null;}
function makeBall(s,p){
 if(!p.snow?.alive||p.snow.ballId!=null)return null;
 const f=normal(p.snow.faceX,p.snow.faceY);
 const b={id:s.nextBallId++,ownerId:p.id,state:'FORMING',
  x:p.x+f.x*(C.playerRadius+C.baseRadius+5),
  y:p.y+f.y*(C.playerRadius+C.baseRadius+5),
  oldX:p.x+f.x*(C.playerRadius+C.baseRadius+5),
  oldY:p.y+f.y*(C.playerRadius+C.baseRadius+5),
  vx:0,vy:0,r:C.baseRadius,mass:ballMass(C.baseRadius),
  distanceRolled:0,angle:0,age:0,ttl:C.rollMaxAge};
 s.balls.push(b);p.snow.ballId=b.id;return b;
}
function burst(s,x,y,r,kind='snow',t=.48){
 s.effects.push({x,y,r,kind,life:t,max:t});
 if(s.effects.length>75)s.effects.splice(0,s.effects.length-75);
}
function destroy(s,b,fx=true){
 if(!b||b.state==='DESTROYED')return;
 b.state='DESTROYED';
 const owner=s.roster.find(p=>p.id===b.ownerId);
 if(owner?.snow?.ballId===b.id){
  owner.snow.ballId=null;owner.snow.phase='COLLECTING';owner.snow.windup=0;
 }
 if(fx)burst(s,b.x,b.y,b.r);
}
function eliminate(s,p){
 if(!p?.snow?.alive)return;
 const b=ballFor(s,p);if(b)destroy(s,b);
 p.snow.alive=false;p.snow.phase='DESTROYED';
 p.snow.eliminatedTick=s.tick;p.snow.eliminatedAt=s.clock;
 burst(s,p.x,p.y,35,'splash',.75);
}
function finish(s,round,players){
 if(s.finished)return;
 s.finished=true;
 const survivors=alive(players);
 s.winnerIds=survivors.map(p=>p.id);
 const value=p=>p.snow.alive?Infinity:p.snow.eliminatedTick??-1;
 s.ranking=players.filter(p=>p.active).map(p=>({
  id:p.id,value:value(p),
  rank:1+players.filter(q=>q.active&&value(q)>value(p)).length
 })).sort((a,b)=>a.rank-b.rank||String(a.id).localeCompare(String(b.id)));
 round.remaining=0;
}
function botInput(s,p){
 const b=p.snow;
 const opponents=alive(s.roster).filter(q=>q!==p);
 const nearest=opponents.slice().sort((a,c)=>
  mag(a.x-p.x,a.y-p.y)-mag(c.x-p.x,c.y-p.y))[0]||null;
 // Target locking prevents rapid opponent switching when several bots cross.
 let q=opponents.find(candidate=>candidate.id===b.botTarget)||null;
 if(!q||(nearest&&nearest!==q&&s.clock>=b.botTargetUntil&&
  mag(nearest.x-p.x,nearest.y-p.y)<mag(q.x-p.x,q.y-p.y)*.72)){
  q=nearest;b.botTarget=q?.id??null;b.botTargetUntil=s.clock+1.6;
 }
 const held=ballFor(s,p),radial=mag(p.x,p.y);
 let desiredX=0,desiredY=0,attack=false;
 b.botAim=false;
 if(q){
  const d=mag(q.x-p.x,q.y-p.y);
  const to=normal(q.x-p.x,q.y-p.y);
  const aimTime=held?clamp(d/rollSpeed(held.r)*.7,.06,.3):.15;
  const aim=normal(q.x-p.x+(q.vx+q.kvx)*aimTime,
   q.y-p.y+(q.vy+q.kvy)*aimTime,to.x,to.y);
  const shootingRange=held?Math.max(210,held.r*5.1):210;
  const canAim=!!held&&held.r>=20&&d<shootingRange;
  b.botAim=canAim;
  if(s.clock>=b.botProbeAt){
   // A bot that has made almost no progress must commit to a direct approach
   // rather than repeating the same path around a cluster.
   if(mag(p.x-b.botProbeX,p.y-b.botProbeY)<25&&d>75)
    b.botAggroUntil=s.clock+3;
   b.botProbeX=p.x;b.botProbeY=p.y;b.botProbeAt=s.clock+2.5;
  }
  if(canAim){
   // Heading is movement-coupled. Steer toward the predicted shot until
   // the actual facing vector aligns, then press A to release the ball.
   desiredX=aim.x*.55;desiredY=aim.y*.55;
   const face=normal(b.faceX,b.faceY);
   if(face.x*aim.x+face.y*aim.y>.9&&s.clock>=b.botReplan){
    attack=true;b.botReplan=s.clock+.65;
   }
  }else if((!held||held.r<20)&&d<190){
   // Back away far enough to rebuild a snowball; close-range head-on balls otherwise
   // cancel before either ball grows and the bots get stuck pressing together.
   desiredX=-to.x*.92-to.y*b.botOrbit*.18;
   desiredY=-to.y*.92+to.x*b.botOrbit*.18;
  }else{
   desiredX=to.x;desiredY=to.y;
  }
  // Evade imminent rolling snowballs, but do not orbit absent a real threat.
  for(const ball of s.balls){
   if(ball.state!=='ROLLING'||ball.ownerId===p.id)continue;
   const rx=p.x-ball.x,ry=p.y-ball.y;
   const speedSquared=ball.vx*ball.vx+ball.vy*ball.vy;
   if(speedSquared<1)continue;
   const travel=(rx*ball.vx+ry*ball.vy)/speedSquared;
   if(travel<0||travel>.5)continue;
   const awayX=rx-ball.vx*travel,awayY=ry-ball.vy*travel;
   if(mag(awayX,awayY)<ball.r+C.playerRadius+18){
    const sign=b.botOrbit;
    desiredX+=-ball.vy/Math.sqrt(speedSquared)*1.7*sign;
    desiredY+=ball.vx/Math.sqrt(speedSquared)*1.7*sign;
   }
  }
 }else{
  desiredX=-p.x;desiredY=-p.y;
 }
 // Keep the body inside the kill rim. Retreat only when the chosen motion
 // would remain sideways/outward, so chasing an enemy near the rim still works.
 if(radial>s.radius-C.playerRadius*2.2&&radial>0){
  const inward=normal(-p.x,-p.y);
  const inwardDot=(desiredX*inward.x+desiredY*inward.y)/
   Math.max(.001,mag(desiredX,desiredY));
  if(inwardDot<.2){
   desiredX=inward.x-inward.y*b.botOrbit*.15;
   desiredY=inward.y+inward.x*b.botOrbit*.15;
   attack=false;
  }
 }
 const v=normal(desiredX,desiredY,0,0);
 return {x:v.x*clamp(mag(desiredX,desiredY),0,1),
  y:v.y*clamp(mag(desiredX,desiredY),0,1),action:attack};
}
function setHeading(p,x,y,dt){
 const b=p.snow,m=mag(x,y);
 if(m<.12)return;
 const wanted=normal(x,y),before=normal(b.faceX,b.faceY);
 const desired=Math.atan2(wanted.y,wanted.x),prior=Math.atan2(before.y,before.x);
 const delta=Math.atan2(Math.sin(desired-prior),Math.cos(desired-prior));
 const a=prior+clamp(delta,-C.turnRate*dt,C.turnRate*dt);
 b.faceX=Math.cos(a);b.faceY=Math.sin(a);
 p.dir={x:b.faceX,y:b.faceY};p.face=b.faceX<0?-1:1;
}
function beginWindup(s,p,ball){
 const b=p.snow;
 b.phase='WINDUP';b.windup=C.windup;ball.state='WINDUP';
 p.vx=0;p.vy=0;
}
function release(s,p,ball){
 if(!ball||ball.state==='DESTROYED')return;
 // Launch in the facing direction, including after a turn or windup.
 const dir=normal(p.snow.faceX,p.snow.faceY);
 const speed=rollSpeed(ball.r);
 ball.state='ROLLING';ball.vx=dir.x*speed;ball.vy=dir.y*speed;
 ball.ttl=C.rollMaxAge;ball.age=0;
 // The ball has its own independent trajectory and cannot be controlled.
 p.snow.ballId=null;p.snow.phase='COLLECTING';p.snow.windup=0;
 p.snow.shotsFired=(p.snow.shotsFired||0)+1;
 // Prevent a newly forming ball from immediately hitting the departing shot.
 p.snow.rebuildCooldown=.28;
 burst(s,ball.x,ball.y,ball.r*.45,'powder',.24);
}
function playerStep(s,p,dt){
 const b=p.snow;if(!b.alive)return;
 b.flat=Math.max(0,b.flat-dt);
 b.flatImmunity=Math.max(0,b.flatImmunity-dt);
 b.rebuildCooldown=Math.max(0,b.rebuildCooldown-dt);
 const input=p.isBot?botInput(s,p):inputVector(p.input);
 const pressingA=p.isBot?!!input.action:!!p.input?.action;
 const actionEdge=pressingA&&!b.prevA;
 b.prevA=pressingA;
 const ball=ballFor(s,p);
 if(b.phase==='WINDUP'){
  p.vx=0;p.vy=0;
  b.windup-=dt;
  if(b.windup<=0&&b.flat<=0&&ball)release(s,p,ball);
 }else if(b.flat>0){
  p.vx=0;p.vy=0;
 }else{
  setHeading(p,input.x,input.y,dt);
  // Snowball mass/size has NO effect on acceleration, max speed or turning.
  // Direction changes require turning the BODY, not instantaneous sideways
  // translation on raw analog input. The held snowball uses this same heading.
  const heading=normal(b.faceX,b.faceY);
  const throttle=clamp(mag(input.x,input.y),0,1);
  const targetX=heading.x*throttle*C.maxMoveSpeed;
  const targetY=heading.y*throttle*C.maxMoveSpeed;
  const change=C.moveAcceleration*dt;
  const dvx=targetX-p.vx,dvy=targetY-p.vy,m=mag(dvx,dvy);
  const factor=Math.min(1,change/Math.max(m,1e-9));
  p.vx+=dvx*factor;p.vy+=dvy*factor;
  if(mag(input.x,input.y)<.08){
   const damp=Math.exp(-C.moveFriction*dt);
   p.vx*=damp;p.vy*=damp;
  }
  const speed=mag(p.vx,p.vy);
  if(speed>C.maxMoveSpeed){p.vx*=C.maxMoveSpeed/speed;p.vy*=C.maxMoveSpeed/speed;}
  if(actionEdge&&ball&&ball.r>=C.baseRadius)beginWindup(s,p,ball);
 }
 // Knockback is separate from motor movement, so movement cannot cancel
 // momentum in one frame. Flattened players can still be knocked around.
 p.kvx*=Math.exp(-C.impactFriction*dt);
 p.kvy*=Math.exp(-C.impactFriction*dt);
 const oldX=p.x,oldY=p.y;
 p.x+=(p.vx+p.kvx)*dt;p.y+=(p.vy+p.kvy)*dt;
 const moved=mag(p.x-oldX,p.y-oldY);
 let owned=ballFor(s,p);
 if(b.phase==='COLLECTING'&&b.flat<=0&&mag(input.x,input.y)>.15){
  const along=(p.x-oldX)*input.x+(p.y-oldY)*input.y;
  // Growth counts *actual voluntary travel*, not knockback or idle input.
  if(along>0&&moved>.015){
   if(!owned&&b.rebuildCooldown<=0)owned=makeBall(s,p);
   if(owned){
    owned.distanceRolled+=Math.min(moved,Math.max(0,along));
    owned.r=growthRadius(owned.distanceRolled);
    owned.mass=ballMass(owned.r);
   }
  }
 }
 if(owned&&owned.state!=='DESTROYED'){
  owned.oldX=owned.x;owned.oldY=owned.y;
  const dir=normal(b.faceX,b.faceY);
  const targetX=p.x+dir.x*(C.playerRadius+owned.r+4),
   targetY=p.y+dir.y*(C.playerRadius+owned.r+4);
  // Rotating contact constraint: the real physical ball stays in FRONT
  // of the body at every physics step. A capped turn rate makes its orbital
  // movement continuous (no instantaneous 180-degree teleport).
  // Swept ball/ball and ball/person collisions run on old -> new positions.
  owned.x=targetX;owned.y=targetY;
  owned.vx=(owned.x-owned.oldX)/dt;owned.vy=(owned.y-owned.oldY)/dt;
  owned.angle+=mag(owned.x-owned.oldX,owned.y-owned.oldY)/owned.r;
 }
}
function impulseBodies(a,b,nx,ny,restitution){
 const vaX=a.vx+a.kvx,vaY=a.vy+a.kvy;
 const vbX=b.vx+b.kvx,vbY=b.vy+b.kvy;
 const toward=(vbX-vaX)*nx+(vbY-vaY)*ny;
 if(toward>=0)return 0;
 const j=-(1+restitution)*toward/(1/C.playerMass+1/C.playerMass);
 // Each character gets the opposite share of the same physical impulse.
 a.kvx-=j*nx/C.playerMass;a.kvy-=j*ny/C.playerMass;
 b.kvx+=j*nx/C.playerMass;b.kvy+=j*ny/C.playerMass;
 return j;
}
function resolveBodies(s,ps){
 const colliding=new Set();
 const entries=alive(ps);
 for(let pass=0;pass<4;pass++){
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
   const a=entries[i],b=entries[j],dx=b.x-a.x,dy=b.y-a.y,d=mag(dx,dy);
   if(d>=C.playerRadius*2)continue;
   const n=normal(dx,dy,i<j?1:-1,0);
   const overlap=C.playerRadius*2-d;
   const correct=overlap*.51;
   a.x-=n.x*correct;a.y-=n.y*correct;
   b.x+=n.x*correct;b.y+=n.y*correct;
   const key=i+':'+j;
   if(!colliding.has(key)){
    impulseBodies(a,b,n.x,n.y,C.bodyRestitution);
    colliding.add(key);
   }
  }
 }
}
function contactTime(a,b,r){
 // Swept circle/circle overlap, returns first fraction of a 60Hz step.
 const dx0=a.oldX-b.oldX,dy0=a.oldY-b.oldY;
 const dx=(a.x-a.oldX)-(b.x-b.oldX),dy=(a.y-a.oldY)-(b.y-b.oldY);
 const R=r,aa=dx*dx+dy*dy,bb=2*(dx0*dx+dy0*dy),cc=dx0*dx0+dy0*dy0-R*R;
 if(cc<=0)return 0;
 if(aa<1e-10)return Infinity;
 const discriminant=bb*bb-4*aa*cc;
 if(discriminant<0)return Infinity;
 const t=(-bb-Math.sqrt(discriminant))/(2*aa);
 return t>=0&&t<=1?t:Infinity;
}
function hitBallPlayer(s,ball,p){
 // A pushed snowball remains attached after crushing a player. While the
 // target has crush immunity, ignore repeated held-ball contact entirely:
 // otherwise the same surviving snowball would apply knockback every tick.
 if(ball.state!=='ROLLING'&&p.snow.flatImmunity>0)return;
 const dx=p.x-ball.x,dy=p.y-ball.y;
 const n=normal(dx,dy,ball.vx,ball.vy);
 const rel=(ball.vx-p.vx-p.kvx)*n.x+(ball.vy-p.vy-p.kvy)*n.y;
 const j=Math.max(0,(1+.12)*rel/(1/ball.mass+1/C.playerMass));
 if(j>0){
  const delivered=Math.min(j,C.maxImpactSpeed);
  p.kvx+=n.x*delivered;p.kvy+=n.y*delivered;
 }
 if(p.snow.phase==='WINDUP'){
  p.snow.windup=0;p.snow.phase='COLLECTING';
  const own=ballFor(s,p);if(own&&own.state==='WINDUP')own.state='FORMING';
 }
 if(ball.state==='ROLLING')destroy(s,ball);
 else if(ball.ownerId!==p.id&&p.snow.flatImmunity<=0){
  p.snow.flat=C.flattenTime;p.snow.flatImmunity=C.flattenTime+C.flattenImmunity;
  // The flattened victim drops their held snowball even when hit from a
  // different side. The attacking held snowball DOES NOT break on a person;
  // only actual snowball-to-snowball contact destroys it.
  const own=ballFor(s,p);if(own)destroy(s,own);
  burst(s,p.x,p.y,29,'crush',.56);
 }
}
function ballCollision(s,a,b,t=1){
 if(a.state==='DESTROYED'||b.state==='DESTROYED')return;
 // Collision normal at FIRST contact, not after interpenetration. Prevent
 // reversed recoil when a fast projectile tunnels past a held snowball.
 const ax=a.oldX+(a.x-a.oldX)*t,ay=a.oldY+(a.y-a.oldY)*t;
 const bx=b.oldX+(b.x-b.oldX)*t,by=b.oldY+(b.y-b.oldY)*t;
 const fallback=normal(b.x-a.x,b.y-a.y,1,0);
 const axis=normal(bx-ax,by-ay,fallback.x,fallback.y);
 const rel=(b.vx-a.vx)*axis.x+(b.vy-a.vy)*axis.y;
 // A snowball still being pushed is coupled to its owner. Treat the owner's
 // mass as part of that colliding object so impulses remain physical.
 const ma=a.mass+(a.state==='ROLLING'?0:C.playerMass);
 const mb=b.mass+(b.state==='ROLLING'?0:C.playerMass);
 const impulse=Math.max(0,-(1+.2)*rel/(1/ma+1/mb));
 for(const ball of [a,b]){
  if(ball.state==='ROLLING')continue;
  const owner=s.roster.find(p=>p.id===ball.ownerId);
  if(!owner?.snow?.alive)continue;
  // The launched ball shatters against an unthrown one, but its impact
  // reaches the holder: NO blocking immunity and NO fixed recoil constant.
  // Larger/faster balls deliver more momentum, subject to a safety cap.
  const sign=ball===a?-1:1;
  const coupledMass=ball===a?ma:mb;
  const recoil=clamp(impulse/coupledMass,0,C.maxImpactSpeed);
  owner.kvx+=sign*axis.x*recoil;
  owner.kvy+=sign*axis.y*recoil;
  const speed=mag(owner.kvx,owner.kvy);
  if(speed>C.maxImpactSpeed){
   owner.kvx*=C.maxImpactSpeed/speed;
   owner.kvy*=C.maxImpactSpeed/speed;
  }
  if(owner.snow.phase==='WINDUP')owner.snow.phase='COLLECTING';
 }
 const x=(ax+bx)*.5,y=(ay+by)*.5;
 // Both snowballs cancel, regardless of whether they were held or launched.
 destroy(s,a,false);destroy(s,b,false);
 burst(s,x,y,Math.max(a.r,b.r),'snow',.6);
}
function solveBallCollisions(s,ps){
 const balls=s.balls.filter(b=>b.state!=='DESTROYED');
 const people=alive(ps);
 const events=[];
 for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
  const a=balls[i],b=balls[j];
  const t=contactTime(a,b,a.r+b.r);
  if(Number.isFinite(t))events.push({t,type:'ball',a,b});
 }
 for(const b of balls)for(const p of people){
  if(b.ownerId===p.id)continue;
  const t=contactTime(b,{oldX:p.snow.oldX,oldY:p.snow.oldY,x:p.x,y:p.y},
   b.r+C.playerRadius);
  if(!Number.isFinite(t))continue;
  const moving=(b.vx-p.vx-p.kvx)*(p.x-b.x)+(b.vy-p.vy-p.kvy)*(p.y-b.y);
  if(b.state!=='ROLLING'&&moving<15)continue;
  events.push({t,type:'person',b,p});
 }
 // Earliest impact wins: a snowball cannot strike two people after destruction.
 events.sort((a,b)=>a.t-b.t||String(a.type).localeCompare(String(b.type)));
 for(const event of events){
  if(event.type==='ball')ballCollision(s,event.a,event.b,event.t);
  else if(event.b.state!=='DESTROYED'&&event.p.snow.alive)hitBallPlayer(s,event.b,event.p);
 }
}
function step(dt,round,ps){
 const s=round.snowBrawl;
 if(s.finished)return;
 s.clock+=dt;s.tick++;
 // A bot-only stalemate enters sudden death sooner; human games retain 90s.
 // Starting from the CURRENT clock avoids jumping the rim on transition.
 if(!s.solo&&!s.suddenDeath&&
  (s.clock>=C.suddenDeathTime||
   (s.clock>=C.botSuddenDeathTime&&alive(ps).every(p=>p.isBot)))){
  s.suddenDeath=true;s.suddenDeathAt=s.clock;
 }
 if(s.suddenDeath)
  s.radius=Math.max(0,s.baseRadius-(s.clock-s.suddenDeathAt)*C.shrinkSpeed);
 // Snapshot player positions for continuous swept ball/player collision.
 for(const p of alive(ps)){p.snow.oldX=p.x;p.snow.oldY=p.y;}
 for(const p of alive(ps))playerStep(s,p,dt);
 // A shot is frictionless: velocity magnitude is CONSTANT by radius.
 for(const b of s.balls){
  if(b.state!=='ROLLING')continue;
  b.oldX=b.x;b.oldY=b.y;
  b.x+=b.vx*dt;b.y+=b.vy*dt;b.age+=dt;
  b.angle+=mag(b.vx,b.vy)*dt/b.r;
 }
 resolveBodies(s,ps);
 solveBallCollisions(s,ps);
 // No invisible wall: the player's outer hitbox crossing the ice edge is fatal.
 for(const p of alive(ps))if(!inside(s,p.x,p.y,C.playerRadius*.75))eliminate(s,p);
 for(const b of s.balls){
  if(b.state==='DESTROYED')continue;
  if(!inside(s,b.x,b.y,b.r*.45)||b.age>=b.ttl&&b.state==='ROLLING')destroy(s,b);
 }
 s.balls=s.balls.filter(b=>b.state!=='DESTROYED');
 for(const fx of s.effects)fx.life-=dt;
 s.effects=s.effects.filter(fx=>fx.life>0);
 const remaining=alive(ps).length;
 if(s.solo){
  if(s.clock>=C.soloDuration||remaining===0)finish(s,round,ps);
  else round.remaining=Math.max(0,C.soloDuration-s.clock);
 }else if(remaining<=1)finish(s,round,ps);
}
function update(dt,round,ps){
 const s=round.snowBrawl;
 if(!s)return null;if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.25,s.accumulator+clamp(dt,0,.25));
 let steps=0;
 while(s.accumulator+1e-9>=STEP&&steps++<15&&!s.finished){
  step(STEP,round,ps);s.accumulator-=STEP;
 }
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.snowBrawl;
 return {survivors:alive(ps).length,elapsed:s?.clock||0,remaining:round.remaining,
  winnerIds:s?.winnerIds||[],statuses:ps.filter(p=>p.active).map(p=>({
   id:p.id,alive:!!p.snow?.alive,phase:p.snow?.phase||'DESTROYED',windup:p.snow?.windup||0
  }))};
}
function circle(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
function viewScale(s){
 // Keep the snowy rim in view at all five population tiers. Sudden death uses
 // baseRadius so the retreating edge never causes the camera to zoom back in.
 return Math.min(1.2,226/s.baseRadius);
}
function drawIsland(g,s,t){
 window.FarmIceArt.sea(g,s,t);
 const scale=viewScale(s);
 g.save();g.translate(CX,CY);g.scale(scale,scale);
 window.FarmIceArt.island(g,s);
 if(s.suddenDeath&&s.radius>9){
  g.strokeStyle='#e8c779';g.lineWidth=3;g.setLineDash([8,12]);
  g.beginPath();g.arc(0,0,s.radius-5,0,TAU);g.stroke();g.setLineDash([]);
 }
 return scale;
}
function drawBall(g,b){
 g.save();g.translate(b.x,b.y);
 circle(g,4,7,b.r*1.05,'#31627a40');
 g.rotate(b.angle);
 const snow=g.createRadialGradient(-b.r*.33,-b.r*.45,b.r*.06,0,0,b.r);
 snow.addColorStop(0,'#ffffff');snow.addColorStop(.6,'#d9f5fc');
 snow.addColorStop(1,'#86bcd6');
 circle(g,0,0,b.r,snow);
 g.strokeStyle='#5e9ab8';g.lineWidth=Math.max(1.3,b.r*.075);
 g.beginPath();g.arc(0,0,b.r*.66,-.6,1.8);g.stroke();
 g.beginPath();g.arc(-b.r*.14,b.r*.08,b.r*.34,.7,3.2);g.stroke();
 circle(g,-b.r*.35,-b.r*.43,Math.max(2,b.r*.13),'#ffffff88');
 g.restore();
}
function drawPerson(g,p,time){
 const b=p.snow;if(!b.alive)return;
 const collapsed=b.flat>0;
 g.save();
 if(collapsed){
  g.translate(p.x,p.y);g.scale(1.25,.40);g.translate(-p.x,-p.y);
 }
 if(window.PartyPlayerAvatar?.draw){
  window.PartyPlayerAvatar.draw(g,p,{time,color:p.color,label:false,scale:C.avatarScale});
 }else{
  circle(g,p.x,p.y,C.playerRadius,p.color||'#ffc887');
 }
 g.restore();
 if(b.phase==='WINDUP'){
  g.strokeStyle='#285579';g.lineWidth=5;
  g.beginPath();g.arc(p.x,p.y,C.playerRadius+7,0,TAU);g.stroke();
  g.strokeStyle='#ffe9a1';g.lineWidth=4;
  g.beginPath();g.arc(p.x,p.y,C.playerRadius+7,-Math.PI/2,
   -Math.PI/2+TAU*clamp(1-b.windup/C.windup,0,1));g.stroke();
 }
}
function draw(ctx,time,round,ps){
 const s=round.snowBrawl;if(!s)return;
 ctx.save();window.FarmIceArt.beginScene(ctx,'#1165c8',{fullWidth:true});
 drawIsland(ctx,s,time);
 // The drawing coordinate system maps a whole island to the 960×540 canvas.
 for(const fx of s.effects){
  ctx.save();ctx.translate(fx.x,fx.y);
  ctx.globalAlpha=Math.max(0,fx.life/fx.max);
  ctx.strokeStyle=fx.kind==='splash'?'#95e0ff':fx.kind==='crush'?'#eafcfc':'#ffffff';
  ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,fx.r+(1-fx.life/fx.max)*32,0,TAU);ctx.stroke();
  ctx.restore();
 }
 for(const b of s.balls)if(b.state!=='DESTROYED')drawBall(ctx,b);
 for(const p of ps)drawPerson(ctx,p,time);
 ctx.restore(); // drawIsland leaves a translated/scaled world transform
 // Extra mode/status banners removed; shared centre badge is the only HUD.
 ctx.restore();
}
// Diagnostic hooks are pure engine operations used by regression tests.
window.SnowBrawl=Object.freeze({resultTitle:"ผู้รอดชีวิตคนสุดท้าย!",countdownSeconds:3,setup,update,draw,hud,step,finish,
 islandRadius,viewScale,rollSpeed,ballMass,growthRadius,makeBall,ballFor,release,
 destroy,eliminate,solveBallCollisions,resolveBodies,contactTime,
 config:C});
})();
