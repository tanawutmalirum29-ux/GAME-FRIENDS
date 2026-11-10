/* CANNON CHAOS — host-authoritative pirate cannon duel, 60 Hz fixed step.
   Barrels spin by themselves; one fresh press fires the shot at the angle held at the press.
   Straight bullets, swept collision, 3 hearts, hit => full reload reset. Bots obey the same rules. */
import * as Art from './cannon-art.js';

const STEP=1/60,TAU=Math.PI*2,RAD=Math.PI/180,EPS=1e-8;
// All balance numbers live here (world units are for the 960x540 design world; scaled by u on big maps).
export const C=Object.freeze({
 rotDeg:100,            // barrel spin, degrees / second, same for everybody
 stopTime:.25,          // barrel frozen while firing
 releaseAt:.10,         // shot leaves the barrel this long after the accepted press
 reload:1.5,startReload:.6,
 hearts:3,invuln:.6,
 hitR:32,baseR:38,barrelLen:56,bulletR:6,
 bulletSpeed:440,duelBoost:1.18,   // duel boost applies only to bullets fired when 2 players remain
 timeSmall:60,timeLarge:80,finishDelay:1.1,
 botErrDeg:14
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const living=ps=>ps.filter(p=>p.active&&p.cn?.alive);
function rng(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x||0x3c6ef372;return(s.seed>>>0)/4294967296;}
function fxr(s){let x=s.fxSeed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.fxSeed=x||0x1b873593;return(s.fxSeed>>>0)/4294967296;}
const wrap=a=>{a%=TAU;return a<0?a+TAU:a;};

/* ------------------------------ world & layout ------------------------------ */
export function worldFor(n){
 const large=n>6;
 return large?{w:1280,h:720,large,u:4/3}:{w:960,h:540,large,u:1};
}
// Turrets sit on an ellipse around the island centre (4 players = four corners like the reference).
export function layoutFor(n,world){
 const {w,h,u,large}=world,cx=w/2,cy=h*.53,pts=[];
 if(n===1)pts.push({x:cx,y:cy});
 else if(n===2){pts.push({x:cx-.25*w,y:cy},{x:cx+.25*w,y:cy});}
 else if(n===4){
  const dx=.17*w,dy=.19*h;
  pts.push({x:cx-dx,y:cy-dy},{x:cx+dx,y:cy-dy},{x:cx-dx,y:cy+dy},{x:cx+dx,y:cy+dy});
 }else{
  const rx=(large?.30:.27)*w,ry=(large?.28:.27)*h;
  for(let i=0;i<n;i++){const a=-Math.PI/2+i*TAU/n;pts.push({x:cx+Math.cos(a)*rx,y:cy+Math.sin(a)*ry});}
 }
 let ex=0,ey=0;for(const q of pts){ex=Math.max(ex,Math.abs(q.x-cx));ey=Math.max(ey,Math.abs(q.y-cy));}
 const rx=Math.max(ex+118*u,.31*w),ry=Math.min(Math.max(ey+105*u,.40*h),h*.47-8);
 return {turrets:pts,island:Art.buildIsland(cx,cy,rx,ry)};
}

/* ------------------------------ geometry ------------------------------ */
// Swept segment vs circle: earliest fraction f in [0,1] where the moving point is within R of (cx,cy).
function segHit(x0,y0,x1,y1,cx,cy,R){
 const dx=x1-x0,dy=y1-y0,fx=x0-cx,fy=y0-cy,a=dx*dx+dy*dy,c=fx*fx+fy*fy-R*R;
 if(c<=0)return 0;
 if(a<1e-12)return null;
 const b=fx*dx+fy*dy;
 if(b>=0)return null;
 const disc=b*b-a*c;if(disc<0)return null;
 const f=(-b-Math.sqrt(disc))/a;
 return f>=0&&f<=1?f:null;
}
function insideIsland(s,x,y,grow){
 const isl=s.island,a=Math.atan2((y-isl.cy)/isl.ry,(x-isl.cx)/isl.rx);
 const k=1+.045*Math.sin(3*a+1.3)+.03*Math.sin(5*a+.4)+.02*Math.sin(7*a+2.1);
 const nx=(x-isl.cx)/(isl.rx*k*grow),ny=(y-isl.cy)/(isl.ry*k*grow);
 return nx*nx+ny*ny<=1;
}

/* ------------------------------ fx ------------------------------ */
function fx(s,e){if(s.fx.length>140)s.fx.shift();e.max=e.max||e.life;s.fx.push(e);}
function muzzle(s,x,y,a,color){
 fx(s,{k:'flash',x,y,a,life:.14});
 for(let i=0;i<5;i++){
  const sp=20+fxr(s)*50,aa=a+(fxr(s)-.5)*.8;
  fx(s,{k:'puff',x:x+Math.cos(a)*6,y:y+Math.sin(a)*6,vx:Math.cos(aa)*sp,vy:Math.sin(aa)*sp,life:.6+fxr(s)*.4,r0:4,grow:12,alpha:.5,color:i%2?'#9aa0a8':'#cfd3d8'});
 }
}
function blast(s,x,y,big){
 fx(s,{k:'blast',x,y,life:big?.7:.45,sz:big?1.5:1});
 const n=big?10:6;
 for(let i=0;i<n;i++){
  const a=fxr(s)*TAU,v=50+fxr(s)*120;
  fx(s,{k:'spark',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.35+fxr(s)*.3,r:2.8,color:i%2?'#ffb43a':'#fff0a8'});
 }
 for(let i=0;i<(big?6:3);i++){
  const a=fxr(s)*TAU,v=20+fxr(s)*60;
  fx(s,{k:'puff',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.9+fxr(s)*.5,r0:6,grow:18,alpha:.5,color:i%2?'#4a4550':'#6a636b'});
 }
 s.shake=Math.max(s.shake,big?.9:.5);
}
function splash(s,x,y){
 fx(s,{k:'splash',x,y,life:.55});
 for(let i=0;i<6;i++){
  const a=fxr(s)*TAU,v=30+fxr(s)*60;
  fx(s,{k:'drop',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.4+fxr(s)*.2,r:2.2});
 }
}

/* ------------------------------ setup ------------------------------ */
function makeBot(s){
 const skill=.55+rng(s)*.35;           // personality: accuracy only, never physics
 return {skill,interval:.034+rng(s)*.03,at:rng(s)*.1,err:0,errT:0,startDelay:.45+rng(s)*.6,slack:.04+rng(s)*.08};
}
export function setup(round,ps){
 if(!ps.length||ps.length>12)throw Error('CANNON CHAOS supports 1–12 players');
 const n=ps.length,world=worldFor(n),lay=layoutFor(n,world);
 const s={world,u:world.u,island:lay.island,turrets:lay.turrets,clock:0,tick:0,accumulator:0,
  seed:(((Number(round.cannonSeed)||(Date.now()^0x2d9a15f))>>>0)||1),fxSeed:0x9e3779b1,
  roster:ps,originalCount:n,bullets:[],fx:[],nextBullet:1,shake:0,
  timeLimit:world.large?C.timeLarge:C.timeSmall,
  finished:false,pendingFinish:0,winnerIds:[],ranking:[],decor:null};
 s.decor=Art.buildDecor(s);
 round.cannon=s;
 ps.forEach((p,i)=>{
  const t=s.turrets[i];
  p.active=true;p.score=0;p.x=t.x;p.y=t.y;p.vx=p.vy=0;
  const a0=rng(s)*TAU,dir=rng(s)<.5?-1:1;
  p.dir={x:Math.cos(a0),y:Math.sin(a0)};p.face=p.dir.x<0?-1:1;
  p.cn={alive:true,hearts:C.hearts,angle:a0,dir,state:'aim',fireT:0,released:false,shotAngle:a0,
   reload:C.startReload,invuln:0,hitFlash:0,recoil:0,req:false,prevPress:readFire(p),
   eliminatedTick:null,eliminatedAt:null,slot:i,bot:p.isBot?makeBot(s):null};
 });
 round.remaining=s.timeLimit;
 return s;
}

/* ------------------------------ input ------------------------------ */
// Any of A / B / C counts as "fire". Joystick and system buttons are ignored on purpose.
const BTN=['A','B','C','a','b','c','action','alt','fire','shoot','buttonA','buttonB','buttonC','btnA','btnB','btnC','primary','secondary','tertiary','action2','action3'];
function readFire(p){
 const inp=p.input;if(!inp||p.isBot)return false;
 try{
  const pc=globalThis.PartyCharacters;
  if(pc&&pc.control){const c=pc.control(inp);if(c&&(c.action||c.alt))return true;}
 }catch(e){/* fall through to raw flags */}
 for(const k of BTN)if(inp[k])return true;
 if(Array.isArray(inp.buttons)&&inp.buttons.slice(0,3).some(Boolean))return true;
 return false;
}
// A press is a rising edge only: holding never repeats, and releasing is required before the next shot.
function sampleInput(s,round,ps){
 const live=round.phase==='playing'&&!round.paused&&!s.finished;
 for(const p of ps){
  const c=p.cn;if(!c)continue;
  const now=readFire(p);
  if(live&&c.alive&&now&&!c.prevPress)c.req=true;
  c.prevPress=now;
 }
}

/* ------------------------------ firing ------------------------------ */
const speedNow=(s,ps)=>C.bulletSpeed*s.u*(living(ps).length===2?C.duelBoost:1);
function tryFire(s,p){
 const c=p.cn;
 if(!c.alive||c.state!=='aim'||c.reload>0)return false;   // too early => ignored, barrel keeps spinning
 c.state='firing';c.fireT=0;c.released=false;c.shotAngle=c.angle;
 return true;
}
function release(s,p,ps){
 const c=p.cn,u=s.u,a=c.shotAngle,L=C.barrelLen*u;
 const x=p.x+Math.cos(a)*L,y=p.y+Math.sin(a)*L,v=speedNow(s,ps);
 s.bullets.push({id:s.nextBullet++,owner:p.id,x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,age:0,tick:s.tick});
 c.released=true;c.reload=C.reload;c.recoil=1;
 muzzle(s,x,y,a,p.color);
}

/* ------------------------------ bots ------------------------------ */
function firstTarget(s,p,ps,ang){
 const u=s.u,L=C.barrelLen*u,ox=p.x+Math.cos(ang)*L,oy=p.y+Math.sin(ang)*L;
 const far=Math.hypot(s.world.w,s.world.h),ex=ox+Math.cos(ang)*far,ey=oy+Math.sin(ang)*far;
 let best=null;
 for(const q of living(ps)){
  if(q===p)continue;
  const f=segHit(ox,oy,ex,ey,q.x,q.y,(C.hitR+C.bulletR)*u);
  if(f!==null&&(!best||f<best.f))best={q,f,dist:f*far};
 }
 return best;
}
// The bot only ever decides WHEN to press; the barrel angle is never touched.
function botThink(s,p,ps,dt){
 const c=p.cn,b=c.bot;
 b.at-=dt;b.errT-=dt;
 if(b.errT<=0){b.err=(rng(s)-.5)*2*(1-b.skill)*C.botErrDeg*RAD;b.errT=.25+rng(s)*.3;}
 if(b.at>0)return;
 b.at=b.interval*(.85+rng(s)*.3);
 if(c.state!=='aim'||c.reload>0||c.req||s.clock<b.startDelay)return;
 const tg=firstTarget(s,p,ps,c.angle+b.err);
 if(!tg)return;
 const travel=C.releaseAt+tg.dist/speedNow(s,ps);
 if(tg.q.cn.invuln-travel>b.slack)return;                // would be absorbed by the invulnerability window
 let chance=.5+.45*b.skill;if(tg.q.cn.hearts===1)chance+=.15;
 if(rng(s)<chance)c.req=true;
}

/* ------------------------------ damage ------------------------------ */
function eliminate(s,p){
 const c=p.cn;
 c.alive=false;c.eliminatedTick=s.tick;c.eliminatedAt=s.clock;c.req=false;c.state='aim';c.released=false;
 blast(s,p.x,p.y,true);
 fx(s,{k:'ring',x:p.x,y:p.y,life:.6,color:'rgba(255,220,120,1)'});
}
function hitPlayer(s,p,x,y){
 const c=p.cn;
 if(c.invuln>0){fx(s,{k:'spark',x,y,vx:0,vy:0,life:.2,r:3,color:'#fff'});return;}   // no extra damage / no second reset
 c.hearts--;c.invuln=C.invuln;c.hitFlash=C.invuln;c.reload=C.reload;
 if(c.state==='firing'&&!c.released){c.state='aim';c.fireT=0;}  // unreleased shot is cancelled; released bullets fly on
 blast(s,x,y,false);
 if(c.hearts<=0)eliminate(s,p);
}
function stepBullets(s,ps){
 const dt=STEP,u=s.u,R=(C.hitR+C.bulletR)*u;
 for(const b of s.bullets){
  const x0=b.x,y0=b.y,x1=x0+b.vx*dt,y1=y0+b.vy*dt;
  let best=null;
  for(const q of living(ps)){
   if(q.id===b.owner)continue;
   const f=segHit(x0,y0,x1,y1,q.x,q.y,R);
   if(f!==null&&(!best||f<best.f))best={q,f};
  }
  if(best){
   b.dead=true;b.x=x0+(x1-x0)*best.f;b.y=y0+(y1-y0)*best.f;
   hitPlayer(s,best.q,b.x,b.y);
   continue;
  }
  b.x=x1;b.y=y1;b.age+=dt;
  if(!insideIsland(s,x1,y1,1.04)||b.age>8){b.dead=true;splash(s,x1,y1);}
 }
 if(s.bullets.some(b=>b.dead))s.bullets=s.bullets.filter(b=>!b.dead);
}

/* ------------------------------ ranking ------------------------------ */
function valueOf(s,p,ps){
 const c=p.cn;
 if(!c.alive)return c.eliminatedTick??-1;
 return living(ps).length===1?Infinity:1e6+c.hearts;   // timeout: more hearts = better, equal hearts tie
}
function finish(s,round,ps){
 s.finished=true;
 const list=ps.filter(p=>p.active),val=new Map(list.map(p=>[p.id,valueOf(s,p,ps)]));
 s.ranking=list.map(p=>({id:p.id,value:val.get(p.id),rank:1+list.filter(q=>val.get(q.id)>val.get(p.id)).length}))
  .sort((a,b)=>a.rank-b.rank||String(a.id).localeCompare(String(b.id)));
 s.winnerIds=s.ranking.filter(r=>r.rank===1).map(r=>r.id);
 s.bullets.length=0;
 round.remaining=0;
}

/* ------------------------------ step / update ------------------------------ */
export function step(dt,round,ps){
 const s=round.cannon;if(!s||s.finished)return;
 s.tick++;s.clock+=dt;
 const live=living(ps),blocked=s.pendingFinish>0;
 if(!blocked)for(const p of live)if(p.isBot)botThink(s,p,ps,dt);
 for(const p of live){const c=p.cn;if(c.req){c.req=false;if(!blocked)tryFire(s,p);}}   // one request -> at most one shot
 for(const p of live){
  const c=p.cn;
  c.invuln=Math.max(0,c.invuln-dt);c.hitFlash=Math.max(0,c.hitFlash-dt);
  c.reload=Math.max(0,c.reload-dt);c.recoil=Math.max(0,c.recoil-dt/.25);
  if(c.state==='aim')c.angle=wrap(c.angle+c.dir*C.rotDeg*RAD*dt);
  else{
   c.fireT+=dt;
   if(!c.released&&c.fireT+EPS>=C.releaseAt)release(s,p,ps);
   if(c.fireT+EPS>=C.stopTime){c.state='aim';c.fireT=0;}
  }
  p.dir={x:Math.cos(c.angle),y:Math.sin(c.angle)};p.face=p.dir.x<0?-1:1;
 }
 stepBullets(s,ps);
 for(const e of s.fx){
  e.life-=dt;
  if(e.vx!==undefined){e.x+=e.vx*dt;e.y+=e.vy*dt;const f=Math.exp(-2.6*dt);e.vx*=f;e.vy*=f;}
 }
 s.fx=s.fx.filter(e=>e.life>0);
 s.shake=Math.max(0,s.shake-dt*2.4);
 // smoke from wrecked turrets
 for(const p of ps)if(p.active&&p.cn&&!p.cn.alive&&s.tick%14===0&&s.fx.length<100)
  fx(s,{k:'puff',x:p.x+(fxr(s)-.5)*14,y:p.y+(fxr(s)-.5)*10,vx:0,vy:-14,life:1.2,r0:5,grow:12,alpha:.35,color:'#55505a'});
 round.remaining=Math.max(0,s.timeLimit-s.clock);
 const left=living(ps).length;
 if(!s.pendingFinish&&s.originalCount>1&&left<=1)s.pendingFinish=C.finishDelay;
 if(s.pendingFinish){s.pendingFinish-=dt;if(s.pendingFinish<=0)finish(s,round,ps);}
 else if(s.clock+EPS>=s.timeLimit)finish(s,round,ps);
}
export function update(dt,round,ps){
 const s=round.cannon;if(!s)return null;
 if(s.finished){
  for(const e of s.fx){e.life-=clamp(dt,0,.1);if(e.vx!==undefined){e.x+=e.vx*dt;e.y+=e.vy*dt;}}
  s.fx=s.fx.filter(e=>e.life>0);
  return 'winner';
 }
 sampleInput(s,round,ps);
 if(round.paused||round.phase!=='playing')return null;
 const d=Number.isFinite(dt)?clamp(dt,0,.25):0;
 s.accumulator=Math.min(.25,s.accumulator+d);
 let cycles=0;
 while(s.accumulator+EPS>=STEP&&cycles++<15&&!s.finished){step(STEP,round,ps);s.accumulator-=STEP;}
 return s.finished?'winner':null;
}

/* ------------------------------ drawing ------------------------------ */
export function draw(g,time,round,ps){
 const s=round.cannon;if(!s)return;
 const w=s.world,u=s.u;
 g.save();
 g.fillStyle='#0d4fe0';g.fillRect(0,0,960,540);
 g.scale(960/w.w,540/w.h);
 if(s.shake>0)g.translate(Math.sin(s.clock*93)*5*s.shake*u,Math.cos(s.clock*81)*5*s.shake*u);
 Art.drawBackground(g,s,time);
 const roster=ps.filter(p=>p.active&&p.cn);
 for(const p of roster)Art.drawBase(g,s.turrets[p.cn.slot],p.color||'#eee',u,!p.cn.alive);
 for(const e of s.fx)if(e.k==='puff'||e.k==='splash'||e.k==='drop')Art.drawFx(g,e,u);
 for(const p of roster){
  const c=p.cn,t=s.turrets[c.slot];
  if(!c.alive){Art.drawBarrel(g,t,c.angle+.5,0,'#555',u,0,true);Art.drawX(g,t,u);continue;}
  const ready=c.reload<=0&&c.state==='aim';
  Art.drawBarrel(g,t,c.angle,c.recoil,p.color||'#eee',u,ready?1:.35,false);
  const blink=c.hitFlash>0&&Math.floor(c.hitFlash*18)%2===0;
  if(!blink){
   if(globalThis.PartyCharacters?.draw)globalThis.PartyCharacters.draw(g,p,{time:s.clock,label:false,scale:u*.8});
   else{g.fillStyle=p.color||'#eee';g.beginPath();g.arc(t.x,t.y,16*u,0,TAU);g.fill();}
  }
  Art.drawReload(g,t,p.color||'#eee',u,1-c.reload/C.reload,ready,time);
 }
 for(const b of s.bullets)Art.drawBullet(g,b,u);
 for(const e of s.fx)if(e.k!=='puff'&&e.k!=='splash'&&e.k!=='drop')Art.drawFx(g,e,u);
 for(const p of roster){
  const c=p.cn;
  Art.drawHearts(g,s,s.turrets[c.slot],p.color||'#eee',u,Math.max(0,c.hearts),C.hearts,c.hitFlash,!c.alive);
 }
 g.restore();
}

/* ------------------------------ HUD / results ------------------------------ */
export function hud(ps,round){
 const s=round.cannon,list=ps.filter(p=>p.active&&p.cn);
 return {survivors:living(ps).length,remaining:round.remaining??null,elapsed:s?.clock||0,winnerIds:s?.winnerIds||[],
  hearts:Object.fromEntries(list.map(p=>[p.id,p.cn.hearts])),
  reload:Object.fromEntries(list.map(p=>[p.id,clamp(1-p.cn.reload/C.reload,0,1)])),
  statuses:list.map(p=>({id:p.id,alive:p.cn.alive,hearts:p.cn.hearts,max:C.hearts,
   reload:clamp(1-p.cn.reload/C.reload,0,1),ready:p.cn.alive&&p.cn.reload<=0&&p.cn.state==='aim'}))};
}
export function getResult(round,players){
 const s=round.cannon;
 return players.filter(p=>p.active).map(p=>{
  const c=p.cn,alive=!!c?.alive,value=s?valueOf(s,p,players):-1;
  const label=alive?'ผู้รอดชีวิต ♥'+c.hearts:'ตกรอบ • '+(c?.eliminatedAt??s?.clock??0).toFixed(1)+' วิ';
  return {id:p.id,value,label};
 });
}
export function getRoster(round,players){
 return players.filter(p=>p.active).map(p=>{
  const c=p.cn,alive=!!c?.alive;
  return {id:p.id,value:alive?1e6+c.hearts:(c?.eliminatedTick??-1),label:alive?'♥'.repeat(c.hearts):'ตกรอบ',
   status:alive?'alive':'out',eliminated:!alive};
 });
}
export function getControllerPacket(p,round,players){
 const c=p.cn||{};
 return {t:'cannon-chaos-status',mode:round.mode,alive:!!c.alive,hearts:c.hearts??0,
  reload:clamp(1-(c.reload??C.reload)/C.reload,0,1),ready:!!c.alive&&(c.reload??1)<=0&&c.state==='aim',
  survivors:living(players).length};
}
// Everything lives in round.cannon (plain data, no timers / listeners / canvases): dropping it frees the game.
export function dispose(round){
 const s=round?.cannon;
 if(s){s.bullets.length=0;s.fx.length=0;s.decor=null;s.roster=null;}
 if(round)round.cannon=null;
}

const engine=Object.freeze({getControllerPacket,getResult,getRoster,resultTitle:'ผู้รอดชีวิตคนสุดท้าย!',
 countdownSeconds:3,setup,update,draw,hud,step,finish,dispose,cleanup:dispose,worldFor,layoutFor,config:C});
export default engine;
