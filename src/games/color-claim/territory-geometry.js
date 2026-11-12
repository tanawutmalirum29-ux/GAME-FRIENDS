/* COLOR CLAIM — territory geometry kernel (dependency-free, no CDN, no npm).
 *
 * Regions are lists of rings; a ring is a flat array [x0,y0,x1,y1,...] in world
 * pixels. Orientation carries meaning: positive signed area = outer boundary,
 * negative signed area = hole. A point is inside when its winding number != 0.
 *
 * Boolean algebra (union / difference / intersection / any N-ary predicate) is
 * an arrangement overlay:
 *   1. snap every vertex to a fixed-point lattice of 1/64 px (integers, so every
 *      orientation test is EXACT in IEEE doubles: |coords| < 2^18 -> products < 2^36);
 *   2. node (split) all segments at crossings / T-junctions / collinear overlaps
 *      using a uniform grid broad phase, re-noding until stable;
 *   3. build a half-edge graph with angular ordering, trace faces, label every
 *      face with the winding number of each operand (one ray cast per connected
 *      component, then propagation across edges);
 *   4. keep the edges that separate "selected" from "not selected" faces and
 *      chain them back into rings (interior always on the left).
 *
 * Ring assembly follows the interior face (clockwise neighbour rule), so two
 * lobes that only touch at a single point become two separate rings, i.e. they
 * are NOT connected. Connectivity is therefore the topological connectivity of
 * the open interior: a thin neck that really exists keeps both sides together.
 */
(() => {
'use strict';
const SCALE=64;            // lattice resolution: 1/64 px
const MIN_RING=.02;        // px^2, rings below this are numerical dust
const STRIP=8;             // px, height of the point-query strips
const ATTACH=3;            // lattice units, endpoint-to-boundary attach tolerance
const CELLG=24*SCALE;      // broad-phase cell size (24 px)
// Retry lattices (units of 1/64 px). A failed overlay is re-run on a shifted
// lattice, which changes every rounding decision, before giving up.
const OFFSETS=[[0,0],[.31,.17],[.73,.59]];

const orient=(ax,ay,bx,by,cx,cy)=>{const v=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);return v>0?1:v<0?-1:0;};
const onBox=(ax,ay,bx,by,px,py)=>px>=Math.min(ax,bx)&&px<=Math.max(ax,bx)&&py>=Math.min(ay,by)&&py<=Math.max(ay,by);

// ---------------------------------------------------------------- ring basics
function ringArea(r){
 let a=0;
 for(let i=0,j=r.length-2;i<r.length;j=i,i+=2)a+=r[j]*r[i+1]-r[i]*r[j+1];
 return a*.5;
}
function boxOf(r){
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(let i=0;i<r.length;i+=2){
  const x=r[i],y=r[i+1];
  if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
 }
 return[x0,y0,x1,y1];
}
function boundsOf(rings){
 if(!rings||!rings.length)return null;
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const r of rings){
  const b=boxOf(r);
  if(b[0]<minX)minX=b[0];if(b[1]<minY)minY=b[1];if(b[2]>maxX)maxX=b[2];if(b[3]>maxY)maxY=b[3];
 }
 return{minX,minY,maxX,maxY};
}
function windingRing(r,px,py){
 let w=0;
 for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){
  const x0=r[j],y0=r[j+1],x1=r[i],y1=r[i+1];
  if(y0<=py){if(y1>py&&(x1-x0)*(py-y0)-(px-x0)*(y1-y0)>0)w++;}
  else if(y1<=py&&(x1-x0)*(py-y0)-(px-x0)*(y1-y0)<0)w--;
 }
 return w;
}
function pointInRings(rings,x,y){
 let w=0;
 for(const r of rings)w+=windingRing(r,x,y);
 return w!==0;
}

