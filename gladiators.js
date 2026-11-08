/* GLADIATORS — host-authoritative chained-mace survival, 60 Hz fixed-step.
   All hit/death resolution happens on the host, irrespective of rendering FPS. */
(() => {
'use strict';
const TAU=Math.PI*2,STEP=1/60,EPS=1e-8;
const C=Object.freeze({body:15,ball:21,spike:4,chain:114,chainLinks:12,speed:166,turnRate:3.2,maxBallSpeed:720,
 air:0.992,restitution:0.69,soloSeconds:60,suddenAt:90,suddenSeconds:65,minSafe:.49});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const hyp=(x,y)=>Math.hypot(x,y);
const living=ps=>ps.filter(p=>p.active&&p.gladiator?.alive);
function random(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x||0x2b8f21a9;return(s.seed>>>0)/4294967296;}
function boundsFor(n){const large=n>6;return {w:large?1280:960,h:large?720:540,
 x:large?122:92,y:large?99:76,right:large?1158:868,bottom:large?621:464,
 large};}
function anchor(p){const d=p.dir||{x:0,y:-1};const m=hyp(d.x,d.y)||1;return {x:p.x-d.x/m*10,y:p.y-d.y/m*10};}
function spawnPositions(s,n){
 const b=s.bounds,rx=(b.right-b.x)*.35,ry=(b.bottom-b.y)*.36;
 const angle=random(s)*TAU,positions=[];
 for(let i=0;i<n;i++){
  const a=angle+i*TAU/n;
  positions.push({x:b.w/2+Math.cos(a)*rx,y:b.h/2+Math.sin(a)*ry,angle:a});
 }
 return positions;
}

/* A real articulated tether: eleven movable pin joints join the fixed
   hand anchor to the heavy mace in TWELVE equal rigid links. Each pin has
   its own previous position (Verlet momentum), and each link pivots freely.
   This is deliberately separate from avatar facing and from drawing. */
function makeLinks(s,start,ball,side){
 const count=C.chainLinks,length=C.chain/count;
 const dx=ball.x-start.x,dy=ball.y-start.y,dist=hyp(dx,dy);
 const ux=dist>EPS?dx/dist:1,uy=dist>EPS?dy/dist:0;
 // Construct an arc whose twelve chords are exactly one link long.
 // Extra length becomes natural slack instead of a straight rigid rod.
 let low=0,high=Math.PI/count;
 const ratio=clamp(dist/C.chain,0,1);
 for(let j=0;j<36;j++){
  const h=(low+high)*.5;
  const val=Math.sin(count*h)/(count*Math.sin(h));
  if(val>ratio)low=h;else high=h;
 }
 const half=(low+high)*.5,angle=count*half;
 const radius=half>1e-6?length/(2*Math.sin(half)):0;
 const make=sign=>{
  const pins=[];
  for(let i=1;i<count;i++){
   const t=i/count;
   const along=half>1e-6?dist/2+radius*Math.sin((2*t-1)*angle):dist*t;
   const bulge=half>1e-6?radius*(Math.cos((2*t-1)*angle)-Math.cos(angle))*sign:0;
   const x=start.x+ux*along-uy*bulge,y=start.y+uy*along+ux*bulge;
   pins.push({x,y,px:x,py:y,vx:0,vy:0});
  }
  return pins;
 };
 const score=nodes=>nodes.reduce((sum,p)=>{
  const b=s.bounds,margin=3;
  const ox=Math.max(b.x+margin-p.x,0,p.x-(b.right-margin));
  const oy=Math.max(b.y+margin-p.y,0,p.y-(b.bottom-margin));
  return sum+ox*ox+oy*oy;
 },0);
 const a=make(side<0?-1:1),b=make(side<0?1:-1);
 return score(a)<=score(b)?a:b;
}
function solveChain(s,p,dt,passes=12){
 const st=p.gladiator,ball=st.ball;if(ball.static)return;
 const a=anchor(p);
 st.anchorX=a.x;st.anchorY=a.y;
 const joints=st.links;
 if(!joints||joints.length!==C.chainLinks-1)return;
 const points=[a,...joints,ball],segment=C.chain/C.chainLinks;
 const beforeX=ball.x,beforeY=ball.y;
 const minX=s.bounds.x+3,maxX=s.bounds.right-3;
 const minY=s.bounds.y+3,maxY=s.bounds.bottom-3;
 for(let pass=0;pass<passes;pass++){
  // Forward/backward Gauss-Seidel reduces bias toward either endpoint.
  for(let k=0;k<points.length-1;k++){
   const i=pass%2===0?k:points.length-2-k;
   const u=points[i],v=points[i+1];
   let dx=v.x-u.x,dy=v.y-u.y,d=hyp(dx,dy);
   if(d<EPS){dx=segment;dy=0;d=segment;}
   const correction=(d-segment)/d;
   const wu=i===0?0:1,wv=i===points.length-2?.26:1,ws=wu+wv;
   const sx=dx*correction,sy=dy*correction;
   if(wu){u.x+=sx*wu/ws;u.y+=sy*wu/ws;}
   v.x-=sx*wv/ws;v.y-=sy*wv/ws;
  }
  // Each metal joint also collides with the arena, independent of the mace.
  for(const pin of joints){
   pin.x=clamp(pin.x,minX,maxX);
   pin.y=clamp(pin.y,minY,maxY);
  }
  wall(s,ball);
 }
 // Chain tension changes the mace's momentum; not just its rendered position.
 ball.vx+=clamp((ball.x-beforeX)/dt*.55,-260,260);
 ball.vy+=clamp((ball.y-beforeY)/dt*.55,-260,260);
 const speed=hyp(ball.vx,ball.vy);
 if(speed>C.maxBallSpeed){ball.vx*=C.maxBallSpeed/speed;ball.vy*=C.maxBallSpeed/speed;}
 for(const pin of joints){
  pin.vx=(pin.x-pin.px)/dt;
  pin.vy=(pin.y-pin.py)/dt;
  if(!Number.isFinite(pin.x+pin.y+pin.vx+pin.vy)){
   // Recover a corrupt joint without breaking the rest of the match.
   const position=points[joints.indexOf(pin)];
   pin.x=finite(position?.x,a.x);pin.y=finite(position?.y,a.y);
   pin.px=pin.x;pin.py=pin.y;pin.vx=pin.vy=0;
  }
 }
}

function setup(round,ps){
 if(!ps.length||ps.length>12)throw Error('GLADIATORS supports 1–12 players');
 const b=boundsFor(ps.length);
 const s={bounds:b,roster:ps,clock:0,tick:0,accumulator:0,seed:((Number(round.gladiatorsSeed)||Date.now()^0x7ac15b3)>>>0)||1,
  safeScale:1,finished:false,winnerIds:[],ranking:[],events:[],lastEliminations:[],warnings:0,arenaCache:null};
 round.gladiators=s;round.remaining=null;
 const locations=spawnPositions(s,ps.length);
 ps.forEach((p,i)=>{
  const q=locations[i],a=q.angle,d={x:-Math.cos(a),y:-Math.sin(a)};
  p.active=true;p.score=0;p.x=q.x;p.y=q.y;p.vx=p.vy=0;
  p.dir=d;p.face=d.x<0?-1:1;
  const point=anchor(p),out={x:Math.cos(a),y:Math.sin(a)};
  const bx=clamp(point.x+out.x*(C.chain-24),b.x+C.ball+9,b.right-C.ball-9);
  const by=clamp(point.y+out.y*(C.chain-24),b.y+C.ball+9,b.bottom-C.ball-9);
  p.gladiator={alive:true,eliminatedTick:null,eliminatedAt:null,reason:null,
   heading:Math.atan2(d.y,d.x),knockVx:0,knockVy:0,
   ball:{x:bx,y:by,vx:0,vy:0,px:bx,py:by,static:false,owner:p.id},
   links:makeLinks(s,point,{x:bx,y:by},i%2?-1:1),
   anchorX:point.x,anchorY:point.y,deadAnchorX:null,deadAnchorY:null,
   lastX:p.x,lastY:p.y,botClock:0,botTarget:null,botInput:{x:0,y:0},
   style:i%4,hand:random(s)<.5?-1:1,phase:random(s)*TAU};
 });
 return s;
}
function inputOf(p){
 if(window.PartyCharacters?.control)return window.PartyCharacters.control(p.input);
 const k=p.input||{};let x=finite(Number(k.axisX)),y=finite(Number(k.axisY));
 if(hyp(x,y)<.12){x=Number(!!k.right)-Number(!!k.left);y=Number(!!k.down)-Number(!!k.jump);}
 const m=hyp(x,y);return m>1?{x:x/m,y:y/m}:{x,y};
}
function botControl(s,p,ps){
 const state=p.gladiator;state.botClock-=STEP;
 if(state.botClock>0)return state.botInput;
 const others=living(ps).filter(o=>o!==p);
 let target=null,dist=Infinity;
 for(const o of others){const d=hyp(p.x-o.x,p.y-o.y);if(d<dist){dist=d;target=o;}}
 let vx=0,vy=0;
 if(target){
  const dx=target.x-p.x,dy=target.y-p.y,m=hyp(dx,dy)||1;
  const side=state.hand;
  // Orbit to build real momentum: never drive the mace directly.
  const orbit=state.style===1?.99:state.style===2?.72:state.style===3?.61:.87;
  const approach=dist>180?.70:dist<98?-.48:.18;
  vx=dx/m*approach+(-dy/m)*side*orbit;
  vy=dy/m*approach+(dx/m)*side*orbit;
  if(target.gladiator?.ball){
   const ball=target.gladiator.ball,ex=p.x-(ball.x+ball.vx*.12),ey=p.y-(ball.y+ball.vy*.12);
   const danger=hyp(ex,ey);
   if(danger<105){const factor=clamp((105-danger)/58,0,1)*2.4;vx+=ex/(danger||1)*factor;vy+=ey/(danger||1)*factor;}
  }
 }else{const a=state.phase+s.clock*.68;vx=Math.cos(a);vy=Math.sin(a);}
 for(const other of ps){
  if(other===p||!other.gladiator?.ball?.static)continue;
  const ball=other.gladiator.ball,dx=p.x-ball.x,dy=p.y-ball.y,d=hyp(dx,dy);
  if(d<105){const force=(105-d)/45*2;vx+=dx/(d||1)*force;vy+=dy/(d||1)*force;}
 }
 const b=s.bounds,pad=72;
 if(p.x<b.x+pad)vx+=(b.x+pad-p.x)/27;
 if(p.x>b.right-pad)vx-=(p.x-(b.right-pad))/27;
 if(p.y<b.y+pad)vy+=(b.y+pad-p.y)/27;
 if(p.y>b.bottom-pad)vy-=(p.y-(b.bottom-pad))/27;
 const len=hyp(vx,vy);
 if(len<.03||random(s)<.055)state.hand*=-1;
 state.botInput=len>.001?{x:vx/Math.max(1,len),y:vy/Math.max(1,len)}:{x:0,y:0};
 state.botClock=.15+random(s)*.21;
 return state.botInput;
}
// This game's direction has inertia: reversing the stick cannot flip the avatar.
function steer(p,input,dt){
 const st=p.gladiator,mag=hyp(input.x,input.y);
 if(mag>=.12){
  const desired=Math.atan2(input.y,input.x);
  const shortest=Math.atan2(Math.sin(desired-st.heading),Math.cos(desired-st.heading));
  st.heading+=clamp(shortest,-C.turnRate*dt,C.turnRate*dt);
 }
 p.dir={x:Math.cos(st.heading),y:Math.sin(st.heading)};
 p.face=p.dir.x<0?-1:1;
 return mag<.12?{x:0,y:0}:{x:p.dir.x*Math.min(1,mag),y:p.dir.y*Math.min(1,mag)};
}
function movePlayers(s,ps,dt){
 const b=s.bounds,live=living(ps);
 for(const p of live){
  const st=p.gladiator;
  st.lastX=p.x;st.lastY=p.y;
  const input=p.isBot?botControl(s,p,ps):inputOf(p);
  const v=steer(p,input,dt);
  // Keep shared position/wall logic, but never let it override our turn limit.
  if(window.PartyCharacters?.move){
   window.PartyCharacters.move(p,v,dt,{speed:C.speed*(p.isBot?.95:1),
    radius:C.body,lockHeading:true,bounds:{x:b.x,y:b.y,w:b.right-b.x,h:b.bottom-b.y}});
  }else{
   p.x=clamp(p.x+v.x*C.speed*dt,b.x+C.body,b.right-C.body);
   p.y=clamp(p.y+v.y*C.speed*dt,b.y+C.body,b.bottom-C.body);
  }
  // A mace strike sends its wielder sliding back, independently of joystick.
  p.x=clamp(p.x+st.knockVx*dt,b.x+C.body,b.right-C.body);
  p.y=clamp(p.y+st.knockVy*dt,b.y+C.body,b.bottom-C.body);
  const damping=Math.pow(.84,dt*60);
  st.knockVx*=damping;st.knockVy*=damping;
  if(Math.abs(st.knockVx)<.1)st.knockVx=0;
  if(Math.abs(st.knockVy)<.1)st.knockVy=0;
 }
 if(window.PartyCharacters?.resolve&&live.length>1){
  window.PartyCharacters.resolve(live,{radius:C.body,iterations:6,maxShift:4,pressure:true,
   bounds:{x:b.x,y:b.y,w:b.right-b.x,h:b.bottom-b.y}});
 }
 for(const p of live){p.vx=(p.x-p.gladiator.lastX)/dt;p.vy=(p.y-p.gladiator.lastY)/dt;}
}
function wall(s,ball){
 const b=s.bounds,r=C.ball+C.spike*.46;
 if(ball.x<b.x+r){ball.x=b.x+r;ball.vx=Math.abs(ball.vx)*C.restitution;}
 if(ball.x>b.right-r){ball.x=b.right-r;ball.vx=-Math.abs(ball.vx)*C.restitution;}
 if(ball.y<b.y+r){ball.y=b.y+r;ball.vy=Math.abs(ball.vy)*C.restitution;}
 if(ball.y>b.bottom-r){ball.y=b.bottom-r;ball.vy=-Math.abs(ball.vy)*C.restitution;}
}
function ballMotion(s,ps,dt){
 for(const p of living(ps)){
  const st=p.gladiator,ball=st.ball,old=anchor(p);
  st.prevAnchorX=st.anchorX;st.prevAnchorY=st.anchorY;
  ball.px=ball.x;ball.py=ball.y;
  ball.vx*=C.air;ball.vy*=C.air;
  let speed=hyp(ball.vx,ball.vy);
  if(speed>C.maxBallSpeed){ball.vx*=C.maxBallSpeed/speed;ball.vy*=C.maxBallSpeed/speed;}
  ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
  wall(s,ball);
  for(const pin of st.links){
   const vx=clamp(pin.x-pin.px,-10,10);
   const vy=clamp(pin.y-pin.py,-10,10);
   pin.px=pin.x;pin.py=pin.y;
   pin.x+=vx*.987;pin.y+=vy*.987;
  }
  solveChain(s,p,dt);
  if(!Number.isFinite(ball.x+ball.y+ball.vx+ball.vy)){
   ball.x=old.x+50;ball.y=old.y;ball.vx=ball.vy=0;
   st.links=makeLinks(s,old,ball,st.hand);
  }
 }
}
function impact(a,b,ar,br,immovable=false){
 let dx=b.x-a.x,dy=b.y-a.y,d=hyp(dx,dy),min=ar+br;
 if(d>=min)return false;
 if(d<EPS){dx=1;dy=0;d=1;}
 const nx=dx/d,ny=dy/d,penetration=min-d;
 const wa=a.static?0:1,wb=b.static||immovable?0:1,sum=wa+wb;
 if(!sum)return false;
 if(wa){a.x-=nx*penetration*wa/sum;a.y-=ny*penetration*wa/sum;}
 if(wb){b.x+=nx*penetration*wb/sum;b.y+=ny*penetration*wb/sum;}
 const va=finite(a.vx)*nx+finite(a.vy)*ny,vb=finite(b.vx)*nx+finite(b.vy)*ny;
 const relative=vb-va;
 if(relative<0){
  const impulse=-(1+C.restitution)*relative/sum;
  if(wa){a.vx-=nx*impulse*wa;a.vy-=ny*impulse*wa;}
  if(wb){b.vx+=nx*impulse*wb;b.vy+=ny*impulse*wb;}
 }
 return true;
}
function collideBalls(s,ps){
 const people=ps.filter(p=>p.gladiator);
 for(let i=0;i<people.length;i++)for(let j=i+1;j<people.length;j++){
  const a=people[i].gladiator.ball,b=people[j].gladiator.ball;
  impact(a,b,C.ball+C.spike*.35,C.ball+C.spike*.35);
 }
 for(const p of people){
  const q=p.gladiator.ball;
  if(p.gladiator.alive){wall(s,q);solveChain(s,p,STEP,7);}
 }
}
// Own mace is SOLID but never lethal. The impact pushes the wielder instead
// of letting the ball pass through their body or teleporting to the other side.
function collideOwnMaces(s,ps,dt){
 const b=s.bounds,radius=C.body+C.ball+C.spike*.65;
 for(const p of living(ps)){
  const st=p.gladiator,ball=st.ball;
  const start={x:ball.px,y:ball.py},oldPlayer={x:st.lastX,y:st.lastY};
  let dx=ball.x-p.x,dy=ball.y-p.y,d=hyp(dx,dy);
  const sweptHit=swept(start,ball,oldPlayer,p,radius);
  if(d>=radius&&!sweptHit)continue;
  // In case a fast relative sweep crossed the body, resolve on the incoming side.
  if(d>=radius){
   let ox=start.x-oldPlayer.x,oy=start.y-oldPlayer.y,m=hyp(ox,oy);
   if(m<EPS){ox=-p.dir.x;oy=-p.dir.y;m=hyp(ox,oy)||1;}
   ball.x=p.x+ox/m*(radius-.01);
   ball.y=p.y+oy/m*(radius-.01);
   dx=ball.x-p.x;dy=ball.y-p.y;d=hyp(dx,dy);
  }
  if(d<EPS){
   dx=start.x-oldPlayer.x;dy=start.y-oldPlayer.y;d=hyp(dx,dy);
   if(d<EPS){dx=-p.dir.x;dy=-p.dir.y;d=hyp(dx,dy)||1;}
  }
  const nx=dx/d,ny=dy/d;
  const overlap=Math.max(0,radius-hyp(ball.x-p.x,ball.y-p.y));
  const oldX=p.x,oldY=p.y;
  // Heavier spiked mace: the player takes most of the positional shove.
  p.x=clamp(p.x-nx*overlap*.72,b.x+C.body,b.right-C.body);
  p.y=clamp(p.y-ny*overlap*.72,b.y+C.body,b.bottom-C.body);
  const moved=(oldX-p.x)*nx+(oldY-p.y)*ny;
  ball.x+=nx*Math.max(0,overlap-moved+.02);
  ball.y+=ny*Math.max(0,overlap-moved+.02);
  const approach=(ball.vx-p.vx)*nx+(ball.vy-p.vy)*ny;
  if(approach<0){
   const impulse=Math.min(340,-approach*.72);
   st.knockVx=clamp(st.knockVx-nx*impulse,-360,360);
   st.knockVy=clamp(st.knockVy-ny*impulse,-360,360);
   ball.vx+=nx*impulse*.70;
   ball.vy+=ny*impulse*.70;
  }
  p.vx=(p.x-st.lastX)/dt;p.vy=(p.y-st.lastY)/dt;
  wall(s,ball);
  solveChain(s,p,dt,6);
 }
}
// Continuous relative segment test — one-frame tunneling cannot bypass a mace.
function swept(a0,a1,b0,b1,r){
 const x=a0.x-b0.x,y=a0.y-b0.y;
 const dx=(a1.x-a0.x)-(b1.x-b0.x),dy=(a1.y-a0.y)-(b1.y-b0.y);
 const den=dx*dx+dy*dy,t=den<EPS?0:clamp(-(x*dx+y*dy)/den,0,1);
 const ex=x+t*dx,ey=y+t*dy;
 return ex*ex+ey*ey<=r*r;
}
function eliminate(s,p,reason){
 const st=p.gladiator;if(!st?.alive)return false;
 st.alive=false;st.eliminatedTick=s.tick;st.eliminatedAt=s.clock;st.reason=reason;
 st.ball.static=true;st.ball.vx=st.ball.vy=0;
 st.ball.px=st.ball.x;st.ball.py=st.ball.y;
 st.deadAnchorX=st.anchorX;st.deadAnchorY=st.anchorY;
 for(const joint of st.links){joint.px=joint.x;joint.py=joint.y;joint.vx=joint.vy=0;}
 s.events.push({id:p.id,tick:s.tick,time:s.clock,reason});
 return true;
}
function resolveDeaths(s,ps){
 const live=living(ps),dead=new Map();
 const rad=C.body+C.ball+C.spike*.65;
 for(const victim of live){
  for(const attacker of ps){
   if(attacker===victim||!attacker.gladiator)continue;
   const mace=attacker.gladiator.ball,old={x:mace.px,y:mace.py};
   if(swept(old,mace,{x:victim.gladiator.lastX,y:victim.gladiator.lastY},victim,rad)){
    dead.set(victim,attacker.id);break;
   }
  }
  if(s.safeScale<1){
   const b=s.bounds,cx=b.w/2,cy=b.h/2;
   const halfW=(b.right-b.x)*s.safeScale/2-C.body;
   const halfH=(b.bottom-b.y)*s.safeScale/2-C.body;
   if(Math.abs(victim.x-cx)>halfW||Math.abs(victim.y-cy)>halfH)dead.set(victim,'arena');
  }
 }
 // Collect first, eliminate second: identical physics ticks share placement.
 s.lastEliminations=[...dead.keys()].map(p=>p.id);
 for(const [p,reason] of dead)eliminate(s,p,reason);
}
function finish(s,round,ps){
 if(s.finished)return;
 s.finished=true;s.winnerIds=living(ps).map(p=>p.id);
 const value=p=>p.gladiator?.alive?Infinity:(p.gladiator?.eliminatedTick??-1);
 const active=ps.filter(p=>p.active);
 s.ranking=active.map(p=>({id:p.id,rank:1+active.filter(o=>value(o)>value(p)).length,value:value(p)}))
  .sort((a,b)=>a.rank-b.rank||String(a.id).localeCompare(String(b.id)));
 round.remaining=null;
}
function step(dt,round,ps){
 const s=round.gladiators;if(s.finished)return;
 s.clock+=dt;s.tick++;
 if(s.clock>C.suddenAt){
  s.safeScale=Math.max(C.minSafe,1-(s.clock-C.suddenAt)*(1-C.minSafe)/C.suddenSeconds);
 }
 movePlayers(s,ps,dt);
 ballMotion(s,ps,dt);
 collideBalls(s,ps);
 collideOwnMaces(s,ps,dt);
 resolveDeaths(s,ps);
 const remaining=living(ps).length;
 if(ps.filter(p=>p.active).length===1){
  if(s.clock>=C.soloSeconds||remaining===0)finish(s,round,ps);
 }else if(remaining<=1)finish(s,round,ps);
}
function update(dt,round,ps){
 const s=round.gladiators;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.25,s.accumulator+clamp(finite(dt),0,.25));
 let cycles=0;
 while(s.accumulator+EPS>=STEP&&cycles++<15&&!s.finished){
  step(STEP,round,ps);s.accumulator-=STEP;
 }
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.gladiators;
 return {survivors:living(ps).length,remaining:null,elapsed:s?.clock||0,
  winnerIds:s?.winnerIds||[],statuses:ps.filter(p=>p.active).map(p=>({id:p.id,alive:!!p.gladiator?.alive}))};
}
function mace(g,p){
 const st=p.gladiator,ball=st.ball,ax=st.alive?st.anchorX:st.deadAnchorX,ay=st.alive?st.anchorY:st.deadAnchorY;
 const joints=[{x:ax,y:ay},...st.links,ball];
 g.save();g.lineCap='round';g.lineJoin='round';
 g.strokeStyle='#11161d';g.lineWidth=5.2;
 g.beginPath();g.moveTo(joints[0].x+2,joints[0].y+3);
 for(let i=1;i<joints.length;i++)g.lineTo(joints[i].x+2,joints[i].y+3);
 g.stroke();
 for(let i=1;i<joints.length;i++){
  const from=joints[i-1],to=joints[i];
  const x=(from.x+to.x)/2,y=(from.y+to.y)/2;
  g.save();g.translate(x,y);g.rotate(Math.atan2(to.y-from.y,to.x-from.x));
  g.strokeStyle=i%2?'#77818a':'#c8bec0';g.lineWidth=2.4;
  g.beginPath();g.ellipse(0,0,4.5,2.7,0,0,TAU);g.stroke();g.restore();
  g.fillStyle='#6c747e';g.beginPath();g.arc(to.x,to.y,1.5,0,TAU);g.fill();
 }
 const x=ball.x,y=ball.y,r=C.ball;
 g.fillStyle='#18202a44';g.beginPath();g.ellipse(x+5,y+8,r+7,r*.58,-.1,0,TAU);g.fill();
 g.translate(x,y);g.rotate(safeAngle(ball));
 for(let i=0;i<12;i++){
  const a=i*TAU/12,gx=Math.cos(a),gy=Math.sin(a);
  g.beginPath();g.moveTo(gx*(r-4)-gy*5,gy*(r-4)+gx*5);
  g.lineTo(gx*(r+C.spike+6),gy*(r+C.spike+6));
  g.lineTo(gx*(r-4)+gy*5,gy*(r-4)-gx*5);g.closePath();
  g.fillStyle='#535967';g.fill();g.strokeStyle='#121722';g.lineWidth=1;g.stroke();
 }
 const grad=g.createRadialGradient(-8,-9,1,0,0,r+3);
 grad.addColorStop(0,'#e8ecf0');grad.addColorStop(.25,p.color||'#a1bac5');
 grad.addColorStop(.68,'#596275');grad.addColorStop(1,'#141b2c');
 g.fillStyle=grad;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
 g.lineWidth=2;g.strokeStyle='#192334';g.stroke();
 g.fillStyle='#fff9';g.beginPath();g.ellipse(-8,-9,6,3,-.45,0,TAU);g.fill();
 g.fillStyle='#171b25';g.beginPath();g.arc(3,6,4.7,0,TAU);g.fill();
 g.restore();
}
function safeAngle(b){return Math.atan2(finite(b.vy),finite(b.vx))*.2;}
function draw(g,time,round,ps){
 const s=round.gladiators;if(!s)return;
 g.save();g.scale(960/s.bounds.w,540/s.bounds.h);
 if(window.GladiatorsArt?.draw)window.GladiatorsArt.draw(g,s,time);
 else{g.fillStyle='#b99458';g.fillRect(0,0,s.bounds.w,s.bounds.h);}
 if(s.safeScale<1){
  const b=s.bounds,cx=b.w/2,cy=b.h/2,w=(b.right-b.x)*s.safeScale,h=(b.bottom-b.y)*s.safeScale;
  g.save();g.beginPath();g.rect(0,0,b.w,b.h);g.rect(cx-w/2,cy-h/2,w,h);
  g.fillStyle='#460f13a6';g.fill('evenodd');
  g.strokeStyle='#ffd073';g.lineWidth=4;g.strokeRect(cx-w/2,cy-h/2,w,h);g.restore();
 }else if(s.clock>=C.suddenAt-6&&s.clock<C.suddenAt){
  g.save();g.strokeStyle='#ffab52';g.lineWidth=4;g.globalAlpha=.4+.3*Math.sin(s.clock*9);
  g.strokeRect(s.bounds.x,s.bounds.y,s.bounds.right-s.bounds.x,s.bounds.bottom-s.bounds.y);g.restore();
 }
 for(const p of ps)if(p.gladiator)mace(g,p);
 for(const p of living(ps)){
  if(window.PartyCharacters?.draw)window.PartyCharacters.draw(g,p,{time:s.clock,label:false,combat:false});
  else{g.fillStyle=p.color||'#eee';g.beginPath();g.arc(p.x,p.y,C.body,0,TAU);g.fill();}
 }
 g.restore();
 // Clock / survivors badge is painted once by app.js, never here.
}
window.Gladiators=Object.freeze({setup,update,draw,hud,step,finish,eliminate,spawnPositions,
 boundsFor,impact,swept,living,config:C});
})();
