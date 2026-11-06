/* COLOR SWITCH — host-authoritative territory battle (game 5). No DOM dependencies. */
(() => {
'use strict';
const TAU=Math.PI*2, FIXED=1/60;
const Combat=window.PartyCombatMotion;
const C=Object.freeze({speed:170,radius:14,punchRange:46,punchWindup:Combat.ATTACK.windup,
 punchActive:Combat.ATTACK.active,punchRecovery:Combat.ATTACK.recovery,punchCooldown:Combat.ATTACK.cooldown,punchStun:Combat.NORMAL_STUN,
 blastCooldown:2.8,blastCast:.18,botPunchRate:.084,boxSpawnInterval:8,
 rocketSpeed:360,rocketRadius:7,rocketLifetime:2.2,rocketStun:1.5});
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function rand(s){let n=s.seed|0;n^=n<<13;n^=n>>>17;n^=n<<5;s.seed=n||1234567;return (s.seed>>>0)/4294967296;}
function active(ps){return ps.filter(p=>p.active);}
function createArena(s,count){
 s.cols=count<=6?11:13;s.rows=count<=6?9:11;
 s.size=count<=6?44:41;
 s.board={x:(960-s.cols*s.size)/2,y:(540-s.rows*s.size)/2,w:s.cols*s.size,h:s.rows*s.size};
 s.tiles=Array.from({length:s.cols*s.rows},(_,id)=>({
  id,row:Math.floor(id/s.cols),column:id%s.cols,
  x:s.board.x+(id%s.cols)*s.size,y:s.board.y+Math.floor(id/s.cols)*s.size,
  ownerId:null,paintAnimation:0,lastCaptureEvent:0}));
 return s.tiles;
}
function tileAt(s,x,y){
 const col=Math.floor((x-s.board.x)/s.size),row=Math.floor((y-s.board.y)/s.size);
 return col>=0&&row>=0&&col<s.cols&&row<s.rows?s.tiles[row*s.cols+col]:null;
}
function cellCenter(s,t){return {x:t.x+s.size/2,y:t.y+s.size/2};}
function spawnPlayers(s,ps){
 const slots=[];
 for(let row=1;row<s.rows-1;row+=2)for(let col=1;col<s.cols-1;col+=2)slots.push(s.tiles[row*s.cols+col]);
 for(let i=slots.length-1;i>0;i--){const j=Math.floor(rand(s)*(i+1));[slots[i],slots[j]]=[slots[j],slots[i]];}
 active(ps).forEach((p,i)=>{
  const at=cellCenter(s,slots[i%slots.length]);p.x=at.x;p.y=at.y;p.vx=0;p.vy=0;
  p.dir={x:1,y:0};p.face=1;p.score=0;
  p.cs={stunRemaining:0,stunImmunity:0,punchCooldown:0,blastCooldown:0,
   punchState:null,castRemaining:0,bankedScore:0,territoryScore:0,
   actionLatch:false,altLatch:false,botTarget:null,botRetarget:0,
   botNextPunch:8+rand(s)*7,botNextBlast:0,fxClock:0};
  p.stun=0;p.punchCooldown=0;Combat.reset(p);
 });
}
function setup(round,ps){
 const s={clock:0,elapsed:0,remaining:0,duration:active(ps).length<=6?40:60,
  accumulator:0,seed:(Number(round.colorSeed)||Date.now()^0x6d213a9b)>>>0||1,
  tiles:[],board:null,cols:0,rows:0,size:0,boxes:[],rockets:[],rocketHits:new Map(),effects:[],
  boxCounter:0,burstCounter:0,usedBoxIds:new Set(),nextBoxSpawn:0,eventCounter:0,finished:false,
  winnerIds:[],ranking:[],totalCaptures:0,theme:'classic',mayan:null};
 round.colorSwitch=s;round.remaining=s.duration;
 ps.forEach(p=>{p.active=true;p.score=0;});
 const requested=['classic','mayan'].includes(round.colorTheme)?round.colorTheme:null;
 s.theme=requested||(rand(s)<.5?'classic':'mayan');
 // The default map remains playable when external theme code is unavailable.
 if(s.theme==='mayan'&&!window.ColorSwitchMayan)s.theme='classic';
 createArena(s,active(ps).length);spawnPlayers(s,ps);
 if(s.theme==='mayan')window.ColorSwitchMayan.setup(s,rand);
 s.nextBoxSpawn=C.boxSpawnInterval;
 return s;
}
// Shared scoreboard calculation: banked points never disappear when tiles change owner.
function refreshScore(p){
 if(!p?.cs)return p?.score||0;
 p.score=(p.cs.bankedScore||0)+(p.cs.territoryScore||0);
 return p.score;
}
function captureTile(s,t,p,ps){
 if(!t||!p||!p.active||t.ownerId===p.id)return false;
 if(t.ownerId!=null){
  const previous=ps.find(q=>q.id===t.ownerId);
  if(previous?.cs){previous.cs.territoryScore=Math.max(0,previous.cs.territoryScore-1);refreshScore(previous);}
 }
 t.ownerId=p.id;p.cs.territoryScore++;refreshScore(p);
 t.paintAnimation=.18;t.lastCaptureEvent=++s.eventCounter;s.totalCaptures++;
 if(s.effects.length<32)s.effects.push({x:t.x+s.size/2,y:t.y+s.size/2,
  color:p.color,life:.25,type:'spark'});
 return true;
}
// The avatar occupies a disk (radius = real character collision radius), not
// a single tile center. Sweeping it over the travel segment captures adjacent
// cells immediately when straddling a seam or corner — including diagonals.
function circleSegmentTouchesTile(t,size,x0,y0,x1,y1,radius){
 const left=t.x,top=t.y,right=left+size,bottom=top+size;
 const r2=radius*radius,dx=x1-x0,dy=y1-y0,len2=dx*dx+dy*dy;
 const distRectSq=(x,y)=>{
  const ax=x-clamp(x,left,right),ay=y-clamp(y,top,bottom);
  return ax*ax+ay*ay;
 };
 // Cover stationary body overlap and endpoint collisions.
 if(distRectSq(x0,y0)<=r2+1e-7||distRectSq(x1,y1)<=r2+1e-7)return true;
 // Cover long movements where the player's center enters the tile.
 let enter=0,leave=1;
 for(const [origin,delta,min,max] of [[x0,dx,left,right],[y0,dy,top,bottom]]){
  if(Math.abs(delta)<1e-10){
   if(origin<min||origin>max){enter=2;break;}
  }else{
   const a=(min-origin)/delta,b=(max-origin)/delta;
   enter=Math.max(enter,Math.min(a,b));
   leave=Math.min(leave,Math.max(a,b));
   if(enter>leave)break;
  }
 }
 if(enter<=leave)return true;
 // Close to tile edges/corners: exact segment-to-corner distance. For a
 // rectangle and segment, a minimum occurs at an endpoint or a corner.
 if(len2<=1e-12)return false;
 for(const x of [left,right])for(const y of [top,bottom]){
  const u=clamp(((x-x0)*dx+(y-y0)*dy)/len2,0,1);
  const ax=x-(x0+u*dx),ay=y-(y0+u*dy);
  if(ax*ax+ay*ay<=r2+1e-7)return true;
 }
 return false;
}
function capturePathTiles(s,p,ps,fromX,fromY){
 if(!p||!p.active)return;
 const x0=Number.isFinite(fromX)?fromX:p.x,y0=Number.isFinite(fromY)?fromY:p.y;
 const r=C.radius,b=s.board;
 // Restrict checks to the swept disk's tiles: no full-board scan per player.
 const left=clamp(Math.floor((Math.min(x0,p.x)-r-b.x)/s.size),0,s.cols-1);
 const right=clamp(Math.floor((Math.max(x0,p.x)+r-b.x)/s.size),0,s.cols-1);
 const top=clamp(Math.floor((Math.min(y0,p.y)-r-b.y)/s.size),0,s.rows-1);
 const bottom=clamp(Math.floor((Math.max(y0,p.y)+r-b.y)/s.size),0,s.rows-1);
 for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++){
  const tile=s.tiles[row*s.cols+col];
  if(tile.ownerId!==p.id&&circleSegmentTouchesTile(tile,s.size,x0,y0,p.x,p.y,r))
   captureTile(s,tile,p,ps);
 }
}
function updateTerritoryScores(s,ps){
 const counts=new Map();
 for(const t of s.tiles)if(t.ownerId!=null)counts.set(t.ownerId,(counts.get(t.ownerId)||0)+1);
 for(const p of ps){
  if(!p.cs)continue;
  p.cs.territoryScore=counts.get(p.id)||0;refreshScore(p);
 }
 return counts;
}
function clearLeftPlayers(s,ps){
 const departed=new Set(ps.filter(p=>!p.active).map(p=>p.id));
 if(!departed.size)return;
 for(const t of s.tiles)if(departed.has(t.ownerId)){
  t.ownerId=null;t.paintAnimation=.18;t.lastCaptureEvent=++s.eventCounter;
 }
 for(const p of ps)if(!p.active){if(p.cs)p.cs.territoryScore=0;p.score=0;}
}
function inputVector(p){
 const i=p.input||{};
 let x=Number.isFinite(i.axisX)?i.axisX:Number(!!i.right)-Number(!!i.left);
 let y=Number.isFinite(i.axisY)?i.axisY:Number(!!i.down)-Number(!!i.jump);
 const n=Math.hypot(x,y);if(n>1){x/=n;y/=n;}
 return {x,y,action:i.action===true,alt:i.alt===true};
}
function calculateBlastCells(s,p){
 const at=tileAt(s,p.x,p.y);if(!at)return [];
 const ids=[];
 for(let r=-1;r<=1;r++)for(let col=-1;col<=1;col++){
  const row=at.row+r,column=at.column+col;
  if(row>=0&&row<s.rows&&column>=0&&column<s.cols)ids.push(row*s.cols+column);
 }
 return ids;
}
function touchedByBlast(s,p,tileIds){
 const radius=C.radius;for(const id of tileIds){
  const t=s.tiles[id],dx=p.x-clamp(p.x,t.x,t.x+s.size),dy=p.y-clamp(p.y,t.y,t.y+s.size);
  if(dx*dx+dy*dy<=radius*radius)return true;
 }
 return false;
}
function applyStun(p,seconds,color='#ffe28a'){
 const c=p.cs;if(!c||c.stunImmunity>0)return false;
 c.punchState=null;c.stunRemaining=Math.max(c.stunRemaining,seconds);
 Combat.applyStun(p,seconds,color);return true;
}
function activateColorBlast(s,p,ps){
 const state=p.cs;if(!state||state.blastCooldown>0||state.stunRemaining>0||state.castRemaining>0)return false;
 const ids=calculateBlastCells(s,p);
 for(const id of ids)captureTile(s,s.tiles[id],p,ps);
 state.blastCooldown=C.blastCooldown;state.castRemaining=C.blastCast;
 if(s.effects.length<32)s.effects.push({x:p.x,y:p.y,color:p.color,life:.4,type:'blast'});
 return true;
}
function startPunch(p){
 const c=p.cs;if(!c||c.punchCooldown>0||c.stunRemaining>0||c.castRemaining>0)return false;
 p.stun=c.stunRemaining;p.punchCooldown=c.punchCooldown;
 if(!window.PartyCharacters.startPunch(p))return false;
 c.punchCooldown=p.punchCooldown;
 return true;
}
function resolvePunchHit(p,ps){
 return window.PartyCharacters.punchFriends(p,active(ps),{
   range:C.punchRange,coneCos:.45,
   canHit:target=>!!target.cs&&target.cs.stunImmunity<=0
 });
}
function updateCooldowns(dt,p,ps){
 const c=p.cs;
 for(const key of ['stunRemaining','stunImmunity','punchCooldown','blastCooldown','castRemaining'])
   c[key]=Math.max(0,c[key]-dt);
 if(c.stunRemaining===0&&c._wasStunned)c.stunImmunity=Math.max(c.stunImmunity,.22);
 c._wasStunned=c.stunRemaining>0;
 p.stun=c.stunRemaining;p.punchCooldown=c.punchCooldown;
 if(Combat.isAttacking(p))window.PartyCharacters.stepPunch(p,dt,()=>resolvePunchHit(p,ps));
}
// Only the authoritative host consumes and applies a box effect.
function bankTerritory(s,p){
 const cells=s.tiles.filter(t=>t.ownerId===p.id),gained=cells.length;
 p.cs.bankedScore+=gained;
 for(const t of cells){t.ownerId=null;t.paintAnimation=.24;t.lastCaptureEvent=++s.eventCounter;}
 p.cs.territoryScore=0;refreshScore(p);
 if(s.effects.length<32)s.effects.push({x:p.x,y:p.y,life:1.25,type:'text',
  text:'สะสมคะแนน +'+gained,color:'#ffe39a'});
 for(const t of cells.slice(0,18))if(s.effects.length<32)
  s.effects.push({x:t.x+s.size/2,y:t.y+s.size/2,life:.48,type:'bank',color:'#ffda77'});
 return gained;
}
function fireRocketBurst(s,box,owner){
 const burstId=++s.burstCounter;s.rocketHits.set(burstId,new Set());
 for(let i=0;i<8;i++){
  const angle=i*Math.PI/4;
  s.rockets.push({id:burstId*8+i,burstId,ownerId:owner.id,x:box.x,y:box.y,
   vx:Math.cos(angle)*C.rocketSpeed,vy:Math.sin(angle)*C.rocketSpeed,
   radius:C.rocketRadius,lifetime:C.rocketLifetime,active:true});
 }
 if(s.effects.length<32)s.effects.push({x:owner.x,y:owner.y,life:1.1,
  type:'text',text:'ROCKET ×8',color:'#ffd8a1'});
 return burstId;
}
function segmentCircleHit(x0,y0,x1,y1,cx,cy,r){
 const dx=x1-x0,dy=y1-y0,len2=dx*dx+dy*dy;
 const t=len2>0?clamp(((cx-x0)*dx+(cy-y0)*dy)/len2,0,1):0;
 const xx=x0+t*dx-cx,yy=y0+t*dy-cy;
 return xx*xx+yy*yy<=r*r?t:null;
}
function updateRockets(s,ps,dt){
 if(s.finished){s.rockets=[];s.rocketHits.clear();return;}
 const next=[],border=s.board;
 for(const rocket of s.rockets){
  const x0=rocket.x,y0=rocket.y;
  rocket.x+=rocket.vx*dt;rocket.y+=rocket.vy*dt;rocket.lifetime-=dt;
  const targets=active(ps).filter(p=>p.id!==rocket.ownerId).map(p=>({
   p,t:segmentCircleHit(x0,y0,rocket.x,rocket.y,p.x,p.y,C.radius+rocket.radius)
  })).filter(o=>o.t!==null).sort((a,b)=>a.t-b.t||String(a.p.id).localeCompare(String(b.p.id)));
  const target=targets[0]?.p;
  if(target){
   const hitSet=s.rocketHits.get(rocket.burstId);
   if(hitSet&&!hitSet.has(target.id)){
    hitSet.add(target.id);
    applyStun(target,C.rocketStun,ps.find(p=>p.id===rocket.ownerId)?.color||'#ffe4a0');
   }
   if(s.effects.length<32)s.effects.push({x:rocket.x,y:rocket.y,life:.38,type:'impact',color:'#ffb35b'});
   continue;
  }
  if(rocket.lifetime<=0||rocket.x<border.x-15||rocket.x>border.x+border.w+15||
     rocket.y<border.y-15||rocket.y>border.y+border.h+15)continue;
  next.push(rocket);
 }
 s.rockets=next;
 const live=new Set(next.map(r=>r.burstId));
 for(const id of s.rocketHits.keys())if(!live.has(id))s.rocketHits.delete(id);
}
// New boxes arrive every eight seconds regardless of existing stock.
// A wave has 2 boxes for up to 9 players, and 3 for 10–12 players.
// Each wave always includes at least one ROCKET BOX and one SCORE BANK BOX.
function spawnPowerBox(s,ps,type=null){
 const findCandidates=(playerGap,boxGap)=>s.tiles.filter(t=>{
  if(t.column<1||t.row<1||t.column>=s.cols-1||t.row>=s.rows-1)return false;
  const center=cellCenter(s,t);
  return active(ps).every(p=>Math.hypot(center.x-p.x,center.y-p.y)>s.size*playerGap)&&
   s.boxes.every(b=>Math.hypot(center.x-b.x,center.y-b.y)>s.size*boxGap);
 });
 // Relax padding only when the map is crowded, without placing a box on a player or another box.
 let candidates=findCandidates(1.1,1.5);
 if(!candidates.length)candidates=findCandidates(.75,1);
 if(!candidates.length)return false;
 const at=cellCenter(s,candidates[Math.floor(rand(s)*candidates.length)]);
 s.boxes.push({id:++s.boxCounter,type:type|| (rand(s)<.7?'score_bank':'rocket'),
  x:at.x,y:at.y,spawnTime:s.elapsed,active:true,collectedBy:null});
 return true;
}
function collectPowerBox(s,ps){
 const ordered=active(ps).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 for(const box of [...s.boxes]){
  if(!box.active||s.usedBoxIds.has(box.id))continue;
  const claim=ordered.find(p=>p.cs&&Math.hypot(p.x-box.x,p.y-box.y)<=C.radius+9);
  if(!claim)continue;
  box.active=false;box.collectedBy=claim.id;s.usedBoxIds.add(box.id);
  s.boxes.splice(s.boxes.indexOf(box),1);
  if(box.type==='rocket')fireRocketBurst(s,box,claim);
  else bankTerritory(s,claim);
 }
}
function updateBoxes(s,ps){
 // Never expire uncollected boxes or impose a cap. Spawn 2 boxes with 1–9
 // players, 3 boxes with 10–12 players, at 8,16,24... seconds.
 s.boxes=s.boxes.filter(b=>b.active);
 while(s.elapsed+1e-7>=s.nextBoxSpawn&&s.nextBoxSpawn<s.duration){
  const batch=rand(s)<.5?['rocket','score_bank']:['score_bank','rocket'];
  // Scale the large map's box waves with player count (7–9: 2, 10–12: 3).
  if(active(ps).length>=10){
   const extra=rand(s)<.5?'rocket':'score_bank';
   batch.splice(Math.floor(rand(s)*3),0,extra);
  }
  for(const type of batch)spawnPowerBox(s,ps,type);
  s.nextBoxSpawn+=C.boxSpawnInterval;
 }
 collectPowerBox(s,ps);
}
function botControls(s,p,ps){
 const c=p.cs;
 // Paint first: target the nearest connected patch of tiles not owned by this
 // bot, including enemy territory. Do not pathfind toward rocket pickups.
 if(s.clock>=c.botRetarget||!s.tiles[c.botTarget]||s.tiles[c.botTarget].ownerId===p.id){
  let best=null,bestValue=-Infinity;
  for(const t of s.tiles){
   if(t.ownerId===p.id)continue;
   const center=cellCenter(s,t),dx=center.x-p.x,dy=center.y-p.y;
   const distance=Math.hypot(dx,dy);
   let paintable=0;
   for(let row=Math.max(0,t.row-1);row<=Math.min(s.rows-1,t.row+1);row++)
    for(let col=Math.max(0,t.column-1);col<=Math.min(s.cols-1,t.column+1);col++)
     if(s.tiles[row*s.cols+col].ownerId!==p.id)paintable++;
   const forward=distance>0?(dx*(p.dir?.x||1)+dy*(p.dir?.y||0))/distance:0;
   const value=paintable*12-distance*.6+Math.max(0,forward)*8+
    (t.ownerId!=null?6:0)+rand(s)*3;
   if(value>bestValue){bestValue=value;best=t.id;}
  }
  c.botTarget=best;c.botRetarget=s.clock+.65+rand(s)*.35;
 }
 const target=s.tiles[c.botTarget]||s.tiles[Math.floor(rand(s)*s.tiles.length)];
 let point=cellCenter(s,target);
 // Bank only as a nearby detour after scoring meaningful territory; never
 // waste travel time chasing boxes while there are cells left to paint.
 if(c.territoryScore>=12){
  const nearby=s.boxes.filter(b=>b.type==='score_bank'&&
    Math.hypot(b.x-p.x,b.y-p.y)<=s.size*1.15).sort((a,b)=>
     Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
  if(nearby.length)point={x:nearby[0].x,y:nearby[0].y};
 }
 const dx=point.x-p.x,dy=point.y-p.y,d=Math.hypot(dx,dy);
 let x=d>3?dx/d:0,y=d>3?dy/d:0;
 // Use the existing shared physical separation without chasing the opponent.
 for(const other of active(ps))if(other.id!==p.id){
  const ax=p.x-other.x,ay=p.y-other.y,dist=Math.hypot(ax,ay);
  if(dist<34&&dist>1){x+=ax/dist*.5;y+=ay/dist*.5;}
 }
 const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}
 // A punch is defensive only when another avatar physically blocks the path.
 const threatened=active(ps).some(q=>q.id!==p.id&&
  Math.hypot(q.x-p.x,q.y-p.y)<=C.radius*2+5&&
  ((q.x-p.x)*(p.dir?.x||1)+(q.y-p.y)*(p.dir?.y||0))>5);
 const action=threatened&&s.clock>=c.botNextPunch&&c.punchCooldown===0;
 const ids=calculateBlastCells(s,p),gain=ids.filter(id=>s.tiles[id].ownerId!==p.id).length;
 const blast=c.blastCooldown===0&&s.clock>=c.botNextBlast&&gain>=4;
 if(action)c.botNextPunch=s.clock+(1.15+rand(s)*.45)/C.botPunchRate;
 if(blast)c.botNextBlast=s.clock+3+rand(s)*1.2;
 return {x,y,action,alt:blast};
}
function resolvePlayerCollisions(s,ps){
 return window.PartyCharacters.resolve(ps,{
   radius:C.radius,iterations:5,maxShift:5,
   pressure:false,bounds:s.board
 });
}
function calculateFinalRanking(s,ps){
 updateTerritoryScores(s,ps);
 const rank=active(ps).slice().sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));
 s.ranking=rank.map(p=>({id:p.id,score:p.score,rank:1+rank.filter(q=>q.score>p.score).length}));
 s.winnerIds=rank.length?rank.filter(p=>p.score===rank[0].score).map(p=>p.id):[];
 return s.ranking;
}
function finishMatch(s,round,ps){
 calculateFinalRanking(s,ps);s.finished=true;s.rockets=[];s.rocketHits.clear();round.remaining=0;return 'winner';
}
function step(dt,round,ps){
 const s=round.colorSwitch;if(s.finished)return;
 s.clock+=dt;s.elapsed=Math.min(s.duration,s.elapsed+dt);
 clearLeftPlayers(s,ps);
 const moved=new Map(),ctrl=new Map();
 const people=active(ps).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 for(const p of people){
  moved.set(p.id,{x:p.x,y:p.y});updateCooldowns(dt,p,people);
  const v=p.isBot?botControls(s,p,people):inputVector(p);ctrl.set(p.id,v);
  const canMove=p.cs.stunRemaining===0&&p.cs.castRemaining===0&&!Combat.isAttacking(p);
  const vx=canMove?v.x*C.speed:0,vy=canMove?v.y*C.speed:0;
  p.vx=vx;p.vy=vy;
  if(Math.hypot(v.x,v.y)>.1&&canMove){const m=Math.hypot(v.x,v.y);p.dir={x:v.x/m,y:v.y/m};p.face=v.x<0?-1:1;}
  const b=s.board,r=C.radius;
  p.x=clamp(p.x+vx*dt,b.x+r,b.x+b.w-r);
  p.y=clamp(p.y+vy*dt,b.y+r,b.y+b.h-r);
 }
 resolvePlayerCollisions(s,people);
 for(const p of people){const prev=moved.get(p.id);capturePathTiles(s,p,ps,prev.x,prev.y);}
 // Deterministic input action order; one keypress can only generate one action.
 for(const p of people){
  const c=p.cs,v=ctrl.get(p.id),a=v.action,b=v.alt;
  if(a&&!c.actionLatch)startPunch(p);
  if(b&&!c.altLatch)activateColorBlast(s,p,ps);
  c.actionLatch=a;c.altLatch=b;
 }
 updateBoxes(s,people);
 updateRockets(s,people,dt);
 if(s.theme==='mayan')window.ColorSwitchMayan.update(dt,s,people,applyStun,rand);
 for(const t of s.tiles)t.paintAnimation=Math.max(0,t.paintAnimation-dt);
 for(const e of s.effects)e.life-=dt;
 s.effects=s.effects.filter(e=>e.life>0).slice(-32);
 s.remaining=Math.max(0,s.duration-s.elapsed);round.remaining=s.remaining;
 if(s.remaining===0)finishMatch(s,round,ps);
}
function update(dt,round,ps){
 const s=round.colorSwitch;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.24,s.accumulator+clamp(dt,0,.24));
 let steps=0;
 while(s.accumulator>=FIXED&&steps++<15&&!s.finished){step(FIXED,round,ps);s.accumulator-=FIXED;}
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.colorSwitch;
 return {survivors:active(ps).length,remaining:s?s.remaining:0,
  scores:active(ps).map(p=>({id:p.id,score:p.score||0})),winnerIds:s?.winnerIds||[]};
}
function drawScenery(ctx,s){
 if(s.theme==='mayan'){window.ColorSwitchMayan.drawGround(ctx,s);return;}
 ctx.fillStyle='#4b9166';ctx.fillRect(0,0,960,540);
 ctx.fillStyle='#357a58';for(let i=0;i<48;i++){
  const x=(i*73+29)%960,y=(i*139+71)%540;
  ctx.beginPath();ctx.arc(x,y,2+i%4,0,TAU);ctx.fill();
 }
 const b=s.board;
 ctx.fillStyle='#233b2e';ctx.fillRect(b.x-11,b.y-11,b.w+22,b.h+25);
 ctx.fillStyle='#e5c891';ctx.fillRect(b.x-8,b.y-8,b.w+16,b.h+16);
 ctx.fillStyle='#886b48';ctx.fillRect(b.x-5,b.y-5,b.w+10,b.h+10);
 for(let i=0;i<22;i++){
  const x=i<11?30+i*83:30+(i-11)*83,y=i<11?35:505;
  if(x>b.x-20&&x<b.x+b.w+20)continue;
  ctx.fillStyle='#31583c';ctx.beginPath();ctx.arc(x,y+7,19,0,TAU);ctx.fill();
  ctx.fillStyle='#347e4c';ctx.beginPath();ctx.arc(x,y,16,0,TAU);ctx.fill();
  ctx.fillStyle='#5cb873';ctx.beginPath();ctx.arc(x-6,y-7,9,0,TAU);ctx.fill();
 }
}
function draw(ctx,time,round,ps){
 const s=round.colorSwitch;if(!s)return;
 ctx.save();ctx.clearRect(0,0,960,540);drawScenery(ctx,s);
 const colors=new Map(ps.map(p=>[p.id,p.color]));
 for(const t of s.tiles){
  ctx.fillStyle=s.theme==='mayan'?'#342c24':'#493b2e';ctx.fillRect(t.x,t.y,s.size,s.size);
  ctx.fillStyle=t.ownerId==null?(s.theme==='mayan'?'#756c57':'#ae8559'):colors.get(t.ownerId)||'#ae8559';
  ctx.fillRect(t.x+1.2,t.y+1.2,s.size-2.4,s.size-2.4);
  ctx.fillStyle=t.ownerId==null?(s.theme==='mayan'?'#998f72':'#d7ae76'):'#ffffff22';
  ctx.fillRect(t.x+3,t.y+3,s.size-6,3);
  if(s.theme==='mayan'){
   ctx.strokeStyle=t.ownerId==null?'#4b4232':'#172e3b66';
   ctx.lineWidth=2;ctx.strokeRect(t.x+10,t.y+10,s.size-20,s.size-20);
   ctx.lineWidth=1;ctx.strokeRect(t.x+16,t.y+16,s.size-32,s.size-32);
  }
  if(t.paintAnimation>0){ctx.globalAlpha=Math.min(.6,t.paintAnimation*3);
   ctx.fillStyle='#fff';ctx.fillRect(t.x+2,t.y+2,s.size-4,s.size-4);ctx.globalAlpha=1;}
 }
 if(s.theme==='mayan')window.ColorSwitchMayan.drawDevices(ctx,s);
 for(const box of s.boxes){
  const bob=Math.sin(s.clock*5+box.id)*3,rocket=box.type==='rocket';
  ctx.save();ctx.translate(box.x,box.y+bob);
  ctx.fillStyle='#151e20aa';ctx.beginPath();ctx.ellipse(0,15,15,5,0,0,TAU);ctx.fill();
  ctx.fillStyle=rocket?'#692923':'#5c4221';ctx.fillRect(-14,-12,28,28);
  ctx.fillStyle=rocket?'#f36d42':'#dfb957';ctx.fillRect(-12,-14,24,24);
  ctx.strokeStyle=rocket?'#ffe0ac':'#fff2c7';ctx.lineWidth=2;ctx.strokeRect(-12,-14,24,24);
  if(rocket)window.PartyUiArt.draw(ctx,'rocket',0,-2,24);
  else if(!window.PartyUiArt.draw(ctx,'coin',0,-2,24)){
   ctx.fillStyle='#fff0a1';ctx.beginPath();ctx.arc(0,-2,9,0,TAU);ctx.fill();
   ctx.strokeStyle='#b48032';ctx.beginPath();ctx.arc(0,-2,6,0,TAU);ctx.stroke();
  }
  ctx.restore();
 }
 for(const rocket of s.rockets){
  ctx.save();ctx.translate(rocket.x,rocket.y);
  ctx.rotate(Math.atan2(rocket.vy,rocket.vx)+Math.PI/2);
  ctx.fillStyle='#ffb14c';ctx.beginPath();ctx.moveTo(-4,8);
  ctx.lineTo(0,18+Math.sin(s.clock*30+rocket.id)*3);ctx.lineTo(4,8);ctx.fill();
  ctx.fillStyle='#e85a56';ctx.beginPath();ctx.moveTo(-5,4);ctx.lineTo(-10,12);
  ctx.lineTo(-3,9);ctx.lineTo(3,9);ctx.lineTo(10,12);ctx.lineTo(5,4);ctx.fill();
  ctx.fillStyle='#e8f5ff';ctx.strokeStyle='#6895aa';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(0,-14);ctx.quadraticCurveTo(8,-5,6,8);
  ctx.lineTo(-6,8);ctx.quadraticCurveTo(-8,-5,0,-14);ctx.fill();ctx.stroke();
  ctx.fillStyle='#64cbeb';ctx.beginPath();ctx.arc(0,-3,3,0,TAU);ctx.fill();
  ctx.restore();
 }
 for(const p of active(ps)){
  window.PartyCharacters.draw(ctx,p,{time:s.clock});
 }
 for(const e of s.effects){
  ctx.save();ctx.globalAlpha=clamp(e.life*(e.type==='text'?1.2:2.8),0,.95);
  if(e.type==='text'){
   ctx.fillStyle=e.color;ctx.strokeStyle='#192b2b';ctx.lineWidth=4;
   ctx.font='900 16px sans-serif';ctx.textAlign='center';
   const yy=e.y-27+(1.25-e.life)*-19;
   ctx.strokeText(e.text,e.x,yy);ctx.fillText(e.text,e.x,yy);
  }else if(e.type==='blast'){
   ctx.strokeStyle=e.color;ctx.lineWidth=4;ctx.beginPath();
   ctx.arc(e.x,e.y,(.4-e.life)*145+7,0,TAU);ctx.stroke();
  }else{
   ctx.fillStyle=e.color;ctx.beginPath();ctx.arc(e.x,e.y,
    e.type==='impact'?(.4-e.life)*30+6:Math.max(2,(.5-e.life)*15+4),0,TAU);ctx.fill();
  }
  ctx.restore();
 }
 if(s.theme==='mayan')window.ColorSwitchMayan.drawBullets(ctx,s);
 ctx.fillStyle='#152b2add';ctx.fillRect(13,12,174,57);
 ctx.fillStyle='#f5ffeb';ctx.font='900 17px sans-serif';ctx.textAlign='left';ctx.fillText('COLOR SWITCH',23,34);
 ctx.font='bold 13px sans-serif';ctx.fillStyle='#ffe3a0';
 ctx.fillText(round.phase==='countdown'?'เริ่มใน '+Math.ceil(round.countdown):'เวลา '+Math.ceil(s.remaining)+' วินาที',23,55);
 if(round.phase==='playing'&&s.remaining<=10){
  ctx.fillStyle='#ffe0a0';ctx.font='900 33px sans-serif';ctx.textAlign='center';
  if(s.remaining<=3)ctx.fillText(String(Math.ceil(s.remaining)),480,46);
 }
 ctx.restore();
}
window.ColorSwitch=Object.freeze({setup,update,draw,hud,createArena,tileAt,
 captureTile,capturePathTiles,updateTerritoryScores,startPunch,resolvePunchHit,
 activateColorBlast,calculateBlastCells,spawnPowerBox,collectPowerBox,
 bankTerritory,fireRocketBurst,updateRockets,refreshScore,
 resolvePlayerCollisions,calculateFinalRanking,finishMatch,constants:C});
})();
