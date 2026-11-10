/* DINO PANIC — bot driver. Same speed and same physics as a real player (input magnitude 1, no speed multiplier).
   A bot only perceives what a human sees on screen: obstacles within a limited look-ahead window and the
   current positions of other runners. It plans with a small Dijkstra over that window and steers with a
   committed, smoothed heading, so it cannot flicker left/right every frame. Mistakes come from short
   look-ahead, replan delay, turning lag and crowding — never from a hidden speed cut. */
import {C,clamp,hash01,Heap,NB} from './config.js';
const CELL=16; // 2.56x fewer navigation cells than the old 10-unit grid
export function makeBot(idx,rng){
 return{idx,key:(idx+1)*7919,look:250+rng()*100,replan:.34+rng()*.18,turn:7+rng()*6,noise:.06+rng()*.1,
  next:idx*.031+rng()*.09,dx:1,dy:0,tx:null,ty:null,pxs:0,pys:0,pt:0,unstick:0,side:0,sideUntil:0};
}
function plan(s,p,bot){
 const tr=s.track,R=C.R+4,x0=Math.floor((p.x-60)/CELL)*CELL,x1=p.x+bot.look,top=tr.top,
  nc=Math.max(4,Math.ceil((x1-x0)/CELL)),nr=Math.floor(tr.H/CELL),n=nc*nr;
 const blocked=new Uint8Array(n),cost=new Float32Array(n).fill(1);
 const cx=i=>x0+(i+.5)*CELL,cyy=j=>top+(j+.5)*CELL;
 for(let j=0;j<nr;j++){const y=cyy(j);if(y<top+C.R||y>tr.bottom-C.R)for(let i=0;i<nc;i++)blocked[j*nc+i]=1;}
 for(const o of tr.query(x0-40,x1+40)){
  const ex=(o.shape==='circle'?o.r:o.hw)+R,ey=(o.shape==='circle'?o.r:o.hh)+R;
  const i0=Math.max(0,Math.floor((o.x-ex-x0)/CELL)),i1=Math.min(nc-1,Math.floor((o.x+ex-x0)/CELL));
  const j0=Math.max(0,Math.floor((o.y-ey-top)/CELL)),j1=Math.min(nr-1,Math.floor((o.y+ey-top)/CELL));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
   const x=cx(i),y=cyy(j);
   const d=o.shape==='circle'?Math.hypot(x-o.x,y-o.y)-o.r:Math.hypot(Math.max(Math.abs(x-o.x)-o.hw,0),Math.max(Math.abs(y-o.y)-o.hh,0));
   if(d<R)blocked[j*nc+i]=1;
  }
 }
 // other runners are visible but not solid walls: crowded cells are just expensive
 for(const q of s.roster){if(q===p||q.dino.state!=='run')continue;
  if(q.x<x0-40||q.x>x1+40)continue;
  const i0=Math.max(0,Math.floor((q.x-44-x0)/CELL)),i1=Math.min(nc-1,Math.floor((q.x+44-x0)/CELL));
  const j0=Math.max(0,Math.floor((q.y-44-top)/CELL)),j1=Math.min(nr-1,Math.floor((q.y+44-top)/CELL));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const d=Math.hypot(cx(i)-q.x,cyy(j)-q.y);if(d<44)cost[j*nc+i]+=1.6*(1-d/44)+.4;}
 }
 for(let k=0;k<n;k++)if(!blocked[k])cost[k]*=1+bot.noise*hash01(k%nc+((x0/CELL)|0),((k/nc)|0)+bot.key);
 const D=new Float64Array(n).fill(Infinity),h=new Heap();
 for(let j=0;j<nr;j++){const k=j*nc+nc-1;if(!blocked[k]){D[k]=0;h.push(0,k);}}
 if(!h.size){ // window edge fully walled: aim for the cells reaching furthest right
  for(let i=nc-1;i>=0&&!h.size;i--)for(let j=0;j<nr;j++){const k=j*nc+i;if(!blocked[k]){D[k]=0;h.push(0,k);}}
 }
 while(h.size){const u=h.pop(),d=h.rk;if(d>D[u])continue;const i=u%nc,j=(u/nc)|0;
  for(const[dx,dy,len]of NB){const ni=i+dx,nj=j+dy;if(ni<0||nj<0||ni>=nc||nj>=nr)continue;
   const v=nj*nc+ni;if(blocked[v])continue;if(dx&&dy&&(blocked[j*nc+ni]||blocked[nj*nc+i]))continue;
   // walking left (towards the dinosaur) is a bad idea: make it expensive
   const nd=d+len*CELL*cost[v]*(dx>0?1:1.25);if(nd<D[v]){D[v]=nd;h.push(nd,v);}}}
 // start cell: nearest reachable cell around the bot
 let ci=clamp(Math.floor((p.x-x0)/CELL),0,nc-1),cj=clamp(Math.floor((p.y-top)/CELL),0,nr-1),c=cj*nc+ci;
 if(!isFinite(D[c])){let best=-1,bd=Infinity;
  for(let dj=-3;dj<=3;dj++)for(let di=-3;di<=3;di++){const i=ci+di,j=cj+dj;if(i<0||j<0||i>=nc||j>=nr)continue;
   const k=j*nc+i;if(!isFinite(D[k]))continue;const dd=di*di+dj*dj;if(dd<bd){bd=dd;best=k;}}
  if(best<0)return null;c=best;}
 // follow the descent ~110 units ahead, then take the furthest cell that still has a straight, clear line
 const chain=[c];let len=0;
 for(let g=0;g<20&&len<105;g++){const cur=chain[chain.length-1],i=cur%nc,j=(cur/nc)|0;let bk=-1,bv=D[cur];
  for(const[dx,dy]of NB){const ni=i+dx,nj=j+dy;if(ni<0||nj<0||ni>=nc||nj>=nr)continue;const v=nj*nc+ni;
   if(!(D[v]<bv))continue;if(dx&&dy&&!(isFinite(D[j*nc+ni])&&isFinite(D[nj*nc+i])))continue;bk=v;bv=D[v];}
  if(bk<0)break;chain.push(bk);len+=CELL*1.2;}
 const clear=(a,b)=>{const ax=cx(a%nc),ay=cyy((a/nc)|0),bx=cx(b%nc),by=cyy((b/nc)|0),m=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/(CELL*.5)));
  for(let t=1;t<m;t++){const x=ax+(bx-ax)*t/m,y=ay+(by-ay)*t/m,i=clamp(Math.floor((x-x0)/CELL),0,nc-1),j=clamp(Math.floor((y-top)/CELL),0,nr-1);if(blocked[j*nc+i])return false;}return true;};
 let pick=chain[Math.min(1,chain.length-1)];
 for(let k=chain.length-1;k>=1;k--){if(clear(c,chain[k])){pick=chain[k];break;}}
 return{x:cx(pick%nc),y:cyy((pick/nc)|0),goalD:D[c]};
}
export function botControl(s,p,dt){
 const bot=p.dino.bot;if(!bot)return{x:0,y:0};
 bot.next-=dt;
 // stuck detection: pressing forward but barely moving → hold a sideways commitment for a short time
 bot.pt+=dt;
 if(bot.pt>=.45){const moved=Math.hypot(p.x-bot.pxs,p.y-bot.pys);
  if(moved<10&&s.clock>.8){const tr=s.track;bot.side=p.y>tr.cy?-1:1;bot.sideUntil=s.clock+.55;bot.next=0;}
  bot.pxs=p.x;bot.pys=p.y;bot.pt=0;}
 if(bot.next<=0){bot.next=bot.replan;const r=plan(s,p,bot);
  if(r){bot.tx=r.x;bot.ty=r.y;}else{bot.tx=p.x+100;bot.ty=p.y;}}
 let tx=bot.tx??p.x+100,ty=bot.ty??p.y,dx=tx-p.x,dy=ty-p.y,m=Math.hypot(dx,dy);
 if(m<4){dx=1;dy=0;m=1;}
 dx/=m;dy/=m;
 if(s.clock<bot.sideUntil){dx=.45;dy=bot.side*.9;const mm=Math.hypot(dx,dy);dx/=mm;dy/=mm;}
 const k=1-Math.exp(-bot.turn*dt);
 bot.dx+=(dx-bot.dx)*k;bot.dy+=(dy-bot.dy)*k;
 const mm=Math.hypot(bot.dx,bot.dy)||1;
 return{x:bot.dx/mm,y:bot.dy/mm};
}