// ------------------------------------------------------------------- noding
// segs: flat integers, stride 5 = [x0,y0,x1,y1,operand]. operand >= 0 are valid
// (non self-intersecting) rings, so pairs of the same operand are never tested;
// operand -1 (an open path) is tested against everything including itself.
function nodeSegments(input){
 let segs=input;
 for(let pass=0;pass<8;pass++){
  const n=segs.length/5;
  if(n<2)return segs;
  const grid=new Map(),cx0=new Int32Array(n),cy0=new Int32Array(n);
  for(let i=0;i<n;i++){
   const o=i*5,x0=segs[o],y0=segs[o+1],x1=segs[o+2],y1=segs[o+3];
   const a=Math.floor(Math.min(x0,x1)/CELLG),b=Math.floor(Math.max(x0,x1)/CELLG);
   const c=Math.floor(Math.min(y0,y1)/CELLG),d=Math.floor(Math.max(y0,y1)/CELLG);
   cx0[i]=a;cy0[i]=c;
   for(let x=a;x<=b;x++)for(let y=c;y<=d;y++){
    const key=(x+64)*8192+(y+64);
    let list=grid.get(key);if(!list)grid.set(key,list=[]);list.push(i);
   }
  }
  let splits=null;
  const add=(i,x,y)=>{
   const o=i*5;
   if((x===segs[o]&&y===segs[o+1])||(x===segs[o+2]&&y===segs[o+3]))return;
   if(!splits)splits=new Map();
   let l=splits.get(i);if(!l)splits.set(i,l=[]);
   l.push(x,y);
  };
  for(const [key,list] of grid){
   if(list.length<2)continue;
   const cellX=Math.floor(key/8192)-64,cellY=key%8192-64;
   for(let a=0;a<list.length;a++)for(let b=a+1;b<list.length;b++){
    const i=list[a],j=list[b];
    // A pair sharing several cells is processed once: in the lowest common cell.
    if(Math.max(cx0[i],cx0[j])!==cellX||Math.max(cy0[i],cy0[j])!==cellY)continue;
    const ki=segs[i*5+4];
    if(ki>=0&&ki===segs[j*5+4])continue;
    const o=i*5,p=j*5;
    const ax=segs[o],ay=segs[o+1],bx=segs[o+2],by=segs[o+3];
    const cx=segs[p],cy=segs[p+1],dx=segs[p+2],dy=segs[p+3];
    if(Math.max(ax,bx)<Math.min(cx,dx)||Math.max(cx,dx)<Math.min(ax,bx)||
       Math.max(ay,by)<Math.min(cy,dy)||Math.max(cy,dy)<Math.min(ay,by))continue;
    const o1=orient(ax,ay,bx,by,cx,cy),o2=orient(ax,ay,bx,by,dx,dy);
    const o3=orient(cx,cy,dx,dy,ax,ay),o4=orient(cx,cy,dx,dy,bx,by);
    if(o1*o2<0&&o3*o4<0){
     // proper crossing: intersection rounded to the lattice, shared by both
     const v3=(dx-cx)*(ay-cy)-(dy-cy)*(ax-cx),v4=(dx-cx)*(by-cy)-(dy-cy)*(bx-cx);
     const t=v3/(v3-v4);
     const x=Math.round(ax+(bx-ax)*t),y=Math.round(ay+(by-ay)*t);
     add(i,x,y);add(j,x,y);
    }else{
     // T-junctions and collinear overlaps: an endpoint lying on the other segment
     if(o1===0&&onBox(ax,ay,bx,by,cx,cy))add(i,cx,cy);
     if(o2===0&&onBox(ax,ay,bx,by,dx,dy))add(i,dx,dy);
     if(o3===0&&onBox(cx,cy,dx,dy,ax,ay))add(j,ax,ay);
     if(o4===0&&onBox(cx,cy,dx,dy,bx,by))add(j,bx,by);
    }
   }
  }
  if(!splits)return segs;
  const out=[];
  for(let i=0;i<n;i++){
   const o=i*5,x0=segs[o],y0=segs[o+1],x1=segs[o+2],y1=segs[o+3],k=segs[o+4];
   const l=splits.get(i);
   if(!l){out.push(x0,y0,x1,y1,k);continue;}
   const dx=x1-x0,dy=y1-y0,dd=dx*dx+dy*dy,pts=[];
   for(let m=0;m<l.length;m+=2){
    const t=(l[m]-x0)*dx+(l[m+1]-y0)*dy;
    if(t>0&&t<dd)pts.push({x:l[m],y:l[m+1],t});
   }
   pts.sort((a,b)=>a.t-b.t);
   let px=x0,py=y0;
   for(const p of pts){
    if(p.x===px&&p.y===py)continue;
    out.push(px,py,p.x,p.y,k);px=p.x;py=p.y;
   }
   if(px!==x1||py!==y1)out.push(px,py,x1,y1,k);
  }
  segs=out;
 }
 return segs;
}

