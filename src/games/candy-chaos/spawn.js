/* Spawn Manager — one place that decides where candies and bombs may appear. */
import {C,TAU,candyBand} from './config.js';
import {rng,fxr,rr} from './rng.js';
const hyp=Math.hypot;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const CANDY_KINDS=5,CANDY_COLORS=6;

/* ---------- pooled objects ---------- */
function addCandy(s,x,y,born){
 const c=s.pool.candy.pop()||{};
 c.id=++s.uid;c.x=x;c.y=y;c.kind=Math.floor(rng(s)*CANDY_KINDS);c.color=Math.floor(rng(s)*CANDY_COLORS);
 c.ph=fxr(s)*TAU;c.born=born;
 s.candies.push(c);return c;
}
function addBomb(s,x,y,targetId){
 const b=s.pool.bomb.pop()||{};
 b.id=++s.uid;b.x=x;b.y=y;b.state='warn';b.t=0;b.hold=0;b.life=0;b.age=0;b.target=targetId;
 s.bombs.push(b);return b;
}
export function removeBomb(s,i){s.pool.bomb.push(s.bombs[i]);s.bombs.splice(i,1);}
export function removeCandy(s,i){s.pool.candy.push(s.candies[i]);s.candies.splice(i,1);}

/* ---------- candies ---------- */
function spotFree(s,live,x,y,o){
 const b=s.world.bounds;
 if(x<b.x+o.inset||x>b.x+b.w-o.inset||y<b.y+o.inset||y>b.y+b.h-o.inset)return false;
 for(const p of live)if(hyp(p.x-x,p.y-y)<o.player)return false;
 for(const bm of s.bombs)if(hyp(bm.x-x,bm.y-y)<o.bomb)return false;
 for(const c of s.candies)if(hyp(c.x-x,c.y-y)<o.candy)return false;
 return true;
}
function pickCandySpot(s,live){
 const b=s.world.bounds,inset=C.candyR+22;
 const opt={inset,player:C.radius+C.candyR+16,bomb:C.bombR+C.candyR+28,candy:C.candyGap};
 let best=null,bestScore=-Infinity;
 for(let i=0;i<12;i++){
  const x=b.x+inset+rng(s)*(b.w-2*inset),y=b.y+inset+rng(s)*(b.h-2*inset);
  if(!spotFree(s,live,x,y,opt))continue;
  let near=null,nd=Infinity;
  for(const p of live){const d=hyp(p.x-x,p.y-y);if(d<nd){nd=d;near=p;}}
  let sc=rng(s)*30;
  if(s.recent.length){let md=Infinity;for(const r of s.recent)md=Math.min(md,hyp(x-r.x,y-r.y));sc+=Math.min(md,220)*.5;}
  // do not keep dropping candies right next to the same player
  if(near&&s.lastNear.includes(near.id))sc-=45;
  if(sc>bestScore){bestScore=sc;best={x,y,near};}
 }
 return best;
}
function spawnCandyGroup(s,live,max,born){
 const spot=pickCandySpot(s,live);
 if(!spot)return false;
 addCandy(s,spot.x,spot.y,born);
 s.recent.push({x:spot.x,y:spot.y});if(s.recent.length>5)s.recent.shift();
 if(spot.near){s.lastNear.push(spot.near.id);if(s.lastNear.length>2)s.lastNear.shift();}
 if(s.candies.length<max&&rng(s)<.28){
  let extra=1+(rng(s)<.4?1:0);
  const opt={inset:C.candyR+22,player:C.radius+C.candyR+16,bomb:C.bombR+C.candyR+28,candy:C.clusterGap-2};
  for(let tries=0;tries<6&&extra>0&&s.candies.length<max;tries++){
   const a=rng(s)*TAU,d=C.clusterGap+rr(s,0,12),x=spot.x+Math.cos(a)*d,y=spot.y+Math.sin(a)*d;
   if(spotFree(s,live,x,y,opt)){addCandy(s,x,y,born);extra--;}
  }
 }
 return true;
}
export function fillCandies(s,live){
 const band=candyBand(s.originalCount,s.world);s.candyGoal=band[1];
 for(let i=0;i<24&&s.candies.length<band[0];i++)spawnCandyGroup(s,live,band[1],-1);
}
export function updateCandySpawns(s,live,dt){
 s.candyTimer-=dt;
 const band=candyBand(s.originalCount,s.world);
 if(s.candies.length>=s.candyGoal||s.candyTimer>0)return;
 const ok=spawnCandyGroup(s,live,band[1],s.clock);
 s.candyTimer=ok?.25+rng(s)*.45:.12;
 if(ok)s.candyGoal=band[0]+Math.floor(rng(s)*(band[1]-band[0]+1));
}
export function candyTaken(s){s.candyTimer=Math.min(s.candyTimer,.2+rng(s)*.35);}

