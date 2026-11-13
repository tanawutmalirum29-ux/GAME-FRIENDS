/* DINO PANIC — track generation by chunks. Every chunk is checked with a real shortest-path pass
   (body radius + clearance) before it is accepted, so the route always exists and the best possible
   route never costs more time than the dinosaur's head start can absorb. */
import {C,clamp,mkRng,Heap,NB,NBX,NBY,NBL} from './config.js';
const PO=[];                                   // scratch list for pushOut (no per-call array)
let _b=new Uint8Array(8192),_d=new Float64Array(8192);const _h=new Heap();  // reusable validator buffers
const PAD=26,BUCKET=128;

// Exact surface contact for circular runners against a possibly rotated log/crate.
// gap is signed: positive outside, negative when the runner's centre is inside.
export function obstacleContact(o,x,y){
 const dx=x-o.x,dy=y-o.y;
 if(o.shape==='circle'){
  const d=Math.hypot(dx,dy),nx=d>1e-8?dx/d:-1,ny=d>1e-8?dy/d:0;
  return{nx,ny,gap:d-o.r,cx:o.x+nx*o.r,cy:o.y+ny*o.r};
 }
 const a=o.angle||0,cs=Math.cos(a),sn=Math.sin(a);
 const lx=dx*cs+dy*sn,ly=dy*cs-dx*sn;
 let px=clamp(lx,-o.hw,o.hw),py=clamp(ly,-o.hh,o.hh);
 let ux=lx-px,uy=ly-py,gap=Math.hypot(ux,uy);
 if(gap>1e-8){ux/=gap;uy/=gap;}
 else{
  // Inside a rectangle: choose its nearest outward face, not a zero normal.
  const ex=o.hw-Math.abs(lx),ey=o.hh-Math.abs(ly);
  if(ex<ey){ux=lx>=0?1:-1;uy=0;px=ux*o.hw;py=ly;gap=-ex;}
  else{ux=0;uy=ly>=0?1:-1;px=lx;py=uy*o.hh;gap=-ey;}
 }
 return{nx:cs*ux-sn*uy,ny:sn*ux+cs*uy,gap,
  cx:o.x+cs*px-sn*py,cy:o.y+sn*px+cs*py};
}
const xExtent=(o,a=o.angle||0)=>o.shape==='circle'?o.r:Math.abs(Math.cos(a))*o.hw+Math.abs(Math.sin(a))*o.hh;
const yExtent=(o,a=o.angle||0)=>o.shape==='circle'?o.r:Math.abs(Math.sin(a))*o.hw+Math.abs(Math.cos(a))*o.hh;
// Conservative X indexing means that rotation never leaves the obstacle's collider
// outside the bucket map. Fences do not rotate.
const indexRadius=o=>o.shape==='circle'?o.r:o.kind==='fence'?o.hw:Math.hypot(o.hw,o.hh);
function intersects(a,ax,ay,aa,b,bx,by,ba,pad=1){
 if(a.shape==='circle'&&b.shape==='circle')return Math.hypot(ax-bx,ay-by)<a.r+b.r+pad;
 const circleRect=(c,cx,cy,r,rx,ry,ra)=>{
  const dx=cx-rx,dy=cy-ry,cs=Math.cos(ra),sn=Math.sin(ra),
   lx=dx*cs+dy*sn,ly=dy*cs-dx*sn,
   nx=clamp(lx,-r.hw,r.hw),ny=clamp(ly,-r.hh,r.hh);
  return(lx-nx)**2+(ly-ny)**2<(c.r+pad)**2;
 };
 if(a.shape==='circle')return circleRect(a,ax,ay,b,bx,by,ba);
 if(b.shape==='circle')return circleRect(b,bx,by,a,ax,ay,aa);
 const ac=Math.cos(aa),as=Math.sin(aa),bc=Math.cos(ba),bs=Math.sin(ba),dx=bx-ax,dy=by-ay;
 const axes=[[ac,as],[-as,ac],[bc,bs],[-bs,bc]];
 for(const [ux,uy] of axes){
  const ad=Math.abs(ux*ac+uy*as)*a.hw+Math.abs(-ux*as+uy*ac)*a.hh;
  const bd=Math.abs(ux*bc+uy*bs)*b.hw+Math.abs(-ux*bs+uy*bc)*b.hh;
  if(Math.abs(dx*ux+dy*uy)>=ad+bd+pad)return false;
 }
 return true;
}

