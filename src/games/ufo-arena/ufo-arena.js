/* UFO ARENA — host-authoritative bumper-ship brawl in an octagonal space arena, 120 Hz fixed step.
   Only spikes hurt. Everything else (UFOs, grey walls, coloured corner bumpers, centre bumper)
   merely pushes. Every length / speed is a WORLD unit scaled by u = world.w / 960. */
import * as Art from './ufo-art.js';

const STEP=1/120,TAU=Math.PI*2,EPS=1e-9;
const C=Object.freeze({
 radius:17,acc:330,fric:1.85,brake:2.15,maxSpeed:560,mass:1,
 ufoRest:.4,impactMultiplier:1.25,
 wallRest:.38,
 cornerRest:.8,cornerBase:190,cornerGain:.45,        // strong bumper: out = max(|vn|*rest, base + min(|vn|,260)*gain)
 bumperRest:.65,bumperBase:165,bumperGain:.38,bumperRadius:42,
 hp:5,invuln:.8,
 spike:{len:27,warn:.6,actMin:1.2,actMax:1.8,restMin:.8,restMax:1.4,extend:.09,retract:.2,knock:190,
  slot:84,maxLiveFrac:.5,maxLiveEdges:8},
 firstSpike:1.5,finishDelay:1.1,seconds:{small:60,large:80},
 hudCap:5
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const hyp=Math.hypot;
const living=ps=>ps.filter(p=>p.active&&p.ufo?.alive);
function rng(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x||0x3c6ef372;return(s.seed>>>0)/4294967296;}
function fxr(s){let x=s.fxSeed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.fxSeed=x||0x1b873593;return(s.fxSeed>>>0)/4294967296;}
const between=(s,a,b)=>a+(b-a)*rng(s);

/* ------------------------------ world & geometry ------------------------------ */
function worldFor(n){
 let large=n>6;
 try{const t=window.PartyArenaScale?.tier(n,[{maxPlayers:6,large:false},{maxPlayers:12,large:true}]);if(t)large=!!t.large;}catch(e){}
 return large
  ?{w:1280,h:720,u:1280/960,large,W:585,H:305,c:175,T:29,seconds:C.seconds.large}
  :{w:960,h:540,u:1,large,W:400,H:210,c:120,T:22,seconds:C.seconds.small};
}
const KINDS=['gray','cyan','gray','green','gray','red','gray','yellow'];
function buildGeo(wd){
 const {w,h,u,W,H,c,T}=wd,cx=w/2,cy=h/2;
 const verts=[[cx-W+c,cy-H],[cx+W-c,cy-H],[cx+W,cy-H+c],[cx+W,cy+H-c],[cx+W-c,cy+H],[cx-W+c,cy+H],[cx-W,cy+H-c],[cx-W,cy-H+c]].map(([x,y])=>({x,y}));
 const edges=verts.map((a,i)=>{
  const b=verts[(i+1)%8],dx=b.x-a.x,dy=b.y-a.y,len=hyp(dx,dy),d={x:dx/len,y:dy/len};
  return{a,b,len,d,n:{x:-d.y,y:d.x},kind:KINDS[i],strong:KINDS[i]!=='gray'};
 });
 const zones=[],byEdge=[];
 edges.forEach((e,i)=>{
  const margin=12*u,usable=e.len-margin*2,cnt=Math.max(1,Math.round(usable/(C.spike.slot*u))),sl=usable/cnt;byEdge[i]=[];
  for(let k=0;k<cnt;k++){
   const z={id:zones.length,edge:i,k,n:cnt,s0:margin+k*sl+4*u,s1:margin+(k+1)*sl-4*u,
    state:'idle',timer:0,activeDur:0,ext:0,act:0,hit:Object.create(null)};
   zones.push(z);byEdge[i].push(z);
  }
 });
 const perim=zones.reduce((a,z)=>a+(z.s1-z.s0),0);
 return{...wd,cx,cy,verts,edges,zones,byEdge,perim,bumper:{x:cx,y:cy,r:C.bumperRadius*u}};
}
// symmetric images of a zone: 180° rotation, mirror left/right, mirror top/bottom
function image(geo,z,kind){
 const n=z.n;
 if(kind==='rot')return geo.byEdge[(z.edge+4)%8][z.k];
 if(kind==='mirV')return geo.byEdge[(8-z.edge)%8][n-1-z.k];
 return geo.byEdge[(12-z.edge)%8][n-1-z.k];
}

/* ------------------------------ fx ------------------------------ */
function fx(s,e){if(s.fx.length>260)s.fx.shift();s.fx.push(e);}
function burst(s,x,y,color,n,v0,v1,life){
 for(let i=0;i<n;i++){const a=fxr(s)*TAU,v=v0+fxr(s)*(v1-v0);
  fx(s,{k:'spark',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:life*(.6+fxr(s)*.6),max:life,r:2.6*s.geo.u,color});}
}
function impactFx(s,x,y,color,power){
 fx(s,{k:'ring',x,y,life:.32,max:.32,r0:6*s.geo.u,r1:(22+power*18)*s.geo.u,color});
 burst(s,x,y,color,Math.round(4+power*6),90,260,.35);
}
function explode(s,p){
 const u=s.geo.u;
 fx(s,{k:'ring',x:p.x,y:p.y,life:.7,max:.7,r0:8*u,r1:70*u,color:'#fff2b0'});
 fx(s,{k:'ring',x:p.x,y:p.y,life:.9,max:.9,r0:4*u,r1:48*u,color:p.color||'#fff'});
 burst(s,p.x,p.y,p.color||'#fff',22,90,330,.9);
 burst(s,p.x,p.y,'#ffd27a',12,60,220,.7);
 for(let i=0;i<8;i++){const a=fxr(s)*TAU,v=60+fxr(s)*170;
  fx(s,{k:'debris',x:p.x,y:p.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:fxr(s)*TAU,spin:(fxr(s)-.5)*14,life:1.1,max:1.1,r:(2.5+fxr(s)*2.5)*u,color:i%2?p.color||'#ccc':'#8a90b8'});}
 s.shake=Math.max(s.shake,.9);
}

/* ------------------------------ setup ------------------------------ */
function insideMargin(geo,x,y,m){return geo.edges.every(e=>(x-e.a.x)*e.n.x+(y-e.a.y)*e.n.y>=m);}
function spawnSlots(geo,n,s){
 const {cx,cy,u}=geo,R=C.radius*u,m=R+C.spike.len*u+10*u;
 const base=rng(s)*TAU,out=[];
 // evenly spread on an ellipse; shrink the ring until every slot clears walls, spikes and the bumper
 for(let k=0;k<n;k++){
  const a=base+k*TAU/n;
  let f=.78;
  for(;f>.2;f-=.03){
   const x=cx+Math.cos(a)*geo.W*f,y=cy+Math.sin(a)*geo.H*f;
   if(insideMargin(geo,x,y,m)&&hyp(x-cx,y-cy)>geo.bumper.r+R*2.4)break;
  }
  out.push({x:cx+Math.cos(a)*geo.W*f,y:cy+Math.sin(a)*geo.H*f,a});
 }
 return out;
}
function makeBot(s){
 return{skill:.8+rng(s)*.18,interval:.09+rng(s)*.07,at:rng(s)*.2,dx:0,dy:0,ax:0,ay:0,target:null,
  react:.05+rng(s)*.1,lastX:0,lastY:0,stuckT:0,unstick:0,ux:0,uy:0,gx:0,gy:0};
}
function setup(round,ps){
 if(!ps.length||ps.length>12)throw Error('UFO ARENA supports 1–12 players');
 const n=ps.length,wd=worldFor(n),geo=buildGeo(wd);
 const s={geo,world:wd,clock:0,tick:0,accumulator:0,
  seed:(((Number(round.ufoArenaSeed)||(Date.now()^0x51ed270b))>>>0)||1),fxSeed:0x9e3779b1,
  roster:ps,originalCount:n,solo:n===1,total:wd.seconds,fx:[],shake:0,bumperPulse:0,
  nextSpawn:C.firstSpike,recent:[],zones:geo.zones,eliminations:0,finished:false,pendingFinish:0,winnerIds:[],ranking:[],art:null};
 round.ufoArena=s;
 s.art=Art.makeArt(geo);
 const slots=spawnSlots(geo,n,s);
 for(let i=slots.length-1;i>0;i--){const j=Math.floor(rng(s)*(i+1));[slots[i],slots[j]]=[slots[j],slots[i]];}
 ps.forEach((p,i)=>{
  const q=slots[i];
  p.active=true;p.score=0;p.x=q.x;p.y=q.y;p.vx=p.vy=0;
  const m=hyp(geo.cx-q.x,geo.cy-q.y)||1;p.dir={x:(geo.cx-q.x)/m,y:(geo.cy-q.y)/m};p.face=p.dir.x<0?-1:1;
  p.ufo={alive:true,hp:C.hp,mass:C.mass,invulnUntil:-9,flash:0,eliminatedTick:null,eliminatedAt:null,
   phase:rng(s)*TAU,tx:0,ty:0,thrust:0,fxCool:0,impactT:0,bot:p.isBot?makeBot(s):null};
  if(p.ufo.bot){p.ufo.bot.lastX=q.x;p.ufo.bot.lastY=q.y;}
 });
 round.remaining=s.total;
 return s;
}

/* ------------------------------ spikes ------------------------------ */
function activatePattern(s,list){
 const dur=between(s,C.spike.actMin,C.spike.actMax);
 for(const z of list){z.state='warn';z.timer=C.spike.warn;z.activeDur=dur;z.ext=0;}
}
function liveZones(s){return s.zones.filter(z=>z.state==='warn'||z.state==='active');}
function trySpawnPattern(s){
 const geo=s.geo,live=liveZones(s);
 // One batch per cycle: exactly half of every hole (12 of 24 on small maps).
 // Keep 180-degree pairs for fairness and never spawn on an already-active hole.
 if(live.length)return false;
 if(s.zones.some(z=>z.state==='rest'))return false;
 const target=Math.round(geo.zones.length*C.spike.maxLiveFrac);
 const chosen=[],used=new Set();
 const available=geo.zones.filter(z=>z.state==='idle');
 for(let attempt=0;attempt<available.length*3&&chosen.length<target;attempt++){
  const z=available[Math.floor(rng(s)*available.length)];
  if(used.has(z.id))continue;
  const partner=image(geo,z,'rot');
  if(!partner||partner.state!=='idle'||used.has(partner.id))continue;
  if(target-chosen.length<2)break;
  chosen.push(z,partner);used.add(z.id);used.add(partner.id);
 }
 if(chosen.length<target){
  for(const z of available)if(chosen.length<target&&!used.has(z.id)){chosen.push(z);used.add(z.id);}
 }
 if(chosen.length!==target)return false;
 activatePattern(s,chosen);
 return true;
}
function updateZones(s,dt){
 for(const z of s.zones){
  if(z.state==='warn'){
   z.timer-=dt;
   if(z.timer<=0){z.state='active';z.timer=z.activeDur;z.act++;z.hit=Object.create(null);z.ext=0;
    const e=s.geo.edges[z.edge],m=(z.s0+z.s1)/2;
    fx(s,{k:'ring',x:e.a.x+e.d.x*m+e.n.x*10*s.geo.u,y:e.a.y+e.d.y*m+e.n.y*10*s.geo.u,life:.25,max:.25,r0:4*s.geo.u,r1:26*s.geo.u,color:'#ff6a4a'});}
  }else if(z.state==='active'){
   z.timer-=dt;z.ext=Math.min(1,(z.activeDur-z.timer)/C.spike.extend);
   if(z.timer<=0){z.state='rest';z.timer=between(s,C.spike.restMin,C.spike.restMax);}
  }else if(z.state==='rest'){
   z.timer-=dt;z.ext=Math.max(0,z.ext-dt/C.spike.retract);
   if(z.timer<=0){z.state='idle';z.ext=0;}
  }
 }
 if(s.clock>=s.nextSpawn)s.nextSpawn=s.clock+(trySpawnPattern(s)?between(s,.35,.95):.25);
}

/* ------------------------------ input ------------------------------ */
function humanInput(p){
 if(window.PartyCharacters?.control)return window.PartyCharacters.control(p.input);
 const k=p.input||{};let x=finite(Number(k.axisX)),y=finite(Number(k.axisY));
 if(hyp(x,y)<.12){x=Number(!!k.right)-Number(!!k.left);y=Number(!!k.down)-Number(!!k.jump);}
 const m=hyp(x,y);return m>1?{x:x/m,y:y/m}:{x,y};
}

/* ------------------------------ bots ------------------------------ */
// Bots use the same acceleration, friction and collision rules. They only react to
// spikes that are already warning (after a personal reaction delay) or extended.
function perceived(b,z){
 if(z.state==='active')return{t0:0,t1:z.timer};
 if(z.state==='warn'&&C.spike.warn-z.timer>=b.react)return{t0:z.timer,t1:z.timer+z.activeDur};
 return null;
}
function zoneDanger(s,b,x,y,t,R,u,mul){
 let cost=0;
 for(const z of s.zones){
  const v=perceived(b,z);if(!v)continue;
  if(t<v.t0-.1||t>v.t1+.15)continue;
  const e=s.geo.edges[z.edge],rx=x-e.a.x,ry=y-e.a.y,al=rx*e.d.x+ry*e.d.y,di=rx*e.n.x+ry*e.n.y;
  if(al>z.s0-R*1.25&&al<z.s1+R*1.25&&di<C.spike.len*u+R+10*u)cost+=520*mul;
  else if(al>z.s0-R*2.4&&al<z.s1+R*2.4&&di<C.spike.len*u+R*2.6)cost+=35*mul;
 }
 return cost;
}
function wallDist(geo,x,y){let m=1e9;for(const e of geo.edges)m=Math.min(m,(x-e.a.x)*e.n.x+(y-e.a.y)*e.n.y);return m;}
function pickGoal(s,p,live){
 const b=p.ufo.bot,geo=s.geo,u=geo.u,R=C.radius*u,others=live.filter(q=>q!==p);
 if(!others.length)return{x:geo.cx,y:geo.cy,ram:false};
 let best=null,bestScore=1e9;
 for(const q of others){
  let sc=hyp(q.x-p.x,q.y-p.y)+q.ufo.hp*14;
  const wd=wallDist(geo,q.x,q.y);sc+=wd*.35;
  for(const z of s.zones){if(!perceived(b,z))continue;const e=geo.edges[z.edge],m=(z.s0+z.s1)/2;
   if(hyp(q.x-(e.a.x+e.d.x*m),q.y-(e.a.y+e.d.y*m))<160*u)sc-=90;}
  if(q.id===b.target)sc-=45;
  sc+=(rng(s)-.5)*18;
  if(sc<bestScore){bestScore=sc;best=q;}
 }
 const q=best;b.target=q.id;
 // where should the victim end up? an announced spike, else a wall / strong bumper (big bounce)
 let D=null,dd=1e9;
 for(const z of s.zones){
  const v=perceived(b,z);if(!v||v.t0>1.1)continue;
  const e=geo.edges[z.edge],m=(z.s0+z.s1)/2,wx=e.a.x+e.d.x*m,wy=e.a.y+e.d.y*m,d=hyp(q.x-wx,q.y-wy);
  if(d<dd){dd=d;D={x:wx,y:wy};}
 }
 if(!D){
  let bi=0,bv=1e9;
  geo.edges.forEach((e,i)=>{const d=(q.x-e.a.x)*e.n.x+(q.y-e.a.y)*e.n.y-(e.strong?28*u:0);if(d<bv){bv=d;bi=i;}});
  const e=geo.edges[bi],al=clamp((q.x-e.a.x)*e.d.x+(q.y-e.a.y)*e.d.y,0,e.len);
  D={x:e.a.x+e.d.x*al,y:e.a.y+e.d.y*al};
  // a target hugging the centre bumper is better sent through it
  if(hyp(q.x-geo.cx,q.y-geo.cy)<geo.bumper.r+R*4)D={x:geo.cx,y:geo.cy};
 }
 let px=D.x-q.x,py=D.y-q.y,pm=hyp(px,py);
 if(pm<1){px=q.x-p.x;py=q.y-p.y;pm=hyp(px,py)||1;}
 px/=pm;py/=pm;
 const lead=.22,qx=q.x+q.vx*lead,qy=q.y+q.vy*lead,mx=qx-p.x,my=qy-p.y,mm=hyp(mx,my)||1;
 const align=(mx/mm)*px+(my/mm)*py;
 if(align>.7||(mm<R*3.4&&align>.35))return{x:qx+px*R*4,y:qy+py*R*4,ram:true};
 return{x:qx-px*R*2.8,y:qy-py*R*2.8,ram:false};
}
function botDecide(s,p,live){
 const b=p.ufo.bot,geo=s.geo,u=geo.u,R=C.radius*u,acc=C.acc*u,k=C.fric;
 const hp=p.ufo.hp,mul=hp<=2?1.5:1,aggr=hp>=4?1:hp===3?.8:.5;
 const goal=pickGoal(s,p,live);
 const times=[.25,.5,.8],cands=[];
 for(let i=0;i<16;i++)cands.push({ux:Math.cos(i*TAU/16),uy:Math.sin(i*TAU/16)});
 cands.push({ux:0,uy:0,stop:true});
 const prevA=Math.atan2(b.dy,b.dx),hasPrev=hyp(b.dx,b.dy)>.1;
 let best=null,bc=1e9;
 for(const c of cands){
  const vtx=c.ux*acc/k,vty=c.uy*acc/k;
  let cost=0,half=null;
  for(const t of times){
   const e=Math.exp(-k*t),f=(1-e)/k;
   const x=p.x+vtx*t+(p.vx-vtx)*f,y=p.y+vty*t+(p.vy-vty)*f;
   if(t===.5)half={x,y};
   cost+=zoneDanger(s,b,x,y,t,R,u,mul);
   if(hyp(x-geo.cx,y-geo.cy)<geo.bumper.r+R+3*u)cost+=14;
   const wd=wallDist(geo,x,y);if(wd<R+4*u)cost+=wd<R-2*u?22:7;
  }
  cost+=hyp(half.x-goal.x,half.y-goal.y)*(.9*aggr+.12);
  if(hp<=2)for(const q of live){if(q===p)continue;const d=hyp(half.x-q.x,half.y-q.y);if(d<R*5)cost+=(R*5-d)*.5;}
  if(c.stop)cost+=hasPrev?10:2;
  else if(hasPrev){const da=Math.abs(Math.atan2(Math.sin(Math.atan2(c.uy,c.ux)-prevA),Math.cos(Math.atan2(c.uy,c.ux)-prevA)));if(da<.45)cost-=7;}
  cost+=(rng(s)-.5)*5*(1.2-b.skill);
  if(cost<bc){bc=cost;best=c;}
 }
 b.stuckT+=b.interval;
 if(b.stuckT>1){
  if(hyp(p.x-b.lastX,p.y-b.lastY)<9*u&&best&&!best.stop){
   const cx=geo.cx-p.x,cy=geo.cy-p.y,m=hyp(cx,cy)||1,side=rng(s)<.5?-1:1;
   b.unstick=s.clock+.5;b.ux=cx/m*.6+(-cy/m)*.8*side;b.uy=cy/m*.6+(cx/m)*.8*side;
  }
  b.lastX=p.x;b.lastY=p.y;b.stuckT=0;
 }
 if(s.clock<b.unstick&&!zoneDanger(s,b,p.x,p.y,.3,R,u,1)){b.dx=b.ux;b.dy=b.uy;}
 else if(best){b.dx=best.ux;b.dy=best.uy;}
}
function botInput(s,p,live,dt){
 const b=p.ufo.bot;b.at-=dt;
 if(b.at<=0){botDecide(s,p,live);b.at=b.interval*(.85+rng(s)*.3);}
 const a=1-Math.exp(-12*dt);b.ax+=(b.dx-b.ax)*a;b.ay+=(b.dy-b.ay)*a;
 return{x:b.ax,y:b.ay};
}

/* ------------------------------ physics ------------------------------ */
function integrate(s,p,live,dt){
 const d=p.ufo,u=s.geo.u,inp=p.isBot?botInput(s,p,live,dt):humanInput(p);
 d.impactT=Math.max(0,d.impactT-dt);
 let ix=finite(inp.x),iy=finite(inp.y);const m0=hyp(ix,iy);if(m0>1){ix/=m0;iy/=m0;}
 const mag=hyp(ix,iy);
 p.vx+=ix*C.acc*u*dt;p.vy+=iy*C.acc*u*dt;
 const f=Math.exp(-(mag>.05?C.fric:C.brake)*dt);p.vx*=f;p.vy*=f;
 const sp=hyp(p.vx,p.vy),cap=C.maxSpeed*u*(d.impactT>0?C.impactMultiplier:1);if(sp>cap){p.vx*=cap/sp;p.vy*=cap/sp;}
 p.x+=p.vx*dt;p.y+=p.vy*dt;
 d.tx=ix;d.ty=iy;d.thrust=mag;
 if(mag>.1){p.dir={x:ix/mag,y:iy/mag};p.face=p.dir.x<0?-1:1;}
 d.flash=Math.max(0,d.flash-dt);d.fxCool=Math.max(0,d.fxCool-dt);
 if(mag>.35&&fxr(s)<dt*38){
  const q=1/(hyp(ix,iy)||1);
  fx(s,{k:'puff',x:p.x-ix*q*13*u+(fxr(s)-.5)*5*u,y:p.y-iy*q*13*u+(fxr(s)-.5)*5*u,vx:-ix*40*u,vy:-iy*40*u,life:.32,max:.32,r0:2.6*u,grow:5*u,alpha:.5,color:'#ffd27a'});
 }
}
function bounceOff(p,nx,ny,rest,base,gain,u){
 const vn=p.vx*nx+p.vy*ny;if(vn>=0)return 0;
 const inN=-vn;
 const out=Math.max(inN*rest,base?base*u+Math.min(inN,260*u)*gain:0)*C.impactMultiplier;
 p.vx+=nx*(out-vn);p.vy+=ny*(out-vn);
 p.ufo.impactT=.3; // short impact allowance; no multi-body energy explosion
 return inN;
}
function envCollide(s,p){
 const geo=s.geo,u=geo.u,R=C.radius*u,d=p.ufo;
 for(let i=0;i<geo.edges.length;i++){
  const e=geo.edges[i],dist=(p.x-e.a.x)*e.n.x+(p.y-e.a.y)*e.n.y;
  if(dist>=R)continue;
  p.x+=e.n.x*(R-dist);p.y+=e.n.y*(R-dist);
  const inN=e.strong?bounceOff(p,e.n.x,e.n.y,C.cornerRest,C.cornerBase,C.cornerGain,u):bounceOff(p,e.n.x,e.n.y,C.wallRest,0,0,u);
  if(inN>70*u&&d.fxCool<=0){
   d.fxCool=.12;
   const col={cyan:'#7fe0ff',green:'#8dff7a',red:'#ff7a6a',yellow:'#ffe27a',gray:'#e6e8ff'}[e.kind];
   impactFx(s,p.x-e.n.x*R,p.y-e.n.y*R,col,e.strong?1:.35);
   if(e.strong){fx(s,{k:'edge',edge:i,life:.4,max:.4,color:col});s.shake=Math.max(s.shake,.3);}
  }
 }
 const b=geo.bumper,dx=p.x-b.x,dy=p.y-b.y,dd=hyp(dx,dy),lim=b.r+R;
 if(dd<lim){
  const nx=dd>1e-6?dx/dd:1,ny=dd>1e-6?dy/dd:0;
  p.x=b.x+nx*lim;p.y=b.y+ny*lim;
  const inN=bounceOff(p,nx,ny,C.bumperRest,C.bumperBase,C.bumperGain,u);
  if(inN>0){
   s.bumperPulse=1;
   if(d.fxCool<=0){d.fxCool=.12;impactFx(s,b.x+nx*b.r,b.y+ny*b.r,'#ffe9a0',.9);s.shake=Math.max(s.shake,.25);}
  }
 }
}
function pairCollide(s,live){
 const u=s.geo.u,R2=C.radius*u*2;
 for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){
  const a=live[i],b=live[j];
  let dx=b.x-a.x,dy=b.y-a.y,d=hyp(dx,dy);
  if(d>=R2)continue;
  if(d<1e-5){dx=a.id<b.id?1:-1;dy=0;d=1e-5;}
  const nx=dx/d,ny=dy/d,ma=a.ufo.mass,mb=b.ufo.mass,im=1/ma+1/mb,pen=R2-d;
  const corr=pen*.9/im;
  a.x-=nx*corr/ma;a.y-=ny*corr/ma;b.x+=nx*corr/mb;b.y+=ny*corr/mb;
  const rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
  if(rel<0){
   const j2=-(1+C.ufoRest)*rel/im*C.impactMultiplier;
   a.vx-=j2*nx/ma;a.vy-=j2*ny/ma;b.vx+=j2*nx/mb;b.vy+=j2*ny/mb;
   a.ufo.impactT=b.ufo.impactT=.3;
   if(-rel>90*u&&a.ufo.fxCool<=0&&b.ufo.fxCool<=0){
    a.ufo.fxCool=b.ufo.fxCool=.12;
    impactFx(s,(a.x+b.x)/2,(a.y+b.y)/2,'#fff4c2',clamp(-rel/(260*u),.2,1));
   }
  }
 }
}
function damage(s,p,z){
 const d=p.ufo,u=s.geo.u,e=s.geo.edges[z.edge];
 d.hp--;d.invulnUntil=s.clock+C.invuln;d.flash=.5;z.hit[p.id]=true;
 p.vx+=e.n.x*C.spike.knock*u;p.vy+=e.n.y*C.spike.knock*u;
 fx(s,{k:'ring',x:p.x,y:p.y,life:.4,max:.4,r0:6*u,r1:34*u,color:'#ff4a3a'});
 burst(s,p.x,p.y,'#ff5a4a',10,80,250,.45);
 fx(s,{k:'heart',x:p.x,y:p.y-14*u,vy:-46*u,life:.9,max:.9,s:7*u});
 s.shake=Math.max(s.shake,.55);
 if(d.hp<=0)eliminate(s,p);
}
function eliminate(s,p){
 const d=p?.ufo;if(!d?.alive)return false;
 d.alive=false;d.hp=0;d.eliminatedAt=s.clock;d.eliminatedTick=s.tick;s.eliminations++;
 p.vx=p.vy=0;explode(s,p);return true;
}
function spikeHits(s,live){
 const geo=s.geo,u=geo.u,R=C.radius*u,L=C.spike.len*u;
 for(const z of s.zones){
  if(z.state!=='active'||z.ext<.55)continue;
  const e=geo.edges[z.edge];
  for(const p of live){
   if(!p.ufo.alive||z.hit[p.id]||s.clock<p.ufo.invulnUntil)continue;
   const rx=p.x-e.a.x,ry=p.y-e.a.y,al=rx*e.d.x+ry*e.d.y,di=rx*e.n.x+ry*e.n.y;
   if(al>z.s0-R*.35&&al<z.s1+R*.35&&di-R*.8<L*z.ext)damage(s,p,z);
  }
 }
}

/* ------------------------------ step / update ------------------------------ */
function finish(s,round,ps){
 s.finished=true;
 const list=ps.filter(p=>p.active),alive=list.filter(p=>p.ufo?.alive);
 s.winnerIds=alive.length===1||s.solo?alive.map(p=>p.id):alive.filter(p=>p.ufo.hp===Math.max(...alive.map(q=>q.ufo.hp))).map(p=>p.id);
 s.ranking=getResult(round,ps).map(r=>({...r,rank:1+list.filter(q=>valueOf(s,q)>r.value).length}));
 round.remaining=Math.max(0,s.total-s.clock);
 release(s);
}
function release(s){
 if(s.art){Art.releaseArt(s.art);}
 s.fx.length=0;
}
function step(dt,round,ps){
 const s=round.ufoArena;if(!s||s.finished)return;
 s.tick++;s.clock+=dt;
 updateZones(s,dt);
 const live=living(ps);
 for(const p of live)integrate(s,p,live,dt);
 for(let it=0;it<3;it++){pairCollide(s,live);for(const p of live)envCollide(s,p);}
 spikeHits(s,live);
 round.remaining=Math.max(0,s.total-s.clock);
 if(!s.pendingFinish){
  const left=living(ps).length;
  if(s.solo?left===0:left<=1)s.pendingFinish=C.finishDelay;
  else if(round.remaining<=0)s.pendingFinish=EPS;
 }
 for(const e of s.fx){
  e.life-=dt;
  if(e.vx!==undefined){e.x+=e.vx*dt;if(e.vy!==undefined)e.y+=e.vy*dt;if(e.k!=='heart'){const f=Math.exp(-2.6*dt);e.vx*=f;e.vy*=f;}}
  else if(e.k==='heart'){e.y+=e.vy*dt;}
  if(e.spin)e.rot+=e.spin*dt;
 }
 s.fx=s.fx.filter(e=>e.life>0);
 s.shake=Math.max(0,s.shake-dt*2.4);s.bumperPulse=Math.max(0,s.bumperPulse-dt*3);
 if(s.pendingFinish){s.pendingFinish-=dt;if(s.pendingFinish<=0)finish(s,round,ps);}
}
function update(dt,round,ps){
 const s=round.ufoArena;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.25,s.accumulator+clamp(finite(dt),0,.25));
 let cycles=0;
 while(s.accumulator+EPS>=STEP&&cycles++<40&&!s.finished){step(STEP,round,ps);s.accumulator-=STEP;}
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.ufoArena,act=ps.filter(p=>p.active);
 return{survivors:living(ps).length,remaining:round.remaining??null,elapsed:s?.clock||0,winnerIds:s?.winnerIds||[],
  statuses:act.map(p=>({id:p.id,alive:!!p.ufo?.alive,hp:p.ufo?.hp??0}))};
}

