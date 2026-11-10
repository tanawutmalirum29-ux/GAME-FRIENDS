/* DANGERFIELD — host-authoritative minefield race with a bombed, unstable radar.
   Layers (kept separate on purpose):
   • PHYSICS  : s.mines (alive flag), s.mineGrid, obstacles. Used only for death, collision, scoring.
   • VISIBILITY: mineAlpha(s,m) — radar radius decides what is DRAWN. Never touches physics.
   • PERCEPTION: p.df.bot.known / visited — all a bot may use to steer.
   • SCORING  : s.D0 (distance field of the initial verified map) → progress, never rewritten by others' blasts. */
(() => {
'use strict';
const STEP=1/60,TAU=Math.PI*2;
// Tunables (balance values are meant to be edited here).
const C=Object.freeze({
 radius:14,          // body radius (world px, never scaled with the screen)
 mineR:11,           // visible mine radius
 hazard:21,          // centre distance that triggers a mine
 navR:31.5,          // hazard + half cell diagonal + slack: every free nav cell is truly safe
 cell:12,pitch:50,
 speed:135,botSpeed:.93,
 introSeconds:4,planeSpeed:760,bombTime:.55,
 respawnDelay:.8,spawnProtection:.9,
 maxAttempts:14,
 radar:Object.freeze({bodyR:34,minR:62,shrinkTime:1.8}),
 small:Object.freeze({w:960,h:540,field:Object.freeze({x:60,y:50,w:840,h:440}),zone:100,duration:60,crates:2}),
 large:Object.freeze({w:1280,h:720,field:Object.freeze({x:70,y:60,w:1140,h:600}),zone:120,duration:80,crates:4})
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const active=ps=>ps.filter(p=>p.active);
const mk=seed=>{let x=(seed>>>0)||1;return()=>{x=(x^(x<<13))>>>0;x=(x^(x>>>17))>>>0;x=(x^(x<<5))>>>0;return x/4294967296;};};
function hash01(a,b){let h=(a^Math.imul(b+1,2654435761))>>>0;h^=h>>>15;h=Math.imul(h,2246822519);h^=h>>>13;h=Math.imul(h,3266489917);h^=h>>>16;return(h>>>0)/4294967296;}
const NB=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.4142],[1,-1,1.4142],[-1,1,1.4142],[-1,-1,1.4142]];

/* ───────────── navigation grid + Dijkstra ───────────── */
function makeNav(s){const f=s.field,cols=Math.ceil(f.w/C.cell),rows=Math.ceil(f.h/C.cell);
 return{cols,rows,n:cols*rows,ox:f.x,oy:f.y};}
const cellOf=(nav,x,y)=>clamp(Math.floor((y-nav.oy)/C.cell),0,nav.rows-1)*nav.cols+clamp(Math.floor((x-nav.ox)/C.cell),0,nav.cols-1);
const cellX=(nav,i)=>nav.ox+(i%nav.cols+.5)*C.cell;
const cellY=(nav,i)=>nav.oy+(((i/nav.cols)|0)+.5)*C.cell;
function stampCircle(nav,blocked,x,y,R){
 const i0=Math.max(0,Math.floor((x-R-nav.ox)/C.cell)),i1=Math.min(nav.cols-1,Math.floor((x+R-nav.ox)/C.cell));
 const j0=Math.max(0,Math.floor((y-R-nav.oy)/C.cell)),j1=Math.min(nav.rows-1,Math.floor((y+R-nav.oy)/C.cell));
 for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
  if(Math.hypot(nav.ox+(i+.5)*C.cell-x,nav.oy+(j+.5)*C.cell-y)<R)blocked[j*nav.cols+i]=1;}
}
function staticBlocked(s,obstacles){
 const nav=s.nav,f=s.field,b=new Uint8Array(nav.n),r=C.radius+2;
 for(let idx=0;idx<nav.n;idx++){
  const x=cellX(nav,idx),y=cellY(nav,idx);
  if(x<f.x+C.radius||x>f.x+f.w-C.radius||y<f.y+C.radius||y>f.y+f.h-C.radius){b[idx]=1;continue;}
  for(const ob of obstacles){
   if(ob.type==='radar'?Math.hypot(x-ob.x,y-ob.y)<ob.r+r:(Math.abs(x-ob.x)<ob.hw+r&&Math.abs(y-ob.y)<ob.hh+r)){b[idx]=1;break;}
  }
 }
 return b;
}
let _pk=0,_pv=0;
function dijkstra(nav,blocked,cost,seeds,out){
 const {cols,rows}=nav,hk=[],hv=[];out.fill(Infinity);
 const push=(k,v)=>{let i=hk.length;hk.push(k);hv.push(v);
  while(i>0){const p=(i-1)>>1;if(hk[p]<=k)break;hk[i]=hk[p];hv[i]=hv[p];i=p;}hk[i]=k;hv[i]=v;};
 const pop=()=>{_pk=hk[0];_pv=hv[0];const lk=hk.pop(),lv=hv.pop(),n=hk.length;
  if(n>0){let i=0;for(;;){let c=2*i+1;if(c>=n)break;if(c+1<n&&hk[c+1]<hk[c])c++;if(hk[c]>=lk)break;hk[i]=hk[c];hv[i]=hv[c];i=c;}hk[i]=lk;hv[i]=lv;}};
 for(const sd of seeds){if(blocked[sd])continue;out[sd]=0;push(0,sd);}
 while(hk.length){
  pop();const d=_pk,u=_pv;if(d>out[u])continue;
  const i=u%cols,j=(u/cols)|0;
  for(const [dx,dy,len] of NB){
   const ni=i+dx,nj=j+dy;if(ni<0||nj<0||ni>=cols||nj>=rows)continue;
   const v=nj*cols+ni;if(blocked[v])continue;
   if(dx&&dy&&(blocked[j*cols+ni]||blocked[nj*cols+i]))continue; // no corner cutting
   const nd=d+len*C.cell*(cost?cost[v]:1);
   if(nd<out[v]){out[v]=nd;push(nd,v);}
  }
 }
 return out;
}
function bestNeighbor(nav,D,c){
 const {cols,rows}=nav,i=c%cols,j=(c/cols)|0;let best=-1,bv=D[c];
 for(const [dx,dy] of NB){
  const ni=i+dx,nj=j+dy;if(ni<0||nj<0||ni>=cols||nj>=rows)continue;
  const v=nj*cols+ni,dv=D[v];if(!(dv<bv))continue;
  if(dx&&dy&&!(isFinite(D[j*cols+ni])&&isFinite(D[nj*cols+i])))continue;
  best=v;bv=dv;
 }
 return best;
}
function nearestFinite(nav,D,c,rad){
 const {cols,rows}=nav,i=c%cols,j=(c/cols)|0;let best=-1,bd=Infinity;
 for(let dj=-rad;dj<=rad;dj++)for(let di=-rad;di<=rad;di++){
  const ni=i+di,nj=j+dj;if(ni<0||nj<0||ni>=cols||nj>=rows)continue;
  const v=nj*cols+ni;if(!isFinite(D[v]))continue;const d=di*di+dj*dj;if(d<bd){bd=d;best=v;}
 }
 return best;
}
function goalSeeds(s,blocked){
 const nav=s.nav,out=[];
 for(let idx=0;idx<nav.n;idx++)if(!blocked[idx]&&cellX(nav,idx)>=s.finishX+6)out.push(idx);
 return out;
}

/* ───────────── map generation (safe route first, mines around it) ───────────── */
function makeSlots(s){
 const f=s.field,cols=s.zone>=120?3:2,xs=[];for(let c=0;c<cols;c++)xs.push(f.x+34+c*32);
 const rows=Math.floor((f.h-128)/36)+1,slots=[];
 for(let c=0;c<cols;c++)for(let r=0;r<rows;r++)slots.push({x:xs[c],y:f.y+64+r*36,col:c,row:r});
 s.slotRows=rows;return slots;
}
function lattice(s){
 const f=s.field,Z=s.zone,PAD=26;
 const x0=f.x+Z+PAD,x1=f.x+f.w-Z-PAD,y0=f.y+PAD,y1=f.y+f.h-PAD;
 const cols=Math.floor((x1-x0)/C.pitch)+1,rows=Math.floor((y1-y0)/C.pitch)+1;
 const sx=(x1-x0)/(cols-1),sy=(y1-y0)/(rows-1),nodes=[];
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)nodes.push({x:x0+i*sx,y:y0+j*sy,i,j});
 return{cols,rows,nodes,forbid:new Uint8Array(cols*rows)};
}
function overlaps(ob,x,y,pad){
 return ob.type==='radar'?Math.hypot(x-ob.x,y-ob.y)<ob.r+pad:(Math.abs(x-ob.x)<ob.hw+pad&&Math.abs(y-ob.y)<ob.hh+pad);
}
function carvePath(L,rng,open,from,to,jit,pen){
 const {cols,rows}=L,n=cols*rows,dist=new Float32Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1),done=new Uint8Array(n);
 dist[from]=0;
 for(;;){
  let u=-1,b=Infinity;for(let k=0;k<n;k++)if(!done[k]&&dist[k]<b){b=dist[k];u=k;}
  if(u<0||u===to)break;done[u]=1;
  const i=u%cols,j=(u/cols)|0;
  for(const [dx,dy] of NB.slice(0,4)){
   const ni=i+dx,nj=j+dy;if(ni<0||nj<0||ni>=cols||nj>=rows)continue;
   const v=nj*cols+ni;if(L.forbid[v]&&v!==to)continue;
   const w=1+rng()*jit+(open[v]?pen:0)+(dx<0?.8:0);
   if(dist[u]+w<dist[v]){dist[v]=dist[u]+w;prev[v]=u;}
  }
 }
 if(!isFinite(dist[to]))return[];
 const out=[];for(let v=to;v>=0;v=prev[v]){out.push(v);if(v===from)break;}
 return out;
}
function carveRoutes(L,rng,open,template,fallback){
 const {cols,rows}=L,pick=(a,b)=>a+Math.floor(rng()*(b-a+1));
 const nodeAt=(i,j)=>{i=clamp(i,0,cols-1);j=clamp(j,0,rows-1);let v=j*cols+i;if(!L.forbid[v])return v;
  for(let d=1;d<rows;d++)for(const jj of[j-d,j+d]){if(jj<0||jj>=rows)continue;const w=jj*cols+i;if(!L.forbid[w])return w;}return v;};
 const route=(pts,jit,pen)=>{for(let k=0;k<pts.length-1;k++){
   const path=carvePath(L,rng,open,nodeAt(pts[k][0],pts[k][1]),nodeAt(pts[k+1][0],pts[k+1][1]),jit,pen);
   if(!path.length)return false;for(const v of path)open[v]=1;}return true;};
 if(fallback){ // two plain corridors along top and bottom rows: always valid
  for(let i=0;i<cols;i++){open[1*cols+i]=1;open[(rows-2)*cols+i]=1;}return true;}
 const q=(k)=>Math.round(k*(cols-1));
 let ok=true;
 if(template===0){ // snake + narrow shortcut
  const K=cols>14?5:4,pts=[[0,pick(1,rows-2)]];
  for(let k=1;k<K;k++)pts.push([Math.round(k*(cols-1)/K),k%2?pick(rows-3,rows-1):pick(0,2)]);
  pts.push([cols-1,pick(1,rows-2)]);
  ok=route(pts,1.2,0)&&route([[0,pick(2,rows-3)],[cols-1,pick(2,rows-3)]],.4,5);
 }else if(template===1){ // fork, crossover and merge
  const c1=q(.34),c2=q(.66);
  ok=route([[0,pick(0,2)],[c1,pick(0,2)],[c2,pick(1,3)],[cols-1,pick(0,3)]],.8,0)&&
   route([[0,pick(rows-3,rows-1)],[c1,pick(rows-3,rows-1)],[c2,pick(rows-4,rows-2)],[cols-1,pick(rows-4,rows-1)]],.8,0)&&
   route([[pick(c1-1,c1+1),pick(1,2)],[pick(c1-1,c1+1),pick(rows-3,rows-2)]],.5,0);
 }else if(template===2){ // braid of three winding routes
  for(let r=0;r<3&&ok;r++){const pts=[[0,pick(0,rows-1)]];
   for(let k=1;k<=3;k++)pts.push([Math.round(k*(cols-1)/4)+pick(-1,1),pick(0,rows-1)]);
   pts.push([cols-1,pick(0,rows-1)]);ok=route(pts,1.6,2.5);}
 }else{ // direct narrow line around the radar + long perimeter route
  ok=route([[0,pick(rows>>1,(rows>>1)+1)],[cols-1,pick(rows>>1,(rows>>1)+1)]],.3,0)&&
   route([[0,1],[cols-3,1],[cols-3,rows-2],[cols-1,rows-2]],.9,3)&&
   route([[0,rows-2],[2,rows-2],[2,0],[cols-1,0]],.9,3);
 }
 if(!ok)return false;
 // Dead-end spurs: visible decoys the player has to remember.
 const list=[];for(let v=0;v<cols*rows;v++)if(open[v]&&v%cols>0&&v%cols<cols-1)list.push(v);
 const spurs=cols>14?pick(4,7):pick(2,4);
 for(let k=0;k<spurs&&list.length;k++){
  let v=list[Math.floor(rng()*list.length)];const d=NB[Math.floor(rng()*4)],len=pick(2,4);
  for(let step=0;step<len;step++){
   const i=v%cols+d[0],j=((v/cols)|0)+d[1];if(i<1||j<0||i>=cols-1||j>=rows)break;
   const w=j*cols+i;if(open[w]||L.forbid[w])break;
   let touches=0;for(const e of NB.slice(0,4)){const ii=i+e[0],jj=j+e[1];if(ii<0||jj<0||ii>=cols||jj>=rows)continue;if(open[jj*cols+ii]&&jj*cols+ii!==v)touches++;}
   if(touches)break;open[w]=1;v=w;
  }
 }
 // Occasional wider stretches.
 let count=0;for(let v=0;v<cols*rows;v++)count+=open[v];
 for(let k=0;k<count*.14;k++){
  const v=list[Math.floor(rng()*list.length)];if(v===undefined)break;const d=NB[Math.floor(rng()*4)];
  const i=v%cols+d[0],j=((v/cols)|0)+d[1];if(i<0||j<0||i>=cols||j>=rows)continue;
  const w=j*cols+i;if(!L.forbid[w])open[w]=1;
 }
 return true;
}
function generate(s,attempt,fallback){
 const rng=mk((s.seed^Math.imul(attempt+1,0x9e3779b1))>>>0),f=s.field,rp=s.radarPos,L=lattice(s);
 const obstacles=[];
 for(const [cx,cy] of[[f.x+22,f.y+22],[f.x+f.w-22,f.y+22],[f.x+22,f.y+f.h-22],[f.x+f.w-22,f.y+f.h-22]])
  obstacles.push({type:'crate',x:cx,y:cy,hw:18,hh:18,corner:true});
 obstacles.push({type:'radar',x:rp.x,y:rp.y,r:C.radar.bodyR});
 // Loose crates standing on lattice nodes (never in the first/last two columns).
 const crates=[];
 for(let tries=0;!fallback&&crates.length<s.cfg.crates&&tries<60;tries++){
  const i=2+Math.floor(rng()*(L.cols-4)),j=1+Math.floor(rng()*(L.rows-2)),nd=L.nodes[j*L.cols+i];
  if(Math.hypot(nd.x-rp.x,nd.y-rp.y)<110)continue;
  if(crates.some(c=>Math.hypot(c.x-nd.x,c.y-nd.y)<C.pitch*2))continue;
  crates.push({type:'crate',x:nd.x,y:nd.y,hw:18,hh:18});
 }
 obstacles.push(...crates);
 for(const nd of L.nodes){const v=nd.j*L.cols+nd.i;
  if(Math.hypot(nd.x-rp.x,nd.y-rp.y)<C.radar.bodyR+28)L.forbid[v]=1;
  for(const c of crates)if(Math.abs(nd.x-c.x)<46&&Math.abs(nd.y-c.y)<46)L.forbid[v]=1;}
 const open=new Uint8Array(L.cols*L.rows);
 if(!carveRoutes(L,rng,open,Math.floor(rng()*4),fallback))return null;
 const mines=[];
 for(const nd of L.nodes){
  const v=nd.j*L.cols+nd.i;if(open[v])continue;
  if(obstacles.some(ob=>overlaps(ob,nd.x,nd.y,C.mineR+4)))continue;
  mines.push({id:mines.length,x:nd.x+(rng()-.5)*6,y:nd.y+(rng()-.5)*6,r:C.mineR,alive:true,seed:rng()});
 }
 return{mines,obstacles};
}
function analyse(s,cand){
 const nav=s.nav,base=staticBlocked(s,cand.obstacles),blocked=base.slice();
 for(const m of cand.mines)stampCircle(nav,blocked,m.x,m.y,C.navR);
 const seeds=goalSeeds(s,base);if(!seeds.length)return null;
 const D=new Float32Array(nav.n);dijkstra(nav,blocked,null,seeds,D);
 let start=0;
 for(const sl of s.slots){const v=D[cellOf(nav,sl.x,sl.y)];if(!isFinite(v))return null;start=Math.max(start,v);}
 if(start<=0)return null;
 // Second independent route: remove the middle of the best path and re-check reachability.
 const mid=s.slots[Math.floor(s.slotRows/2)],path=[];
 let c=cellOf(nav,mid.x,mid.y);
 for(let k=0;k<nav.n&&c>=0;k++){path.push(c);c=bestNeighbor(nav,D,c);}
 let alternate=true;
 if(path.length>16){
  const blocked2=blocked.slice();
  for(let k=Math.floor(path.length*.25);k<Math.floor(path.length*.75);k++)stampCircle(nav,blocked2,cellX(nav,path[k]),cellY(nav,path[k]),34);
  const D2=new Float32Array(nav.n);dijkstra(nav,blocked2,null,goalSeeds(s,blocked2),D2);
  alternate=isFinite(D2[cellOf(nav,mid.x,mid.y)]);
 }
 return{base,blocked,D,start,seeds,alternate};
}
function buildWorld(s){
 s.nav=makeNav(s);s.slots=makeSlots(s);
 const f=s.field;s.radarPos={x:f.x+f.w/2,y:f.y+f.h/2};
 let cand=null,info=null,attempts=0;
 for(;attempts<C.maxAttempts&&!info;attempts++){
  cand=generate(s,attempts,false);if(!cand)continue;
  const a=analyse(s,cand);if(a&&a.alternate)info=a;
 }
 if(!info){cand=generate(s,0,true);info=analyse(s,cand);s.usedFallback=true;}
 s.attempts=attempts;s.mines=cand.mines;s.obstacles=cand.obstacles;
 s.navBase=info.base;s.D0=info.D;s.startDist=info.start;s.goalSeeds=info.seeds;
 // Live snapshot: mines that exploded stop blocking, recomputed once per explosion tick.
 s.blockedLive=info.blocked.slice();s.dLive=Float32Array.from(info.D);
 const cs=64,gx=Math.ceil(s.w/cs),gy=Math.ceil(s.h/cs),cells=Array.from({length:gx*gy},()=>[]);
 for(const m of s.mines)cells[clamp(Math.floor(m.y/cs),0,gy-1)*gx+clamp(Math.floor(m.x/cs),0,gx-1)].push(m);
 s.mineGrid={cs,gx,gy,cells};
}
function refreshLive(s){
 const nav=s.nav,b=s.navBase.slice();
 for(const m of s.mines)if(m.alive)stampCircle(nav,b,m.x,m.y,C.navR);
 s.blockedLive=b;dijkstra(nav,b,null,s.goalSeeds,s.dLive);
}
function remainingAt(s,x,y){
 const nav=s.nav,c=cellOf(nav,x,y);
 if(isFinite(s.D0[c]))return s.D0[c];
 const i=c%nav.cols,j=(c/nav.cols)|0;let best=Infinity;
 for(const F of[s.D0,s.dLive]){ // standing where a destroyed mine used to be
  for(let dj=-3;dj<=3;dj++)for(let di=-3;di<=3;di++){
   const ni=i+di,nj=j+dj;if(ni<0||nj<0||ni>=nav.cols||nj>=nav.rows)continue;
   const v=F[nj*nav.cols+ni];if(isFinite(v))best=Math.min(best,v+Math.hypot(di,dj)*C.cell);
  }
  if(isFinite(best))break;
 }
 return best;
}

