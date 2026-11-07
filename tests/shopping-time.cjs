'use strict';
/* node tests/shopping-time.cjs — authoritative 1–12-player physics/regression. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'shopping-time.js'),'utf8');
const sandbox={window:{},Date,Math};
vm.runInNewContext(fs.readFileSync(path.join(root,'character-system.js'),'utf8'),sandbox,{filename:'character-system.js'});
vm.runInNewContext(source,sandbox,{filename:'shopping-time.js'});
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
// Static integration guards protect the picker, Board Party and deploy references.
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const board=fs.readFileSync(path.join(root,'board-minigame.js'),'utf8');
const build=fs.readFileSync(path.join(root,'scripts/build-static.cjs'),'utf8');
assert.match(app,/shopping_time:'ShoppingTime'/);
assert.match(app,/endShoppingTimeRound/);
assert.match(app,/renderPhoneShoppingStatus/);
assert.match(html,/src="\.\/shopping-time\.js"/);
assert.match(html,/data-pick="shopping_time"/);
assert.match(board,/case 'shopping_time':/);
assert.match(build,/'shopping-time\.js'/);
console.log('SHOPPING TIME: four conveyor lanes, cart physics, checkout, bomb immunity, 1–12 players, bots and integration PASS');