// ----------------------------------------------------------- planar graph
function buildGraph(segs,K){
 const n=segs.length/5,vid=new Map(),VX=[],VY=[];
 const vert=(x,y)=>{
  const key=(x+262144)*1048576+(y+262144);
  let id=vid.get(key);
  if(id===undefined){id=VX.length;vid.set(key,id);VX.push(x);VY.push(y);}
  return id;
 };
 const emap=new Map(),EU=[],EV=[],ecnt=[];
 for(let k=0;k<K;k++)ecnt.push([]);
 for(let i=0;i<n;i++){
  const o=i*5,u=vert(segs[o],segs[o+1]),v=vert(segs[o+2],segs[o+3]),k=segs[o+4];
  if(u===v)continue;
  const lo=u<v?u:v,hi=u<v?v:u,ekey=lo*1048576+hi;
  let e=emap.get(ekey);
  if(e===undefined){
   e=EU.length;emap.set(ekey,e);EU.push(lo);EV.push(hi);
   for(let m=0;m<K;m++)ecnt[m].push(0);
  }
  if(k>=0)ecnt[k][e]+=(u===lo?1:-1);
 }
 const V=VX.length,E=EU.length,H=E*2;
 const origin=h=>(h&1)?EV[h>>1]:EU[h>>1];
 const dest=h=>(h&1)?EU[h>>1]:EV[h>>1];
 const start=new Int32Array(V+1);
 for(let e=0;e<E;e++){start[EU[e]+1]++;start[EV[e]+1]++;}
 for(let v=0;v<V;v++)start[v+1]+=start[v];
 const fill=new Int32Array(V),adj=new Int32Array(H),ang=new Float64Array(H),pos=new Int32Array(H);
 for(let h=0;h<H;h++){
  const u=origin(h),w=dest(h);
  ang[h]=Math.atan2(VY[w]-VY[u],VX[w]-VX[u]);
  adj[start[u]+fill[u]++]=h;
 }
 for(let v=0;v<V;v++){
  const s0=start[v],s1=start[v+1];
  for(let a=s0+1;a<s1;a++){
   const h=adj[a];let b=a-1;
   while(b>=s0&&ang[adj[b]]>ang[h]){adj[b+1]=adj[b];b--;}
   adj[b+1]=h;
  }
  for(let a=s0;a<s1;a++)pos[adj[a]]=a-s0;
 }
 // Face on the LEFT of h: next = the outgoing half-edge clockwise-adjacent to twin(h).
 const nxt=new Int32Array(H);
 for(let h=0;h<H;h++){
  const v=dest(h),d=start[v+1]-start[v],p=pos[h^1];
  nxt[h]=adj[start[v]+((p-1+d)%d)];
 }
 const face=new Int32Array(H).fill(-1),order=new Int32Array(H),fArea=[],fStart=[];
 let F=0,on=0;
 for(let h0=0;h0<H;h0++){
  if(face[h0]>=0)continue;
  fStart.push(on);
  let a2=0,h=h0;
  do{
   face[h]=F;order[on++]=h;
   const u=origin(h),w=dest(h);
   a2+=VX[u]*VY[w]-VX[w]*VY[u];
   h=nxt[h];
  }while(h!==h0);
  fArea.push(a2);F++;
 }
 fStart.push(on);
 return{VX,VY,E,H,F,EU,EV,ecnt,start,adj,pos,face,order,fStart,fArea,origin,dest};
}