/* ───────────── radar, plane, visibility ───────────── */
function initRadar(s){
 const f=s.field,rp=s.radarPos;
 s.rmax=Math.max(...[[f.x,f.y],[f.x+f.w,f.y],[f.x,f.y+f.h],[f.x+f.w,f.y+f.h]].map(c=>Math.hypot(c[0]-rp.x,c[1]-rp.y)))+30;
 s.radar={state:'intact',phase:'',phaseT:0,radius:Infinity,regime:'low',left:0,target:0,flicker:0,flickerIn:-1,hitAt:null,rng:mk(s.seed^0x7a3c9e11)};
}
function visRadius(s){const r=s.radar;return r.state==='intact'?Infinity:r.radius*(r.flicker>0?.7:1);}
function mineAlpha(s,m){const R=visRadius(s);if(R===Infinity)return 1;
 return clamp((R-Math.hypot(m.x-s.radarPos.x,m.y-s.radarPos.y))/28,0,1);}
function covers(s,x,y){const R=visRadius(s);return R===Infinity||Math.hypot(x-s.radarPos.x,y-s.radarPos.y)<R;}
function launchPlane(s){
 const rp=s.radarPos,k=s.w/960,sx=-130*k,sy=rp.y-130*k,ex=s.w+130*k,ey=rp.y+70*k,dx=ex-sx,dy=ey-sy,L=Math.hypot(dx,dy);
 s.plane={x:sx,y:sy,vx:dx/L*C.planeSpeed*k,vy:dy/L*C.planeSpeed*k,ang:Math.atan2(dy,dx),dropped:false,gone:false,bomb:null,endX:ex,k};
}
function nextRegime(s){
 const r=s.radar,rr=r.rng,R=s.rmax;
 if(r.regime==='low'&&rr()<.6){
  if(rr()<.72){r.regime='mid';r.left=.8+rr()*.8;r.target=R*(.30+rr()*.25);}
  else{r.regime='high';r.left=.5+rr()*.5;r.target=R*(.82+rr()*.18);}
 }else{
  r.regime='low';r.left=1.4+rr()*1.6;r.target=C.radar.minR+rr()*R*.1;
  r.flickerIn=rr()<.35?rr()*r.left:-1;
 }
}
function addEffect(s,e){s.effects.push(e);if(s.effects.length>70)s.effects.shift();}
function stepRadar(s,dt){
 const r=s.radar,rp=s.radarPos;
 if(r.flicker>0)r.flicker=Math.max(0,r.flicker-dt);
 if(!s.plane&&r.state==='intact'&&s.clock>=C.introSeconds)launchPlane(s);
 const pl=s.plane;
 if(pl&&!pl.gone){
  pl.x+=pl.vx*dt;pl.y+=pl.vy*dt;
  if(!pl.dropped&&pl.x>=rp.x-150*pl.k){pl.dropped=true;pl.bomb={u:0,fx:pl.x,fy:pl.y};}
  if(pl.bomb&&pl.bomb.u<1){
   pl.bomb.u=Math.min(1,pl.bomb.u+dt/C.bombTime);
   if(pl.bomb.u>=1){ // impact: only the radar is hurt, the minefield is untouched
    r.state='damaged';r.phase='shrink';r.phaseT=0;r.radius=s.rmax;r.hitAt=s.clock;r.regime='low';r.left=0;r.shrinkTo=C.radar.minR+r.rng()*s.rmax*.08;
    addEffect(s,{type:'radarhit',x:rp.x,y:rp.y,life:1.4,max:1.4});
   }
  }
  if(pl.x>pl.endX)pl.gone=true;
 }
 if(r.state!=='damaged')return;
 if(r.phase==='shrink'){
  r.phaseT+=dt;const u=clamp(r.phaseT/C.radar.shrinkTime,0,1),e=u*u*(3-2*u);
  r.radius=lerp(s.rmax,r.shrinkTo,e);
  if(u>=1){r.phase='cycle';r.regime='low';r.left=1.2+r.rng()*1.4;r.target=r.shrinkTo;}
  return;
 }
 r.left-=dt;
 if(r.flickerIn>=0){r.flickerIn-=dt;if(r.flickerIn<0){r.flicker=.12+r.rng()*.1;r.flickerIn=-1;}}
 r.radius+=(r.target-r.radius)*(1-Math.exp(-(r.target>r.radius?7:2)*dt));
 if(r.left<=0)nextRegime(s);
}