/* ───────── obstacle builders ───────── */
const O=(kind,shape,x,y,hw,hh,v)=>({id:0,kind,shape,x,y,hw,hh,r:shape==='circle'?hw:0,v:v|0,alive:true,angle:0,prevAngle:0,spin:0,mvx:0,mvy:0});
const crate=(x,y,G)=>O('crate','rect',x,y,C.crate,C.crate,G.rng()*4);
const rock=(x,y,r,G)=>O('rock','circle',x,y,r,r,G.rng()*3);
const logV=(x,y0,y1)=>O('log','rect',x,(y0+y1)/2,15,(y1-y0)/2,0);
const logH=(x0,x1,y)=>O('log','rect',(x0+x1)/2,y,(x1-x0)/2,13,1);
const fenceV=(x,y0,y1)=>O('fence','rect',x,(y0+y1)/2,8,(y1-y0)/2,0);
function barrierV(G,x,y0,y1,mat){
 const len=y1-y0;if(len<16)return[];
 if(mat==='crate'&&len>=2*C.crate){
  const n=Math.max(1,Math.ceil(len/(2*C.crate))),out=[];
  for(let i=0;i<n;i++)out.push(crate(x,n===1?(y0+y1)/2:y0+C.crate+(len-2*C.crate)*i/(n-1),G));
  return out;
 }
 if(mat==='rock'&&len>=44){
  const n=Math.max(1,Math.ceil(len/34)),out=[];
  for(let i=0;i<n;i++)out.push(rock(x+(G.rng()-.5)*6,n===1?(y0+y1)/2:y0+21+(len-42)*i/(n-1),21,G));
  return out;
 }
 if(mat==='fence')return[fenceV(x,y0,y1)];
 return[logV(x,y0,y1)];
}
const MATS=['log','crate','fence','rock'];
const pickMat=G=>MATS[(G.rng()*MATS.length)|0];
const rr=(G,a,b)=>a+G.rng()*(b-a);