// winding number of operand k at a lattice-half point (ray towards +x, half-open)
function windingAt(segs,k,px,py){
 let w=0;
 for(let o=0;o<segs.length;o+=5){
  if(segs[o+4]!==k)continue;
  const x0=segs[o],y0=segs[o+1],x1=segs[o+2],y1=segs[o+3];
  if(y0<=py){if(y1>py&&(x1-x0)*(py-y0)-(px-x0)*(y1-y0)>0)w++;}
  else if(y1<=py&&(x1-x0)*(py-y0)-(px-x0)*(y1-y0)<0)w--;
 }
 return w;
}

// integer ring -> cleaned float ring (duplicates, collinear points and zero-width
// spikes removed). Returns null for degenerate rings.
function cleanRing(p,ox,oy){
 let a=p;
 for(let guard=0;guard<48;guard++){
  if(a.length<6)return null;
  const d=[];
  for(let i=0;i<a.length;i+=2){
   const m=d.length;
   if(m&&d[m-2]===a[i]&&d[m-1]===a[i+1])continue;
   d.push(a[i],a[i+1]);
  }
  while(d.length>=4&&d[0]===d[d.length-2]&&d[1]===d[d.length-1]){d.pop();d.pop();}
  const n=d.length/2;
  if(n<3)return null;
  const out=[];
  for(let i=0;i<n;i++){
   const j=(i+n-1)%n,k=(i+1)%n,x=d[i*2],y=d[i*2+1];
   if((x-d[j*2])*(d[k*2+1]-d[j*2+1])-(y-d[j*2+1])*(d[k*2]-d[j*2])===0)continue;
   out.push(x,y);
  }
  const stable=out.length===d.length;
  a=out;
  if(stable)break;
 }
 const n=a.length/2;
 if(n<3)return null;
 let a2=0;
 for(let i=0,j=n-1;i<n;j=i++)a2+=a[j*2]*a[i*2+1]-a[i*2]*a[j*2+1];
 if(Math.abs(a2)<MIN_RING*2*SCALE*SCALE)return null;
 const r=new Float64Array(n*2);
 for(let i=0;i<n;i++){r[i*2]=(a[i*2]-ox)/SCALE;r[i*2+1]=(a[i*2+1]-oy)/SCALE;}
 return r;
}

