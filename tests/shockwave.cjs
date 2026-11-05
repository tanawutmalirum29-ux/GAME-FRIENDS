'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const script=fs.readFileSync('shockwave.js','utf8');
const sandbox=vm.createContext({window:{},Date,Math});
vm.runInContext(script,sandbox,{filename:'shockwave.js'});
const E=sandbox.window.Shockwave;
function players(n,bots=false){return Array.from({length:n},(_,i)=>({
 id:'p'+i,name:'P'+i,active:true,isBot:bots,color:'#00ffff',
 input:{axisX:0,axisY:0},x:0,y:0}));}
function game(n=3,seed=89){
 const ps=players(n),round={mode:'shockwave',phase:'countdown',shockSeed:seed,paused:false};
 const state=E.setup(round,ps);return {ps,round,state};
}
function tileCenter(s,id){
 const t=s.tiles[id];return {x:s.board.x+(t.col+.5)*s.tileSize,y:s.board.y+(t.row+.5)*s.tileSize};
}
for(let n=1;n<=12;n++){
 const {ps,state}=game(n);
 assert.equal(state.tiles.length,n<=6?16:30);
 assert.equal(state.tiles.filter(t=>t.state==='safe').length,state.tiles.length);
 assert.equal(new Set(ps.map(p=>p.x+':'+p.y)).size,n);
 assert.equal(ps.filter(p=>p.shockAlive).length,n);
 assert.equal(E.hud(ps,{shockwave:state}).survivors,n);
}
assert.equal(E.warningSeconds(1,false),2.5);
assert.equal(E.warningSeconds(1,true),3);
assert.equal(E.warningSeconds(7,false),1.6);
assert.equal(E.warningSeconds(7,true),2);
assert.ok(E.warningSeconds(7,false)<E.warningSeconds(6,false));
assert.ok(E.intervalSeconds(10,false)<E.intervalSeconds(4,false));
assert.ok(E.distanceBias(13)>E.distanceBias(3));
{
 const {ps,state}=game(4,2);
 E.startWave(state,ps);E.startWarning(state,ps);
 assert.equal(state.phase,'WARNING');
 assert.equal(state.wave,1);
 assert.ok(state.danger.length>0&&state.danger.length<state.tiles.length);
 assert.ok(state.danger.every(id=>state.tiles[id].state==='warning'&&state.tiles[id].wave===1));
 assert.equal(E.validateSafeRoutes(state,ps,state.danger,2.5),true);
 const locked=state.danger.join(',');
 let r={mode:'shockwave',phase:'playing',shockwave:state,paused:true};
 const before=state.timer;E.update(.25,r,ps);
 assert.equal(state.timer,before,'pause must freeze all simulation timers');
 r.paused=false;E.update(.25,r,ps);
 assert.equal(state.danger.join(','),locked,'danger tiles must not change mid-warning');
}
{
 const {ps,state}=game(4,123);
 state.wave=2;const first=E.calculateDangerWeights(state,ps);
 state.wave=13;const last=E.calculateDangerWeights(state,ps);
 const far=first.reduce((a,b)=>a.distance>b.distance?a:b),near=first.reduce((a,b)=>a.distance<b.distance?a:b);
 assert.ok(last.find(t=>t.id===far.id).weight>first.find(t=>t.id===far.id).weight);
 assert.ok(last.find(t=>t.id===near.id).weight>=1,'nearby tiles always have nonzero weight');
 const doomed=state.tiles.map(t=>t.id);
 assert.equal(E.validateSafeRoutes(state,ps,doomed,2.5),false);
}
{
 // Contact circle straddles a safe / destroyed boundary; sprites do not matter.
 const {ps,state}=game(2,7),s=state;
 const left=s.tiles[0],right=s.tiles[1];right.state='destroyed';
 const boundary=s.board.x+s.tileSize,y=s.board.y+s.tileSize/2;
 ps[0].x=boundary-3;ps[0].y=y;
 const high=E.calculateFootSupport(s,ps[0]);
 ps[0].x=boundary+5;const low=E.calculateFootSupport(s,ps[0]);
 assert.ok(high>.5,'at least 50% foot support must survive');
 assert.ok(low<.5,'less than 50% foot support must fall');
 assert.ok(high<=1&&low>=0,'never double-count overlap');
}
{
 const {ps,state}=game(2,73);
 E.startWave(state,ps);
 const dying=state.tiles.find(t=>t.id===0),safe=state.tiles.find(t=>t.id===15);
 Object.assign(ps[0],tileCenter(state,dying.id));
 Object.assign(ps[1],tileCenter(state,safe.id));
 dying.state='warning';dying.wave=1;state.danger=[0];state.phase='WARNING';state.warningStarted=true;
 E.triggerExplosion(state,ps);
 assert.equal(dying.state,'exploding');
 assert.equal(ps[0].shockAlive,false);assert.equal(ps[1].shockAlive,true);
 assert.equal(state.winnerId,ps[1].id);
 E.collapseTiles(state);assert.equal(dying.state,'destroyed');
 assert.equal(E.calculateDangerWeights(state,ps).some(t=>t.id===dying.id),false);
}
{
 const {ps,state}=game(3,12);
 E.evaluateEliminations(state,ps,[ps[0],ps[1]]);
 assert.equal(ps[2].shockAlive,true);
 assert.equal(ps[0].shockEliminatedAt,ps[1].shockEliminatedAt,'same event gets equal rank');
 const prior=ps[0];
 E.evaluateEliminations(state,ps,[ps[2]]);
 assert.equal(state.finished,true);assert.equal(state.winnerId,ps[2].id);
 assert.equal(prior.shockAlive,false);
}
{
 const {ps,state}=game(3,23);
 E.evaluateEliminations(state,ps,[ps[0]]);
 const alreadyOut=ps[0];
 E.evaluateEliminations(state,ps,[ps[1],ps[2]]);
 assert.ok(state.tiebreakers>=1);
 assert.equal(state.finished,false);assert.equal(state.winnerId,null);
 assert.equal(alreadyOut.shockAlive,false,'prior elimination cannot return');
 assert.equal(ps[1].shockAlive,true);assert.equal(ps[2].shockAlive,true);
}
{
 const {ps,state}=game(2,41);
 state.tiles.slice(1).forEach(t=>t.state='destroyed');
 E.checkWinner(state,ps);
 assert.ok(state.finalArena&&state.tiebreakers===1);
 assert.equal(state.tiles.length,16,'special arena creates a new grid');
 assert.equal(state.finished,false,'one tile never randomly selects winner');
}
{
 const {ps,state}=game(2);
 Object.assign(ps[0],{x:480,y:280});Object.assign(ps[1],{x:480,y:280});
 E.resolvePlayerCollision(state,ps);
 assert.ok(Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)>0,'players exert a push');
 ps[1].shockAlive=false;
 const x=ps[0].x,y=ps[0].y;
 E.resolvePlayerCollision(state,ps);assert.equal(ps[0].x,x);assert.equal(ps[0].y,y);
}
{
 const {ps,state,round}=game(1,101);
 round.phase='playing';
 for(let i=0;i<15;i++)E.update(1/60,round,ps);
 assert.equal(state.finished,true);assert.equal(state.winnerId,ps[0].id);
 assert.equal(round.remaining,null);
 assert.equal('totalTime' in state,false,'no match-length deadline');
}
{
 const {ps,state,round}=game(6,12345);
 round.phase='playing';
 for(let i=0;i<2500&&!state.finished;i++)
   E.update(i%17===0?.05:i%5===0?.013:1/60,round,ps);
 assert.ok(state.wave>=1);
 assert.ok(state.remainingTiles<=16);
 assert.ok(state.tiebreakers>=0);
}
{
 const {state}=game(4,44);state.wave=10;
 state.tiles.slice(0,13).forEach(t=>t.state='destroyed');
 assert.equal(E.checkSuddenDeath(state),true);
 assert.equal(state.suddenDeath,true);
 assert.equal(state.remainingTiles,3);
}
console.log('SHOCKWAVE PASS: map sizes, seeded waves, warnings, weighted tiles, foot support, ties, collision and final arena');
