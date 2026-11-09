'use strict';
/* Run: node tests/pizza-time.test.cjs
   More fairness samples: PIZZA_FAIR_SEEDS=1000 node tests/pizza-time.test.cjs */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','src/games/pizza-time/pizza-time.js'),'utf8');
const sandbox={window:{},Date,Math,Uint8Array,Float64Array,Int32Array};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','character-system.js'),'utf8'),sandbox,{filename:'character-system.js'});
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','src/games/pizza-time/pizza-ingredient-art.js'),'utf8'),sandbox,{filename:'src/games/pizza-time/pizza-ingredient-art.js'});
vm.runInNewContext(source,sandbox,{filename:'src/games/pizza-time/pizza-time.js'});
const G=sandbox.window.PizzaTime;
const art=sandbox.window.PizzaIngredientArt;
assert.ok(art&&art.ids.length===10,'original SVG icons must be registered for all ingredients');
for(const id of art.ids){
 const markup=art.svg(id);
 assert.match(markup,/<svg[^>]+viewBox=/);
 assert.doesNotMatch(markup,/[\u{1F300}-\u{1FAFF}]/u,'SVG artwork must not contain emoji');
}

assert.ok(G&&G.setup&&G.update&&G.draw&&G.hud);
const make=(n,bot=false)=>Array.from({length:n},(_,i)=>({
 id:'p'+(i+1),name:'P'+(i+1),type:bot?'local':'remote',active:false,isBot:bot,input:{axisX:0,axisY:0},
 color:'#ffaaaa',score:0
}));
function start(n,seed=1,bot=false){
 const ps=make(n,bot),round={phase:'playing',paused:false,pizzaSeed:seed};
 const s=G.setup(round,ps);
 return {ps,round,s};
}
function tick(ctx,count=1){for(let i=0;i<count;i++)G.update(1/60,ctx.round,ctx.ps)}
function assertState(x,n){
 assert.ok(x.ps.every(p=>p.active), 'lobby players (including bots) must be activated when Pizza Time starts');
 assert.equal(x.s.worktops.length,G.tableCount(n));
 assert.equal(x.s.tables.length,x.s.worktops.length*2);
 assert.equal(x.s.chefs.length,n);
 assert.equal(x.s.orderCards.size,n,'one order bubble for each private chef');
 const all=[...x.s.orderCards.values()];
 const zones=x.s.chefs.map(c=>c.figureBounds);
 for(const [i,bubble] of all.entries()){
   assert.ok(zones.every(z=>!G.rectanglesOverlap(bubble,z,2*x.s.unit)),
     'order bubble must not cover a chef');
   assert.ok(all.slice(i+1).every(z=>!G.rectanglesOverlap(bubble,z,2*x.s.unit)),
     'order bubbles must not overlap each other');
 }

 assert.equal(x.s.roster.filter(p=>p.isBot).length,x.ps.filter(p=>p.isBot).length);
 assert.equal(new Set(x.s.chefs.map(c=>c.ownerId)).size,n);
 for(const top of x.s.worktops){
   const pair=x.s.tables.slice(top.id*2,top.id*2+2);
   assert.equal(pair.length,2);
   assert.ok(pair.every(t=>G.ingredients.some(q=>q.id===t.ingredient)));
   assert.notEqual(pair[0].ingredient,pair[1].ingredient,'each worktop has two DIFFERENT ingredients');
 }
 for(const p of x.ps){
   assert.equal(p.score,0);
   assert.equal(p.pizza.order.length,2);
   assert.notEqual(p.pizza.order[0],p.pizza.order[1]);
   assert.equal(p.pizza.held,null);
   assert.ok(x.s.chefById.get(p.id),'every player has a private chef');
   assert.ok(Math.hypot(p.x-x.s.chefById.get(p.id).deliver.x,p.y-x.s.chefById.get(p.id).deliver.y)<65*x.s.unit,
      'player spawns on the walking side of own counter');
   assert.ok(Number.isFinite(p.pizza.lastCost),'A* route to personal chef exists');
 }
}
for(let n=1;n<=12;n++)assertState(start(n,1337),n);
{
 const x=start(2,17),p=x.ps[0],order=p.pizza.order;
 const pickup=id=>x.s.tables.find(t=>t.ingredient===id).pick;
 const own=x.s.chefById.get(p.id).deliver;
 const other=x.s.chefById.get(x.ps[1].id).deliver;
 const go=point=>{p.x=point.x;p.y=point.y;tick(x,2)};
 go(pickup(order[0]));assert.equal(p.pizza.held,order[0]);
 go(pickup(order[1]));assert.equal(p.pizza.held,order[1]);
 assert.equal(p.pizza.delivered.length,0,'swapping does not count delivery');
 assert.equal(p.score,0);
 for(let i=0;i<10;i++)go(pickup(order[i%2]));
 assert.equal(p.pizza.delivered.length,0,'repeated swaps do not count delivery');
 go(pickup(order[1]));go(other);
 assert.equal(p.pizza.held,order[1],'other players chef NEVER accepts this order');
 assert.equal(p.score,0);
 go(own);
 assert.equal(p.pizza.held,null);
 assert.equal(p.pizza.delivered.length,1);
 tick(x,10);assert.equal(p.pizza.delivered.length,1,'no duplicate deliveries at chef');
 go(pickup(order[0]));go(own);
 assert.equal(p.score,1,'two real trips to own chef = exactly one point');
 assert.equal(p.pizza.held,null);
 assert.equal(p.pizza.delivered.length,0);
 assert.equal(p.pizza.order.length,2);
}
{
 const x=start(12,29,true);
 tick(x,1200);assert.ok(x.ps.every(p=>p.score>0),
  'all twelve bots can collect and deliver to their own chefs without deadlock');
}
{
 const x=start(3,22);
 tick(x,3660);
 assert.equal(x.round.remaining,0);
 assert.equal(x.s.finished,true);
 const before=x.ps.map(p=>p.score);
 tick(x,50);
 assert.deepEqual(x.ps.map(p=>p.score),before,'frozen after 60 seconds');
}