/* ───────── chunk templates: return {w, obs}; local u in [PAD, w-PAD] ───────── */
const T={
 single(G,x0){const w=240,y=rr(G,G.top+34,G.bottom-34),o=[];
  o.push(G.rng()<.6?crate(x0+w/2,y,G):rock(x0+w/2,y,rr(G,18,24),G));
  return{w,obs:o};},
 pairH(G,x0){const w=300,y=rr(G,G.top+34,G.bottom-34),o=[crate(x0+w/2-22,y,G),crate(x0+w/2+22,y,G)];
  if(G.rng()<.6){const y2=y<G.cy?rr(G,G.cy+20,G.bottom-30):rr(G,G.top+30,G.cy-20);o.push(crate(x0+w/2+100,y2,G));}
  return{w,obs:o};},
 cluster(G,x0){const w=300,cols=G.rng()<.5?1:2;let rows=2+((G.rng()*2)|0);
  while(rows>1&&G.H-rows*44<100)rows--;
  const h=rows*44,free=G.H-h,mode=G.rng();let y0;
  if(mode<.35)y0=G.top;else if(mode<.7)y0=G.bottom-h;else y0=free>=112?G.top+56+G.rng()*(free-112):G.top;
  const o=[];for(let i=0;i<cols;i++)for(let j=0;j<rows;j++)o.push(crate(x0+w/2+(i-(cols-1)/2)*44,y0+22+j*44,G));
  return{w,obs:o};},
 gate(G,x0){const w=220,narrow=G.rng()<.55,gw=narrow?rr(G,50,62):rr(G,G.large?90:78,G.large?118:100),
   gy=rr(G,G.top+gw/2+24,G.bottom-gw/2-24),mat=pickMat(G),x=x0+w/2;
  return{w,obs:[...barrierV(G,x,G.top,gy-gw/2,mat),...barrierV(G,x,gy+gw/2,G.bottom,mat)]};},
 slalom(G,x0){const k=(G.large?4:3)+((G.rng()*2)|0),sp=140,w=k*sp+80,o=[];let fromTop=G.rng()<.5;
  for(let i=0;i<k;i++){const gw=rr(G,G.large?86:76,G.large?112:98),x=x0+40+PAD+i*sp,mat=pickMat(G);
   o.push(...(fromTop?barrierV(G,x,G.top,G.bottom-gw,mat):barrierV(G,x,G.top+gw,G.bottom,mat)));fromTop=!fromTop;}
  return{w,obs:o};},
 channel(G,x0){const w=320,L=rr(G,200,250),g=rr(G,52,60),yc=G.top+G.H*(.3+.4*G.rng()),u=x0+(w-L)/2;
  return{w,obs:[logH(u,u+L,yc-g/2-13),logH(u,u+L,yc+g/2+13)]};},
 fork(G,x0){const w=340,yd=G.cy+(G.rng()-.5)*40,o=[logH(x0+40,x0+w-40,yd)],upper=G.rng()<.5;
  const y0=upper?G.top:yd+13,y1=upper?yd-13:G.bottom,bh=y1-y0,n=2+((G.rng()*2)|0);
  for(let i=0;i<n;i++){const x=x0+90+i*(G.rng()<.5?80:95),y=y0+bh/2+(G.rng()-.5)*Math.max(0,bh-60)*.6;
   if(bh>=50)o.push(crate(x,y,G));}
  return{w,obs:o};},
 rocks(G,x0){const w=360,n=6+((G.rng()*4)|0),o=[];
  for(let t=0;t<90&&o.length<n;t++){const r=rr(G,16,24),x=x0+PAD+r+G.rng()*(w-2*PAD-2*r),y=rr(G,G.top+r,G.bottom-r);
   if(o.every(q=>Math.hypot(q.x-x,q.y-y)>q.r+r+54))o.push(rock(x,y,r,G));}
  return{w,obs:o};},
 cratefield(G,x0){const w=420,o=[];
  for(let c=0;c<4;c++){const x=x0+60+c*100,m=G.rng()<.45?2:1,ys=[];
   for(let k=0;k<m;k++){for(let t=0;t<12;t++){const y=rr(G,G.top+C.crate+6,G.bottom-C.crate-6);
     if(ys.every(q=>Math.abs(q-y)>44+58)){ys.push(y);break;}}}
   for(const y of ys)o.push(crate(x,y,G));}
  return{w,obs:o};}
};
const NAMES=Object.keys(T);
const WEIGHT={single:[3,0],pairH:[3,1],cluster:[2,1],gate:[1,2],slalom:[.4,2.4],channel:[.5,2],fork:[.8,2],rocks:[1,1.6],cratefield:[.6,2.4]};
function pickTemplate(G,last,t){
 const ws=NAMES.map(n=>n===last?0:WEIGHT[n][0]+(WEIGHT[n][1]-WEIGHT[n][0])*t),sum=ws.reduce((a,b)=>a+b,0);
 let r=G.rng()*sum;for(let i=0;i<NAMES.length;i++){r-=ws[i];if(r<=0)return NAMES[i];}
 return NAMES[0];
}

