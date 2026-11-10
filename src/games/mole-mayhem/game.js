/* MOLE MAYHEM — competitive whack-a-mole in a round vegetable-garden arena.
   Native ES module for GAME-FRIENDS. Physics runs in WORLD units (960x540 for 1-6 players,
   1280x720 for 7-12), fixed 60 Hz step. Central APIs used: PartyCharacters (input, move, resolve, draw). */
'use strict';
const STEP=1/60,TAU=Math.PI*2,EPS=1e-8;
const C=Object.freeze({
 radius:15,speed:165,
 attack:{windup:.2,active:.1,recovery:.2},windupMove:.3,   // movement multiplier while winding up (0 afterwards)
 reach:24,hitR:22,moleR:14,                                // hammer zone centre distance / radius / mole radius (world units * unit)
 stun:1.2,knock:150,knockDecay:5,
 normalScore:5,hatScore:10,hatChance:.3,
 swapMin:6,swapMax:10,swapAnim:.85,
 rise:.28,sink:.3,bonk:.55,
 tiers:[
  {max:6,w:960,h:540,unit:1,R:235,spacing:105,moles:[1,3],seconds:45},
  {max:12,w:1280,h:720,unit:1.12,R:315,spacing:120,moles:[2,5],seconds:60}
 ]
});
const VEG=['cabbage','pumpkin','carrot','watermelon'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const hyp=Math.hypot;
const ease=t=>1-Math.pow(1-clamp(t,0,1),3);
const PC=()=>window.PartyCharacters;
function rng(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x||0x3c6ef372;return(s.seed>>>0)/4294967296;}
function fxr(s){let x=s.fxSeed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.fxSeed=x||0x1b873593;return(s.fxSeed>>>0)/4294967296;}
function shuffle(s,a){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* ------------------------------ world ------------------------------ */
function worldFor(n){
 const t=n<=6?C.tiers[0]:C.tiers[1];
 return {...t,large:n>6,cx:t.w/2,cy:t.h/2,bounds:{x:t.w/2-t.R,y:t.h/2-t.R,w:t.R*2,h:t.R*2}};
}
function buildSlots(s){
 const w=s.world,inner=w.R*.82,sp=w.spacing,rowH=sp*.866,slots=[];
 const rows=Math.ceil(inner/rowH),cols=Math.ceil(inner/sp)+1;
 for(let r=-rows;r<=rows;r++)for(let c=-cols;c<=cols;c++){
  const x=c*sp+((r&1)?sp/2:0),y=r*rowH;
  if(hyp(x,y)>inner)continue;
  slots.push({i:slots.length,x:w.cx+x+(rng(s)-.5)*8,y:w.cy+y+(rng(s)-.5)*8,veg:null,mole:null,block:0,lastUsed:-99});
 }
 return slots;
}
function placeVeg(s){
 const u=s.world.unit,free=shuffle(s,s.slots.slice());
 // Approximately 60% of holes stay filled with vegetables, leaving spawnable holes.
 const n=Math.min(Math.round(free.length*.6),free.length-s.world.moles[1]);
 s.vegs=[];
 for(let i=0;i<n;i++){
  const sl=free[i];
  const v={type:VEG[(i+Math.floor(rng(s)*VEG.length))%VEG.length],slot:sl,x:sl.x,y:sl.y,fx:sl.x,fy:sl.y,tx:sl.x,ty:sl.y,t:1,spin:rng(s)*TAU};
  sl.veg=v;s.vegs.push(v);
 }
}
function doSwap(s){
 const free=shuffle(s,s.slots.filter(sl=>!sl.mole));
 const taken=new Set();
 for(const v of s.vegs)v.slot.veg=null;
 for(const v of shuffle(s,s.vegs.slice())){
  let pick=free.find(sl=>!taken.has(sl)&&sl!==v.slot&&s.clock>=0)||free.find(sl=>!taken.has(sl));
  if(!pick)pick=v.slot;
  taken.add(pick);
  v.fx=v.x;v.fy=v.y;v.tx=pick.x;v.ty=pick.y;v.t=0;
  v.slot.block=s.clock+C.swapAnim;pick.block=s.clock+C.swapAnim;
  v.slot=pick;pick.veg=v;
 }
}
function updateVeg(s,dt){
 for(const v of s.vegs){
  if(v.t<1){
   v.t=Math.min(1,v.t+dt/C.swapAnim);
   const e=v.t<.5?2*v.t*v.t:1-Math.pow(-2*v.t+2,2)/2;
   v.x=v.fx+(v.tx-v.fx)*e;v.y=v.fy+(v.ty-v.fy)*e;
   if(v.t>=1){v.x=v.tx;v.y=v.ty;fx(s,{k:'puff',x:v.x,y:v.y,life:.5,max:.5,r0:6,grow:26,alpha:.35,color:'#d9a672'});}
  }
 }
 s.swapT-=dt;
 if(s.swapT<=0){doSwap(s);s.swapT=C.swapMin+rng(s)*(C.swapMax-C.swapMin);}
}

/* ------------------------------ moles ------------------------------ */
const vuln=m=>m.state==='up'||(m.state==='rise'&&m.t>.55);
const upLeft=m=>m.state==='up'?m.up:m.state==='rise'?m.up+(1-m.t)*C.rise:0;
function moleHeight(m){
 if(m.state==='rise')return ease(m.t);
 if(m.state==='up')return 1;
 if(m.state==='sink')return 1-ease(m.t);
 if(m.state==='bonk')return m.t<.4?1:1-ease((m.t-.4)/.6);
 return 0;
}
function pickSlot(s){
 let best=null,bs=-Infinity;
 for(const sl of s.slots){
  if(sl.veg||sl.mole||sl.block>s.clock)continue;
  let near=Infinity;for(const r of s.recent)near=Math.min(near,hyp(r.x-sl.x,r.y-sl.y));
  const sc=Math.min(s.clock-sl.lastUsed,14)*1.2+Math.min(near,260)/40+rng(s)*5;
  if(sc>bs){bs=sc;best=sl;}
 }
 return best;
}
function spawnMole(s){
 const sl=pickSlot(s);if(!sl)return false;
 const hat=rng(s)<C.hatChance;
 const m={id:++s.moleId,slot:sl,x:sl.x,y:sl.y,type:hat?'hat':'normal',state:'rise',t:0,
  up:(hat?2.3:1.6)+rng(s)*(hat?.7:.8),hits:0,hatOff:false,lastHit:null,seenAt:s.clock+.1,flash:0,wob:rng(s)*TAU};
 sl.mole=m;sl.lastUsed=s.clock;s.moles.push(m);
 s.recent.push(sl);if(s.recent.length>4)s.recent.shift();
 return true;
}
function updateMoles(s,dt){
 for(const m of s.moles){
  m.flash=Math.max(0,m.flash-dt);
  if(m.state==='rise'){m.t+=dt/C.rise;if(m.t>=1){m.state='up';m.t=0;}}
  else if(m.state==='up'){m.up-=dt;if(m.up<=0){m.state='sink';m.t=0;}}
  else if(m.state==='sink'){m.t+=dt/C.sink;if(m.t>=1)m.state='gone';}
  else if(m.state==='bonk'){m.t+=dt/C.bonk;if(m.t>=1)m.state='gone';}
 }
 for(const m of s.moles)if(m.state==='gone'&&m.slot.mole===m)m.slot.mole=null;
 s.moles=s.moles.filter(m=>m.state!=='gone');
 const [lo,hi]=s.world.moles;
 s.wantT-=dt;if(s.wantT<=0){s.want=lo+Math.floor(rng(s)*(hi-lo+1));s.wantT=2.2+rng(s)*2.2;}
 s.spawnCd-=dt;
 const showing=s.moles.filter(m=>m.state==='rise'||m.state==='up').length;
 if(showing<lo)s.spawnCd=Math.min(s.spawnCd,.12);
 if(showing<s.want&&s.spawnCd<=0){if(spawnMole(s))s.spawnCd=.25+rng(s)*.45;else s.spawnCd=.2;}
}
function award(s,p,m,pts){
 p.score=(p.score||0)+pts;
 fx(s,{k:'pop',x:m.x,y:m.y-18*s.world.unit,text:'+'+pts,life:1,max:1,big:pts>=10,color:pts>=10?'#fff06a':'#ffffff'});
 for(let i=0;i<9;i++){const a=fxr(s)*TAU,v=60+fxr(s)*130;
  fx(s,{k:'spark',x:m.x,y:m.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.5,max:.5,r:2.6,color:['#ffd23a','#ff5d5d','#5ec8ff','#7dff6a'][i%4]});}
}
function hitMole(s,p,m){
 m.lastHit=p.id;
 if(m.type==='hat'&&m.hits===0){
  m.hits=1;m.hatOff=true;m.flash=.4;
  if(m.state==='up')m.up=Math.max(m.up,.9);else if(m.state==='rise')m.up=Math.max(m.up,.9);
  const a=fxr(s)*TAU;
  fx(s,{k:'helmet',x:m.x,y:m.y,vx:Math.cos(a)*120,vy:Math.sin(a)*120,rot:0,life:.9,max:.9});
  for(let i=0;i<6;i++)fx(s,{k:'spark',x:m.x,y:m.y,vx:(fxr(s)-.5)*200,vy:(fxr(s)-.5)*200,life:.3,max:.3,r:2.5,color:'#fff0a8'});
  return;
 }
 m.hits=2;m.state='bonk';m.t=0;
 award(s,p,m,m.type==='hat'?C.hatScore:C.normalScore);
}

/* ------------------------------ fx ------------------------------ */
function fx(s,e){if(s.fx.length>200)s.fx.shift();s.fx.push(e);}
function updateFx(s,dt){
 for(const e of s.fx){
  e.life-=dt;
  if(e.vx!==undefined){e.x+=e.vx*dt;e.y+=e.vy*dt;const f=Math.exp(-3*dt);e.vx*=f;e.vy*=f;}
  if(e.k==='helmet')e.rot+=dt*14;
 }
 s.fx=s.fx.filter(e=>e.life>0);
}

/* ------------------------------ setup ------------------------------ */
function makeBot(s){
 return {skill:.74+rng(s)*.2,react:.26+rng(s)*.2,interval:.08+rng(s)*.06,at:rng(s)*.2,
  mx:0,my:0,ax:0,ay:0,atk:false,target:null,skip:Object.create(null),nextAtk:0,nextAggr:2+rng(s)*3,
  chase:null,chaseUntil:0,patrol:null,patrolUntil:0,dodgeUntil:0,
  lastX:0,lastY:0,stuckT:0,unstick:0,ux:0,uy:0};
}
function setup(round,ps){
 if(!ps.length||ps.length>12)throw Error('MOLE MAYHEM supports 1–12 players');
 const n=ps.length,world=worldFor(n);
 const s={world,clock:0,tick:0,accumulator:0,seed:(((Number(round.moleSeed)||(Date.now()^0x51ed27))>>>0)||1),fxSeed:0x9e3779b1,
  roster:ps,fx:[],moles:[],moleId:0,recent:[],slots:[],vegs:[],want:world.moles[0],wantT:0,spawnCd:.4,
  swapT:C.swapMin+.3,duration:world.seconds,finished:false,ranking:[],shake:0,bg:null};
 round.molemayhem=s;
 s.slots=buildSlots(s);placeVeg(s);
 s.bg=loadBackground();
 const ring=n===1?0:world.R*.55,off=rng(s)*TAU;
 ps.forEach((p,i)=>{
  const a=off+i/n*TAU;
  p.active=true;p.score=0;p.x=world.cx+Math.cos(a)*ring;p.y=world.cy+Math.sin(a)*ring;p.vx=p.vy=0;
  p.dir={x:-Math.cos(a)||0,y:-Math.sin(a)||1};if(n===1)p.dir={x:0,y:1};p.face=p.dir.x<0?-1:1;
  p.mole={att:null,stunUntil:-9,kx:0,ky:0,wantAtk:false,aWas:false,bot:p.isBot?makeBot(s):null};
  if(p.mole.bot){p.mole.bot.lastX=p.x;p.mole.bot.lastY=p.y;}
 });
 round.remaining=s.duration;
 return s;
}

/* ------------------------------ input & bots ------------------------------ */
function humanInput(p){
 if(PC()?.control){const c=PC().control(p.input);return {x:finite(c.x),y:finite(c.y),action:!!c.action};}
 const k=p.input||{};let x=finite(Number(k.axisX)),y=finite(Number(k.axisY));
 if(hyp(x,y)<.12){x=Number(!!k.right)-Number(!!k.left);y=Number(!!k.down)-Number(!!k.jump);}
 const m=hyp(x,y);if(m>1){x/=m;y/=m;}
 return {x,y,action:!!(k.a||k.A||k.action||k.attack)};
}
const stunned=(s,p)=>s.clock<p.mole.stunUntil;
function botDecide(s,p,live){
 const b=p.mole.bot,u=s.world.unit,sp=C.speed*u,W=s.world,reach=40*u;
 const clock=s.clock;b.atk=false;
 let mx=0,my=0;
 // 1) dodge an incoming hammer that is winding up / swinging toward me
 if(clock>=b.dodgeUntil)for(const q of live){
  if(q===p||!q.mole.att||q.mole.att.phase==='recovery')continue;
  const dx=p.x-q.x,dy=p.y-q.y,d=hyp(dx,dy);if(d>70*u||d<1)continue;
  const a=q.mole.att;if((dx*a.dx+dy*a.dy)/d<.55||rng(s)>b.skill)continue;
  const cr=a.dx*dy-a.dy*dx,sg=cr>=0?1:-1;
  b.dodgeUntil=clock+.3;b.mx=-a.dy*sg;b.my=a.dx*sg;break;
 }
 if(clock<b.dodgeUntil)return;
 const idle=!p.mole.att;
 // 2) choose a mole the way a person would: visible for a reaction time, reachable before it hides
 let best=null,bs=-Infinity;
 for(const m of s.moles){
  if(!vuln(m)||clock-m.seenAt<b.react||(b.skip[m.id]||0)>clock)continue;
  const d=hyp(m.x-p.x,m.y-p.y),need=Math.max(0,d-reach*.85)/sp+C.attack.windup+.06,left=upLeft(m);
  if(left<need+(1-b.skill)*.15){b.skip[m.id]=clock+.6;continue;}
  let val=m.type==='hat'?(m.hits?C.hatScore:3.5):C.normalScore,sc=val/(need+.35);
  for(const q of live){if(q===p||stunned(s,q))continue;if(hyp(m.x-q.x,m.y-q.y)<d-18*u){sc*=.6;break;}}
  if(b.target===m.id)sc*=1.25;
  if(sc>bs){bs=sc;best=m;}
 }
 // 3) hinder a rival who is winding up right next to me
 let rival=null;
 for(const q of live){
  if(q===p||stunned(s,q))continue;const a=q.mole.att;
  if(a&&a.phase==='windup'&&hyp(q.x-p.x,q.y-p.y)<reach*.95&&rng(s)<b.skill*.5){rival=q;break;}
 }
 const toward=(tx,ty)=>{const dx=tx-p.x,dy=ty-p.y,d=hyp(dx,dy)||1;return {dx,dy,d,ux:dx/d,uy:dy/d};};
 if(rival&&(!best||hyp(best.x-p.x,best.y-p.y)>reach)){
  const v=toward(rival.x,rival.y);
  if(idle&&clock>=b.nextAtk){p.dir={x:v.ux,y:v.uy};b.atk=true;b.nextAtk=clock+.4;}
  b.target=null;mx=0;my=0;
 }else if(best){
  b.target=best.id;
  const v=toward(best.x,best.y);
  if(v.d>reach*.9){mx=v.ux;my=v.uy;}
  if(v.d<=reach&&idle&&clock>=b.nextAtk&&upLeft(best)>C.attack.windup+.03){
   const err=(rng(s)-.5)*(1-b.skill)*.5,ca=Math.cos(err),sa=Math.sin(err);
   p.dir={x:v.ux*ca-v.uy*sa,y:v.ux*sa+v.uy*ca};p.face=p.dir.x<0?-1:1;
   b.atk=true;b.nextAtk=clock+.15;
  }
 }else{
  b.target=null;
  // 4) occasionally harass the nearest rival
  if(b.chase&&(clock>b.chaseUntil||stunned(s,b.chase)))b.chase=null;
  if(!b.chase&&clock>=b.nextAggr){
   let near=null,nd=150*u;
   for(const q of live){if(q===p||stunned(s,q))continue;const d=hyp(q.x-p.x,q.y-p.y);if(d<nd){nd=d;near=q;}}
   b.nextAggr=clock+2.5+rng(s)*2.5;
   if(near&&rng(s)<.3+b.skill*.2){b.chase=near;b.chaseUntil=clock+1.3;}
  }
  if(b.chase){
   const v=toward(b.chase.x,b.chase.y);
   if(v.d>reach*.9){mx=v.ux;my=v.uy;}
   if(v.d<=reach&&idle&&clock>=b.nextAtk){p.dir={x:v.ux,y:v.uy};b.atk=true;b.nextAtk=clock+.5;b.chase=null;}
  }else{
   // 5) patrol to a fresh spot (never camp the same hole)
   if(!b.patrol||clock>b.patrolUntil||hyp(b.patrol.x-p.x,b.patrol.y-p.y)<22*u){
    let bestPt=null,bsc=-Infinity;
    for(let k=0;k<7;k++){
     const a=rng(s)*TAU,r=Math.sqrt(rng(s))*W.R*.72,x=W.cx+Math.cos(a)*r,y=W.cy+Math.sin(a)*r;
     let near=Infinity;for(const q of live)if(q!==p)near=Math.min(near,hyp(q.x-x,q.y-y));
     const sc=Math.min(near,200*u)+(b.patrol?Math.min(hyp(b.patrol.x-x,b.patrol.y-y),200):0)*.6+rng(s)*30;
     if(sc>bsc){bsc=sc;bestPt={x,y};}
    }
    b.patrol=bestPt;b.patrolUntil=clock+1.6+rng(s)*1.6;
   }
   const v=toward(b.patrol.x,b.patrol.y);mx=v.ux;my=v.uy;
  }
 }
 // separation from other players so bots do not pile up
 for(const q of live){
  if(q===p)continue;const dx=p.x-q.x,dy=p.y-q.y,d=hyp(dx,dy);
  if(d>1&&d<34*u&&!(best&&hyp(best.x-q.x,best.y-q.y)<reach)){mx+=dx/d*.6;my+=dy/d*.6;}
 }
 // wall hugging: steer back to the arena
 const dc=hyp(p.x-W.cx,p.y-W.cy);
 if(dc>W.R-40*u){mx+=(W.cx-p.x)/dc*.8;my+=(W.cy-p.y)/dc*.8;}
 const m=hyp(mx,my);if(m>1){mx/=m;my/=m;}
 b.mx=mx;b.my=my;
 // stuck breaker
 b.stuckT+=b.interval;
 if(b.stuckT>.9){
  if((mx||my)&&hyp(p.x-b.lastX,p.y-b.lastY)<8*u&&idle&&!stunned(s,p)){
   const a=rng(s)*TAU;b.unstick=clock+.5;b.ux=Math.cos(a);b.uy=Math.sin(a);b.target=null;b.patrol=null;
  }
  b.lastX=p.x;b.lastY=p.y;b.stuckT=0;
 }
 if(clock<b.unstick){b.mx=b.ux;b.my=b.uy;}
}
function botInput(s,p,live,dt){
 const b=p.mole.bot;b.at-=dt;
 if(b.at<=0){botDecide(s,p,live);b.at=b.interval*(.85+rng(s)*.3);}
 const a=1-Math.exp(-13*dt);b.ax+=(b.mx-b.ax)*a;b.ay+=(b.my-b.ay)*a;
 const act=b.atk;b.atk=false;
 return {x:b.ax,y:b.ay,action:act};
}

/* ------------------------------ movement & combat ------------------------------ */
function clampArena(s,p){
 const w=s.world,r=C.radius*w.unit+3,lim=w.R-r,dx=p.x-w.cx,dy=p.y-w.cy,d=hyp(dx,dy);
 if(d>lim){p.x=w.cx+dx/d*lim;p.y=w.cy+dy/d*lim;}
}
function movePlayer(s,p,live,dt){
 const m=p.mole,u=s.world.unit,st=stunned(s,p);
 const inp=p.isBot?botInput(s,p,live,dt):humanInput(p);
 let ix=finite(inp.x),iy=finite(inp.y);const m0=hyp(ix,iy);if(m0>1){ix/=m0;iy/=m0;}
 m.wantAtk=!!inp.action;
 let mul=1;
 if(st)mul=0;else if(m.att)mul=m.att.phase==='windup'?C.windupMove:0;
 const mag=hyp(ix,iy);
 if(!st&&!m.att&&mag>.1){p.dir={x:ix/mag,y:iy/mag};p.face=p.dir.x<0?-1:1;}
 const ox=p.x,oy=p.y,dir=p.dir;
 if(PC()?.move){
  PC().move(p,{x:ix*mul,y:iy*mul},dt,{speed:C.speed*u,radius:C.radius*u,bounds:s.world.bounds});
  p.dir=dir;
 }else{p.x+=ix*mul*C.speed*u*dt;p.y+=iy*mul*C.speed*u*dt;}
 m.kx*=Math.exp(-C.knockDecay*dt);m.ky*=Math.exp(-C.knockDecay*dt);
 if(hyp(m.kx,m.ky)<1){m.kx=0;m.ky=0;}
 p.x+=m.kx*dt;p.y+=m.ky*dt;
 clampArena(s,p);
 p.vx=(p.x-ox)/dt;p.vy=(p.y-oy)/dt;
}
function resolvePlayers(s,live){
 const u=s.world.unit,r=C.radius*u;
 if(PC()?.resolve){PC().resolve(live,{radius:r,iterations:2,maxShift:4,bounds:s.world.bounds});}
 else for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){
  const a=live[i],b=live[j];let dx=b.x-a.x,dy=b.y-a.y,d=hyp(dx,dy);
  if(d>=r*2)continue;if(d<1e-4){dx=1;dy=0;d=1;}
  const o=(r*2-d)/2;a.x-=dx/d*o;a.y-=dy/d*o;b.x+=dx/d*o;b.y+=dy/d*o;
 }
 for(const p of live)clampArena(s,p);
}
function hitPlayer(s,a,q){
 const u=s.world.unit,att=a.mole.att;
 if(stunned(s,q))return;                       // no stacked stun
 q.mole.stunUntil=s.clock+C.stun;q.mole.att=null;
 q.mole.kx=att.dx*C.knock*u;q.mole.ky=att.dy*C.knock*u;
 s.shake=Math.max(s.shake,.35);
 for(let i=0;i<8;i++){const an=fxr(s)*TAU;
  fx(s,{k:'spark',x:q.x,y:q.y,vx:Math.cos(an)*140,vy:Math.sin(an)*140,life:.4,max:.4,r:2.8,color:'#fff0a8'});}
}
function processHits(s,p,live){
 const att=p.mole.att,u=s.world.unit;
 const cx=p.x+att.dx*C.reach*u,cy=p.y+att.dy*C.reach*u,hr=C.hitR*u;
 if(!att.fxDone){att.fxDone=true;fx(s,{k:'impact',x:cx,y:cy,life:.25,max:.25});}
 for(const m of s.moles){
  if(!vuln(m)||att.hitM.has(m.id))continue;
  if(hyp(m.x-cx,m.y-cy)<=hr+C.moleR*u){att.hitM.add(m.id);hitMole(s,p,m);}
 }
 for(const q of live){
  if(q===p||att.hitP.has(q.id))continue;
  if(hyp(q.x-cx,q.y-cy)<=hr+C.radius*u){att.hitP.add(q.id);hitPlayer(s,p,q);}
 }
}
function updateAttack(s,p,live,dt){
 const m=p.mole;
 if(stunned(s,p)){m.att=null;m.aWas=m.wantAtk;return;}
 if(!m.att&&m.wantAtk){
  m.att={phase:'windup',t:0,dx:p.dir.x,dy:p.dir.y,hitM:new Set(),hitP:new Set(),fxDone:false};
 }
 m.aWas=m.wantAtk;
 const a=m.att;if(!a)return;
 a.t+=dt;
 if(a.phase==='windup'&&a.t>=C.attack.windup-EPS){a.phase='active';a.t=0;}
 if(a.phase==='active'){
  processHits(s,p,live);
  if(a.t>=C.attack.active-EPS){a.phase='recovery';a.t=0;}
 }else if(a.phase==='recovery'&&a.t>=C.attack.recovery-EPS)m.att=null;
}

/* ------------------------------ step / update ------------------------------ */
function finish(s,round,ps){
 s.finished=true;round.remaining=0;
 for(const m of s.moles)m.slot.mole=null;
 s.moles=[];
 const list=ps.filter(p=>p.active);
 s.ranking=list.map(p=>({id:p.id,value:p.score||0,rank:1+list.filter(q=>(q.score||0)>(p.score||0)).length}))
  .sort((a,b)=>a.rank-b.rank||String(a.id).localeCompare(String(b.id)));
}
function step(dt,round,ps){
 const s=round.molemayhem;if(!s||s.finished)return;
 s.tick++;s.clock+=dt;
 const live=ps.filter(p=>p.active);
 updateVeg(s,dt);updateMoles(s,dt);
 for(const p of live)movePlayer(s,p,live,dt);
 resolvePlayers(s,live);
 for(const p of live)updateAttack(s,p,live,dt);
 updateFx(s,dt);
 s.shake=Math.max(0,s.shake-dt*2.5);
 round.remaining=Math.max(0,s.duration-s.clock);
 if(s.clock>=s.duration-EPS)finish(s,round,ps);
}
function update(dt,round,ps){
 const s=round.molemayhem;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.25,s.accumulator+clamp(finite(dt),0,.25));
 let cycles=0;
 while(s.accumulator+EPS>=STEP&&cycles++<15&&!s.finished){step(STEP,round,ps);s.accumulator-=STEP;}
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.molemayhem,act=ps.filter(p=>p.active);
 let lead=null;for(const p of act)if(!lead||(p.score||0)>(lead.score||0))lead=p;
 return {remaining:round.remaining??null,elapsed:s?.clock||0,leaderId:lead?.id??null,
  scores:act.map(p=>({id:p.id,score:p.score||0,stunned:!!s&&stunned(s,p)}))};
}

