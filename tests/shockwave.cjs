'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const avatars=fs.readFileSync('player-avatar.js','utf8');
const engine=fs.readFileSync('src/games/shockwave/shockwave.js','utf8');
const env=vm.createContext({window:{},Date,Math});
vm.runInContext(fs.readFileSync('arena-art.js','utf8'),env,{filename:'arena-art.js'});
vm.runInContext(avatars,env,{filename:'player-avatar.js'});
vm.runInContext(fs.readFileSync('party-ui-art.js','utf8'),env,{filename:'party-ui-art.js'});
vm.runInContext(fs.readFileSync('character-system.js','utf8'),env,{filename:'character-system.js'});
vm.runInContext(engine,env,{filename:'src/games/shockwave/shockwave.js'});
const E=env.window.Shockwave;
function players(n,bots=false){
 return Array.from({length:n},(_,i)=>({id:'p'+i,name:'P'+i,
   color:'#ffe26a',active:true,isBot:bots,
   input:{axisX:0,axisY:0},x:0,y:0}));
}
function game(n=4,seed=123,bots=false){
 const ps=players(n,bots),round={mode:'shockwave',phase:'countdown',
   countdown:3,paused:false,shockSeed:seed};
 const state=E.setup(round,ps);return {ps,round,state};
}
function center(s,id){
 const tile=s.tiles[id];
 return {x:s.board.x+(tile.col+.5)*s.tileSize,
   y:s.board.y+(tile.row+.5)*s.tileSize};
}
function put(p,where){p.x=where.x;p.y=where.y;}
function run(g,seconds,dt=1/60){
 const ticks=Math.round(seconds/dt);
 for(let i=0;i<ticks;i++)E.update(dt,g.round,g.ps);
}
for(let n=1;n<=12;n++){
 const {state,ps,round}=game(n);
 assert.equal(state.cols,5);assert.equal(state.rows,5);
 assert.equal(state.tiles.length,25,'5×5 for every player count');
 assert.equal(state.tiles.filter(t=>t.state==='safe').length,25);
 assert.equal(state.tiles.some(t=>t.state==='destroyed'),false);
 assert.equal(new Set(ps.map(p=>p.x+':'+p.y)).size,n);
 assert.ok(ps.every(p=>p.shockAlive));
 assert.equal(E.hud(ps,round).survivors,n);
 assert.ok(ps.every(p=>E.calculateFootSupport(state,p)>.99));
}
assert.equal(E.warningSeconds(1),1.45);
assert.equal(E.warningSeconds(4),1.15);
assert.equal(E.warningSeconds(7),.95);
assert.equal(E.warningSeconds(10),.75);
assert.equal(E.warningSeconds(13),.65);
assert.ok(E.warningSeconds(7)<E.warningSeconds(6));
assert.ok(E.intervalSeconds(10)<E.intervalSeconds(4));
assert.equal(E.intervalSeconds(1),.45);
assert.equal(E.intervalSeconds(7),.19);
assert.equal(E.intervalSeconds(12),.10);
assert.ok(E.warningSeconds(4)<1.2,'quick early rounds');
assert.ok(E.warningSeconds(12)<.7,'quick late rounds');
assert.equal(25-E.dangerCount({wave:10}),1,'one safe tile from wave 5 onward');
{
 const {state:s,ps}=game(4,6420);
 s.wave=12;
 E.startWarning(s,ps);
 assert.equal(s.danger.length,24);
 const previousSafe=s.lastSafeTileId;
 // Complete the explosion state before the next wave begins.
 for(const id of s.danger)s.tiles[id].state='exploding';
 E.collapseTiles(s);
 s.wave=13;
 E.startWarning(s,ps);
 assert.equal(s.danger.length,24);
 assert.notEqual(s.lastSafeTileId,previousSafe,
   'the last safe tile must relocate rather than enable permanent camping');
}
{
 // Single refuge must move from wave 5 onward; camping one square is unsafe.
 const {state:s,ps}=game(5,20261107);
 s.wave=5;E.startWarning(s,ps);
 const firstSafe=s.lastSafeTileId;
 assert.equal(s.danger.length,24);
 assert.equal(s.tiles.filter(t=>t.state==='safe').length,1);
 assert.ok(firstSafe>=0&&firstSafe<25);
 for(const id of s.danger)s.tiles[id].state='exploding';
 E.collapseTiles(s);
 s.wave=6;E.startWarning(s,ps);
 assert.equal(s.danger.length,24);
 assert.equal(s.tiles.filter(t=>t.state==='safe').length,1);
 assert.notEqual(s.lastSafeTileId,firstSafe,
   'the one safe tile moves between consecutive waves');
}
assert.ok(E.distanceBias(13)>E.distanceBias(3));