/* ---------- bombs ---------- */
function escapeOK(s,x,y,p){
 const b=s.world.bounds;let free=0;
 for(let k=0;k<8;k++){
  const a=k*TAU/8,ex=p.x+Math.cos(a)*C.escapeDist,ey=p.y+Math.sin(a)*C.escapeDist;
  if(ex<b.x+C.radius||ex>b.x+b.w-C.radius||ey<b.y+C.radius||ey>b.y+b.h-C.radius)continue;
  if(hyp(ex-x,ey-y)<62)continue;
  let ok=true;
  for(const bm of s.bombs)if(hyp(ex-bm.x,ey-bm.y)<62){ok=false;break;}
  if(ok)free++;
 }
 return free>=3;
}
function bombSpotOK(s,live,x,y){
 const b=s.world.bounds;
 if(x<b.x+C.edge||x>b.x+b.w-C.edge||y<b.y+C.edge||y>b.y+b.h-C.edge)return false;
 for(const p of live){
  const gap=s.clock<p.dyn.immuneUntil?C.stunnedGap:C.playerGap;
  if(hyp(p.x-x,p.y-y)<gap)return false;
 }
 for(const bm of s.bombs)if(hyp(bm.x-x,bm.y-y)<C.bombGap)return false;
 for(const c of s.candies)if(hyp(c.x-x,c.y-y)<C.bombR+C.candyR+16)return false;
 for(const p of live)if(hyp(p.x-x,p.y-y)<170&&!escapeOK(s,x,y,p))return false;
 return true;
}
// Fair target rotation: everybody gets picked once per cycle; a player who is not
// moving (or is stunned/protected) keeps their place until they run again.
function pickTarget(s,live){
 s.rot=s.rot.filter(id=>live.some(p=>p.id===id));
 if(!s.rot.length){
  const ids=live.map(p=>p.id);
  for(let i=ids.length-1;i>0;i--){const j=Math.floor(rng(s)*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
  s.rot=ids;
 }
 for(let i=0;i<s.rot.length;i++){
  const p=live.find(q=>q.id===s.rot[i]);
  if(s.clock>=p.dyn.immuneUntil&&hyp(p.vx,p.vy)>=C.predictMinSpeed){s.rot.splice(i,1);return p;}
 }
 return null;
}
function predictedSpot(s,p){
 const T=rr(s,C.predictMin,C.predictMax),sp=hyp(p.vx,p.vy)||1,ux=p.vx/sp,uy=p.vy/sp;
 const lat=rr(s,-34,34),lon=rr(s,-26,26),b=s.world.bounds;
 const x=p.x+p.vx*T-uy*lat+ux*lon,y=p.y+p.vy*T+ux*lat+uy*lon;
 return{x:clamp(x,b.x+C.edge,b.x+b.w-C.edge),y:clamp(y,b.y+C.edge,b.y+b.h-C.edge)};
}
function spawnBomb(s,live){
 const b=s.world.bounds;
 let target=null;
 if(rng(s)<C.predictChance)target=pickTarget(s,live);
 for(let i=0;i<10;i++){
  let x,y,tid=null;
  if(target&&i<6){const q=predictedSpot(s,target);x=q.x;y=q.y;tid=target.id;}
  else{x=b.x+C.edge+rng(s)*(b.w-2*C.edge);y=b.y+C.edge+rng(s)*(b.h-2*C.edge);}
  if(bombSpotOK(s,live,x,y)){addBomb(s,x,y,tid);return true;}
 }
 return false;
}
export function updateBombSpawns(s,live,dt){
 s.bombTimer-=dt;
 if(s.clock<C.firstBomb||s.bombs.length>=s.bombCap||s.bombTimer>0)return;
 s.bombTimer=spawnBomb(s,live)?.35+rng(s)*.7:.15;
}