/* ───────── real route validation (windowed Dijkstra, carries the frontier across chunks) ───────── */
function blockedGrid(G,X0,nc,rows,obs){
 const cell=C.cell,R=C.R+.5;if(_b.length<nc*rows)_b=new Uint8Array(nc*rows*2);const b=_b.subarray(0,nc*rows);b.fill(0);
 for(let j=0;j<rows;j++){const y=G.top+(j+.5)*cell;if(y<G.top+C.R||y>G.bottom-C.R)for(let i=0;i<nc;i++)b[j*nc+i]=1;}
 for(const ob of obs){
  const ex=(ob.shape==='circle'?ob.r:ob.hw)+R,ey=(ob.shape==='circle'?ob.r:ob.hh)+R;
  const i0=Math.max(0,Math.floor((ob.x-ex-X0)/cell)),i1=Math.min(nc-1,Math.floor((ob.x+ex-X0)/cell));
  const j0=Math.max(0,Math.floor((ob.y-ey-G.top)/cell)),j1=Math.min(rows-1,Math.floor((ob.y+ey-G.top)/cell));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
   const x=X0+(i+.5)*cell,y=G.top+(j+.5)*cell;let d;
   if(ob.shape==='circle')d=Math.hypot(x-ob.x,y-ob.y)-ob.r;
   else d=Math.hypot(Math.max(Math.abs(x-ob.x)-ob.hw,0),Math.max(Math.abs(y-ob.y)-ob.hh,0));
   if(d<R)b[j*nc+i]=1;
  }
 }
 return b;
}
class Flow{
 constructor(G){this.G=G;this.rows=Math.floor(G.H/C.cell);this.front=null;this.base=0;}
 test(X0,X1,obs){
  const cell=C.cell,rows=this.rows,nc=Math.max(3,Math.round((X1-X0)/cell)),b=blockedGrid(this.G,X0,nc,rows,obs);
  const dn=nc*rows;if(_d.length<dn)_d=new Float64Array(dn*2);const dist=_d.subarray(0,dn).fill(Infinity),h=_h;h.k.length=0;h.v.length=0;
  let base=this.base;
  for(let j=0;j<rows;j++){const idx=j*nc;if(b[idx])continue;
   const c=this.front?(this.front[j]+cell):0;if(!isFinite(c))continue;dist[idx]=c;h.push(c,idx);}
  if(this.front)base+=cell;
  while(h.size){const u=h.pop(),d=h.rk;if(d>dist[u])continue;const i=u%nc,j=(u/nc)|0;
   for(let q=0;q<8;q++){const dx=NBX[q],dy=NBY[q],len=NBL[q];const ni=i+dx,nj=j+dy;if(ni<0||nj<0||ni>=nc||nj>=rows)continue;
    const v=nj*nc+ni;if(b[v])continue;if(dx&&dy&&(b[j*nc+ni]||b[nj*nc+i]))continue;
    const nd=d+len*cell;if(nd<dist[v]){dist[v]=nd;h.push(nd,v);}}}
  const front=new Float64Array(rows);let best=Infinity;
  for(let j=0;j<rows;j++){front[j]=dist[j*nc+nc-1];if(front[j]<best)best=front[j];}
  base+=(nc-1)*cell;
  return{front,base,over:best-base};
 }
 commit(r){this.front=r.front;this.base=r.base;}
}