{
 // 25 fixed floor tiles: wave safe counts 14, 7, 5, 2, then one forever.
 const expectedSafe=[0,14,7,5,2,1];
 const {state:s}=game(4,303);
 let last=0;
 for(let wave=1;wave<=30;wave++){
   s.wave=wave;
   const count=E.dangerCount(s);
   assert.equal(25-count,expectedSafe[Math.min(wave,5)],
     'safe tile counts must match 14, 7, 5, 2, 1 and stay at 1 from wave 5');
   assert.ok(count>=last,'danger tiles must never decrease with later waves');
   assert.ok(count<=24,'always keep at least one safe square');
   last=count;
 }
 assert.equal(25-E.dangerCount({wave:1}),14);
 assert.equal(25-E.dangerCount({wave:2}),7);
 assert.equal(25-E.dangerCount({wave:3}),5);
 assert.equal(25-E.dangerCount({wave:4}),2);
 assert.equal(25-E.dangerCount({wave:5}),1);
 assert.equal(25-E.dangerCount({wave:6}),1);
 assert.equal(25-E.dangerCount({wave:11}),1);
 assert.equal(25-E.dangerCount({wave:12}),1);
 assert.equal(25-E.dangerCount({wave:13}),1);
 assert.equal(25-E.dangerCount({wave:14}),1);
 assert.equal(25-E.dangerCount({wave:15}),1);
 assert.ok(E.distanceBias(15)>E.distanceBias(10));
 assert.ok(E.distanceBias(15)<1,'nearby tiles still have a nonzero chance');
}
{
 // Verify that planned hazard coverage is NEVER quietly reduced by path
 // validation. Adaptive warning duration preserves a real escape chance.
 for(const n of [2,4,12]){
   for(let seed=1;seed<=12;seed++){
     const {state:s,ps}=game(n,seed);
     for(const wave of [1,2,3,4,5,6,7,10,12,16]){
       s.wave=wave;
       const tiles=E.selectDangerTiles(s,ps),target=E.dangerCount(s);
       assert.equal(tiles.length,target,'must select exact target danger count');
       assert.equal(new Set(tiles).size,target,'hazard tile ids are unique');
       assert.ok(tiles.every(id=>s.tiles[id].state==='safe'),'only safe floor is selected');
       assert.equal(s.plannedDangerCount,target);
       assert.ok(s.plannedWarningDuration>=E.warningSeconds(wave));
       assert.equal(E.validateSafeRoutes(s,ps,tiles,s.plannedWarningDuration),true,
         'every threatened player can reach safe ground in the planned warning');
       assert.equal(25-tiles.length,[0,14,7,5,2,1][Math.min(wave,5)],
         'selected red squares must leave exactly the requested safe area');
       assert.equal(s.tiles.filter(tile=>tile.state==='destroyed').length,0,
         'pressure is explosions, never disappearing floor');
     }
   }
 }
}
{
 // Opposite corners cannot reach a single central safe tile in 1.1 seconds.
 // Do not make this a blind elimination: extend the actual warning instead.
 const {state:s,ps}=game(2,2718);
 put(ps[0],center(s,0));
 put(ps[1],center(s,24));
 s.wave=12;
 E.startWarning(s,ps);
 assert.equal(s.phase,'WARNING');
 assert.equal(s.danger.length,24);
 assert.equal(s.tiles.filter(t=>t.state==='safe').length,1);
 assert.ok(s.warningDuration>E.warningSeconds(12),
   'the fast one-tile endgame must extend the warning for distant corners');
 assert.equal(E.validateSafeRoutes(s,ps,s.danger,s.warningDuration),true);
 assert.ok(s.tiles.every(t=>t.state==='safe'||t.state==='warning'));
}
{
 // A full final blast must award shared first, never restart a match.
 const g=game(3,408),{state:s,ps,round}=g;
 E.startWave(s,ps);
 E.evaluateEliminations(s,ps,[ps[0]]);
 assert.equal(ps[0].shockAlive,false);
 s.wave=12;E.startWarning(s,ps);
 const dangerId=s.danger[0];
 for(const p of [ps[1],ps[2]])put(p,center(s,dangerId));
 E.triggerExplosion(s,ps);
 assert.equal(s.blastSchedule.length,24,'all dangerous tiles are scheduled');
 assert.equal(s.finished,false,'a single ignited tile does not finish a wave');
 round.phase='playing';run(g,1.25);
 assert.equal(s.finished,true,'game ends only after all scheduled tiles ignite');
 assert.deepEqual([...s.winnerIds],['p1','p2']);
 assert.equal(s.winnerId,null,'two winners are not forced into one winnerId');
 assert.equal(ps[0].shockAlive,false,'previous losers cannot return');
 assert.equal(s.tiles.length,25);
}
// The outer rim ignites before the inner ring and the center,
// each threatened tile at a unique offset, all within 0.8 seconds.
for(let wave=1;wave<=14;wave++){
 const g=game(12,100+wave),s=g.state;
 s.wave=wave;
 E.startWarning(s,g.ps);
 const plan=E.buildBlastSchedule(s);
 assert.equal(plan.length,s.danger.length);
 assert.equal(new Set(plan.map(t=>t.id)).size,plan.length);
 const ring=id=>{
  const t=s.tiles[id];return Math.max(Math.abs(t.col-2),Math.abs(t.row-2));
 };
 for(let i=1;i<plan.length;i++){
  assert.ok(plan[i].at>plan[i-1].at,'blast offsets are strictly ordered');
  assert.ok(ring(plan[i].id)<=ring(plan[i-1].id),
   'outside tiles must explode before inner tiles');
 }
 assert.ok(plan.at(-1).at<.8,'all tile detonations occur within 0.8s');
 assert.equal(plan[0].at,0,'the first tile explodes immediately');
}
{
 // Three players on three different rings die in three DIFFERENT events.
 // The latest victim wins without a replay or an artificial tie.
 const g=game(3,610),{state:s,ps,round}=g;
 E.startWave(s,ps);
 s.danger=[0,6,12];
 for(const id of s.danger){s.tiles[id].state='warning';s.tiles[id].wave=s.wave;}
 s.phase='WARNING';s.warningStarted=true;s.warningDuration=1;
 for(let i=0;i<3;i++)put(ps[i],center(s,s.danger[i]));
 E.triggerExplosion(s,ps);
 assert.equal(s.blastSchedule.length,3);
 assert.equal(s.blastCursor,1);
 assert.equal(s.events.length,1);
 assert.equal(s.events[0].tileId,0);
 assert.equal(ps[0].shockAlive,false);
 assert.equal(ps[1].shockAlive,true);assert.equal(ps[2].shockAlive,true);
 assert.equal(s.finished,false,'do not declare one survivor mid-cascade');
 round.phase='playing';run(g,1.2);
 assert.equal(s.finished,true);
 assert.equal(s.blastCursor,3);
 assert.equal(s.events.length,3,'three separate per-tile eliminations');
 assert.deepEqual([...s.events.map(e=>e.tileId)],[0,6,12]);
 assert.deepEqual([...s.events.map(e=>e.event)],[1,2,3]);
 assert.deepEqual(ps.map(p=>p.shockEliminatedAt),[1,2,3]);
 assert.deepEqual([...s.winnerIds],[ps[2].id]);
 assert.equal(s.winnerId,ps[2].id);
 assert.ok(ps.every(p=>!p.shockAlive),'all players are eliminated over time');
}
{
 // Two people actually touching ONE explosion are legitimately tied.
 const g=game(2,345),{state:s,ps,round}=g;
 E.startWave(s,ps);
 s.danger=[0,12];
 for(const id of s.danger){s.tiles[id].state='warning';s.tiles[id].wave=s.wave;}
 s.phase='WARNING';s.warningStarted=true;
 ps.forEach(p=>put(p,center(s,0)));
 E.triggerExplosion(s,ps);
 assert.equal(s.events.length,1);
 assert.equal(s.events[0].ids.length,2);
 round.phase='playing';run(g,1.2);
 assert.equal(s.finished,true);
 assert.equal(s.winnerIds.length,2,'same-tile victims can share a rank');
}
for(const n of [2,3,4,12]){
 const g=game(n,500+n),{state:s,ps,round}=g;
 E.startWave(s,ps);E.evaluateEliminations(s,ps,[...ps]);
 assert.equal(new Set(ps.map(p=>p.shockEliminatedAt)).size,1,
  'the whole blast shares one elimination tick');
 assert.equal(s.pendingWinnerIds.length,n);
 s.phase='EXPLOSION';s.timer=.1;round.phase='playing';run(g,.3);
 assert.equal(s.finished,true);
 assert.equal(s.winnerIds.length,n,'every final survivor shares first place');
 assert.equal(new Set(s.winnerIds).size,n);
 assert.equal(s.winnerId,null);
 assert.ok(ps.every(p=>!p.shockAlive),'no resurrection');
 assert.equal(s.tiles.length,25);
}

