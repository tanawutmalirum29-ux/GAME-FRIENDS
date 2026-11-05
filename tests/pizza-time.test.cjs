'use strict';
/* Run: node tests/pizza-time.test.cjs
   Full fairness QA: PIZZA_FAIR_SEEDS=1000 node tests/pizza-time.test.cjs */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','pizza-time.js'),'utf8');
const sandbox={window:{},Date,Math,Uint8Array,Float64Array,Int32Array};
vm.runInNewContext(source,sandbox,{filename:'pizza-time.js'});
const G=sandbox.window.PizzaTime;
assert.ok(G&&G.setup&&G.update&&G.draw&&G.hud);
const make=(n,bot=false)=>Array.from({length:n},(_,i)=>({
 id:i+1,name:'ผู้เล่น'+(i+1),active:true,isBot:bot,input:{axisX:0,axisY:0},
 color:'#ffaaaa',score:0
}));
function start(n,seed=1,bot=false){
 const ps=make(n,bot),round={phase:'playing',paused:false,pizzaSeed:seed};
 const s=G.setup(round,ps);
 return {ps,round,s};
}
function tick(ctx,count=1){
 for(let i=0;i<count;i++)G.update(1/60,ctx.round,ctx.ps);
}
for(let n=1;n<=12;n++){
 const x=start(n,1337);
 assert.equal(x.s.tables.length,G.tableCount(n));
 assert.equal(x.round.remaining,60);
 for(const p of x.ps){
  assert.equal(p.score,0);
  assert.equal(p.pizza.order.length,2);
  assert.notEqual(p.pizza.order[0],p.pizza.order[1]);
  assert.equal(p.pizza.held,null);
 }
 const distances=x.ps.map(p=>p.pizza.lastCost);
 assert.ok(distances.every(Number.isFinite),'all order routes must be reachable');
 const avg=distances.reduce((a,b)=>a+b,0)/n;
 const spread=Math.max(...distances)-Math.min(...distances);
 assert.ok(spread<=avg*.0201,'route disparity too high for '+n+' players: '+(100*spread/avg).toFixed(2)+'%');
}
{
 const x=start(1,17),p=x.ps[0],order=p.pizza.order;
 const pickup=id=>x.s.tables.find(t=>t.ingredient===id).pick;
 const go=point=>{p.x=point.x;p.y=point.y;tick(x,2);};
 go(pickup(order[0]));assert.equal(p.pizza.held,order[0]);
 go(pickup(order[1]));assert.equal(p.pizza.held,order[1],
  'collecting another pending ingredient replaces the one in hand');
 assert.equal(p.pizza.delivered.length,0);
 assert.equal(p.score,0);
 for(let i=0;i<10;i++){go(pickup(order[i%2]));}
 assert.equal(p.pizza.delivered.length,0,'repeated swaps never count as deliveries');
 assert.equal(p.score,0);
 go(pickup(order[1]));go(x.s.center);
 assert.equal(p.pizza.held,null);
 assert.equal(p.pizza.delivered.length,1);
 assert.equal(p.score,0);
 tick(x,20);assert.equal(p.pizza.delivered.length,1,'no duplicate deliveries at chef');
 go(pickup(order[0]));go(x.s.center);
 assert.equal(p.score,1,'two distinct chef deliveries award exactly one point');
 assert.equal(p.pizza.held,null);
 assert.equal(p.pizza.delivered.length,0);
 assert.equal(p.pizza.order.length,2);
}
{
 const x=start(2,29,true);
 tick(x,720);assert.ok(x.ps.every(p=>p.score>0),'bots complete two-trip orders');
}
{
 const x=start(3,22);
 tick(x,3650);
 assert.equal(x.round.remaining,0);
 assert.equal(x.s.finished,true);
 const before=x.ps.map(p=>p.score);
 tick(x,50);
 assert.deepEqual(x.ps.map(p=>p.score),before,'score stays frozen after 60 seconds');
}
const seeds=Math.max(0,Math.min(1000,Number(process.env.PIZZA_FAIR_SEEDS||0)||0));
for(let n=1;n<=12;n++)for(let seed=1;seed<=seeds;seed++){
 const x=start(n,seed);
 const costs=x.ps.map(p=>p.pizza.lastCost),avg=costs.reduce((a,b)=>a+b,0)/n;
 const max=Math.max(...costs)-Math.min(...costs);
 assert.ok(max<=avg*.0201,'fairness failed: n='+n+' seed='+seed+' gap='+(100*max/avg).toFixed(2)+'%');
}
console.log('PIZZA TIME QA passed: 1–12 players, swaps, two-trip score, bots, 60s clock; extra seeds/player='+seeds);