// ---------------------------------------------------------------- overlay
// operands: array of regions (each an array of rings). sel(w) receives the winding
// vector (Int32Array, one entry per operand) of a face and returns whether that
// face belongs to the result. Returns rings, or null if the arrangement turned
// out inconsistent on this lattice.
function combineOnce(operands,sels,ox,oy){
 const K=operands.length,input=[];
 for(let k=0;k<K;k++)for(const r of operands[k]){
  const n=r.length>>1;if(n<3)continue;
  let px=Math.round(r[n*2-2]*SCALE+ox),py=Math.round(r[n*2-1]*SCALE+oy);
  for(let i=0;i<n;i++){
   const x=Math.round(r[i*2]*SCALE+ox),y=Math.round(r[i*2+1]*SCALE+oy);
   if(x!==px||y!==py)input.push(px,py,x,y,k);
   px=x;py=y;
  }
 }
 if(!input.length)return sels.map(()=>[]);
 const g=buildGraph(nodeSegments(input),K);
 const F=g.F,W=new Int32Array(F*K),seen=new Uint8Array(F),done=new Uint8Array(F);
 for(let f0=0;f0<F;f0++){
  if(seen[f0])continue;
  const comp=[f0];seen[f0]=1;
  for(let i=0;i<comp.length;i++){
   const f=comp[i];
   for(let a=g.fStart[f];a<g.fStart[f+1];a++){
    const t=g.face[g.order[a]^1];
    if(!seen[t]){seen[t]=1;comp.push(t);}
   }
  }
  // The most negative face is the component's outer (unbounded) face.
  let outer=comp[0];
  for(const f of comp)if(g.fArea[f]<g.fArea[outer])outer=f;
  let lx=Infinity,ly=Infinity;
  for(let a=g.fStart[outer];a<g.fStart[outer+1];a++){
   const u=g.origin(g.order[a]),x=g.VX[u],y=g.VY[u];
   if(x<lx||(x===lx&&y<ly)){lx=x;ly=y;}
  }
  // Left of the left-most vertex lies in the outer face: rings of this component
  // contribute 0 there, rings of other components are counted by the ray cast.
  for(let k=0;k<K;k++)W[outer*K+k]=windingAt(input,k,lx-.5,ly);
  const queue=[outer];done[outer]=1;
  for(let i=0;i<queue.length;i++){
   const f=queue[i];
   for(let a=g.fStart[f];a<g.fStart[f+1];a++){
    const h=g.order[a],t=g.face[h^1];
    if(done[t])continue;
    done[t]=1;
    for(let k=0;k<K;k++){
     const c=g.ecnt[k][h>>1],d=(h&1)?-c:c;   // w(left of h) = w(right of h) + d
     W[t*K+k]=W[f*K+k]-d;
    }
    queue.push(t);
   }
  }
 }
 const tmp=new Int32Array(K),results=[];
 // Every selector is evaluated on the SAME noded arrangement, so results that
 // must be complementary (a capturer's gain and a victim's loss) share exactly
 // the same sub-edges and can never overlap or leave a gap after lattice rounding.
 for(const sel of sels){
  const inside=new Uint8Array(F);
  for(let f=0;f<F;f++){
   for(let k=0;k<K;k++)tmp[k]=W[f*K+k];
   inside[f]=sel(tmp)?1:0;
  }
  const selH=new Uint8Array(g.H);let any=false;
  for(let e=0;e<g.E;e++){
   const l=inside[g.face[2*e]],r=inside[g.face[2*e+1]];
   if(l&&!r){selH[2*e]=1;any=true;}
   else if(r&&!l){selH[2*e+1]=1;any=true;}
  }
  const rings=[];
  if(any){
   const used=new Uint8Array(g.H);
   for(let h0=0;h0<g.H;h0++){
    if(!selH[h0]||used[h0])continue;
    const pts=[];let h=h0,closed=false;
    for(let guard=0;guard<=g.H;guard++){
     used[h]=1;
     const u=g.origin(h);pts.push(g.VX[u],g.VY[u]);
     const v=g.dest(h),d=g.start[v+1]-g.start[v],p=g.pos[h^1];
     let nh=-1;
     // first selected outgoing edge clockwise from the way we came: traces the
     // interior face tightly, so touching lobes stay separate rings
     for(let s2=1;s2<d;s2++){
      const c=g.adj[g.start[v]+((p-s2+d)%d)];
      if(selH[c]){nh=c;break;}
     }
     if(nh<0)break;
     if(nh===h0){closed=true;break;}
     if(used[nh])break;
     h=nh;
    }
    if(!closed)return null;
    const ring=cleanRing(pts,ox,oy);
    if(ring)rings.push(ring);
   }
  }
  results.push(rings);
 }
 return results;
}
// One arrangement, several selectors -> one ring list per selector (or null).
function combineMany(operands,sels){
 for(const [ox,oy] of OFFSETS){
  let r=null;
  try{r=combineOnce(operands,sels,ox,oy);}catch(_){r=null;}
  if(r)return r;
 }
 return null;
}
function combine(operands,sel){
 const r=combineMany(operands,[sel]);
 return r?r[0]:null;
}
const canon=rings=>combine([rings],w=>w[0]!==0);

