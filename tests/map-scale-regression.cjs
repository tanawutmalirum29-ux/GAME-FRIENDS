'use strict';
/* Global map scale contract. Execute in CI for every 1–12-player lobby size.
 * Existing per-mode tests still own scoring, collision impulses and AI logic.
 * This test rejects tier drift even when the altered JS has valid syntax. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
global.window={};
global.Image=class{constructor(){this.complete=false;this.naturalWidth=0;}set src(v){this._src=v;}get src(){return this._src;}};
const code=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const scripts=[
 'arena-scale.js','player-avatar.js','combat-motion.js','character-system.js',
 'party-ui-art.js','arena-art.js','party-arena-scenes.js','src/shared/graveyard-art.js',
 'src/shared/farm-ice-art.js','src/games/pizza-time/pizza-ingredient-art.js','src/games/pizza-time/pizza-kitchen-art.js',
 'src/games/color-switch/color-switch-mayan.js','src/games/gladiators/gladiators-art.js',
 'src/games/fruit-memory/fruit-memory.js','src/games/color-switch/color-switch.js','src/games/chickens/chickens.js','src/games/snow-brawl/snow-brawl.js',
 'src/games/knight-match/knight-match.js','src/games/lawn-mower/lawn-mower.js','src/games/color-claim/color-claim.js','src/games/witching-snake/witching-snake.js',
 'src/games/ghost-attack/ghost-attack.js','src/games/ice-race/ice-race.js','src/games/shockwave/shockwave.js','src/games/boulder-bash/boulder-bash.js',
 'src/games/shopping-time/shopping-time.js','src/games/pizza-time/pizza-time.js','src/games/gladiators/gladiators.js',
 'src/board-party/runtime/board-map.js','src/board-party/runtime/board-design.js','src/board-party/runtime/board-scenery.js','src/board-party/runtime/board-layout.js',
 'src/board-party/runtime/board-dice.js','src/board-party/runtime/board-items.js','src/board-party/runtime/board-party.js'
];
for(const file of scripts)require(path.join('..',file));
const S=window.PartyArenaScale,close=(a,b,e=1e-8)=>Math.abs(a-b)<e;
assert.ok(S&&S.centeredGrid&&S.viewport&&S.tier&&S.proportions);
assert.deepEqual(S.centeredGrid(4,4,80),{x:320,y:110,w:320,h:320});
assert.deepEqual(S.centeredGrid(5,5,80),{x:280,y:70,w:400,h:400});
assert.throws(()=>S.centeredGrid(6,6,100));
assert.throws(()=>S.tier(13,[{maxPlayers:12}]));
for(const world of [{w:960,h:540},{w:1200,h:675},{w:1280,h:720},{w:1440,h:810},{w:1600,h:900}]){
 const m=S.viewport(world),p={x:world.w*.23,y:world.h*.72};
 const r=m.screenToWorld(...Object.values(m.worldToScreen(p.x,p.y)));
 assert.ok(close(r.x,p.x)&&close(r.y,p.y),'inverse world/screen coordinate transform');
 assert.ok(close(m.radiusOnScreen(15*world.w/960),15),'physical player radius remains constant on host');
}
const colors=['#e85a6c','#61adfa','#e8b74f','#8bd4a2','#ba9deb','#ee9d73'];
const roster=n=>Array.from({length:n},(_,i)=>({
 id:'map-player-'+i,name:'P'+i,color:colors[i%colors.length],
 active:true,isBot:i%2===1,score:0,input:{axisX:0,axisY:0,action:false,alt:false}
}));
const entries=[
 ['FRUIT MEMORY','FruitMemory','fruitMemory'],
 ['COLOR SWITCH','ColorSwitch','colorSwitch'],
 ['CHICKENS','Chickens','chickens'],
 ['SNOW BRAWL','SnowBrawl','snowBrawl'],
 ['KNIGHT MATCH','KnightMatch','knightMatch'],
 ['LAWN MOWER','LawnMower','lawnMower'],
 ['COLOR CLAIM','ColorClaim','colorClaim'],
 ['WITCHING SNAKE','WitchingSnake','witchingSnake'],
 ['GHOST ATTACK','GhostAttack','ghost'],
 ['ICE RACE','IceRace','iceRace'],
 ['SHOCKWAVE','Shockwave','shockwave'],
 ['BOULDER BASH','BoulderBash','boulderBash'],
 ['SHOPPING TIME','ShoppingTime','shoppingTime'],
 ['PIZZA TIME','PizzaTime','pizzaTime'],
 ['GLADIATORS','Gladiators','gladiators']
];
let checks=0;
for(const [name,engine,stateKey] of entries){
 const E=window[engine];assert.equal(typeof E?.setup,'function',name+' setup missing');
 for(let n=1;n<=12;n++){
  const ps=roster(n),round={mode:engine,phase:'playing',paused:false,
   colorSeed:1234,knightSeed:1234,iceSeed:1234,lawnSeed:1234,shoppingSeed:1234,
   pizzaSeed:1234,boulderSeed:1234,gladiatorsSeed:1234,shockSeed:1234};
  const returned=E.setup(round,ps),s=round[stateKey]||returned;
  assert.ok(s,name+' '+n+': no map state');
  assert.equal(ps.length,n);
  // A newly discovered plug-in must supply its own complete, ordered results
  // for every supported 1–12 player tier without any per-mode Core branches.
  assert.equal(typeof E.getResult,'function',name+' result provider');
  const results=E.getResult(round,ps);
  assert.equal(results.length,n,name+' result count at '+n+' players');
  assert.equal(new Set(results.map(item=>item.id)).size,n,name+' duplicate result ID');
  assert.ok(results.every(item=>typeof item.value==='number'&&!Number.isNaN(item.value)&&
   typeof item.label==='string'),name+' malformed player results');
  assert.ok(ps.every(p=>results.some(item=>item.id===p.id)),name+' missing player score');
  assert.ok(ps.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),
    name+' '+n+': invalid spawn positions');
  const coords=new Set(ps.map(p=>p.x.toFixed(3)+','+p.y.toFixed(3)));
  assert.equal(coords.size,n,name+' '+n+': overlapping spawn centers');
  // Boulder uses a full 960x540 viewport with a narrower navigable runway.
  // Its bounds rectangle is not the physical screen/world dimensions.
  const world=engine==='BoulderBash'?{w:960,h:540}:
    s.world||((s.w&&s.h)?{w:s.w,h:s.h}:
    (s.bounds?.w&&s.bounds?.h)?s.bounds:{w:960,h:540});
  assert.ok(world.w>0&&world.h>0,name+' '+n+': invalid world');
  if(engine!=='SnowBrawl')assert.ok(Math.abs(world.w/world.h-16/9)<.015,name+' '+n+': aspect ratio');
  if(engine==='FruitMemory'){
   const size=n<=6?4:5,side=size*80;
   assert.equal(s.cols,size);assert.equal(s.rows,size);
   assert.equal(s.tileW,80);assert.equal(s.tileH,80);
   assert.ok(close(s.board.w,side)&&close(s.board.h,side));
   assert.ok(close(s.board.x,(960-side)/2)&&close(s.board.y,(540-side)/2));
   assert.ok(close(s.tileW/E.constants.radius,80/13),'tile:hitbox drift');
   assert.ok(ps.every(p=>p.x>=s.board.x+E.constants.radius&&
     p.x<=s.board.x+side-E.constants.radius));
  }
  if(engine==='ColorSwitch'){
   const cols=n<=6?11:13,rows=n<=6?9:11;
   assert.equal(s.size,44,'Color Switch may not shrink tiles for 7+ players');
   assert.equal(s.cols,cols);assert.equal(s.rows,rows);
   assert.ok(close(s.board.w,cols*44)&&close(s.board.h,rows*44));
   assert.ok(close(s.board.x,(960-s.board.w)/2)&&close(s.board.y,(540-s.board.h)/2));
  }
  if(engine==='Chickens'){
   const expected=n<=4?960:n<=8?1200:1440;
   assert.equal(s.world.w,expected,'pen tier');
   assert.ok(close(s.unit,expected/960));
   const view=S.viewport(s.world);
   assert.ok(close(view.radiusOnScreen(E.constants.playerRadius*s.unit),15),
     'visible and physical player radii must share one unit');
   assert.ok(close(view.radiusOnScreen(E.constants.chickenRadius*s.unit),8.3),
     'bird hitbox must scale with its artwork');
   assert.ok(ps.every(p=>close(p.chickenUnit,s.unit)));
   assert.equal(s.pens.length,n);
  }
  if(engine==='SnowBrawl'){
   assert.ok(s.radius>=188&&s.radius<=312);
   assert.ok(ps.every(p=>close(Math.hypot(p.x,p.y),s.radius*.9,1e-6)));
  }
  if(engine==='KnightMatch'){
   assert.ok(ps.every(p=>E.inside(s,p.x,p.y,E.scales.playerRadius)));
   assert.ok(s.balloons.every(b=>E.inside(s,b.x,b.y,b.radius)));
  }
  if(engine==='ShoppingTime'){
   assert.equal(s.lanes.length,4,'conveyors remain four at every tier');
   assert.ok(close(S.viewport(s.world).radiusOnScreen(s.metrics.playerRadius),15));
  }
  if(engine==='PizzaTime'){
   assert.ok(close(S.viewport(s.world).radiusOnScreen(s.bodyRadius),17.5));
  }
  if(engine==='Shockwave'){
   assert.equal(s.tileSize,78);assert.equal(s.tiles.length,25);
   assert.equal(s.board.w/s.cols,78);
  }
  if(engine==='ColorClaim'){
   assert.ok(s.owner.length===s.cols*s.rows);
   assert.ok(close(s.w/960, n<=6?1:4/3));
  }
  checks++;
 }
}
const claim=code('src/games/color-claim/color-claim.js'),chickens=code('src/games/chickens/chickens.js');
assert.match(claim,/PartyCharacters\.draw\(g,p,\{time:t,combat:false,scale:unit\}\)/,
 'large COLOR CLAIM actors must scale like their world-space hitboxes');
assert.match(claim,/trailHits\(map,from,to,5\*s\.w\/960\)/,
 'rendered territory trails and trail-cut detection must scale together');
assert.match(chickens,/drawPlayer\(ctx,p,time,s\.unit\)/,
 'CHICKENS renderer must use the tier-scaled avatar, combat arc and stun effects');
assert.match(chickens,/Combat\.drawAttack\(ctx,p\);Combat\.drawStun\(ctx,p,t\)/,
 'CHICKENS combat visuals must follow the scaled hitbox and sprite');
assert.match(chickens,/C\.pickupRadius\*state\.unit/,
 'CHICKENS object collection must use the same physical world units as sprites');
for(let n=1;n<=12;n++){
 const board=window.BoardParty.create(roster(n),{seed:42});
 assert.equal(board.players.length,n,'BOARD PARTY roster: '+n);
 assert.ok(board.map.width>0&&board.map.height>0);
 assert.ok(board.map.nodes[board.map.startId]);
 checks++;
}
const html=code('index.html'),build=code('scripts/build-static.cjs');
assert.match(html,/src="\.\/arena-scale\.js"/,
 'Shared map geometry is part of the shell');
assert.doesNotMatch(html,/src="\.\/src\/games\/[^"]+\.js"/,
 'Game engines are imported on demand from the folder registry, not from HTML');
assert.match(html,/src="\.\/src\/platform\/game-platform\.js"/,
 'One platform registry discovers minigames for Normal and Board Party');
assert.ok(build.includes("const deployAsset=")&&build.includes("fs.statSync(filename).isFile()"),
 'Amplify validates stable HTML assets from their actual references');
console.log('GLOBAL MAP SCALE PASS: '+checks+' player/tier setups (15 minigames + BOARD PARTY) and projection contracts');