/* ───────────── players ───────────── */
function inputVector(input){
 const v=window.PartyCharacters?.control?window.PartyCharacters.control(input||{}):input||{};
 let x=Number(v.x??v.axisX)||(Number(!!v.right)-Number(!!v.left)),y=Number(v.y??v.axisY)||(Number(!!v.down)-Number(!!v.jump));
 const m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}return{x,y};
}
function initialSlots(s,n){
 const R=s.slotRows,col0=s.slots.filter(q=>q.col===0),col1=s.slots.filter(q=>q.col===1),out=[];
 const spread=(arr,count)=>Array.from({length:count},(_,i)=>arr[count===1?Math.floor(arr.length/2):Math.round(i*(arr.length-1)/(count-1))]);
 if(n<=R)return spread(col0,n);
 return[...col0,...spread(col1,n-R)];
}
function setupPlayer(s,p,slot,idx){
 p.active=true;p.x=slot.x;p.y=slot.y;p.vx=0;p.vy=0;p.dir={x:1,y:0};p.face=1;p.score=0;
 const nav=s.nav,bot=p.isBot?{idx,key:(idx+1)*7919,known:new Uint8Array(s.mines.length),visited:new Uint8Array(nav.n),
  D:new Float32Array(nav.n),cost:new Float32Array(nav.n),dirty:true,planned:false,nextPlan:0,perceiveIn:0,events:0,
  memory:.78+hash01(idx,11)*.18,riskMul:[1.5,1.25,1.08][idx%3],speedMul:.88+hash01(idx,5)*.08,caution:.7+hash01(idx,3)*.15,
  ax:1,ay:0,bestD:Infinity,lastGain:0,side:0,sideSign:1}:null;
 p.df={state:'run',respawnLeft:0,invuln:0,px:p.x,py:p.y,homeY:slot.y,best:0,bestRem:s.startDist,bestAt:0,finishedAt:null,deaths:0,bot};
}
function respawn(s,p){
 const d=p.df,others=s.roster.filter(q=>q!==p&&q.df.state==='run');
 const order=[...s.slots].sort((a,b)=>Math.abs(a.y-d.homeY)-Math.abs(b.y-d.homeY));
 const slot=order.find(sl=>others.every(q=>Math.hypot(q.x-sl.x,q.y-sl.y)>30))||order[0];
 p.x=slot.x;p.y=slot.y;p.vx=0;p.vy=0;d.px=p.x;d.py=p.y;d.state='run';d.invuln=C.spawnProtection;
 if(d.bot){d.bot.ax=1;d.bot.ay=0;d.bot.dirty=true;d.bot.bestD=Infinity;d.bot.lastGain=s.clock;}
 addEffect(s,{type:'spawn',x:p.x,y:p.y,life:.6,max:.6,color:p.color});
}
function pushOut(s,p){
 const r=C.radius,f=s.field;
 for(const ob of s.obstacles){
  if(ob.type==='radar'){
   const dx=p.x-ob.x,dy=p.y-ob.y,d=Math.hypot(dx,dy),m=ob.r+r;
   if(d<m){if(d>1e-6){p.x=ob.x+dx/d*m;p.y=ob.y+dy/d*m;}else p.x=ob.x+m;}
  }else{
   const cx=clamp(p.x,ob.x-ob.hw,ob.x+ob.hw),cy=clamp(p.y,ob.y-ob.hh,ob.y+ob.hh),dx=p.x-cx,dy=p.y-cy,d=Math.hypot(dx,dy);
   if(d<r){
    if(d>1e-6){p.x=cx+dx/d*r;p.y=cy+dy/d*r;}
    else{const ox=ob.hw+r-Math.abs(p.x-ob.x),oy=ob.hh+r-Math.abs(p.y-ob.y);
     if(ox<oy)p.x+=p.x<ob.x?-ox:ox;else p.y+=p.y<ob.y?-oy:oy;}
   }
  }
 }
 p.x=clamp(p.x,f.x+r,f.x+f.w-r);p.y=clamp(p.y,f.y+r,f.y+f.h-r);
}
function mineHit(s,x0,y0,x1,y1){
 const g=s.mineGrid,R=C.hazard,dx=x1-x0,dy=y1-y0,l2=dx*dx+dy*dy;
 const cx0=clamp(Math.floor((Math.min(x0,x1)-R)/g.cs),0,g.gx-1),cx1=clamp(Math.floor((Math.max(x0,x1)+R)/g.cs),0,g.gx-1);
 const cy0=clamp(Math.floor((Math.min(y0,y1)-R)/g.cs),0,g.gy-1),cy1=clamp(Math.floor((Math.max(y0,y1)+R)/g.cs),0,g.gy-1);
 let hit=null,ht=Infinity;
 for(let cy=cy0;cy<=cy1;cy++)for(let cx=cx0;cx<=cx1;cx++)for(const m of g.cells[cy*g.gx+cx]){
  if(!m.alive)continue;
  const t=l2>1e-9?clamp(((m.x-x0)*dx+(m.y-y0)*dy)/l2,0,1):0;
  if(Math.hypot(m.x-(x0+dx*t),m.y-(y0+dy*t))<R&&t<ht){ht=t;hit=m;}
 }
 return hit;
}
function explode(s,m,victims){
 m.alive=false;s.burns.push({x:m.x,y:m.y,r:13+m.seed*5,a:m.seed*TAU});
 addEffect(s,{type:'boom',x:m.x,y:m.y,life:.9,max:.9,seed:m.seed});
 for(const p of victims){
  const d=p.df;d.state='dead';d.respawnLeft=C.respawnDelay;d.deaths++;p.vx=0;p.vy=0;
  if(d.bot){ // the blast teaches the bot about the surrounding field it already half-remembers
   for(const q of s.mines)if(q.alive&&Math.hypot(q.x-m.x,q.y-m.y)<85)d.bot.known[q.id]=1;
   d.bot.dirty=true;
  }
 }
}