// ------------------------------------------------------------- enclosure
function sideOfRing(r,px,py){      // 0 outside, 1 inside, 2 on the boundary (integers)
 const n=r.length;let w=0;
 for(let i=0,j=n-2;i<n;j=i,i+=2){
  const x0=r[j],y0=r[j+1],x1=r[i],y1=r[i+1];
  const c=(x1-x0)*(py-y0)-(px-x0)*(y1-y0);
  if(c===0&&onBox(x0,y0,x1,y1,px,py))return 2;
  if(y0<=py){if(y1>py&&c>0)w++;}else if(y1<=py&&c<0)w--;
 }
 return w!==0?1:0;
}
// An endpoint of the trail that the lattice pushed a hair outside the territory is
// attached to the nearest boundary point (a <=3/64 px bridge) so the loop closes.
function attach(ring,pth,atEnd){
 const n=pth.length,x=atEnd?pth[n-2]:pth[0],y=atEnd?pth[n-1]:pth[1];
 if(sideOfRing(ring,x,y)!==0)return true;
 const m=ring.length/2;
 let bd=Infinity,bi=-1,bx=0,by=0;
 for(let i=0;i<m;i++){
  const j=(i+1)%m,ax=ring[i*2],ay=ring[i*2+1],cx=ring[j*2],cy=ring[j*2+1];
  const dx=cx-ax,dy=cy-ay,L=dx*dx+dy*dy;
  let t=L?((x-ax)*dx+(y-ay)*dy)/L:0;t=t<0?0:t>1?1:t;
  const px=ax+dx*t,py=ay+dy*t,d=(x-px)*(x-px)+(y-py)*(y-py);
  if(d<bd){bd=d;bi=i;bx=px;by=py;}
 }
 if(bi<0||bd>ATTACH*ATTACH)return false;
 const yx=Math.round(bx),yy=Math.round(by),j=(bi+1)%m;
 const onVertex=(yx===ring[bi*2]&&yy===ring[bi*2+1])||(yx===ring[j*2]&&yy===ring[j*2+1]);
 if(!onVertex)ring.splice((bi+1)*2,0,yx,yy);
 if(atEnd)pth.push(yx,yy);else pth.unshift(yx,yy);
 return true;
}
function encloseOnce(outer,path,ox,oy){
 const ring=[],pth=[];
 const push=(a,x,y)=>{const m=a.length;if(!m||a[m-2]!==x||a[m-1]!==y)a.push(x,y);};
 for(let i=0;i<outer.length;i+=2)push(ring,Math.round(outer[i]*SCALE+ox),Math.round(outer[i+1]*SCALE+oy));
 if(ring.length>=6&&ring[0]===ring[ring.length-2]&&ring[1]===ring[ring.length-1]){ring.pop();ring.pop();}
 for(let i=0;i<path.length;i+=2)push(pth,Math.round(path[i]*SCALE+ox),Math.round(path[i+1]*SCALE+oy));
 if(ring.length<6||pth.length<4)return null;
 if(!attach(ring,pth,false)||!attach(ring,pth,true))return null;
 const segs=[],nr=ring.length/2;
 for(let i=0;i<nr;i++){const j=(i+1)%nr;segs.push(ring[i*2],ring[i*2+1],ring[j*2],ring[j*2+1],0);}
 for(let i=0;i+3<pth.length;i+=2)segs.push(pth[i],pth[i+1],pth[i+2],pth[i+3],-1);
 const g=buildGraph(nodeSegments(segs),1);
 let best=-1;
 for(let f=0;f<g.F;f++)if(best<0||g.fArea[f]<g.fArea[best])best=f;
 if(best<0||g.fArea[best]>=0)return null;
 // Outer face boundary is traced clockwise; reverse it to get a positive ring.
 const pts=[];
 for(let a=g.fStart[best+1]-1;a>=g.fStart[best];a--){
  const u=g.origin(g.order[a]);pts.push(g.VX[u],g.VY[u]);
 }
 return cleanRing(pts,ox,oy);
}
// Region enclosed by (outer ring of own territory) + (trail polyline): every point
// that cannot escape to infinity without crossing either. Returns canonical rings.
function enclose(outer,path){
 for(const [ox,oy] of OFFSETS){
  let ring=null;
  try{ring=encloseOnce(outer,path,ox,oy);}catch(_){ring=null;}
  if(!ring)continue;
  const rings=canon([ring]);
  if(rings)return rings;
 }
 return null;
}

