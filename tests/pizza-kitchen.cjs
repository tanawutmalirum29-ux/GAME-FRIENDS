/* Garden kitchen geometry, live serving and crowded 60-second rounds. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),scope={window:{}};
for(const file of ['character-system.js','pizza-ingredient-art.js','pizza-kitchen-art.js','pizza-time.js'])
 vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),scope,{filename:file});
const G=scope.window.PizzaTime,A=scope.window.PizzaKitchenArt;
function start(n,seed=29,bot=false){
 const ps=Array.from({length:n},(_,i)=>({id:'p'+(i+1),name:'Player '+(i+1),color:'#ffaaaa',isBot:bot,input:{}}));
 const round={phase:'playing',pizzaSeed:seed},s=G.setup(round,ps);return {ps,round,s};
}
const tick=(x,n=1)=>{for(let i=0;i<n;i++)G.update(1/60,x.round,x.ps);};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function clear(s,p,r=s.bodyRadius-.001){
 const b=s.arena;
 if(p.x<b.x+r||p.y<b.y+r||p.x>b.x+b.w-r||p.y>b.y+b.h-r)return false;
 return s.solids.every(q=>Math.hypot(p.x-Math.max(q.x,Math.min(q.x+q.w,p.x)),
  p.y-Math.max(q.y,Math.min(q.y+q.h,p.y)))>=r);
}
function geometry(s){
 return JSON.stringify({arena:s.arena,worktops:s.worktops,ovens:s.ovens,chefs:s.chefs,solids:s.solids,
  pads:s.tables.map(({id,worktopId,x,y,pick})=>({id,worktopId,x,y,pick}))});
}
const stocks=new Set();
for(let n=1;n<=12;n++){
 const x=start(n),s=x.s,base=geometry(s),u=s.unit;
 assert.ok(Math.abs(s.actorScale/u-1.12)<1e-9,'avatar screen scale stays constant for all counts');
 assert.equal(s.solids.length,s.worktops.length+s.ovens.length+n,'all visible furniture is solid');
 for(const [i,p] of x.ps.entries()){
  assert.ok(clear(s,p),n+'-player spawn is in a clear aisle');
  for(const other of x.ps.slice(i+1))assert.ok(distance(p,other)>=s.bodyRadius*2-.01,'spawn circles do not overlap');
  const c=s.chefById.get(p.id);
  assert.ok(clear(s,c.deliver),'delivery pad is on the customer side of the solid counter');
  const b=s.orderCards.get(p.id);
  assert.ok(b.x>=c.bounds.x&&b.x+b.w<=c.bounds.x+c.bounds.w+.001,'menu stays inside own booth');
  for(const tray of c.trays)assert.ok(tray.x>c.counter.x&&tray.x<c.counter.x+c.counter.w&&tray.y>c.counter.y&&tray.y<c.counter.y+c.counter.h);
  for(const t of s.tables){
   assert.ok(clear(s,t.pick),'ingredient pickup pad is not inside its table');
   for(const [from,to] of [[p,t.pick],[t.pick,c.deliver]]){
    const route=G.aStar(s,from,to,true);
    assert.ok(Number.isFinite(route.distance)&&route.points.length,'every chef reaches every ingredient and returns');
    assert.ok(route.points.every(q=>clear(s,q)),'A* waypoints do not enter furniture');
   }
  }
 }
 // A new seed randomizes stock and menus, not furniture or delivery positions.
 for(let seed=1;seed<=12;seed++){
  const y=start(n,seed),ids=y.s.tables.map(t=>t.ingredient);
  assert.equal(geometry(y.s),base,'authored kitchen furniture is stable');
  assert.equal(new Set(ids).size,ids.length,'no duplicate ingredient anywhere in a match');
  for(const p of y.ps)assert.ok(p.pizza.order.every(id=>ids.includes(id)),'menus only request stocked food');
  if(n===4)stocks.add(ids.join(','));
 }
 // Walking directly into each face stops at the visible furniture boundary.
 for(const rect of s.solids){
  const margin=s.bodyRadius+8*u,p=x.ps[0];
  const approaches=[
   {x:rect.x-margin,y:rect.y+rect.h/2,axisX:1,axisY:0},
   {x:rect.x+rect.w+margin,y:rect.y+rect.h/2,axisX:-1,axisY:0},
   {x:rect.x+rect.w/2,y:rect.y-margin,axisX:0,axisY:1},
   {x:rect.x+rect.w/2,y:rect.y+rect.h+margin,axisX:0,axisY:-1}];
  for(const q of approaches){
   if(!clear(s,q)||x.ps.slice(1).some(other=>distance(q,other)<80*u))continue;
   Object.assign(p,q);p.input={axisX:q.axisX,axisY:q.axisY};tick(x,16);
   assert.ok(clear(s,p),'human input cannot walk through a table, oven or chef booth');
   p.input={};
  }
 }
}
assert.ok(stocks.size>=10,'stock changes across rounds');
{
 const x=start(4),p=x.ps[0],s=x.s,c=s.chefById.get(p.id),first=[...p.pizza.order];
 // The same art API used by the real renderer follows actual delivery state.
 for(const [slot,id] of first.entries()){
  const pickup=s.tables.find(t=>t.ingredient===id).pick;
  Object.assign(p,pickup);tick(x);
  assert.equal(p.pizza.held,id);
  for(const dir of [{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1},{x:.6,y:.8}]){
   p.dir=dir;const plate=A.carryPose(s,p);
   assert.ok(Math.abs(distance(plate,p)-28*s.unit)<1e-8);
   assert.ok((plate.x-p.x)*dir.x+(plate.y-p.y)*dir.y>0,'held plate follows facing, including turns');
  }
  Object.assign(p,c.deliver);tick(x);
  assert.equal(p.pizza.held,null);
  if(slot===0){
   assert.equal(p.score,0);assert.equal(A.counterContents(s,p).ingredients[0].id,id);
   assert.equal(A.counterContents(s,p).ingredients[0].slot,0);
   tick(x,180);assert.equal(A.counterContents(s,p).ingredients[0].id,id,'delivered food stays on its tray');
  }
 }
 assert.equal(p.score,1);assert.equal(p.pizza.orderSerial,2,'next menu starts immediately');
 assert.equal(A.counterContents(s,p).ingredients.length,2,'both foods appear on trays before cooking');
 tick(x,22);assert.deepEqual([...A.counterContents(s,p).pizza],first,'serving animation shows the completed recipe');
 tick(x,60);assert.equal(A.counterContents(s,p).pizza,null);
 assert.equal(p.score,1,'render/serving animation cannot award extra points');
}
const rounds=[];
for(let n=1;n<=12;n++)rounds.push([n,29]);
for(const n of [4,8,12])for(const seed of [13,97])rounds.push([n,seed]);
let cooks=0,minScore=Infinity;
for(const [n,seed] of rounds){
 const x=start(n,seed,true),initial=x.s.seed;
 // Rendering helpers must not alter menus, RNG or scores.
 const snapshot=JSON.stringify(x.ps.map(p=>p.pizza));
 for(const p of x.ps){A.carryPose(x.s,p);A.counterContents(x.s,p);}
 assert.equal(JSON.stringify(x.ps.map(p=>p.pizza)),snapshot);assert.equal(x.s.seed,initial);
 for(let frame=0;frame<3601;frame++){
  tick(x);
  if(frame%30===0)for(const p of x.ps)assert.ok(clear(x.s,p),`bot ${p.id}, n=${n}, seed=${seed} entered furniture`);
 }
 assert.equal(x.s.finished,true);assert.equal(x.round.remaining,0);
 for(const p of x.ps){
  assert.ok(p.score>=1,`bot ${p.id}, n=${n}, seed=${seed} must complete a recipe within the round`);
  assert.equal(p.pizza.orderSerial,p.score+1);
  minScore=Math.min(minScore,p.score);cooks++;
 }
 const final=x.ps.map(p=>[p.x,p.y,p.score]);tick(x,60);
 assert.deepEqual(x.ps.map(p=>[p.x,p.y,p.score]),final,'round end freezes movement and score');
}
console.log(`PIZZA KITCHEN PASS: 1–12 layouts, unique randomized stock, furniture collisions, carried/placed food, ${rounds.length} full bot rounds / ${cooks} cooks (minimum ${minScore} recipes).`);