/* ───────────── bot perception + planning ───────────── */
function perceive(s,p){
 const b=p.df.bot,late=s.radar.state!=='intact';
 for(const m of s.mines){
  if(!m.alive||b.known[m.id]===1||mineAlpha(s,m)<.55)continue;
  if(hash01(b.key,m.id)<(late?.97:b.memory)){b.known[m.id]=1;b.dirty=true;}
 }
 if(b.events!==s.navEvent){b.events=s.navEvent;b.dirty=true;}
}
function planBot(s,p){
 const b=p.df.bot,nav=s.nav,blocked=s.navBase.slice();
 // Belief only: mines this bot has seen and that still exist. Hidden ground-truth mines are never read here.
 for(const m of s.mines)if(m.alive&&b.known[m.id]===1)stampCircle(nav,blocked,m.x,m.y,C.navR);
 for(let i=0;i<nav.n;i++)b.cost[i]=b.visited[i]?1:b.riskMul;
 dijkstra(nav,blocked,b.cost,s.goalSeeds,b.D);b.planned=true;b.bestD=Infinity;
}
function botControl(s,p,dt){
 const b=p.df.bot,nav=s.nav;
 b.perceiveIn-=dt;
 if(b.perceiveIn<=0){b.perceiveIn=.1+(b.idx%4)*.01;perceive(s,p);}
 if(b.dirty&&s.clock>=b.nextPlan){planBot(s,p);b.dirty=false;b.nextPlan=s.clock+.45+(b.idx%6)*.05;}
 if(!b.planned)return{x:0,y:0,slow:1};
 let c=cellOf(nav,p.x,p.y);
 for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
  const i=c%nav.cols+di,j=((c/nav.cols)|0)+dj;if(i>=0&&j>=0&&i<nav.cols&&j<nav.rows)b.visited[j*nav.cols+i]=1;
 }
 const D=b.D;
 if(!isFinite(D[c])){c=nearestFinite(nav,D,c,6);if(c<0)return{x:1,y:0,slow:.6};}
 if(D[c]<b.bestD-6){b.bestD=D[c];b.lastGain=s.clock;}
 let t=c;for(let k=0;k<4;k++){const n=bestNeighbor(nav,D,t);if(n<0)break;t=n;}
 const tx=cellX(nav,t),ty=cellY(nav,t);
 let dx=tx-p.x,dy=ty-p.y;const m=Math.hypot(dx,dy);
 if(m<2){dx=1;dy=0;}else{dx/=m;dy/=m;}
 if(s.clock-b.lastGain>2.4){b.side=.8;b.sideSign=Math.floor(s.clock*3+b.idx)%2?1:-1;b.lastGain=s.clock;}
 if(b.side>0){b.side-=dt;const px=-dy*b.sideSign,py=dx*b.sideSign;dx+=px*.9;dy+=py*.9;const q=Math.hypot(dx,dy)||1;dx/=q;dy/=q;}
 const a=1-Math.exp(-10*dt);b.ax+=(dx-b.ax)*a;b.ay+=(dy-b.ay)*a;
 // Walk carefully where nothing is verified (no breadcrumb and no radar coverage).
 return{x:b.ax,y:b.ay,slow:(!b.visited[t]&&!covers(s,tx,ty))?b.caution:1};
}

