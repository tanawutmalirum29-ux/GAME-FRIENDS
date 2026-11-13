/* DINO PANIC — full-detail 10-world-unit bot grid; no quality cuts to fix frame time.
   Bots share short-lived navigation fields for the same corridor segment instead
   of running 12 independent Dijkstra searches over nearly identical obstacles.
   Each bot still has independent replan timing, steering and crowd avoidance. */
import {C,clamp,Heap,NB,NBX,NBY,NBL} from './config.js';
import {obstacleContact} from './map.js';
const HEAP=new Heap(),QB=[];   // one shared heap + scratch list: fields are built one at a time
export const BOT_NAV_CELL=10; // Original fidelity restored (was increased to 16 for speed).
const WINDOW=420,SECTION=180,MAX_FIELD_AGE=.34,AVOID_RADIUS=66;
export function makeBot(idx,rng){
 return{idx,key:(idx+1)*7919,look:250+rng()*100,replan:.34+rng()*.18,turn:7+rng()*6,noise:.06+rng()*.1,
  next:idx*.031+rng()*.09,dx:1,dy:0,tx:null,ty:null,pxs:0,pys:0,pt:0,unstick:0,side:0,sideUntil:0};
}
function buildField(s,x0,old){
 const tr=s.track,R=C.R+4,top=tr.top,nc=WINDOW/BOT_NAV_CELL,nr=Math.floor(tr.H/BOT_NAV_CELL),
  n=nc*nr,x1=x0+WINDOW;
 let blocked,D;   // rebuilding a stale field reuses its buffers instead of allocating new ones
 const spare=!old&&s.fieldPool&&s.fieldPool.pop();   // buffers of evicted sections are recycled too
 if(!old&&spare)old=spare;
 if(old&&old.D.length===n){blocked=old.blocked;blocked.fill(0);D=old.D;old.x0=x0;}else{blocked=new Uint8Array(n);D=new Float64Array(n);old=null;}
 const heap=HEAP;heap.k.length=0;heap.v.length=0;
 D.fill(Infinity);
 for(let j=0;j<nr;j++){
  const y=top+(j+.5)*BOT_NAV_CELL;
  if(y<top+C.R||y>tr.bottom-C.R)blocked.fill(1,j*nc,(j+1)*nc);
 }
 for(const o of tr.query(x0-42,x1+42,QB)){
  const r=o.shape==='circle'?o.r:0,a=o.angle||0,cs=Math.abs(Math.cos(a)),sn=Math.abs(Math.sin(a));
  const ex=(r||cs*o.hw+sn*o.hh)+R,ey=(r||sn*o.hw+cs*o.hh)+R;
  const i0=Math.max(0,Math.floor((o.x-ex-x0)/BOT_NAV_CELL)),i1=Math.min(nc-1,Math.floor((o.x+ex-x0)/BOT_NAV_CELL));
  const j0=Math.max(0,Math.floor((o.y-ey-top)/BOT_NAV_CELL)),j1=Math.min(nr-1,Math.floor((o.y+ey-top)/BOT_NAV_CELL));
  for(let j=j0;j<=j1;j++){
   const y=top+(j+.5)*BOT_NAV_CELL,ay=Math.max(Math.abs(y-o.y)-(r||o.hh),0);
   for(let i=i0;i<=i1;i++){
    const x=x0+(i+.5)*BOT_NAV_CELL,ax=Math.max(Math.abs(x-o.x)-(r||o.hw),0);
    const inside=o.shape==='circle'?(x-o.x)**2+(y-o.y)**2<(r+R)**2:
     a?obstacleContact(o,x,y).gap<R:ax*ax+ay*ay<R*R;
    if(inside)blocked[j*nc+i]=1;
   }
  }
 }
 for(let j=0;j<nr;j++){
  const k=j*nc+nc-1;if(!blocked[k]){D[k]=0;heap.push(0,k);}
 }
 if(!heap.size){
  for(let i=nc-1;i>=0&&!heap.size;i--)for(let j=0;j<nr;j++){
   const k=j*nc+i;if(!blocked[k]){D[k]=0;heap.push(0,k);}
  }
 }
 while(heap.size){
  const u=heap.pop(),d=heap.rk;if(d>D[u])continue;
  const i=u%nc,j=(u/nc)|0;
  for(let q=0;q<8;q++){
   const dx=NBX[q],dy=NBY[q],len=NBL[q],ni=i+dx,nj=j+dy;
   if(ni<0||nj<0||ni>=nc||nj>=nr)continue;
   const v=nj*nc+ni;
   if(blocked[v]||(dx&&dy&&(blocked[j*nc+ni]||blocked[nj*nc+i])))continue;
   const nd=d+len*BOT_NAV_CELL*(dx>0?1:1.18);
   if(nd<D[v]){D[v]=nd;heap.push(nd,v);}
  }
 }
 if(old){old.at=s.clock;return old;}
 return{x0,top,nc,nr,blocked,D,at:s.clock};
}
function getField(s,p){
 if(!s.botFields)s.botFields=new Map();
 const x0=Math.floor((p.x-50)/SECTION)*SECTION;
 let field=s.botFields.get(x0);
 // at most ONE stale field is rebuilt per tick (spreads the Dijkstra cost over frames); a missing or very old one is always built
 const age=field?s.clock-field.at:Infinity;
 if(!field||(age>=MAX_FIELD_AGE&&(s.fieldTick!==s.tick||age>=MAX_FIELD_AGE*2.2))){
  field=buildField(s,x0,field);s.fieldTick=s.tick;s.botFields.set(x0,field);
  s.botFieldsBuilt=(s.botFieldsBuilt||0)+1; // diagnostic: actual shared Dijkstra computations
 }
 if(s.botFields.size>12){
  for(const [key,v] of s.botFields)if(s.clock-v.at>1){(s.fieldPool||(s.fieldPool=[])).push(v);s.botFields.delete(key);}
 }
 return field;
}
function plan(s,p){
 const f=getField(s,p),{x0,top,nc,nr,blocked,D}=f;
 const cx=i=>x0+(i+.5)*BOT_NAV_CELL,cy=j=>top+(j+.5)*BOT_NAV_CELL;
 const ci=clamp(Math.floor((p.x-x0)/BOT_NAV_CELL),0,nc-1),cj=clamp(Math.floor((p.y-top)/BOT_NAV_CELL),0,nr-1);
 let c=cj*nc+ci;
 if(!isFinite(D[c])){
  let best=-1,bd=Infinity;
  for(let dj=-4;dj<=4;dj++)for(let di=-4;di<=4;di++){
   const i=ci+di,j=cj+dj;if(i<0||j<0||i>=nc||j>=nr)continue;
   const k=j*nc+i;if(!isFinite(D[k]))continue;
   const dd=di*di+dj*dj;if(dd<bd){bd=dd;best=k;}
  }
  if(best<0)return null;c=best;
 }
 const chain=[c];let len=0;
 for(let t=0;t<24&&len<110;t++){
  const u=chain[chain.length-1],i=u%nc,j=(u/nc)|0;
  let best=-1,bv=D[u];
  for(let q=0;q<8;q++){
   const dx=NBX[q],dy=NBY[q],ni=i+dx,nj=j+dy;if(ni<0||nj<0||ni>=nc||nj>=nr)continue;
   const v=nj*nc+ni;if(!(D[v]<bv))continue;
   if(dx&&dy&&!(isFinite(D[j*nc+ni])&&isFinite(D[nj*nc+i])))continue;
   best=v;bv=D[v];
  }
  if(best<0)break;chain.push(best);len+=BOT_NAV_CELL*1.2;
 }
 const clear=(a,b)=>{
  const ax=cx(a%nc),ay=cy((a/nc)|0),bx=cx(b%nc),by=cy((b/nc)|0);
  const parts=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/(BOT_NAV_CELL*.5)));
  for(let z=1;z<parts;z++){
   const i=clamp(Math.floor((ax+(bx-ax)*z/parts-x0)/BOT_NAV_CELL),0,nc-1),
    j=clamp(Math.floor((ay+(by-ay)*z/parts-top)/BOT_NAV_CELL),0,nr-1);
   if(blocked[j*nc+i])return false;
  }
  return true;
 };
 let target=chain[Math.min(1,chain.length-1)];
 for(let k=chain.length-1;k>=1;k--){if(clear(c,chain[k])){target=chain[k];break;}}
 return{x:cx(target%nc),y:cy((target/nc)|0)};
}
export function botControl(s,p,dt){
 const bot=p.dino.bot;if(!bot)return{x:0,y:0};
 bot.next-=dt;bot.pt+=dt;
 if(bot.pt>=.45){
  const moved=Math.hypot(p.x-bot.pxs,p.y-bot.pys);
  if(moved<10&&s.clock>.8){
   bot.side=p.y>s.track.cy?-1:1;bot.sideUntil=s.clock+.55;bot.next=0;
  }
  bot.pxs=p.x;bot.pys=p.y;bot.pt=0;
 }
 if(bot.next<=0){
  bot.next=bot.replan;const r=plan(s,p);
  if(r){bot.tx=r.x;bot.ty=r.y;}else{bot.tx=p.x+100;bot.ty=p.y;}
 }
 let dx=(bot.tx??p.x+100)-p.x,dy=(bot.ty??p.y)-p.y;
 let mag=Math.hypot(dx,dy);
 if(mag<4){dx=1;dy=0;mag=1;}
 dx/=mag;dy/=mag;
 // Crowding is local/individual steering, not a second Dijkstra per player.
 // Keep equal movement speed and a stable side preference to prevent oscillation.
 for(const q of s.roster){
  if(q===p||q.dino.state!=='run')continue;
  const ax=q.x-p.x,ay=q.y-p.y,dist=Math.hypot(ax,ay);
  if(ax< -12||ax>AVOID_RADIUS||dist>AVOID_RADIUS||dist<1e-5)continue;
  const weight=(1-dist/AVOID_RADIUS)*.8;
  dy+=(ay===0?(bot.idx%2?-.8:.8): -Math.sign(ay))*weight;
  dx-=weight*.18;
 }
 if(s.clock<bot.sideUntil){dx=.45;dy=bot.side*.9;}
 mag=Math.hypot(dx,dy)||1;dx/=mag;dy/=mag;
 const k=1-Math.exp(-bot.turn*dt);
 bot.dx+=(dx-bot.dx)*k;bot.dy+=(dy-bot.dy)*k;
 mag=Math.hypot(bot.dx,bot.dy)||1;
 return{x:bot.dx/mag,y:bot.dy/mag};
}