export function buildTrack(tier,seed,playerCount){
 const top=tier.top,bottom=tier.bottom,H=bottom-top,cy=(top+bottom)/2;
 const perCol=Math.max(1,Math.floor((H-56)/36)),cols=Math.ceil(playerCount/perCol);
 const spawnX=C.gap0,lastSpawn=spawnX+(cols-1)*C.colGap;
 const finishX=spawnX+tier.runSeconds*C.speed,endX=finishX+C.endZone;
 const rng=mkRng(seed),G={rng,top,bottom,H,cy,large:tier.maxPlayers>6};
 const flow=new Flow(G),obstacles=[],chunks=[];
 const firstX=lastSpawn+C.firstGap,limit=finishX-C.endRun;
 let x=firstX-80,last='',prevOver=0,fallbacks=0;
 // the validator starts at the spawn column so the whole run-up is measured too
 flow.base=0;flow.front=null;
 {const r=flow.test(lastSpawn,x,[]);flow.commit(r);}
 while(x<limit){
  const t=clamp((x-firstX)/Math.max(1,limit-firstX),0,1);
  let acc=null;
  for(let a=0;a<12&&!acc;a++){
   const name=pickTemplate(G,last,t),spacer=a<8?rr(G,50,140):rr(G,120,200),x0=x+spacer;
   const res=T[name](G,x0),x1=x0+res.w;
   if(res.obs.some(o=>{const e=o.shape==='circle'?o.r:o.hw;return o.x-e<x0+PAD-4||o.x+e>x1-PAD+4;}))continue;
   const r=flow.test(x,x1,res.obs);
   if(!isFinite(r.over))continue;
   if(r.over-prevOver>tier.chunkOverhead+Math.min(14,a*3))continue;
   if(r.over>tier.cumOverhead*(x1-lastSpawn)+30)continue;
   acc={name,x0,x1,res,r};
  }
  if(!acc){fallbacks++;const x1=x+170,r=flow.test(x,x1,[]);acc={name:'open',x0:x,x1,res:{w:170,obs:[]},r};}
  flow.commit(acc.r);prevOver=acc.r.over;last=acc.name;
  for(const o of acc.res.obs){o.id=obstacles.length;obstacles.push(o);}
  chunks.push({name:acc.name,x0:acc.x0,x1:acc.x1,count:acc.res.obs.length});
  x=acc.x1;
 }
 const buckets=new Map();
 for(const o of obstacles){const e=indexRadius(o);
  o._bucketLo=Math.floor((o.x-e)/BUCKET);o._bucketHi=Math.floor((o.x+e)/BUCKET);
  for(let b=o._bucketLo;b<=o._bucketHi;b++){let a=buckets.get(b);if(!a)buckets.set(b,a=[]);a.push(o);}}
 let stamp=0;
 const query=(xa,xb,buf)=>{const out=buf||[];out.length=0;stamp++;
  for(let b=Math.floor(xa/BUCKET);b<=Math.floor(xb/BUCKET);b++){const a=buckets.get(b);if(!a)continue;
   for(const o of a)if(o.alive&&o._q!==stamp){o._q=stamp;out.push(o);}}
  return out;};
 // Obstacles stay in the bucket index when shoved by a runner: otherwise
 // colliders and visible sprites would diverge after crossing a bucket edge.
 const QM=[];let out2;
 const canTransform=(o,nx,ny,angle)=>{
  const rx=xExtent(o,angle),ry=yExtent(o,angle);
  if(ny-ry<top-3||ny+ry>bottom+3||nx-rx<lastSpawn+45||nx+rx>finishX-35)return false;
  for(const q of query(nx-indexRadius(o)-5,nx+indexRadius(o)+5,QM)){
   if(q===o)continue;
   if(intersects(o,nx,ny,angle,q,q.x,q.y,q.angle||0))return false;
  }
  return true;
 };
 const moveObstacle=(o,dx,dy)=>{
  if(!o.alive||o.kind==='rock'||o.kind==='fence'||(!dx&&!dy))return false;
  const nx=o.x+dx,ny=o.y+dy;
  if(!canTransform(o,nx,ny,o.angle))return false;
  const rx=indexRadius(o),lo=Math.floor((nx-rx)/BUCKET),hi=Math.floor((nx+rx)/BUCKET);
  if(lo!==o._bucketLo||hi!==o._bucketHi){
   for(let i=o._bucketLo;i<=o._bucketHi;i++){
    const list=buckets.get(i);if(!list)continue;
    const at=list.indexOf(o);if(at>=0)list.splice(at,1);
    if(!list.length)buckets.delete(i);
   }
   for(let i=lo;i<=hi;i++){let list=buckets.get(i);if(!list)buckets.set(i,list=[]);list.push(o);}
   o._bucketLo=lo;o._bucketHi=hi;
  }
  if(o.mt!==out2.tick){o.mt=out2.tick;o.ox=o.x;o.oy=o.y;}
  o.x=nx;o.y=ny;return true;
 };
 // Fixed-step inertia applies ONLY to crates/logs. Rocks and fences never move
 // or rotate, but retain their original solid collision geometry and artwork.
 const moving=new Set();
 const impulseObstacle=(o,ix,iy,cx,cy)=>{
  if(!o.alive||o.kind==='rock'||o.kind==='fence'||Math.hypot(ix,iy)<1e-6)return;
  o.mvx=clamp(o.mvx+ix*11,-95,95);
  o.mvy=clamp(o.mvy+iy*11,-95,95);
  const lever=(cx-o.x)*iy-(cy-o.y)*ix;
  const inertia=Math.max(180,(o.hw*o.hw+o.hh*o.hh)*.5);
  // Angular impulse / moment of inertia. Logs are heavy and cannot flip instantly.
  const torqueGain=o.kind==='log'?12:18,maxSpin=o.kind==='log'?1.15:1.8;
  o.spin=clamp(o.spin+lever*torqueGain/inertia,-maxSpin,maxSpin);
  moving.add(o);
 };
 const stepObstacles=dt=>{
  for(const o of moving){
   if(!o.alive||o.kind==='rock'||o.kind==='fence'){
    o.mvx=o.mvy=o.spin=0;
    if(o.kind==='rock'){o.angle=0;o.prevAngle=0;}
    moving.delete(o);continue;
   }
   const dx=o.mvx*dt,dy=o.mvy*dt;
   if(Math.hypot(o.mvx,o.mvy)>.15){
    let moved=moveObstacle(o,dx,dy);
    // Slide along an obstacle if the full displacement is blocked.
    if(!moved&&Math.abs(dx)>1e-5&&Math.abs(dy)>1e-5)
     moved=moveObstacle(o,dx,0)||moveObstacle(o,0,dy);
    if(!moved){o.mvx*=.18;o.mvy*=.18;o.spin*=.7;}
   }
   if(o.at!==out2.tick){o.at=out2.tick;o.prevAngle=o.angle;}
   // Rotate the REAL collider with the artwork. Do not spin through rocks,
   // neighbouring objects or corridor boundaries.
   const nextAngle=o.angle+o.spin*dt;
   if(canTransform(o,o.x,o.y,nextAngle))o.angle=nextAngle;
   else o.spin=0;
   const damping=Math.exp(-5*dt);
   o.mvx*=damping;o.mvy*=damping;o.spin*=Math.exp(-4*dt);
   if(Math.abs(o.mvx)+Math.abs(o.mvy)+Math.abs(o.spin)<.06){
    o.mvx=o.mvy=o.spin=0;moving.delete(o);
   }
  }
 };
 out2={tier,top,bottom,H,cy,cols,perCol,spawnX,lastSpawn,finishX,endX,obstacles,chunks,query,moveObstacle,impulseObstacle,stepObstacles,
  overhead:prevOver,fallbacks,seed,tick:0};
 return out2;
}

/* ───────── collision helpers (circle body vs obstacle / corridor walls) ───────── */
export function pushOut(track,p,R=C.R){
 let hit=false;
 for(const o of track.query(p.x-R-4,p.x+R+4,PO)){
  const c=obstacleContact(o,p.x,p.y);
  if(c.gap<R){const shift=R-c.gap;p.x+=c.nx*shift;p.y+=c.ny*shift;hit=true;}
 }
 const lo=track.top+R,hi=track.bottom-R;
 if(p.y<lo){p.y=lo;hit=true;}else if(p.y>hi){p.y=hi;hit=true;}
 if(p.x<R-200)p.x=R-200;
 return hit;
}
/* front edge of the dinosaur at height y: a rounded snout that still covers the whole corridor */
export function dinoEdge(track,front,y){
 const half=track.H/2+30,u=clamp(Math.abs(y-track.cy)/half,0,1);
 return front-48*Math.pow(u,1.7);
}
