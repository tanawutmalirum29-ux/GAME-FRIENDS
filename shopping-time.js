/* SHOPPING TIME — four physical conveyor lanes, individual cart checkout. */
(() => {
'use strict';
const STEP=1/60, TAU=Math.PI*2;
const C=Object.freeze({duration:60,capacity:5,productValue:1,bombPenalty:5,stun:1,immunity:1.3,
  speed:180,conveyorSpeed:65,cartDistance:34,cartRadius:17,playerRadius:15,spawnInterval:1.26});
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
function flowAt(s,x,y){const l=laneAt(s,x,y);return l?l.dir*C.conveyorSpeed:0;}
function rounded(g,x,y,w,h,r){
 g.beginPath();if(g.roundRect)g.roundRect(x,y,w,h,r);
 else{g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
}
function checkout(s,side){
 const w=s.world.w, h=s.world.h;
 return {side,x:side==='left'?w*.14:w*.86,y:h*.52,halfW:45,halfH:59,
   color:side==='left'?'#d94e57':'#468cde'};
}
function setup(round,players){
 window.PartyCharacters.activate(players);
 const ps=active(players),world=size(ps.length);
 const laneWidth=64,gap=7,pitch=laneWidth+gap,total=4*laneWidth+3*gap;
 const s={world,roster:ps,seed:(Number(round.shoppingSeed)||(Date.now()^0x43ae7))>>>0||1,
   clock:0,elapsed:0,remaining:C.duration,duration:C.duration,accumulator:0,finished:false,
   beltTop:58,beltBottom:world.h-58,beltLeft:world.w/2-total/2,beltRight:world.w/2+total/2,
   lanes:[],objects:[],nextId:1,effects:[],ranking:[],winnerIds:[],
   checkouts:[],scanned:0};
 for(let i=0;i<4;i++)s.lanes.push({id:i,x:s.beltLeft+laneWidth/2+i*pitch,width:laneWidth,
   dir:i%2===0?-1:1,nextSpawn:.1+i*.17});
 s.checkouts=[checkout(s,'left'),checkout(s,'right')];
 // Same lanes in both maps. Only the walkable sides grow with crowd size.
 const sides=[[],[]];ps.forEach((p,i)=>sides[i%2].push(p));
 for(let k=0;k<2;k++)for(let j=0;j<sides[k].length;j++){
   const p=sides[k][j],x=k===0?s.beltLeft-100:s.beltRight+100;
   const y=world.h*(j+1)/(sides[k].length+1);
   p.x=x;p.y=y;p.score=0;p.vx=0;p.vy=0;
   const angle=k===0?0:Math.PI;
   p.dir={x:Math.cos(angle),y:Math.sin(angle)};p.face=k===0?1:-1;
   p.shopping={basket:[],paid:0,bombs:0,stun:0,immune:0,angle,vx:0,vy:0,flow:0,
     cartX:x+Math.cos(angle)*C.cartDistance,cartY:y+Math.sin(angle)*C.cartDistance,
     botDecision:0,botGoal:'collect',targetId:null};
 }
 round.shoppingTime=s;round.remaining=C.duration;
 return s;
}
function cartPosition(s,p,dt){
 const q=p.shopping;
 const targetX=p.x+Math.cos(q.angle)*C.cartDistance;
 const targetY=p.y+Math.sin(q.angle)*C.cartDistance;
 const t=clamp(dt*18,0,1);
 q.cartX+=clamp(targetX-q.cartX,-C.speed*dt*2,C.speed*dt*2)*t;
 q.cartY+=clamp(targetY-q.cartY,-C.speed*dt*2,C.speed*dt*2)*t;
 q.cartX=clamp(q.cartX,20,s.world.w-20);
 q.cartY=clamp(q.cartY,20,s.world.h-20);
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
 const q=p.shopping;
 // Scanned goods are already safe scores, so bots make partial checkout trips.
 const bank=q.basket.length>=C.capacity||
   q.basket.length>=3&&s.remaining<24||
   q.basket.length>=2&&s.remaining<10||
   q.basket.length>0&&s.remaining<length(p.x-nearestCheckout(s,p).x,p.y-nearestCheckout(s,p).y)/C.speed+2.5;
 let goal;
 if(bank){q.botGoal='checkout';goal=nearestCheckout(s,p);}
 else{
   q.botGoal='collect';
   const candidates=s.objects.filter(o=>o.kind==='item'&&o.active&&
       !s.objects.some(b=>b.kind==='bomb'&&b.active&&b.lane===o.lane&&Math.abs(b.y-o.y)<50));
   let best=null,bestCost=Infinity;
   for(const o of candidates){
     const travel=length(o.x-p.x,o.y-p.y)/C.speed;
     const y=clamp(o.y+o.dir*C.conveyorSpeed*Math.min(travel,.9),s.beltTop+18,s.beltBottom-18);
     const cost=length(o.x-p.x,y-p.y)+(q.targetId===o.id?-34:0);
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
 if(q.botGoal==='checkout'&&length(x,y)<C.cartDistance+11){x=goal.x-q.cartX;y=goal.y-q.cartY;}
 const imminent=s.objects.find(o=>o.kind==='bomb'&&o.active&&
   Math.abs(o.x-q.cartX)<45&&Math.abs(o.y-q.cartY)<95&&
   length(o.x-q.cartX,o.y-q.cartY)<105);
 if(imminent){
   const dodge=(q.cartX<=imminent.x?-1:1);
   x+=dodge*165;y-=(imminent.dir||1)*75;
 }
 const dist=length(x,y);
 return dist<5?{x:0,y:0}:{x:x/dist,y:y/dist};
}
function constrain(s,p,x,y){
 const r=C.playerRadius;
 // Decorative cashier stations are at the outer edge. Checkout pads remain accessible.
 return {x:clamp(x,19+r,s.world.w-19-r),y:clamp(y,19+r,s.world.h-19-r)};
}
function steering(p,v,dt){
 const q=p.shopping,mag=length(v.x,v.y);
 if(mag<.09)return;
 const a=Math.atan2(v.y,v.x);
 let diff=Math.atan2(Math.sin(a-q.angle),Math.cos(a-q.angle));
 q.angle+=clamp(diff,-dt*8,dt*8);
 p.dir={x:Math.cos(q.angle),y:Math.sin(q.angle)};
 p.face=p.dir.x<0?-1:1;
}
function movePlayer(s,p,dt,v){
 const q=p.shopping;
 const gain=clamp(dt*10,0,1),speed=C.speed*(p.isBot?.89:1);
 q.vx+=(v.x*speed-q.vx)*gain;q.vy+=(v.y*speed-q.vy)*gain;
 const localFlow=flowAt(s,p.x,p.y)*.70+flowAt(s,q.cartX,q.cartY)*.30;
 q.flow+=(localFlow-q.flow)*clamp(dt*11,0,1);
 const from={x:p.x,y:p.y};
 const pos=constrain(s,p,p.x+q.vx*dt,p.y+(q.vy+q.flow)*dt);
 p.x=pos.x;p.y=pos.y;p.vx=(p.x-from.x)/dt;p.vy=(p.y-from.y)/dt;
 steering(p,v,dt);cartPosition(s,p,dt);
}
// Keep each cart physically attached when another cart/body pushes its owner.
function shiftCartOwner(s,p,dx,dy){
 const q=p.shopping,at=constrain(s,p,p.x+dx,p.y+dy);
 const movedX=at.x-p.x,movedY=at.y-p.y;
 p.x=at.x;p.y=at.y;
 q.cartX=clamp(q.cartX+movedX,20,s.world.w-20);
 q.cartY=clamp(q.cartY+movedY,20,s.world.h-20);
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
 const powerA=1+Math.min(1.5,driveA/C.speed)*1.8;
 const powerB=1+Math.min(1.5,driveB/C.speed)*1.8;
 const shareA=powerB/(powerA+powerB);
 const correction=Math.min(8,minDistance-dist+.12);
 shiftCartOwner(s,a,-nx*correction*shareA,-ny*correction*shareA);
 shiftCartOwner(s,b,nx*correction*(1-shareA),ny*correction*(1-shareA));
 // Transfer a small amount of forward momentum once per contact per tick.
 // This makes a moving cart genuinely push a stationary person/cart.
 if(pass===0&&closing>10){
  const impulse=Math.min(42,closing*.16);
  qa.vx=clamp(qa.vx-nx*impulse*shareA,-C.speed,C.speed);
  qa.vy=clamp(qa.vy-ny*impulse*shareA,-C.speed,C.speed);
  qb.vx=clamp(qb.vx+nx*impulse*(1-shareA),-C.speed,C.speed);
  qb.vy=clamp(qb.vy+ny*impulse*(1-shareA),-C.speed,C.speed);
 }
}
function collide(s,players,dt){
 // 60 Hz host-authoritative simulation: stable for 1–12 mixed bot/human players.
 // Exclude a cart's own owner; the two are attached at cartDistance.
 for(let pass=0;pass<4;pass++){
  const before=players.map(p=>({x:p.x,y:p.y}));
  window.PartyCharacters.resolve(players,{radius:C.playerRadius,
    bounds:{x:19,y:19,w:s.world.w-38,h:s.world.h-38},
    iterations:1,maxShift:7,pressure:true,speedReference:C.speed});
  for(let i=0;i<players.length;i++){
   const p=players[i],q=p.shopping,dx=p.x-before[i].x,dy=p.y-before[i].y;
   q.cartX=clamp(q.cartX+dx,20,s.world.w-20);
   q.cartY=clamp(q.cartY+dy,20,s.world.h-20);
  }
  for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
   const a=players[i],b=players[j],ac=a.shopping,bc=b.shopping;
   shoppingContact(s,a,b,ac.cartX,ac.cartY,bc.cartX,bc.cartY,C.cartRadius*2,pass);
   shoppingContact(s,a,b,ac.cartX,ac.cartY,b.x,b.y,C.cartRadius+C.playerRadius,pass);
   shoppingContact(s,a,b,a.x,a.y,bc.cartX,bc.cartY,C.playerRadius+C.cartRadius,pass);
  }
 }
}
function spawn(s,l){
 if(s.objects.length>=52)return;
 const bomb=rng(s)<.12;
 const entry=l.dir===-1?s.beltBottom:s.beltTop;
 // Individual lane gaps prevent products and bombs spawning on top of one another.
 const recent=s.objects.some(o=>o.active&&o.lane===l.id&&Math.abs(o.y-entry)<45);
 if(recent)return;
 s.objects.push({id:s.nextId++,kind:bomb?'bomb':'item',type:bomb?'bomb':ITEMS[Math.floor(rng(s)*ITEMS.length)],
   x:l.x,y:entry,prevY:entry,dir:l.dir,lane:l.id,active:true,radius:bomb?14:13,phase:random(s,0,TAU)});
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
 s.effects.push({x:p.x,y:p.y-39,text,color,life:1,max:1});if(s.effects.length>45)s.effects.shift();
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
 if(!s.checkouts.some(z=>insideCheckout(z,q.cartX,q.cartY,C.cartRadius*.3)))return false;
 const n=q.basket.length;p.score+=n;q.paid+=n;q.basket=[];
 effect(s,p,'+'+n,'#87ffd6');s.scanned++;return true;
}
function interactions(s,ps){
 for(const o of s.objects){
   if(!o.active)continue;
   for(const p of ps){
     const q=p.shopping;
     if(o.kind==='bomb'){
       if(segmentNear(o,p.x,p.y,C.playerRadius)||segmentNear(o,q.cartX,q.cartY,C.cartRadius)){
         if(bombHit(s,p,o))break;
       }
     }else if(q.stun<=0&&q.basket.length<C.capacity&&
         segmentNear(o,q.cartX,q.cartY,C.cartRadius)){
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
   for(const o of s.objects){o.prevY=o.y;o.y+=o.dir*C.conveyorSpeed*dt;}
   interactions(s,entrants);
   s.objects=s.objects.filter(o=>o.active&&o.y>s.beltTop-17&&o.y<s.beltBottom+17);
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
function product(g,o){
 g.save();g.translate(o.x,o.y);g.rotate(Math.sin(o.phase+o.y*.025)*.1);
 g.fillStyle='#071d3144';g.beginPath();g.ellipse(2,5,15,7,0,0,TAU);g.fill();
 const t=o.type;
 if(t==='bomb'){
   g.fillStyle='#141725';g.strokeStyle='#fb5569';g.lineWidth=3;
   g.beginPath();g.arc(0,0,12,0,TAU);g.fill();g.stroke();
   g.strokeStyle='#f8cb85';g.lineWidth=3;g.beginPath();g.moveTo(1,-10);g.lineTo(6,-20);g.stroke();
   g.fillStyle='#fff4a3';g.beginPath();g.arc(7,-20,3.5,0,TAU);g.fill();
   g.fillStyle='#fff';g.font='bold 13px sans-serif';g.textAlign='center';g.fillText('!',0,4);
 }else{
   const colors={banana:'#ffe46b',watermelon:'#53b979',soda:'#e95d6b',juice:'#ffa34c',
     chips:'#e7ab38',milk:'#f2f8fd',greens:'#74d58a',can:'#b2bdd7',apple:'#e44d62'};
   g.fillStyle=colors[t]||'#fce5af';
   if(['soda','juice','milk','can'].includes(t)){rounded(g,-10,-13,20,26,4);g.fill();g.fillStyle='#ffffffaa';g.fillRect(-8,-7,16,8);}
   else if(t==='banana'){g.strokeStyle='#ffe46b';g.lineWidth=9;g.beginPath();g.arc(0,-4,13,.2,2.6);g.stroke();}
   else if(t==='chips'){rounded(g,-11,-15,22,30,5);g.fill();g.fillStyle='#fff6c5';g.fillRect(-9,-4,18,6);}
   else{g.beginPath();g.arc(0,0,12,0,TAU);g.fill();if(t==='watermelon'){g.fillStyle='#ef5e69';g.beginPath();g.arc(1,1,8,0,TAU);g.fill();}}
   g.strokeStyle='#183045';g.lineWidth=1.5;g.stroke();
 }
 g.restore();
}
function background(g,s){
 const {w,h}=s.world,cx=w/2;
 g.fillStyle='#e9be96';g.fillRect(0,0,cx,h);
 g.fillStyle='#9ad1e8';g.fillRect(cx,0,cx,h);
 g.strokeStyle='#ffffff35';g.lineWidth=1;
 for(let x=0;x<w;x+=32){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}
 for(let y=0;y<h;y+=32){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
 // Supermarket shelves at scene edges are decorative and never hide checkout pads.
 for(let side=0;side<2;side++)for(let j=0;j<3;j++){
   const x=side===0?35:w-94,y=54+j*(h-108)/2;
   g.fillStyle='#27425c40';rounded(g,x+3,y+5,60,24,5);g.fill();
   g.fillStyle=side===0?'#d66e64':'#5289bc';rounded(g,x,y,60,24,5);g.fill();
   g.fillStyle='#ffefcf';g.fillRect(x+8,y+8,44,5);
 }
 for(const z of s.checkouts){
   g.fillStyle=z.side==='left'?'#fff5e9':'#e9f6ff';
   g.fillRect(z.x-58,z.y-74,116,148);
   g.fillStyle=z.color;rounded(g,z.x-50,z.y-66,100,132,13);g.fill();
   g.fillStyle='#ffffffbb';rounded(g,z.x-36,z.y-49,72,98,10);g.fill();
   g.fillStyle=z.color;g.font='900 14px system-ui';g.textAlign='center';
   g.fillText('CHECKOUT',z.x,z.y-19);
   g.fillStyle='#11283b';rounded(g,z.x-25,z.y-6,50,30,5);g.fill();
   g.fillStyle='#a7ffc0';g.font='900 13px system-ui';g.fillText('PAY',z.x,z.y+13);
 }
 g.fillStyle='#253a4b';rounded(g,s.beltLeft-9,s.beltTop-12,s.beltRight-s.beltLeft+18,s.beltBottom-s.beltTop+24,12);g.fill();
 for(const l of s.lanes){
   g.fillStyle=l.id%2===0?'#537b89':'#466f7e';
   g.fillRect(l.x-l.width/2,s.beltTop,l.width,s.beltBottom-s.beltTop);
   g.strokeStyle='#a9e1ed99';g.lineWidth=2;
   g.strokeRect(l.x-l.width/2,s.beltTop,l.width,s.beltBottom-s.beltTop);
   const offset=(s.clock*C.conveyorSpeed)%62;
   for(let y=s.beltTop-62;y<s.beltBottom+62;y+=62){
     const at=y+l.dir*offset;if(at<s.beltTop||at>s.beltBottom)continue;
     g.strokeStyle='#deeff6a0';g.lineWidth=3;g.beginPath();
     const d=l.dir;g.moveTo(l.x-12,at-d*7);g.lineTo(l.x,at+d*7);g.lineTo(l.x+12,at-d*7);g.stroke();
   }
 }
}
function cart(g,p){
 const q=p.shopping;
 g.save();g.translate(q.cartX,q.cartY);g.rotate(q.angle+Math.PI/2);
 g.fillStyle='#0a253a55';g.beginPath();g.ellipse(2,5,19,15,0,0,TAU);g.fill();
 g.fillStyle='#ffffffed';g.strokeStyle=p.color||'#e5faff';g.lineWidth=4;
 rounded(g,-16,-18,32,31,5);g.fill();g.stroke();
 g.strokeStyle='#39526c';g.lineWidth=3;
 for(let y=-7;y<=9;y+=8){g.beginPath();g.moveTo(-12,y);g.lineTo(12,y);g.stroke();}
 g.beginPath();g.moveTo(-15,18);g.lineTo(15,18);g.stroke();
 g.fillStyle='#223b54';for(const x of [-10,10]){g.beginPath();g.arc(x,20,3.5,0,TAU);g.fill();}
 const n=q.basket.length;for(let i=0;i<n;i++){
   const x=(i%3-1)*9,y=Math.floor(i/3)*11-9;
   g.fillStyle=['#ffcc5e','#e96e7d','#72d7a4','#a8bfe7','#f0baea'][i];
   rounded(g,x-4,y-4,8,8,2);g.fill();
 }
 g.restore();
 g.fillStyle='#142a41e6';rounded(g,q.cartX-17,q.cartY-35,34,16,6);g.fill();
 g.fillStyle='#fff';g.textAlign='center';g.font='bold 11px system-ui';
 g.fillText(n+'/5',q.cartX,q.cartY-23);
}
function draw(ctx,time,round,ps){
 const s=round.shoppingTime;if(!s)return;
 ctx.save();ctx.clearRect(0,0,960,540);ctx.scale(960/s.world.w,540/s.world.h);
 background(ctx,s);for(const o of s.objects)if(o.active)product(ctx,o);
 for(const p of active(ps)){
   cart(ctx,p);
   window.PartyCharacters.draw(ctx,p,{time:s.clock,combat:false,scale:s.world.kind==='large'?1.1:1});
   ctx.fillStyle='#102b43';ctx.font='900 13px system-ui';ctx.textAlign='center';
   ctx.strokeStyle='#102b43';ctx.lineWidth=4;ctx.strokeText(p.name||'',p.x,p.y-34);
   ctx.fillStyle='#fff';ctx.fillText(p.name||'',p.x,p.y-34);
   if(p.shopping.stun>0){
     for(let k=0;k<3;k++){const a=time*6+k*TAU/3;ctx.fillStyle='#ffe16b';
       ctx.beginPath();ctx.arc(p.x+Math.cos(a)*19,p.y-32+Math.sin(a)*7,4.2,0,TAU);ctx.fill();}
   }
 }
 for(const fx of s.effects){
   ctx.save();ctx.globalAlpha=clamp(fx.life,0,1);ctx.fillStyle=fx.color;
   ctx.font='900 17px system-ui';ctx.textAlign='center';
   ctx.fillText(fx.text,fx.x,fx.y-(1-fx.life)*24);ctx.restore();
 }
 ctx.restore();
 ctx.save();ctx.fillStyle='#112d43df';rounded(ctx,10,9,218,54,9);ctx.fill();
 ctx.fillStyle='#fff';ctx.textAlign='left';ctx.font='900 18px system-ui';ctx.fillText('SHOPPING TIME',21,32);
 ctx.font='bold 14px system-ui';ctx.fillText(round.phase==='countdown'?
   'เริ่มใน '+Math.ceil(round.countdown||0):'เหลือ '+Math.ceil(s.remaining)+' วินาที',21,52);
 ctx.restore();
}
window.ShoppingTime=Object.freeze({setup,update,draw,hud,playerStatus,size,flowAt,spawn,step,
  bombHit,pickup,checkoutPlayer,finish,config:C});
})();