function completeMenu(x,p){
 const oldScore=p.score,order=[...p.pizza.order],chef=x.s.chefById.get(p.id).deliver;
 for(const ingredient of order){
  const pick=x.s.tables.find(t=>t.ingredient===ingredient).pick;
  p.x=pick.x;p.y=pick.y;tick(x,2);
  assert.equal(p.pizza.held,ingredient);
  p.x=chef.x;p.y=chef.y;tick(x,2);
 }
 assert.equal(p.score,oldScore+1);
}
for(const n of [1,4,8,12])for(const seed of [7,19,31]){
 const x=start(n,seed),p=x.ps[0];
 for(let i=0;i<12;i++){
  completeMenu(x,p);
  const history=p.pizza.menuHistory;
  assert.equal(history.length,i+2);
  const recent=history.slice(-4);
  assert.equal(new Set(recent.map(h=>h.key)).size,recent.length,
   'no menu pair may repeat within four consecutive menus');
  for(const h of recent)assert.ok(Number.isFinite(h.distance)&&Number.isFinite(h.target));
 }
}
{
 const x=start(3,83),y=start(3,83);
 y.ps[1].pizza.assignedTotal=999999;y.ps[2].score=100;
 completeMenu(x,x.ps[0]);completeMenu(y,y.ps[0]);
 assert.deepEqual([...x.ps[0].pizza.order],[...y.ps[0].pizza.order],
  'other players scores and order difficulty must not change this player menus');
}
{
 const x=start(1,29,true),p=x.ps[0],before={x:p.x,y:p.y};
 p.pizza.botPause=.25;tick(x,5);
 assert.deepEqual({x:p.x,y:p.y},before,'bots must pause instead of reacting instantly');
}
const seeds=Math.max(20,Math.min(1000,Number(process.env.PIZZA_FAIR_SEEDS)||20));
for(let n=1;n<=12;n++)for(let seed=1;seed<=seeds;seed++){
 const x=start(n,seed);assertState(x,n);
 for(const p of x.ps){
  const h=p.pizza.menuHistory[0];
  assert.equal(h.key,[...h.pair].sort().join('|'));
  assert.equal(p.pizza.menuCounts[h.key],1);
  assert.ok(Number.isFinite(h.target));
 }
}
console.log('PIZZA TIME: varied own-menu 1-4 cycles, per-player fairness, bots, turning and 1-12-player checks PASS');