/* ------------------------------ drawing ------------------------------ */
function drawFx(g,s,layer){
 const u=s.geo.u;
 for(const e of s.fx){
  const k=e.life/e.max;
  if(layer==='under'){
   if(e.k==='puff'){const r=e.r0+e.grow*(1-k);g.globalAlpha=(e.alpha||.4)*k;g.fillStyle=e.color;g.beginPath();g.arc(e.x,e.y,r,0,TAU);g.fill();g.globalAlpha=1;}
   else if(e.k==='edge'){
    const ed=s.geo.edges[e.edge];g.globalAlpha=k*.8;g.strokeStyle=e.color;g.lineWidth=7*u;g.lineCap='round';
    g.shadowColor=e.color;g.shadowBlur=14*u;g.beginPath();g.moveTo(ed.a.x+ed.n.x*3*u,ed.a.y+ed.n.y*3*u);g.lineTo(ed.b.x+ed.n.x*3*u,ed.b.y+ed.n.y*3*u);g.stroke();
    g.shadowBlur=0;g.globalAlpha=1;
   }
  }else{
   if(e.k==='spark'){g.globalAlpha=Math.min(1,k*1.4);g.fillStyle=e.color;g.beginPath();g.arc(e.x,e.y,e.r*(.4+.6*k),0,TAU);g.fill();g.globalAlpha=1;}
   else if(e.k==='ring'){const r=e.r0+(e.r1-e.r0)*(1-k);g.globalAlpha=k;g.strokeStyle=e.color;g.lineWidth=(2+4*k)*u;g.beginPath();g.arc(e.x,e.y,r,0,TAU);g.stroke();g.globalAlpha=1;}
   else if(e.k==='debris'){g.save();g.translate(e.x,e.y);g.rotate(e.rot);g.globalAlpha=Math.min(1,k*1.6);g.fillStyle=e.color;g.fillRect(-e.r,-e.r*.6,e.r*2,e.r*1.2);g.restore();g.globalAlpha=1;}
   else if(e.k==='heart'){g.globalAlpha=Math.min(1,k*1.5);Art.drawHeart(g,e.x,e.y,e.s*(1+.4*(1-k)),'#ff3b4e','#fff');g.strokeStyle='#fff';g.lineWidth=1.4*u;g.beginPath();g.moveTo(e.x-e.s*.2,e.y-e.s*.5);g.lineTo(e.x+e.s*.3,e.y+e.s*.1);g.lineTo(e.x-e.s*.1,e.y+e.s*.4);g.stroke();g.globalAlpha=1;}
  }
 }
}
function drawRoster(g,s,ps){
 const geo=s.geo,u=geo.u,act=ps.filter(p=>p.active);if(!act.length)return;
 const rows=act.length>1?[act.slice(0,Math.ceil(act.length/2)),act.slice(Math.ceil(act.length/2))]:[act,[]];
 const top=(geo.cy-geo.H-geo.T)/2,bot=geo.h-top;
 const x0=geo.cx-geo.W+40*u,x1=geo.cx+geo.W-40*u;
 rows.forEach((row,ri)=>{
  const cnt=row.length;if(!cnt)return;
  const ew=(x1-x0)/Math.max(cnt,3),y=ri?bot:top,hs=Math.min(5.2*u,ew/13);
  row.forEach((p,i)=>{
   const cx=cnt<3?geo.cx+(i-(cnt-1)/2)*ew:x0+ew*(i+.5),alive=p.ufo?.alive;
   g.save();g.globalAlpha=alive?1:.45;
   Art.drawHearts(g,cx,y,p.ufo?.hp??0,C.hp,hs,p.color||'#fff');
   g.restore();
  });
 });
}
function draw(g,time,round,ps){
 const s=round.ufoArena;if(!s)return;
 const geo=s.geo,u=geo.u;
 g.save();
 g.fillStyle='#0a0a33';g.fillRect(0,0,960,540);
 g.scale(960/geo.w,540/geo.h);
 if(s.shake>0)g.translate(Math.sin(s.clock*93)*5*s.shake*u,Math.cos(s.clock*79)*5*s.shake*u);
 Art.drawBackdrop(g,s.art,geo);
 // centre bumper impact glow
 if(s.bumperPulse>0){
  const b=geo.bumper;g.save();g.globalAlpha=s.bumperPulse*.8;g.strokeStyle='#fff6c0';g.lineWidth=5*u;g.shadowColor='#ffe27a';g.shadowBlur=20*u;
  g.beginPath();g.arc(b.x,b.y,b.r+8*u,0,TAU);g.stroke();g.restore();
 }
 for(const z of s.zones){if(z.state==='warn')Art.drawZoneWarning(g,geo,z,s.clock,C.spike.len*u);}
 for(const z of s.zones){if(z.state==='active'||z.state==='rest')Art.drawZoneSpikes(g,geo,z,s.clock,C.spike.len*u);}
 drawFx(g,s,'under');
 const alive=living(ps).slice().sort((a,b)=>a.y-b.y);
 for(const p of alive){
  const d=p.ufo,inv=s.clock<d.invulnUntil,blink=inv&&Math.floor(s.clock*14)%2===0;
  Art.drawUFO(g,p.x,p.y,{u,time:s.clock,phase:d.phase,color:p.color||'#ddd',dx:p.dir?.x??1,dy:p.dir?.y??0,
   tx:d.tx,ty:d.ty,thrust:d.thrust,flash:d.flash,alpha:blink?.35:1});
 }
 drawFx(g,s,'over');
 drawRoster(g,s,ps);
 g.restore();
}