// ------------------------------------------------------ queryable regions
function makeRegion(rings){
 const R={rings,outer:rings.length?rings[0]:null,area:0,cx:0,cy:0,minX:0,minY:0,maxX:0,maxY:0,
  ex:null,sStart:null,sList:null,sN:0};
 if(!rings.length)return R;
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,edges=0;
 for(const r of rings){
  edges+=r.length/2;
  for(let i=0;i<r.length;i+=2){
   const x=r[i],y=r[i+1];
   if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
  }
 }
 R.minX=minX;R.minY=minY;R.maxX=maxX;R.maxY=maxY;
 let a2=0,sx=0,sy=0;
 const ex=new Float64Array(edges*4);let e=0;
 for(const r of rings)for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){
  const x0=r[j],y0=r[j+1],x1=r[i],y1=r[i+1];
  ex[e++]=x0;ex[e++]=y0;ex[e++]=x1;ex[e++]=y1;
  const ax=x0-minX,ay=y0-minY,bx=x1-minX,by=y1-minY,c=ax*by-bx*ay;
  a2+=c;sx+=(ax+bx)*c;sy+=(ay+by)*c;
 }
 R.area=a2*.5;
 R.cx=a2?minX+sx/(3*a2):minX;R.cy=a2?minY+sy/(3*a2):minY;
 const n=Math.max(1,Math.floor((maxY-minY)/STRIP)+1),cnt=new Int32Array(n+1);
 const strip=y=>Math.min(n-1,Math.max(0,Math.floor((y-minY)/STRIP)));
 for(let k=0;k<edges;k++){
  const a=strip(Math.min(ex[k*4+1],ex[k*4+3])),b=strip(Math.max(ex[k*4+1],ex[k*4+3]));
  for(let s=a;s<=b;s++)cnt[s+1]++;
 }
 for(let s=0;s<n;s++)cnt[s+1]+=cnt[s];
 const list=new Int32Array(cnt[n]),fp=Int32Array.from(cnt.subarray(0,n));
 for(let k=0;k<edges;k++){
  const a=strip(Math.min(ex[k*4+1],ex[k*4+3])),b=strip(Math.max(ex[k*4+1],ex[k*4+3]));
  for(let s=a;s<=b;s++)list[fp[s]++]=k;
 }
 R.ex=ex;R.sStart=cnt;R.sList=list;R.sN=n;
 return R;
}
function inside(R,px,py){
 if(!R.ex||px<R.minX||px>R.maxX||py<R.minY||py>R.maxY)return false;
 const s=Math.min(R.sN-1,Math.floor((py-R.minY)/STRIP)),ex=R.ex;
 let w=0;
 for(let a=R.sStart[s],b=R.sStart[s+1];a<b;a++){
  const k=R.sList[a]*4,x0=ex[k],y0=ex[k+1],x1=ex[k+2],y1=ex[k+3];
  if(y0<=py){if(y1>py&&(x1-x0)*(py-y0)-(px-x0)*(y1-y0)>0)w++;}
  else if(y1<=py&&(x1-x0)*(py-y0)-(px-x0)*(y1-y0)<0)w--;
 }
 return w!==0;
}
// distance from a point to the region boundary, capped at limit
function clearance(R,px,py,limit){
 if(!R.ex)return 0;
 const a0=Math.max(0,Math.floor((py-limit-R.minY)/STRIP)),a1=Math.min(R.sN-1,Math.floor((py+limit-R.minY)/STRIP));
 const ex=R.ex;let best=limit*limit;
 for(let s=a0;s<=a1;s++)for(let a=R.sStart[s],b=R.sStart[s+1];a<b;a++){
  const k=R.sList[a]*4,x0=ex[k],y0=ex[k+1],dx=ex[k+2]-x0,dy=ex[k+3]-y0,L=dx*dx+dy*dy;
  let t=L?((px-x0)*dx+(py-y0)*dy)/L:0;t=t<0?0:t>1?1:t;
  const qx=px-x0-dx*t,qy=py-y0-dy*t,d=qx*qx+qy*qy;
  if(d<best)best=d;
 }
 return Math.sqrt(best);
}

