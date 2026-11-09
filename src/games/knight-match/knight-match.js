/* KNIGHT MATCH — host-authoritative jousting and real balloon lifecycles. */
(() => {
'use strict';
const TAU=Math.PI*2,STEP=1/60;
const CONFIG=Object.freeze({duration:60,thrustDuration:.25,thrustDash:160,thrustCooldown:.65,
  lanceReach:66,lanceTipRadius:8,stunDuration:1,stunImmunity:.5,
  rainbowDuration:10,rainbowPenalty:2,rainbowChance:.02,respawnMin:.8,respawnMax:1.8});
const RIDER_SCALE=.7,BALLOON_SIZE_MULTIPLIER=1.2,MOVE_SPEED_MULTIPLIER=.5;
const PLAYER_RADIUS=22*RIDER_SCALE,LANCE_TIP_RADIUS=CONFIG.lanceTipRadius*RIDER_SCALE;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const normal=a=>({x:Math.cos(a),y:Math.sin(a)});
// The lance-tip hitbox is exactly the silver tip drawn at local (59+extension,13).
// Sweeping this point prevents a visual hit without a real registered collision.
function lanceTip(p,k,extension=0){
 const f=normal(k.angle),r={x:-f.y,y:f.x};
 return {x:p.x+RIDER_SCALE*(f.x*(59+extension)+r.x*13),
  y:p.y+RIDER_SCALE*(f.y*(59+extension)+r.y*13)};
}
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const alive=ps=>ps.filter(p=>p.active);
function rand(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x||1234567;return(s.seed>>>0)/4294967296;}
function dimensions(n){
 if(n<=2)return {w:960,h:540,count:12};
 if(n<=4)return {w:1100,h:619,count:16};
 if(n<=6)return {w:1250,h:703,count:20};
 if(n<=9)return {w:1440,h:810,count:24};
 return {w:1600,h:900,count:36};
}
function inside(s,x,y,r=0){return Math.hypot(x-s.center.x,y-s.center.y)<=s.radius-r+1e-6;}
function bound(s,obj,r){
 const dx=obj.x-s.center.x,dy=obj.y-s.center.y,d=Math.hypot(dx,dy);
 const limit=Math.max(0,s.radius-r);
 if(d>limit){const m=limit/d;obj.x=s.center.x+dx*m;obj.y=s.center.y+dy*m;
  if(Number.isFinite(obj.vx)&&Number.isFinite(obj.vy)){
   const dot=(obj.vx*dx+obj.vy*dy)/d;if(dot>0){obj.vx-=dot*dx/d*1.35;obj.vy-=dot*dy/d*1.35;}
  }
 }
}
function quotas(s){
 const n=s.owners.length,counts=new Map(s.owners.map(o=>[o.id,0]));
 for(const b of s.balloons)if(b.kind==='normal'&&b.state==='active')counts.set(b.baseOwnerId,counts.get(b.baseOwnerId)+1);
 for(const q of s.respawnQueue)counts.set(q.ownerId,(counts.get(q.ownerId)||0)+1);
 return counts;
}
function pickOwner(s){
 const counts=quotas(s),n=s.owners.length;
 let minimum=Infinity;
 for(const o of s.owners)minimum=Math.min(minimum,counts.get(o.id));
 for(let j=0;j<n;j++){
  const i=(s.colorCursor+j)%n,o=s.owners[i];
  if(counts.get(o.id)===minimum){s.colorCursor=(i+1)%n;return o;}
 }
 return s.owners[0];
}
function location(s,ps,r,attempts=260){
 const occupants=[...s.balloons,...alive(ps)].filter(b=>b.state===undefined||b.state==='active');
 for(let i=0;i<attempts;i++){
  const a=rand(s)*TAU,mag=Math.sqrt(rand(s))*(s.radius-r-17);
  const pt={x:s.center.x+Math.cos(a)*mag,y:s.center.y+Math.sin(a)*mag};
  if(occupants.every(o=>dist(pt,o)>r+(o.radius||(o.km?PLAYER_RADIUS:22))+8))return pt;
 }
 return null;
}
function floatSettings(s,b){
 b.floatPhase=rand(s)*TAU;b.floatSpeed=.65+rand(s)*.6;
 b.driftVelocity=(rand(s)-.5)*12;b.bobOffset=0;
 return b;
}
function spawnNormal(s,ps,ownerId){
 const pt=location(s,ps,s.balloonRadius);
 if(!pt)return false;
 const owner=s.owners.find(o=>o.id===ownerId);if(!owner)return false;
 s.balloons.push(floatSettings(s,{id:++s.nextBalloonId,kind:'normal',state:'active',
  baseOwnerId:owner.id,baseColor:owner.color,x:pt.x,y:pt.y,vx:0,vy:0,
  radius:s.balloonRadius,spawnTime:s.clock}));
 return true;
}
function spawnRainbow(s,ps){
 if(s.rainbowOwnerId||s.balloons.some(b=>b.kind==='rainbow'))return false;
 const pt=location(s,ps,s.balloonRadius+2*BALLOON_SIZE_MULTIPLIER);
 if(!pt)return false;
 s.balloons.push(floatSettings(s,{id:++s.nextBalloonId,kind:'rainbow',state:'active',
  baseOwnerId:null,baseColor:'rainbow',x:pt.x,y:pt.y,vx:0,vy:0,
  radius:s.balloonRadius+2*BALLOON_SIZE_MULTIPLIER,spawnTime:s.clock}));
 return true;
}
function setup(round,ps){
 if(!ps.length||ps.length>12)throw Error('KNIGHT MATCH supports 1–12 players');
 const world=dimensions(ps.length),people=ps;
 for(const p of people)p.active=true;
 const s={world:{w:world.w,h:world.h},center:{x:world.w/2,y:world.h*.5},
  radius:Math.min(world.w*.33,world.h*.43),targetCount:world.count,
  balloonRadius:(ps.length>=10?21:ps.length>=7?19:16)*BALLOON_SIZE_MULTIPLIER,seed:(Number(round.knightSeed)||(Date.now()^0x5a17c28))>>>0||1,
  clock:0,remaining:CONFIG.duration,accumulator:0,finished:false,
  balloons:[],respawnQueue:[],effects:[],owners:people.map(p=>({id:p.id,color:p.color})),
  colorCursor:0,nextBalloonId:0,nextAttackId:0,ranRainbowAttempt:false,
  rainbowOwnerId:null,rainbowUntil:0,ranking:[],winnerIds:[],roster:ps,spawned:0,popped:0};
 round.knightMatch=s;round.remaining=CONFIG.duration;
 s.colorCursor=Math.floor(rand(s)*ps.length);
 for(let i=0;i<ps.length;i++){
  const p=ps[i],a=-Math.PI/2+TAU*i/ps.length,theta=a+Math.PI;
  const radial=Math.min(s.radius*.66,ps.length>=10?s.radius*.70:s.radius*.62);
  p.x=s.center.x+Math.cos(a)*radial;p.y=s.center.y+Math.sin(a)*radial;
  p.vx=0;p.vy=0;p.score=0;p.dir=normal(theta);p.face=p.dir.x<0?-1:1;
  p.km={angle:theta,turnRate:6.2,stun:0,immune:0,cooldown:0,attackTime:0,
   attackId:0,hitIds:new Set(),balloonHitConsumed:false,actionLatch:false,tip:null,botNext:0,botTarget:null};
 }
 for(let i=0;i<s.targetCount;i++){const owner=pickOwner(s);if(!spawnNormal(s,people,owner.id))
   throw Error('Unable to place balanced KNIGHT MATCH balloons');}
 if(rand(s)<CONFIG.rainbowChance)spawnRainbow(s,people);
 window.PartyArenaScenes?.preload('knight',s);
 return s;
}
function effectiveOwner(s,b){
 return b.kind==='normal'&&s.rainbowOwnerId&&s.clock<s.rainbowUntil?s.rainbowOwnerId:b.baseOwnerId;
}
function effectiveColor(s,b){
 if(b.kind==='rainbow')return null;
 if(s.rainbowOwnerId&&s.clock<s.rainbowUntil)
  return s.owners.find(o=>o.id===s.rainbowOwnerId)?.color||b.baseColor;
 return b.baseColor;
}
function emit(s,x,y,text,color,kind='score'){
 s.effects.push({x,y,text,color,kind,life:.95,full:.95});
 if(s.effects.length>120)s.effects.splice(0,s.effects.length-120);
}
function popBalloon(s,b,p){
 if(!b||b.state!=='active'||!p?.km?.attackId||p.km.balloonHitConsumed)return false;
 const index=s.balloons.indexOf(b);if(index<0)return false;
 // A popped balloon cannot be involved in any further collision or rendering.
 b.state='popped';s.balloons.splice(index,1);s.popped++;
 p.km.balloonHitConsumed=true;
 const hitId='balloon:'+b.id;p.km.hitIds.add(hitId);
 if(b.kind==='rainbow'){
  s.rainbowOwnerId=p.id;s.rainbowUntil=s.clock+CONFIG.rainbowDuration;
  emit(s,b.x,b.y,'RAINBOW POWER',p.color,'rainbow');
 }else{
  const value=effectiveOwner(s,b)===p.id?1:-1;
  p.score=(p.score||0)+value;
  emit(s,b.x,b.y,value>0?'+1':'-1',value>0?'#ffeaa0':'#ff7896');
  const owner=pickOwner(s);
  s.respawnQueue.push({ownerId:owner.id,due:s.clock+CONFIG.respawnMin+
     rand(s)*(CONFIG.respawnMax-CONFIG.respawnMin),oldId:b.id});
 }
 // Particle shards are plain effects, never balloon objects.
 for(let i=0;i<8;i++){
  const a=TAU*(i+rand(s)*.45)/8,k=55+rand(s)*70;
  s.effects.push({kind:'shard',x:b.x,y:b.y,vx:Math.cos(a)*k,vy:Math.sin(a)*k,
    color:b.kind==='rainbow'?'#ffdd87':effectiveColor(s,b),life:.42,full:.42});
 }
 return true;
}
function replenish(s,ps){
 for(let i=s.respawnQueue.length-1;i>=0;i--){
  const q=s.respawnQueue[i];if(q.due>s.clock)continue;
  if(spawnNormal(s,ps,q.ownerId)){
   s.respawnQueue.splice(i,1);
   // One independent chance per real normal spawn. Rainbow is never quota.
   if(!s.rainbowOwnerId&&rand(s)<CONFIG.rainbowChance)spawnRainbow(s,ps);
  }else q.due=s.clock+.2;
 }
}
function segmentDistance(pt,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy||1;
 const t=clamp(((pt.x-a.x)*dx+(pt.y-a.y)*dy)/d,0,1);
 return Math.hypot(pt.x-a.x-dx*t,pt.y-a.y-dy*t);
}
// Earliest segment/circle intersection, not the closest center projection.
// A long frame can cross several balloons: only the first boundary counts.
function sweptCircleEntry(pt,a,b,r){
 const dx=b.x-a.x,dy=b.y-a.y,ax=a.x-pt.x,ay=a.y-pt.y;
 const q=dx*dx+dy*dy,c=ax*ax+ay*ay-r*r;
 if(c<=0)return 0;
 if(q<1e-9)return null;
 const dot=ax*dx+ay*dy,discriminant=dot*dot-q*c;
 if(discriminant<0)return null;
 const t=(-dot-Math.sqrt(discriminant))/q;
 return t>=0&&t<=1?t:null;
}
function startAttack(s,p){
 const k=p.km;if(k.cooldown>0||k.stun>0)return false;
 k.attackId=++s.nextAttackId;k.attackTime=CONFIG.thrustDuration;
 k.cooldown=CONFIG.thrustCooldown;k.hitIds=new Set();
 k.balloonHitConsumed=false;
 k.tip=lanceTip(p,k,0);
 return true;
}
function strike(s,p,ps,prevTip,nextTip){
 const k=p.km;
 if(!k.balloonHitConsumed){
  const candidates=s.balloons.filter(b=>b.state==='active')
   .map(b=>({b,t:sweptCircleEntry(b,prevTip,nextTip,b.radius+LANCE_TIP_RADIUS)}))
   .filter(hit=>hit.t!==null)
   .sort((a,b)=>a.t-b.t||a.b.id-b.b.id);
  if(candidates.length)popBalloon(s,candidates[0].b,p);
 }
 // Player jousting is independent of the one-balloon quota.
 for(const target of alive(ps)){
  if(target.id===p.id||target.km.stun>0||target.km.immune>0)continue;
  const key='player:'+target.id;if(k.hitIds.has(key))continue;
  if(segmentDistance(target,prevTip,nextTip)>PLAYER_RADIUS+LANCE_TIP_RADIUS)continue;
  k.hitIds.add(key);target.km.stun=CONFIG.stunDuration;
  target.vx=0;target.vy=0;target.km.attackTime=0;
  emit(s,target.x,target.y-20,'STUN 1s',p.color,'stun');
  if(s.rainbowOwnerId===target.id&&s.clock<s.rainbowUntil){
   s.rainbowUntil=Math.max(s.clock,s.rainbowUntil-CONFIG.rainbowPenalty);
   emit(s,target.x,target.y-43,'RAINBOW -2s','#ffe58b','stun');
   if(s.rainbowUntil<=s.clock){s.rainbowOwnerId=null;s.rainbowUntil=0;}
  }
 }
}
function input(p){
 const i=p.input||{};
 let x=Number(i.axisX)||Number(!!i.right)-Number(!!i.left);
 let y=Number(i.axisY)||Number(!!i.down)-Number(!!(i.up||i.jump));
 const mag=Math.hypot(x,y);if(mag>1){x/=mag;y/=mag;}
 return{x,y,action:!!i.action};
}
function botControls(s,p,ps){
 const k=p.km;
 let best=null,bestCost=Infinity;
 for(const b of s.balloons){
  if(b.kind!=='rainbow'&&effectiveOwner(s,b)!==p.id)continue;
  const d=dist(p,b),cost=d+(b.kind==='rainbow'?-100:0);
  if(cost<bestCost){best=b;bestCost=cost;}
 }
 if(!best&&s.balloons.length){
  // Under someone else's Rainbow Power, interfere with its owner rather than
  // deliberately pop wrong-color balloons for free negative points.
  const rival=ps.find(q=>q.id===s.rainbowOwnerId);
  if(rival&&rival.id!==p.id)best=rival;
 }
 if(!best)return{x:0,y:0,action:false};
 const dx=best.x-p.x,dy=best.y-p.y,d=Math.hypot(dx,dy)||1;
 const desired=Math.atan2(dy,dx),delta=Math.abs(angleDelta(k.angle,desired));
 const attack=d<CONFIG.lanceReach*RIDER_SCALE+(best.radius||22)+15*RIDER_SCALE&&d>PLAYER_RADIUS&&delta<.24&&
  k.cooldown<=0&&k.stun<=0&&s.clock>=k.botNext;
 if(attack)k.botNext=s.clock+.9+rand(s)*.3;
 return{x:dx/d*(d>42?1:.55),y:dy/d*(d>42?1:.55),action:attack};
}
function separate(s,ps){
 const list=alive(ps),diameter=PLAYER_RADIUS*2;
 for(let pass=0;pass<3;pass++){
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
   const a=list[i],b=list[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.001;
   if(d>=diameter)continue;
   const nx=d<.01?Math.cos(i*2+j):dx/d,ny=d<.01?Math.sin(i*2+j):dy/d,shift=(diameter-d)*.47;
   a.x-=nx*shift;a.y-=ny*shift;b.x+=nx*shift;b.y+=ny*shift;
  }
  for(const p of list)bound(s,p,PLAYER_RADIUS);
 }
}
function balloonPhysics(s,ps,dt){
 const maxSpeed=30,people=alive(ps);
 for(const b of s.balloons){
  b.floatPhase+=dt*b.floatSpeed;
  b.bobOffset=Math.sin(b.floatPhase*.95)*2.4;
  // Float is part of the authoritative world coordinates, never a visual-only offset.
  const wind=Math.sin(s.clock*.37+b.floatPhase*.45)*7;
  const targetVx=b.driftVelocity+wind+Math.sin(b.floatPhase)*5;
  const targetVy=Math.cos(b.floatPhase*.95)*7;
  const response=1-Math.exp(-1.05*dt);
  b.vx+=(targetVx-b.vx)*response;
  b.vy+=(targetVy-b.vy)*response;
  const speed=Math.hypot(b.vx,b.vy);
  if(speed>maxSpeed){b.vx=b.vx/speed*maxSpeed;b.vy=b.vy/speed*maxSpeed;}
  b.x+=b.vx*dt;b.y+=b.vy*dt;
  bound(s,b,b.radius+3);
 }
 for(let pass=0;pass<2;pass++){
  for(let i=0;i<s.balloons.length;i++)for(let j=i+1;j<s.balloons.length;j++){
   const a=s.balloons[i],b=s.balloons[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.001,min=a.radius+b.radius+2;
   if(d>=min)continue;
   const nx=d<.01?1:dx/d,ny=d<.01?0:dy/d,k=(min-d)*.51;
   a.x-=nx*k;a.y-=ny*k;b.x+=nx*k;b.y+=ny*k;
   if(pass===0){a.vx-=nx*3;a.vy-=ny*3;b.vx+=nx*3;b.vy+=ny*3;}
  }
  for(const b of s.balloons)for(const p of people){
   const dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy)||.001,min=b.radius+PLAYER_RADIUS+1;
   if(d>=min)continue;
   const nx=d<.01?Math.cos(s.clock*2+b.id):dx/d,ny=d<.01?Math.sin(s.clock*2+b.id):dy/d;
   const amt=Math.min(12,(min-d)*.85);
   b.x+=nx*amt;b.y+=ny*amt;
   if(pass===0){b.vx+=nx*9;b.vy+=ny*9;}
  }
  for(const b of s.balloons)bound(s,b,b.radius+3);
 }
 for(const b of s.balloons){
  const speed=Math.hypot(b.vx,b.vy);
  if(speed>maxSpeed){b.vx=b.vx/speed*maxSpeed;b.vy=b.vy/speed*maxSpeed;}
 }
}
function finish(s,round,ps){
 s.finished=true;s.remaining=0;round.remaining=0;
 const ranked=alive(ps).slice().sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));
 s.ranking=ranked.map(p=>({id:p.id,score:p.score,rank:1+ranked.filter(q=>q.score>p.score).length}));
 const best=ranked[0]?.score??0;s.winnerIds=ranked.filter(p=>p.score===best).map(p=>p.id);
 s.rainbowOwnerId=null;s.rainbowUntil=0;
}
function step(dt,round,ps){
 const s=round.knightMatch;if(s.finished)return;
 s.clock+=dt;s.remaining=Math.max(0,CONFIG.duration-s.clock);round.remaining=s.remaining;
 if(s.rainbowOwnerId&&s.clock>=s.rainbowUntil){s.rainbowOwnerId=null;s.rainbowUntil=0;}
 const people=alive(ps).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const controls=new Map();
 for(const p of people){
  const k=p.km;
  k.cooldown=Math.max(0,k.cooldown-dt);k.stun=Math.max(0,k.stun-dt);
  if(k.stun===0&&k.wasStunned){k.wasStunned=false;k.immune=CONFIG.stunImmunity;}
  k.immune=Math.max(0,k.immune-dt);
  const v=p.isBot?botControls(s,p,people):input(p);controls.set(p.id,v);
  const pressed=v.action;if(pressed&&!k.actionLatch)startAttack(s,p);
  k.actionLatch=pressed;
  if(k.stun>0){k.wasStunned=true;p.vx*=.6;p.vy*=.6;continue;}
  const mag=Math.hypot(v.x,v.y);
  if(mag>.1){const desired=Math.atan2(v.y,v.x);
   k.angle+=clamp(angleDelta(k.angle,desired),-k.turnRate*dt,k.turnRate*dt);
  }
  const forward=normal(k.angle);
  const speed=mag>.1?clamp(mag,.15,1)*Math.min(240,s.world.h*.30)*MOVE_SPEED_MULTIPLIER:0;
  const dash=k.attackTime>0?CONFIG.thrustDash*MOVE_SPEED_MULTIPLIER:0;
  const vx=forward.x*(speed+dash),vy=forward.y*(speed+dash);
  p.vx+=(vx-p.vx)*Math.min(1,dt*12);p.vy+=(vy-p.vy)*Math.min(1,dt*12);
  p.x+=p.vx*dt;p.y+=p.vy*dt;bound(s,p,PLAYER_RADIUS);
  p.dir={x:forward.x,y:forward.y};p.face=forward.x<0?-1:1;
 }
 separate(s,people);
 for(const p of people){
  const k=p.km;
  if(k.stun>0||k.attackTime<=0){k.visualExtension=0;continue;}
  const previous=k.tip||lanceTip(p,k,0);
  const progress=1-k.attackTime/CONFIG.thrustDuration;
  const extension=20+Math.sin(Math.PI*progress)*15;
  k.visualExtension=extension;
  const tip=lanceTip(p,k,extension);
  strike(s,p,people,previous,tip);k.tip=tip;
  k.attackTime=Math.max(0,k.attackTime-dt);
 }
 balloonPhysics(s,people,dt);replenish(s,people);
 for(const fx of s.effects){fx.life-=dt;if(fx.kind==='shard'){fx.x+=fx.vx*dt;fx.y+=fx.vy*dt;fx.vy+=45*dt;}}
 s.effects=s.effects.filter(fx=>fx.life>0).slice(-120);
 if(s.remaining<=0)finish(s,round,ps);
}
function update(dt,round,ps){
 const s=round.knightMatch;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.25,s.accumulator+clamp(dt,0,.25));
 let ticks=0;while(s.accumulator>=STEP&&ticks++<15&&!s.finished){
  step(STEP,round,ps);s.accumulator-=STEP;
 }
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.knightMatch;
 return{survivors:alive(ps).length,remaining:s?.remaining||0,
   scores:alive(ps).map(p=>({id:p.id,score:p.score})),
   rainbowOwnerId:s?.rainbowOwnerId||null,
   rainbowRemaining:s?.rainbowOwnerId?Math.max(0,s.rainbowUntil-s.clock):0,
   winnerIds:s?.winnerIds||[]};
}
function line(ctx,a,b,color,width){
 ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';
 ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
}
function circle(ctx,x,y,r,color){
 ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
}
function balloonArt(ctx,s,b){
 const x=b.x,y=b.y,r=b.radius,col=effectiveColor(s,b)||'#fff';
 ctx.save();
 // The draw center equals the authoritative collision center even during bobbing.
 circle(ctx,x+3,y+r*.68,r*.72,'#2f241f59');
 const balloonY=y;
 if(b.kind==='rainbow'){
  ctx.save();ctx.beginPath();ctx.arc(x,balloonY,r,0,TAU);ctx.clip();
  const rainbow=ctx.createLinearGradient(x-r,balloonY-r,x+r,balloonY+r);
  ['#ee4054','#ff953a','#ffe66c','#54d47b','#47c8ea','#4f75df','#ae65da']
   .forEach((c,i)=>rainbow.addColorStop(i/6,c));
  ctx.fillStyle=rainbow;ctx.fillRect(x-r,balloonY-r,r*2,r*2);
  const shine=ctx.createRadialGradient(x-r*.35,balloonY-r*.43,r*.07,x,balloonY,r*1.2);
  shine.addColorStop(0,'#ffffff9c');shine.addColorStop(.35,'#ffffff24');
  shine.addColorStop(1,'#17273a44');
  ctx.fillStyle=shine;ctx.fillRect(x-r,balloonY-r,r*2,r*2);
  ctx.restore();
  ctx.strokeStyle='#fef3cfb0';ctx.lineWidth=1.3;
  ctx.beginPath();ctx.arc(x,balloonY,r-.8,0,TAU);ctx.stroke();
 }else{
  const skin=ctx.createRadialGradient(x-r*.32,y-r*.4,r*.08,x,y,r*1.1);
  skin.addColorStop(0,'#fff9ec');skin.addColorStop(.25,col);skin.addColorStop(.8,col);skin.addColorStop(1,'#333c49');
  circle(ctx,x,balloonY,r,skin);
  circle(ctx,x+r*.37,y+r*.24,r*.13,'#201e2544');
 }
 ctx.fillStyle='#ffffffa9';ctx.beginPath();
 ctx.ellipse(x-r*.30,balloonY-r*.36,r*.23,r*.38,-.55,0,TAU);ctx.fill();
 ctx.fillStyle='#f4ddbd';ctx.beginPath();ctx.moveTo(x-3,y+r*.70);
 ctx.lineTo(x+3,y+r*.70);ctx.lineTo(x,y+r*.96);ctx.fill();
 ctx.restore();
}
function draw(ctx,time,round,ps){
 const s=round.knightMatch;if(!s)return;
 ctx.save();ctx.clearRect(0,0,960,540);ctx.scale(960/s.world.w,540/s.world.h);
 window.PartyArenaScenes.knight(ctx,s);
 for(const b of s.balloons)if(b.state==='active')balloonArt(ctx,s,b);
 for(const p of alive(ps).slice().sort((a,b)=>a.y-b.y)){
  const k=p.km,extension=k.visualExtension||0;
  window.PartyArenaScenes.knightHorse(ctx,s,p,RIDER_SCALE,extension);
 }
 for(const fx of s.effects){
  ctx.save();ctx.globalAlpha=clamp(fx.life/fx.full,0,1);
  if(fx.kind==='shard')circle(ctx,fx.x,fx.y,3,fx.color||'#ffda84');
  else{
   ctx.font='900 19px system-ui';ctx.textAlign='center';ctx.lineWidth=3;
   ctx.strokeStyle='#241f28';ctx.strokeText(fx.text,fx.x,fx.y-(1-fx.life/fx.full)*22);
   ctx.fillStyle=fx.color;ctx.fillText(fx.text,fx.x,fx.y-(1-fx.life/fx.full)*22);
  }
  ctx.restore();
 }
 ctx.restore(); // Rainbow state is visible from colored balloons and players.
 // Shared clock is drawn by app.js instead of an overlapping power banner.
}
window.KnightMatch=Object.freeze({resultTitle:"แทงลูกโป่งสีตัวเองให้มากที่สุด!",countdownSeconds:3,setup,update,draw,hud,dimensions,inside,effectiveOwner,
 effectiveColor,popBalloon,spawnNormal,spawnRainbow,replenish,segmentDistance,
 startAttack,strike,lanceTip,finish,step,sweptCircleEntry,scales:Object.freeze({rider:RIDER_SCALE,balloon:BALLOON_SIZE_MULTIPLIER,speed:MOVE_SPEED_MULTIPLIER,playerRadius:PLAYER_RADIUS,lanceTipRadius:LANCE_TIP_RADIUS}),constants:CONFIG});
})();