/* ------------------------------ results / roster ------------------------------ */
function valueOf(s,p){
 const d=p.ufo;if(!d)return -1;
 if(d.alive){
  const alive=s.roster.filter(q=>q.active&&q.ufo?.alive).length;
  return(alive===1||s.solo)?Infinity:1e6+d.hp;
 }
 return d.eliminatedTick??-1;
}
function labelOf(s,p){
 const d=p.ufo;
 if(d?.alive)return(s.roster.filter(q=>q.active&&q.ufo?.alive).length===1||s.solo?'ผู้รอดชีวิต':'รอดชีวิต')+' • ♥ '+d.hp;
 return'ตกรอบ • '+((d?.eliminatedAt??s.clock)).toFixed(1)+' วิ';
}
function getResult(round,players){
 const s=round.ufoArena;
 return players.filter(p=>p.active).map(p=>({id:p.id,value:valueOf(s,p),label:labelOf(s,p)}));
}
function getRoster(round,players){
 const s=round.ufoArena;
 return players.filter(p=>p.active).map(p=>({id:p.id,value:valueOf(s,p),label:labelOf(s,p),status:p.ufo?.alive?'alive':'out',eliminated:!p.ufo?.alive}));
}
function getControllerPacket(p,round,players){
 const st=p.ufo||{};
 return{t:'ufo-arena-status',mode:round.mode,alive:!!st.alive,hp:st.hp??0,survivors:hud(players,round).survivors};
}
function dispose(round){const s=round?.ufoArena;if(s){release(s);}}

const engine=Object.freeze({getControllerPacket,getResult,getRoster,resultTitle:'ผู้รอดชีวิตคนสุดท้าย!',
 countdownSeconds:3,setup,update,draw,hud,step,finish,dispose,worldFor,config:C});
export default engine;
