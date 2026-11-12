/* COWBOY CROSSFIRE — last-gunslinger-standing duel on a shrinking circular track.
   Everyone auto-runs on ONE ring (angular position), firing = straight bullet through the arena
   centre + instant (eased) reversal of running direction. Fixed 60 Hz step, world units only. */
import {KINDS,buildBackdrop,drawPlaza,drawObstacle,drawRevolver,drawHeart,drawBullet,drawFx} from './crossfire-art.js';

const STEP=1/60,TAU=Math.PI*2,EPS=1e-8;
// All balance numbers live here; the logic below never hard-codes them.
const C=Object.freeze({
 radius:15,                 // hit radius (sprite is 52 wide, never used for collision)
 speed:118,                 // tangential running speed, world units / s, identical for everyone
 turnRate:11,               // easing of direction reversal (no snap, no teleport)
 cooldown:.5,bulletSpeed:540,bulletR:4,bulletLife:3,
 hp:3,invuln:.6,
 shrinkTime:1.75,
 kick:62,kickDecay:9,bumpLock:.4,
 smallR:195,largeR:290,obsExtent:.33,
 intermission:.9,finishDelay:.9,
 matchSeconds:150,matchSecondsLarge:210,soloSeconds:40,
 duelTier1:16,duelTier2:30,tierCooldown:[1,.9,.8],tierBullet:[1,1.06,1.12],
 minRatio:.5,duelRatio:.575,tierRatioDrop:.0375
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const wrap=a=>{a=(a+Math.PI)%TAU;if(a<0)a+=TAU;return a-Math.PI;};
const mod=a=>{a%=TAU;return a<0?a+TAU:a;};
const living=ps=>ps.filter(p=>p.active&&p.cf?.alive);
function rng(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x||0x3c6ef372;return(s.seed>>>0)/4294967296;}
function fxr(s){let x=s.fxSeed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.fxSeed=x||0x1b873593;return(s.fxSeed>>>0)/4294967296;}
function fx(s,e){e.max=e.life;if(s.fx.length<260)s.fx.push(e);}

/* ------------------------------ world / ratio ------------------------------ */
function worldFor(n){
 const large=n>6;
 return large?{w:1280,h:720,large,cx:640,cy:360,R0:C.largeR}:{w:960,h:540,large,cx:480,cy:270,R0:C.smallR};
}
// Radius vs start, from the number of survivors (7–12:100% · 5–6:85% · 3–4:70% · 2:55–60%).
// Fields that START with ≤6 players use the same table normalised to their own starting band.
function bandRatio(a){return a>=7?1:a>=5?.85:a>=3?.7:C.duelRatio;}
function ratioFor(s,alive,tier){
 if(s.solo)return 1;
 if(alive<=2)return Math.max(C.minRatio,C.duelRatio-C.tierRatioDrop*tier);
 return Math.min(1,bandRatio(alive)/bandRatio(s.initial));
}
function minGapR(s,live){
 const n=live.length;if(n<2)return 0;
 const a=live.map(p=>mod(p.cf.theta)).sort((x,y)=>x-y);
 let g=Infinity;
 for(let i=0;i<n;i++){const d=i===n-1?TAU-(a[i]-a[0]):a[i+1]-a[i];if(d<g)g=d;}
 if(g>=Math.PI)return 0;
 return C.radius*1.02/Math.sin(Math.max(g,.02)/2);
}
function refreshGoal(s,live){
 const alive=live.length,key=alive+'|'+s.tier;
 if(key===s.goalKey)return;
 s.goalKey=key;
 const goal=Math.max(ratioFor(s,alive,s.tier)*s.world.R0,s.obsExt+C.radius+14);
 if(Math.abs(goal-s.Rgoal)<.5)return;
 s.Rfrom=s.R;s.Rgoal=Math.min(goal,s.world.R0);s.shrink=0;s.shrinkDur=C.shrinkTime;
 s.vmax=Math.abs(s.Rfrom-s.Rgoal)/s.shrinkDur*2.4+1;
}
function updateRadius(s,live,dt){
 if(s.shrink<s.shrinkDur)s.shrink+=dt;
 const u=clamp(s.shrink/s.shrinkDur,0,1),e=u*u*(3-2*u);
 let want=s.Rfrom+(s.Rgoal-s.Rfrom)*e;
 if(want<s.R){ // never squeeze characters into each other; hold until they drift apart
  const lim=minGapR(s,live);
  want=Math.max(want,Math.min(s.R,lim),s.R-s.vmax*dt);
 }
 s.R=want;
}

/* ------------------------------ obstacles ------------------------------ */
function pickKind(s){
 const ks=Object.keys(KINDS),tot=ks.reduce((a,k)=>a+KINDS[k].weight,0);let x=rng(s)*tot;
 for(const k of ks){x-=KINDS[k].weight;if(x<=0)return k;}return ks[0];
}
// Every bullet crosses the exact centre, so the cover must leave a good share of firing lines open.
function openFraction(list){
 let open=0;const N=90;
 for(let i=0;i<N;i++){
  const a=i*Math.PI/N,ux=Math.cos(a),uy=Math.sin(a);
  if(!list.some(o=>Math.abs(o.rx*uy-o.ry*ux)<o.ro+C.bulletR+1))open++;
 }
 return open/N;
}
function makeObstacles(s){
 const w=s.world,ext=w.R0*C.obsExtent,count=w.large?9:6;
 let best=null,bestScore=9;
 for(let attempt=0;attempt<400;attempt++){
  const list=[];
  for(let i=0,guard=0;i<count&&guard<80;guard++){
   const kind=pickKind(s),ro=KINDS[kind].ro,dmax=ext-ro;if(dmax<10)continue;
   const d=8+rng(s)*(dmax-8),a=rng(s)*TAU,rx=Math.cos(a)*d,ry=Math.sin(a)*d;
   if(list.some(o=>Math.hypot(o.rx-rx,o.ry-ry)<o.ro+ro+3))continue;
   list.push({kind,ro,rx,ry,hp:KINDS[kind].hp,maxHp:KINDS[kind].hp,ang:(rng(s)-.5)*1.6,crack:rng(s)*TAU,alive:true,hitFlash:0,
    x:w.cx+rx,y:w.cy+ry});
   i++;
  }
  if(list.length<count-2)continue;
  const f=openFraction(list),score=Math.abs(f-.5);
  if(f>=.36&&f<=.72){best=list;break;}
  if(score<bestScore){bestScore=score;best=list;}
 }
 s.obstacles=best||[];
 s.obsExt=Math.max(0,...s.obstacles.map(o=>Math.hypot(o.rx,o.ry)+o.ro));
}
// First intact obstacle on the straight line a shooter at angle θ would fire along (null = clear).
function rayBlocker(s,theta){
 const ux=-Math.cos(theta),uy=-Math.sin(theta);let best=null,bd=Infinity;
 for(const o of s.obstacles){
  if(!o.alive)continue;
  const along=o.rx*ux+o.ry*uy,perp=Math.abs(o.rx*uy-o.ry*ux);
  if(perp<o.ro+C.bulletR*.8&&along+1e4<bd+1e4){const d=along;if(d<bd){bd=d;best=o;}}
 }
 return best;
}

/* ------------------------------ setup ------------------------------ */
function makeBot(s){
 const skill=.62+rng(s)*.3;
 return {skill,interval:.07+rng(s)*.06,t:rng(s)*.2,react:.14+(1-skill)*.34,idle:.8+rng(s)*1.4,useless:0,sigma:.02+(1-skill)*.13};
}
function setup(round,ps){
 if(!ps.length||ps.length>12)throw Error('COWBOY CROSSFIRE supports 1–12 players');
 const n=ps.length,world=worldFor(n);
 const s={world,cx:world.cx,cy:world.cy,clock:0,tick:0,accumulator:0,
  seed:(((Number(round.crossfireSeed)||(Date.now()^0x51ed27))>>>0)||1),fxSeed:0x9e3779b1,
  initial:n,solo:n===1,fx:[],bullets:[],obstacles:[],locks:Object.create(null),shake:0,
  R:world.R0,Rfrom:world.R0,Rgoal:world.R0,shrink:1,shrinkDur:1,vmax:0,goalKey:'',tier:0,duel:0,
  cooldown:C.cooldown,bulletSpeed:C.bulletSpeed,obsExt:0,bg:null,
  finished:false,pendingFinish:0,timeout:false,winnerIds:[],ranking:[],eliminations:0,matchMax:n===1?C.soloSeconds:n>6?C.matchSecondsLarge:C.matchSeconds,matchLeft:0};
 s.matchLeft=s.matchMax;
 round.crossfire=s;
 makeObstacles(s);
 s.bg=buildBackdrop(world,s.cx,s.cy,world.R0,(s.seed>>>3)&0xffff);
 const base=rng(s)*TAU,step=TAU/n,order=ps.map((_,i)=>i);
 for(let i=order.length-1;i>0;i--){const j=Math.floor(rng(s)*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 ps.forEach((p,i)=>{
  const slot=order[i],theta=mod(base+slot*step+(rng(s)-.5)*step*.22),dir=rng(s)<.5?1:-1;
  p.active=true;p.score=0;
  p.cf={alive:true,hp:C.hp,theta,dir,turn:dir,kick:0,omega:0,lastFlip:0,cd:.35,invuln:0,recoil:0,held:false,pendingFire:false,
   eliminatedTick:null,eliminatedAt:null,shots:0,hitsTaken:0,bot:p.isBot?makeBot(s):null};
  place(s,p);
 });
 if(n===2){ // a 1v1 has no eliminations to shrink on, so it tightens toward the duel radius on its own
  s.Rgoal=Math.max(C.duelRatio*world.R0,s.obsExt+C.radius+14);s.shrinkDur=8;s.shrink=0;s.vmax=Math.abs(s.Rfrom-s.Rgoal)/8*2.4+1;
  s.goalKey='2|0';
 }else refreshGoal(s,ps);
 round.remaining=s.matchLeft;
 return s;
}
function place(s,p){
 const c=p.cf,cs=Math.cos(c.theta),sn=Math.sin(c.theta);
 p.x=s.cx+cs*s.R;p.y=s.cy+sn*s.R;
 p.dir={x:-cs,y:-sn};p.face=p.dir.x<0?-1:1;           // gun always faces the arena centre
 const lin=clamp(c.turn*C.speed+c.kick,-C.speed*1.5,C.speed*1.5);
 p.vx=-sn*lin;p.vy=cs*lin;c.omega=lin/s.R;
}

/* ------------------------------ firing ------------------------------ */
function heldFire(p){
 const k=p.input||{};let q=null;
 try{q=window.PartyCharacters?.control?.(k);}catch(e){q=null;}
 // A, B and C all fire. Pause / system buttons are not read here at all.
 return !!(q&&(q.action||q.alt))||!!(k.a||k.b||k.c||k.A||k.B||k.C||k.action||k.alt||k.actionC||k.buttonC||k.fire||k.shoot);
}
// Single entry point for humans AND bots: shoot only if off cooldown, and reverse only on a real shot.
function tryFire(s,p){
 const c=p.cf;if(!c||!c.alive||c.cd>0||s.finished)return false;
 c.cd=s.cooldown;c.dir=-c.dir;c.recoil=1;c.shots++;c.lastFlip=s.clock;
 const ux=-Math.cos(c.theta),uy=-Math.sin(c.theta),sx=p.x+ux*(C.radius+7),sy=p.y+uy*(C.radius+7);
 // direction + position are captured NOW; the bullet never steers afterwards
 s.bullets.push({owner:p.id,x:sx,y:sy,vx:ux*s.bulletSpeed,vy:uy*s.bulletSpeed,born:s.clock,skip:Object.create(null)});
 const ang=Math.atan2(uy,ux);
 fx(s,{k:'flash',x:sx+ux*8,y:sy+uy*8,ang,life:.12});
 for(let i=0;i<4;i++)fx(s,{k:'puff',x:sx+ux*(6+i*4),y:sy+uy*(6+i*4),vx:ux*30+(fxr(s)-.5)*34,vy:uy*30+(fxr(s)-.5)*34,life:.55,r0:2.5,grow:9,alpha:.34,color:'#e9ddc8'});
 return true;
}

/* ------------------------------ bots ------------------------------ */
const gauss=s=>(rng(s)+rng(s)+rng(s)-1.5)*2;
function angleAfter(s,c,d,T){ // where a runner ends up after T s if its target direction is d
 const k=C.turnRate;
 return c.theta+(C.speed/s.R)*(d*T+(c.turn-d)*(1-Math.exp(-k*T))/k);
}

// Look ~2 s ahead: would reversing NOW (the shot is spent just to turn) set up a clean shot later,
// while staying the course never lines anyone up? Uses only what a player can see (current headings).
function planFlip(s,p,live,tol,T){
 const c=p.cf,R=s.R,w=C.speed/R,k=C.turnRate;
 let bestStay=Infinity,bestFlip=Infinity;
 for(let t=s.cooldown+.03;t<=2;t+=.06){
  const mine=d=>c.theta+w*(d*t+(c.turn-d)*(1-Math.exp(-k*t))/k)+Math.PI;
  const aStay=mine(c.dir),aFlip=mine(-c.dir);
  for(const e of live){
   if(e===p)continue;
   const ea=e.cf.theta+w*e.cf.turn*(t+T);
   bestStay=Math.min(bestStay,Math.abs(wrap(ea-aStay)));
   bestFlip=Math.min(bestFlip,Math.abs(wrap(ea-aFlip)));
  }
 }
 return bestFlip<tol*.75&&bestStay>tol*1.8;
}
function botDecide(s,p,live,dt){
 const c=p.cf,b=c.bot;
 b.t-=dt;if(b.t>0)return false;b.t=b.interval*(.7+rng(s)*.6);
 b.idle-=b.interval;
 b.cool=(b.cool||0)+b.interval;if(b.cool>2.5){b.cool=0;b.useless=Math.max(0,b.useless-1);} // wasted-shot streak fades with time
 if(c.cd>0)return false;
 const R=s.R,r=C.radius,tol=(r+C.bulletR)*.95/R;
 // 1) dodge: a bullet's whole path is known once fired (straight line through the centre)
 for(const bl of s.bullets){
  if(bl.owner===p.id||s.clock-bl.born<b.react)continue;
  const sp=Math.hypot(bl.vx,bl.vy),ux=bl.vx/sp,uy=bl.vy/sp,sb=(bl.x-s.cx)*ux+(bl.y-s.cy)*uy;
  if(sb>R)continue;
  const tb=(R-sb)/sp;if(tb<.05)continue;
  const phi=Math.atan2(uy,ux),dt2=tol+2/R;
  if(Math.abs(wrap(angleAfter(s,c,c.dir,tb)-phi))<dt2&&Math.abs(wrap(angleAfter(s,c,-c.dir,tb)-phi))>dt2*1.35&&rng(s)<.18+b.skill*.5){b.useless=0;return true;}
 }
 // 2) attack: estimate where an enemy will be when the bullet reaches the far side of the ring
 const T=(2*R-r-7)/s.bulletSpeed,phiOut=c.theta+Math.PI;
 let bestErr=Infinity;
 for(const e of live){
  if(e===p)continue;
  const pred=e.cf.theta+(C.speed/R)*e.cf.turn*T+gauss(s)*b.sigma;
  const err=Math.abs(wrap(pred-phiOut));if(err<bestErr)bestErr=err;
 }
 const blocker=rayBlocker(s,c.theta);
 if(!blocker&&bestErr<tol*(live.length<=2?1.3:1.15)&&rng(s)<.5+b.skill*.5){b.useless=0;b.idle=.8+rng(s)*1.2;return true;}
 // 2b) reposition: spend a shot to reverse when that creates a future alignment
 if(b.useless<3&&live.length>1&&planFlip(s,p,live,tol,T)&&rng(s)<.35+b.skill*.4){b.useless++;return true;}
 // 2c) stalemate breaker: two runners circling the same way never meet, so after a long quiet spell shake things up
 if(live.length<=4&&s.clock-c.lastFlip>2.6+b.idle*.6&&rng(s)<.5){b.useless++;return true;}
 // 3) occasional useful shot: chew through cover that blocks the lane (never spam; back off after useless shots)
 if(b.idle<=0){
  b.idle=.9+rng(s)*1.5+b.useless*.9;
  if(blocker&&rng(s)<.7){b.useless++;return true;}
 }
 return false;
}

/* ------------------------------ physics ------------------------------ */
function segCircle(ax,ay,bx,by,cx,cy,r){
 const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy||1e-9,t=clamp(((cx-ax)*dx+(cy-ay)*dy)/l2,0,1);
 return Math.hypot(ax+dx*t-cx,ay+dy*t-cy)<=r?t:-1;
}
function resolveRing(s,live){
 const n=live.length;if(n<2)return;
 let dmin=2*Math.asin(Math.min(.999,C.radius*1.02/s.R));
 if(n*dmin>TAU*.97)dmin=TAU*.97/n;
 for(let it=0;it<4;it++){
  const arr=live.slice().sort((a,b)=>mod(a.cf.theta)-mod(b.cf.theta));
  for(let i=0;i<n;i++){
   const a=arr[i],b=arr[(i+1)%n];if(a===b)continue;
   let gap=mod(b.cf.theta-a.cf.theta);if(n===2&&i===1)gap=TAU-mod(arr[1].cf.theta-arr[0].cf.theta);
   if(gap>=dmin)continue;
   if(it===0&&gap<dmin*1.05&&a.cf.omega-b.cf.omega>.02){ // head-on closing contact -> both reverse, once per contact
    const key=a.id<b.id?a.id+'|'+b.id:b.id+'|'+a.id;
    if((s.locks[key]||0)<=s.clock){
     s.locks[key]=s.clock+C.bumpLock;
     a.cf.dir=-a.cf.dir;b.cf.dir=-b.cf.dir;a.cf.lastFlip=b.cf.lastFlip=s.clock;a.cf.kick=-C.kick;b.cf.kick=C.kick;
     const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;s.shake=Math.max(s.shake,.22);
     fx(s,{k:'ring',x:mx,y:my,r0:4,grow:20,life:.3,color:'#fff0c0'});
     for(let q=0;q<7;q++)fx(s,{k:'spark',x:mx,y:my,vx:(fxr(s)-.5)*190,vy:(fxr(s)-.5)*190,life:.3,r:2.6,color:'#ffe3a0'});
     for(let q=0;q<3;q++)fx(s,{k:'puff',x:mx,y:my,vx:(fxr(s)-.5)*60,vy:(fxr(s)-.5)*60,life:.6,r0:3,grow:11,alpha:.35,color:'#d9a672'});
    }
   }
   const o=(dmin-gap)/2+1e-4;a.cf.theta-=o;b.cf.theta+=o;
  }
 }
 for(const p of live)p.cf.theta=mod(p.cf.theta);
}
function damageObstacle(s,o,bl){
 o.hp--;o.hitFlash=.18;
 for(let i=0;i<5;i++)fx(s,{k:'splinter',x:bl.x,y:bl.y,vx:(fxr(s)-.5)*170,vy:(fxr(s)-.5)*170,rot:fxr(s)*TAU,spin:(fxr(s)-.5)*9,len:4+fxr(s)*6,life:.55,color:o.kind==='cactus'?'#5a9a44':'#a8703a'});
 fx(s,{k:'puff',x:bl.x,y:bl.y,life:.5,r0:3,grow:9,alpha:.3,color:'#d9b384'});
 if(o.hp<=0){
  o.alive=false;s.shake=Math.max(s.shake,.18);
  for(let i=0;i<14;i++)fx(s,{k:'splinter',x:o.x,y:o.y,vx:(fxr(s)-.5)*230,vy:(fxr(s)-.5)*230,rot:fxr(s)*TAU,spin:(fxr(s)-.5)*12,len:5+fxr(s)*8,life:.8,color:o.kind==='cactus'?'#5a9a44':fxr(s)<.5?'#a8703a':'#6f4524'});
  for(let i=0;i<5;i++)fx(s,{k:'puff',x:o.x+(fxr(s)-.5)*10,y:o.y+(fxr(s)-.5)*10,vx:(fxr(s)-.5)*50,vy:(fxr(s)-.5)*50,life:.9,r0:5,grow:16,alpha:.4,color:'#dcbb8a'});
 }
}
function eliminate(s,p){
 const c=p.cf;if(!c?.alive)return false;
 c.alive=false;c.hp=0;c.eliminatedAt=s.clock;c.eliminatedTick=s.tick;s.eliminations++;s.shake=Math.max(s.shake,.5);
 fx(s,{k:'ring',x:p.x,y:p.y,r0:6,grow:46,life:.5,color:'#ff9a6a'});
 for(let i=0;i<14;i++)fx(s,{k:'spark',x:p.x,y:p.y,vx:(fxr(s)-.5)*320,vy:(fxr(s)-.5)*320,life:.55,r:3.2,color:fxr(s)<.5?'#ffd27a':'#ff7a5a'});
 for(let i=0;i<6;i++)fx(s,{k:'puff',x:p.x,y:p.y,vx:(fxr(s)-.5)*90,vy:(fxr(s)-.5)*90,life:1,r0:6,grow:20,alpha:.45,color:'#cdb89a'});
 return true;
}
function stepBullets(s,ps,dt){
 const keep=[];
 for(const bl of s.bullets){
  const nx=bl.x+bl.vx*dt,ny=bl.y+bl.vy*dt;
  let hitT=Infinity,hitO=null,hitP=null;
  for(const o of s.obstacles){
   if(!o.alive)continue;
   const t=segCircle(bl.x,bl.y,nx,ny,o.x,o.y,o.ro+C.bulletR*.6);
   if(t>=0&&t<hitT){hitT=t;hitO=o;hitP=null;}
  }
  for(const q of ps){
   if(!q.cf?.alive||q.id===bl.owner||bl.skip[q.id])continue;
   const t=segCircle(bl.x,bl.y,nx,ny,q.x,q.y,C.radius+C.bulletR*.6);
   if(t>=0&&t<hitT){hitT=t;hitO=null;hitP=q;}
  }
  if(hitO){bl.x+=(nx-bl.x)*hitT;bl.y+=(ny-bl.y)*hitT;damageObstacle(s,hitO,bl);continue;}   // stops at cover
  if(hitP){
   const c=hitP.cf;
   if(c.invuln>0){bl.skip[hitP.id]=true;}               // grace window: bullet flies on, no damage
   else{
    c.hp--;c.hitsTaken++;c.invuln=C.invuln;s.shake=Math.max(s.shake,.3);
    fx(s,{k:'ring',x:hitP.x,y:hitP.y,r0:5,grow:26,life:.32,color:'#ff6a5a'});
    for(let i=0;i<8;i++)fx(s,{k:'spark',x:hitP.x,y:hitP.y,vx:(fxr(s)-.5)*240,vy:(fxr(s)-.5)*240,life:.35,r:2.6,color:'#ff8a6a'});
    if(c.hp<=0)eliminate(s,hitP);
    continue;                                           // one bullet = one damage event on one target
   }
  }
  bl.x=nx;bl.y=ny;
  const d=Math.hypot(bl.x-s.cx,bl.y-s.cy),out=(bl.x-s.cx)*bl.vx+(bl.y-s.cy)*bl.vy>0;
  if(s.clock-bl.born>C.bulletLife||(out&&d>s.world.R0+60))continue;
  keep.push(bl);
 }
 s.bullets=keep;
}

/* ------------------------------ step / update ------------------------------ */
function finish(s,round,ps){
 s.finished=true;
 const list=ps.filter(p=>p.active),alive=living(list);
 s.winnerIds=alive.length===1||s.solo?alive.map(p=>p.id):[];
 s.ranking=getResult(round,list).sort((a,b)=>b.value-a.value);
 round.remaining=0;
}
function step(dt,round,ps){
 const s=round.crossfire;if(!s||s.finished)return;
 s.tick++;s.clock+=dt;
 const live=living(ps);
 for(const p of live){const c=p.cf;c.cd=Math.max(0,c.cd-dt);c.invuln=Math.max(0,c.invuln-dt);c.recoil=Math.max(0,c.recoil-dt*6);}
 for(const o of s.obstacles)o.hitFlash=Math.max(0,o.hitFlash-dt);
 // input (humans: edge-triggered press captured in update(); bots: same tryFire path)
 if(!s.pendingFinish){
  for(const p of live){
   const c=p.cf;
   if(c.bot){if(botDecide(s,p,live,dt))tryFire(s,p);}
   else if(c.pendingFire){c.pendingFire=false;tryFire(s,p);}      // pressed during cooldown = nothing happens
  }
 }
 // duel escalation (only while exactly two remain)
 if(live.length===2){
  s.duel+=dt;
  const tier=s.duel>=C.duelTier2?2:s.duel>=C.duelTier1?1:0;
  if(tier!==s.tier){s.tier=tier;s.cooldown=C.cooldown*C.tierCooldown[tier];s.bulletSpeed=C.bulletSpeed*C.tierBullet[tier];}
 }
 refreshGoal(s,live);
 updateRadius(s,live,dt);
 // movement on the ring: constant LINEAR speed, so a smaller ring never makes anyone faster
 for(const p of live){
  const c=p.cf;
  c.turn+=(c.dir-c.turn)*Math.min(1,C.turnRate*dt);
  c.kick*=Math.exp(-C.kickDecay*dt);
  const lin=clamp(c.turn*C.speed+c.kick,-C.speed*1.5,C.speed*1.5);
  c.theta=mod(c.theta+lin/s.R*dt);
 }
 for(const p of live)place(s,p);            // refresh x/y at the (possibly shrunken) radius before contact tests
 resolveRing(s,live);
 for(const p of live)place(s,p);
 stepBullets(s,ps,dt);
 // clocks / finish conditions
 const left=living(ps);
 if(!s.pendingFinish){
  if(s.solo){s.matchLeft=Math.max(0,s.matchMax-s.clock);if(s.matchLeft<=0)s.pendingFinish=EPS;}
  else{
   s.matchLeft=Math.max(0,s.matchMax-s.clock);
   if(left.length<=1)s.pendingFinish=C.finishDelay;
   else if(s.matchLeft<=0){s.timeout=true;s.pendingFinish=EPS;}
  }
 }
 round.remaining=s.matchLeft;
 for(const e of s.fx){
  e.life-=dt;
  if(e.vx!==undefined){e.x+=e.vx*dt;e.y+=e.vy*dt;const f=Math.exp(-3*dt);e.vx*=f;e.vy*=f;}
 }
 s.fx=s.fx.filter(e=>e.life>0);
 s.shake=Math.max(0,s.shake-dt*2.2);
 if(s.pendingFinish){s.pendingFinish-=dt;if(s.pendingFinish<=0)finish(s,round,ps);}
}
function update(dt,round,ps){
 const s=round.crossfire;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 for(const p of ps){ // one shot per press (rising edge) — holding or mashing cannot skip the cooldown
  const c=p.cf;if(!c||!c.alive||c.bot)continue;
  const held=heldFire(p);if(held&&!c.held)c.pendingFire=true;c.held=held;
 }
 s.accumulator=Math.min(.25,s.accumulator+clamp(finite(dt),0,.25));
 let cycles=0;
 while(s.accumulator+EPS>=STEP&&cycles++<15&&!s.finished){step(STEP,round,ps);s.accumulator-=STEP;}
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.crossfire;
 return {survivors:living(ps).length,remaining:round.remaining??null,elapsed:s?.clock||0,
  radiusPct:s?Math.round(s.R/s.world.R0*100):100,
  statuses:ps.filter(p=>p.active).map(p=>({id:p.id,alive:!!p.cf?.alive,hp:p.cf?.hp??0}))};
}

/* ------------------------------ drawing ------------------------------ */
function draw(g,time,round,ps){
 const s=round.crossfire;if(!s)return;
 const w=s.world;
 g.save();
 g.fillStyle='#8a4f24';g.fillRect(0,0,960,540);
 g.scale(960/w.w,540/w.h);
 if(s.shake>0)g.translate(Math.sin(s.clock*91)*6*s.shake,Math.cos(s.clock*77)*6*s.shake);
 if(s.bg)g.drawImage(s.bg,0,0,w.w,w.h);
 else{g.fillStyle='#d88a43';g.fillRect(0,0,w.w,w.h);}
 drawPlaza(g,s.cx,s.cy,s.R,w.R0,s.clock,Math.abs(s.R-s.Rgoal)>.6);
 for(const o of s.obstacles)if(o.alive)drawObstacle(g,o,s.clock);
 const live=living(ps);
 // faint aim guide for human players only (the gun line always runs through the centre)
 g.save();g.setLineDash([4,8]);g.lineWidth=1.4;
 for(const p of live){
  if(p.isBot||s.finished)continue;
  g.strokeStyle='rgba(255,250,220,.22)';g.beginPath();g.moveTo(p.x+p.dir.x*22,p.y+p.dir.y*22);
  g.lineTo(s.cx-p.dir.x*s.R,s.cy-p.dir.y*s.R);g.stroke();
 }
 g.restore();
 for(const p of live.slice().sort((a,b)=>a.y-b.y)){
  const c=p.cf;
  g.save();
  g.fillStyle='rgba(40,18,6,.28)';g.beginPath();g.ellipse(p.x+1,p.y+12,13,6,0,0,TAU);g.fill();
  g.strokeStyle=p.color||'#fff';g.globalAlpha=.85;g.lineWidth=2.4;g.beginPath();g.ellipse(p.x,p.y+12,15,7,0,0,TAU);g.stroke();g.globalAlpha=1;
  if(c.invuln>0&&Math.floor(s.clock*16)%2)g.globalAlpha=.4;
  if(window.PartyCharacters?.draw)window.PartyCharacters.draw(g,p,{time:s.clock,label:false});
  else{g.fillStyle=p.color||'#eee';g.beginPath();g.arc(p.x,p.y,C.radius,0,TAU);g.fill();}
  // Headwear belongs to the shared avatar; the revolver remains game equipment.
  drawRevolver(g,p.x+p.dir.x*8,p.y+p.dir.y*8+2,Math.atan2(p.dir.y,p.dir.x),c.recoil);
  g.restore();
  // HP pips sit just outside the track so they never cover the duel lanes
  const ox=Math.cos(c.theta),oy=Math.sin(c.theta),hx=p.x+ox*(C.radius+16),hy=p.y+oy*(C.radius+16);
  for(let i=0;i<C.hp;i++)drawHeart(g,hx+(i-(C.hp-1)/2)*10,hy,1,i<c.hp);
 }
 for(const e of s.fx)if(e.k==='puff')drawFx(g,e);
 for(const bl of s.bullets)drawBullet(g,bl);
 for(const e of s.fx)if(e.k!=='puff')drawFx(g,e);
 g.restore();
}

/* ------------------------------ results / roster ------------------------------ */
function getResult(round,players){
 const alive=players.filter(p=>p.active&&p.cf?.alive),s=round.crossfire,sole=alive.length===1||s?.solo;
 return players.filter(p=>p.active).map(p=>{
  const c=p.cf||{},isAlive=!!c.alive;
  if(isAlive){
   if(sole)return {id:p.id,value:Infinity,label:s?.solo?'รอดครบเวลา':'ผู้รอดชีวิตคนสุดท้าย'};
   // timeout (or live standing) with several survivors: rank by HP, equal HP = draw
   return {id:p.id,value:1e6+c.hp*1000,label:'HP '+c.hp+' • รอดเมื่อหมดเวลา'};
  }
  return {id:p.id,value:c.eliminatedTick??-1,label:'ตกรอบ • '+(c.eliminatedAt??s?.clock??0).toFixed(1)+' วิ'};
 });
}
function getRoster(round,players){
 return getResult(round,players).map(r=>{
  const p=players.find(q=>q.id===r.id),c=p?.cf||{};
  return {...r,status:c.alive?'♥'.repeat(Math.max(0,c.hp)):'ตกรอบ',eliminated:!c.alive};
 });
}
function renderRoster(root,active,round){
 const ordered=active.slice().sort((a,b)=>Number(!!b.cf?.alive)-Number(!!a.cf?.alive)||(b.cf?.eliminatedTick??0)-(a.cf?.eliminatedTick??0));
 for(const p of ordered){
  const box=document.createElement('div');box.className='leader-chip';
  const dot=document.createElement('span');dot.className='circle';dot.style.background=p.color;
  const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;
  const role=document.createElement('small');role.className='leader-role';
  role.textContent=p.cf?.alive?'♥'.repeat(Math.max(0,p.cf.hp)):'ตกรอบ';
  const empty=document.createElement('span');empty.className='leader-item-slot';
  box.append(dot,name,role,empty);root.append(box);
 }
}
function getControllerPacket(p,round,players){
 const s=round.crossfire,c=p.cf||{};
 return {t:'cowboy-crossfire-status',mode:round.mode,alive:!!c.alive,hp:c.hp??0,
  ready:!!c.alive&&(c.cd||0)<=0,survivors:hud(players,round).survivors};
}
// Release the pre-rendered backdrop and any pending effects once the round is over.
function dispose(round){
 const s=round?.crossfire;if(!s)return;
 if(s.bg){s.bg.width=s.bg.height=0;s.bg=null;}
 s.fx.length=0;s.bullets.length=0;s.obstacles.length=0;
}

const engine=Object.freeze({
 getControllerPacket,renderRoster,getResult,getRoster,resultTitle:'นักดวลคนสุดท้าย!',
 countdownSeconds:3,setup,update,draw,hud,step,finish,eliminate,dispose,teardown:dispose,cleanup:dispose,
 worldFor,config:C
});
export default engine;
