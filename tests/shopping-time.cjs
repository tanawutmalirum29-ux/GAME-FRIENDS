'use strict';
/* node tests/shopping-time.cjs — authoritative 1–12-player physics/regression. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/games/shopping-time/shopping-time.js'),'utf8');
const sandbox={window:{},Date,Math};
vm.runInNewContext(fs.readFileSync(path.join(root,'character-system.js'),'utf8'),sandbox,{filename:'character-system.js'});
vm.runInNewContext(source,sandbox,{filename:'src/games/shopping-time/shopping-time.js'});
const G=sandbox.window.ShoppingTime,C=G.config;
assert.ok(['setup','update','draw','hud','playerStatus'].every(f=>typeof G[f]==='function'));
const make=(n,bots=false)=>Array.from({length:n},(_,i)=>({
  id:'p'+i,name:'Player '+i,color:'#f87fa0',active:false,isBot:bots,
  input:{axisX:0,axisY:0,action:false,alt:false},score:0
}));
function newGame(n=1,seed=42,bots=false){
 const players=make(n,bots),round={phase:'playing',paused:false,shoppingSeed:seed};
 const s=G.setup(round,players);
 assert.equal(round.shoppingTime,s);
 return {players,round,s};
}
function tick(t,n=1){
 for(let i=0;i<n;i++)G.step(1/60,t.round,t.players);
}
function assertFrontAttached(s,p,context='cart attached'){
 const q=p.shopping,d=s.metrics.cartDistance,cos=Math.cos(q.angle),sin=Math.sin(q.angle);
 const dx=q.cartX-p.x,dy=q.cartY-p.y;
 assert.ok(Math.abs(dx-cos*d)<1e-7&&Math.abs(dy-sin*d)<1e-7,
  context+': cart centre equals owner position plus forward offset');
 assert.ok(Math.abs(Math.hypot(dx,dy)-d)<1e-7,
  context+': cart stays at fixed distance');
 const forward=dx*cos+dy*sin,side=dy*cos-dx*sin;
 assert.ok(forward>d-1e-7&&Math.abs(side)<1e-7,
  context+': cart never drifts to either side or behind the owner');
 const a=s.arena,r=s.metrics.cartRadius;
 assert.ok(q.cartX>=a.x+r-1e-6&&q.cartX<=a.x+a.w-r+1e-6&&
           q.cartY>=a.y+r-1e-6&&q.cartY<=a.y+a.h-r+1e-6,
  context+': entire cart hit circle remains within the arena bounds');
}
function disabledSpawn(s){for(const l of s.lanes)l.nextSpawn=9999;}
function obj(s,p,kind='item',type='apple'){
 const q=p.shopping;
 return {id:++s.nextId,kind,type,active:true,x:q.cartX,y:q.cartY,
   prevY:q.cartY,dir:1,lane:1,radius:kind==='bomb'?14:13,phase:0};
}
for(let n=1;n<=12;n++){
 const t=newGame(n,100+n),w=G.size(n);
 assert.equal(t.s.world.kind,n<=6?'standard':'large');
 assert.equal(t.s.world.w,w.w);
 assert.equal(t.s.lanes.length,4,'always four lanes');
 assert.equal(Array.from(t.s.lanes,x=>x.dir).join(','),'-1,1,-1,1');
 assert.ok(t.players.every(p=>p.active&&p.shopping&&p.shopping.basket.length===0&&p.score===0));
 assert.equal(new Set(t.players.map(p=>p.id)).size,n);
 assert.equal(t.s.checkouts.length,2);
 assert.ok(t.players.filter(p=>p.x<t.s.world.w/2).length-
           t.players.filter(p=>p.x>t.s.world.w/2).length<=1);
}
{
 const a=newGame(6),b=newGame(12);
 assert.ok(b.s.world.w>a.s.world.w&&b.s.world.h>a.s.world.h);
 assert.ok(Math.abs((b.s.beltRight-b.s.beltLeft)/b.s.unit-(a.s.beltRight-a.s.beltLeft)/a.s.unit)<1e-8,
   'Large keeps conveyor lanes the same screen size while widening the walking sides');
 assert.ok(b.s.arena.w/b.s.unit>a.s.arena.w/a.s.unit);
}
{
 const t=newGame(),p=t.players[0],q=p.shopping,s=t.s;
 disabledSpawn(s);
 assert.equal(G.flowAt(s,s.lanes[0].x,s.world.h/2),-C.conveyorSpeed);
 assert.equal(G.flowAt(s,s.lanes[1].x,s.world.h/2),C.conveyorSpeed);
 assert.equal(G.flowAt(s,100,s.world.h/2),0);
 p.x=s.lanes[0].x;p.y=s.world.h/2;q.cartX=p.x;q.cartY=p.y;q.angle=0;
 const before=p.y;tick(t,40);assert.ok(p.y<before-5,'idle player carried up by conveyor');
 p.input.axisY=1;tick(t,20);assert.ok(p.shopping.vy>0,'can walk against belt');
 p.input.axisY=0;p.x=100;p.y=s.world.h/2;q.cartX=130;q.cartY=p.y;
 tick(t,40);assert.ok(Math.abs(q.flow)<2,'conveyor influence decays on normal floor');
}
{
 const t=newGame(),p=t.players[0],s=t.s,q=p.shopping;
 disabledSpawn(s);
 const purchase=obj(s,p);
 s.objects.push(purchase);tick(t);
 assert.equal(q.basket.length,1,'cart collision collects an item automatically');
 assert.equal(p.score,0,'pickup does not award score');
 assert.equal(s.objects.includes(purchase),false,'picked item is consumed once');
 q.basket=Array(5).fill('apple');
 const overflow=obj(s,p);s.objects.push(overflow);tick(t);
 assert.equal(q.basket.length,5,'capacity is five');
 assert.equal(overflow.active,true,'full cart does not erase an item');
 s.objects=[]; // Isolate checkout idempotency from fresh products near the smaller market.
 const z=s.checkouts[0];
 p.x=z.x-C.cartDistance;p.y=z.y;q.angle=0;q.cartX=z.x;q.cartY=z.y;
 tick(t);assert.equal(p.score,5,'checkout transfers 5 paid items to score');
 assert.equal(q.basket.length,0,'checkout empties basket');
 tick(t,10);assert.equal(p.score,5,'standing at register does not double-count');
 q.basket=['milk','chips','apple'];tick(t);
 assert.equal(p.score,8,'partial 3-item checkout is allowed');
 assert.equal(q.basket.length,0);
}
{
 const t=newGame(),p=t.players[0],q=p.shopping,s=t.s;
 disabledSpawn(s);p.score=2;q.basket=Array(5).fill('milk');
 const bomb=obj(s,p,'bomb','bomb');s.objects.push(bomb);tick(t);
 assert.equal(p.score,-3,'bomb subtracts five even below zero');
 assert.equal(q.basket.length,0,'full basket destroyed on collision');
 assert.ok(q.stun>.9,'one-second stun begins');
 assert.equal(bomb.active,false,'bomb removed once triggered');
 p.score=-8;q.immune=0;q.stun=0;
 const second=obj(s,p,'bomb','bomb');s.objects=[second];tick(t);
 assert.equal(p.score,-13,'negative score can decrease further');
 assert.equal(G.playerStatus(p).score,-13);
 const third=obj(s,p,'bomb','bomb');s.objects=[third];tick(t);
 assert.equal(p.score,-13,'short invulnerability avoids multi-bomb same-frame damage');
 s.objects=[];tick(t,80);assert.equal(q.stun,0,'player recovers automatically');
}
{
 const t=newGame(),p=t.players[0],q=p.shopping,s=t.s;
 disabledSpawn(s);p.x=s.lanes[1].x;p.y=s.world.h/2;q.cartX=p.x;q.cartY=p.y;
 q.stun=1;q.immune=1.3;p.input.axisX=1;
 const y=p.y,x=p.x;tick(t,20);
 assert.ok(p.y>y+2,'stunned player is still carried along belt');
 assert.ok(Math.abs(p.x-x)<1,'joystick cannot steer stunned player');
}
{
 const t=newGame(3),ps=t.players,s=t.s;
 disabledSpawn(s);
 ps[0].score=4;ps[1].score=4;ps[2].score=-3;
 G.finish(s,t.round,ps);
 assert.equal(s.ranking.find(x=>x.id===ps[0].id).rank,1);
 assert.equal(s.ranking.find(x=>x.id===ps[1].id).rank,1);
 assert.equal(s.ranking.find(x=>x.id===ps[2].id).rank,3);
 assert.equal(s.winnerIds.length,2);
 const frozen=ps.map(p=>p.score);
 tick(t,60);assert.deepEqual(ps.map(p=>p.score),frozen,'finished round is immutable');
}
{
 const t=newGame(2,2026,true);
 tick(t,3600);
 assert.equal(t.round.remaining,0);assert.equal(t.s.finished,true);
 assert.ok(t.s.scanned>0,'bots must use real checkout');
 for(const p of t.players){
  assert.equal(p.score,p.shopping.paid-5*p.shopping.bombs,'score equals paid goods minus bomb penalties');
  assert.ok(p.shopping.paid>0,'bots collect and scan real goods');
 }
}
for(let n=1;n<=12;n++)for(let seed=1;seed<=3;seed++){
 const t=newGame(n,seed,true);
 tick(t,3600);
 assert.equal(t.s.finished,true);
 assert.ok(t.players.every(p=>p.shopping.basket.length<=5));
 assert.ok(t.s.scanned>0,'bots must checkout across multiple seeds');
 assert.ok(t.players.every(p=>p.score===p.shopping.paid-5*p.shopping.bombs));
 assert.ok(t.players.every(p=>p.shopping.paid>0),'every bot contributes in this seed');
}
// The cart is no longer a delayed follower: sharp joystick turns update the
// front position on the VERY NEXT 60 Hz tick, including when it is stationary.
{
 const t=newGame(1,773),p=t.players[0],q=p.shopping,s=t.s;
 disabledSpawn(s);
 p.x=s.arena.x+s.arena.w/2;p.y=s.arena.y+s.arena.h/2;
 q.angle=0;q.cartX=p.x+s.metrics.cartDistance;q.cartY=p.y;
 for(const [x,y] of [[1,0],[0,1],[-1,0],[0,-1],[1,0]]){
  p.input.axisX=x;p.input.axisY=y;
  tick(t);
  assertFrontAttached(s,p,'sharp 90/180 degree turn');
  const target=Math.atan2(y,x);
  assert.ok(Math.abs(Math.atan2(Math.sin(q.angle-target),Math.cos(q.angle-target)))<1e-8,
   'shopping cart points exactly toward the most recent joystick input');
 }
 p.input.axisX=0;p.input.axisY=0;tick(t,100);
 assertFrontAttached(s,p,'idle cart');
}
// A wall must stop the whole connected pair, never clip the cart while the
// owner continues to move, and turning into the wall cannot detach the basket.
{
 const t=newGame(1,774),p=t.players[0],q=p.shopping,s=t.s;
 disabledSpawn(s);
 const a=s.arena;
 for(const [x,y,dx,dy] of [
  [a.x+s.metrics.playerRadius,a.y+a.h/2,-1,0],
  [a.x+a.w-s.metrics.playerRadius,a.y+a.h/2,1,0],
  [a.x+a.w/2,a.y+s.metrics.playerRadius,0,-1],
  [a.x+a.w/2,a.y+a.h-s.metrics.playerRadius,0,1]
 ]){
  p.x=x;p.y=y;p.input.axisX=dx;p.input.axisY=dy;
  tick(t,12);
  assertFrontAttached(s,p,'wall-bound turn');
 }
}
// Another cart or player can shove the owner, but never separate the cart.
{
 const t=newGame(2,775),s=t.s,[a,b]=t.players;
 disabledSpawn(s);
 a.x=s.arena.x+s.arena.w/2-22;b.x=a.x+44;
 a.y=b.y=s.arena.y+s.arena.h/2;
 a.shopping.angle=0;b.shopping.angle=Math.PI;
 a.input.axisX=1;b.input.axisX=-1;
 for(let i=0;i<180;i++){
  tick(t);
  assertFrontAttached(s,a,'cart collision player A');
  assertFrontAttached(s,b,'cart collision player B');
 }
}
// Dense twelve-bot cart collisions and conveyors must not cause drift over
// hundreds of frames, even when bots constantly retarget items/checkouts.
{
 const t=newGame(12,776,true);
 for(let i=0;i<900;i++){
  tick(t);
  if(i%15===0)t.players.forEach(p=>assertFrontAttached(t.s,p,'twelve player stress'));
 }
 assert.ok(t.s.scanned>0,'rigid carts still collect items and finish checkouts');
}
// Static integration guards protect the picker, Board Party and deploy references.
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const board=fs.readFileSync(path.join(root,'board-minigame.js'),'utf8');
const build=fs.readFileSync(path.join(root,'scripts/build-static.cjs'),'utf8');
assert.match(app,/shopping_time:'ShoppingTime'/);
assert.match(app,/endShoppingTimeRound/);
assert.match(app,/renderPhoneShoppingStatus/);
assert.match(html,/src="\.\/src\/games\/shopping-time\/shopping-time\.js"/);
assert.match(html,/data-pick="shopping_time"/);
assert.match(board,/case 'shopping_time':/);
assert.match(build,/'src\/games\/shopping-time\/shopping-time\.js'/);
console.log('SHOPPING TIME: four conveyor lanes, rigid forward cart steering, collision, checkout, bomb immunity, 1–12 players, bots and integration PASS');
