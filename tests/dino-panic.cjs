/* DINO PANIC: shoveable scenery, fair shared speed, bounded bot compute. */
'use strict';
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
global.window={PartyCharacters:{
 activate(ps){for(const p of ps)p.active=true;},
 control(input={}){let x=Number(input.axisX)||0,y=Number(input.axisY)||0;
  const m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}return{x,y};}
}};
(async()=>{
 const base=path.resolve(__dirname,'../src/games/dino-panic');
 const game=(await import(pathToFileURL(path.join(base,'game.js')).href)).default;
 const {C,STEP}=await import(pathToFileURL(path.join(base,'config.js')).href);
 const {BOT_NAV_CELL}=await import(pathToFileURL(path.join(base,'bot.js')).href);
 assert.equal(C.speed,130,'reduced runner/dinosaur speed');
 assert.equal(BOT_NAV_CELL,10,'original 10-unit navigation grid MUST NOT be coarsened for speed');
 assert.equal(C.cell,8,'original precise track validation grid MUST remain unchanged');
 assert.ok(C.pushFactor<.5,'walking speed is greatly reduced while pushing');
 // The previous giant elliptical body shade and rectangular snout gradient
 // obscured half the arena as a dark plate. Keep only object-local shadows.
 const render=require('node:fs').readFileSync(path.join(base,'render.js'),'utf8');
 assert.doesNotMatch(render,/ellipse\(-330,14,360,200/,
  'DINO PANIC must not paint a giant dark ellipse across the playable arena');
 assert.doesNotMatch(render,/gradients\(g,tr\)\.sh|G\.top|G\.bot/,
  'DINO PANIC must not paint full-width dark gradient bands');
 const dinoArt=require('node:fs').readFileSync(path.join(base,'dino-art.js'),'utf8');
 assert.doesNotMatch(dinoArt,/id="sd"|url\(#sd\)/,
  'jungle SVG tiles must not bake another continuous dark edge plate');
 assert.match(render,/function drawObstacles\(/);
 assert.match(render,/function drawRunners\(/);
 assert.match(render,/g\.drawImage\(headI,/,
  'original high-fidelity dinosaur is still drawn');

 const create=(n,seed)=>{const ps=Array.from({length:n},(_,i)=>({
  id:'d'+i,name:'D'+i,active:false,isBot:i>0,color:'#ffcc33',
  input:{axisX:0,axisY:0,action:false}})),
  round={phase:'playing',paused:false,dinoSeed:seed},
  s=game.setup(round,ps);
  return{ps,round,s};
 };
 for(const n of [1,2,6,7,12]){
  const {s,ps,round}=create(n,2700+n);
  assert.ok(s.track.obstacles.length>5,'map should contain obstacles');
  assert.ok(typeof s.track.moveObstacle==='function','movable scenery in index');
  assert.ok(ps.every(p=>p.active&&p.dino?.state==='run'));
  for(let i=0;i<90&&!s.finished;i++)game.update(1/60,round,ps);
  assert.ok(ps.every(p=>Number.isFinite(p.x+p.y)),'finite positions');
 }
 // ONLY rocks are immovable: pushing one must not translate or roll it.
 {
  const {s,ps,round}=create(1,8124),tr=s.track,p=ps[0];
  const rock=tr.obstacles.filter(o=>o.kind==='rock')
   .map(o=>({o,clear:Math.min(...tr.obstacles.filter(q=>q!==o).map(q=>
    Math.hypot(o.x-q.x,o.y-q.y)-o.r-(q.shape==='circle'?q.r:Math.max(q.hw,q.hh))))}))
   .sort((a,b)=>b.clear-a.clear)[0]?.o;
  assert.ok(rock,'DINO PANIC must generate solid, immovable rocks');
  const initial={x:rock.x,y:rock.y,angle:rock.angle,r:rock.r};
  p.x=rock.x-rock.r-C.R-.5;p.y=rock.y;
  p.dino.px=p.x;p.dino.py=p.y;p.input.axisX=1;
  let pushing=false;
  for(let i=0;i<48&&!s.finished;i++){
   game.update(STEP,round,ps);pushing||=p.dino.pushing;
  }
  assert.ok(pushing,'the player feels resistance when running into a rock');
  assert.equal(rock.x,initial.x,'player impact must not translate a rock horizontally');
  assert.equal(rock.y,initial.y,'player impact must not translate a rock vertically');
  assert.equal(rock.angle,initial.angle,'player impact must not rotate a rock');
  assert.ok(p.x<=rock.x-rock.r-C.R+.01,'rock remains a solid obstacle to the player');
  assert.equal(rock.r,initial.r,'original rock collision radius remains unchanged');
  assert.equal(tr.moveObstacle(rock,12,7),false,'direct obstacle movement cannot move rocks');
  tr.impulseObstacle(rock,30,12,rock.x-rock.r,rock.y);
  for(let i=0;i<8;i++){tr.tick++;tr.stepObstacles(STEP);}
  assert.equal(rock.x,initial.x,'even direct impulses must not move a rock');
  assert.equal(rock.y,initial.y);
  assert.equal(rock.angle,initial.angle,'even direct impulses must not roll a rock');
  assert.equal(rock.mvx+rock.mvy+rock.spin,0,'rocks must not accumulate momentum');
  assert.ok(tr.query(rock.x-2,rock.x+2).includes(rock),'fixed rock stays in spatial index');
 }
 // Select an isolated CRATE to prove other scenery remains movable
 // and the spatial index follows its changing position.
 {
  const {s,ps,round}=create(1,8124),tr=s.track,p=ps[0];
  const choices=tr.obstacles.filter(o=>o.kind==='crate')
   .map(o=>({o,nearest:Math.min(...tr.obstacles.filter(q=>q!==o)
    .map(q=>Math.hypot(q.x-o.x,q.y-o.y)))}))
   .sort((a,b)=>b.nearest-a.nearest);
  assert.ok(choices.length>0,'pushable crate generated');
  const o=choices[0].o,r=o.hw,oldX=o.x;
  p.x=o.x-r-C.R-.5;p.y=o.y;p.dino.px=p.x;p.dino.py=p.y;
  p.input.axisX=1;
  let pushing=false;
  for(let i=0;i<35&&!s.finished;i++){
   game.update(1/60,round,ps);pushing||=!!p.dino.pushing;
  }
  assert.ok(pushing,'moving into obstacle triggers the low-speed push state');
  assert.ok(o.x>oldX+3,'human actually pushes obstacle in world coordinates');
  assert.ok(tr.query(o.x-2,o.x+2).includes(o),'spatial index follows pushed scenery');
 }
 {
  const {s,ps,round}=create(12,15001);
  const t=performance.now();
  for(let i=0;i<360&&!s.finished;i++)game.update(1/60,round,ps);
  const millis=performance.now()-t;
  assert.ok(ps.every(p=>Number.isFinite(p.x+p.y)),'12 bots remain finite');
  assert.ok(millis<12000,'6 seconds of 12-player game should not take more than 12 seconds CPU');
  assert.ok(s.botFieldsBuilt>0,'shared nav fields are generated');
  assert.ok(s.botFieldsBuilt<100,'coalesced bot navigation reuses fields instead of 12 independent searches');
  assert.ok(s.botFields.size<=12,'shared cache stays bounded');
  console.log('DINO PANIC 12-bot 6-second CPU ms:',Math.round(millis),'shared Dijkstra fields:',s.botFieldsBuilt);
 }
 console.log('DINO PANIC fixed rocks, movable crates, spatial index and bot workload PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
