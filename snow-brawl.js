/* SNOW BRAWL — host-authoritative 60Hz island survival.
 * Snowball weight NEVER modifies walking speed.
 * Released snowballs have NO surface/rolling friction: constant size-based
 * speed until impact, water exit or expiry. Smallest/fastest <= 1.5x largest.
 */
(()=>{
'use strict';
const TAU=Math.PI*2,STEP=1/60,WIDTH=960,HEIGHT=540,CX=480,CY=276;
const C=Object.freeze({
 playerRadius:16,playerMass:1,moveAcceleration:790,maxMoveSpeed:183,
 moveFriction:4.4,impactFriction:1.45,bodyRestitution:.18,
 baseRadius:12,maxRadius:44,growthDistance:920,windup:.4,
 rollSmallSpeed:320,rollLargeSpeed:224,rollMaxAge:5.8,
 flattenTime:.7,flattenImmunity:.3,soloDuration:60,suddenDeathTime:90,
 shrinkSpeed:12,maxImpactSpeed:560,
 // The island size remains proportionate to players (world units).
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
function islandRadius(count){return C.sizes[count<=2?0:count<=4?1:count<=6?2:count<=9?3:4]/2;}
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
  suddenDeath:false};
 round.snowBrawl=s;round.remaining=s.solo?C.soloDuration:null;
 const n=players.length;
 // Equal angular distance and equal radial distance: no center-spawn advantage.
 const spawnR=n===1?0:Math.min(125,r*.37);
 players.forEach((p,i)=>{
  const angle=-Math.PI/2+i*TAU/n;
  p.x=Math.cos(angle)*spawnR;p.y=Math.sin(angle)*spawnR;
  p.vx=0;p.vy=0;p.kvx=0;p.kvy=0;p.dir={x:-Math.cos(angle)||1,y:-Math.sin(angle)};
  p.face=p.dir.x<0?-1:1;p.active=true;p.score=0;
  p.snow={alive:true,ballId:null,phase:'COLLECTING',windup:0,
   flat:0,flatImmunity:0,prevA:false,eliminatedTick:null,eliminatedAt:null,
   faceX:p.dir.x,faceY:p.dir.y,botOrbit:i%2?1:-1,botReplan:0,
   botTarget:null,botAim:false};
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
 const q=opponents.sort((a,c)=>mag(a.x-p.x,a.y-p.y)-mag(c.x-p.x,c.y-p.y))[0];
 const radial=mag(p.x,p.y);
 // Ghosts are not in this game. Bots obey the same acceleration and windup.
 let desiredX=0,desiredY=0;
 if(radial>s.radius*.67){
  desiredX=-p.x;desiredY=-p.y;
 }else if(q){
  const to=normal(q.x-p.x,q.y-p.y);
  const d=mag(q.x-p.x,q.y-p.y);
  if(d>120){desiredX=to.x;desiredY=to.y;}
  else if(d<57){desiredX=-to.x*.3-to.y*b.botOrbit;desiredY=-to.y*.3+to.x*b.botOrbit;}
  else{desiredX=-to.y*b.botOrbit*.65+to.x*.35;
   desiredY=to.x*b.botOrbit*.65+to.y*.35;}
  // Prefer dodging projectiles over standing and repeatedly being hit.
  for(const ball of s.balls){
   if(ball.state!=='ROLLING'||ball.ownerId===p.id)continue;
   const rx=p.x-ball.x,ry=p.y-ball.y;
   const travel=(rx*ball.vx+ry*ball.vy)/(ball.vx*ball.vx+ball.vy*ball.vy);
   if(travel<0||travel>.65)continue;
   const awayX=rx-ball.vx*travel,awayY=ry-ball.vy*travel;
   if(mag(awayX,awayY)<ball.r+47){
    desiredX+=-ball.vy/Math.max(1,mag(ball.vx,ball.vy))*2*b.botOrbit;
    desiredY+=ball.vx/Math.max(1,mag(ball.vx,ball.vy))*2*b.botOrbit;
   }
  }
 }else{
  desiredX=-p.x+Math.sin(s.clock+p.x)*42;
  desiredY=-p.y+Math.cos(s.clock*.7+p.y)*42;
 }
 const v=normal(desiredX,desiredY,0,0);
 const held=ballFor(s,p);
 const d=q?mag(q.x-p.x,q.y-p.y):Infinity;
 let attack=false;
 if(held&&q&&s.clock>b.botReplan&&held.r>=20&&d<Math.max(240,held.r*5.1)){
  const f=normal(b.faceX,b.faceY);
  const aim=normal(q.x-p.x+q.vx*.3,q.y-p.y+q.vy*.3);
  if(f.x*aim.x+f.y*aim.y>.77){
   attack=true;b.botReplan=s.clock+.8;
  }
 }
 return {...v,action:attack};
}
function setHeading(p,x,y,dt){
 const b=p.snow,m=mag(x,y);
 if(m<.12)return;
 const wanted=normal(x,y),before=normal(b.faceX,b.faceY);
 const desired=Math.atan2(wanted.y,wanted.x),prior=Math.atan2(before.y,before.x);
 const delta=Math.atan2(Math.sin(desired-prior),Math.cos(desired-prior));
 const a=prior+clamp(delta,-12*dt,12*dt);
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
 const dir=normal(ball.x-p.x,ball.y-p.y,p.snow.faceX,p.snow.faceY);
 const speed=rollSpeed(ball.r);
 ball.state='ROLLING';ball.vx=dir.x*speed;ball.vy=dir.y*speed;
 ball.ttl=C.rollMaxAge;ball.age=0;
 // The ball has its own independent trajectory and cannot be controlled.
 p.snow.ballId=null;p.snow.phase='COLLECTING';p.snow.windup=0;
 burst(s,ball.x,ball.y,ball.r*.45,'powder',.24);
}
function playerStep(s,p,dt){
 const b=p.snow;if(!b.alive)return;
 b.flat=Math.max(0,b.flat-dt);
 b.flatImmunity=Math.max(0,b.flatImmunity-dt);
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
  const targetX=input.x*C.maxMoveSpeed,targetY=input.y*C.maxMoveSpeed;
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
   if(!owned)owned=makeBall(s,p);
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
  // Smooth spring/contact constraint. Never teleport an attached snowball
  // around a turning player, especially during a sudden 180° turn.
  const dx=targetX-owned.x,dy=targetY-owned.y,d=mag(dx,dy);
  const stepDistance=Math.min(d,(C.maxMoveSpeed+110)*dt);
  if(d>1e-7){
   owned.x+=dx/d*stepDistance;owned.y+=dy/d*stepDistance;
  }
  const away=normal(owned.x-p.x,owned.y-p.y,dir.x,dir.y);
  const gap=mag(owned.x-p.x,owned.y-p.y);
  const minGap=C.playerRadius+owned.r+1;
  if(gap<minGap){owned.x=p.x+away.x*minGap;owned.y=p.y+away.y*minGap;}
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
  const own=ballFor(s,p);if(own)destroy(s,own);
  destroy(s,ball);
  burst(s,p.x,p.y,29,'crush',.56);
 }
}
function ballCollision(s,a,b){
 if(a.state==='DESTROYED'||b.state==='DESTROYED')return;
 const axis=normal(b.x-a.x,b.y-a.y);
 const rel=(b.vx-a.vx)*axis.x+(b.vy-a.vy)*axis.y;
 const j=Math.max(0,-(1+.2)*rel/(1/a.mass+1/b.mass));
 for(const ball of [a,b]){
  if(ball.state!=='ROLLING'){
   const owner=s.roster.find(p=>p.id===ball.ownerId);
   if(owner?.snow?.alive){
    const sign=ball===a?-1:1;
    owner.kvx+=sign*axis.x*Math.min(65,j*.15);
    owner.kvy+=sign*axis.y*Math.min(65,j*.15);
    if(owner.snow.phase==='WINDUP')owner.snow.phase='COLLECTING';
   }
  }
 }
 const x=(a.x+b.x)*.5,y=(a.y+b.y)*.5;
 destroy(s,a,false);destroy(s,b,false);burst(s,x,y,Math.max(a.r,b.r),'snow',.6);
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
  if(event.type==='ball')ballCollision(s,event.a,event.b);
  else if(event.b.state!=='DESTROYED'&&event.p.snow.alive)hitBallPlayer(s,event.b,event.p);
 }
}
function step(dt,round,ps){
 const s=round.snowBrawl;
 if(s.finished)return;
 s.clock+=dt;s.tick++;
 if(s.clock>=C.suddenDeathTime&&!s.solo){
  s.suddenDeath=true;
  s.radius=Math.max(68,s.baseRadius-(s.clock-C.suddenDeathTime)*C.shrinkSpeed);
 }
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
function drawIsland(g,s,t){
 const scale=Math.min(930,480)/(2*(s.baseRadius+29));
 g.fillStyle='#092c4a';g.fillRect(0,0,WIDTH,HEIGHT);
 const sea=g.createRadialGradient(CX,CY,32,CX,CY,510);
 sea.addColorStop(0,'#2b789f');sea.addColorStop(.65,'#125372');
 sea.addColorStop(1,'#08283c');g.fillStyle=sea;g.fillRect(0,0,WIDTH,HEIGHT);
 for(let i=0;i<75;i++){
  const x=(i*193+27)%960,y=(i*137+79)%540;
  const offset=Math.sin(t*.55+i*2.3)*2;
  g.strokeStyle=i%3===0?'#bde4ef30':'#75d4ed19';g.lineWidth=1.3;
  g.beginPath();g.arc(x+offset,y,2+i%4,0,Math.PI*.9);g.stroke();
 }
 // Draw the ice cliff and snow using world-scaled coordinates.
 g.save();g.translate(CX,CY);g.scale(scale,scale);
 circle(g,0,14,s.radius+21,'#16465f');
 circle(g,0,11,s.radius+14,'#32677e');
 circle(g,0,5,s.radius+6,'#7fb6c8');
 const ice=g.createRadialGradient(-s.radius*.25,-s.radius*.28,5,0,0,s.radius);
 ice.addColorStop(0,'#faffff');ice.addColorStop(.55,'#e0f5fd');
 ice.addColorStop(1,'#a6d7e6');
 circle(g,0,0,s.radius,ice);
 g.strokeStyle='#f9ffff';g.lineWidth=7;g.beginPath();g.arc(0,0,s.radius-3,0,TAU);g.stroke();
 const patterngrid=Math.floor(s.radius/14);
 for(let i=0;i<patterngrid*4;i++){
  const a=i*2.39996,rr=Math.sqrt((i+.4)/(patterngrid*4))*s.baseRadius*.95;
  const x=Math.cos(a)*rr,y=Math.sin(a)*rr;
  if(!inside(s,x,y,5))continue;
  circle(g,x,y,(i%4)+.8,i%4===0?'#ffffffa0':'#72b8d524');
 }
 if(s.suddenDeath){
  g.strokeStyle='#f9d98f';g.lineWidth=5;g.setLineDash([10,12]);
  g.beginPath();g.arc(0,0,s.radius-9,0,TAU);g.stroke();g.setLineDash([]);
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
  window.PartyPlayerAvatar.draw(g,p,{time,color:p.color,label:false});
 }else{
  circle(g,p.x,p.y,C.playerRadius,p.color||'#ffc887');
 }
 g.restore();
 g.textAlign='center';g.font='bold 13px system-ui';g.lineWidth=3.5;
 g.strokeStyle='#092b42';g.strokeText(p.name||'ผู้เล่น',p.x,p.y-30);
 g.fillStyle='#ffffff';g.fillText(p.name||'ผู้เล่น',p.x,p.y-30);
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
 ctx.save();ctx.clearRect(0,0,WIDTH,HEIGHT);
 const scale=drawIsland(ctx,s,time);
 // The drawing coordinate system maps a whole island to the 960×540 canvas.
 for(const fx of s.effects){
  ctx.save();ctx.translate(CX+fx.x*scale,CY+fx.y*scale);
  ctx.globalAlpha=Math.max(0,fx.life/fx.max);
  ctx.strokeStyle=fx.kind==='splash'?'#95e0ff':fx.kind==='crush'?'#eafcfc':'#ffffff';
  ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,(fx.r+(1-fx.life/fx.max)*32)*scale,0,TAU);ctx.stroke();
  ctx.restore();
 }
 for(const b of s.balls)if(b.state!=='DESTROYED')drawBall(ctx,b);
 for(const p of ps)drawPerson(ctx,p,time);
 ctx.restore(); // drawIsland leaves a translated/scaled world transform
 ctx.save();
 ctx.fillStyle='#123c58dd';ctx.beginPath();ctx.roundRect(14,12,230,64,11);ctx.fill();
 ctx.fillStyle='#f3fdff';ctx.textAlign='left';ctx.font='900 19px system-ui';
 ctx.fillText('SNOW BRAWL',25,36);
 ctx.font='bold 13px system-ui';
 ctx.fillText(round.phase==='countdown'?'เริ่มใน '+Math.ceil(round.countdown||0):
  'รอด '+alive(ps).length+' คน • '+Math.floor(s.clock)+' วินาที',25,58);
 if(s.suddenDeath){ctx.fillStyle='#ffe19c';ctx.textAlign='right';ctx.font='900 17px system-ui';
  ctx.fillText('SUDDEN DEATH',WIDTH-22,36);}
 ctx.restore();
}
// Diagnostic hooks are pure engine operations used by regression tests.
window.SnowBrawl=Object.freeze({setup,update,draw,hud,step,finish,
 islandRadius,rollSpeed,ballMass,growthRadius,makeBall,ballFor,release,
 destroy,eliminate,solveBallCollisions,resolveBodies,contactTime,
 config:C});
})();