/* ------------------------------ background (SVG) ------------------------------ */
let BG_URL=null;
function bgSvg(){
 let seed=7;const r=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 const R0=235,cx=480,cy=270;let o='';
 o+=`<defs><radialGradient id="g" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="#9be83e"/><stop offset="1" stop-color="#62bd2a"/></radialGradient>
<radialGradient id="d" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#c58246"/><stop offset="1" stop-color="#8d542b"/></radialGradient>
<radialGradient id="t" cx="38%" cy="32%" r="72%"><stop offset="0" stop-color="#8fdc55"/><stop offset="1" stop-color="#2b8227"/></radialGradient>
<filter id="b"><feGaussianBlur stdDeviation="4"/></filter></defs>`;
 o+='<rect width="960" height="540" fill="url(#g)"/>';
 for(let i=0;i<46;i++){const x=r()*960,y=r()*540;if(hypot2(x-cx,y-cy)<R0+26)continue;o+=`<circle cx="${x|0}" cy="${y|0}" r="${(6+r()*20)|0}" fill="${i%2?'#b4f25a':'#4fa823'}" opacity=".28"/>`;}
 for(let i=0;i<60;i++){const x=r()*960,y=r()*540;if(hypot2(x-cx,y-cy)<R0+24)continue;o+=`<circle cx="${x|0}" cy="${y|0}" r="2.2" fill="${['#fff','#ffe36a','#ff9fc2'][i%3]}" opacity=".8"/>`;}
 const tree=(x,y,k)=>{let t=`<ellipse cx="${x+8}" cy="${y+12}" rx="${k}" ry="${k*.9}" fill="#1b4d1a" opacity=".4" filter="url(#b)"/>`;
  t+=`<circle cx="${x}" cy="${y}" r="${k}" fill="url(#t)"/>`;
  for(let i=0;i<7;i++){const a=i/7*6.283,rx=x+Math.cos(a)*k*.55,ry=y+Math.sin(a)*k*.55;t+=`<circle cx="${rx|0}" cy="${ry|0}" r="${(k*.38)|0}" fill="#58b43a" opacity=".55"/>`;}
  t+=`<circle cx="${x-k*.18}" cy="${y-k*.2}" r="${k*.42}" fill="#8ad955" opacity=".7"/><circle cx="${x-k*.2}" cy="${y-k*.24}" r="${k*.2}" fill="#b8ee80" opacity=".6"/>`;return t;};
 // tractor
 o+=`<g transform="translate(112 195) rotate(-35)"><rect x="-52" y="-34" width="104" height="68" rx="14" fill="#1b4d1a" opacity=".35" transform="translate(7 9)"/>
<rect x="-50" y="-30" width="62" height="60" rx="8" fill="#9a5b34" stroke="#5b3217" stroke-width="3"/>
<g stroke="#6e3f1e" stroke-width="2"><line x1="-50" y1="-15" x2="12" y2="-15"/><line x1="-50" y1="0" x2="12" y2="0"/><line x1="-50" y1="15" x2="12" y2="15"/></g>
<rect x="8" y="-24" width="46" height="48" rx="10" fill="#3f93e8" stroke="#1f5ea6" stroke-width="3"/><rect x="18" y="-12" width="22" height="24" rx="6" fill="#9ad0ff" stroke="#1f5ea6" stroke-width="2"/>
<rect x="-30" y="-44" width="36" height="14" rx="7" fill="#25201c"/><rect x="-30" y="30" width="36" height="14" rx="7" fill="#25201c"/><rect x="26" y="-42" width="30" height="12" rx="6" fill="#25201c"/><rect x="26" y="30" width="30" height="12" rx="6" fill="#25201c"/></g>`;
 o+=tree(235,48,56)+tree(66,392,72)+tree(215,497,58)+tree(882,150,76)+tree(910,410,86)+tree(790,540,64)+tree(25,25,50);
 const log=(x,y,rot,l)=>`<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="${-l/2+4}" y="-10" width="${l}" height="26" rx="12" fill="#1b4d1a" opacity=".3"/><rect x="${-l/2}" y="-13" width="${l}" height="26" rx="12" fill="#a36435" stroke="#5b3217" stroke-width="3"/><ellipse cx="${l/2-8}" cy="0" rx="9" ry="12" fill="#d9a066" stroke="#5b3217" stroke-width="2"/><line x1="${-l/2+14}" y1="-4" x2="${l/2-26}" y2="-4" stroke="#7b4825" stroke-width="2"/></g>`;
 o+=log(748,42,18,100)+log(190,350,-38,86);
 const mush=(x,y,k)=>`<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="2" cy="6" rx="12" ry="5" fill="#1b4d1a" opacity=".35"/><rect x="-4" y="0" width="8" height="9" fill="#f4ead2"/><ellipse cx="0" cy="0" rx="13" ry="11" fill="#e5342b" stroke="#a31a14" stroke-width="2"/><circle cx="-5" cy="-3" r="2.6" fill="#fff"/><circle cx="4" cy="-5" r="2.2" fill="#fff"/><circle cx="5" cy="3" r="2" fill="#fff"/></g>`;
 o+=mush(748,98,1.1)+mush(752,268,.9)+mush(262,512,1.1)+mush(292,520,.8);
 // sign
 o+=`<g transform="translate(822 150) rotate(12)"><rect x="-3" y="10" width="6" height="52" fill="#8a5428" stroke="#4a2a12" stroke-width="2"/><rect x="-30" y="-36" width="60" height="52" rx="5" fill="#f4e7c6" stroke="#8a5428" stroke-width="4"/><circle cx="0" cy="-10" r="17" fill="#3a2a2a" opacity=".85"/><circle cx="0" cy="-10" r="20" fill="none" stroke="#d6281f" stroke-width="5"/><line x1="-15" y1="-25" x2="15" y2="5" stroke="#d6281f" stroke-width="5"/></g>`;
 // stump
 o+=`<g transform="translate(860 292)"><ellipse cx="6" cy="14" rx="40" ry="30" fill="#1b4d1a" opacity=".35"/><path d="M-34 14 L-20 -22 L20 -22 L36 16 L50 34 L-46 34Z" fill="#5a3320"/><ellipse cx="0" cy="-8" rx="36" ry="30" fill="#f2cfa0" stroke="#7a4a26" stroke-width="3"/><ellipse cx="0" cy="-8" rx="22" ry="18" fill="none" stroke="#d6a56e" stroke-width="2.5"/><ellipse cx="0" cy="-8" rx="9" ry="7" fill="none" stroke="#d6a56e" stroke-width="2"/></g>`;
 // arena
 const poly=(rad)=>{let p='';for(let i=0;i<16;i++){const a=i/16*6.28318-1.5708;p+=`${(cx+Math.cos(a)*rad).toFixed(1)},${(cy+Math.sin(a)*rad).toFixed(1)} `;}return p;};
 o+=`<polygon points="${poly(R0+12)}" fill="#4a2a12" opacity=".4" transform="translate(6 9)" filter="url(#b)"/>`;
 o+=`<circle cx="${cx}" cy="${cy}" r="${R0+4}" fill="#6b3c18"/><circle cx="${cx}" cy="${cy}" r="${R0}" fill="url(#d)"/>`;
 o+=`<circle cx="${cx}" cy="${cy}" r="${R0-6}" fill="none" stroke="#6e3f1e" stroke-width="3" opacity=".35"/>`;
 for(let i=0;i<22;i++){const a=r()*6.283,rr=r()*R0*.85,x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;o+=`<path d="M${x|0} ${y|0}q${(r()*30-15)|0} ${(r()*20-10)|0} ${(r()*50-25)|0} ${(r()*24-12)|0}" stroke="#6e3f1e" stroke-width="2" fill="none" opacity=".4"/>`;}
 for(let i=0;i<30;i++){const a=r()*6.283,rr=r()*R0*.92,x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;o+=`<ellipse cx="${x|0}" cy="${y|0}" rx="${(4+r()*10)|0}" ry="${(3+r()*6)|0}" fill="${i%2?'#d89a5c':'#7d4825'}" opacity=".25"/>`;}
 for(let i=0;i<8;i++){const a=r()*6.283,rr=R0*(.3+r()*.6),x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;o+=`<ellipse cx="${x|0}" cy="${y|0}" rx="${(18+r()*14)|0}" ry="${(10+r()*8)|0}" fill="#7bb83a" opacity=".22"/>`;}
 // fence: rails + posts
 o+=`<polygon points="${poly(R0+10)}" fill="none" stroke="#5b3217" stroke-width="9" stroke-linejoin="round"/><polygon points="${poly(R0+10)}" fill="none" stroke="#a46a37" stroke-width="5" stroke-linejoin="round"/>`;
 for(let i=0;i<16;i++){const a=i/16*6.28318-1.5708,x=cx+Math.cos(a)*(R0+10),y=cy+Math.sin(a)*(R0+10);o+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="#7b4825" stroke="#3f2210" stroke-width="2.5"/><circle cx="${(x-1.5).toFixed(1)}" cy="${(y-1.5).toFixed(1)}" r="3" fill="#c48650"/>`;}
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="960" height="540">${o}</svg>`;
}
function hypot2(a,b){return Math.sqrt(a*a+b*b);}
function loadBackground(){
 const bg={img:null,ready:false};
 try{
  if(typeof Image==='undefined')return bg;
  if(!BG_URL)BG_URL='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(bgSvg());
  const img=new Image();bg.img=img;
  img.onload=()=>{bg.ready=true;};img.onerror=()=>{bg.ready=false;};
  img.src=BG_URL;
 }catch(e){bg.img=null;}
 return bg;
}
function cleanup(round){
 const s=round?.molemayhem;
 if(s?.bg?.img){s.bg.img.onload=null;s.bg.img.onerror=null;s.bg.img=null;s.bg.ready=false;}
}

/* ------------------------------ drawing ------------------------------ */
function drawHole(g,sl,u){
 g.save();g.translate(sl.x,sl.y);g.scale(u,u);
 g.fillStyle='rgba(60,30,10,.35)';g.beginPath();g.ellipse(0,3,24,19,0,0,TAU);g.fill();
 g.fillStyle='#7a4a26';g.beginPath();g.ellipse(0,0,22,17,0,0,TAU);g.fill();
 const gr=g.createRadialGradient(0,-3,2,0,0,20);gr.addColorStop(0,'#0f0603');gr.addColorStop(1,'#432412');
 g.fillStyle=gr;g.beginPath();g.ellipse(0,0,18,14,0,0,TAU);g.fill();
 g.strokeStyle='rgba(215,160,100,.5)';g.lineWidth=2;g.beginPath();g.ellipse(0,0,21,16,0,Math.PI*1.05,Math.PI*1.8);g.stroke();
 g.restore();
}
function drawMole(g,m,s,u){
 const h=moleHeight(m);if(h<=0.02)return;
 g.save();g.translate(m.x,m.y);g.scale(u,u);
 const pop=.5+.5*h,bonk=m.state==='bonk',sq=bonk?.72+.28*Math.abs(Math.sin(m.t*14)):1;
 const wob=m.state==='up'?Math.sin(s.clock*7+m.wob)*.8:0;
 g.translate(wob,(1-h)*9-1);g.scale(pop,pop*sq);
 // body
 g.fillStyle='#232c4a';g.beginPath();g.arc(0,0,15,0,TAU);g.fill();
 g.fillStyle='#34426b';g.beginPath();g.arc(-2,-3,12.5,0,TAU);g.fill();
 g.fillStyle='#8a6a52';g.beginPath();g.ellipse(0,4,9,7.5,0,0,TAU);g.fill();
 // eyes
 if(bonk||m.flash>0){
  g.strokeStyle='#fff';g.lineWidth=1.8;
  for(const ex of[-5.5,5.5]){g.beginPath();g.moveTo(ex-2.6,-6.6);g.lineTo(ex+2.6,-1.4);g.moveTo(ex+2.6,-6.6);g.lineTo(ex-2.6,-1.4);g.stroke();}
 }else{
  g.fillStyle='#fff';g.beginPath();g.arc(-5.5,-4,3.3,0,TAU);g.arc(5.5,-4,3.3,0,TAU);g.fill();
  g.fillStyle='#111';g.beginPath();g.arc(-5.2,-3.6,1.6,0,TAU);g.arc(5.2,-3.6,1.6,0,TAU);g.fill();
 }
 g.fillStyle='#ff8aa0';g.beginPath();g.ellipse(0,3,3.6,2.8,0,0,TAU);g.fill();
 g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=.9;
 g.beginPath();g.moveTo(-5,5);g.lineTo(-13,4);g.moveTo(-5,7);g.lineTo(-12,9);g.moveTo(5,5);g.lineTo(13,4);g.moveTo(5,7);g.lineTo(12,9);g.stroke();
 if(m.type==='hat'&&!m.hatOff){
  g.fillStyle='#f5ad1c';g.strokeStyle='#a86206';g.lineWidth=1.8;
  g.beginPath();g.arc(0,-6,15,Math.PI,TAU);g.lineTo(15,-5);g.lineTo(-15,-5);g.closePath();g.fill();g.stroke();
  g.fillStyle='#ffd447';g.beginPath();g.arc(0,-6,11,Math.PI*1.1,Math.PI*1.9);g.fill();
  g.fillStyle='#fff6b8';g.strokeStyle='#a86206';g.lineWidth=1.4;g.beginPath();g.roundRect?g.roundRect(-4.5,-21,9,6,2):g.rect(-4.5,-21,9,6);g.fill();g.stroke();
 }
 if(bonk||(m.flash>0&&m.type==='hat')){
  g.fillStyle='#ffe45c';
  for(let i=0;i<3;i++){const a=s.clock*8+i*2.09;g.beginPath();g.arc(Math.cos(a)*11,-14+Math.sin(a)*3,2.2,0,TAU);g.fill();}
 }
 g.restore();
}
function drawVeg(g,v,s,u){
 const hop=v.t<1?Math.sin(v.t*Math.PI):0,z=hop*30*u,sq=1+hop*.14;
 g.save();g.translate(v.x,v.y);g.scale(u,u);
 g.fillStyle='rgba(40,20,5,'+(.28-hop*.1)+')';g.beginPath();g.ellipse(2,6,22-hop*4,13-hop*2,0,0,TAU);g.fill();
 g.translate(0,-z/u);g.scale(sq,1/sq*(1+hop*.02));
 if(v.type==='cabbage'){
  g.fillStyle='#2f9a35';g.beginPath();g.arc(0,0,23,0,TAU);g.fill();
  g.fillStyle='#55c14a';g.beginPath();g.arc(-1,-1,19,0,TAU);g.fill();
  g.strokeStyle='#8ee070';g.lineWidth=2;g.beginPath();g.arc(-1,-1,13,.4,5.4);g.stroke();g.beginPath();g.arc(0,0,7,1,5.5);g.stroke();
  g.fillStyle='#b6f08e';g.beginPath();g.arc(-2,-2,5,0,TAU);g.fill();
 }else if(v.type==='pumpkin'){
  g.fillStyle='#d9740f';g.beginPath();g.ellipse(0,0,24,20,0,0,TAU);g.fill();
  g.fillStyle='#f39a2a';
  for(const ex of[-12,0,12]){g.beginPath();g.ellipse(ex,0,9,19,0,0,TAU);g.fill();}
  g.strokeStyle='#b85a05';g.lineWidth=1.6;for(const ex of[-6,6]){g.beginPath();g.moveTo(ex,-18);g.quadraticCurveTo(ex+3,0,ex,18);g.stroke();}
  g.fillStyle='#4a7a2a';g.fillRect(-3,-8,6,8);
 }else if(v.type==='carrot'){
  g.fillStyle='#e8751a';g.beginPath();g.ellipse(0,3,20,15,0,0,TAU);g.fill();
  g.fillStyle='#ff9a3d';g.beginPath();g.ellipse(-3,0,13,9,0,0,TAU);g.fill();
  g.strokeStyle='#3f9a35';g.lineWidth=4;g.lineCap='round';
  for(const a of[-.7,0,.7]){g.beginPath();g.moveTo(0,-4);g.lineTo(Math.sin(a)*16,-4-Math.cos(a)*18);g.stroke();}
  g.lineCap='butt';
 }else{
  g.fillStyle='#1f6d2a';g.beginPath();g.ellipse(0,0,23,20,0,0,TAU);g.fill();
  g.strokeStyle='#58c25a';g.lineWidth=3;
  for(let i=-3;i<=3;i++){g.beginPath();g.moveTo(i*5,-19);g.quadraticCurveTo(i*8,0,i*5,19);g.stroke();}
  g.fillStyle='rgba(255,255,255,.22)';g.beginPath();g.ellipse(-8,-7,7,4,-.5,0,TAU);g.fill();
 }
 g.restore();
}
function drawHammer(g,p,s,u){
 const m=p.mole,a=m.att,ang=Math.atan2(p.dir.y,p.dir.x);
 let off=.95,sc=1;
 if(a){
  if(a.phase==='windup'){const k=ease(a.t/C.attack.windup);off=.95+k*1.5;sc=1+k*.25;}
  else if(a.phase==='active'){const k=clamp(a.t/C.attack.active,0,1);off=2.45*(1-k);sc=1.25-.25*k;}
  else{const k=ease(a.t/C.attack.recovery);off=.95*k;}
 }
 g.save();g.translate(p.x,p.y);g.scale(u,u);g.rotate(ang+off);g.scale(sc,sc);
 g.fillStyle='rgba(0,0,0,.18)';g.fillRect(8,1,20,6);
 g.fillStyle='#b97a42';g.strokeStyle='#5b3217';g.lineWidth=1.5;g.fillRect(6,-2.6,19,5.2);g.strokeRect(6,-2.6,19,5.2);
 g.fillStyle='#9aa3ad';g.strokeStyle='#454c54';g.lineWidth=1.8;
 g.beginPath();g.roundRect?g.roundRect(21,-8.5,12,17,3):g.rect(21,-8.5,12,17);g.fill();g.stroke();
 g.fillStyle='rgba(255,255,255,.55)';g.fillRect(23,-6.5,3,13);
 g.restore();
}
function drawStars(g,p,s,u){
 g.save();g.translate(p.x,p.y-20*u);
 const t=s.clock*6;
 for(let i=0;i<3;i++){
  const a=t+i*2.094,x=Math.cos(a)*15*u,y=Math.sin(a)*6*u;
  g.fillStyle='#ffe45c';g.strokeStyle='#b58a00';g.lineWidth=1;
  g.beginPath();for(let k=0;k<10;k++){const r=(k%2?3:7)*u,aa=k*Math.PI/5-Math.PI/2;g.lineTo(x+Math.cos(aa)*r,y+Math.sin(aa)*r);}
  g.closePath();g.fill();g.stroke();
 }
 g.restore();
}
function drawFxLayer(g,s,u,top){
 for(const e of s.fx){
  const k=clamp(e.life/(e.max||1),0,1);
  if(e.k==='puff'&&!top){g.save();g.globalAlpha=(e.alpha||.3)*k;g.fillStyle=e.color||'#d9a672';g.beginPath();g.arc(e.x,e.y,(e.r0||4)+(e.grow||10)*(1-k),0,TAU);g.fill();g.restore();}
  else if(e.k==='impact'&&top){g.save();g.globalAlpha=k;g.strokeStyle='#fff7c2';g.lineWidth=3*u;g.beginPath();g.arc(e.x,e.y,(10+22*(1-k))*u,0,TAU);g.stroke();g.restore();}
  else if(e.k==='spark'&&top){g.save();g.globalAlpha=k;g.fillStyle=e.color;g.fillRect(e.x-e.r*u/2,e.y-e.r*u/2,e.r*u,e.r*u);g.restore();}
  else if(e.k==='helmet'&&top){
   g.save();g.globalAlpha=Math.min(1,k*1.6);g.translate(e.x,e.y);g.rotate(e.rot);g.scale(u,u);
   g.fillStyle='#f5ad1c';g.strokeStyle='#a86206';g.lineWidth=1.6;g.beginPath();g.arc(0,0,11,Math.PI,TAU);g.closePath();g.fill();g.stroke();g.restore();
  }else if(e.k==='pop'&&top){
   const rise=(1-k)*30*u,sc=(e.big?1.25:1)*(k>.8?.6+(1-k)*2:1);
   g.save();g.globalAlpha=Math.min(1,k*2);g.translate(e.x,e.y-rise);g.scale(u*sc,u*sc);
   g.font='900 22px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';
   g.lineWidth=5;g.strokeStyle='#3b1c07';g.lineJoin='round';g.strokeText(e.text,0,0);g.fillStyle=e.color;g.fillText(e.text,0,0);g.restore();
  }
 }
}
function drawBackground(g,s){
 const w=s.world;
 if(s.bg?.ready&&s.bg.img){g.drawImage(s.bg.img,0,0,w.w,w.h);return;}
 g.fillStyle='#74c92f';g.fillRect(0,0,w.w,w.h);
 g.fillStyle='#5b3217';g.beginPath();g.arc(w.cx,w.cy,w.R+8,0,TAU);g.fill();
 g.fillStyle='#a8683a';g.beginPath();g.arc(w.cx,w.cy,w.R,0,TAU);g.fill();
}
function draw(g,time,round,ps){
 const s=round.molemayhem;if(!s)return;
 const w=s.world,u=w.unit;
 g.save();
 g.fillStyle='#4f9e22';g.fillRect(0,0,960,540);
 g.scale(960/w.w,540/w.h);
 if(s.shake>0)g.translate(Math.sin(s.clock*90)*4*s.shake,Math.cos(s.clock*80)*4*s.shake);
 drawBackground(g,s);
 for(const sl of s.slots)drawHole(g,sl,u);
 drawFxLayer(g,s,u,false);
 for(const m of s.moles)drawMole(g,m,s,u);
 for(const v of s.vegs)if(v.t>=1)drawVeg(g,v,s,u);
 const live=ps.filter(p=>p.active).sort((a,b)=>a.y-b.y);
 for(const v of s.vegs)if(v.t<1)drawVeg(g,v,s,u);
 for(const p of live){
  g.fillStyle='rgba(30,15,5,.28)';g.beginPath();g.ellipse(p.x,p.y+C.radius*u*.7,C.radius*u*1.1,C.radius*u*.55,0,0,TAU);g.fill();
  if(PC()?.draw)PC().draw(g,p,{time:s.clock,label:false,scale:u});
  else{g.fillStyle=p.color||'#eee';g.beginPath();g.arc(p.x,p.y,C.radius*u,0,TAU);g.fill();}
  drawHammer(g,p,s,u);
  if(stunned(s,p))drawStars(g,p,s,u);
 }
 drawFxLayer(g,s,u,true);
 g.restore();
}

/* ------------------------------ results / roster ------------------------------ */
function getResult(round,players){
 return players.filter(p=>p.active).map(p=>({id:p.id,value:p.score||0,label:(p.score||0)+' คะแนน'}));
}
function getRoster(round,players){
 const s=round.molemayhem;
 return players.filter(p=>p.active).map(p=>({id:p.id,value:p.score||0,label:(p.score||0)+' คะแนน',
  status:s&&stunned(s,p)?'สตัน':'',eliminated:false}));
}
function getControllerPacket(p,round,players){
 const s=round.molemayhem;
 return {t:'mole-mayhem-status',mode:round.mode,score:p.score||0,stunned:!!s&&stunned(s,p),remaining:round.remaining??null};
}

const engine=Object.freeze({getControllerPacket,getRoster,getResult,resultTitle:'ราชาตีตุ่น!',countdownSeconds:3,
 setup,update,draw,hud,step,finish,cleanup,teardown:cleanup,worldFor,config:C});
export default engine;
