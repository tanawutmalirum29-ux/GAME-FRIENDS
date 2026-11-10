/* DYNAMITE — host-authoritative hot-potato survival in a gold mine, 60 Hz fixed step.
   One lit stick of dynamite exists at a time. Touching another miner hands it over,
   the fuse never resets on a pass, and mine carts shove (and briefly stun) everybody. */
(() => {
'use strict';
const STEP=1/60,TAU=Math.PI*2,EPS=1e-8;
// All balance numbers live here so they can be tuned without touching the logic.
const C=Object.freeze({
 radius:15,maxSpeed:170,response:11,brake:14,knockDecay:3.2,
 fuseSmall:10,fuseLarge:12,         // seconds, 1–6 players / 7–12 players
 passLock:1.3,armGrace:.5,          // return-pass lock, fresh-holder grace
 intermission:1.6,finishDelay:.9,soloSeconds:45,
 stun:1.2,stunGrace:.35,stunClosing:30,
 tram:{length:78,width:40,slide:150,gaugeClear:64},
 restitution:.45,warnLead:1.6
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const hyp=Math.hypot;
const living=ps=>ps.filter(p=>p.active&&p.dyn?.alive);
const art=()=>window.DynamiteArt;
function rng(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x||0x3c6ef372;return(s.seed>>>0)/4294967296;}
// Visual-only randomness never touches the gameplay seed.
function fxr(s){let x=s.fxSeed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.fxSeed=x||0x1b873593;return(s.fxSeed>>>0)/4294967296;}

/* ------------------------------ world & tracks ------------------------------ */
function worldFor(n){
 const large=n>6;
 return large?{w:1280,h:720,large,bounds:{x:200,y:75,w:880,h:600}}
  :{w:960,h:540,large,bounds:{x:150,y:56,w:660,h:450}};
}
// Each path is a vertical-ended cubic S-curve, so carts always leave and enter
// through the tunnel mouths fully off-screen. Direction of travel = point order.
const PATHS_SMALL=[
 [[.44,-.22],[.44,.30],[.24,.55],[.24,1.22]],   // A: down
 [[.80,1.22],[.80,.62],[.60,.32],[.60,-.22]]    // B: up
];
const PATHS_LARGE=[
 [[.30,-.22],[.30,.30],[.12,.58],[.12,1.22]],   // A: down
 [[.58,1.22],[.58,.66],[.44,.38],[.44,-.22]],   // B: up
 [[.74,-.22],[.74,.30],[.90,.62],[.90,1.22]]    // C: down
];
const TRAM_STYLE=[
 {kind:'gold',speed:112,gap:1.3,start:.30},
 {kind:'ore',speed:124,gap:1.7,start:.58},
 {kind:'crate',speed:106,gap:2.1,start:.16}
];
function buildTrams(s){
 const w=s.world,b=w.bounds,defs=w.large?PATHS_LARGE:PATHS_SMALL;
 s.trams=defs.map((ctl,i)=>{
  const pts=ctl.map(([u,v])=>({x:b.x+u*b.w,y:v*w.h}));
  const path=art().buildPath(pts),st=TRAM_STYLE[i];
  const t={id:i,path,kind:st.kind,speed:st.speed,gap:st.gap,length:C.tram.length,width:C.tram.width,
   s:path.length*st.start,waiting:false,wait:0,active:true,seed:i*13+5,
   x:0,y:0,heading:0,vx:0,vy:0,omega:0,dust:0,enterS:0};
  // arc length at which the cart reaches the walkable floor (used for the warning sign)
  const topStart=path.points[0].y<b.y;
  const hit=path.points.find(q=>topStart?q.y>=b.y:q.y<=b.y+b.h);
  t.enterS=Math.max(0,(hit?hit.s:0)-t.length*.5-10);
  t.fromTop=topStart;
  poseSet(t);
  return t;
 });
 s.pathList=s.trams.map(t=>t.path);
}
function poseAtS(t,sv){
 const a=art(),L=t.length*.3,f=a.pointAt(t.path,sv+L),r=a.pointAt(t.path,sv-L);
 return {x:(f.x+r.x)/2,y:(f.y+r.y)/2,heading:Math.atan2(f.y-r.y,f.x-r.x)};
}
function poseSet(t){const q=poseAtS(t,t.s);t.x=q.x;t.y=q.y;t.heading=q.heading;t.vx=t.vy=t.omega=0;}
function advanceTram(s,t,dt){
 if(t.waiting){
  t.wait-=dt;t.active=false;t.vx=t.vy=t.omega=0;
  if(t.wait<=0){t.waiting=false;t.s=0;poseSet(t);t.active=true;}
  return;
 }
 t.s+=t.speed*dt;
 if(t.s>=t.path.length){t.waiting=true;t.wait=t.gap;t.active=false;t.vx=t.vy=t.omega=0;return;}
 const q=poseAtS(t,t.s);
 let dh=q.heading-t.heading;dh=Math.atan2(Math.sin(dh),Math.cos(dh));
 t.vx=(q.x-t.x)/dt;t.vy=(q.y-t.y)/dt;t.omega=clamp(dh/dt,-3,3);
 t.x=q.x;t.y=q.y;t.heading=q.heading;t.active=true;
 // dust and a few rail sparks, purely cosmetic
 t.dust-=dt;
 const b=s.world.bounds;
 if(t.dust<=0&&t.y>b.y-30&&t.y<b.y+b.h+30){
  t.dust=.1;const c=Math.cos(t.heading),sn=Math.sin(t.heading);
  fx(s,{k:'puff',x:t.x-c*t.length*.5+(fxr(s)-.5)*14,y:t.y-sn*t.length*.5+(fxr(s)-.5)*14,
   life:.7,max:.7,r0:3,grow:9,alpha:.28,color:'#d9a672'});
  if(fxr(s)<.35)fx(s,{k:'spark',x:t.x+c*14*(fxr(s)-.5)*2,y:t.y+sn*14*(fxr(s)-.5)*2,life:.25,max:.25,r:2,color:'#ffe9a0'});
 }
}
function timeToEnter(t){
 if(t.waiting)return t.wait+t.enterS/t.speed;
 return t.s<=t.enterS?(t.enterS-t.s)/t.speed:Infinity;
}

/* ------------------------------ geometry helpers ------------------------------ */
function obbHit(t,x,y,r){
 const c=Math.cos(t.heading),sn=Math.sin(t.heading),hl=t.length/2,hw=t.width/2;
 const dx=x-t.x,dy=y-t.y,lx=dx*c+dy*sn,ly=-dx*sn+dy*c;
 const cx=clamp(lx,-hl,hl),cy=clamp(ly,-hw,hw),ex=lx-cx,ey=ly-cy,d=hyp(ex,ey);
 if(d>=r)return null;
 let nxl,nyl,pen;
 if(d>1e-6){nxl=ex/d;nyl=ey/d;pen=r-d;}
 else{
  const px=hl-Math.abs(lx),py=hw-Math.abs(ly);
  if(px<py){nxl=lx>=0?1:-1;nyl=0;pen=px+r;}else{nxl=0;nyl=ly>=0?1:-1;pen=py+r;}
 }
 const nx=nxl*c-nyl*sn,ny=nxl*sn+nyl*c;
 return {pen,nx,ny,lx,ly,c,sn,front:nx*c+ny*sn,
  px:t.x+cx*c-cy*sn,py:t.y+cx*sn+cy*c};
}
function obbClearance(pose,L,W,x,y){
 const c=Math.cos(pose.heading),sn=Math.sin(pose.heading);
 const dx=x-pose.x,dy=y-pose.y,lx=Math.abs(dx*c+dy*sn)-L/2,ly=Math.abs(-dx*sn+dy*c)-W/2;
 return lx>0||ly>0?hyp(Math.max(lx,0),Math.max(ly,0)):Math.max(lx,ly);
}
function roomAlong(b,x,y,dx,dy){
 let t=Infinity;
 if(dx>1e-6)t=Math.min(t,(b.x+b.w-x)/dx);else if(dx<-1e-6)t=Math.min(t,(b.x-x)/dx);
 if(dy>1e-6)t=Math.min(t,(b.y+b.h-y)/dy);else if(dy<-1e-6)t=Math.min(t,(b.y-y)/dy);
 return t;
}
function clampBody(s,p){
 const b=s.world.bounds,d=p.dyn,r=C.radius;
 if(p.x<b.x+r){p.x=b.x+r;if(d.cvx<0)d.cvx=0;if(d.kx<0)d.kx=0;}
 if(p.x>b.x+b.w-r){p.x=b.x+b.w-r;if(d.cvx>0)d.cvx=0;if(d.kx>0)d.kx=0;}
 if(p.y<b.y+r){p.y=b.y+r;if(d.cvy<0)d.cvy=0;if(d.ky<0)d.ky=0;}
 if(p.y>b.y+b.h-r){p.y=b.y+b.h-r;if(d.cvy>0)d.cvy=0;if(d.ky>0)d.ky=0;}
}

/* ------------------------------ fx ------------------------------ */
function fx(s,e){if(s.fx.length>160)s.fx.shift();s.fx.push(e);}
function blast(s,x,y){
 fx(s,{k:'blast',x,y,life:.8,max:.8});
 for(let i=0;i<16;i++){
  const a=fxr(s)*TAU,v=40+fxr(s)*110;
  fx(s,{k:'puff',x:x+Math.cos(a)*6,y:y+Math.sin(a)*6,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1.1+fxr(s)*.8,max:1.9,
   r0:7,grow:20+fxr(s)*12,alpha:.5,color:i%3?'#6a5648':'#4a3a30'});
 }
 for(let i=0;i<22;i++){
  const a=fxr(s)*TAU,v=90+fxr(s)*220;
  fx(s,{k:'spark',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.5+fxr(s)*.4,max:.9,r:3.4,color:i%2?'#ffb43a':'#fff0a8'});
 }
 s.shake=1;
}

/* ------------------------------ setup ------------------------------ */
function fuseFor(count){return count>6?C.fuseLarge:C.fuseSmall;}
function spawnPositions(s,n){
 const b=s.world.bounds,inset=C.radius+30,cands=[];
 for(let y=b.y+inset;y<=b.y+b.h-inset;y+=30)for(let x=b.x+inset;x<=b.x+b.w-inset;x+=30){
  if(s.pathList.every(p=>art().distanceToPath(p,x,y)>=C.tram.gaugeClear))cands.push({x,y});
 }
 const cx=b.x+b.w/2,cy=b.y+b.h/2,chosen=[];
 let first=0;
 cands.forEach((q,i)=>{if(hyp(q.x-cx,q.y-cy)<hyp(cands[first].x-cx,cands[first].y-cy))first=i;});
 // Deterministic farthest-point spread keeps every start apart and off the rails.
 chosen.push(cands[first]);
 while(chosen.length<n&&chosen.length<cands.length){
  let best=-1,score=-1;
  cands.forEach((q,i)=>{
   if(chosen.includes(q))return;
   const m=Math.min(...chosen.map(c=>hyp(c.x-q.x,c.y-q.y)));
   if(m>score){score=m;best=i;}
  });
  chosen.push(cands[best]);
 }
 return chosen;
}
function makeBot(s){
 const skill=.74+rng(s)*.2;
 return {skill,interval:.09+rng(s)*.07,at:rng(s)*.2,ax:0,ay:0,dx:0,dy:0,target:null,
  homeX:0,homeY:0,ignore:Object.create(null),lastX:0,lastY:0,stuckT:0,unstick:0,unstickX:0,escapeUntil:0,escapeFrom:null,
  speedBias:.92+rng(s)*.16};
}
function setup(round,ps){
 if(!ps.length||ps.length>12)throw Error('DYNAMITE supports 1–12 players');
 const n=ps.length,world=worldFor(n);
 const s={world,clock:0,tick:0,accumulator:0,
  seed:(((Number(round.dynamiteSeed)||(Date.now()^0x2d9a15f))>>>0)||1),fxSeed:0x9e3779b1,
  roster:ps,originalCount:n,trams:[],pathList:[],fx:[],contacts:[],shake:0,
  bomb:null,locks:Object.create(null),intermission:0,fuseTotal:fuseFor(n),
  finished:false,pendingFinish:0,winnerIds:[],ranking:[],eliminations:0,round:1,layers:null,solo:n===1};
 round.dynamite=s;
 buildTrams(s);
 s.layers=art().preload(world,s.pathList);
 const slots=spawnPositions(s,n);
 // shuffle slots with the gameplay RNG
 for(let i=slots.length-1;i>0;i--){const j=Math.floor(rng(s)*(i+1));[slots[i],slots[j]]=[slots[j],slots[i]];}
 const holderIndex=s.solo?-1:Math.floor(rng(s)*n);
 if(holderIndex>=0){
  // The first holder receives the most central start slot so nobody begins boxed in.
  const mx=slots.reduce((a,q)=>a+q.x,0)/slots.length,my=slots.reduce((a,q)=>a+q.y,0)/slots.length;
  let c=0;slots.forEach((q,i)=>{if(hyp(q.x-mx,q.y-my)<hyp(slots[c].x-mx,slots[c].y-my))c=i;});
  [slots[holderIndex],slots[c]]=[slots[c],slots[holderIndex]];
 }
 ps.forEach((p,i)=>{
  const q=slots[i%slots.length];
  p.active=true;p.score=0;p.x=q.x;p.y=q.y;p.vx=p.vy=0;
  const toC={x:s.world.bounds.x+s.world.bounds.w/2-q.x,y:s.world.bounds.y+s.world.bounds.h/2-q.y};
  const m=hyp(toC.x,toC.y)||1;p.dir={x:toC.x/m,y:toC.y/m};p.face=p.dir.x<0?-1:1;
  p.dyn={alive:true,cvx:0,cvy:0,kx:0,ky:0,stunUntil:-9,eliminatedTick:null,eliminatedAt:null,
   touch:Object.create(null),ctime:Object.create(null),side:Object.create(null),
   ox:q.x,oy:q.y,receivedFx:0,bot:p.isBot?makeBot(s):null};
  if(p.dyn.bot){p.dyn.bot.homeX=q.x;p.dyn.bot.homeY=q.y;p.dyn.bot.lastX=q.x;p.dyn.bot.lastY=q.y;}
 });
 if(holderIndex>=0)giveBomb(s,ps[holderIndex],true);
 round.remaining=s.solo?C.soloSeconds:s.fuseTotal;
 return s;
}
function giveBomb(s,p,fresh){
 s.bomb={holderId:p.id,remaining:s.fuseTotal,total:s.fuseTotal,armedAt:fresh?s.clock+C.armGrace:s.clock};
}

/* ------------------------------ input ------------------------------ */
function humanInput(p){
 if(window.PartyCharacters?.control)return window.PartyCharacters.control(p.input);
 const k=p.input||{};let x=finite(Number(k.axisX)),y=finite(Number(k.axisY));
 if(hyp(x,y)<.12){x=Number(!!k.right)-Number(!!k.left);y=Number(!!k.down)-Number(!!k.jump);}
 const m=hyp(x,y);return m>1?{x:x/m,y:y/m}:{x,y};
}

/* ------------------------------ bots ------------------------------ */
// Bots obey the player rules: same speed, same hit boxes, no future knowledge
// beyond what a person can read off the rails (carts move at a constant speed).
function samplePoses(s,b,times){
 const out=[];
 for(const t of s.trams){
  if(!t.active||s.clock<(b.ignore[t.id]||0)){out.push(null);continue;}
  const err=(rng(s)-.5)*2*(1-b.skill)*34;
  out.push(times.map(tk=>poseAtS(t,t.s+err+t.speed*b.speedBias*tk)));
 }
 return out;
}
function carriedSpeed(q){return {x:finite(q.dyn.cvx)+finite(q.dyn.kx),y:finite(q.dyn.cvy)+finite(q.dyn.ky)};}
function botDecide(s,p,ps){
 const b=p.dyn.bot,bd=s.world.bounds,R=C.radius,sp=C.maxSpeed;
 const holder=s.bomb?living(ps).find(q=>q.id===s.bomb.holderId):null;
 const iAmHolder=!!holder&&holder===p;
 const remaining=s.bomb?s.bomb.remaining:99;
 const urgent=iAmHolder&&remaining<2.4;
 // a lapse in attention: occasionally ignore one cart for half a second
 for(const t of s.trams)if(t.active&&rng(s)<(1-b.skill)*.05&&s.clock>=(b.ignore[t.id]||0)+.6)b.ignore[t.id]=s.clock+.5;
 const times=[.25,.5,.75,1,1.3],poses=samplePoses(s,b,times);
 const danger=(x,y)=>{
  let cost=0;
  for(let i=0;i<s.trams.length;i++){
   const P=poses[i];if(!P)continue;
   for(let k=0;k<times.length;k++){
    const clr=obbClearance(P[k],s.trams[i].length,s.trams[i].width,x,y)-R;
    const w=Math.max(0,1.5-times[k]);
    if(clr<0)cost+=(34+60*w)*(urgent?.55:1);else if(clr<14)cost+=(14-clr)*w*1.2*(urgent?.55:1);
   }
  }
  return cost;
 };
 const others=living(ps).filter(q=>q!==p);
 let aim=null,targetId=null;
 if(iAmHolder){
  let best=null,bestScore=Infinity,cur=null,curScore=Infinity;
  for(const q of others){
   const lockLeft=Math.max(0,(s.locks[q.id]||0)-s.clock);
   const dist=hyp(q.x-p.x,q.y-p.y),v=carriedSpeed(q);
   const lead=clamp(dist/sp*(urgent?1:.6),0,.8);
   const ax=clamp(q.x+v.x*lead,bd.x+R,bd.x+bd.w-R),ay=clamp(q.y+v.y*lead,bd.y+R,bd.y+bd.h-R);
   let pen=0;
   for(let k=1;k<=6;k++){
    const x=p.x+(ax-p.x)*k/6,y=p.y+(ay-p.y)*k/6;
    for(const path of s.pathList)if(art().distanceToPath(path,x,y)<36){pen+=(urgent?4:13);break;}
   }
   let score=hyp(ax-p.x,ay-p.y)+pen+lockLeft*sp;
   if(s.clock<q.dyn.stunUntil)score-=26;
   const edge=Math.min(q.x-bd.x,bd.x+bd.w-q.x,q.y-bd.y,bd.y+bd.h-q.y);
   if(edge<48)score-=12;
   score+=(rng(s)-.5)*8;
   if(score<bestScore){bestScore=score;best={q,ax,ay};}
   if(q.id===b.target){cur={q,ax,ay};curScore=score;}
  }
  const pick=cur&&!urgent&&curScore<=bestScore+Math.abs(bestScore)*.22+6?cur:best;
  if(pick){aim={x:pick.ax,y:pick.ay};targetId=pick.q.id;}
 }
 b.target=targetId;
 const prevA=Math.atan2(b.dy,b.dx),hasPrev=hyp(b.dx,b.dy)>.1;
 const cands=[];
 for(let k=0;k<16;k++)cands.push({dx:Math.cos(k*TAU/16),dy:Math.sin(k*TAU/16)});
 cands.push({dx:0,dy:0,stop:true});
 let bestC=null,bestCost=Infinity;
 const holderStunned=holder&&s.clock<holder.dyn.stunUntil;
 const spot={x:b.homeX,y:b.homeY};
 for(const c of cands){
  if(c.stop&&iAmHolder)continue;
  const px=clamp(p.x+c.dx*sp*.65,bd.x+R,bd.x+bd.w-R),py=clamp(p.y+c.dy*sp*.65,bd.y+R,bd.y+bd.h-R);
  let cost=0;
  // danger along the candidate path
  for(const f of[.35,.7,1]){
   cost+=danger(clamp(p.x+c.dx*sp*f,bd.x+R,bd.x+bd.w-R),clamp(p.y+c.dy*sp*f,bd.y+R,bd.y+bd.h-R))*(f===1?.7:1);
  }
  if(iAmHolder&&aim){
   cost+=hyp(px-aim.x,py-aim.y);
  }else if(holder){
   const dh=hyp(p.x-holder.x,p.y-holder.y)||1;
   const hx=holder.x+(holderStunned?0:(p.x-holder.x)/dh*sp*.6*.95),hy=holder.y+(holderStunned?0:(p.y-holder.y)/dh*sp*.6*.95);
   const away=hyp(px-hx,py-hy);
   cost-=away*(dh<320?1.15:.35);
   if(dh>230)cost+=hyp(px-spot.x,py-spot.y)*.45;
   for(const q of others){
    if(q===holder)continue;
    const dq=hyp(px-q.x,py-q.y);
    if(dq<85)cost+=(85-dq)*.35;
   }
   const cxm=Math.min(px-bd.x,bd.x+bd.w-px)-R,cym=Math.min(py-bd.y,bd.y+bd.h-py)-R;
   cost+=Math.max(0,70-cxm)*.8+Math.max(0,70-cym)*.8+(cxm<90&&cym<90?30:0);
  }else{
   cost+=hyp(px-spot.x,py-spot.y)*.3;
  }
  if(c.stop)cost+=5;
  else if(hasPrev){
   const da=Math.abs(Math.atan2(Math.sin(Math.atan2(c.dy,c.dx)-prevA),Math.cos(Math.atan2(c.dy,c.dx)-prevA)));
   if(da<.4)cost-=6;
  }
  cost+=(rng(s)-.5)*4;
  if(cost<bestCost){bestCost=cost;bestC=c;}
 }
 // stuck breaker: leaning on a wall or a crowd for too long -> slide toward open floor
 b.stuckT+=b.interval;
 if(b.stuckT>.8){
  if(hyp(p.x-b.lastX,p.y-b.lastY)<7&&bestC&&!bestC.stop&&s.clock>=p.dyn.stunUntil){
   const cx=bd.x+bd.w/2-p.x,cy=bd.y+bd.h/2-p.y,m=hyp(cx,cy)||1,side=rng(s)<.5?-1:1;
   b.unstick=s.clock+.55;b.unstickX=cx/m*.6+(-cy/m)*.8*side;b.unstickY=cy/m*.6+(cx/m)*.8*side;
  }
  b.lastX=p.x;b.lastY=p.y;b.stuckT=0;
 }
 if(s.clock<b.unstick){b.dx=b.unstickX;b.dy=b.unstickY;}
 else if(bestC){b.dx=bestC.dx;b.dy=bestC.dy;}
}
function botInput(s,p,ps,dt){
 const b=p.dyn.bot;
 // After a pass, sprint away from the new holder. This outranks normal
 // target/rail positioning and prevents two-bot pass ping-pong.
 if(b.escapeUntil>s.clock&&s.bomb?.holderId!==p.id){
  const target=ps.find(q=>q.id===s.bomb?.holderId)||ps.find(q=>q.id===b.escapeFrom);
  if(target){
   const bounds=s.world.bounds,R=C.radius+25;
   const dx=p.x-target.x,dy=p.y-target.y,m=hyp(dx,dy)||1;
   let vx=dx/m,vy=dy/m;
   const left=p.x<bounds.x+R,right=p.x>bounds.x+bounds.w-R;
   const top=p.y<bounds.y+R,bottom=p.y>bounds.y+bounds.h-R;
   if((left&&vx<0)||(right&&vx>0)){vx=0;vy=dy>=0?1:-1;}
   if((top&&vy<0)||(bottom&&vy>0)){vy=0;vx=dx>=0?1:-1;}
   b.dx=vx;b.dy=vy;b.at=0;
   b.ax+=(vx-b.ax)*(1-Math.exp(-28*dt));
   b.ay+=(vy-b.ay)*(1-Math.exp(-28*dt));
   return{x:b.ax,y:b.ay};
  }
 }
 b.at-=dt;
 if(b.at<=0){botDecide(s,p,ps);b.at=b.interval*(.85+rng(s)*.3);}
 const a=1-Math.exp(-13*dt);
 b.ax+=(b.dx-b.ax)*a;b.ay+=(b.dy-b.ay)*a;
 return {x:b.ax,y:b.ay};
}

/* ------------------------------ movement ------------------------------ */
function movePlayer(s,p,ps,dt){
 const d=p.dyn,stunned=s.clock<d.stunUntil;
 d.ox=p.x;d.oy=p.y;
 let inp=p.isBot?botInput(s,p,ps,dt):humanInput(p);
 let ix=finite(inp.x),iy=finite(inp.y);
 const m0=hyp(ix,iy);if(m0>1){ix/=m0;iy/=m0;}
 if(stunned){ix=0;iy=0;}
 const mag=hyp(ix,iy);
 const k=stunned?4:mag>.05?C.response:C.brake,a=1-Math.exp(-k*dt);
 d.cvx+=(ix*C.maxSpeed-d.cvx)*a;d.cvy+=(iy*C.maxSpeed-d.cvy)*a;
 const dec=Math.exp(-C.knockDecay*dt);d.kx*=dec;d.ky*=dec;
 if(hyp(d.kx,d.ky)<1){d.kx=0;d.ky=0;}
 p.x+=(d.cvx+d.kx)*dt;p.y+=(d.cvy+d.ky)*dt;
 clampBody(s,p);
 if(!stunned&&mag>.1){p.dir={x:ix/mag,y:iy/mag};p.face=p.dir.x<0?-1:1;}
 p.vx=d.cvx+d.kx;p.vy=d.cvy+d.ky;
 d.receivedFx=Math.max(0,d.receivedFx-dt);
}
// Equal-mass elastic-ish bump: strength follows closing speed along the contact normal.
function pairCollisions(s,live,impulse){
 const R2=C.radius*2;
 s.contacts.length=0;
 for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){
  const a=live[i],b=live[j];
  let dx=b.x-a.x,dy=b.y-a.y,d=hyp(dx,dy);
  if(d>=R2+.6)continue;
  s.contacts.push([a,b,d]);
  if(d>=R2)continue;
  if(d<1e-4){dx=(a.id<b.id?1:-1);dy=0;d=1e-4;}
  const nx=dx/d,ny=dy/d,over=R2-d;
  if(impulse){
   const va={x:a.dyn.cvx+a.dyn.kx,y:a.dyn.cvy+a.dyn.ky},vb={x:b.dyn.cvx+b.dyn.kx,y:b.dyn.cvy+b.dyn.ky};
   const rel=(vb.x-va.x)*nx+(vb.y-va.y)*ny;
   if(rel<0){
    const j2=-(1+C.restitution)*rel/2;
    a.dyn.kx-=j2*nx;a.dyn.ky-=j2*ny;b.dyn.kx+=j2*nx;b.dyn.ky+=j2*ny;
   }
  }
  const sh=Math.min(over/2+.05,6);
  a.x-=nx*sh;a.y-=ny*sh;b.x+=nx*sh;b.y+=ny*sh;
 }
}
function tramInteractions(s,p,dt){
 const d=p.dyn,R=C.radius,b=s.world.bounds;
 for(const t of s.trams){
  if(!t.active){d.touch[t.id]=false;d.ctime[t.id]=0;delete d.side[t.id];continue;}
  const hit=obbHit(t,p.x,p.y,R);
  if(!hit){
   if(!obbHit(t,p.x,p.y,R+2.5)){d.touch[t.id]=false;d.ctime[t.id]=0;delete d.side[t.id];}
   continue;
  }
  const was=!!d.touch[t.id];d.touch[t.id]=true;d.ctime[t.id]=(d.ctime[t.id]||0)+dt;
  const rx=hit.px-t.x,ry=hit.py-t.y,svx=t.vx-t.omega*ry,svy=t.vy+t.omega*rx;
  const pvx=d.cvx+d.kx,pvy=d.cvy+d.ky;
  const closing=(svx-pvx)*hit.nx+(svy-pvy)*hit.ny;
  // one stun per distinct contact: a continuous touch from the same cart never re-triggers
  if(!was&&closing>C.stunClosing&&s.clock>=d.stunUntil+C.stunGrace){
   d.stunUntil=s.clock+C.stun;
   for(let i=0;i<5;i++)fx(s,{k:'spark',x:hit.px,y:hit.py,vx:(fxr(s)-.5)*160,vy:(fxr(s)-.5)*160,life:.35,max:.35,r:3,color:'#fff0b0'});
  }
  // slide direction is chosen once per contact toward the side with more floor
  if(d.side[t.id]===undefined){
   const latx=-hit.sn,laty=hit.c;
   let side=Math.abs(hit.ly)>4?Math.sign(hit.ly):0;
   const rp=roomAlong(b,p.x,p.y,latx,laty),rm=roomAlong(b,p.x,p.y,-latx,-laty);
   if(side===0)side=rp>=rm?1:-1;
   else if((side>0?rp:rm)<t.width/2+R+8&&(side>0?rm:rp)>(side>0?rp:rm))side=-side;
   d.side[t.id]=side;
  }
  const push=Math.min(hit.pen+.25,8);
  p.x+=hit.nx*push;p.y+=hit.ny*push;
  const vn=d.cvx*hit.nx+d.cvy*hit.ny;
  if(vn<0){d.cvx-=vn*hit.nx;d.cvy-=vn*hit.ny;}
  const towards=svx*hit.nx+svy*hit.ny;
  let tkx=0,tky=0,carry=false;
  if(hit.front>.55){
   const ramp=Math.min(1,d.ctime[t.id]/.35),side=d.side[t.id];
   tkx=svx*.95+(-hit.sn)*side*C.tram.slide*ramp;tky=svy*.95+hit.c*side*C.tram.slide*ramp;carry=true;
  }else if(hit.front>-.55||towards>0){
   tkx=svx*.55+hit.nx*Math.max(0,closing)*.6;tky=svy*.55+hit.ny*Math.max(0,closing)*.6;carry=towards>-5;
  }
  if(carry){const f=Math.min(1,18*dt);d.kx+=(tkx-d.kx)*f;d.ky+=(tky-d.ky)*f;}
  clampBody(s,p);
  // pinned between cart and rock: slide out sideways at a capped rate (no teleporting)
  for(let it=0;it<2;it++){
   const again=obbHit(t,p.x,p.y,R);
   if(!again||again.pen<=.8)break;
   const side=d.side[t.id]||1,latx=-again.sn*side,laty=again.c*side;
   const need=(t.width/2+R+.5)-side*again.ly;
   const shift=clamp(need,0,5);
   p.x+=latx*shift;p.y+=laty*shift;
   const before=p.x+','+p.y;
   clampBody(s,p);
   if(p.x+','+p.y!==before&&it===0)d.side[t.id]=-side;
  }
 }
}
function externalResolve(s,live){
 if(live.length>1&&window.PartyCharacters?.resolve){
  const b=s.world.bounds;
  window.PartyCharacters.resolve(live,{radius:C.radius,iterations:2,maxShift:4,bounds:{x:b.x,y:b.y,w:b.w,h:b.h}});
 }
 for(const p of live)clampBody(s,p);
}

/* ------------------------------ bomb ------------------------------ */
function sweptTouch(a,b){
 const x=(b.dyn.ox-a.dyn.ox),y=(b.dyn.oy-a.dyn.oy),dx=(b.x-b.dyn.ox)-(a.x-a.dyn.ox),dy=(b.y-b.dyn.oy)-(a.y-a.dyn.oy);
 const m=clamp(-(x*dx+y*dy)/(dx*dx+dy*dy+1e-12),0,1);
 return hyp(x+dx*m,y+dy*m)<=C.radius*2*.97;
}
function tryPass(s,live){
 const bomb=s.bomb;if(!bomb||s.clock<bomb.armedAt)return;
 const H=live.find(p=>p.id===bomb.holderId);if(!H)return;
 let pick=null,best=Infinity;
 for(const Q of live){
  if(Q===H)continue;
  if((s.locks[Q.id]||0)>s.clock)continue;             // return-pass lock
  const d=hyp(Q.x-H.x,Q.y-H.y);
  const touching=d<=C.radius*2+1.2||sweptTouch(H,Q);
  if(!touching)continue;
  // deepest contact wins; equal depth falls back to roster order -> exactly one receiver
  if(d<best-1e-6){best=d;pick=Q;}
 }
 if(!pick)return;
 s.locks[H.id]=s.clock+C.passLock;
 bomb.holderId=pick.id;
 if(H.dyn.bot){
  H.dyn.bot.escapeUntil=s.clock+2.1;
  H.dyn.bot.escapeFrom=pick.id;
  H.dyn.bot.target=null;
  H.dyn.bot.at=0;
 }
 if(pick.dyn.bot){pick.dyn.bot.escapeUntil=0;pick.dyn.bot.at=0;}
 pick.dyn.receivedFx=.35;
 const mx=(H.x+pick.x)/2,my=(H.y+pick.y)/2;
 fx(s,{k:'pass',x:H.x,y:H.y,x2:pick.x,y2:pick.y,life:.28,max:.28});
 for(let i=0;i<6;i++)fx(s,{k:'spark',x:mx,y:my,vx:(fxr(s)-.5)*200,vy:(fxr(s)-.5)*200,life:.3,max:.3,r:3,color:'#ffd27a'});
}
function eliminate(s,p){
 if(!p?.dyn?.alive)return false;
 p.dyn.alive=false;p.dyn.eliminatedAt=s.clock;p.dyn.eliminatedTick=s.tick;
 s.eliminations++;
 blast(s,p.x,p.y);
 return true;
}
function updateBomb(s,round,ps,live,dt){
 if(s.solo){
  round.remaining=Math.max(0,C.soloSeconds-s.clock);
  if(s.clock>=C.soloSeconds&&!s.pendingFinish)s.pendingFinish=EPS;
  return;
 }
 if(s.pendingFinish)return;
 if(!s.bomb){
  s.intermission-=dt;
  round.remaining=s.fuseTotal;
  if(s.intermission<=0&&live.length>1){
   const pick=live[Math.floor(rng(s)*live.length)];
   s.round++;giveBomb(s,pick,true);
  }
  return;
 }
 tryPass(s,live);
 s.bomb.remaining-=dt;
 round.remaining=Math.max(0,s.bomb.remaining);
 if(s.bomb.remaining<=0){
  const holder=live.find(p=>p.id===s.bomb.holderId);
  s.bomb=null;
  if(holder)eliminate(s,holder);
  const left=living(ps);
  if(left.length<=1)s.pendingFinish=C.finishDelay;
  else s.intermission=C.intermission;
 }
}
function finish(s,round,ps){
 s.finished=true;
 const list=ps.filter(p=>p.active),survivors=living(list);
 s.winnerIds=survivors.map(p=>p.id);
 const value=p=>p.dyn.alive?Infinity:p.dyn.eliminatedTick??-1;
 s.ranking=list.map(p=>({id:p.id,value:value(p),rank:1+list.filter(q=>value(q)>value(p)).length}))
  .sort((a,b)=>a.rank-b.rank||String(a.id).localeCompare(String(b.id)));
 round.remaining=0;s.bomb=null;
}

/* ------------------------------ step / update ------------------------------ */
function step(dt,round,ps){
 const s=round.dynamite;if(!s||s.finished)return;
 if(!s.contacts)s.contacts=[];
 s.tick++;s.clock+=dt;
 for(const t of s.trams)advanceTram(s,t,dt);
 const live=living(ps);
 for(const p of live)movePlayer(s,p,ps,dt);
 pairCollisions(s,live,true);
 for(const p of live)tramInteractions(s,p,dt);
 pairCollisions(s,live,false);
 externalResolve(s,live);
 for(const p of live){p.vx=p.dyn.cvx+p.dyn.kx;p.vy=p.dyn.cvy+p.dyn.ky;}
 updateBomb(s,round,ps,live,dt);
 // effects
 for(const e of s.fx){
  e.life-=dt;
  if(e.vx!==undefined){e.x+=e.vx*dt;e.y+=e.vy*dt;const f=Math.exp(-2.4*dt);e.vx*=f;e.vy*=f;}
 }
 s.fx=s.fx.filter(e=>e.life>0);
 s.shake=Math.max(0,s.shake-dt*2.2);
 if(s.pendingFinish){
  s.pendingFinish-=dt;
  if(s.pendingFinish<=0)finish(s,round,ps);
 }
}
function update(dt,round,ps){
 const s=round.dynamite;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.25,s.accumulator+clamp(finite(dt),0,.25));
 let cycles=0;
 while(s.accumulator+EPS>=STEP&&cycles++<15&&!s.finished){step(STEP,round,ps);s.accumulator-=STEP;}
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.dynamite;
 return {survivors:living(ps).length,remaining:round.remaining??null,elapsed:s?.clock||0,
  holderId:s?.bomb?.holderId??null,bombRemaining:s?.bomb?.remaining??null,
  winnerIds:s?.winnerIds||[],statuses:ps.filter(p=>p.active).map(p=>({id:p.id,alive:!!p.dyn?.alive,holder:s?.bomb?.holderId===p.id}))};
}

/* ------------------------------ drawing ------------------------------ */
function drawWarnings(g,s){
 const b=s.world.bounds,a=art();
 for(const t of s.trams){
  const tt=timeToEnter(t);
  if(!(tt<C.warnLead))continue;
  const q=a.pointAt(t.path,t.enterS+t.length*.5+10);
  const y=t.fromTop?b.y+24:b.y+b.h-24,pulse=.55+.45*Math.sin(s.clock*16);
  g.save();g.translate(q.x,y);if(!t.fromTop)g.rotate(Math.PI);
  g.globalAlpha=.55+.45*pulse;g.fillStyle='#ffd23a';g.strokeStyle='#5a1d08';g.lineWidth=2.5;
  g.beginPath();g.moveTo(0,12);g.lineTo(-13,-10);g.lineTo(13,-10);g.closePath();g.fill();g.stroke();
  g.fillStyle='#5a1d08';g.font='900 14px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';
  if(!t.fromTop)g.rotate(Math.PI);
  g.fillText('!',0,t.fromTop?-3:3);
  g.restore();
 }
}
function draw(g,time,round,ps){
 const s=round.dynamite;if(!s)return;
 const a=art(),w=s.world;
 g.save();
 g.fillStyle='#4a2517';g.fillRect(0,0,960,540);
 g.scale(960/w.w,540/w.h);
 if(s.shake>0)g.translate((Math.sin(s.clock*91)*7)*s.shake,(Math.cos(s.clock*77)*7)*s.shake);
 a.drawBackdrop(g,w,s.pathList,s.layers);
 drawWarnings(g,s);
 for(const e of s.fx)if(e.k==='puff')a.drawPuff(g,e);
 for(const t of s.trams)if(t.active)a.drawCart(g,t,s.clock);
 const bomb=s.bomb,holderId=bomb?.holderId;
 const alive=living(ps);
 for(const p of alive){
  if(window.PartyCharacters?.draw)window.PartyCharacters.draw(g,p,{time:s.clock,label:false});
  else{g.fillStyle=p.color||'#eee';g.beginPath();g.arc(p.x,p.y,C.radius,0,TAU);g.fill();}
  if(s.clock<p.dyn.stunUntil)a.drawStun(g,p,s.clock);
  if(bomb&&p.id===holderId){
   const ratio=clamp(bomb.remaining/bomb.total,0,1);
   a.drawDynamite(g,p,{ratio,pass:p.dyn.receivedFx/.35},s.clock);
  }
 }
 for(const e of s.fx){
  if(e.k==='pass'){
   g.save();g.globalAlpha=Math.max(0,e.life/e.max);g.strokeStyle='#ffd27a';g.lineWidth=3;
   g.beginPath();g.moveTo(e.x,e.y);g.lineTo(e.x2,e.y2);g.stroke();g.restore();
  }else if(e.k==='spark')a.drawSpark(g,e);
 }
 a.drawForeground(g,w,s.layers);
 for(const e of s.fx)if(e.k==='blast')a.drawBlast(g,e);
 if(bomb){
  const p=alive.find(q=>q.id===holderId);
  if(p)a.drawHolderMarker(g,p,{remaining:bomb.remaining},s.clock);
 }
 g.restore();
 // low-fuse warning vignette (screen space)
 if(bomb&&bomb.remaining<=3){
  const pulse=.5+.5*Math.sin(s.clock*14),al=(.10+.14*pulse)*clamp(1-bomb.remaining/3+.25,0,1);
  g.save();const v=g.createRadialGradient(480,270,230,480,270,560);
  v.addColorStop(0,'rgba(255,40,20,0)');v.addColorStop(1,'rgba(255,40,20,'+al+')');
  g.fillStyle=v;g.fillRect(0,0,960,540);g.restore();
 }
}

/* ------------------------------ results / roster ------------------------------ */
function getResult(round,players){
 return players.filter(p=>p.active).map(p=>{
  const alive=!!p.dyn?.alive,value=alive?Infinity:(p.dyn?.eliminatedTick??-1);
  const label=alive?'ผู้รอดชีวิต':'ตกรอบ • '+(p.dyn?.eliminatedAt??round.dynamite.clock).toFixed(1)+' วิ';
  return {id:p.id,value,label};
 });
}
function renderRoster(root,active,round){
 const holderId=round.dynamite?.bomb?.holderId;
 const ordered=active.slice().sort((a,b)=>Number(!!b.dyn?.alive)-Number(!!a.dyn?.alive)||
  (b.dyn?.eliminatedTick??0)-(a.dyn?.eliminatedTick??0));
 for(const p of ordered){
  const box=document.createElement('div');box.className='leader-chip';
  if(!p.dyn?.alive)box.classList.add('shockwave-eliminated');
  const dot=document.createElement('span');dot.className='circle';dot.style.background=p.color;
  const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;
  const role=document.createElement('small');role.className='leader-role';
  role.textContent=!p.dyn?.alive?'ตกรอบ':p.id===holderId?'ถือระเบิด':'รอด';
  const empty=document.createElement('span');empty.className='leader-item-slot';
  box.append(dot,name,role,empty);root.append(box);
 }
}
function getControllerPacket(p,round,players){
 const s=round.dynamite,st=p.dyn||{};
 return {t:'dynamite-status',mode:round.mode,alive:!!st.alive,holder:s?.bomb?.holderId===p.id,
  stunned:!!s&&s.clock<(st.stunUntil??-9),remaining:s?.bomb?.remaining??null,
  survivors:hud(players,round).survivors};
}

window.Dynamite=Object.freeze({getControllerPacket,renderRoster,getResult,resultTitle:"ผู้รอดชีวิตคนสุดท้าย!",
 countdownSeconds:3,setup,update,draw,hud,step,finish,eliminate,spawnPositions,worldFor,config:C});
})();
