'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const avatars=fs.readFileSync('player-avatar.js','utf8');
const engine=fs.readFileSync('shockwave.js','utf8');
const env=vm.createContext({window:{},Date,Math});
vm.runInContext(fs.readFileSync('arena-art.js','utf8'),env,{filename:'arena-art.js'});
vm.runInContext(avatars,env,{filename:'player-avatar.js'});
vm.runInContext(engine,env,{filename:'shockwave.js'});
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
assert.equal(E.warningSeconds(1),2.5);
assert.equal(E.warningSeconds(4),2.1);
assert.equal(E.warningSeconds(7),1.6);
assert.equal(E.warningSeconds(10),1.3);
assert.equal(E.warningSeconds(13),1.1);
assert.ok(E.warningSeconds(7)<E.warningSeconds(6));
assert.ok(E.intervalSeconds(10)<E.intervalSeconds(4));
assert.ok(E.distanceBias(13)>E.distanceBias(3));
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
 // Exactly across a tile border is 50%; foot circle, not sprite radius.
 const border=s.board.x+s.tileSize*2,y=s.board.y+s.tileSize*1.5;
 ps[0].x=border-3;ps[0].y=y;
 const right=new Set([7]);
 const overlapHigh=E.calculateDangerContact(s,ps[0],right);
 ps[0].x=border-6;
 const overlapLow=E.calculateDangerContact(s,ps[0],right);
 assert.ok(overlapHigh>.20&&overlapLow<.20,
   'foot overlap decreases continuously near edges');
 assert.ok(overlapHigh>overlapLow);
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
 // 50%-area foot overlap on border must be hit, 20% must survive.
 const boundary=s.board.x+2*s.tileSize;
 ps[0].x=boundary-1;ps[0].y=center(s,6).y;
 ps[1].x=boundary+7;ps[1].y=center(s,6).y;
 put(ps[2],center(s,18));
 const hits=ps.slice(0,2).map(p=>E.calculateDangerContact(s,p,new Set([6])));
 assert.ok(hits[0]>.50&&hits[1]<.20);
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
 assert.equal(s.pendingTiebreaker.length,2);
 s.phase='EXPLOSION';s.timer=.1;round.phase='playing';
 run(g,.3);
 assert.equal(s.tiebreakers,1);
 assert.equal(s.winnerId,null);
 assert.equal(ps[0].shockAlive,false,'prior eliminations must stay eliminated');
 assert.ok(ps[1].shockAlive&&ps[2].shockAlive);
 assert.equal(s.tiles.length,25);
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
 assert.equal(E.constants.blastThreshold,.18);
 assert.equal(E.constants.footRadius,11);
 const danger=new Set([6]),boundary=s.board.x+2*s.tileSize;
 ps[0].x=boundary+4;ps[0].y=center(s,6).y;
 const ratio=E.calculateDangerContact(s,ps[0],danger);
 assert.ok(ratio>.18&&ratio<.5,'small meaningful overlap must count');
 ps[0].x=boundary+E.constants.footRadius+1;
 assert.equal(E.calculateDangerContact(s,ps[0],danger),0);
 s.phase='WARNING';s.danger=[6];
 const circles=[],ctx=new Proxy({},{
  get(_obj,key){
   if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
   if(key==='arc')return (...args)=>circles.push(args);
   return ()=>{};
  },set(){return true;}
 });
 E.draw(ctx,0,{shockwave:s,phase:'playing'},ps);
 assert.ok(circles.some(a=>a[0]===ps[1].x&&a[1]===ps[1].y&&a[2]===11),
   'rendered foot ring at same position as simulated foot');
}
console.log('SHOCKWAVE PASS: permanent 5x5, blast hitboxes, 18% contact, phase timing, ties, bounded motion, shared SVG');
