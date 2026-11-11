/* Regression: Host lobby seats are inactive before minigame setup; minefield navigation must be reachable. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context=vm.createContext({window:{PartyCharacters:{activate(){}}},Date,Math});
vm.runInContext(fs.readFileSync('src/games/dangerfield/dangerfield.js','utf8'),context);
const G=context.window.DangerField;
assert.equal(typeof G.setup,'function');
for(const n of [1,2,6,7,12]){
 const players=Array.from({length:n},(_,i)=>({
  id:'p'+i,name:'Player '+i,type:i?'local':'remote',
  isBot:i>0,active:false,color:'#ff5522',input:{axisX:0,axisY:0}
 }));
 const round={phase:'countdown',dangerSeed:4242+n};
 const s=G.setup(round,players);
 assert.ok(s,'DANGERFIELD setup succeeds for '+n+' inactive lobby players');
 assert.ok(players.every(p=>p.active&&p.df&&p.df.state==='run'),'all players activate');
 assert.ok(s.mines.length>0,'minefield remains populated');
 assert.ok(s.startDist>0&&Number.isFinite(s.startDist),'valid navigation for '+n);
 assert.ok(s.slots.every(sl=>Number.isFinite(G.remainingAt(s,sl.x,sl.y))),
  'every possible spawn is connected to finish');
 assert.ok(round.remaining>0,'timer initialized');
}
// Balance contract: radar stays down 30% less per visibility blackout; impact timing unchanged.
assert.equal(G.config.speed,67.5);
assert.equal(G.config.mineR,20.8);
assert.equal(G.config.hazard,33.8);
assert.equal(G.config.introSeconds,3,'plane introduction stays at its original delay');
assert.equal(G.config.planeSpeed,760,'plane flight speed must remain unchanged');
assert.equal(G.config.bombTime,.55,'bomb flight animation must remain unchanged');
assert.equal(G.config.radar.shrinkTime,2.5,'radar damage animation must remain unchanged');
assert.equal(G.config.radar.lowVisibilityScale,.7,'radar poor-visibility intervals are 30% shorter');
assert.equal(G.config.mineRespawn,0.2,'mines must rearm after 200 ms, not the old 3.2 seconds');
// Repeated generation cannot produce a disconnected alternative route.
for(const n of [1,6,7,12])for(const seed of [1001,2026,7777]){
 const ps=Array.from({length:n},(_,i)=>({id:'seed-'+i,active:false,isBot:false,input:{axisX:0,axisY:0}}));
 const round={phase:'countdown',dangerSeed:seed};
 const s=G.setup(round,ps);
 assert.ok(s.mines.length>0);
 // A single unbranched continuous spine: just two endpoints and no forks.
 const route=s.routeNodes||[],nodes=new Set(route.map(p=>p.i+','+p.j));
 const degree=p=>[[1,0],[-1,0],[0,1],[0,-1]]
  .filter(([di,dj])=>nodes.has((p.i+di)+','+(p.j+dj))).length;
 assert.ok(route.length>15,'danger route must extend beyond a straight crossing');
 assert.equal(route.filter(p=>degree(p)===1).length,2,'two unique route endpoints');
 assert.ok(route.every(p=>degree(p)===1||degree(p)===2),'no parallel split or branching corridor');
 // A graph can be a single path yet mostly straight. Demand visible S-bends
 // throughout the arena and reject a long straight lower highway.
 const endpoints=route.filter(p=>degree(p)===1);
 const coords=new Map(route.map(p=>[p.i+','+p.j,p]));
 const walk=[endpoints[0]];let prev=null,cur=endpoints[0];
 while(walk.length<route.length){
  const next=[[1,0],[-1,0],[0,1],[0,-1]]
   .map(([di,dj])=>coords.get((cur.i+di)+','+(cur.j+dj)))
   .find(q=>q&&q!==prev);
  assert.ok(next,'route must be one continuous winding line');
  prev=cur;cur=next;walk.push(cur);
 }
 let turns=0,straight=0,longestStraight=0,previousDir=null;
 for(let i=1;i<walk.length;i++){
  const dir=walk[i].i===walk[i-1].i?'v':'h';
  if(previousDir&&previousDir!==dir)turns++;
  if(dir==='h'){straight++;longestStraight=Math.max(longestStraight,straight);}else straight=0;
  previousDir=dir;
 }
 assert.ok(turns>=4,'road requires multiple real hairpin turns, not a straight crossing');
 assert.ok(longestStraight<=6,'road must not have a long straight highway across the screen');
 assert.ok(walk.length>12+(n>6?20:12),'winding road must use the arena height');
 assert.ok(s.slots.every(q=>Number.isFinite(G.remainingAt(s,q.x,q.y))),
  'winding route disconnected for '+n+'/'+seed);
}
{
 const ps=[{id:'solo',active:false,isBot:false,input:{axisX:0,axisY:0}}],
  round={phase:'playing',paused:false,dangerSeed:789},s=G.setup(round,ps),mine=s.mines[0];
 ps[0].x=mine.x;ps[0].y=mine.y;
 G.step(1/60,round,ps);
 assert.equal(mine.alive,false,'triggered mine should explode');
 assert.equal(ps[0].df.state,'dead','explosion sends the runner to respawn');
 assert.ok(Math.abs((mine.respawnAt-s.clock)-.2)<1e-8,'exactly 0.2 s cooldown from blast clock');
 const deadline=mine.respawnAt;
 while(s.clock+1/60<deadline-1e-9)G.step(1/60,round,ps);
 assert.equal(mine.alive,false,'mine must stay hidden before 0.2 seconds');
 while(s.clock<deadline)G.step(1/60,round,ps);
 assert.equal(mine.alive,true,'mine must be armed again at 0.2 seconds');
 assert.ok(s.clock-deadline<=1/60+1e-8,'rearm must not be late beyond one fixed step');
 assert.equal(mine.respawnAt,Infinity,'rearmed mine no longer has a pending deadline');
 // The plane, impact, and radar shrink keep their original timing.
 while(s.clock<2.95&&!s.finished)G.step(1/60,round,ps);
 assert.equal(s.plane,null,'plane must not appear before the original 3-second intro');
 while(s.clock<3.1&&!s.finished)G.step(1/60,round,ps);
 assert.ok(s.plane,'plane appears after the original 3-second intro');
 while(s.clock<5.5&&!s.finished&&s.radar.hitAt===null)G.step(1/60,round,ps);
 assert.ok(s.radar.hitAt>=3.8&&s.radar.hitAt<=4.3,
  'impact remains unchanged: only radar outage time should change');
 while(s.clock<7.5&&!s.finished&&s.radar.phase!=='cycle')G.step(1/60,round,ps);
 assert.equal(s.radar.phase,'cycle','radar damage animation still completes normally');
 assert.ok(s.radar.left>=3.4*.7&&s.radar.left<=6.1*.7,
  'first post-impact low-visibility outage lasts 2.38–4.27 seconds instead of 3.4–6.1');
 const firstLowDuration=s.radar.left;
 // Force another low-visibility cycle without relying on RNG's 28% chance of
 // intermittent high/mid recovery. The repeated blackout must also be shorter.
 s.radar.regime='mid';s.radar.left=0;
 G.step(1/60,round,ps);
 assert.equal(s.radar.regime,'low');
 assert.ok(s.radar.left>=3.4*.7&&s.radar.left<=6.1*.7,
  'subsequent blackouts use the same 30% shorter duration');
 assert.ok(firstLowDuration<6.1,'original 6.1-second low-visibility interval is gone');
}
console.log('DANGERFIELD setup/navigation, mines, speed and airplane regression OK');
