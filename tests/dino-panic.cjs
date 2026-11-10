'use strict';
/* DINO PANIC engine contract: positions, equal-speed chase, precise finishes,
 * collisions and rankings. Standalone Node regression, no browser dependency. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/games/dino-panic/game.js','utf8');
const context={window:{},Date,Math};
vm.runInNewContext(source.replace(/export default engine;\s*$/,'globalThis.__dinoEngine=engine;'),
 context,{filename:'src/games/dino-panic/game.js'});
const E=context.__dinoEngine;
assert.equal(E.config.speed,176);
const roster=n=>Array.from({length:n},(_,i)=>({
 id:'runner-'+i,name:'Runner '+i,color:'#ffcf55',active:true,isBot:false,
 input:{axisX:1,axisY:0,action:false,alt:false}
}));
const make=(n,seed=31)=>{const players=roster(n),round={phase:'playing',paused:false,dinoSeed:seed};
 const state=E.setup(round,players);return{players,round,state};};
const tick=(g,count=1)=>{for(let i=0;i<count;i++)E.update(1/60,g.round,g.players);};
for(let count=1;count<=12;count++){
 const g=make(count),w=g.state.world;
 assert.equal(E.hud(g.players,g.round).survivors,count);
 assert.equal(g.players.length,count);
 assert.equal(w.id,count<=6?'small':'large');
 assert.equal(w.h,540);
 assert.ok(w.w>w.finishX+100);
 assert.ok(g.players.every(p=>p.x===g.players[0].x&&p.y>=w.top+E.config.radius-1e-5&&
   p.y<=w.bottom-E.config.radius+1e-5));
 assert.equal(new Set(g.players.map(p=>p.x+','+p.y)).size,count,'spawn overlap '+count);
 assert.equal(E.getResult(g.round,g.players).length,count);
 assert.ok(g.state.obstacles.every(o=>o.x>g.players[0].x+E.config.radius*4&&
   o.x<w.finishX-150),'obstacle spawn near start or finish');
 // There must be one full-body traversal lane open at each obstacle wave.
 for(const o of g.state.obstacles){
  const candidates=Array.from({length:40},(_,j)=>w.top+E.config.radius+
   (w.bottom-w.top-2*E.config.radius)*j/39);
  assert.ok(candidates.some(y=>g.state.obstacles.every(z=>Math.abs(z.x-o.x)>35||
   Math.abs(y-z.y)>=z.h/2+E.config.radius)),
   'all lanes blocked at x='+o.x);
 }
}
{
 const g=make(2);
 const old=g.players[0].x,front=g.state.dinoFront;
 tick(g,35);
 assert.ok(Math.abs((g.players[0].x-old)-(g.state.dinoFront-front))<.0001,
   'fully forward running player must match dinosaur speed');
 const p=g.players[0];p.input.action=true;p.input.alt=true;
 const prior=p.x;tick(g);
 assert.ok(Math.abs(p.x-prior-E.config.speed/60)<.001,'A/B do not activate an ability');
 g.round.paused=true;const paused=p.x;tick(g);
 assert.equal(p.x,paused,'pause freezes simulation');
}
{
 const g=make(2),[fast,slow]=g.players;
 fast.x=g.state.world.finishX-1;
 slow.x=g.state.world.finishX-2;
 tick(g);
 assert.equal(fast.dp.status,'finished');
 assert.equal(slow.dp.status,'finished');
 assert.ok(fast.dp.finishedAt<slow.dp.finishedAt,'intra-tick finish interpolation');
 const results=E.getResult(g.round,g.players);
 assert.ok(results[0].value>results[1].value,'first runner ranks higher');
 assert.equal(g.state.ranking.find(p=>p.id===fast.id).rank,1);
}
{
 const g=make(2),[a,b]=g.players;
 a.x=b.x=g.state.world.finishX-1;
 tick(g);
 assert.equal(a.dp.finishedAt,b.dp.finishedAt,'true simultaneous crossing ties');
 assert.equal(g.state.ranking.find(p=>p.id===a.id).rank,1);
 assert.equal(g.state.ranking.find(p=>p.id===b.id).rank,1);
}
{
 const g=make(3);const [safe,...doomed]=g.players;
 for(const p of doomed)p.x=g.state.dinoFront+E.config.radius-1;
 tick(g);
 assert.equal(safe.dp.status,'running');
 assert.ok(doomed.every(p=>p.dp.status==='dead'));
 assert.equal(g.state.finished,true,'last survivor before finish ends game');
 assert.deepEqual([...g.state.winnerIds],[safe.id]);
}
{
 const g=make(2),p=g.players[0],o=g.state.obstacles[0];
 p.x=o.x-o.w/2-E.config.radius-1;p.y=o.y;
 p.input={axisX:1,axisY:0};
 tick(g);
 assert.ok(p.x<=o.x-o.w/2-E.config.radius+.01,'crates stop forward movement');
}
console.log('DINO PANIC: deterministic movement, collisions, ranking, and 1–12 tiers specified.');
