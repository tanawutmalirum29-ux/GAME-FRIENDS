/* BLOCK BREAKERS — host-authoritative last-survivor game on a collapsing tile floor.
   Modules (single shared data set): Tile Grid + Tile Lifecycle, Collapse Scheduler
   (patterns + connectivity/escape checks), Collision/Support system, Bot controller, Rendering. */
(() => {
'use strict';
const STEP=1/60,TAU=Math.PI*2;
// All timings are central constants (seconds) and are advanced by the fixed step, never by frame rate.
const TIMING=Object.freeze({crack:.85,heavy:.45,collapse:.9,secondReady:.45,lateScale:.74});
const STAGE=[TIMING.crack,TIMING.heavy,TIMING.collapse];
const C=Object.freeze({radius:15,foot:11,supportMin:4,accel:900,drag:5.2,hardSpeed:300,restitution:.78,maxShift:3.5,
 botSpeed:150,fallTime:.75,soloDuration:60,maxDuration:90,startDelay:2.2,maxParticles:170});
// Footprint support rule (single rule): 9 samples = centre + 8 on the foot ring.
// The avatar stands while at least supportMin of 9 samples are over a walkable tile.
const RING=Array.from({length:8},(_,k)=>[Math.cos(k*TAU/8)*C.foot,Math.sin(k*TAU/8)*C.foot]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const living=ps=>ps.filter(p=>p.active&&p.bk?.alive);
const hash=(i,k)=>((Math.imul(i+1,2654435761)^Math.imul((k|0)+7,40503))>>>0)/4294967296;
function rng(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x||0x2468ace;return(s.seed>>>0)/4294967296;}
function fxr(s){let x=s.fxSeed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.fxSeed=x||0x1357bd;return(s.fxSeed>>>0)/4294967296;}
/* ===== Tile grid ===== */
const colOf=(s,i)=>i%s.cols,rowOf=(s,i)=>(i/s.cols)|0;
function tileAt(s,x,y){const c=Math.floor((x-s.x0)/s.T),r=Math.floor((y-s.y0)/s.T);
 return c<0||r<0||c>=s.cols||r>=s.rows?-1:r*s.cols+c;}
function clampTile(s,x,y){return clamp(Math.floor((y-s.y0)/s.T),0,s.rows-1)*s.cols+clamp(Math.floor((x-s.x0)/s.T),0,s.cols-1);}
function tileCenter(s,i){return{x:s.x0+(colOf(s,i)+.5)*s.T,y:s.y0+(rowOf(s,i)+.5)*s.T};}
const walkable=(s,i)=>i>=0&&s.st[i]<=3;
function supportCount(s,x,y){
 let n=walkable(s,tileAt(s,x,y))?1:0;
 for(let k=0;k<8;k++)if(walkable(s,tileAt(s,x+RING[k][0],y+RING[k][1])))n++;
 return n;
}
function timeLeft(s,i){
 const k=s.st[i];if(k>=4)return -1;
 // The first layer and the exposed second layer do not become a hole
 // until the bottom layer is actually stepped on.
 if(k<=2)return Infinity;
 return Math.max(0,TIMING.collapse*(s.wp[i]||1)-s.tm[i]);
}
function neighbors(s,i,out){
 const c=colOf(s,i),r=rowOf(s,i);let n=0;
 if(c>0)out[n++]=i-1;if(c<s.cols-1)out[n++]=i+1;if(r>0)out[n++]=i-s.cols;if(r<s.rows-1)out[n++]=i+s.cols;return n;
}
/* ===== Particles (cosmetic only, separate RNG) ===== */
function part(s,q){if(s.parts.length<C.maxParticles)s.parts.push(q);}
function dust(s,x,y,n,big){
 for(let k=0;k<n;k++){const a=fxr(s)*TAU,sp=14+fxr(s)*(big?60:34);
  part(s,{kind:'dust',x:x+(fxr(s)-.5)*14,y:y+(fxr(s)-.5)*14,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-6,life:.5+fxr(s)*.4,max:.9,size:3+fxr(s)*4,grow:10+fxr(s)*10});}
}
function burst(s,i){
 const c=tileCenter(s,i);dust(s,c.x,c.y,7,true);
 for(let k=0;k<4;k++){const a=k*TAU/4+fxr(s)*.8;
  part(s,{kind:'chip',x:c.x+Math.cos(a)*7,y:c.y+Math.sin(a)*7,vx:Math.cos(a)*(24+fxr(s)*26),vy:Math.sin(a)*(24+fxr(s)*26)-30,
   life:.55+fxr(s)*.25,max:.8,size:8+fxr(s)*6,rot:fxr(s)*TAU,vr:(fxr(s)-.5)*9,col:fxr(s)<.5?'#dcae52':'#b5812f'});}
 for(let k=0;k<4;k++)part(s,{kind:'chip',x:c.x+(fxr(s)-.5)*20,y:c.y+(fxr(s)-.5)*20,vx:(fxr(s)-.5)*50,vy:-20-fxr(s)*30,
  life:.5+fxr(s)*.3,max:.8,size:2.5+fxr(s)*2.5,rot:0,vr:3,col:'#6f4a1d'});
}
function updateParts(s,dt){
 const a=s.parts;
 for(let i=a.length-1;i>=0;i--){const q=a[i];q.life-=dt;
  if(q.life<=0){a[i]=a[a.length-1];a.pop();continue;}
  q.x+=q.vx*dt;q.y+=q.vy*dt;
  if(q.kind==='chip'){q.vy+=380*dt;q.rot+=q.vr*dt;}
  else{const d=Math.exp(-2.4*dt);q.vx*=d;q.vy*=d;q.size+=q.grow*dt;}}
}
/* ===== Tile lifecycle (event-driven: version bumps only on a state change) ===== */
function updateTiles(s,dt){
 let changed=false;
 for(let k=s.active.length-1;k>=0;k--){
  const i=s.active[k],state=s.st[i];
  if(state!==1&&state!==3){s.active[k]=s.active[s.active.length-1];s.active.pop();continue;}
  s.tm[i]+=dt;
  if(state===3&&fxr(s)<.22){const c=tileCenter(s,i);dust(s,c.x+(fxr(s)-.5)*30,c.y+(fxr(s)-.5)*30,1,false);}
  const duration=(state===1?TIMING.crack:TIMING.collapse)*s.wp[i];
  if(s.tm[i]<duration)continue;
  s.tm[i]=0;
  s.active[k]=s.active[s.active.length-1];s.active.pop();
  if(state===1){
   // Only the top layer breaks: exposed bottom remains solid until second touch.
   s.st[i]=2;s.ready[i]=s.clock+TIMING.secondReady;
  }else{
   // Only the second layer breaks into a pit.
   s.st[i]=4;s.holes++;s.dirty.push(i);burst(s,i);
  }
  changed=true;
 }
 if(changed)s.version++;
}
/* ===== Historic collapse algorithms (not used by the footprint-only game mode) ===== */
function difficulty(s){
 const gone=(s.holes+s.active.length)/s.total,tf=clamp(s.clock/s.cap,0,1);
 return clamp(.5*tf+.5*clamp(gone/.82,0,1),0,1);
}
function warnScale(s,d){return Math.max(.72,clamp(1-(1-TIMING.lateScale)*Math.pow(d,1.2),TIMING.lateScale,1));}
function labelComponents(s,mask,lab){
 const{total,cols,rows}=s,q=s.q;lab.fill(0);const sizes=[0];let n=0;
 for(let i=0;i<total;i++){
  if(!mask[i]||lab[i])continue;n++;let h=0,t=0,size=0;q[t++]=i;lab[i]=n;
  while(h<t){const a=q[h++];size++;const c=a%cols,r=(a/cols)|0;
   if(c>0&&mask[a-1]&&!lab[a-1]){lab[a-1]=n;q[t++]=a-1;}
   if(c<cols-1&&mask[a+1]&&!lab[a+1]){lab[a+1]=n;q[t++]=a+1;}
   if(r>0&&mask[a-cols]&&!lab[a-cols]){lab[a-cols]=n;q[t++]=a-cols;}
   if(r<rows-1&&mask[a+cols]&&!lab[a+cols]){lab[a+cols]=n;q[t++]=a+cols;}}
  sizes.push(size);}
 return{count:n,sizes};
}
function escapeDist(s,mask){
 const dist=s.dist,q=s.q,nb=s.nbuf;dist.fill(-1);let h=0,t=0;
 for(let i=0;i<s.total;i++)if(mask[i]){dist[i]=0;q[t++]=i;}
 while(h<t){const a=q[h++],n=neighbors(s,a,nb);
  for(let k=0;k<n;k++){const b=nb[k];if(dist[b]>=0||s.st[b]>3)continue;dist[b]=dist[a]+1;q[t++]=b;}}
 return dist;
}
function minSafe(s,alive){
 if(s.clock<s.cap)return Math.max(2,Math.ceil(alive*.5));
 return s.clock<s.cap+12?1:0;
}
function escapeFactor(s){return s.clock<s.cap?1:s.clock<s.cap+12?.45:0;}
function batchOk(s,mask,level,base,warnTotal,alive,fallers){
 let safe=0;for(let i=0;i<s.total;i++)safe+=mask[i];
 if(safe<minSafe(s,alive))return false;
 if(safe>0){
  const lc=labelComponents(s,mask,s.lab);
  if(level===0){if(lc.count>Math.max(1,base.count))return false;}
  else if(level===1){let small=0;for(let k=1;k<=lc.count;k++)if(lc.sizes[k]<3)small++;if(safe>=6&&small>base.small)return false;}
 }
 const ef=escapeFactor(s);
 if(safe>0&&ef>0){
  const dist=escapeDist(s,mask);
  for(const p of fallers){
   const t=clampTile(s,p.x,p.y);if(mask[t]||s.st[t]===4)continue;
   const time=s.st[t]===0?warnTotal:timeLeft(s,t);
   const budget=time*C.botSpeed*.7*ef/s.T;
   if(dist[t]<0||dist[t]>budget+.6)return false;}
 }
 return true;
}
function acceptBatch(s,cand,N,level,base,warnTotal,alive,fallers){
 const mask=new Uint8Array(s.total);for(let i=0;i<s.total;i++)mask[i]=s.st[i]===0?1:0;
 const picked=[];
 for(const i of cand){
  if(picked.length>=N)break;if(!mask[i])continue;mask[i]=0;
  if(batchOk(s,mask,level,base,warnTotal,alive,fallers))picked.push(i);else mask[i]=1;}
 return picked;
}
const safeTiles=s=>{const a=[];for(let i=0;i<s.total;i++)if(s.st[i]===0)a.push(i);return a;};
const isSafe=(s,c,r)=>c>=0&&r>=0&&c<s.cols&&r<s.rows&&s.st[r*s.cols+c]===0;
function sortedBy(s,safe,N,fn){
 return safe.map(i=>({i,k:fn(i)})).sort((a,b)=>a.k-b.k).slice(0,N*2).map(o=>o.i);
}
function genEdge(s,safe,N){
 const edge=new Set(safe.filter(i=>{const c=colOf(s,i),r=rowOf(s,i);
  return c===0||r===0||c===s.cols-1||r===s.rows-1||!isSafe(s,c-1,r)||!isSafe(s,c+1,r)||!isSafe(s,c,r-1)||!isSafe(s,c,r+1);}));
 if(!edge.size)return[];
 const list=[...edge],start=list[Math.floor(rng(s)*list.length)],out=[],seen=new Set([start]),frontier=[start],nb=[0,0,0,0];
 while(frontier.length&&out.length<N*2){
  const i=frontier.splice(Math.floor(rng(s)*Math.min(frontier.length,3)),1)[0];out.push(i);
  const n=neighbors(s,i,nb);for(let k=0;k<n;k++)if(edge.has(nb[k])&&!seen.has(nb[k])){seen.add(nb[k]);frontier.push(nb[k]);}}
 return out;
}
function genPatch(s,safe,N,ci){
 if(ci==null)ci=safe[Math.floor(rng(s)*safe.length)];const cc=colOf(s,ci),cr=rowOf(s,ci);
 return sortedBy(s,safe,N,i=>(colOf(s,i)-cc)**2+(rowOf(s,i)-cr)**2+rng(s)*5);
}
function genLine(s,safe,N){
 const start=safe[Math.floor(rng(s)*safe.length)],dirs=[[1,0],[0,1],[1,1],[1,-1]],[dc,dr]=dirs[Math.floor(rng(s)*4)],out=[start];
 for(const sign of[1,-1]){let c=colOf(s,start),r=rowOf(s,start);
  while(out.length<N*2){c+=dc*sign;r+=dr*sign;if(!isSafe(s,c,r))break;out.push(r*s.cols+c);}}
 return out;
}
function genCorner(s,safe,N){
 const corners=[[0,0],[s.cols-1,0],[0,s.rows-1],[s.cols-1,s.rows-1]],[cc,cr]=corners[Math.floor(rng(s)*4)];
 return sortedBy(s,safe,N,i=>Math.hypot(colOf(s,i)-cc,rowOf(s,i)-cr)+rng(s)*1.6);
}
function genSnake(s,safe,N){
 let i=safe[Math.floor(rng(s)*safe.length)],dir=Math.floor(rng(s)*4);const D=[[1,0],[0,1],[-1,0],[0,-1]],out=[i],seen=new Set([i]);
 for(let step=0;step<N*5&&out.length<N*2;step++){
  if(rng(s)<.35)dir=(dir+(rng(s)<.5?1:3))%4;
  const nc=colOf(s,i)+D[dir][0],nr=rowOf(s,i)+D[dir][1];
  if(isSafe(s,nc,nr)&&!seen.has(nr*s.cols+nc)){i=nr*s.cols+nc;out.push(i);seen.add(i);}else dir=(dir+1)%4;}
 return out;
}
function genCenter(s,safe,N){
 const mx=(s.cols-1)/2,my=(s.rows-1)/2;
 return sortedBy(s,safe,N,i=>Math.hypot(colOf(s,i)-mx,rowOf(s,i)-my)+rng(s)*1.8);
}
function genSides(s,safe,N){
 const a=safe[Math.floor(rng(s)*safe.length)],mc=s.cols-1-colOf(s,a),mr=s.rows-1-rowOf(s,a);
 const b=safe.slice().sort((p,q)=>Math.hypot(colOf(s,p)-mc,rowOf(s,p)-mr)-Math.hypot(colOf(s,q)-mc,rowOf(s,q)-mr))[0];
 const half=Math.max(1,Math.ceil(N/2)),A=genPatch(s,safe,half,a),B=genPatch(s,safe,half,b),out=[];
 for(let k=0;k<Math.max(A.length,B.length);k++){if(A[k]!=null)out.push(A[k]);if(B[k]!=null)out.push(B[k]);}
 return out;
}
const PATTERNS=['edge','patch','line','corner','snake','center','sides'];
const W_EARLY=[3,2,1,2,1,.4,.4],W_MID=[1.6,2,2,1,2,1.4,1.4],W_LATE=[.8,2,2,.8,2,2.2,1.6];
function pickPattern(s,d){
 const w=PATTERNS.map((n,i)=>(d<.5?lerp(W_EARLY[i],W_MID[i],d/.5):lerp(W_MID[i],W_LATE[i],(d-.5)/.5))*(n===s.lastPattern?.4:1));
 let r=rng(s)*w.reduce((a,b)=>a+b,0);
 for(let i=0;i<w.length;i++)if((r-=w[i])<=0)return PATTERNS[i];return'patch';
}
function generate(s,name,safe,N){
 switch(name){case'edge':return genEdge(s,safe,N);case'line':return genLine(s,safe,N);case'corner':return genCorner(s,safe,N);
  case'snake':return genSnake(s,safe,N);case'center':return genCenter(s,safe,N);case'sides':return genSides(s,safe,N);default:return genPatch(s,safe,N);}
}
function scheduleBreak(s){
 const d=difficulty(s),late=s.clock>s.cap,sizeScale=Math.pow(s.total/96,.7);
 const maxActive=Math.round(lerp(4,26,d)*Math.pow(s.total/96,.6)*(late?1.6:1));
 if(s.active.length>=maxActive)return false;
 const safe=safeTiles(s);if(!safe.length)return false;
 const N=Math.max(1,Math.min(maxActive-s.active.length,Math.round((lerp(2,4.5,d)+rng(s)*2)*sizeScale*(late?1.8:1))));
 const warn=warnScale(s,d),warnTotal=(STAGE[0]+STAGE[1]+STAGE[2])*warn;
 const fallers=living(s.roster),alive=fallers.length;
 const base0=new Uint8Array(s.total);for(let i=0;i<s.total;i++)base0[i]=s.st[i]===0?1:0;
 const bl=labelComponents(s,base0,s.lab);let small=0;for(let k=1;k<=bl.count;k++)if(bl.sizes[k]<3)small++;
 const base={count:bl.count,small};
 const safeFrac=safe.length/s.total,levelStart=d<.5&&safeFrac>.4?0:d<.8?1:2;
 for(let attempt=0;attempt<4;attempt++){
  const name=pickPattern(s,d),cand=generate(s,name,safe,N);if(!cand.length)continue;
  for(let level=levelStart;level<=2;level++){
   const picked=acceptBatch(s,cand,N,level,base,warnTotal,alive,fallers);
   if(!picked.length)continue;
   for(const i of picked){s.st[i]=1;s.tm[i]=-rng(s)*.18;s.wp[i]=warn;s.active.push(i);}
   s.version++;s.lastPattern=name;return true;}}
 return false;
}
function breakInterval(s,d){
 let t=lerp(2.6,.7,Math.pow(d,.85));
 if(s.clock>s.cap)t*=Math.max(.35,1-(s.clock-s.cap)/25);
 return t*(.85+rng(s)*.3);
}
/* Contact-based, not movement-based: standing in place triggers both
   layers after their independent delay and grace period. */
function triggerContact(s,ps){
 let changed=false;
 for(const p of ps){
  if(!p.active||!p.bk?.alive)continue;
  const i=tileAt(s,p.x,p.y);p.bk.lastTile=i;
  if(i<0)continue;
  if(s.st[i]===0){
   s.st[i]=1;s.tm[i]=0;s.active.push(i);changed=true;
  }else if(s.st[i]===2&&s.clock>=s.ready[i]){
   s.st[i]=3;s.tm[i]=0;s.active.push(i);changed=true;
  }
 }
 if(changed)s.version++;
}
/* ===== Movement / collision / falling ===== */
function stick(p){
 if(window.PartyCharacters?.control){const v=window.PartyCharacters.control(p.input);if(v)return{x:Number(v.x)||0,y:Number(v.y)||0};}
 const k=p.input||{};let x=Number(k.axisX)||Number(!!k.right)-Number(!!k.left),y=Number(k.axisY)||Number(!!k.down)-Number(!!k.jump);
 const m=Math.hypot(x,y);return m>1?{x:x/m,y:y/m}:{x,y};
}
function movePlayer(s,p,dt,ps){
 const inp=p.isBot?botSteer(s,p,dt):stick(p);let x=inp.x,y=inp.y;const m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}
 p.vx+=x*C.accel*dt;p.vy+=y*C.accel*dt;
 const damp=Math.exp(-C.drag*dt);p.vx*=damp;p.vy*=damp;
 const sp=Math.hypot(p.vx,p.vy);if(sp>C.hardSpeed){p.vx*=C.hardSpeed/sp;p.vy*=C.hardSpeed/sp;}
 if(m>.1){p.dir={x:x/m,y:y/m};p.face=p.dir.x<0?-1:1;}
 p.x+=p.vx*dt;p.y+=p.vy*dt;
}
function clampField(s,p){
 const lo=C.foot+1,minX=s.x0+lo,maxX=s.x0+s.w-lo,minY=s.y0+lo,maxY=s.y0+s.h-lo;
 if(p.x<minX){p.x=minX;p.vx=Math.max(0,p.vx);}if(p.x>maxX){p.x=maxX;p.vx=Math.min(0,p.vx);}
 if(p.y<minY){p.y=minY;p.vy=Math.max(0,p.vy);}if(p.y>maxY){p.y=maxY;p.vy=Math.min(0,p.vy);}
}
// Physical push: bounded positional separation + impulse along the contact normal (no teleporting).
function resolveBodies(s,list){
 const D=C.radius*2;
 for(let it=0;it<2;it++)for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
  const a=list[i],b=list[j];let dx=b.x-a.x,dy=b.y-a.y;const d2=dx*dx+dy*dy;if(d2>=D*D)continue;
  let d=Math.sqrt(d2);if(d<1e-4){dx=1;dy=0;d=1;}const nx=dx/d,ny=dy/d,shift=Math.min((D-d)/2,C.maxShift);
  a.x-=nx*shift;a.y-=ny*shift;b.x+=nx*shift;b.y+=ny*shift;
  const rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
  if(it===0&&rel<0){const imp=-(1+C.restitution)*rel/2;a.vx-=imp*nx;a.vy-=imp*ny;b.vx+=imp*nx;b.vy+=imp*ny;}}
}
function startFall(s,p){
 const b=p.bk;b.alive=false;b.falling=true;b.fallT=0;b.mode='falling';b.eliminatedAt=s.clock;b.eliminatedTick=s.tick;
 let best=-1,bd=1e9;const t=clampTile(s,p.x,p.y),c0=colOf(s,t),r0=rowOf(s,t);
 for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
  const c=c0+dc,r=r0+dr;if(c<0||r<0||c>=s.cols||r>=s.rows)continue;const i=r*s.cols+c;if(s.st[i]!==4)continue;
  const q=tileCenter(s,i),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<bd){bd=d;best=i;}}
 b.pit=best>=0?tileCenter(s,best):null;
 dust(s,p.x,p.y,5,true);
}
function updateFallers(s,ps,dt){
 for(const p of ps){const b=p.bk;if(!p.active||!b?.falling)continue;
  b.fallT+=dt;
  if(b.pit){p.vx+=(b.pit.x-p.x)*9*dt;p.vy+=(b.pit.y-p.y)*9*dt;}
  const d=Math.exp(-4.5*dt);p.vx*=d;p.vy*=d;p.x+=p.vx*dt;p.y+=p.vy*dt;
  if(b.fallT>=C.fallTime){b.falling=false;b.mode='out';}}
}
/* ===== Bot controller (path planning only on tile/situation change) ===== */
function newBot(s,p){
 return{path:[],pi:0,target:-1,planVersion:-1,nextPlan:s.clock+.2+rng(s)*.6,lock:0,hist:[],ax:0,ay:0,
  courage:.35+rng(s)*.65,aggr:rng(s),dodgy:rng(s),bias:(rng(s)*1e6)|0,lastX:p.x,lastY:p.y,chk:.5,stuck:0,moving:false,
  side:{x:0,y:0},sideUntil:0,charge:null,avoid:-1,avoidUntil:0,attackUntil:0,attackCd:0};
}
function navInfo(s){
 if(s.nav.version===s.version)return s.nav;
 for(let i=0;i<s.total;i++)s.nmask[i]=s.st[i]===0?1:0;
 s.nav.sizes=labelComponents(s,s.nmask,s.nav.lab).sizes;s.nav.version=s.version;return s.nav;
}
function planBot(s,p,bot){
 const T=s.T,t0=clampTile(s,p.x,p.y),nav=navInfo(s),dist=s.bdist,par=s.bpar,q=s.q,nb=s.nbuf;
 dist.fill(-1);par.fill(-1);let h=0,t=0;dist[t0]=0;q[t++]=t0;
 while(h<t){const a=q[h++],n=neighbors(s,a,nb);
  for(let k=0;k<n;k++){const b=nb[k];if(dist[b]>=0||s.st[b]>3)continue;
   if(b===bot.avoid&&s.clock<bot.avoidUntil)continue;
   const steps=dist[a]+1;if(timeLeft(s,b)<=steps*T/C.botSpeed+.18+(1-bot.courage)*.25)continue;
   dist[b]=steps;par[b]=a;q[t++]=b;}}
 const others=s.roster.filter(o=>o!==p&&o.active&&o.bk?.alive),alive=others.length+1;
 let best=-1,bs=-1e9;
 for(let i=0;i<s.total;i++){
  if(dist[i]<0||s.st[i]!==0)continue;
  const c=colOf(s,i),r=rowOf(s,i);let safe5=0,non8=0;
  for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){
   const ok=isSafe(s,c+dc,r+dr);if(ok)safe5++;else if(Math.abs(dr)<=1&&Math.abs(dc)<=1&&(dr||dc))non8++;}
  const size=nav.sizes[nav.lab[i]]||0;
  let sc=safe5*.55-non8*(.7+(1-bot.courage)*.5)-dist[i]*(.5-.1*bot.courage)+Math.min(size,70)*.08;
  if(size<6&&alive>2)sc-=5;
  const ctr=tileCenter(s,i);
  for(const o of others){if(Math.hypot(o.x-ctr.x,o.y-ctr.y)<T*1.6)sc+=bot.aggr>.7?.8:-(1+(1-bot.aggr)*1.6);}
  sc+=hash(i,bot.bias)*.9;
  if(i===bot.target)sc+=2.2+(bot.lock>s.clock?4:0);
  if(sc>bs){bs=sc;best=i;}}
 if(best<0){let bt=-1;
  for(let i=0;i<s.total;i++){if(dist[i]<0)continue;const l=timeLeft(s,i)-dist[i]*.15;if(l>bt){bt=l;best=i;}}}
 const path=[];
 if(best>=0){for(let i=best;i>=0&&i!==t0;i=par[i])path.push(i);path.reverse();}
 if(best!==bot.target){bot.hist.push(s.clock);if(bot.hist.length>5)bot.hist.shift();
  if(bot.hist.length>=4&&s.clock-bot.hist[bot.hist.length-4]<3)bot.lock=s.clock+2.2;}
 bot.path=path;bot.pi=0;bot.target=best;bot.planVersion=s.version;bot.nextPlan=s.clock+.9+rng(s)*.9;
}
function pathStillValid(s,bot){
 if(bot.target<0||s.st[bot.target]!==0)return false;
 for(let k=bot.pi,n=0;k<bot.path.length&&n<5;k++,n++){
  const i=bot.path[k];if(s.st[i]>3)return false;if(timeLeft(s,i)<=(n+1)*s.T/C.botSpeed+.1)return false;}
 return true;
}
function botSteer(s,p,dt){
 const b=p.bk,bot=b.bot,t=s.clock,T=s.T,here=clampTile(s,p.x,p.y);
 let need=false,emergency=false;
 if(bot.planVersion!==s.version){bot.planVersion=s.version;if(!pathStillValid(s,bot)){need=true;emergency=s.st[here]>0;}}
 if(s.st[here]>0&&(bot.target<0||s.st[bot.target]!==0))need=emergency=true;
 if(t>=bot.nextPlan&&t>=bot.lock)need=true;
 bot.chk-=dt;
 if(bot.chk<=0){bot.chk=.5;
  const moved=Math.hypot(p.x-bot.lastX,p.y-bot.lastY);
  bot.stuck=bot.moving&&moved<7?bot.stuck+1:0;bot.lastX=p.x;bot.lastY=p.y;
  if(bot.stuck>=3){bot.stuck=0;need=true;bot.avoid=bot.path[bot.pi]??-1;bot.avoidUntil=t+1.5;
   const a=rng(s)*TAU;bot.side={x:Math.cos(a),y:Math.sin(a)};bot.sideUntil=t+.35;}}
 if(need&&(emergency||s.planBudget>0)){if(!emergency)s.planBudget--;planBot(s,p,bot);}
 // path following
 while(bot.pi<bot.path.length){const w=tileCenter(s,bot.path[bot.pi]);if(Math.hypot(w.x-p.x,w.y-p.y)<9)bot.pi++;else break;}
 let tx=p.x,ty=p.y,goal=false;
 if(bot.pi<bot.path.length){
  let k=bot.pi;if(k+1<bot.path.length){const cur=tileCenter(s,bot.path[k]);if(Math.hypot(cur.x-p.x,cur.y-p.y)<T*.5)k++;}
  const w=tileCenter(s,bot.path[k]);tx=w.x;ty=w.y;goal=true;
 }else if(bot.target>=0&&s.st[bot.target]===0){const w=tileCenter(s,bot.target);tx=w.x;ty=w.y;goal=true;}
 let dx=0,dy=0;
 if(goal){const ddx=tx-p.x,ddy=ty-p.y,d=Math.hypot(ddx,ddy);if(d>5){const k=clamp(d/24,0,1);dx=ddx/d*k;dy=ddy/d*k;}}
 bot.moving=Math.hypot(dx,dy)>.5;
 const nearby=living(s.roster).filter(o=>o!==p);
 // dodge a head-on charger (side chosen toward a safe tile)
 if(bot.dodgy>.45&&t>=bot.sideUntil)for(const o of nearby){
  const rx=o.x-p.x,ry=o.y-p.y,d=Math.hypot(rx,ry);if(d>64||d<1)continue;
  const closing=-((o.vx-p.vx)*rx+(o.vy-p.vy)*ry)/d;if(closing<120)continue;
  const px=-ry/d,py=rx/d,sa=s.st[clampTile(s,p.x+px*T*.8,p.y+py*T*.8)]===0,sb=s.st[clampTile(s,p.x-px*T*.8,p.y-py*T*.8)]===0;
  if(!sa&&!sb)break;const sg=sa&&sb?(rng(s)<.5?1:-1):sa?1:-1;
  bot.side={x:px*sg,y:py*sg};bot.sideUntil=t+.3;break;}
 if(t<bot.sideUntil){dx+=bot.side.x*1.1;dy+=bot.side.y*1.1;}
 // shove a rival who is standing on the brink — only from solid, uncracked ground
 if(t<bot.attackUntil&&bot.charge){
  if(s.st[here]!==0)bot.attackUntil=0;else{dx=bot.charge.x;dy=bot.charge.y;bot.moving=true;}
 }else if(bot.aggr>.55&&t>=bot.attackCd&&s.st[here]===0){
  for(const o of nearby){
   const rx=o.x-p.x,ry=o.y-p.y,d=Math.hypot(rx,ry);if(d>120||d<1)continue;
   const ux=rx/d,uy=ry/d,oi=clampTile(s,o.x,o.y),ei=tileAt(s,o.x+ux*T*.85,o.y+uy*T*.85);
   const brink=(ei>=0&&s.st[ei]>=3)||s.st[oi]>=2;
   const mi=tileAt(s,p.x+ux*Math.min(d,T)*.8,p.y+uy*Math.min(d,T)*.8);
   if(brink&&mi>=0&&s.st[mi]===0&&supportCount(s,p.x+ux*12,p.y+uy*12)===9){
    bot.charge={x:ux,y:uy};bot.attackUntil=t+.5;bot.attackCd=t+1.4+rng(s)*1.4;dx=ux;dy=uy;bot.moving=true;break;}}
 }
 const mag=Math.hypot(dx,dy);if(mag>1){dx/=mag;dy/=mag;}
 const a=1-Math.exp(-12*dt);bot.ax+=(dx-bot.ax)*a;bot.ay+=(dy-bot.ay)*a;
 return{x:bot.ax,y:bot.ay};
}
/* ===== Setup / step / update ===== */
function spawnTiles(s,n){
 const cand=[];for(let r=1;r<s.rows-1;r++)for(let c=1;c<s.cols-1;c++)cand.push(r*s.cols+c);
 for(let i=cand.length-1;i>0;i--){const j=Math.floor(rng(s)*(i+1));[cand[i],cand[j]]=[cand[j],cand[i]];}
 const out=[],dist=(a,b)=>Math.hypot(colOf(s,a)-colOf(s,b),rowOf(s,a)-rowOf(s,b));
 for(let minD=4;minD>=1&&out.length<n;minD-=.5)for(const i of cand){
  if(out.length>=n)break;if(out.includes(i))continue;if(out.every(j=>dist(i,j)>=minD))out.push(i);}
 for(const i of cand){if(out.length>=n)break;if(!out.includes(i))out.push(i);}
 return out;
}
function setup(round,ps){
 if(!ps.length||ps.length>12)throw Error('BLOCK BREAKERS supports 1–12 players');
 const A=window.BlockBreakersArt,n=ps.length,L=A.layout(n>=7),total=L.cols*L.rows;
 const seed=((Number(round.blockBreakersSeed)||(Date.now()^0x5bd1e99))>>>0)||1;
 const s={clock:0,tick:0,accumulator:0,seed,fxSeed:(seed^0x9e3779b9)>>>0||1,layout:L,big:L.big,cols:L.cols,rows:L.rows,total,
  T:L.tile,x0:L.x,y0:L.y,w:L.w,h:L.h,
  st:new Uint8Array(total),tm:new Float32Array(total),ready:new Float32Array(total),wp:new Float32Array(total).fill(1),active:[],holes:0,version:0,dirty:[],
  q:new Int16Array(total),lab:new Int16Array(total),dist:new Int16Array(total),bdist:new Int16Array(total),bpar:new Int16Array(total),
  nmask:new Uint8Array(total),nbuf:[0,0,0,0],nav:{version:-1,lab:new Int16Array(total),sizes:[0]},
  parts:[],nextBreak:C.startDelay,lastPattern:null,planBudget:2,finished:false,winnerIds:[],ranking:[],roster:ps,originalCount:n,
  cap:n===1?C.soloDuration:C.maxDuration,cache:null};
 round.blockBreakers=s;round.remaining=n===1?C.soloDuration:null;
 const tiles=spawnTiles(s,n),mid={x:s.x0+s.w/2,y:s.y0+s.h/2};
 ps.forEach((p,i)=>{
  const c=tileCenter(s,tiles[i]);p.active=true;p.score=0;p.x=c.x;p.y=c.y;p.vx=0;p.vy=0;
  const dx=mid.x-c.x,dy=mid.y-c.y,m=Math.hypot(dx,dy)||1;p.dir={x:dx/m,y:dy/m};p.face=dx<0?-1:1;
  p.bk={alive:true,falling:false,fallT:0,eliminatedAt:null,eliminatedTick:null,mode:'alive',pit:null,bot:null,lastTile:tiles[i]};
  if(p.isBot)p.bk.bot=newBot(s,p);});
 if(typeof document!=='undefined')s.cache=A.build(L,seed);
 return s;
}
function finish(s,round,ps){
 s.finished=true;const list=ps.filter(p=>p.active),val=p=>p.bk.alive?Infinity:p.bk.eliminatedTick??-1;
 // Equal loss tick => equal rank (shared tie handled by the central ranking).
 s.ranking=list.map(p=>({id:p.id,value:val(p),rank:1+list.filter(q=>val(q)>val(p)).length}))
  .sort((a,b)=>a.rank-b.rank||String(a.id).localeCompare(String(b.id)));
 s.winnerIds=s.ranking.filter(r=>r.rank===1).map(r=>r.id);
 if(s.originalCount===1&&!list[0]?.bk.alive)s.winnerIds=[];
 round.remaining=0;
}
function step(dt,round,ps){
 const s=round.blockBreakers;if(!s||s.finished)return;
 s.tick++;s.clock+=dt;s.planBudget=2;
 const live=living(ps);
 for(const p of live)movePlayer(s,p,dt,ps);
 for(const p of live)clampField(s,p);
 resolveBodies(s,live);
 for(const p of live){clampField(s,p);if(supportCount(s,p.x,p.y)<C.supportMin)startFall(s,p);}
 triggerContact(s,live);
 updateTiles(s,dt);
 updateFallers(s,ps,dt);updateParts(s,dt);
 const survivors=living(ps).length;
 if(s.originalCount===1){if(!survivors||s.clock>=s.cap)finish(s,round,ps);}
 else if(survivors<=1||s.clock>=s.cap)finish(s,round,ps);
 if(!s.finished)round.remaining=ps.length===1?Math.max(0,s.cap-s.clock):null;
}
function update(dt,round,ps){
 const s=round.blockBreakers;if(!s)return null;
 if(s.finished){const d=clamp(dt,0,.05);updateFallers(s,ps,d);updateParts(s,d);return'winner';}
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.25,s.accumulator+clamp(dt,0,.25));
 let cycles=0;
 while(s.accumulator+1e-9>=STEP&&cycles++<15&&!s.finished){step(STEP,round,ps);s.accumulator-=STEP;}
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.blockBreakers;
 return{survivors:living(ps).length,tilesLeft:s?s.total-s.holes:0,remaining:round.remaining,elapsed:s?.clock||0,
  winnerIds:s?.winnerIds||[],statuses:ps.filter(p=>p.active).map(p=>({id:p.id,mode:p.bk?.mode}))};
}
/* ===== Rendering ===== */
function drawActor(g,p,s){
 if(window.PartyCharacters?.draw)window.PartyCharacters.draw(g,p,{time:s.clock,label:false});
 else{g.fillStyle=p.color||'#f5c87a';g.beginPath();g.arc(p.x,p.y,C.radius,0,TAU);g.fill();}
}
function drawParts(g,s){
 for(const q of s.parts){const f=clamp(q.life/q.max,0,1);
  if(q.kind==='dust'){g.fillStyle='rgba(238,205,140,'+(f*.5).toFixed(3)+')';g.beginPath();g.arc(q.x,q.y,q.size,0,TAU);g.fill();}
  else{const sz=q.size*(.35+.65*f);g.save();g.globalAlpha=f;g.translate(q.x,q.y);g.rotate(q.rot);
   g.fillStyle=q.col;g.fillRect(-sz/2,-sz/2,sz,sz*.7);g.strokeStyle='rgba(60,30,5,.6)';g.lineWidth=1;g.strokeRect(-sz/2,-sz/2,sz,sz*.7);g.restore();}}
}
function draw(g,time,round,ps){
 const s=round.blockBreakers;if(!s)return;
 const A=window.BlockBreakersArt,cache=s.cache||(s.cache=A.build(s.layout,s.seed)),L=s.layout;
 A.flushHoles(cache,s);
 g.save();
 g.drawImage(cache.backdrop,0,0,L.W,L.H);
 g.drawImage(cache.floor,s.x0,s.y0,s.w,s.h);
 g.drawImage(cache.holes,s.x0,s.y0,s.w,s.h);
 // The lower layer stays visibly exposed between the two impacts.
 for(let i=0;i<s.total;i++)if(s.st[i]===2)A.drawBreaking(g,L,cache,i,2,0,s.clock);
 for(const i of s.active){
  const state=s.st[i],dur=(state===1?TIMING.crack:TIMING.collapse)*s.wp[i];
  A.drawBreaking(g,L,cache,i,state,clamp(s.tm[i]/dur,0,1),s.clock);}
 for(const p of ps){const b=p.bk;if(!p.active||!b?.falling)continue;
  const e=clamp(b.fallT/C.fallTime,0,1),sc=1-.82*e;
  g.save();g.fillStyle='rgba(0,0,0,'+(.5*(1-e)).toFixed(3)+')';g.beginPath();g.ellipse(p.x,p.y+8,16*(1-e*.6),8*(1-e*.6),0,0,TAU);g.fill();
  g.globalAlpha=1-e*e;g.translate(p.x,p.y+e*16);g.scale(sc,sc);g.translate(-p.x,-p.y);drawActor(g,p,s);g.restore();}
 const live=living(ps).sort((a,b)=>a.y-b.y);
 for(const p of live){g.fillStyle='rgba(80,40,0,.28)';g.beginPath();g.ellipse(p.x,p.y+10,13,6,0,0,TAU);g.fill();}
 for(const p of live)drawActor(g,p,s);
 drawParts(g,s);
 g.restore();
}
/* ===== Results / roster / controller ===== */
function getResult(round,players){
 const byId=new Map(round.blockBreakers.ranking.map(x=>[x.id,x]));
 return players.filter(p=>p.active).map(p=>{
  const rank=byId.get(p.id)?.rank||players.length;
  return{id:p.id,value:-rank,label:p.bk?.alive?'รอดชีวิต':'ตกหลุม '+(p.bk?.eliminatedAt||0).toFixed(1)+' วินาที'};});
}
function getResultHeading(round,ranked){
 const ids=round.blockBreakers.winnerIds||[],w=ranked.filter(p=>ids.includes(p.id));
 return w.length>1?'ผู้ชนะร่วม: '+w.map(p=>p.name).join(' / '):w.length?'ผู้ชนะ: '+w[0].name:'ไม่มีผู้ชนะ';
}
function renderRoster(root,active,round){
 const ordered=[...active].sort((a,b)=>Number(b.bk?.alive)-Number(a.bk?.alive)||(b.bk?.eliminatedTick||0)-(a.bk?.eliminatedTick||0));
 for(const p of ordered){
  const box=document.createElement('div');box.className='leader-chip';
  if(!p.bk?.alive)box.classList.add('shockwave-eliminated');
  const dot=document.createElement('span');dot.className='circle';dot.style.background=p.color;
  const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;
  const role=document.createElement('small');role.className='leader-role';role.textContent=p.bk?.alive?'รอด':'ตกหลุม';
  const empty=document.createElement('span');empty.className='leader-item-slot';empty.textContent=' ';
  box.append(dot,name,role,empty);root.append(box);}
}
function getControllerPacket(p,round){
 const s=round.blockBreakers;
 return{t:'block-breakers-status',mode:round.mode,status:p.bk?.alive?'alive':'out',
  survivorCount:s?s.roster.filter(q=>q.active&&q.bk?.alive).length:0,tilesLeft:s?s.total-s.holes:0};
}
window.BlockBreakers=Object.freeze({getControllerPacket,renderRoster,getResult,getResultHeading,resultTitle:'ผู้รอดชีวิตคนสุดท้าย!',
 countdownSeconds:3,hudBadge:{duringCountdown:'players',duringPlay:'players'},setup,update,draw,hud,step,
 supportCount,scheduleBreak,config:C,timing:TIMING});
})();
