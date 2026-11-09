/* COLOR CLAIM — host-authoritative territory capture, 60 Hz swept trails. */
(() => {
'use strict';
const STEP=1/60,CELL=10,TAU=Math.PI*2,INF=1e20;
const SETTINGS=Object.freeze({small:{w:960,h:540,duration:40},large:{w:1280,h:720,duration:60},
 speed:192,radius:13,trailWidth:5,respawn:.7,protection:.7,freezeDuration:4,
 itemMin:12,itemMax:15,acceleration:.095,friction:.12});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rng=s=>{let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x||1;return (s.seed>>>0)/4294967296;};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const active=ps=>ps.filter(p=>p.active&&p.cc);
function seedFor(round){
 const explicit=Number(round.colorClaimSeed);
 if(Number.isFinite(explicit)&&explicit!==0)return explicit>>>0;
 let seed=0;try{const a=new Uint32Array(1);window.crypto?.getRandomValues?.(a);seed=a[0];}catch(_){}
 return seed||((Math.random()*0xffffffff)>>>0)||1;
}
function index(s,x,y){
 const c=Math.floor((x-s.field.x)/CELL),r=Math.floor((y-s.field.y)/CELL);
 return c<0||r<0||c>=s.cols||r>=s.rows?-1:r*s.cols+c;
}
function owned(s,p,x,y){const i=index(s,x,y);return i>=0&&s.owner[i]===p.cc.slot;}
function center(s,i){return{x:s.field.x+(i%s.cols+.5)*CELL,y:s.field.y+(Math.floor(i/s.cols)+.5)*CELL};}
function trace(s,from,to,mark){
 const n=Math.max(1,Math.ceil(dist(from,to)/(CELL*.35)));
 for(let j=0;j<=n;j++){
  const t=j/n,i=index(s,from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t);
  if(i>=0)mark(i);
 }
}
function claimDisk(s,slot,x,y,radius){
 const minX=Math.max(0,Math.floor((x-radius-s.field.x)/CELL)),maxX=Math.min(s.cols-1,Math.ceil((x+radius-s.field.x)/CELL));
 const minY=Math.max(0,Math.floor((y-radius-s.field.y)/CELL)),maxY=Math.min(s.rows-1,Math.ceil((y+radius-s.field.y)/CELL));
 for(let y0=minY;y0<=maxY;y0++)for(let x0=minX;x0<=maxX;x0++){
  const cx=s.field.x+(x0+.5)*CELL,cy=s.field.y+(y0+.5)*CELL;
  if((cx-x)**2+(cy-y)**2<=radius*radius)s.owner[y0*s.cols+x0]=slot;
 }
 s.dirty=true;
}
// Physical-width territory: a character has radius 13px while each cell
// measures 10px. A usable centre needs all eight neighbouring cells to be
// owned too (a ~30px passage). Find connected components of these centres,
// keep the largest one for each player, then restore the one-cell boundary.
// This morphological opening removes thin spurs / needle-like extensions
// WITHOUT shrinking broad land on every new capture. A one/two-cell bridge
// cannot connect separate lobes just because the rendered colour touches.
function pruneUnplayableTerritory(s){
 const land=s.owner,n=land.length,w=s.cols,h=s.rows;
 const core=new Uint8Array(n),region=new Int32Array(n).fill(-1);
 const queue=new Int32Array(n),bestId=new Int32Array(s.counts.length).fill(-1);
 const bestSize=new Int32Array(s.counts.length);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=y*w+x,slot=land[i];if(slot<0||slot>=bestId.length)continue;
  if(land[i-1]===slot&&land[i+1]===slot&&
     land[i-w]===slot&&land[i+w]===slot&&
     land[i-w-1]===slot&&land[i-w+1]===slot&&
     land[i+w-1]===slot&&land[i+w+1]===slot)core[i]=1;
 }
 let nextId=0;
 for(let root=0;root<n;root++){
  if(!core[root]||region[root]>=0)continue;
  const id=nextId++,slot=land[root];let head=0,tail=1;
  queue[0]=root;region[root]=id;
  while(head<tail){
   const i=queue[head++],x=i%w;
   if(x>0&&core[i-1]&&region[i-1]<0){region[i-1]=id;queue[tail++]=i-1;}
   if(x<w-1&&core[i+1]&&region[i+1]<0){region[i+1]=id;queue[tail++]=i+1;}
   if(i>=w&&core[i-w]&&region[i-w]<0){region[i-w]=id;queue[tail++]=i-w;}
   if(i<n-w&&core[i+w]&&region[i+w]<0){region[i+w]=id;queue[tail++]=i+w;}
  }
  // Exact ties resolve deterministically to the upper-leftmost core cell.
  if(tail>bestSize[slot]){bestSize[slot]=tail;bestId[slot]=id;}
 }
 const playable=new Uint8Array(n);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=y*w+x,slot=land[i];if(slot<0||!core[i]||region[i]!==bestId[slot])continue;
  // Every square neighbour is guaranteed owned by the same player.
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)
   playable[i+dy*w+dx]=1;
 }
 let lost=null;
 for(let i=0;i<n;i++)if(land[i]>=0&&!playable[i]){
  if(!lost)lost=new Uint8Array(n);
  lost[i]=1;land[i]=-1;
 }
 return lost;
}
// Once a capture cuts an owner's territory, only their largest four-connected
// component survives. Detached fragments become neutral (-1), NOT the
// attacker's colour. A diagonal touch does not reconnect two islands.
function discardCutFragments(s){
 const land=s.owner,n=land.length,labels=new Int32Array(n).fill(-1);
 const queue=new Int32Array(n),bestId=new Int32Array(s.counts.length).fill(-1);
 const bestSize=new Int32Array(s.counts.length);
 let nextId=0;
 for(let root=0;root<n;root++){
  const slot=land[root];
  if(slot<0||slot>=bestId.length||labels[root]>=0)continue;
  const id=nextId++;let head=0,tail=1;queue[0]=root;labels[root]=id;
  while(head<tail){
   const cell=queue[head++],x=cell%s.cols,y=Math.floor(cell/s.cols);
   // Avoid allocating closures/arrays per grid cell on low-end phones.
   if(x>0&&labels[cell-1]<0&&land[cell-1]===slot){
    labels[cell-1]=id;queue[tail++]=cell-1;
   }
   if(x<s.cols-1&&labels[cell+1]<0&&land[cell+1]===slot){
    labels[cell+1]=id;queue[tail++]=cell+1;
   }
   if(y>0&&labels[cell-s.cols]<0&&land[cell-s.cols]===slot){
    labels[cell-s.cols]=id;queue[tail++]=cell-s.cols;
   }
   if(y<s.rows-1&&labels[cell+s.cols]<0&&land[cell+s.cols]===slot){
    labels[cell+s.cols]=id;queue[tail++]=cell+s.cols;
   }
  }
  // Ties retain the first (top-leftmost) region for deterministic results.
  if(tail>bestSize[slot]){bestSize[slot]=tail;bestId[slot]=id;}
 }
 let lost=null;
 for(let i=0;i<n;i++){
  const slot=land[i];
  if(slot>=0&&slot<bestId.length&&labels[i]!==bestId[slot]){
   if(!lost)lost=new Uint8Array(n);
   lost[i]=1;land[i]=-1;
  }
 }
 return lost;
}
function recount(s,ps){
 // Prune ALL owners after ownership transfers, before score/spawn checks.
 // This ensures newly detached tiles never contribute to the next frame.
 const inaccessible=pruneUnplayableTerritory(s);
 const cut=discardCutFragments(s);
 s.counts.fill(0);
 for(const slot of s.owner)if(slot>=0&&slot<s.counts.length)s.counts[slot]++;
 for(const p of ps)if(p.cc)p.score=s.counts[p.cc.slot]/s.owner.length*100;
 // Ownership changes are authoritative immediately, including during a
 // different player's capture. Never wait for the victim's next movement.
 for(const p of ps){
  const q=p.cc;if(!q||q.eliminated)continue;
  if(s.counts[q.slot]===0){eliminate(s,p);continue;}
  if(q.alive&&q.trail.length&&q.anchor!==null&&s.owner[q.anchor]!==q.slot){
   kill(s,p);continue;
  }
  // If an island beneath an idle player was cut away, kill and respawn on
  // their surviving main island. Also honour protection's stolen-tile rule.
  const here=index(s,p.x,p.y);
  if(q.alive&&!q.trail.length&&!owned(s,p,p.x,p.y)&&
    (q.invulnerable>0||(cut&&here>=0&&cut[here])||
     (inaccessible&&here>=0&&inaccessible[here])))
   kill(s,p);
 }
 s.dirty=true;
}
function startPositions(s,count){
 const result=[],phase=rng(s)*TAU,one=count===1;
 for(let i=0;i<count;i++){
  const a=phase+TAU*i/count,spread=count<=3?.28:count<=6?.32:.36;
  result.push({x:s.field.x+s.field.w*(.5+Math.cos(a)*(one?0:spread)),
   y:s.field.y+s.field.h*(.5+Math.sin(a)*(one?0:spread))});
 }
 return result;
}
function setup(round,ps){
 if(ps.length<1||ps.length>12)throw Error('COLOR CLAIM supports 1–12 players');
 const config=ps.length<=6?SETTINGS.small:SETTINGS.large;
 const field={x:30,y:30,w:config.w-60,h:config.h-60};
 const s={w:config.w,h:config.h,field,cols:field.w/CELL,rows:field.h/CELL,
  owner:new Int16Array(field.w/CELL*field.h/CELL).fill(-1),
  counts:new Int32Array(ps.length),roster:ps,seed:seedFor(round),
  elapsed:0,duration:config.duration,remaining:config.duration,accumulator:0,tick:0,
  dirty:true,finished:false,item:null,nextItem:6,freeze:null,
  ranking:[],winnerIds:[],visualClock:0};
 // Snap spawn centres to ownership cells so every player starts with exactly
 // the same number of owned tiles, regardless of angle and pixel fraction.
 const positions=startPositions(s,ps.length).map(v=>center(s,index(s,v.x,v.y)));
 ps.forEach((p,slot)=>{
  const q=positions[slot];p.active=true;p.score=0;p.x=q.x;p.y=q.y;
  p.vx=0;p.vy=0;p.dir={x:1,y:0};p.face=1;
  p.cc={slot,alive:true,respawn:0,invulnerable:0,trail:[],distance:0,
   origin:null,anchor:null,eliminated:false,deaths:0,bot:null,shieldClock:0};
 });
 // Small, equal circular home territories with enough space to respawn.
 for(const p of ps)claimDisk(s,p.cc.slot,p.x,p.y,ps.length>6?25:27);
 recount(s,ps);
 round.colorClaim=s;round.remaining=s.duration;
 return s;
}
function pointSegment2(p,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy||1;
 const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/den,0,1);
 return(p.x-a.x-dx*t)**2+(p.y-a.y-dy*t)**2;
}
function segmentsTouch(a,b,c,d,r=0){
 const cross=(p,q,v)=>(q.x-p.x)*(v.y-p.y)-(q.y-p.y)*(v.x-p.x);
 const c1=cross(a,b,c),c2=cross(a,b,d),c3=cross(c,d,a),c4=cross(c,d,b);
 if(((c1>0&&c2<0)||(c1<0&&c2>0))&&
    ((c3>0&&c4<0)||(c3<0&&c4>0)))return true;
 const limit=r*r;
 return pointSegment2(a,c,d)<=limit||pointSegment2(b,c,d)<=limit||
  pointSegment2(c,a,b)<=limit||pointSegment2(d,a,b)<=limit;
}
function gridTrails(s,ps){
 // The broad-phase index must use the same world-space thickness as
 // trailHits(); otherwise 7–12-player cuts can miss bucket boundaries.
 const map=new Map(),bucket=32,padding=6*(s.w/960);
 for(const p of ps){
  const cc=p.cc;if(!cc?.alive||cc.trail.length<2)continue;
  for(let k=1;k<cc.trail.length;k++){
   const a=cc.trail[k-1],b=cc.trail[k],segment={a,b,owner:p,at:b.d};
   const x0=Math.floor((Math.min(a.x,b.x)-padding)/bucket),x1=Math.floor((Math.max(a.x,b.x)+padding)/bucket);
   const y0=Math.floor((Math.min(a.y,b.y)-padding)/bucket),y1=Math.floor((Math.max(a.y,b.y)+padding)/bucket);
   for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
    const key=x+','+y;if(!map.has(key))map.set(key,[]);map.get(key).push(segment);
   }
  }
 }
 return map;
}
function trailHits(map,a,b,r=5){
 const size=32,x0=Math.floor((Math.min(a.x,b.x)-r)/size),x1=Math.floor((Math.max(a.x,b.x)+r)/size);
 const y0=Math.floor((Math.min(a.y,b.y)-r)/size),y1=Math.floor((Math.max(a.y,b.y)+r)/size);
 const seen=new Set();
 for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)
  for(const segment of map.get(x+','+y)||[])seen.add(segment);
 return [...seen].filter(e=>segmentsTouch(a,b,e.a,e.b,r));
}
function freezeActive(s,p){return !!s.freeze&&s.elapsed<s.freeze.until&&s.freeze.ownerId!==p.id;}
// Find connected components of the player's CURRENT land. Respawning on
// scattered pixels or on land once owned by the player is never allowed.
function largestTerritory(s,slot){
 const n=s.owner.length,visited=new Uint8Array(n),queue=new Int32Array(n);
 let biggest=[],centroidX=0,centroidY=0;
 for(let root=0;root<n;root++){
  if(s.owner[root]!==slot||visited[root])continue;
  let head=0,tail=1,xSum=0,ySum=0;queue[0]=root;visited[root]=1;
  while(head<tail){
   const i=queue[head++],x=i%s.cols,y=Math.floor(i/s.cols);
   xSum+=x;ySum+=y;
   const near=[x>0?i-1:-1,x<s.cols-1?i+1:-1,
    y>0?i-s.cols:-1,y<s.rows-1?i+s.cols:-1];
   for(const j of near)if(j>=0&&!visited[j]&&s.owner[j]===slot){
    visited[j]=1;queue[tail++]=j;
   }
  }
  if(tail>biggest.length){
   biggest=Array.from(queue.subarray(0,tail));
   centroidX=xSum/tail;centroidY=ySum/tail;
  }
 }
 return{cells:biggest,cx:centroidX,cy:centroidY,size:biggest.length};
}
function spawnPlace(s,p,ps){
 const land=largestTerritory(s,p.cc.slot);
 if(!land.size)return null;
 // Multi-source distance transform: the best tile is deep inside the largest
 // territory, near its centre and away from other players.
 const chosen=new Uint8Array(s.owner.length),depth=new Int16Array(s.owner.length);
 const queue=new Int32Array(land.size);let head=0,tail=0;
 for(const i of land.cells)chosen[i]=1;
 for(const i of land.cells){
  const x=i%s.cols,y=Math.floor(i/s.cols);
  if(x===0||y===0||x===s.cols-1||y===s.rows-1||
    !chosen[i-1]||!chosen[i+1]||!chosen[i-s.cols]||!chosen[i+s.cols]){
   depth[i]=1;queue[tail++]=i;
  }
 }
 while(head<tail){
  const i=queue[head++],x=i%s.cols,y=Math.floor(i/s.cols);
  const near=[x>0?i-1:-1,x<s.cols-1?i+1:-1,
   y>0?i-s.cols:-1,y<s.rows-1?i+s.cols:-1];
  for(const j of near)if(j>=0&&chosen[j]&&!depth[j]){
   depth[j]=depth[i]+1;queue[tail++]=j;
  }
 }
 const enemies=ps.filter(o=>o!==p&&o.cc?.alive);
 let best=land.cells[0],bestScore=-INF;
 for(const i of land.cells){
  const x=i%s.cols,y=Math.floor(i/s.cols),pos=center(s,i);
  const enemyDist=enemies.length?Math.min(...enemies.map(o=>dist(pos,o))):150;
  const score=depth[i]*100-Math.hypot(x-land.cx,y-land.cy)*.20+
   Math.min(150,enemyDist)*.025;
  if(score>bestScore){bestScore=score;best=i;}
 }
 return center(s,best);
}
function eliminate(s,p){
 const q=p.cc;if(!q||q.eliminated)return;
 q.alive=false;q.eliminated=true;q.respawn=0;q.invulnerable=0;
 q.trail=[];q.distance=0;q.origin=null;q.anchor=null;q.bot=null;
 p.vx=0;p.vy=0;
}
function kill(s,p){
 const q=p.cc;if(!q||q.eliminated)return;
 if(s.counts[q.slot]===0){eliminate(s,p);return;}
 if(!q.alive)return;
 q.alive=false;q.respawn=SETTINGS.respawn;q.invulnerable=0;
 q.trail=[];q.distance=0;q.origin=null;q.anchor=null;q.deaths++;q.bot=null;
 p.vx=0;p.vy=0;
}
function revive(s,p,ps){
 const q=p.cc;if(q.eliminated)return false;
 const pos=spawnPlace(s,p,ps);
 if(!pos){eliminate(s,p);return false;}
 p.x=pos.x;p.y=pos.y;p.vx=0;p.vy=0;
 q.alive=true;q.respawn=0;q.invulnerable=SETTINGS.protection;
 q.trail=[];q.distance=0;q.origin=null;q.anchor=null;q.bot=null;
 return true;
}
function captureMask(s,p){
 const own=p.cc.slot,barrier=new Uint8Array(s.owner.length),reachable=new Uint8Array(s.owner.length);
 const path=p.cc.trail;
 for(let k=1;k<path.length;k++)trace(s,path[k-1],path[k],i=>{barrier[i]=1;});
 // All owned tiles and the freshly drawn path form the contour.
 const queue=new Int32Array(s.owner.length);let head=0,tail=0;
 const visit=i=>{
  if(i<0||i>=s.owner.length||reachable[i]||barrier[i]||s.owner[i]===own)return;
  reachable[i]=1;queue[tail++]=i;
 };
 for(let x=0;x<s.cols;x++){visit(x);visit((s.rows-1)*s.cols+x);}
 for(let y=0;y<s.rows;y++){visit(y*s.cols);visit(y*s.cols+s.cols-1);}
 while(head<tail){
  const i=queue[head++],x=i%s.cols;
  if(x>0)visit(i-1);if(x<s.cols-1)visit(i+1);
  if(i>=s.cols)visit(i-s.cols);if(i<s.owner.length-s.cols)visit(i+s.cols);
 }
 const selected=[];
 for(let i=0;i<s.owner.length;i++)
  if(barrier[i]||(!reachable[i]&&s.owner[i]!==own))selected.push(i);
 return selected;
}
function applyCaptures(s,closing,ps){
 if(!closing.length)return;
 // A returning trail is invalid if its original connection was stolen.
 const valid=closing.filter(p=>{
  const q=p.cc;
  if(!q.alive||q.eliminated)return false;
  if(q.anchor!==null&&s.owner[q.anchor]!==q.slot){kill(s,p);return false;}
  return true;
 });
 if(!valid.length)return;
 // Resolve simultaneous captures from one ownership snapshot. Contested
 // tiles retain previous ownership; the survivor check runs AFTER transfers.
 const count=new Uint8Array(s.owner.length),slot=new Int16Array(s.owner.length).fill(-1);
 for(const p of valid)
  for(const i of captureMask(s,p)){count[i]++;if(count[i]===1)slot[i]=p.cc.slot;}
 for(let i=0;i<s.owner.length;i++)if(count[i]===1)s.owner[i]=slot[i];
 recount(s,ps);
 for(const p of valid)if(p.cc.alive){
  p.cc.trail=[];p.cc.distance=0;p.cc.origin=null;p.cc.anchor=null;p.cc.bot=null;
 }
}
function vector(p){
 const v=window.PartyCharacters?.control?.(p.input);
 if(v)return{x:v.x,y:v.y};
 const keys=p.input||{},x=Number(keys.axisX)||Number(!!keys.right)-Number(!!keys.left);
 const y=Number(keys.axisY)||Number(!!keys.down)-Number(!!keys.jump),len=Math.hypot(x,y);
 return len>1?{x:x/len,y:y/len}:{x,y};
}
function chooseBot(s,p,ps){
 const q=p.cc,style=q.slot%5,angle=rng(s)*TAU;
 const origin={x:p.x,y:p.y};
 const reach=style===0?170:style===1?85:style===2?115:style===3?135:115;
 const turn=style%2?1:-1,side=(style===1?68:style===0?115:85)*turn;
 const forward={x:Math.cos(angle),y:Math.sin(angle)},perp={x:-forward.y,y:forward.x};
 const path=[
  {x:origin.x+forward.x*reach,y:origin.y+forward.y*reach},
  {x:origin.x+forward.x*reach+perp.x*side,y:origin.y+forward.y*reach+perp.y*side},
  {x:origin.x+perp.x*side,y:origin.y+perp.y*side},
  origin
 ];
 for(const pt of path){
  pt.x=clamp(pt.x,s.field.x+25,s.field.x+s.field.w-25);
  pt.y=clamp(pt.y,s.field.y+25,s.field.y+s.field.h-25);
 }
 q.bot={style,path,index:0,origin,changedAt:s.elapsed};
}
function botControl(s,p,ps){
 const q=p.cc;if(!q.bot)chooseBot(s,p,ps);
 const b=q.bot;
 if(!q.trail.length&&s.item&&b.style===4&&dist(p,s.item)<165){
  const d=dist(p,s.item)||1;return{x:(s.item.x-p.x)/d,y:(s.item.y-p.y)/d};
 }
 if(q.trail.length&&q.origin&&ps.some(o=>o!==p&&o.cc?.alive&&
   dist(o,p)<65&&o.cc?.trail.length>0)){
  // Threatened bots cut the loop shorter, but approach the outer side of
  // their own territory instead of doubling back through the fresh trail.
  b.index=Math.max(b.index,2);
 }
 let target=b.path[Math.min(b.index,b.path.length-1)];
 if(dist(p,target)<20&&b.index<b.path.length-1)target=b.path[++b.index];
 if(!q.trail.length&&s.elapsed-b.changedAt>3.5)chooseBot(s,p,ps);
 const d=dist(p,target);
 return d<1?{x:0,y:0}:{x:(target.x-p.x)/d,y:(target.y-p.y)/d};
}
function move(s,p,v,dt){
 const q=p.cc,speed=SETTINGS.speed*(s.w/960),amount=clamp(dt/SETTINGS.acceleration,0,1);
 p.vx+=(v.x*speed-p.vx)*amount;p.vy+=(v.y*speed-p.vy)*amount;
 if(Math.hypot(v.x,v.y)<.07){
  const drag=Math.max(0,1-dt/SETTINGS.friction);
  p.vx*=drag;p.vy*=drag;
 }
 const r=SETTINGS.radius*(s.w/960);
 const x=clamp(p.x+p.vx*dt,s.field.x+r,s.field.x+s.field.w-r);
 const y=clamp(p.y+p.vy*dt,s.field.y+r,s.field.y+s.field.h-r);
 if(x!==p.x+p.vx*dt)p.vx=0;if(y!==p.y+p.vy*dt)p.vy=0;
 p.x=x;p.y=y;
 const magnitude=Math.hypot(p.vx,p.vy);
 if(magnitude>9){p.dir={x:p.vx/magnitude,y:p.vy/magnitude};p.face=p.vx<0?-1:1;}
}
function spawnItem(s,ps){
 const contenders=ps.filter(p=>p.cc?.alive);
 if(!contenders.length)return;
 for(let k=0;k<100;k++){
  const pt={x:s.field.x+40+rng(s)*(s.field.w-80),
   y:s.field.y+40+rng(s)*(s.field.h-80)};
  if(contenders.some(p=>dist(p,pt)<75))continue;
  s.item=pt;return;
 }
}
function finish(s,round,ps){
 s.finished=true;s.remaining=0;round.remaining=0;s.item=null;s.freeze=null;
 recount(s,ps);
 const list=active(ps);
 s.ranking=list.map(p=>({id:p.id,value:s.counts[p.cc.slot],
  rank:1+list.filter(o=>s.counts[o.cc.slot]>s.counts[p.cc.slot]).length}));
 s.winnerIds=s.ranking.filter(x=>x.rank===1).map(x=>x.id);
}
function step(dt,round,ps){
 const s=round.colorClaim;if(s.finished)return;
 s.elapsed+=dt;s.tick++;s.remaining=Math.max(0,s.duration-s.elapsed);round.remaining=s.remaining;
 const movable=[],old=new Map(),closing=[],newTrails=new Map(),dead=new Set();
 if(s.freeze&&s.elapsed>=s.freeze.until){s.freeze=null;s.nextItem=s.elapsed+SETTINGS.itemMin+rng(s)*(SETTINGS.itemMax-SETTINGS.itemMin);}
 for(const p of active(ps)){
  const q=p.cc;
  if(q.eliminated)continue;
  if(!q.alive){q.respawn-=dt;if(q.respawn<=0)revive(s,p,ps);continue;}
  if(freezeActive(s,p)){p.vx=0;p.vy=0;continue;}
  old.set(p.id,{x:p.x,y:p.y});
  const v=p.isBot?botControl(s,p,ps):vector(p);
  move(s,p,v,dt);
  if(q.invulnerable>0){q.invulnerable=Math.max(0,q.invulnerable-dt);if(!owned(s,p,p.x,p.y))q.invulnerable=0;}
  movable.push(p);
 }
 // Apply the shared physical character collision only to moving participants.
 // Frozen actors are static: deflect moving actors away without moving them.
 if(window.PartyCharacters?.resolve&&movable.length>1)
  window.PartyCharacters.resolve(movable,{radius:SETTINGS.radius*(s.w/960),iterations:2,
   maxShift:4,pressure:true,bounds:s.field});
 for(const p of movable){
  const q=p.cc,from=old.get(p.id),to={x:p.x,y:p.y};
  const outside=!owned(s,p,to.x,to.y);
  if(outside){
   if(!q.trail.length){
    const originCell=index(s,from.x,from.y);
    if(originCell<0||s.owner[originCell]!==q.slot){kill(s,p);continue;}
    q.origin=from;q.anchor=originCell;q.trail.push({...from,d:0});q.distance=0;
   }
   const last=q.trail[q.trail.length-1];q.distance+=dist(last,to);
   q.trail.push({...to,d:q.distance});newTrails.set(p.id,{a:from,b:to,p});
  }else if(q.trail.length){
   q.trail.push({...to,d:q.distance+dist(q.trail[q.trail.length-1],to)});
   closing.push(p);
  }
 }
 // The trail map is built once for the tick; sweep full motion segments.
 const map=gridTrails(s,ps);
 for(const p of movable){
  const q=p.cc,from=old.get(p.id),to={x:p.x,y:p.y};
  for(const e of trailHits(map,from,to,5*s.w/960)){
   if(e.owner===p){
    if(q.distance-e.at<27*s.w/960)continue; // attached head, not a self-cut
    dead.add(p);
   }else if(q.invulnerable<=0)dead.add(e.owner);
  }
 }
 // New-to-new crossing in the same physics tick is simultaneous.
 const strokes=[...newTrails.values()];
 for(let i=0;i<strokes.length;i++)for(let j=i+1;j<strokes.length;j++){
  const a=strokes[i],b=strokes[j];
  if(segmentsTouch(a.a,a.b,b.a,b.b,5*s.w/960)){
   if(a.p.cc.invulnerable<=0)dead.add(b.p);
   if(b.p.cc.invulnerable<=0)dead.add(a.p);
  }
 }
 // Ignore accidental wall/body overlaps as deaths; freeze stays immobile.
 for(const p of movable)for(const o of ps){
  if(o===p||!freezeActive(s,o)||!o.cc?.alive)continue;
  const r=SETTINGS.radius*(s.w/960)*2,d=dist(p,o);
  if(d>=r||d<1e-6)continue;
  p.x=o.x+(p.x-o.x)/d*r;p.y=o.y+(p.y-o.y)/d*r;
  p.x=clamp(p.x,s.field.x+r/2,s.field.x+s.field.w-r/2);
  p.y=clamp(p.y,s.field.y+r/2,s.field.y+s.field.h-r/2);
 }
 // The cutter remains eligible even if its own trail is cut this same tick.
 for(const p of dead)kill(s,p);
 applyCaptures(s,closing.filter(p=>!dead.has(p)),ps);
 // Pickups are host-owned and use swept segments, not frame-only centres.
 if(s.item&&!s.freeze){
  const winner=movable.find(p=>p.cc.alive&&
   pointSegment2(s.item,old.get(p.id),p)<((SETTINGS.radius+14)*(s.w/960))**2);
  if(winner){s.freeze={ownerId:winner.id,until:s.elapsed+SETTINGS.freezeDuration};s.item=null;
   for(const p of ps)if(p.id!==winner.id){p.vx=0;p.vy=0;}
  }
 }
 if(!s.item&&!s.freeze&&s.elapsed>=s.nextItem){spawnItem(s,ps);s.nextItem=INF;}
 if(s.elapsed>=s.duration)finish(s,round,ps);
}
function update(dt,round,ps){
 const s=round.colorClaim;if(!s)return null;if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.25,s.accumulator+clamp(Number(dt)||0,0,.25));
 let steps=0;
 while(s.accumulator+1e-9>=STEP&&steps++<15&&!s.finished){
  step(STEP,round,ps);s.accumulator-=STEP;
 }
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.colorClaim;
 return {remaining:round.remaining,survivors:active(ps).filter(p=>!p.cc.eliminated).length,
  percentages:active(ps).map(p=>({id:p.id,percent:p.score,tiles:s.counts[p.cc.slot],
   eliminated:!!p.cc.eliminated})),
  freezeOwner:s.freeze?.ownerId||null,freezeRemaining:s.freeze?Math.max(0,s.freeze.until-s.elapsed):0};
}
const FREEZE_SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="a"><stop stop-color="#f2ffff"/><stop offset="1" stop-color="#42adfa"/></radialGradient></defs><path d="M32 2 40 19 59 11 51 30 62 32 51 36 58 53 40 46 32 62 24 46 6 53 13 36 2 32 13 28 6 11 24 19Z" fill="url(#a)" stroke="#e5ffff" stroke-width="3"/><path d="M32 12v40M12 32h40M18 18l28 28M46 18 18 46" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/></svg>';
let freezeImage=null;
function frostImage(){
 if(freezeImage||typeof Image==='undefined')return freezeImage;
 freezeImage=new Image();freezeImage.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(FREEZE_SVG);
 return freezeImage;
}
function disk(g,x,y,r,color){
 g.beginPath();g.arc(x,y,r,0,TAU);g.fillStyle=color;g.fill();
}
// Extract directed boundaries from the authoritative ownership mask once per
// capture. The engine remains grid-based for fair scoring, while the *visible*
// shape is traced as anti-aliased quadratic curves rather than tile rectangles.
function buildContours(s){
 const byStart=new Map(),edges=[],groups=Array.from({length:s.roster.length},()=>[]);
 const node=(x,y)=>y*(s.cols+1)+x,span=(s.cols+1)*(s.rows+1);
 const add=(slot,x,y,tx,ty)=>{
  const a=slot*span+node(x,y),b=slot*span+node(tx,ty);
  const dir=tx>x?0:ty>y?1:tx<x?2:3;
  const e={slot,x,y,a,b,dir,used:false};
  edges.push(e);if(!byStart.has(a))byStart.set(a,[]);byStart.get(a).push(e);
 };
 for(let y=0;y<s.rows;y++)for(let x=0;x<s.cols;x++){
  const i=y*s.cols+x,slot=s.owner[i];if(slot<0||slot>=groups.length)continue;
  if(y===0||s.owner[i-s.cols]!==slot)add(slot,x,y,x+1,y);
  if(x===s.cols-1||s.owner[i+1]!==slot)add(slot,x+1,y,x+1,y+1);
  if(y===s.rows-1||s.owner[i+s.cols]!==slot)add(slot,x+1,y+1,x,y+1);
  if(x===0||s.owner[i-1]!==slot)add(slot,x,y+1,x,y);
 }
 for(const entry of edges){
  if(entry.used)continue;
  let e=entry,contour=[],closed=false;
  for(let step=0;step<=edges.length;step++){
   if(e.used)break;
   e.used=true;contour.push({x:e.x,y:e.y});
   if(e.b===entry.a){closed=true;break;}
   const options=(byStart.get(e.b)||[]).filter(v=>!v.used);
   if(!options.length)break;
   // Right turns first: diagonal-touching islands stay separate instead
   // of accidentally stitching their perimeters into a bow-tie polygon.
   const preference=[1,0,3,2];
   options.sort((a,b)=>preference.indexOf((a.dir-e.dir+4)%4)-
    preference.indexOf((b.dir-e.dir+4)%4));
   e=options[0];
  }
  if(closed&&contour.length>=3)groups[entry.slot].push(contour);
 }
 return groups;
}
function smoothLoop(g,s,points){
 const f=s.field,n=points.length;
 if(n<3)return;
 const coord=p=>({x:f.x+p.x*CELL,y:f.y+p.y*CELL});
 const start=coord(points[n-1]),first=coord(points[0]);
 g.moveTo((start.x+first.x)*.5,(start.y+first.y)*.5);
 for(let i=0;i<n;i++){
  const p=coord(points[i]),next=coord(points[(i+1)%n]);
  g.quadraticCurveTo(p.x,p.y,(p.x+next.x)*.5,(p.y+next.y)*.5);
 }
 g.closePath();
}
function traceSmoothTrail(g,path){
 if(path.length<2)return;
 g.beginPath();g.moveTo(path[0].x,path[0].y);
 for(let i=1;i<path.length-1;i++){
  const a=path[i],b=path[i+1];
  g.quadraticCurveTo(a.x,a.y,(a.x+b.x)*.5,(a.y+b.y)*.5);
 }
 g.lineTo(path[path.length-1].x,path[path.length-1].y);
}
function drawScene(g,s){
 if(s.dirty||!s.contours){s.contours=buildContours(s);s.dirty=false;}
 if(window.ReferenceArenaArt?.claim(g,s,CELL))return;
 const f=s.field;
 g.fillStyle='#140d34';g.fillRect(0,0,s.w,s.h);
 g.save();g.shadowColor='#fa278e';g.shadowBlur=19;
 g.fillStyle='#46174d';g.fillRect(f.x-10,f.y-10,f.w+20,f.h+20);
 g.restore();
 g.fillStyle='#140f35';g.fillRect(f.x,f.y,f.w,f.h);
 g.save();g.beginPath();g.rect(f.x,f.y,f.w,f.h);g.clip();
 g.lineWidth=1;g.strokeStyle='rgba(120,154,239,.13)';
 for(let x=f.x;x<=f.x+f.w;x+=32){g.beginPath();g.moveTo(x,f.y);g.lineTo(x,f.y+f.h);g.stroke();}
 for(let y=f.y;y<=f.y+f.h;y+=32){g.beginPath();g.moveTo(f.x,y);g.lineTo(f.x+f.w,y);g.stroke();}
 g.globalAlpha=.79;
 for(let slot=0;slot<s.contours.length;slot++){
  const loops=s.contours[slot];if(!loops.length)continue;
  g.beginPath();for(const loop of loops)smoothLoop(g,s,loop);
  g.fillStyle=s.roster[slot]?.color||'#9ad5ff';g.fill('evenodd');
  // Subtle continuous curved edge, without a tile-grid outline.
  g.strokeStyle=s.roster[slot]?.color||'#9ad5ff';
  g.globalAlpha=.3;g.lineWidth=1.5;g.stroke();
  g.globalAlpha=.79;
 }
 g.globalAlpha=1;g.restore();
 g.save();g.lineWidth=6;g.strokeStyle='#ff2789';g.shadowColor='#ff2185';g.shadowBlur=18;
 g.strokeRect(f.x-5,f.y-5,f.w+10,f.h+10);g.restore();
 g.save();g.fillStyle='#4e5b9e';
 for(const x of [f.x-8,f.x+f.w+8])for(const y of [f.y-8,f.y+f.h+8]){
  g.translate(x,y);g.rotate(Math.PI/4);g.fillRect(-11,-11,22,22);
  g.fillStyle='#a4e6ff';g.fillRect(-4,-4,8,8);g.fillStyle='#4e5b9e';
  g.rotate(-Math.PI/4);g.translate(-x,-y);
 }
 g.restore();
}
function draw(g,t,round,ps){
 const s=round.colorClaim;if(!s)return;
 g.save();g.scale(960/s.w,540/s.h);drawScene(g,s);
 const unit=s.w/960; // World collision and SVG metrics share one screen scale.
 for(const p of active(ps)){
  const q=p.cc;if(!q.alive||q.trail.length<2)continue;
  g.save();g.lineCap='round';g.lineJoin='round';
  for(const [width,alpha,blur] of [[13,.25,14],[7,.95,5]]){
   traceSmoothTrail(g,q.trail);
   g.strokeStyle=p.color;g.globalAlpha=alpha;g.lineWidth=width*unit;
   g.shadowColor=p.color;g.shadowBlur=blur*unit;g.stroke();
  }
  g.restore();
 }
 if(s.item){
  const img=frostImage(),pulse=1+Math.sin(t*5)*.08;
  g.save();g.translate(s.item.x,s.item.y);g.scale(pulse,pulse);
  disk(g,0,0,23*unit,'rgba(75,196,255,.14)');
  if(img?.complete&&img.naturalWidth)g.drawImage(img,-17*unit,-17*unit,34*unit,34*unit);
  else{
   g.strokeStyle='#adf5ff';g.lineWidth=3;
   for(let i=0;i<6;i++){const a=i*TAU/6;g.beginPath();g.moveTo(0,0);
    g.lineTo(Math.cos(a)*15*unit,Math.sin(a)*15*unit);g.stroke();}
  }
  g.restore();
 }
 for(const p of active(ps)){
  const q=p.cc;
  if(!q.alive)continue;
  g.save();g.shadowColor=p.color;g.shadowBlur=7;
  disk(g,p.x,p.y+5*unit,(SETTINGS.radius+3)*unit,'rgba(0,0,0,.23)');g.restore();
  if(!window.ReferenceArenaArt?.claimCar(g,p,SETTINGS.radius*unit)){
   if(window.PartyCharacters?.draw)window.PartyCharacters.draw(g,p,{time:t,combat:false,scale:unit});
   else{disk(g,p.x,p.y,SETTINGS.radius*unit,p.color||'#80efff');}
  }
  if(freezeActive(s,p)){
   g.save();g.globalAlpha=.75;g.strokeStyle='#b9efff';g.lineWidth=3;
   g.beginPath();g.arc(p.x,p.y,(SETTINGS.radius+5)*unit,0,TAU);g.stroke();
   g.beginPath();g.moveTo(p.x-10*unit,p.y);g.lineTo(p.x+10*unit,p.y);
   g.moveTo(p.x,p.y-10*unit);g.lineTo(p.x,p.y+10*unit);g.stroke();g.restore();
  }
  if(q.invulnerable>0){
   g.save();g.strokeStyle='#fff8be';g.lineWidth=2;
   g.beginPath();g.arc(p.x,p.y,(SETTINGS.radius+9)*unit,0,TAU);g.stroke();g.restore();
  }
 }
 g.restore();
}
function getResult(round,players){
 return players.filter(p=>p.active).map(p=>{
  const value=round.colorClaim.counts[p.cc?.slot]||0;
 const label=(Number(p.score)||0).toFixed(2)+'% ของสนาม'+(p.cc?.eliminated?' • พื้นที่หมด • ตกรอบถาวร':'');
  return {id:p.id,value,label};
 });
}
// Game-specific roster presentation stays with its pinned engine revision.
function renderRoster(root,active,round){

    active.sort((a,b)=>(round.colorClaim.counts[b.cc?.slot]||0)-
      (round.colorClaim.counts[a.cc?.slot]||0)||String(a.id).localeCompare(String(b.id)));
    for(const p of active){
      const box=document.createElement('div');box.className='leader-chip';
      const dot=document.createElement('span');dot.className='circle';dot.style.background=p.color;
      const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;
      const score=document.createElement('small');score.className='leader-role';
      score.textContent=(p.score||0).toFixed(1)+'%';
      const status=document.createElement('span');status.className='leader-item-slot';
      status.textContent=p.cc?.eliminated?'ตกรอบถาวร':!p.cc?.alive?'เกิดใหม่':
        window.ColorClaim.freezeActive(round.colorClaim,p)?'แช่แข็ง':'';
      box.append(dot,name,score,status);root.append(box);
    }
    return;
  
}
// Game-owned controller packet; Host forwards this without mode-specific branches.
function getControllerPacket(p,round){
 return {t:'claim-status',mode:round.mode,percent:p.score||0,
  frozen:freezeActive(round.colorClaim,p),
  eliminated:!!p.cc?.eliminated,alive:!!p.cc?.alive};
}
window.ColorClaim=Object.freeze({getControllerPacket,renderRoster,getResult,resultTitle:"ผู้ยึดพื้นที่มากที่สุด!",countdownSeconds:3,setup,update,step,draw,hud,finish,index,owned,claimDisk,
 recount,captureMask,applyCaptures,segmentsTouch,pointSegment2,kill,revive,eliminate,
 largestTerritory,spawnPlace,discardCutFragments,pruneUnplayableTerritory,
 buildContours,traceSmoothTrail,freezeActive,
 config:SETTINGS});
})();
