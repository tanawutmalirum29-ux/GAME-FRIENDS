/* SHOPPING TIME — four physical conveyor lanes, individual cart checkout. */
(() => {
'use strict';
const STEP=1/60, TAU=Math.PI*2;
const C=Object.freeze({duration:60,capacity:5,productValue:1,bombPenalty:5,stun:1,immunity:1.3,
  speed:126,conveyorSpeed:65,cartDistance:34,cartRadius:17,playerRadius:15,spawnInterval:1.26});
const ITEMS=['banana','watermelon','soda','juice','chips','milk','greens','can','apple'];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const length=(x,y)=>Math.hypot(x,y);
const active=ps=>ps.filter(p=>p.active);
function size(count){return count<=6?{w:960,h:540,kind:'standard'}:{w:1280,h:720,kind:'large'};}
function rng(s){let v=s.seed|0;v^=v<<13;v^=v>>>17;v^=v<<5;s.seed=v||1234567;return (s.seed>>>0)/4294967296;}
const random=(s,a,b)=>a+(b-a)*rng(s);
function lane(s,i){return s.lanes[i];}
function laneAt(s,x,y){
 if(y<s.beltTop||y>s.beltBottom)return null;
 return s.lanes.find(l=>x>=l.x-l.width/2&&x<=l.x+l.width/2)||null;
}
function flowAt(s,x,y){const l=laneAt(s,x,y);return l?l.dir*s.metrics.conveyorSpeed:0;}
function checkout(s,side){
 const u=s.unit,left=side==='left',edge=left?s.arena.x:s.arena.x+s.arena.w;
 // Cashiers and counters occupy the raised shopfront outside the walking
 // boundary. The painted payment mat is inside, reachable by an attached cart.
 return {side,x:edge+(left?41:-41)*u,y:270*u,halfW:25*u,halfH:57*u,
   counter:{x:edge+(left?-40:0)*u,y:177*u,w:40*u,h:186*u},
   cashier:{x:edge+(left?-58:58)*u,y:270*u},
   color:side==='left'?'#d94e57':'#468cde'};
}
function setup(round,players){
 window.PartyCharacters.activate(players);
 const ps=active(players),world=size(ps.length);
 const unit=world.w/960,width=ps.length<=6?488:ps.length<=9?696:744;
 const laneWidth=64*unit,gap=7*unit,pitch=laneWidth+gap,total=4*laneWidth+3*gap;
 const metrics={...C};
 for(const key of ['speed','conveyorSpeed','cartDistance','cartRadius','playerRadius'])metrics[key]*=unit;
 const s={world,unit,metrics,actorScale:1.08*unit,
   arena:{x:(960-width)/2*unit,y:34*unit,w:width*unit,h:472*unit},
   roster:ps,seed:(Number(round.shoppingSeed)||(Date.now()^0x43ae7))>>>0||1,
   clock:0,elapsed:0,remaining:C.duration,duration:C.duration,accumulator:0,finished:false,
   beltTop:34*unit,beltBottom:506*unit,beltLeft:world.w/2-total/2,beltRight:world.w/2+total/2,
   lanes:[],objects:[],nextId:1,effects:[],ranking:[],winnerIds:[],
   checkouts:[],scanned:0};
 for(let i=0;i<4;i++)s.lanes.push({id:i,x:s.beltLeft+laneWidth/2+i*pitch,width:laneWidth,
   dir:i%2===0?-1:1,nextSpawn:.1+i*.17});
 s.checkouts=[checkout(s,'left'),checkout(s,'right')];
 // Same lanes in both maps. Only the walkable sides grow with crowd size.
 const sides=[[],[]];ps.forEach((p,i)=>sides[i%2].push(p));
 for(let k=0;k<2;k++)for(let j=0;j<sides[k].length;j++){
   const p=sides[k][j],x=k===0?s.beltLeft-64*unit:s.beltRight+64*unit;
   const y=s.arena.y+s.arena.h*(j+1)/(sides[k].length+1);
   p.x=x;p.y=y;p.score=0;p.vx=0;p.vy=0;
   const angle=k===0?0:Math.PI;
   p.dir={x:Math.cos(angle),y:Math.sin(angle)};p.face=k===0?1:-1;
   p.shopping={basket:[],paid:0,bombs:0,stun:0,immune:0,angle,vx:0,vy:0,flow:0,
     cartX:x+Math.cos(angle)*s.metrics.cartDistance,cartY:y+Math.sin(angle)*s.metrics.cartDistance,
     botDecision:0,botGoal:'collect',targetId:null};
 }
 round.shoppingTime=s;round.remaining=C.duration;
 window.PartyArenaScenes?.preload('shopping',s);
 return s;
}
// Shopping carts are rigidly attached to the owner. Their position must never
// lag behind, interpolate independently, or be clamped separately at a wall.
function cartPosition(s,p){
 const q=p.shopping,d=s.metrics.cartDistance;
 q.cartX=p.x+Math.cos(q.angle)*d;
 q.cartY=p.y+Math.sin(q.angle)*d;
}
function playerInput(p){
 const k=p.input||{},ax=Number(k.axisX)||0,ay=Number(k.axisY)||0;
 let x=ax,y=ay;if(length(x,y)<.08){x=Number(!!k.right)-Number(!!k.left);y=Number(!!k.down)-Number(!!k.jump);}
 const m=length(x,y);return m>1?{x:x/m,y:y/m}:m<.08?{x:0,y:0}:{x,y};
}
function insideCheckout(zone,x,y,r=0){
 return Math.abs(x-zone.x)<=zone.halfW+r&&Math.abs(y-zone.y)<=zone.halfH+r;
}
function nearestCheckout(s,p){
 return s.checkouts.reduce((a,b)=>length(p.x-a.x,p.y-a.y)<=length(p.x-b.x,p.y-b.y)?a:b);
}
function botInput(s,p){
 const q=p.shopping,u=s.unit;
 // Scanned goods are already safe scores, so bots make partial checkout trips.
 const bank=q.basket.length>=C.capacity||
   q.basket.length>=3&&s.remaining<24||
   q.basket.length>=2&&s.remaining<10||
   q.basket.length>0&&s.remaining<length(p.x-nearestCheckout(s,p).x,p.y-nearestCheckout(s,p).y)/s.metrics.speed+2.5;
 let goal;
 if(bank){q.botGoal='checkout';goal=nearestCheckout(s,p);}
 else{
   q.botGoal='collect';
   const candidates=s.objects.filter(o=>o.kind==='item'&&o.active&&
       !s.objects.some(b=>b.kind==='bomb'&&b.active&&b.lane===o.lane&&Math.abs(b.y-o.y)<50*u));
   let best=null,bestCost=Infinity;
   for(const o of candidates){
     const travel=length(o.x-p.x,o.y-p.y)/s.metrics.speed;
     const y=clamp(o.y+o.dir*s.metrics.conveyorSpeed*Math.min(travel,.9),s.beltTop+18*u,s.beltBottom-18*u);
     const cost=length(o.x-p.x,y-p.y)+(q.targetId===o.id?-34*u:0);
     if(cost<bestCost){bestCost=cost;best={o,x:o.x,y};}
   }
   if(best){q.targetId=best.o.id;goal={x:best.x,y:best.y};}
   else{
     q.targetId=null;
     // Move to a predictable collection lane rather than idling.
     const l=s.lanes[Math.floor((String(p.id).length+s.seed%4+3)%4)];
     goal={x:l.x,y:s.world.h*.5};
   }
 }
 let x=goal.x-p.x,y=goal.y-p.y;
 // A cart must reach the checkout, not just the character centre.
 if(q.botGoal==='checkout'&&length(x,y)<s.metrics.cartDistance+11*u){x=goal.x-q.cartX;y=goal.y-q.cartY;}
 const imminent=s.objects.find(o=>o.kind==='bomb'&&o.active&&
   Math.abs(o.x-q.cartX)<45*u&&Math.abs(o.y-q.cartY)<95*u&&
   length(o.x-q.cartX,o.y-q.cartY)<105*u);
 if(imminent){
   const dodge=(q.cartX<=imminent.x?-1:1);
   x+=dodge*165*u;y-=(imminent.dir||1)*75*u;
 }
 const dist=length(x,y);
 return dist<5*u?{x:0,y:0}:{x:x/dist,y:y/dist};
}
function constrain(s,p,x,y){
 const b=s.arena,q=p.shopping,d=s.metrics.cartDistance;
 const fx=Math.cos(q.angle)*d,fy=Math.sin(q.angle)*d;
 const pr=s.metrics.playerRadius,cr=s.metrics.cartRadius;
 // Constrain the WHOLE connected pair so the basket stays in front even
 // when the joystick aims toward a wall or conveyor corners.
 return {
  x:clamp(x,Math.max(b.x+pr,b.x+cr-fx),Math.min(b.x+b.w-pr,b.x+b.w-cr-fx)),
  y:clamp(y,Math.max(b.y+pr,b.y+cr-fy),Math.min(b.y+b.h-pr,b.y+b.h-cr-fy))
 };
}
function steering(p,v){
 const q=p.shopping;
 if(length(v.x,v.y)<.09)return;
 // Immediate heading, same simulation tick as the joystick change.
 q.angle=Math.atan2(v.y,v.x);
 p.dir={x:Math.cos(q.angle),y:Math.sin(q.angle)};
 p.face=p.dir.x<0?-1:1;
}
function movePlayer(s,p,dt,v){
 const q=p.shopping,from={x:p.x,y:p.y};
 steering(p,v);
 // A tight turn next to a wall backs the owner up; never detaches the cart.
 const safe=constrain(s,p,p.x,p.y);p.x=safe.x;p.y=safe.y;
 cartPosition(s,p);
 const gain=clamp(dt*10,0,1),speed=s.metrics.speed*(p.isBot?.89:1);
 q.vx+=(v.x*speed-q.vx)*gain;q.vy+=(v.y*speed-q.vy)*gain;
 const localFlow=flowAt(s,p.x,p.y)*.70+flowAt(s,q.cartX,q.cartY)*.30;
 q.flow+=(localFlow-q.flow)*clamp(dt*11,0,1);
 const pos=constrain(s,p,p.x+q.vx*dt,p.y+(q.vy+q.flow)*dt);
 p.x=pos.x;p.y=pos.y;p.vx=(p.x-from.x)/dt;p.vy=(p.y-from.y)/dt;
 cartPosition(s,p);
}
// Shoves move the owner and basket as one physical assembly.
function shiftCartOwner(s,p,dx,dy){
 const at=constrain(s,p,p.x+dx,p.y+dy);
 p.x=at.x;p.y=at.y;
 cartPosition(s,p);
}
// Both carts and bodies are solid. Each contact shifts the *whole* owner,
// preserving the cart offset and allowing an approaching player to push another.
function shoppingContact(s,a,b,ax,ay,bx,by,minDistance,pass){
 let dx=bx-ax,dy=by-ay,dist=length(dx,dy);
 if(dist>=minDistance-1e-5)return;
 // Choose a stable push direction at coincident cart centres, but preserve
 // the actual zero separation for overlap correction.
 let normalLength=dist;
 if(normalLength<1e-5){
  dx=b.x-a.x;dy=b.y-a.y;normalLength=length(dx,dy);
  if(normalLength<1e-5){dx=String(a.id)<String(b.id)?1:-1;dy=0;normalLength=1;}
 }
 const nx=dx/normalLength,ny=dy/normalLength,qa=a.shopping,qb=b.shopping;
 const avx=qa.vx,avy=qa.vy+qa.flow,bvx=qb.vx,bvy=qb.vy+qb.flow;
 const closing=(avx-bvx)*nx+(avy-bvy)*ny;
 // Fast incoming carts have more leverage; equal opposing pushes balance.
 const driveA=Math.max(0,avx*nx+avy*ny),driveB=Math.max(0,-bvx*nx-bvy*ny);
 const powerA=1+Math.min(1.5,driveA/s.metrics.speed)*1.8;
 const powerB=1+Math.min(1.5,driveB/s.metrics.speed)*1.8;
 const shareA=powerB/(powerA+powerB);
 const correction=Math.min(8*s.unit,minDistance-dist+.12*s.unit);
 shiftCartOwner(s,a,-nx*correction*shareA,-ny*correction*shareA);
 shiftCartOwner(s,b,nx*correction*(1-shareA),ny*correction*(1-shareA));
 // Transfer a small amount of forward momentum once per contact per tick.
 // This makes a moving cart genuinely push a stationary person/cart.
 if(pass===0&&closing>10){
  const impulse=Math.min(42*s.unit,closing*.16);
  qa.vx=clamp(qa.vx-nx*impulse*shareA,-s.metrics.speed,s.metrics.speed);
  qa.vy=clamp(qa.vy-ny*impulse*shareA,-s.metrics.speed,s.metrics.speed);
  qb.vx=clamp(qb.vx+nx*impulse*(1-shareA),-s.metrics.speed,s.metrics.speed);
  qb.vy=clamp(qb.vy+ny*impulse*(1-shareA),-s.metrics.speed,s.metrics.speed);
 }
}
function collide(s,players,dt){
 // 60 Hz host-authoritative simulation: stable for 1–12 mixed bot/human players.
 // Exclude a cart's own owner; the two are attached at cartDistance.
 for(let pass=0;pass<4;pass++){

  window.PartyCharacters.resolve(players,{radius:s.metrics.playerRadius,
    bounds:s.arena,
    iterations:1,maxShift:7*s.unit,pressure:true,speedReference:s.metrics.speed});
  for(const p of players){
   // The central player collision solver knows only body circles; keep each
   // entire cart+owner pair within the room, re-anchor after every pass.
   const safe=constrain(s,p,p.x,p.y);
   p.x=safe.x;p.y=safe.y;cartPosition(s,p);
  }
  for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
   const a=players[i],b=players[j],ac=a.shopping,bc=b.shopping;
   shoppingContact(s,a,b,ac.cartX,ac.cartY,bc.cartX,bc.cartY,s.metrics.cartRadius*2,pass);
   shoppingContact(s,a,b,ac.cartX,ac.cartY,b.x,b.y,s.metrics.cartRadius+s.metrics.playerRadius,pass);
   shoppingContact(s,a,b,a.x,a.y,bc.cartX,bc.cartY,s.metrics.playerRadius+s.metrics.cartRadius,pass);
  }
 }
}
function spawn(s,l){
 if(s.objects.length>=52)return;
 const bomb=rng(s)<.12;
 const entry=l.dir===-1?s.beltBottom:s.beltTop;
 // Individual lane gaps prevent products and bombs spawning on top of one another.
 const recent=s.objects.some(o=>o.active&&o.lane===l.id&&Math.abs(o.y-entry)<45*s.unit);
 if(recent)return;
 s.objects.push({id:s.nextId++,kind:bomb?'bomb':'item',type:bomb?'bomb':ITEMS[Math.floor(rng(s)*ITEMS.length)],
   x:l.x,y:entry,prevY:entry,dir:l.dir,lane:l.id,active:true,radius:(bomb?14:13)*s.unit,phase:random(s,0,TAU)});
}
function spawnAll(s,dt){
 for(const l of s.lanes){
   l.nextSpawn-=dt;
   if(l.nextSpawn<=0){spawn(s,l);l.nextSpawn+=C.spawnInterval*random(s,.75,1.24);}
 }
}
function segmentNear(o,x,y,r){
 const ay=o.prevY,by=o.y,t=clamp((y-ay)/(by-ay||1),0,1),cy=ay+(by-ay)*t;
 return length(o.x-x,cy-y)<=o.radius+r;
}
function effect(s,p,text,color){
 s.effects.push({x:p.x,y:p.y-39*s.unit,text,color,life:1,max:1});if(s.effects.length>45)s.effects.shift();
}
function bombHit(s,p,o){
 const q=p.shopping;
 if(q.immune>0)return false;
 o.active=false;p.score-=C.bombPenalty;q.bombs++;
 q.basket=[];q.stun=C.stun;q.immune=C.immunity;
 effect(s,p,'-5  BOOM!','#ff5566');
 return true;
}
function pickup(s,p,o){
 const q=p.shopping;
 if(q.stun>0||q.basket.length>=C.capacity)return false;
 o.active=false;q.basket.push(o.type);effect(s,p,q.basket.length+'/5','#fff9c1');
 return true;
}
function checkoutPlayer(s,p){
 const q=p.shopping;if(q.stun>0||!q.basket.length)return false;
 if(!s.checkouts.some(z=>insideCheckout(z,q.cartX,q.cartY,s.metrics.cartRadius*.3)))return false;
 const n=q.basket.length;p.score+=n;q.paid+=n;q.basket=[];
 effect(s,p,'+'+n,'#87ffd6');s.scanned++;return true;
}
function interactions(s,ps){
 for(const o of s.objects){
   if(!o.active)continue;
   for(const p of ps){
     const q=p.shopping;
     if(o.kind==='bomb'){
       if(segmentNear(o,p.x,p.y,s.metrics.playerRadius)||segmentNear(o,q.cartX,q.cartY,s.metrics.cartRadius)){
         if(bombHit(s,p,o))break;
       }
     }else if(q.stun<=0&&q.basket.length<C.capacity&&
         segmentNear(o,q.cartX,q.cartY,s.metrics.cartRadius)){
       if(pickup(s,p,o))break;
     }
   }
 }
 for(const p of ps)checkoutPlayer(s,p);
}
function finish(s,round,ps){
 if(s.finished)return;
 s.finished=true;s.remaining=0;round.remaining=0;
 const ranked=[...ps].sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));
 s.ranking=ranked.map(p=>({id:p.id,score:p.score,rank:1+ranked.filter(o=>o.score>p.score).length}));
 const max=ranked[0]?.score??0;s.winnerIds=ranked.filter(p=>p.score===max).map(p=>p.id);
}
function step(dt,round,ps){
 const s=round.shoppingTime;if(s.finished)return;
 const left=Math.max(0,s.duration-s.elapsed);
 dt=Math.min(dt,left);if(!dt){finish(s,round,ps);return;}
 s.elapsed+=dt;s.clock+=dt;s.remaining=Math.max(0,s.duration-s.elapsed);round.remaining=s.remaining;
 const entrants=active(ps);
 for(const p of entrants){
   const q=p.shopping;q.immune=Math.max(0,q.immune-dt);q.stun=Math.max(0,q.stun-dt);
   const input=q.stun>0?{x:0,y:0}:p.isBot?botInput(s,p):playerInput(p);
   // A/B are intentionally not consumed by this minigame.
   movePlayer(s,p,dt,input);
 }
 collide(s,entrants,dt);
 if(s.remaining>0){
   spawnAll(s,dt);
   for(const o of s.objects){o.prevY=o.y;o.y+=o.dir*s.metrics.conveyorSpeed*dt;}
   interactions(s,entrants);
   s.objects=s.objects.filter(o=>o.active&&o.y>s.beltTop-17*s.unit&&o.y<s.beltBottom+17*s.unit);
 }
 for(const e of s.effects)e.life-=dt;
 s.effects=s.effects.filter(e=>e.life>0);
 if(s.remaining<=1e-7)finish(s,round,entrants);
}
function update(dt,round,ps){
 const s=round.shoppingTime;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.25,s.accumulator+clamp(Number(dt)||0,0,.25));
 let n=0;
 while(s.accumulator>=STEP-1e-9&&n++<15&&!s.finished){
   step(STEP,round,ps);s.accumulator-=STEP;
 }
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.shoppingTime;return {survivors:active(ps).length,remaining:s?.remaining||0,
   scores:active(ps).map(p=>({id:p.id,score:p.score||0})),winnerIds:s?.winnerIds||[]};
}
function playerStatus(p){
 if(!p.shopping)return null;
 const q=p.shopping;
 return {mode:'shopping_time',id:p.id,score:p.score||0,count:q.basket.length,
   capacity:C.capacity,stun:q.stun||0,immune:q.immune||0};
}
function draw(ctx,time,round,ps){
 const s=round.shoppingTime;if(!s)return;
 const art=window.PartyArenaScenes,u=s.unit;
 ctx.save();ctx.clearRect(0,0,960,540);ctx.scale(960/s.world.w,540/s.world.h);
 art.shopping(ctx,s);
 for(const p of active(ps)){
   art.shoppingCart(ctx,s,p);
   window.PartyCharacters.draw(ctx,p,{time:s.clock,combat:false,scale:s.actorScale,label:false,holding:true});
   if(p.shopping.stun>0){
     for(let k=0;k<3;k++){const a=time*6+k*TAU/3;ctx.fillStyle='#ffe16b';
       ctx.beginPath();ctx.arc(p.x+Math.cos(a)*19*u,p.y-28*u+Math.sin(a)*7*u,4.2*u,0,TAU);ctx.fill();}
   }
 }
 for(const fx of s.effects){
   ctx.save();ctx.globalAlpha=clamp(fx.life,0,1);ctx.fillStyle=fx.color;
   ctx.font='900 '+17*u+'px system-ui';ctx.textAlign='center';
   ctx.fillText(fx.text,fx.x,fx.y-(1-fx.life)*24*u);ctx.restore();
 }
 ctx.restore();
 // app.js draws the standardized clock after the engine render.
}
function getResult(round,players){
 return players.filter(p=>p.active).map(p=>{
  const value=Number(p.score)||0;
  return {id:p.id,value,label:value+" คะแนน"};
 });
}
// Game-specific roster presentation stays with its pinned engine revision.
function renderRoster(root,active,round){

     active.sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id))).forEach(p=>{
       const box=document.createElement('div');box.className='leader-chip';
       const color=document.createElement('span');color.className='circle';color.style.background=p.color;
       const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;name.title=p.name;
       const score=document.createElement('small');score.className='leader-role';score.textContent=p.score+' คะแนน';
       const load=document.createElement('span');load.className='leader-item-slot';
       load.textContent=p.shopping?.stun>0?'สตั้น':(p.shopping?.basket.length||0)+'/5';
       box.append(color,name,score,load);root.append(box);
     });return;
   
}
// Game-owned controller packet; Host forwards this without mode-specific branches.
function getControllerPacket(p){
 const status=playerStatus(p);
 return status?{t:'shopping-status',...status}:null;
}
window.ShoppingTime=Object.freeze({getControllerPacket,renderRoster,getResult,resultTitle:"คิดเงินให้ได้คะแนนสูงสุด!",countdownSeconds:3,setup,update,draw,hud,playerStatus,size,flowAt,spawn,step,
  bombHit,pickup,checkoutPlayer,finish,config:C});
})();
