/* COLOR CLAIM — host-authoritative territory capture, 60 Hz swept trails.
 *
 * Territory is AUTHORITATIVE POLYGON GEOMETRY (s.terr[slot], built by
 * territory-geometry.js). There is exactly one source of truth: capture, loss,
 * ownership queries, loop closing, respawn, cut detection, scoring, drawing and
 * bot navigation all read s.terr. The CELL grid survives only as a coarse legacy
 * index; s.owner / s.contours are lazily DERIVED read-only views for older
 * art hooks and are never used by game rules.
 */
(() => {
'use strict';
const G=window.ColorClaimGeometry;
if(!G)throw Error('Missing ColorClaim geometry kernel (territory-geometry.js)');
const STEP=1/60,CELL=10,TAU=Math.PI*2,INF=1e20;
const MIN_LAND=1;      // px^2: a territory smaller than this is gone
const TRAIL_TOL=.3;    // px (at 960 wide): path simplification before a capture
const AREA_EPS=.25;    // px^2: areas closer than this rank as a tie
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
// Coarse legacy cell index (not used for ownership).
function index(s,x,y){
 const c=Math.floor((x-s.field.x)/CELL),r=Math.floor((y-s.field.y)/CELL);
 return c<0||r<0||c>=s.cols||r>=s.rows?-1:r*s.cols+c;
}

// ------------------------------------------------------------ territory API
function owned(s,p,x,y){return G.inside(s.terr[p.cc.slot],x,y);}
function ownerAt(s,x,y){
 for(let slot=0;slot<s.terr.length;slot++)if(G.inside(s.terr[slot],x,y))return slot;
 return -1;
}
function hasLand(s,slot){return s.terr[slot].area>MIN_LAND;}
function overlaps(R,b){return !!b&&R.ex!==null&&!(b.maxX<R.minX||b.minX>R.maxX||b.maxY<R.minY||b.minY>R.maxY);}
// Store a territory. Only the LARGEST connected part (true polygon area) survives;
// detached parts become neutral and are logged so idle players standing on them die.
function commit(s,slot,rings){
 const parts=G.splitParts(rings);
 let best=null;
 for(const p of parts)if(!best||p.area>best.area+1e-9)best=p;
 for(const p of parts)if(p!==best&&p.area>0)s.cuts.push({slot,rings:p.rings});
 s.terr[slot]=G.makeRegion(best?best.rings:[]);
 s.geoVersion++;s.dirty=true;
}
function claimDisk(s,slot,x,y,radius){
 const disk=G.canon([G.circleRing(x,y,radius,Math.max(32,Math.ceil(radius*2.5)))]);
 if(!disk||!disk.length)return;
 const box=G.boundsOf(disk);
 // slot gets T ∪ disk, every touched opponent gets V − disk, all from ONE arrangement
 const ids=[slot];
 for(let k=0;k<s.terr.length;k++)if(k!==slot&&s.terr[k].area>0&&overlaps(s.terr[k],box))ids.push(k);
 const operands=ids.map(k=>s.terr[k].rings);operands.push(disk);
 const D=ids.length;
 const out=G.combineMany(operands,ids.map((k,i)=>i===0?(w=>w[0]!==0||w[D]!==0):(w=>w[i]!==0&&w[D]===0)));
 if(!out){if(!(s.terr[slot].area>0))commit(s,slot,disk);return;}
 ids.forEach((k,i)=>commit(s,k,out[i]));
 s.dirty=true;
}

// Derived views for legacy hooks -------------------------------------------
function rasterOwner(s){
 if(s._raster&&s._rasterV===s.geoVersion)return s._raster;
 const a=s._raster||(s._raster=new Int16Array(s.cols*s.rows));a.fill(-1);
 for(let slot=0;slot<s.terr.length;slot++){
  const T=s.terr[slot];if(!(T.area>0))continue;
  const c0=Math.max(0,Math.floor((T.minX-s.field.x)/CELL)),c1=Math.min(s.cols-1,Math.floor((T.maxX-s.field.x)/CELL));
  const r0=Math.max(0,Math.floor((T.minY-s.field.y)/CELL)),r1=Math.min(s.rows-1,Math.floor((T.maxY-s.field.y)/CELL));
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)
   if(G.inside(T,s.field.x+(c+.5)*CELL,s.field.y+(r+.5)*CELL))a[r*s.cols+c]=slot;
 }
 s._rasterV=s.geoVersion;return a;
}
// Exact territory rings in legacy cell units: point.x*CELL+field.x is the true vertex.
function buildContours(s){
 return s.terr.map(T=>T.rings.map(r=>{
  const out=[];
  for(let i=0;i<r.length;i+=2)out.push({x:(r[i]-s.field.x)/CELL,y:(r[i+1]-s.field.y)/CELL});
  return out;
 }));
}
function installLegacyViews(s){
 Object.defineProperty(s,'owner',{configurable:true,get(){return rasterOwner(s);}});
 Object.defineProperty(s,'contours',{configurable:true,
  get(){
   if(!s._contours||s._contoursV!==s.geoVersion){s._contours=buildContours(s);s._contoursV=s.geoVersion;}
   return s._contours;
  },set(){}});
}

// ------------------------------------------------- connectivity / accessibility
// Territory CONNECTIVITY is topological (one polygon part = connected) and is
// resolved inside commit(). Character ACCESSIBILITY is separate: it asks whether
// a character of radius `radius` fits somewhere, and never deletes ownership.
function bestSpot(s,slot,enemies){
 const T=s.terr[slot];
 if(!(T.area>MIN_LAND))return null;
 const unit=s.w/960,need=SETTINGS.radius*unit,cap=need*3;
 const step=clamp(Math.sqrt((T.maxX-T.minX)*(T.maxY-T.minY)/2600),3,14);
 let best=null,bestScore=-INF;
 for(let y=T.minY+step/2;y<T.maxY;y+=step)for(let x=T.minX+step/2;x<T.maxX;x+=step){
  if(!G.inside(T,x,y))continue;
  const depth=G.clearance(T,x,y,cap);
  let enemyDist=150;
  for(const o of enemies){const d=Math.hypot(o.x-x,o.y-y);if(d<enemyDist)enemyDist=d;}
  // deepest point first, then near the centroid, then away from opponents
  const score=depth*10-Math.hypot(x-T.cx,y-T.cy)*.02+Math.min(150,enemyDist)*.025;
  if(score>bestScore){bestScore=score;best={x,y,clearance:depth};}
 }
 if(!best){
  // a sliver thinner than the sampling step: look for any interior point
  const r=T.outer,n=r.length/2;
  if(G.inside(T,T.cx,T.cy))return{x:T.cx,y:T.cy,clearance:G.clearance(T,T.cx,T.cy,cap)};
  for(let i=0;i<n;i++){
   const j=(i+1)%n,k=(i+2)%n;
   const x=(r[i*2]+r[j*2]+r[k*2])/3,y=(r[i*2+1]+r[j*2+1]+r[k*2+1])/3;
   if(G.inside(T,x,y))return{x,y,clearance:G.clearance(T,x,y,cap)};
  }
  return{x:r[0],y:r[1],clearance:0};
 }
 return best;
}
function territoryAccessible(s,slot){
 const b=bestSpot(s,slot,[]);
 return !!b&&b.clearance>=SETTINGS.radius*(s.w/960)-1e-6;
}
// Replacement for pruneUnplayableTerritory(): reports which territories are too
// thin for a character, but NEVER removes ownership.
function pruneUnplayableTerritory(s){
 return s.terr.map((T,slot)=>({slot,accessible:T.area>MIN_LAND&&territoryAccessible(s,slot)}));
}
// Re-normalise every territory (largest connected part only).
function discardCutFragments(s){
 const before=s.cuts.length;
 for(let slot=0;slot<s.terr.length;slot++)if(s.terr[slot].area>0)commit(s,slot,s.terr[slot].rings);
 return s.cuts.length>before?s.cuts.slice(before):null;
}
function largestTerritory(s,slot){
 const T=s.terr[slot];
 return{rings:T.rings,cx:T.cx,cy:T.cy,size:T.area,area:T.area};
}

function recount(s,ps){
 const total=s.field.w*s.field.h,cell2=CELL*CELL;
 for(let slot=0;slot<s.terr.length;slot++){
  const a=s.terr[slot].area;s.areas[slot]=a;s.counts[slot]=a/cell2;
 }
 for(const p of ps)if(p.cc)p.score=s.areas[p.cc.slot]/total*100;
 const cuts=s.cuts;s.cuts=[];
 // Ownership changes are authoritative immediately, including during a
 // different player's capture. Never wait for the victim's next movement.
 for(const p of ps){
  const q=p.cc;if(!q||q.eliminated)continue;
  if(!hasLand(s,q.slot)){eliminate(s,p);continue;}
  if(q.alive&&q.trail.length&&q.anchor&&!G.inside(s.terr[q.slot],q.anchor.x,q.anchor.y)){
   kill(s,p);continue;
  }
  // An idle player whose ground was cut away, or whose protected spawn was
  // stolen, dies and respawns on the surviving main part.
  if(q.alive&&!q.trail.length&&!owned(s,p,p.x,p.y)){
   const lost=cuts.some(c=>c.slot===q.slot&&G.pointInRings(c.rings,p.x,p.y));
   if(q.invulnerable>0||lost)kill(s,p);
  }
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
 const field={x:30,y:30,w:config.w-60,h:config.h-60},n=ps.length;
 const s={w:config.w,h:config.h,field,cols:field.w/CELL,rows:field.h/CELL,
  terr:Array.from({length:n},()=>G.makeRegion([])),
  areas:new Float64Array(n),counts:new Float64Array(n),cuts:[],geoVersion:0,
  roster:ps,seed:seedFor(round),
  elapsed:0,duration:config.duration,remaining:config.duration,accumulator:0,tick:0,
  dirty:true,finished:false,item:null,nextItem:6,freeze:null,
  ranking:[],winnerIds:[],visualClock:0};
 installLegacyViews(s);
 // Whole-pixel spawn centres: identical circular homes for every player.
 const positions=startPositions(s,n).map(v=>({x:Math.round(v.x),y:Math.round(v.y)}));
 ps.forEach((p,slot)=>{
  const q=positions[slot];p.active=true;p.score=0;p.x=q.x;p.y=q.y;
  p.vx=0;p.vy=0;p.dir={x:1,y:0};p.face=1;
  p.cc={slot,alive:true,respawn:0,invulnerable:0,trail:[],distance:0,
   origin:null,anchor:null,eliminated:false,deaths:0,bot:null,shieldClock:0};
 });
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
function spawnPlace(s,p,ps){
 const enemies=ps.filter(o=>o!==p&&o.cc?.alive);
 const b=bestSpot(s,p.cc.slot,enemies);
 return b?{x:b.x,y:b.y}:null;
}
function eliminate(s,p){
 const q=p.cc;if(!q||q.eliminated)return;
 q.alive=false;q.eliminated=true;q.respawn=0;q.invulnerable=0;
 q.trail=[];q.distance=0;q.origin=null;q.anchor=null;q.bot=null;
 p.vx=0;p.vy=0;
}
function kill(s,p){
 const q=p.cc;if(!q||q.eliminated)return;
 if(!hasLand(s,q.slot)){eliminate(s,p);return;}
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

// ------------------------------------------------------------------ capture
// Region enclosed by the player's own territory and the trail they really drew:
// everything that cannot reach the outside without crossing either. The trail is
// joined to the existing boundary where it truly crosses it (never closed by a
// straight start->end chord). Enclosed holes of the own territory are filled,
// exactly like the old flood fill did.
function enclosure(s,p){
 const q=p.cc,T=s.terr[q.slot];
 if(!T.outer||q.trail.length<2)return null;
 const path=G.simplifyPath(q.trail,TRAIL_TOL*(s.w/960));
 return G.enclose(T.outer,path);
}
// New ground this player would gain right now (enclosure minus own territory).
function captureMask(s,p){
 const N=enclosure(s,p);if(!N||!N.length)return[];
 return G.combine([N,s.terr[p.cc.slot].rings],w=>w[0]!==0&&w[1]===0)||[];
}
// Every capture of a tick is resolved in ONE arrangement built from the snapshot:
//   operands = [T of every involved player..., N of every capturer...]
// gain_i = N_i − T_i. Ground wanted by exactly one capturer goes to that capturer;
// ground wanted by two or more stays with its owner (so processing order gives
// nobody an edge). Because every result comes from the same noded edges, a
// capturer's gain and a victim's loss are exactly complementary.
function resolveCaptures(s,jobs){
 const ids=[];
 for(const j of jobs)if(!ids.includes(j.slot))ids.push(j.slot);
 for(let k=0;k<s.terr.length;k++)
  if(!ids.includes(k)&&s.terr[k].area>0&&jobs.some(j=>overlaps(s.terr[k],j.box)))ids.push(k);
 const M=ids.length,pos=new Map(ids.map((k,i)=>[k,i]));
 const operands=ids.map(k=>s.terr[k].rings);
 for(const j of jobs)operands.push(j.N);
 const owners=jobs.map(j=>pos.get(j.slot));
 const sels=ids.map((k,i)=>w=>{
  let c=0,hit=-1;
  for(let m=0;m<owners.length;m++)if(w[M+m]!==0&&w[owners[m]]===0){c++;hit=m;}
  return c===1?jobs[hit].slot===k:w[i]!==0;
 });
 const out=G.combineMany(operands,sels);
 if(!out)return false;
 ids.forEach((k,i)=>commit(s,k,out[i]));
 return true;
}
function applyCaptures(s,closing,ps){
 if(!closing.length)return;
 // A returning trail is invalid if its original connection was stolen.
 const valid=closing.filter(p=>{
  const q=p.cc;
  if(!q.alive||q.eliminated)return false;
  if(q.anchor&&!G.inside(s.terr[q.slot],q.anchor.x,q.anchor.y)){kill(s,p);return false;}
  return true;
 });
 if(!valid.length)return;
 const jobs=[];
 for(const p of valid){
  const q=p.cc,N=enclosure(s,p);
  if(!N||!N.length)continue;
  let area=0;for(const r of N)area+=G.ringArea(r);
  if(area<=s.terr[q.slot].area+.01)continue;   // loop closed without new ground
  jobs.push({slot:q.slot,N,box:G.boundsOf(N)});
 }
 if(jobs.length)resolveCaptures(s,jobs);
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
 const q=p.cc,style=q.slot%5;
 const reach=style===0?170:style===1?85:style===2?115:style===3?135:115;
 const turn=style%2?1:-1,side=(style===1?68:style===0?115:85)*turn;
 let path=null,origin=null;
 // Navigate by the authoritative territory: prefer a loop whose first legs leave
 // our own land (a loop entirely inside it would capture nothing).
 for(let attempt=0;attempt<6;attempt++){
  const angle=rng(s)*TAU;
  origin={x:p.x,y:p.y};
  const forward={x:Math.cos(angle),y:Math.sin(angle)},perp={x:-forward.y,y:forward.x};
  path=[
   {x:origin.x+forward.x*reach,y:origin.y+forward.y*reach},
   {x:origin.x+forward.x*reach+perp.x*side,y:origin.y+forward.y*reach+perp.y*side},
   {x:origin.x+perp.x*side,y:origin.y+perp.y*side},
   {x:origin.x,y:origin.y}
  ];
  for(const pt of path){
   pt.x=clamp(pt.x,s.field.x+25,s.field.x+s.field.w-25);
   pt.y=clamp(pt.y,s.field.y+25,s.field.y+s.field.h-25);
  }
  if(!owned(s,p,path[0].x,path[0].y)||!owned(s,p,path[1].x,path[1].y))break;
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
  rank:1+list.filter(o=>s.areas[o.cc.slot]>s.areas[p.cc.slot]+AREA_EPS).length}));
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
    if(!owned(s,p,from.x,from.y)){kill(s,p);continue;}
    q.origin=from;q.anchor={x:from.x,y:from.y};q.trail.push({...from,d:0});q.distance=0;
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
  percentages:active(ps).map(p=>({id:p.id,percent:p.score,tiles:Math.round(s.counts[p.cc.slot]),
   area:s.areas[p.cc.slot],eliminated:!!p.cc.eliminated})),
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

// ------------------------------------------------------------------ drawing
// Territory is drawn from the SAME polygons the rules use: straight edges stay
// straight, diagonals are not stair-stepped, nothing is smoothed. Rings are
// painted opaque into a cached layer (rebuilt only when the geometry version
// changes) and blitted with the translucency, so neighbouring territories leave
// no anti-aliasing seam. A 0.9 px same-colour hairline (<=0.45 px of overdraw)
// hides the seam; it is purely cosmetic and never touches the rules.
function tracePolygon(g,r){
 g.moveTo(r[0],r[1]);
 for(let i=2;i<r.length;i+=2)g.lineTo(r[i],r[i+1]);
 g.closePath();
}
function paintTerritories(c,s,seamless){
 for(let slot=0;slot<s.terr.length;slot++){
  const T=s.terr[slot];if(!(T.area>0))continue;
  const color=s.roster[slot]?.color||'#9ad5ff';
  c.beginPath();for(const r of T.rings)tracePolygon(c,r);
  c.fillStyle=color;c.fill('nonzero');
  if(seamless){c.strokeStyle=color;c.lineWidth=.9;c.lineJoin='miter';c.miterLimit=2;c.stroke();}
 }
}
function territoryLayer(g,s){
 if(typeof document==='undefined')return null;
 const m=typeof g.getTransform==='function'?g.getTransform():null;
 const k=m?Math.hypot(m.a,m.b)||1:1,res=clamp(Math.round(k*4)/4,.5,2),f=s.field;
 let L=s.layer;
 if(!L||L.res!==res){
  const canvas=document.createElement('canvas');
  canvas.width=Math.ceil(f.w*res);canvas.height=Math.ceil(f.h*res);
  const ctx=canvas.getContext('2d');
  if(!ctx)return null;
  L=s.layer={canvas,ctx,res,version:-1};
 }
 if(L.version!==s.geoVersion){
  const c=L.ctx;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,L.canvas.width,L.canvas.height);
  c.setTransform(res,0,0,res,-f.x*res,-f.y*res);
  paintTerritories(c,s,true);
  L.version=s.geoVersion;
 }
 return L;
}
function traceSmoothTrail(g,path){
 // Exact polyline: the drawn trail is the very curve the capture will use.
 if(path.length<2)return;
 g.beginPath();g.moveTo(path[0].x,path[0].y);
 for(let i=1;i<path.length;i++)g.lineTo(path[i].x,path[i].y);
}
function drawScene(g,s){
 s.dirty=false;
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
 const layer=territoryLayer(g,s);
 if(layer)g.drawImage(layer.canvas,f.x,f.y,f.w,f.h);
 else paintTerritories(g,s,false);
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
  const hasArtwork=window.ReferenceArenaArt?.claimCar(g,p,SETTINGS.radius*unit);
  const carScale=SETTINGS.radius*unit*2/44,d=p.dir||{x:1,y:0};
  g.save();g.translate(p.x,p.y);g.rotate(Math.atan2(d.y,d.x));g.scale(carScale,carScale);
  if(!hasArtwork){
   // Open bumper car under the same rider, including while the SVG decodes.
   disk(g,0,0,22,'#172337');
   g.fillStyle=p.color||'#80efff';g.beginPath();g.ellipse(1,0,18,17,0,0,TAU);g.fill();
   g.fillStyle='#152638';g.beginPath();g.ellipse(-4,0,12,14,0,0,TAU);g.fill();
   g.strokeStyle='#a9b7c7';g.lineWidth=1.8;g.beginPath();g.arc(10,0,4.5,0,TAU);g.stroke();
  }
  g.translate(-4,0);
  const drawAvatar=window.PartyCharacters?.draw||window.PartyPlayerAvatar?.draw;
  drawAvatar?.(g,p,{time:t,local:true,heading:Math.PI/2,holding:true,
   attacking:false,combat:false,label:false,shadow:false});
  g.restore();
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
window.ColorClaim=Object.freeze({getControllerPacket,renderRoster,getResult,resultTitle:"ผู้ยึดพื้นที่มากที่สุด!",countdownSeconds:3,setup,update,step,draw,hud,finish,index,owned,ownerAt,claimDisk,
 recount,captureMask,applyCaptures,segmentsTouch,pointSegment2,kill,revive,eliminate,
 largestTerritory,spawnPlace,discardCutFragments,pruneUnplayableTerritory,territoryAccessible,
 buildContours,traceSmoothTrail,freezeActive,
 config:SETTINGS});
})();