/* ───────────── ranking ───────────── */
function rankAll(s){
 const rows=s.roster.map(p=>({id:p.id,fin:p.df.finishedAt,progress:p.df.best,rem:p.df.bestRem,at:p.df.bestAt}));
 const cmp=(a,b)=>{ // <0 ⇒ a better. No id/name tie-break: identical results share a rank.
  if((a.fin!=null)!==(b.fin!=null))return a.fin!=null?-1:1;
  if(a.fin!=null&&Math.abs(a.fin-b.fin)>1e-9)return a.fin-b.fin;
  if(Math.abs(a.progress-b.progress)>1e-9)return b.progress-a.progress;
  if(Math.abs(a.rem-b.rem)>1e-6)return a.rem-b.rem;
  if(Math.abs(a.at-b.at)>1e-9)return a.at-b.at;return 0;};
 rows.forEach(r=>{r.rank=1+rows.filter(q=>cmp(q,r)<0).length;});
 return rows.sort((a,b)=>a.rank-b.rank);
}
function finish(s,round,winner){
 if(s.finished)return;
 s.finished=true;round.remaining=0;s.remaining=0;
 if(winner){winner.df.finishedAt=s.clock;winner.df.best=1;winner.df.bestRem=0;winner.df.bestAt=s.clock;winner.score=100;}
 s.ranking=rankAll(s);
 s.winnerIds=s.ranking.filter(r=>r.rank===1).map(r=>r.id);
 s.plane=null;s.effects.length=0; // timers/animations stop with the round
}