// Group rings into connected parts (an outer ring plus the holes nested in it).
function splitParts(rings){
 const outers=[],holes=[];
 for(const r of rings){
  const a=ringArea(r);
  if(a>0)outers.push({r,a,b:boxOf(r),holes:[]});
  else if(a<0)holes.push({r,a,b:boxOf(r)});
 }
 for(const h of holes){
  let best=null;
  for(const o of outers){
   if(h.b[0]<o.b[0]-1e-9||h.b[1]<o.b[1]-1e-9||h.b[2]>o.b[2]+1e-9||h.b[3]>o.b[3]+1e-9)continue;
   const m=h.r.length/2,samples=Math.min(5,m);let votes=0;
   for(let s=0;s<samples;s++){
    const i=Math.floor(s*m/samples);
    if(windingRing(o.r,h.r[i*2],h.r[i*2+1])!==0)votes++;
   }
   if(votes*2<=samples)continue;
   if(!best||o.a<best.a)best=o;
  }
  if(best)best.holes.push(h);
 }
 return outers.map(o=>({rings:[o.r,...o.holes.map(h=>h.r)],area:o.a+o.holes.reduce((t,h)=>t+h.a,0)}));
}

function circleRing(cx,cy,r,n){
 const out=new Float64Array(n*2);
 for(let i=0;i<n;i++){const a=Math.PI*2*i/n;out[i*2]=cx+Math.cos(a)*r;out[i*2+1]=cy+Math.sin(a)*r;}
 return out;
}

// Douglas–Peucker on the player's path: returns flat [x,y,...]. End points are kept.
function simplifyPath(pts,tol){
 const n=pts.length;
 if(n===0)return[];
 if(n<3){const o=[];for(const p of pts)o.push(p.x,p.y);return o;}
 const keep=new Uint8Array(n);keep[0]=keep[n-1]=1;
 const stack=[0,n-1];
 while(stack.length){
  const hi=stack.pop(),lo=stack.pop();
  const ax=pts[lo].x,ay=pts[lo].y,dx=pts[hi].x-ax,dy=pts[hi].y-ay,L=dx*dx+dy*dy;
  let max=-1,idx=-1;
  for(let i=lo+1;i<hi;i++){
   let t=L?((pts[i].x-ax)*dx+(pts[i].y-ay)*dy)/L:0;t=t<0?0:t>1?1:t;
   const ex=pts[i].x-ax-dx*t,ey=pts[i].y-ay-dy*t,d=ex*ex+ey*ey;
   if(d>max){max=d;idx=i;}
  }
  if(idx>0&&max>tol*tol){keep[idx]=1;stack.push(lo,idx,idx,hi);}
 }
 const out=[];
 for(let i=0;i<n;i++)if(keep[i])out.push(pts[i].x,pts[i].y);
 return out;
}

window.ColorClaimGeometry=Object.freeze({SCALE,ringArea,boundsOf,pointInRings,combine,combineMany,canon,enclose,
 makeRegion,inside,clearance,splitParts,circleRing,simplifyPath});
})();
