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
function recount(s,ps){
 s.counts.fill(0);
 for(const slot of s.owner)if(slot>=0&&slot<s.counts.length)s.counts[slot]++;
 for(const p of ps)if(p.cc)p.score=s.counts[p.cc.slot]/s.owner.length*100;
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
 const positions=startPositions(s,ps.length);
 ps.forEach((p,slot)=>{
  const q=positions[slot];p.active=true;p.score=0;p.x=q.x;p.y=q.y;
  p.vx=0;p.vy=0;p.dir={x:1,y:0};p.face=1;
  p.cc={slot,alive:true,respawn:0,invulnerable:0,trail:[],distance:0,
   origin:null,deaths:0,bot:null,shieldClock:0};
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
 const map=new Map(),bucket=32;
 for(const p of ps){
  const cc=p.cc;if(!cc?.alive||cc.trail.length<2)continue;
  for(let k=1;k<cc.trail.length;k++){
   const a=cc.trail[k-1],b=cc.trail[k],segment={a,b,owner:p,at:b.d};
   const x0=Math.floor((Math.min(a.x,b.x)-6)/bucket),x1=Math.floor((Math.max(a.x,b.x)+6)/bucket);
   const y0=Math.floor((Math.min(a.y,b.y)-6)/bucket),y1=Math.floor((Math.max(a.y,b.y)+6)/bucket);
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
 let best=null,bestScore=-INF;
 for(let i=0;i<s.owner.length;i++){
  if(s.owner[i]!==p.cc.slot)continue;
  const v=center(s,i);
  let score=15;
  for(const o of ps)if(o!==p&&o.cc?.alive){
   const d=dist(v,o);score+=Math.min(120,d)*.08;
   if(d<32)score-=200;
  }
  if(score>bestScore){bestScore=score;best=v;}
 }
 if(best)return best;
 // Total capture does not eliminate a player: restore a small owned island.
 for(let k=0;k<80;k++){
  const v={x:s.field.x+30+rng(s)*(s.field.w-60),
   y:s.field.y+30+rng(s)*(s.field.h-60)};
  if(ps.every(o=>o===p||!o.cc?.alive||dist(o,v)>65)){
   claimDisk(s,p.cc.slot,v.x,v.y,25);recount(s,ps);return v;
  }
 }
 const v={x:s.field.x+s.field.w*.5,y:s.field.y+s.field.h*.5};
 claimDisk(s,p.cc.slot,v.x,v.y,25);recount(s,ps);return v;
}
function kill(s,p){
 const q=p.cc;if(!q.alive)return;
 q.alive=false;q.respawn=SETTINGS.respawn;q.invulnerable=0;
 q.trail=[];q.distance=0;q.origin=null;q.deaths++;q.bot=null;
 p.vx=0;p.vy=0;
}
function revive(s,p,ps){
 const q=p.cc,pos=spawnPlace(s,p,ps);
 p.x=pos.x;p.y=pos.y;p.vx=0;p.vy=0;
 q.alive=true;q.respawn=0;q.invulnerable=SETTINGS.protection;
 q.trail=[];q.distance=0;q.origin=null;q.bot=null;
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
 // Resolve simultaneous captures from one ownership snapshot; contested
 // tiles keep their old owner rather than awarding precedence to player IDs.
 const count=new Uint8Array(s.owner.length),slot=new Int16Array(s.owner.length).fill(-1);
 for(const p of closing){
  for(const i of captureMask(s,p)){count[i]++;if(count[i]===1)slot[i]=p.cc.slot;}
 }
 for(let i=0;i<s.owner.length;i++)if(count[i]===1)s.owner[i]=slot[i];
 for(const p of closing){p.cc.trail=[];p.cc.distance=0;p.cc.origin=null;p.cc.bot=null;}
 recount(s,ps);
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
   if(!q.trail.length){q.origin=from;q.trail.push({...from,d:0});q.distance=0;}
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
  for(const e of trailHits(map,from,to,5)){
   if(e.owner===p){
    if(q.distance-e.at<27)continue; // attached head, not a self-cut
    dead.add(p);
   }else if(q.invulnerable<=0)dead.add(e.owner);
  }
 }
 // New-to-new crossing in the same physics tick is simultaneous.
 const strokes=[...newTrails.values()];
 for(let i=0;i<strokes.length;i++)for(let j=i+1;j<strokes.length;j++){
  const a=strokes[i],b=strokes[j];
  if(segmentsTouch(a.a,a.b,b.a,b.b,5)){
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
   pointSegment2(s.item,old.get(p.id),p)<(SETTINGS.radius+14)**2);
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
 return {remaining:round.remaining,survivors:active(ps).length,
  percentages:active(ps).map(p=>({id:p.id,percent:p.score,tiles:s.counts[p.cc.slot]})),
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
function drawScene(g,s){
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
 for(let y=0;y<s.rows;y++){
  let x=0;
  while(x<s.cols){
   const slot=s.owner[y*s.cols+x];if(slot<0){x++;continue;}
   let end=x+1;while(end<s.cols&&s.owner[y*s.cols+end]===slot)end++;
   const p=s.roster[slot];
   g.globalAlpha=.77;g.fillStyle=p?.color||'#9ad5ff';
   g.fillRect(f.x+x*CELL,f.y+y*CELL,(end-x)*CELL,CELL+.3);x=end;
  }
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
 for(const p of active(ps)){
  const q=p.cc;if(!q.alive||q.trail.length<2)continue;
  g.save();g.lineCap='round';g.lineJoin='round';
  for(const [width,alpha,blur] of [[13,.25,14],[7,.95,5]]){
   g.beginPath();g.moveTo(q.trail[0].x,q.trail[0].y);
   for(let i=1;i<q.trail.length;i++)g.lineTo(q.trail[i].x,q.trail[i].y);
   g.strokeStyle=p.color;g.globalAlpha=alpha;g.lineWidth=width;
   g.shadowColor=p.color;g.shadowBlur=blur;g.stroke();
  }
  g.restore();
 }
 if(s.item){
  const img=frostImage(),pulse=1+Math.sin(t*5)*.08;
  g.save();g.translate(s.item.x,s.item.y);g.scale(pulse,pulse);
  disk(g,0,0,23,'rgba(75,196,255,.14)');
  if(img?.complete&&img.naturalWidth)g.drawImage(img,-17,-17,34,34);
  else{
   g.strokeStyle='#adf5ff';g.lineWidth=3;
   for(let i=0;i<6;i++){const a=i*TAU/6;g.beginPath();g.moveTo(0,0);
    g.lineTo(Math.cos(a)*15,Math.sin(a)*15);g.stroke();}
  }
  g.restore();
 }
 for(const p of active(ps)){
  const q=p.cc;
  if(!q.alive)continue;
  g.save();g.shadowColor=p.color;g.shadowBlur=7;
  disk(g,p.x,p.y+5,SETTINGS.radius+3,'rgba(0,0,0,.23)');g.restore();
  if(window.PartyCharacters?.draw)window.PartyCharacters.draw(g,p,{time:t,combat:false});
  else{disk(g,p.x,p.y,SETTINGS.radius,p.color||'#80efff');}
  if(freezeActive(s,p)){
   g.save();g.globalAlpha=.75;g.strokeStyle='#b9efff';g.lineWidth=3;
   g.beginPath();g.arc(p.x,p.y,SETTINGS.radius+5,0,TAU);g.stroke();
   g.beginPath();g.moveTo(p.x-10,p.y);g.lineTo(p.x+10,p.y);
   g.moveTo(p.x,p.y-10);g.lineTo(p.x,p.y+10);g.stroke();g.restore();
  }
  if(q.invulnerable>0){
   g.save();g.strokeStyle='#fff8be';g.lineWidth=2;
   g.beginPath();g.arc(p.x,p.y,SETTINGS.radius+9,0,TAU);g.stroke();g.restore();
  }
 }
 g.restore();
}
window.ColorClaim=Object.freeze({setup,update,step,draw,hud,finish,index,owned,claimDisk,
 recount,captureMask,applyCaptures,segmentsTouch,pointSegment2,kill,revive,freezeActive,
 config:SETTINGS});
})();