{
 const g=game(4,31),{state:s,ps,round}=g;
 round.phase='playing';E.update(1/60,round,ps);
 assert.equal(s.wave,1);
 E.startWarning(s,ps);
 assert.equal(s.phase,'WARNING');
 assert.ok(s.danger.length>=2&&s.danger.length<25);
 assert.ok(s.danger.every(id=>s.tiles[id].state==='warning'));
 const expected=[...s.danger],time=s.timer;
 round.paused=true;run(g,1);
 assert.equal(s.timer,time,'Pause must preserve warning clock');
 assert.deepEqual([...s.danger],expected);
 round.paused=false;run(g,.3);
 assert.ok(s.timer<time,'Resume continues the same warning');
 assert.deepEqual([...s.danger],expected);
 assert.equal(E.validateSafeRoutes(s,ps,s.danger,2.5),true);
}
{
 const {state:s,ps}=game(4,42);
 s.wave=2;const old=E.calculateDangerWeights(s,ps);
 s.wave=14;const now=E.calculateDangerWeights(s,ps);
 const far=old.reduce((a,b)=>a.distance>b.distance?a:b);
 const near=old.reduce((a,b)=>a.distance<b.distance?a:b);
 assert.ok(now.find(v=>v.id===far.id).weight>old.find(v=>v.id===far.id).weight);
 assert.ok(now.find(v=>v.id===near.id).weight>=1);
 assert.equal(E.validateSafeRoutes(s,ps,s.tiles.map(t=>t.id),2.5),false,
   'Do not allow a blast across every tile');
}
{
 const {state:s,ps}=game(2,50);
 const danger=new Set([6]);
 put(ps[0],center(s,6));put(ps[1],center(s,7));
 assert.ok(E.calculateDangerContact(s,ps[0],danger)>.99);
 assert.ok(E.calculateDangerContact(s,ps[1],danger)<.01);
 // Even a tiny piece of the whole avatar crossing the tile border dies.
 const border=s.board.x+s.tileSize*2,y=s.board.y+s.tileSize*1.5;
 const dangerRight=new Set([7]),r=E.constants.avatarRadius;
 ps[0].y=y;
 ps[0].x=border-r+.001;
 assert.equal(E.calculateDangerContact(s,ps[0],dangerRight),1,
   '0.001px brush of the full body counts as lethal contact');
 ps[0].x=border-r;
 assert.equal(E.calculateDangerContact(s,ps[0],dangerRight),1,
   'exact tangent must count as touching');
 ps[0].x=border-r-.001;
 assert.equal(E.calculateDangerContact(s,ps[0],dangerRight),0,
   'no part touching means safe');
 ps[0].x=border;
 assert.equal(E.calculateDangerContact(s,ps[0],dangerRight),1,
   'standing on the seam is not a loophole');
}
{
 const g=game(3,73),{ps,state:s,round}=g;
 E.startWave(s,ps);
 const bomb=s.tiles[6];
 put(ps[0],center(s,6));put(ps[1],center(s,7));put(ps[2],center(s,18));
 s.phase='WARNING';s.warningStarted=true;s.warningDuration=2.5;
 s.danger=[6];s.timer=0;
 bomb.state='warning';bomb.wave=s.wave;
 E.triggerExplosion(s,ps);
 assert.equal(bomb.state,'exploding');
 assert.equal(ps[0].shockAlive,false,'player on blast must die');
 assert.ok(ps[1].shockAlive&&ps[2].shockAlive,'safe neighbors survive');
 assert.equal(s.phase,'EXPLOSION');
 round.phase='playing';run(g,.5);
 assert.equal(bomb.state,'safe','tile resets instead of disappearing');
 assert.equal(s.tiles.filter(t=>t.state==='safe').length,25);
 assert.equal(s.tiles.some(t=>t.state==='destroyed'),false);
 assert.equal(s.remainingTiles,25);
}
{
 const g=game(3,52),{ps,state:s,round}=g;
 E.startWave(s,ps);const b=s.tiles[6];b.wave=1;b.state='warning';
 s.danger=[6];s.phase='WARNING';s.warningStarted=true;
 // Center on the safe neighbor, but the avatar's outer rim touches red.
 const boundary=s.board.x+2*s.tileSize,r=E.constants.avatarRadius;
 ps[0].x=boundary+r-.001;ps[0].y=center(s,6).y;
 ps[1].x=boundary+r+.001;ps[1].y=center(s,6).y;
 put(ps[2],center(s,18));
 const hits=ps.slice(0,2).map(p=>E.calculateDangerContact(s,p,new Set([6])));
 assert.equal(hits[0],1,'near-zero visual overlap still dies');
 assert.equal(hits[1],0,'no overlap survives');
 E.triggerExplosion(s,ps);
 assert.equal(ps[0].shockAlive,false);
 assert.equal(ps[1].shockAlive,true);
 assert.equal(ps[2].shockAlive,true);
}
{
 const g=game(3,88),{ps,state:s,round}=g;
 E.startWave(s,ps);
 E.evaluateEliminations(s,ps,[ps[0]]);
 assert.equal(ps[0].shockAlive,false);
 E.evaluateEliminations(s,ps,[ps[1],ps[2]]);
 assert.equal(s.finished,false);
 assert.deepEqual([...s.pendingWinnerIds],['p1','p2']);
 s.phase='EXPLOSION';s.timer=.1;round.phase='playing';
 run(g,.3);
 assert.equal(s.finished,true);
 assert.equal(s.winnerId,null);
 assert.deepEqual([...s.winnerIds],['p1','p2']);
 assert.equal(ps[0].shockAlive,false);
 assert.equal(ps[0].shockEliminatedAt,1);
 assert.equal(ps[1].shockEliminatedAt,2);
 assert.equal(ps[2].shockEliminatedAt,2);
}
{
 const {state:s,ps}=game(2,99);
 E.startWave(s,ps);
 E.evaluateEliminations(s,ps,[ps[0]]);
 assert.equal(s.finished,true);
 assert.equal(s.winnerId,ps[1].id);
 assert.equal(s.events[0].ids.length,1);
}
{
 const {ps,state:s,round}=game(12,201);
 for(let i=0;i<10;i++)put(ps[i],center(s,i));
 ps[10].x=s.board.x-100;ps[10].y=s.board.y-100;
 ps[11].x=s.board.x+s.board.w+100;ps[11].y=s.board.y+s.board.h+100;
 round.phase='countdown';run({ps,state:s,round},.15);
 for(const p of ps){
   assert.ok(p.x>=s.board.x+E.constants.footRadius-1e-5);
   assert.ok(p.y>=s.board.y+E.constants.footRadius-1e-5);
   assert.ok(p.x<=s.board.x+s.board.w-E.constants.footRadius+1e-5);
   assert.ok(p.y<=s.board.y+s.board.h-E.constants.footRadius+1e-5);
 }
 // A collision never creates an invisible void to stand on.
 assert.ok(ps.every(p=>E.calculateFootSupport(s,p)>.49));
}
{
 const {state:s,ps}=game(4,111);
 s.wave=12;assert.equal(E.checkSuddenDeath(s),true);
 assert.equal(s.suddenDeath,true);
 assert.equal(s.remainingTiles,25);
 E.checkWinner(s,ps);assert.ok(s.finalArena);
}
{
 // Seeded reproducibility, and pressure never deletes the board.
 const a=game(12,1234),b=game(12,1234);
 E.startWave(a.state,a.ps);E.startWave(b.state,b.ps);
 E.startWarning(a.state,a.ps);E.startWarning(b.state,b.ps);
 assert.deepEqual([...a.state.danger],[...b.state.danger]);
 for(const seed of [1,2,3,4]){
   const g=game(12,seed,true);g.round.phase='playing';
   for(let i=0;i<4500&&!g.state.finished;i++)
     E.update(i%6===0?.04:1/60,g.round,g.ps);
   assert.equal(g.state.tiles.length,25);
   assert.ok(g.state.tiles.every(t=>t.state==='safe'||t.state==='warning'||t.state==='exploding'));
   assert.equal(g.state.tiles.some(t=>t.state==='destroyed'),false);
 }
}
assert.match(avatars,/data:image\/svg\+xml/);
{
 const {state:s,ps}=game(3,950);
 assert.equal(E.constants.avatarRadius,29,'whole visible character radius');
 assert.equal(E.constants.footRadius,11,'foot support remains a separate metric');
 assert.equal(Object.hasOwn(E.constants,'blastThreshold'),false,
   'eliminate the old percentage-based immunity');
 const danger=new Set([6]),boundary=s.board.x+2*s.tileSize;
 ps[0].x=boundary+E.constants.avatarRadius-.0001;ps[0].y=center(s,6).y;
 assert.equal(E.calculateDangerContact(s,ps[0],danger),1,
   'even a tiny amount inside the outer body edge must die');
 ps[0].x=boundary+E.constants.avatarRadius+.0001;
 assert.equal(E.calculateDangerContact(s,ps[0],danger),0);
 s.phase='WARNING';s.wave=3;s.danger=[6];
 const circles=[],labels=[],ctx=new Proxy({},{
  get(_obj,key){
   if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
   if(key==='arc')return (...args)=>circles.push(args);
   if(key==='fillText')return value=>labels.push(String(value));
   return ()=>{};
  },set(){return true;}
 });
 E.draw(ctx,0,{shockwave:s,phase:'playing'},ps);
 assert.ok(circles.some(a=>a[0]===ps[1].x&&a[1]===ps[1].y&&a[2]===29),
   'full-body blast ring uses the same logical center as the sprite');
 assert.ok(!labels.some(v=>v.includes('WAVE ')||v.includes('ผู้รอด')),
  'the engine no longer renders redundant wave/survivor side HUD');
 assert.equal(E.hud(ps,{shockwave:s}).survivors,ps.filter(p=>p.shockAlive&&p.active).length,
  'survivor count is still available to the shared top-centre SVG badge');
 assert.ok(labels.every(v=>!/ปลอดภัย|ระเบิดใน|เริ่มใน|\\d+(?:\\.\\d+)?\\s*วิ/.test(v)),
   'no redundant warning seconds or safe tile count is painted');
}
{
 // Body contact at the diagonal corner, not just horizontal and vertical edges.
 const {state:s,ps}=game(3,314);
 const t=s.tiles[6],right=s.board.x+(t.col+1)*s.tileSize;
 const bottom=s.board.y+(t.row+1)*s.tileSize;
 const danger=new Set([6]),radius=E.constants.avatarRadius;
 put(ps[0],{x:right+20,y:bottom+20});
 assert.equal(E.calculateDangerContact(s,ps[0],danger),1,
   'diagonal grazing of a warning tile must count');
 put(ps[0],{x:right+22,y:bottom+22});
 assert.equal(E.calculateDangerContact(s,ps[0],danger),0,
   'diagonal gap outside the avatar radius remains safe');
 for(const dir of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]){
   ps[0].dir=dir;
   ps[0].x=right+radius-.0001;
   ps[0].y=center(s,6).y;
   assert.equal(E.calculateDangerContact(s,ps[0],danger),1,
     'no directional loopholes for different avatar costumes');
 }
 put(ps[0],center(s,7));
 assert.equal(E.calculateDangerContact(s,ps[0],danger),0,
   'safe neighbor center stays safe, even if its border explodes');
}
{
 const {state:s,ps}=game(2,650);
 s.wave=12;
 const danger=E.selectDangerTiles(s,ps);
 const safe=s.tiles.find(t=>!danger.includes(t.id));
 assert.equal(danger.length,24);
 put(ps[0],center(s,safe.id));
 assert.equal(E.calculateDangerContact(s,ps[0],new Set(danger)),0,
   'the only safe tile still has safe standing room for a full character');
}
{
 // BOARD PARTY ranking retains competition ranks when co-winners exhaust quota.
 const context=vm.createContext({window:{BoardDice:{shuffle:ids=>[...ids]}}});
 vm.runInContext(fs.readFileSync('board-minigame.js','utf8'),context);
 const adapter=context.window.BoardMinigame;
 const x=game(4),s=x.state;
 E.startWave(s,x.ps);E.evaluateEliminations(s,x.ps,[...x.ps]);
 s.phase='EXPLOSION';s.timer=.01;x.round.phase='playing';run(x,.2);
 const ranking=adapter.ranking(x.round,x.ps);
 assert.ok(ranking.every(p=>p.rank===1));
 const prizeIds=adapter.rewards(ranking,4);
 assert.equal(prizeIds.length,2,'reward quota remains 50 percent');
 assert.ok(ranking.every(p=>p.rank===1),'reward limit never breaks tied ranks');
}
console.log('SHOCKWAVE PASS: 14/7/5/2/1 safe tiles, faster waves, full-body contact and ties');
