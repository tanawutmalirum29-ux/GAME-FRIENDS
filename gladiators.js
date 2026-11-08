/* GLADIATORS — host-authoritative chained-mace survival, 60 Hz fixed-step.
   All hit/death resolution happens on the host, irrespective of rendering FPS. */
(() => {
'use strict';
const TAU=Math.PI*2,STEP=1/60,EPS=1e-8;
const C=Object.freeze({body:15,ball:21,spike:4,chain:96,speed:166,maxBallSpeed:720,
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
  const bx=clamp(point.x+out.x*72,b.x+C.ball+9,b.right-C.ball-9);
  const by=clamp(point.y+out.y*72,b.y+C.ball+9,b.bottom-C.ball-9);
  p.gladiator={alive:true,eliminatedTick:null,eliminatedAt:null,reason:null,
   ball:{x:bx,y:by,vx:0,vy:0,px:bx,py:by,static:false,owner:p.id},
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
function movePlayers(s,ps,dt){
 const b=s.bounds,live=living(ps);
 for(const p of live){
  const st=p.gladiator;
  st.lastX=p.x;st.lastY=p.y;
  const v=p.isBot?botControl(s,p,ps):inputOf(p);
  // Shared character module owns movement and wall projection.
  if(window.PartyCharacters?.move){
   window.PartyCharacters.move(p,v,dt,{speed:C.speed*(p.isBot?.95:1),
    radius:C.body,bounds:{x:b.x,y:b.y,w:b.right-b.x,h:b.bottom-b.y}});
  }else{
   p.x=clamp(p.x+v.x*C.speed*dt,b.x+C.body,b.right-C.body);
   p.y=clamp(p.y+v.y*C.speed*dt,b.y+C.body,b.bottom-C.body);
   if(hyp(v.x,v.y)>.1)p.dir={x:v.x,y:v.y};
  }
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
function constrain(ball,p,dt){
 const st=p.gladiator,a=anchor(p);
 st.anchorX=a.x;st.anchorY=a.y;
 let dx=ball.x-a.x,dy=ball.y-a.y,d=hyp(dx,dy);
 if(d<=C.chain)return;
 if(d<EPS){dx=1;dy=0;d=1;}
 const nx=dx/d,ny=dy/d;
 ball.x=a.x+nx*C.chain;ball.y=a.y+ny*C.chain;
 const ax=(a.x-st.prevAnchorX)/dt,ay=(a.y-st.prevAnchorY)/dt;
 const relative=(ball.vx-ax)*nx+(ball.vy-ay)*ny;
 if(relative>0){ball.vx-=relative*nx;ball.vy-=relative*ny;}
 // Small controllable recoil for taut chains, with no teleportation.
 const recoil=clamp(relative*.015,0,1.2);
 if(recoil){p.x=clamp(p.x+nx*recoil,st._minX,st._maxX);
  p.y=clamp(p.y+ny*recoil,st._minY,st._maxY);}
}
function ballMotion(s,ps,dt){
 const b=s.bounds;
 for(const p of living(ps)){
  const st=p.gladiator,ball=st.ball,prev=anchor(p);
  st.prevAnchorX=st.anchorX;st.prevAnchorY=st.anchorY;
  st._minX=b.x+C.body;st._maxX=b.right-C.body;
  st._minY=b.y+C.body;st._maxY=b.bottom-C.body;
  ball.px=ball.x;ball.py=ball.y;
  // No artificial spin; only the moving chain anchor injects momentum.
  ball.vx*=C.air;ball.vy*=C.air;
  let speed=hyp(ball.vx,ball.vy);
  if(speed>C.maxBallSpeed){ball.vx*=C.maxBallSpeed/speed;ball.vy*=C.maxBallSpeed/speed;}
  ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
  // Anchor may move into an initially slack ball; positional constraint
  // conserves tangential velocity when the tether becomes taut.
  constrain(ball,p,dt);
  wall(s,ball);constrain(ball,p,dt);
  if(!Number.isFinite(ball.x+ball.y+ball.vx+ball.vy)){
   ball.x=prev.x+50;ball.y=prev.y;ball.vx=ball.vy=0;
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
  if(p.gladiator.alive){wall(s,q);constrain(q,p,STEP);}
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
 const dx=ball.x-ax,dy=ball.y-ay,d=hyp(dx,dy)||1,nx=dx/d,ny=dy/d;
 const links=Math.max(1,Math.floor(d/9));
 g.save();g.lineCap='round';g.lineJoin='round';
 g.strokeStyle='#11161d';g.lineWidth=6;
 g.beginPath();g.moveTo(ax+2,ay+3);g.lineTo(ball.x+2,ball.y+3);g.stroke();
 for(let i=1;i<=links;i++){
  const t=(i-.5)/links,x=ax+dx*t,y=ay+dy*t;
  g.save();g.translate(x,y);g.rotate(Math.atan2(dy,dx));
  g.strokeStyle=i%2?'#77818a':'#c8bec0';g.lineWidth=2.4;
  g.beginPath();g.ellipse(0,0,4.5,2.7,0,0,TAU);g.stroke();g.restore();
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