/* ───────────── simulation ───────────── */
function step(dt,round,ps){
 const s=round.dangerField;if(!s||s.finished)return;
 s.tick++;s.clock+=dt;s.remaining=Math.max(0,s.duration-s.clock);
 stepRadar(s,dt);
 const live=[];
 for(const p of s.roster){
  const d=p.df;
  if(d.state==='dead'){d.respawnLeft-=dt;if(d.respawnLeft<=0)respawn(s,p);continue;}
  d.invuln=Math.max(0,d.invuln-dt);d.px=p.x;d.py=p.y;
  const ctrl=p.isBot?botControl(s,p,dt):inputVector(p.input),m=Math.hypot(ctrl.x,ctrl.y);
  const sp=C.speed*(p.isBot?C.botSpeed*d.bot.speedMul:1)*(ctrl.slow||1);
  p.vx=ctrl.x*sp;p.vy=ctrl.y*sp;p.x+=p.vx*dt;p.y+=p.vy*dt;
  if(m>.1){p.dir={x:ctrl.x/m,y:ctrl.y/m};p.face=p.dir.x<0?-1:1;}
  pushOut(s,p);live.push(p);
 }
 // Players that just respawned pass through others for a moment; mines still kill them.
 const solid=live.filter(p=>p.df.invuln<=0);
 if(solid.length>1){
  if(window.PartyCharacters?.resolve)window.PartyCharacters.resolve(solid,{radius:C.radius,iterations:3,maxShift:5,bounds:s.field});
  else for(let i=0;i<solid.length;i++)for(let j=i+1;j<solid.length;j++){
   const a=solid[i],b=solid[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.001;
   if(d<2*C.radius){const t=(2*C.radius-d)/2;a.x-=dx/d*t;a.y-=dy/d*t;b.x+=dx/d*t;b.y+=dy/d*t;}
  }
  for(const p of solid)pushOut(s,p);
 }
 // Two-phase mine resolution: every walker is tested against the pre-blast field, then all blasts apply.
 const blasts=new Map();
 for(const p of live){
  p.vx=(p.x-p.df.px)/dt;p.vy=(p.y-p.df.py)/dt;
  const m=mineHit(s,p.df.px,p.df.py,p.x,p.y);
  if(m){if(!blasts.has(m))blasts.set(m,[]);blasts.get(m).push(p);}
 }
 if(blasts.size){for(const [m,v] of blasts)explode(s,m,v);s.navEvent++;refreshLive(s);}
 // Finish and best progress.
 let winner=null,deep=-Infinity;
 for(const p of live){
  const d=p.df;if(d.state!=='run')continue;
  if(p.x>=s.finishX+4&&p.x>deep){deep=p.x;winner=p;}
 }
 if(winner){finish(s,round,winner);return;}
 if(s.tick%3===0)for(const p of live){
  const d=p.df;if(d.state!=='run')continue;
  const rem=remainingAt(s,p.x,p.y);if(!isFinite(rem))continue;
  const prog=clamp(1-rem/s.startDist,0,1);
  if(prog>d.best+1e-6){d.best=prog;d.bestRem=rem;d.bestAt=s.clock;p.score=Math.round(prog*100);}
 }
 for(let i=s.effects.length-1;i>=0;i--){s.effects[i].life-=dt;if(s.effects[i].life<=0)s.effects.splice(i,1);}
 round.remaining=s.remaining;
 if(s.remaining<=1e-9)finish(s,round,null);
}
function setup(round,players){
 window.PartyCharacters?.activate?.(players);
 const ps=active(players);
 if(ps.length<1||ps.length>12)throw Error('DANGERFIELD supports 1–12 players');
 const sizeClass=ps.length<=6?'small':'large',cfg=C[sizeClass];
 const seed=(Number(round.dangerSeed)||(Date.now()^0x5d17f1e3))>>>0||1;
 const s={sizeClass,cfg,w:cfg.w,h:cfg.h,field:cfg.field,zone:cfg.zone,finishX:cfg.field.x+cfg.field.w-cfg.zone,
  duration:cfg.duration,remaining:cfg.duration,clock:0,tick:0,accumulator:0,finished:false,seed,
  roster:ps,mines:[],obstacles:[],burns:[],effects:[],ranking:[],winnerIds:[],navEvent:0,plane:null};
 buildWorld(s);initRadar(s);
 const slots=initialSlots(s,ps.length);
 ps.forEach((p,i)=>setupPlayer(s,p,slots[i],i));
 round.dangerField=s;round.remaining=s.duration;
 return s;
}
function update(dt,round,ps){
 const s=round.dangerField;if(!s)return null;
 if(s.finished)return'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.25,s.accumulator+clamp(Number(dt)||0,0,.25));
 let cycles=0;
 while(s.accumulator+1e-9>=STEP&&cycles++<15&&!s.finished){step(STEP,round,ps);s.accumulator-=STEP;}
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.dangerField;
 return{survivors:active(ps).length,remaining:round.remaining,elapsed:s?.clock||0,winnerIds:s?.winnerIds||[],radar:s?.radar.state};
}

/* ───────────── art (SVG → cached Image) ───────────── */
const ART=Object.create(null);
function art(key,build){
 if(ART[key])return ART[key];
 if(typeof Image==='undefined')return null;
 const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(build());
 return ART[key]=img;
}
const ready=i=>i&&i.complete&&i.naturalWidth>0;
function mineSVG(){return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="88" height="88"><ellipse cx="23" cy="26" rx="19" ry="17" fill="#00000044"/><circle cx="22" cy="21" r="19" fill="#5f7428" stroke="#35441a" stroke-width="3"/><circle cx="22" cy="21" r="15" fill="#8aa23c" stroke="#4a5d20" stroke-width="1.5"/><circle cx="22" cy="21" r="10.5" fill="#d8352a" stroke="#ffd29a" stroke-width="1.6"/><circle cx="22" cy="19.5" r="4.4" fill="#ffeed8"/><rect x="19.4" y="22" width="5.2" height="4" rx="1" fill="#ffeed8"/><circle cx="20.2" cy="19.4" r="1.2" fill="#6b1a14"/><circle cx="23.8" cy="19.4" r="1.2" fill="#6b1a14"/><path d="M9 11q4-5 9-6" stroke="#ffffff66" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;}
function planeSVG(){return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 110" width="320" height="220"><path d="M62 55L22 8l16-2 52 36z M62 55L22 102l16 2 52-36z" fill="#4e5a3a" stroke="#2b331f" stroke-width="3" stroke-linejoin="round"/><path d="M26 44L8 30l-2 8 14 14z M26 66L8 80l-2-8 14-14z" fill="#586646" stroke="#2b331f" stroke-width="2.5"/><path d="M12 48h96q30 2 42 7-12 5-42 7H12q-6-7 0-14z" fill="#6c7b52" stroke="#2b331f" stroke-width="3" stroke-linejoin="round"/><ellipse cx="110" cy="55" rx="14" ry="5.5" fill="#9fd4e8" stroke="#2b331f" stroke-width="2"/><rect x="48" y="30" width="9" height="14" rx="3" fill="#3a4429"/><rect x="48" y="66" width="9" height="14" rx="3" fill="#3a4429"/><circle cx="70" cy="55" r="4" fill="#d8352a"/><path d="M80 50h18M80 60h18" stroke="#ffffff55" stroke-width="2"/></svg>`;}
function arenaSVG(s){
 const w=s.w,h=s.h,f=s.field,Z=s.zone,k=w/960,fx=f.x,fy=f.y,fw=f.w,fh=f.h;
 const inField=(x,y,pad)=>x>fx-pad&&x<fx+fw+pad&&y>fy-pad&&y<fy+fh+pad;
 let o=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>
<linearGradient id="df-grass" x2=".3" y2="1"><stop stop-color="#7fa84a"/><stop offset="1" stop-color="#5f8f3d"/></linearGradient>
<radialGradient id="df-dirt" cx=".5" cy=".45" r=".75"><stop stop-color="#b98a58"/><stop offset="1" stop-color="#a1733f"/></radialGradient>
<linearGradient id="df-sand" x2="1"><stop stop-color="#d9b77d"/><stop offset="1" stop-color="#cba56a"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#df-grass)"/>`;
 for(let i=0;i<90;i++){const x=hash01(i,1)*w,y=hash01(i,2)*h;if(inField(x,y,14))continue;
  o+=`<path d="M${x} ${y}l-3-8 3 4 2-7 2 7 3-4-3 8z" fill="#4c7a2f" opacity=".55"/>`;}
 const palm=(x,y,sc)=>{let q=`<g transform="translate(${x} ${y}) scale(${sc})"><circle r="30" fill="#00000026" transform="translate(7 9)"/>`;
  for(let a=0;a<8;a++)q+=`<ellipse cx="0" cy="-22" rx="7" ry="24" fill="${a%2?'#3f8a3a':'#2f7a30'}" stroke="#1f5a22" stroke-width="1.5" transform="rotate(${a*45})"/>`;
  return q+`<circle r="6" fill="#6b4a2a"/></g>`;};
 for(const [x,y] of[[fx-30*k,fy-4],[w-fx+30*k,fy+6],[fx-26*k,fy+fh+6],[w-fx+28*k,fy+fh-4]])o+=palm(x,y,1.05*k);
 // Left wreck + shells + sign, right drum + barrels (all outside the field, no collision).
 const ly=h/2+90*k;
 o+=`<g transform="translate(${fx*.5} ${ly}) scale(${k})"><rect x="-34" y="-24" width="68" height="48" rx="8" fill="#a83b30" stroke="#5e1f1a" stroke-width="3"/><circle r="15" fill="#555d61" stroke="#2c3134" stroke-width="3"/><rect x="0" y="-5" width="34" height="10" rx="3" fill="#6b7377" stroke="#2c3134" stroke-width="2"/><rect x="-40" y="-26" width="9" height="52" rx="3" fill="#3b3f3a"/><rect x="31" y="-26" width="9" height="52" rx="3" fill="#3b3f3a"/></g>`;
 o+=`<g transform="translate(${fx*.5} ${h/2-110*k}) rotate(-14) scale(${k})"><rect x="-17" y="-17" width="34" height="34" rx="3" fill="#f4c53a" stroke="#3b2f10" stroke-width="2.5" transform="rotate(45)"/><circle cy="-3" r="5" fill="#222"/><rect x="-5" y="3" width="10" height="4" fill="#222"/></g>`;
 for(let i=0;i<2;i++)o+=`<rect x="${fx*.5-20*k+i*18*k}" y="${h/2-60*k}" width="${10*k}" height="${28*k}" rx="${5*k}" fill="#e2b04a" stroke="#7a5a1c" stroke-width="2"/>`;
 const rx=w-fx*.5;
 o+=`<g transform="translate(${rx} ${h/2+20*k}) scale(${k})"><ellipse rx="40" ry="46" fill="#e98a1f" stroke="#7a3d0a" stroke-width="3"/><circle r="12" fill="#3b2a12"/><path d="M0 0l-14-20a24 24 0 0 1 28 0z M0 0l14 20a24 24 0 0 1-28 0z" fill="#3b2a12" opacity=".85"/><circle r="4" fill="#f6c25c"/></g>`;
 for(const [bx,by] of[[rx-6*k,fy+70*k],[rx+4*k,h-fy-60*k],[fx*.5+4*k,fy+36*k],[fx*.5-8*k,h-fy-40*k]])
  o+=`<g transform="translate(${bx} ${by}) scale(${k})"><rect x="-17" y="-17" width="34" height="34" rx="3" fill="#d9732a" stroke="#6d3512" stroke-width="2.5"/><path d="M-14 -14l28 28M14 -14l-28 28" stroke="#8c4617" stroke-width="3"/></g>`;
 // Playfield
 o+=`<rect x="${fx-10}" y="${fy-10}" width="${fw+20}" height="${fh+20}" rx="12" fill="#6f4727" stroke="#3f2713" stroke-width="3"/>
<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="6" fill="url(#df-dirt)"/>`;
 for(let i=0;i<26;i++){const x=fx+Z+hash01(i,7)*(fw-2*Z),y=fy+hash01(i,8)*fh;
  o+=`<ellipse cx="${x}" cy="${y}" rx="${14+hash01(i,9)*28}" ry="${8+hash01(i,10)*16}" fill="#7c5330" opacity=".16"/>`;}
 for(let r=0;r<3;r++){const y=fy+fh*(.25+r*.25);o+=`<path d="M${fx+Z} ${y}q${(fw-2*Z)/4} ${r%2?-18:18} ${(fw-2*Z)/2} 0t${(fw-2*Z)/2} 0" stroke="#8e633a" stroke-width="5" fill="none" opacity=".16" stroke-dasharray="14 10"/>`;}
 o+=`<rect x="${fx}" y="${fy}" width="${Z}" height="${fh}" rx="6" fill="url(#df-sand)" opacity=".92"/>
<rect x="${fx+fw-Z}" y="${fy}" width="${Z}" height="${fh}" rx="6" fill="url(#df-sand)" opacity=".92"/>
<path d="M${fx+Z} ${fy+4}V${fy+fh-4}" stroke="#8a6232" stroke-width="3" stroke-dasharray="10 8" opacity=".6"/>
<path d="M${fx+fw-Z} ${fy+4}V${fy+fh-4}" stroke="#8a6232" stroke-width="3" stroke-dasharray="10 8" opacity=".6"/>`;
 const cx=fx+fw-Z/2,cy=fy+fh/2,xs=Math.min(46,Z*.42);
 o+=`<path d="M${cx-xs} ${cy-xs}L${cx+xs} ${cy+xs}M${cx+xs} ${cy-xs}L${cx-xs} ${cy+xs}" stroke="#d8452f" stroke-width="11" stroke-linecap="round" opacity=".92"/>`;
 for(let i=0;i<4;i++)o+=`<path d="M${fx+26} ${fy+fh/2-60+i*40}l16 10-16 10" stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".45"/>`;
 // Barbed wire along the top/bottom border (decor only).
 for(const y of[fy-3,fy+fh+3]){let d=`M${fx} ${y}`;for(let x=fx;x<fx+fw;x+=18)d+=`q9 -7 18 0`;o+=`<path d="${d}" stroke="#d6dde2" stroke-width="1.6" fill="none" opacity=".75"/>`;}
 for(let x=fx;x<=fx+fw;x+=54)for(const y of[fy-12,fy+fh+2])o+=`<rect x="${x-3}" y="${y}" width="6" height="12" rx="2" fill="#4a2f18"/>`;
 return o+`</svg>`;
}

/* ───────────── drawing ───────────── */
function drawArena(g,s){
 const img=art('arena-'+s.sizeClass,()=>arenaSVG(s)),f=s.field;
 if(ready(img))g.drawImage(img,0,0,s.w,s.h);
 else{g.fillStyle='#6f9c46';g.fillRect(0,0,s.w,s.h);g.fillStyle='#a8774a';g.fillRect(f.x,f.y,f.w,f.h);
  g.fillStyle='#d4b077';g.fillRect(f.x,f.y,s.zone,f.h);g.fillRect(s.finishX,f.y,s.zone,f.h);}
}
function drawCrate(g,ob){
 g.save();g.translate(ob.x,ob.y);g.fillStyle='#00000030';g.fillRect(-ob.hw+4,-ob.hh+5,ob.hw*2,ob.hh*2);
 g.fillStyle='#d9732a';g.strokeStyle='#5d4a3a';g.lineWidth=3;g.beginPath();g.roundRect(-ob.hw,-ob.hh,ob.hw*2,ob.hh*2,3);g.fill();g.stroke();
 g.fillStyle='#e9e6dd';g.fillRect(-ob.hw+3,-ob.hh+3,ob.hw*2-6,ob.hh*2-6);
 g.fillStyle='#e58a35';g.fillRect(-ob.hw+5,-ob.hh+5,ob.hw*2-10,ob.hh*2-10);
 g.fillStyle='#fff3cf';g.beginPath();
 for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?5:11;g.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
 g.closePath();g.fill();g.restore();
}
function drawRadar(g,s,t){
 const r=s.radar,rp=s.radarPos,f=s.field,R=visRadius(s),full=R===Infinity||R>s.rmax*.98,Rd=full?s.rmax:Math.max(8,R);
 const dmg=r.state==='damaged',pulse=dmg?(r.flicker>0?.35:.8+.2*Math.sin(t*23)):1;
 g.save();g.beginPath();g.rect(f.x,f.y,f.w,f.h);g.clip();
 const gr=g.createRadialGradient(rp.x,rp.y,Rd*.12,rp.x,rp.y,Rd);
 gr.addColorStop(0,'rgba(90,255,140,.04)');gr.addColorStop(.85,'rgba(90,255,140,.08)');gr.addColorStop(1,'rgba(130,255,180,'+(.22*pulse)+')');
 g.fillStyle=gr;g.beginPath();g.arc(rp.x,rp.y,Rd,0,TAU);g.fill();
 g.strokeStyle='rgba(150,255,190,'+(.5*pulse)+')';g.lineWidth=2;g.setLineDash([10,7]);g.beginPath();g.arc(rp.x,rp.y,Rd,0,TAU);g.stroke();g.setLineDash([]);
 const a=t*2.2;g.fillStyle='rgba(120,255,160,'+(.16*pulse)+')';g.beginPath();g.moveTo(rp.x,rp.y);g.arc(rp.x,rp.y,Rd,a-.55,a);g.closePath();g.fill();
 g.restore();
}
function drawRadarBody(g,s,t){
 const rp=s.radarPos,R=C.radar.bodyR,dmg=s.radar.state==='damaged';
 g.save();g.translate(rp.x,rp.y);
 g.fillStyle='#00000040';g.beginPath();g.ellipse(6,9,R,R*.92,0,0,TAU);g.fill();
 const gr=g.createRadialGradient(-10,-12,4,0,0,R);gr.addColorStop(0,'#8a9094');gr.addColorStop(.55,'#4b5256');gr.addColorStop(1,'#2a3033');
 g.fillStyle=gr;g.strokeStyle='#1c2124';g.lineWidth=3;g.beginPath();g.arc(0,0,R,0,TAU);g.fill();g.stroke();
 g.strokeStyle='#3b4246';g.lineWidth=2;g.beginPath();g.arc(0,0,R*.62,.3,2.6);g.stroke();
 const blink=dmg?(Math.sin(t*19)>0?1:.15):1;
 g.fillStyle=dmg?'rgba(255,80,60,'+blink+')':'rgba(110,255,150,'+(.6+.4*Math.sin(t*4))+')';
 g.beginPath();g.arc(8,10,5,0,TAU);g.fill();
 g.strokeStyle='rgba(130,255,170,.85)';g.lineWidth=2;
 for(let i=0;i<3;i++){g.beginPath();g.arc(0,R*.1,9+i*7,-2.3,-.85);g.stroke();}
 if(dmg){ // crack, sparks and smoke
  g.strokeStyle='#14181a';g.lineWidth=2.5;g.beginPath();g.moveTo(-R*.7,-R*.1);g.lineTo(-R*.2,R*.05);g.lineTo(-R*.05,R*.5);g.stroke();
  for(let i=0;i<4;i++){const ph=Math.sin(t*14+i*2.1);if(ph<.25)continue;
   g.strokeStyle='#ffd45a';g.lineWidth=2;const a=i*1.7+Math.floor(t*9)*.8;
   g.beginPath();g.moveTo(Math.cos(a)*R*.4,Math.sin(a)*R*.4);g.lineTo(Math.cos(a)*R*(.75+.25*ph),Math.sin(a)*R*(.75+.25*ph));g.stroke();}
  for(let i=0;i<4;i++){const u=((t*.5+i*.25)%1);g.fillStyle='rgba(60,60,64,'+(.4*(1-u))+')';g.beginPath();g.arc(-6+Math.sin(i*3+t)*7,-14-u*40,7+u*12,0,TAU);g.fill();}
 }
 g.restore();
}
function drawEffects(g,s){
 for(const e of s.effects){
  const u=1-e.life/e.max;g.save();
  if(e.type==='boom'){
   g.globalAlpha=clamp(1-u,0,1);
   const gr=g.createRadialGradient(e.x,e.y,0,e.x,e.y,18+u*34);gr.addColorStop(0,'#fff4b0');gr.addColorStop(.4,'#ff9a2e');gr.addColorStop(1,'rgba(200,50,20,0)');
   g.fillStyle=gr;g.beginPath();g.arc(e.x,e.y,18+u*34,0,TAU);g.fill();
   for(let i=0;i<6;i++){const a=i*1.05+e.seed*6,d=10+u*30;g.fillStyle='rgba(70,60,55,'+(.55*(1-u))+')';g.beginPath();g.arc(e.x+Math.cos(a)*d,e.y+Math.sin(a)*d-u*14,6+u*9,0,TAU);g.fill();}
  }else if(e.type==='radarhit'){
   g.globalAlpha=clamp(1-u,0,1);
   const gr=g.createRadialGradient(e.x,e.y,0,e.x,e.y,40+u*110);gr.addColorStop(0,'#fff8c0');gr.addColorStop(.3,'#ffa83a');gr.addColorStop(1,'rgba(120,70,40,0)');
   g.fillStyle=gr;g.beginPath();g.arc(e.x,e.y,40+u*110,0,TAU);g.fill();
   g.strokeStyle='rgba(255,230,180,'+(.7*(1-u))+')';g.lineWidth=5;g.beginPath();g.arc(e.x,e.y,20+u*150,0,TAU);g.stroke();
   for(let i=0;i<9;i++){const a=i*.7,d=30+u*70;g.fillStyle='rgba(90,84,80,'+(.5*(1-u))+')';g.beginPath();g.arc(e.x+Math.cos(a)*d,e.y+Math.sin(a)*d,9+u*16,0,TAU);g.fill();}
  }else if(e.type==='spawn'){
   g.globalAlpha=clamp(1-u,0,1);g.strokeStyle=e.color||'#fff';g.lineWidth=3;g.beginPath();g.arc(e.x,e.y,10+u*26,0,TAU);g.stroke();
  }
  g.restore();
 }
}
function drawPlane(g,s){
 const pl=s.plane;if(!pl||pl.gone)return;
 const img=art('plane',planeSVG),k=pl.k;
 g.save();g.translate(pl.x+26*k,pl.y+44*k);g.rotate(pl.ang);g.globalAlpha=.22;g.fillStyle='#000';g.beginPath();g.ellipse(0,0,56*k,22*k,0,0,TAU);g.fill();g.restore();
 if(pl.bomb&&pl.bomb.u<1){
  const u=pl.bomb.u,rp=s.radarPos,e=u*u,x=lerp(pl.bomb.fx,rp.x,e),y=lerp(pl.bomb.fy,rp.y,e),sc=lerp(1.25,.8,u);
  g.save();g.translate(x,y);g.rotate(Math.atan2(rp.y-pl.bomb.fy,rp.x-pl.bomb.fx)+u*.5);g.scale(sc,sc);
  g.fillStyle='#2d3236';g.strokeStyle='#111';g.lineWidth=2;g.beginPath();g.ellipse(0,0,13,7,0,0,TAU);g.fill();g.stroke();
  g.fillStyle='#d8352a';g.fillRect(-18,-6,6,12);g.restore();
 }
 g.save();g.translate(pl.x,pl.y);g.rotate(pl.ang);
 if(ready(img))g.drawImage(img,-80*k,-55*k,160*k,110*k);
 else{g.fillStyle='#4e5a3a';g.fillRect(-60*k,-8*k,120*k,16*k);g.fillRect(-14*k,-50*k,28*k,100*k);}
 g.restore();
}
function draw(g,time,round,ps){
 const s=round.dangerField;if(!s)return;
 g.save();g.scale(960/s.w,540/s.h);
 drawArena(g,s);
 for(const b of s.burns){g.fillStyle='rgba(30,20,14,.45)';g.beginPath();g.ellipse(b.x,b.y,b.r,b.r*.8,b.a,0,TAU);g.fill();
  g.fillStyle='rgba(20,12,8,.5)';g.beginPath();g.ellipse(b.x,b.y,b.r*.55,b.r*.45,b.a,0,TAU);g.fill();}
 for(const ob of s.obstacles)if(ob.type==='crate')drawCrate(g,ob);
 drawRadar(g,s,s.clock);
 // Visibility is a drawing concern only; physics keeps every live mine.
 const sprite=art('mine',mineSVG),size=(C.mineR+2)*2;
 for(const m of s.mines){
  if(!m.alive)continue;const a=mineAlpha(s,m);if(a<.02)continue;
  g.globalAlpha=a;
  if(ready(sprite))g.drawImage(sprite,m.x-size/2,m.y-size/2,size,size);
  else{g.fillStyle='#7a9030';g.beginPath();g.arc(m.x,m.y,C.mineR,0,TAU);g.fill();g.fillStyle='#d8352a';g.beginPath();g.arc(m.x,m.y,C.mineR*.55,0,TAU);g.fill();}
 }
 g.globalAlpha=1;
 drawRadarBody(g,s,s.clock);
 const walkers=s.roster.filter(p=>p.df.state==='run').sort((a,b)=>a.y-b.y);
 for(const p of walkers){
  g.save();if(p.df.invuln>0)g.globalAlpha=.55+.3*Math.sin(s.clock*26);
  if(window.PartyCharacters?.draw)window.PartyCharacters.draw(g,p,{time:s.clock,label:false});
  else{g.fillStyle=p.color||'#f5c87a';g.beginPath();g.arc(p.x,p.y,C.radius,0,TAU);g.fill();}
  g.restore();
 }
 drawEffects(g,s);
 drawPlane(g,s);
 g.restore();
}

/* ───────────── results / roster / controller ───────────── */
function getResult(round,players){
 const s=round.dangerField,list=s?(s.ranking.length?s.ranking:rankAll(s)):[],by=new Map(list.map(r=>[r.id,r]));
 return players.filter(p=>p.active).map(p=>{
  const r=by.get(p.id),rank=r?.rank||players.length,pct=Math.round((p.df?.best||0)*100);
  return{id:p.id,value:-rank,label:p.df?.finishedAt!=null?'ถึงเส้นชัย':pct+'%'};
 });
}
function renderRoster(root,activePlayers,round){
 const s=round.dangerField,order=new Map((s?rankAll(s):[]).map(r=>[r.id,r.rank]));
 [...activePlayers].sort((a,b)=>(order.get(a.id)||99)-(order.get(b.id)||99)).forEach(p=>{
  const box=document.createElement('div');box.className='leader-chip';
  const dot=document.createElement('span');dot.className='circle';dot.style.background=p.color;
  const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;
  const role=document.createElement('small');role.className='leader-role';
  role.textContent=p.df?.finishedAt!=null?'ถึงเส้นชัย':Math.round((p.df?.best||0)*100)+'%';
  const info=document.createElement('span');info.className='leader-item-slot';info.textContent=p.df?.state==='dead'?'ระเบิด!':' ';
  box.append(dot,name,role,info);root.append(box);
 });
}
function getControllerPacket(p,round){
 const s=round.dangerField,d=p.df||{};
 return{t:'dangerfield-status',mode:round.mode,status:d.state||'run',progress:Math.round((d.best||0)*100),
  deaths:d.deaths||0,radar:s?.radar.state||'intact'};
}
window.DangerField=Object.freeze({getControllerPacket,renderRoster,getResult,resultTitle:'ผู้ข้ามสนามระเบิดคนแรก!',countdownSeconds:3,
 setup,update,draw,hud,step,finish,generate,analyse,dijkstra,mineHit,mineAlpha,visRadius,rankAll,remainingAt,config:C});
})();
