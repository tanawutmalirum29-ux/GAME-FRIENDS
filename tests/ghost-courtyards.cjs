/* Real engine regressions for the four authored GHOST ATTACK courtyards. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let seed=1;
const math=Object.create(Math);
math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const host=vm.createContext({window:{},Math:math});
for(const file of ['arena-art.js','player-avatar.js','combat-motion.js','character-system.js','src/shared/graveyard-art.js','src/games/ghost-attack/ghost-attack.js']){
 let source=fs.readFileSync(file,'utf8');
 // Exercise the production navigation, spawn and collision functions directly.
 if(file==='src/games/ghost-attack/ghost-attack.js')source=source.replace('window.GhostAttack={',
  'window.ghostQA={makeCourtyard,freeSpot,safeCircle,walk,botNavGrid,botNavRoute,botNeighbors,botCellPoint,botClosestCell};window.GhostAttack={');
 vm.runInContext(source,host,{filename:file});
}
const engine=host.window.GhostAttack,qa=host.window.ghostQA;
function make(n,theme,matchSeed=19){
 seed=matchSeed;
 const players=Array.from({length:n},(_,i)=>({id:'p'+i,name:'P'+i,color:'#5edac3',isBot:false})),round={};
 engine.setup(round,players);
 if(round.ghost.theme!==theme)engine.setup(round,players);
 return {players,round,s:round.ghost};
}
const inside=(b,p,r=0)=>p.x>=b.x+r-1e-6&&p.x<=b.x+b.w-r+1e-6&&p.y>=b.y+r-1e-6&&p.y<=b.y+b.h-r+1e-6;
const clear=(s,p,r=15)=>s.obstacles.every(o=>qa.safeCircle(o,p.x,p.y,r));
let walkedRoutes=0,collisions=0;
for(const theme of ['graveyard','egypt'])for(const count of [6,12]){
 const {s,round}=make(count,theme),tag=theme+'/'+count;
 assert.match(s.mapId,/-v4$/);assert.equal(new Set(s.obstacles.map(o=>o.id)).size,s.obstacles.length);
 const props=s.obstacles.filter(o=>o.kind!=='hud-blocker'&&!o.boundary);
 assert.equal(s.obstacles.filter(o=>o.boundary).length,4,'four real perimeter walls');
 assert.ok(props.some(o=>o.kind.endsWith('fence')),'fences have real colliders');
 assert.ok(clear(s,s.spawn,30),'initial ghost spawn is clear: '+tag);
 for(const a of props){
  assert.ok(inside(s.arena,{x:a.x,y:a.y})&&inside(s.arena,{x:a.x+a.w,y:a.y+a.h}));
  assert.equal(engine.obstacleAt(round,a.x+a.w/2,a.y+a.h/2).id,a.id);
  for(const b of props)if(a.id<b.id)assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,
    'no overlapping props '+tag+' '+a.id+' '+b.id);
 }
 // Test the full 32px production nav grid, including diagonal corner rules.
 const nav=qa.botNavGrid(s),first=Array.from(nav.clear).findIndex(Boolean),seen=new Set([first]),queue=[first];
 for(let i=0;i<queue.length;i++)for(const [next] of qa.botNeighbors(nav,queue[i]))if(!seen.has(next)){seen.add(next);queue.push(next);}
 assert.equal(seen.size,Array.from(nav.clear).filter(Boolean).length,'no isolated walkable pocket '+tag);
 assert.ok(seen.size>150,'many connected escape cells '+tag);
 // Four quadrants and all interior prop sides are part of the same arena.
 for(const cell of seen){
  const end=qa.botCellPoint(nav,cell),start=qa.botCellPoint(nav,first);
  const route=qa.botNavRoute(s,start,end);
  assert.ok(route.length||Math.hypot(start.x-end.x,start.y-end.y)<32,'A* finds every cell '+tag);
  let previous=start;
  for(const next of route){
   const steps=Math.ceil(Math.hypot(next.x-previous.x,next.y-previous.y)/4);
   for(let k=1;k<=steps;k++)assert.ok(clear(s,{x:previous.x+(next.x-previous.x)*k/steps,y:previous.y+(next.y-previous.y)*k/steps},15),
    'real route segment clears solid props '+tag);
   previous=next;
  }
  walkedRoutes++;
 }
 // Boosted humans cannot tunnel through thin fences, including a 250ms stall.
 // Ghosts keep their original ability to phase through interior obstacles.
 for(const o of props){
  const horizontal=o.w>=o.h;
  const start=horizontal?{x:o.x+o.w/2,y:o.y-16}:{x:o.x-16,y:o.y+o.h/2};
  if(!clear(s,start,15))continue;
  const p={...start};qa.walk(p,horizontal?0:258,horizontal?258:0,.25,s.world,s.obstacles,false);
  assert.ok(horizontal?p.y<=o.y-15+1e-6:p.x<=o.x-15+1e-6,'human blocked by '+o.id);
  const g={...start};qa.walk(g,horizontal?0:258,horizontal?258:0,.25,s.world,s.obstacles,true);
  assert.ok(horizontal?g.y>p.y+20:g.x>p.x+20,'ghost phases '+o.id);collisions++;
 }
 // Both humans and spirits are confined to the visible perimeter, from all sides.
 const b=s.arena;
 for(const [x,y,vx,vy] of [[b.x+17,b.y+b.h/2,-258,0],[b.x+b.w-17,b.y+b.h/2,258,0],
  [b.x+b.w/2,b.y+17,0,-258],[b.x+b.w/2,b.y+b.h-17,0,258]])for(const ghost of [false,true]){
  const p={x,y};qa.walk(p,vx,vy,.6,s.world,s.obstacles,ghost);
  assert.ok(inside(b,p,15),'cannot leave visible arena '+tag+' ghost='+ghost);
 }
 // Dense-room fallback works even with RNG permanently selecting a blocked corner.
 const random=math.random;math.random=()=>0;
 try{
  const used=[s.spawn];
  for(let i=0;i<12;i++){
   const p=qa.freeSpot(s.world,s.obstacles,used,30,80);
   assert.ok(clear(s,p,30)&&inside(s.arena,p,30));
   assert.ok(used.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>60),'fallback separates all twelve spawns');used.push(p);
  }
 }finally{math.random=random;}
}
// Layout construction is independent of gameplay RNG. Compare all coordinates,
// types, IDs, spawn points and perimeter data, not only obstacle counts.
const snapshots=new Map();
for(let n=1;n<=12;n++)for(const theme of ['graveyard','egypt']){
 for(let repeat=0;repeat<50;repeat++){
  const {s,players}=make(n,theme,repeat*977+n);
  const snapshot=JSON.stringify({world:s.world,arena:s.arena,spawn:s.spawn,mapId:s.mapId,obstacles:s.obstacles});
  const key=theme+'/'+s.tier;
  if(snapshots.has(key))assert.equal(snapshot,snapshots.get(key));else snapshots.set(key,snapshot);
  for(const p of players){
   assert.ok(clear(s,p,29.99)&&inside(s.arena,p,30),'safe spawn '+theme+'/'+n);
   assert.ok(players.every(q=>q===p||Math.hypot(p.x-q.x,p.y-q.y)>31.9),'separated players');
  }
 }
}
assert.equal(snapshots.size,4);
const random=math.random;math.random=()=>{throw Error('Layout generation consumed gameplay RNG');};
try{for(const theme of ['graveyard','egypt'])for(const tier of [1,2])qa.makeCourtyard(tier===1?{w:1080,h:608}:{w:1280,h:720},tier,theme);}
finally{math.random=random;}
for(const theme of ['graveyard','egypt']){
 const small=make(6,theme).s,large=make(12,theme).s;
 const floor=s=>s.arena.w*s.arena.h-s.obstacles.filter(o=>!o.boundary&&o.kind!=='hud-blocker').reduce((sum,o)=>sum+o.w*o.h,0);
 assert.ok(floor(large)>floor(small)*1.5,'large rooms add usable floor and escape lanes');
}
// Full matches use the real items, infection, body pushes, bot routing and win
// rules. Check both themes, every supported count, and multiple gameplay seeds.
let matches=0,longest=0;
for(const theme of ['graveyard','egypt'])for(let n=1;n<=12;n++)for(const matchSeed of [91,712,3001]){
 const {round,players,s}=make(n,theme,matchSeed);
 players.forEach(p=>p.isBot=true);round.phase='playing';s.ghostSpawned=true;
 let result,ticks=0;
 for(;ticks<6000;ticks++){
  result=engine.update(.05,round,players);
  for(const p of players){
   assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&inside(s.arena,p,14.99),'live actors remain in courtyard');
   if(!p.ghost)assert.ok(clear(s,p,14.99),'human never enters an obstacle');
  }
  for(const box of s.boxes)assert.ok(clear(s,box,24.99)&&inside(s.arena,box,25),'loot stays reachable on clear ground');
  if(result==='winner')break;
 }
 assert.equal(result,'winner','bots finish '+theme+'/'+n+' seed '+matchSeed);
 assert.ok(players.some(p=>p.id===s.winnerId));matches++;longest=Math.max(longest,ticks*.05);
}
console.log(`GHOST COURTYARDS PASS: 4 authored layouts, 1200 seeded setups, ${walkedRoutes} A* routes, ${collisions} obstacle impacts, ${matches} completed 1–12 bot matches (longest ${longest.toFixed(1)}s)`);
