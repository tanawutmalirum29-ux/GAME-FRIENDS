/* KNIGHT MATCH — host-authoritative jousting and real balloon lifecycles. */
(() => {
'use strict';
const TAU=Math.PI*2,STEP=1/60;
const CONFIG=Object.freeze({duration:60,thrustDuration:.25,thrustDash:160,thrustCooldown:.65,
  lanceReach:66,lanceTipRadius:8,stunDuration:1,stunImmunity:.5,
  rainbowDuration:10,rainbowPenalty:2,rainbowChance:.08,respawnMin:.8,respawnMax:1.8});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const normal=a=>({x:Math.cos(a),y:Math.sin(a)});
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
  if(occupants.every(o=>dist(pt,o)>r+(o.radius||22)+8))return pt;
 }
 return null;
}
function spawnNormal(s,ps,ownerId){
 const pt=location(s,ps,s.balloonRadius);
 if(!pt)return false;
 const owner=s.owners.find(o=>o.id===ownerId);if(!owner)return false;
 s.balloons.push({id:++s.nextBalloonId,kind:'normal',state:'active',
  baseOwnerId:owner.id,baseColor:owner.color,x:pt.x,y:pt.y,vx:0,vy:0,
  radius:s.balloonRadius,spawnTime:s.clock});
 return true;
}
function spawnRainbow(s,ps){
 if(s.rainbowOwnerId||s.balloons.some(b=>b.kind==='rainbow'))return false;
 const pt=location(s,ps,s.balloonRadius+2);
 if(!pt)return false;
 s.balloons.push({id:++s.nextBalloonId,kind:'rainbow',state:'active',
  baseOwnerId:null,baseColor:'rainbow',x:pt.x,y:pt.y,vx:0,vy:0,
  radius:s.balloonRadius+2,spawnTime:s.clock});
 return true;
}
function setup(round,ps){
 if(!ps.length||ps.length>12)throw Error('KNIGHT MATCH supports 1–12 players');
 const world=dimensions(ps.length),people=ps;
 for(const p of people)p.active=true;
 const s={world:{w:world.w,h:world.h},center:{x:world.w/2,y:world.h*.54},
  radius:Math.min(world.w*.33,world.h*.43),targetCount:world.count,
  balloonRadius:ps.length>=10?21:ps.length>=7?19:16,seed:(Number(round.knightSeed)||(Date.now()^0x5a17c28))>>>0||1,
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
   attackId:0,hitIds:new Set(),actionLatch:false,tip:null,botNext:0,botTarget:null};
 }
 for(let i=0;i<s.targetCount;i++){const owner=pickOwner(s);if(!spawnNormal(s,people,owner.id))
   throw Error('Unable to place balanced KNIGHT MATCH balloons');}
 if(rand(s)<CONFIG.rainbowChance)spawnRainbow(s,people);
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
 if(!b||b.state!=='active'||!p?.km?.attackId)return false;
 const index=s.balloons.indexOf(b);if(index<0)return false;
 // A popped balloon cannot be involved in any further collision or rendering.
 b.state='popped';s.balloons.splice(index,1);s.popped++;
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
function startAttack(s,p){
 const k=p.km;if(k.cooldown>0||k.stun>0)return false;
 k.attackId=++s.nextAttackId;k.attackTime=CONFIG.thrustDuration;
 k.cooldown=CONFIG.thrustCooldown;k.hitIds=new Set();
 const v=normal(k.angle);
 k.tip={x:p.x+v.x*31,y:p.y+v.y*31};
 return true;
}
function strike(s,p,ps,prevTip,nextTip){
 const k=p.km;
 for(const b of [...s.balloons]){
  const key='balloon:'+b.id;
  if(b.state!=='active'||k.hitIds.has(key))continue;
  if(segmentDistance(b,prevTip,nextTip)<=b.radius+CONFIG.lanceTipRadius){
   // Score only at an actual lance-tip sweep. Horse contact is irrelevant.
   popBalloon(s,b,p);
  }
 }
 for(const target of alive(ps)){
  if(target.id===p.id||target.km.stun>0||target.km.immune>0)continue;
  const key='player:'+target.id;if(k.hitIds.has(key))continue;
  if(segmentDistance(target,prevTip,nextTip)>22+CONFIG.lanceTipRadius)continue;
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
 const attack=d<CONFIG.lanceReach+(best.radius||22)+15&&d>24&&delta<.24&&
  k.cooldown<=0&&k.stun<=0&&s.clock>=k.botNext;
 if(attack)k.botNext=s.clock+.9+rand(s)*.3;
 return{x:dx/d*(d>42?1:.55),y:dy/d*(d>42?1:.55),action:attack};
}
function separate(s,ps){
 const list=alive(ps);
 for(let pass=0;pass<3;pass++){
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
   const a=list[i],b=list[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.001;
   if(d>=44)continue;
   const nx=d<.01?Math.cos(i*2+j):dx/d,ny=d<.01?Math.sin(i*2+j):dy/d,shift=(44-d)*.47;
   a.x-=nx*shift;a.y-=ny*shift;b.x+=nx*shift;b.y+=ny*shift;
  }
  for(const p of list)bound(s,p,22);
 }
}
function balloonPhysics(s,ps,dt){
 for(const b of s.balloons){
  b.x+=b.vx*dt;b.y+=b.vy*dt;b.vx*=Math.exp(-2.6*dt);b.vy*=Math.exp(-2.6*dt);
  bound(s,b,b.radius+2);
 }
 for(let pass=0;pass<3;pass++){
  for(let i=0;i<s.balloons.length;i++)for(let j=i+1;j<s.balloons.length;j++){
   const a=s.balloons[i],b=s.balloons[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.001,min=a.radius+b.radius+2;
   if(d>=min)continue;
   const nx=d<.01?1:dx/d,ny=d<.01?0:dy/d,k=(min-d)*.51;
   a.x-=nx*k;a.y-=ny*k;b.x+=nx*k;b.y+=ny*k;
   a.vx-=nx*8;a.vy-=ny*8;b.vx+=nx*8;b.vy+=ny*8;
  }
  for(const b of s.balloons)for(const p of alive(ps)){
   const dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy)||.001,min=b.radius+23;
   if(d>=min)continue;
   const nx=d<.01?Math.cos(s.clock*2):dx/d,ny=d<.01?Math.sin(s.clock*2):dy/d;
   const amt=Math.min(12,(min-d)*.75);
   b.x+=nx*amt;b.y+=ny*amt;b.vx+=nx*55;b.vy+=ny*55;
  }
  for(const b of s.balloons)bound(s,b,b.radius+2);
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
  const speed=mag>.1?clamp(mag,.15,1)*Math.min(240,s.world.h*.30):0;
  const dash=k.attackTime>0?CONFIG.thrustDash:0;
  const vx=forward.x*(speed+dash),vy=forward.y*(speed+dash);
  p.vx+=(vx-p.vx)*Math.min(1,dt*12);p.vy+=(vy-p.vy)*Math.min(1,dt*12);
  p.x+=p.vx*dt;p.y+=p.vy*dt;bound(s,p,22);
  p.dir={x:forward.x,y:forward.y};p.face=forward.x<0?-1:1;
 }
 separate(s,people);
 for(const p of people){
  const k=p.km;
  if(k.stun>0||k.attackTime<=0)continue;
  const previous=k.tip||{x:p.x,y:p.y},v=normal(k.angle);
  const progress=1-k.attackTime/CONFIG.thrustDuration;
  const reach=36+Math.sin(Math.PI*Math.min(.999,progress+.16))*30;
  const tip={x:p.x+v.x*reach,y:p.y+v.y*reach};
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
function scenery(ctx,s){
 const {w,h}=s.world,c=s.center,r=s.radius;
 ctx.fillStyle='#618e63';ctx.fillRect(0,0,w,h);
 for(let i=0;i<80;i++){
  const x=(i*193+53)%w,y=(i*137+29)%h;
  circle(ctx,x,y,2+i%3,'#9dc47c');
 }
 for(let i=0;i<18;i++){
  const a=TAU*i/18,outer=r+46+((i%3)*8);
  const x=c.x+Math.cos(a)*outer,y=c.y+Math.sin(a)*outer;
  if(x<15||x>w-15||y<15||y>h-15)continue;
  if(i%4===0){
   ctx.save();ctx.translate(x,y);ctx.rotate(a+Math.PI/2);
   ctx.fillStyle=i%8===0?'#f5d596':'#cf7892';
   ctx.beginPath();ctx.moveTo(-24,14);ctx.lineTo(0,-30);ctx.lineTo(24,14);ctx.closePath();ctx.fill();
   ctx.fillStyle='#704c37';ctx.fillRect(-24,14,48,5);ctx.restore();
  }else{
   circle(ctx,x,y+7,19,'#30472d');
   circle(ctx,x,y,16,'#467944');circle(ctx,x-4,y-5,10,'#6ca367');
  }
 }
 circle(ctx,c.x,c.y,r+13,'#593d2d');circle(ctx,c.x,c.y,r+6,'#d9ac69');
 circle(ctx,c.x,c.y,r,'#a87a4b');
 circle(ctx,c.x-r*.18,c.y-r*.23,r*.64,'#b98850a0');
 ctx.strokeStyle='#7e5636';ctx.lineWidth=2;ctx.setLineDash?.([16,17]);
 ctx.beginPath();ctx.arc(c.x,c.y,r*.52,0,TAU);ctx.stroke();ctx.setLineDash?.([]);
 // Arena fence is outside walkable circle and cannot obscure balloon hitboxes.
 for(let i=0;i<72;i++){
  const a=TAU*i/72,b=TAU*(i+.82)/72;
  const p={x:c.x+Math.cos(a)*(r+6),y:c.y+Math.sin(a)*(r+6)};
  const q={x:c.x+Math.cos(b)*(r+6),y:c.y+Math.sin(b)*(r+6)};
  line(ctx,p,q,i%3===0?'#f0d8a8':'#805239',6);
  if(i%6===0){circle(ctx,p.x,p.y,5,'#543729');line(ctx,{x:p.x,y:p.y},{x:p.x,y:p.y-33},'#66482f',3);
   ctx.fillStyle=['#cf456e','#5c8ec7','#f4bc4d'][i%3];
   ctx.beginPath();ctx.moveTo(p.x,p.y-33);ctx.lineTo(p.x+19,p.y-25);ctx.lineTo(p.x,p.y-17);ctx.fill();}
 }
}
function balloonArt(ctx,s,b){
 const x=b.x,y=b.y,r=b.radius,col=effectiveColor(s,b)||'#fff';
 ctx.save();
 circle(ctx,x+3,y+r*.65,r*.70,'#2f241f59');
 if(b.kind==='rainbow'){
  const colors=['#f8729a','#ffd761','#79e4bc','#74c5fe','#af8aff'];
  for(let i=colors.length-1;i>=0;i--)circle(ctx,x,y-r*.20,r*(.65+i*.08),colors[i]);
 }else{
  circle(ctx,x,y-r*.18,r,col);
  circle(ctx,x-r*.29,y-r*.54,r*.22,'#ffffff77');
  circle(ctx,x+r*.37,y+r*.24,r*.12,'#201e2544');
 }
 ctx.fillStyle='#f4ddbd';ctx.beginPath();ctx.moveTo(x-3,y+r*.70);
 ctx.lineTo(x+3,y+r*.70);ctx.lineTo(x,y+r*.96);ctx.fill();
 ctx.restore();
}
function horseArt(ctx,p,s){
 const k=p.km,stun=k.stun>0,angle=k.angle;
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);
 circle(ctx,6,7,22,'#2c211d65');
 const leg=Math.sin(s.clock*16+Number(String(p.id).replace(/\D/g,'')))*5;
 ctx.fillStyle='#633d2c';
 for(const x of [-14,13])for(const y of [-13,13]){ctx.beginPath();ctx.ellipse(x+leg*(x>0?1:-1),y,9,5,0,0,TAU);ctx.fill();}
 // Tail, body, mane, neck, head, ears from overhead.
 line(ctx,{x:-25,y:0},{x:-43,y:Math.sin(s.clock*9)*7},'#4d3029',8);
 ctx.fillStyle='#a46c4a';ctx.beginPath();ctx.ellipse(0,0,30,18,0,0,TAU);ctx.fill();
 circle(ctx,14,0,15,'#d49a69');circle(ctx,30,0,11,'#b57a55');
 ctx.fillStyle='#8b5739';ctx.fillRect(23,-11,5,22);
 ctx.fillStyle='#ecdbc4';circle(ctx,34,-7,2,'#2e2626');circle(ctx,34,7,2,'#2e2626');
 // Rider's colored tabard, steel helmet and shield.
 ctx.fillStyle=p.color;ctx.fillRect(-14,-11,23,22);
 circle(ctx,-3,0,11,'#d1dbe0');circle(ctx,0,0,6,'#8097a4');
 line(ctx,{x:-9,y:-3},{x:-24,y:-12},'#eff2ee',4);
 circle(ctx,-21,-12,8,p.color);
 const forward=normal(0),extension=k.attackTime>0?20+Math.sin(Math.PI*(1-k.attackTime/CONFIG.thrustDuration))*15:0;
 line(ctx,{x:2,y:13},{x:45+extension,y:13},'#ebdba1',5);
 for(let i=0;i<5;i++)line(ctx,{x:10+i*10+extension*.75,y:10},{x:15+i*10+extension*.75,y:16},i%2?p.color:'#fff8dd',3);
 ctx.fillStyle='#e6eef4';ctx.beginPath();ctx.moveTo(45+extension,7);
 ctx.lineTo(59+extension,13);ctx.lineTo(45+extension,19);ctx.fill();
 if(stun){circle(ctx,0,-29,5,'#ffe078');circle(ctx,13,-35,4,'#fff1a2');}
 ctx.restore();
 // Name faces the camera, not the horse's rotation.
 ctx.fillStyle='#1e2933dc';ctx.fillRect(p.x-48,p.y-47,96,16);
 ctx.fillStyle=p.color;ctx.textAlign='center';ctx.font='bold 12px system-ui';
 ctx.fillText(String(p.name||p.id).slice(0,14),p.x,p.y-35,90);
}
function draw(ctx,time,round,ps){
 const s=round.knightMatch;if(!s)return;
 ctx.save();ctx.clearRect(0,0,960,540);ctx.scale(960/s.world.w,540/s.world.h);
 scenery(ctx,s);
 for(const b of s.balloons)if(b.state==='active')balloonArt(ctx,s,b);
 for(const p of alive(ps).slice().sort((a,b)=>a.y-b.y))horseArt(ctx,p,s);
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
 const scaleX=s.world.w/960,scaleY=s.world.h/540;
 ctx.restore();
 // Screen-space HUD is independent of world size and leaves the arena visible.
 ctx.fillStyle='#1f2e3ee5';ctx.fillRect(12,10,234,s.rainbowOwnerId?78:57);
 ctx.fillStyle='#fff2dc';ctx.font='900 19px system-ui';ctx.textAlign='left';
 ctx.fillText('KNIGHT MATCH',23,33);
 ctx.font='bold 14px system-ui';
 ctx.fillText(round.phase==='countdown'?'เริ่มใน '+Math.ceil(round.countdown):
  'เหลือ '+Math.ceil(s.remaining)+' วินาที',23,53);
 if(s.rainbowOwnerId){
  const owner=ps.find(p=>p.id===s.rainbowOwnerId);
  ctx.fillStyle=owner?.color||'#ffe8ad';ctx.font='bold 11px system-ui';
  ctx.fillText('RAINBOW '+(owner?.name||'')+' • '+Math.max(0,s.rainbowUntil-s.clock).toFixed(1)+'s',23,74,220);
 }
 ctx.restore();
}
window.KnightMatch=Object.freeze({setup,update,draw,hud,dimensions,inside,effectiveOwner,
 effectiveColor,popBalloon,spawnNormal,spawnRainbow,replenish,segmentDistance,
 startAttack,strike,finish,step,constants:CONFIG});
})();