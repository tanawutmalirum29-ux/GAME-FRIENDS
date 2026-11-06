'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({window:{},console});
for(const f of ['board-map','board-dice','board-items','board-bots','board-minigame','board-party'])vm.runInContext(fs.readFileSync(f+'.js','utf8'),ctx,{filename:f+'.js'});
const {BoardMap:M,BoardDice:D,BoardItems:I,BoardParty:P,BoardMinigame:G}=ctx.window;
const plain=x=>JSON.parse(JSON.stringify(x));
const roster=(n,bots=false)=>Array.from({length:n},(_,i)=>({id:'p'+(i+1),name:'Player '+(i+1),color:'#66aacc',isBot:bots}));
const game=(n=3,seed=42,bots=false)=>P.create(roster(n,bots),{seed,rng:M.random(seed)});
const tick=(s,seconds)=>{for(let i=0;i<Math.ceil(seconds/.05);i++)P.update(s,.05);};
const until=(s,pred,seconds=100)=>{for(let i=0;i<seconds/.05;i++){if(pred())return;P.update(s,.05);}assert.fail('Timeout '+s.phase+' at '+s.time);};
function ready(n=3,seed=42){const s=game(n,seed);s.order=s.players.map(p=>p.id);P.startTurn(s);return s;}
function press(s,p,key,extra={}){const send=keys=>P.input(s,p.id,{turnId:s.turnId,actionId:(s.lastActions[p.id]??0)+1,keys});send(extra);return send({...extra,action:key==='A',alt:key==='B'});}
const tests=[];function test(name,fn){fn();tests.push(name);console.log('PASS',name);}
test('1,000 seeds: connected DAG, reciprocal edges, all branches finish',()=>{
 for(let seed=0;seed<1000;seed++){
  const map=M.create(seed);assert.equal(M.validate(map),true);
  for(const n of Object.values(map.nodes)){
   assert.ok(n.position&&n.effects&&n.type);let at=n,steps=0;
   while(at.id!==map.finishId){assert.ok(at.nextNodes.length);const next=map.nodes[at.nextNodes[seed%at.nextNodes.length]];assert.ok(next.progress>at.progress);at=next;assert.ok(++steps<60);}
  }
 }
});
test('1–12 players: simultaneous A/B order rolls, double-input protection and timeout',()=>{
 for(let n=1;n<=12;n++){
  const s=game(n);for(let i=0;i<n-1;i++)press(s,s.players[i],i%2?'A':'B');
  const first=plain(s.players[0].dice);if(n>1){press(s,s.players[0],'A');assert.deepEqual(plain(s.players[0].dice),first);}
  tick(s,17);assert.equal(s.order.length,n);assert.ok(s.players.every(p=>p.dice.length===2&&p.dice.every(v=>v>=1&&v<=6)));
  const sums=s.order.map(id=>s.players.find(p=>p.id===id).dice.reduce((a,b)=>a+b,0));assert.deepEqual([...sums].sort((a,b)=>b-a),plain(sums));
 }
});
test('Equal dice totals shuffle only their own group',()=>{
 const r=[{id:'a',dice:[6,5]},{id:'b',dice:[5,4]},{id:'c',dice:[3,6]},{id:'d',dice:[2,4]}],seen=new Set();
 for(let seed=0;seed<100;seed++){const o=D.order(r,M.random(seed));assert.equal(o[0],'a');assert.equal(o[3],'d');seen.add(o[1]);}assert.equal(seen.size,2);
});
test('Input tokens, duplicate action IDs, held A, non-active players, B after roll',()=>{
 const s=ready(),p=s.players[0];p.item='rocket';const packet={turnId:s.turnId,actionId:1,keys:{action:true}};
 assert.equal(P.input(s,p.id,{...packet,turnId:'stale'}),false);assert.equal(s.phase,'ready');
 press(s,s.players[1],'A');assert.equal(s.phase,'ready');assert.equal(P.input(s,p.id,packet),true);assert.equal(s.phase,'dice');
 const die=s.die;assert.equal(P.input(s,p.id,packet),false);press(s,p,'B');assert.equal(p.item,'rocket');assert.equal(s.die,die);
 assert.equal(P.input(s,p.id,{turnId:s.turnId,actionId:1,keys:{}}),false);
});
test('One-die movement counts actual edges and never processes crossed tiles',()=>{
 for(let roll=1;roll<=6;roll++){
  const s=ready();s.rng=()=> (roll-.5)/6;const p=s.players[0];
  for(const n of Object.values(s.map.nodes))if(!['start','finish'].includes(n.type))n.type='danger';
  press(s,p,'A');assert.equal(s.die,roll);let last='n0',steps=0;
  until(s,()=>{if(p.currentNodeId!==last){assert.ok(s.map.nodes[last].nextNodes.includes(p.currentNodeId));steps++;last=p.currentNodeId;}if(s.phase==='branch')press(s,p,'A');return s.phase==='effect';});
  assert.equal(steps,roll);assert.equal(p.hp,2);tick(s,.1);assert.equal(p.hp,2);
 }
});
test('Branch analog selects only forward edges; step rejects reverse/invalid nodes',()=>{
 const s=ready(),p=s.players[0];p.currentNodeId='n3';P.beginMove(s,p,2);assert.equal(s.phase,'branch');
 assert.equal(P.step(s,'n2'),false);assert.equal(P.step(s,'missing'),false);
 const to=s.map.nodes.b3_1.position,at=s.map.nodes.n3.position;
 press(s,p,null,{axisX:to.x-at.x,axisY:to.y-at.y});tick(s,.05);assert.equal(s.branch.selected,'b3_1');press(s,p,'A');until(s,()=>s.phase==='effect');assert.equal(p.currentNodeId,'b3_2');
});
test('HP cap, death keeps item/order, clears movement and awards no free roll',()=>{
 const s=ready(),p=s.players[0];p.currentNodeId='n1';p.hp=1;p.item='ufo';s.map.nodes.n2.type='danger';const order=plain(s.order);
 P.beginMove(s,p,1,'rocket');until(s,()=>s.phase==='effect');assert.equal(p.hp,3);assert.equal(p.currentNodeId,'n0');assert.equal(p.item,'ufo');assert.equal(s.effect.next,'end');tick(s,2);assert.equal(P.current(s).id,'p2');assert.deepEqual(plain(s.order),order);
 const q=s.players[2];q.hp=1;q.item='car';q.currentNodeId='n9';P.damage(s,q,1);assert.equal(q.currentNodeId,'n0');assert.equal(q.hp,3);assert.equal(q.item,'car');assert.equal(P.current(s).id,'p2');
});
test('Potion only below max HP, consumes once per round and allows roll',()=>{
 const s=ready(),p=s.players[0];p.item='potion';press(s,p,'B');assert.equal(p.item,'potion');assert.equal(s.phase,'ready');p.hp=1;press(s,p,'B');assert.equal(p.hp,2);assert.equal(p.item,null);until(s,()=>s.phase==='ready');p.item='rocket';press(s,p,'B');assert.equal(p.item,'rocket');press(s,p,'A');assert.equal(s.phase,'dice');
});
test('250 UFO cases: real world hitboxes, stacked players, atomic swap, no landing effects',()=>{
 for(let seed=0;seed<250;seed++){
  const s=ready(12,seed),p=s.players[0],q=s.players[1];p.item='ufo';for(const q of s.players.slice(1))q.currentNodeId='n10';
  press(s,p,'B');assert.equal(s.phase,'aim');s.skill.x=9999;press(s,p,'A');assert.equal(p.item,'ufo');assert.equal(p.currentNodeId,'n0');
  const pos=I.position(s,q);Object.assign(s.skill,pos);assert.equal(I.target(s,s.skill,p).id,q.id);press(s,p,'A');
  assert.equal(p.currentNodeId,'n10');assert.equal(q.currentNodeId,'n0');assert.equal(p.hp,3);assert.equal(q.hp,3);assert.equal(p.item,null);assert.equal(s.effect.next,'end');assert.equal(new Set(s.players.map(p=>p.id)).size,12);press(s,p,'A');assert.equal(s.phase,'effect');
 }
 const s=ready(),p=s.players[0],q=s.players[1];p.item='ufo';q.currentNodeId=s.map.finishId;press(s,p,'B');Object.assign(s.skill,I.position(s,q));press(s,p,'A');assert.equal(p.item,'ufo');tick(s,8.1);assert.equal(p.item,'ufo');assert.equal(s.phase,'ready');assert.equal(p.usedRound,0);
});
test('Repeated aim cancellation cannot extend a human turn indefinitely',()=>{
 const s=ready(),p=s.players[0];p.item='ufo';press(s,p,'B');tick(s,8.05);assert.equal(s.phase,'ready');press(s,p,'B');tick(s,4.1);press(s,p,'B');tick(s,.2);assert.equal(s.phase,'dice');assert.equal(p.item,'ufo');assert.equal(p.usedRound,0);
});
test('250 Rockets: only directed edges, max five steps, landing effect once, roll retained',()=>{
 for(let seed=0;seed<250;seed++){
  const s=ready(3,seed),p=s.players[0];p.currentNodeId='n'+(seed%30);p.item='rocket';for(const n of Object.values(s.map.nodes))if(n.type!=='finish')n.type='movement';
  const start=p.currentNodeId;press(s,p,'B');let last=start,steps=0;
  until(s,()=>{if(p.currentNodeId!==last){assert.ok(s.map.nodes[last].nextNodes.includes(p.currentNodeId));last=p.currentNodeId;steps++;}if(s.phase==='branch')press(s,p,'A');return s.phase==='effect'||s.phase==='finished';});
  assert.ok(steps<=5&&steps>0);if(s.phase!=='finished'){until(s,()=>s.phase==='ready');press(s,p,'A');assert.equal(s.phase,'dice');}
 }
});
test('250 Bomber attacks: 45-degree rotations, frozen preview, one hit per volley',()=>{
 for(let seed=0;seed<250;seed++){
  const s=ready(12,seed),p=s.players[0];p.item='bomber';for(const q of s.players.slice(1))q.currentNodeId='n10';
  press(s,p,'B');Object.assign(s.skill,s.map.nodes.n10.position);const before=s.skill.angle;press(s,p,'B');assert.equal(s.skill.angle,before+Math.PI/4);assert.equal(p.item,'bomber');
  const preview=plain(I.bombs(s.skill)),expected=I.victims(s,preview,p).map(p=>p.id);press(s,p,'A');assert.deepEqual(plain(s.effect.points),preview);
  for(const q of s.players.slice(1))assert.equal(q.hp,expected.includes(q.id)?2:3);assert.equal(p.hp,3);assert.equal(s.effect.next,'end');tick(s,.5);for(const q of s.players.slice(1))assert.equal(q.hp,expected.includes(q.id)?2:3);
 }
});
test('250 RC cars: backward input cannot reverse, no repeated node, swept hit detection',()=>{
 for(let seed=0;seed<250;seed++){
  const s=ready(3,seed),p=s.players[0];p.item='car';p.currentNodeId='n'+(seed%30);s.players[1].currentNodeId='n35';s.players[2].currentNodeId='n34';press(s,p,'B');
  let visited=[p.currentNodeId];until(s,()=>{if(s.skill){press(s,p,null,{axisX:-1,axisY:-1});visited=plain(s.skill.visited);}return s.phase==='effect';},10);
  assert.equal(new Set(visited).size,visited.length);for(let i=1;i<visited.length;i++)assert.ok(s.map.nodes[visited[i-1]].nextNodes.includes(visited[i]));assert.equal(s.effect.next,'end');assert.equal(p.item,null);
 }
 assert.equal(I.segmentDistance({x:50,y:0},{x:0,y:0},{x:100,y:0}),0);
 const s=ready(),p=s.players[0],q=s.players[1];p.item='car';q.currentNodeId='n1';q.hp=1;s.players[2].currentNodeId='n20';press(s,p,'B');until(s,()=>s.phase==='effect');assert.equal(q.currentNodeId,'n0');assert.equal(q.hp,3);
});
test('Actual engine outcomes use competition ranking and survival semantics',()=>{
 const list=roster(4).map((p,i)=>({...p,active:true,score:[15,12,12,7][i]}));
 for(const mode of ['chickens','color_switch','pizza_time'])assert.deepEqual(plain(G.ranking({mode},list).map(r=>r.rank)),[1,2,2,4]);
 list.forEach((p,i)=>{p.ghost=true;p.infectedAt=[9,7,7,3][i];p.shockEliminatedAt=[9,7,7,3][i];p.fruitEliminatedRound=[4,3,3,2][i];p.score=100-i;});
 for(const r of [{mode:'ghost'},{mode:'shockwave',shockwave:{winnerId:'p1'}},{mode:'fruit_memory',fruitMemory:{winnerId:'p1'}}])assert.deepEqual(plain(G.ranking(r,list).map(r=>r.rank)),[1,2,2,4]);
});
test('Every count 1–12, 500 random tied rankings each: exact floor(50%) quota',()=>{
 for(let count=1;count<=12;count++)for(let seed=0;seed<500;seed++){
  const rng=M.random(seed),scores=roster(count).map(p=>({...p,active:true,score:Math.floor(rng()*4)}));const r=G.ranking({mode:'chickens'},scores),before=plain(r),ids=G.rewards(r,count,rng);
  assert.equal(ids.length,Math.floor(count*.5));assert.equal(new Set(ids).size,ids.length);assert.deepEqual(plain(r),before);
  const bestExcluded=r.filter(p=>!ids.includes(p.id)).map(p=>p.rank);for(const id of ids)assert.ok(r.find(p=>p.id===id).rank<=Math.min(...bestExcluded));
 }
});
test('Inventory replacement defaults to keep, analog/A replace; same board/order/HP after games',()=>{
 const s=ready(4),p=s.players[0];p.currentNodeId='n12';p.hp=2;p.item='ufo';const map=s.map,order=plain(s.order),snapshot=P.snapshot(s);
 P.phase(s,'minigame_pending');assert.equal(P.minigameStarted(s,'chickens'),true);assert.equal(P.minigameStarted(s,'chickens'),false);
 assert.equal(P.minigameEnded(s,s.players.map((p,i)=>({id:p.id,rank:i+1,label:'score'}))),true);assert.equal(P.minigameEnded(s,[]),false);
 until(s,()=>s.phase==='rewards');assert.ok(s.pendingItems[p.id]);tick(s,9.1);assert.equal(p.item,'ufo');until(s,()=>s.phase==='ready');assert.equal(s.map,map);assert.deepEqual(plain(s.order),order);assert.equal(p.currentNodeId,snapshot.players[0].currentNodeId);assert.equal(p.hp,2);assert.equal(s.roundNumber,2);
 s.pendingItems[p.id]={item:'rocket',replace:false};P.phase(s,'rewards',9);press(s,p,null,{axisX:1});tick(s,.05);press(s,p,'A');assert.equal(p.item,'rocket');assert.equal(s.pendingItems[p.id],undefined);
});
test('Registry filtering, unregistered/board excluded and consecutive repeats avoided',()=>{
 const engine={setup(){},update(){},draw(){}},registry={ghost:engine,chickens:engine,pizza_time:{...engine,minPlayers:4},missing:null,board:engine};
 assert.deepEqual(plain(G.eligible(registry,1)),['ghost','chickens']);for(let seed=0;seed<100;seed++)assert.equal(G.pick(registry,2,'ghost',M.random(seed)),'chickens');
});
test('Finish stops new actions and supports genuinely simultaneous finishers',()=>{
 const s=ready(),a=s.players[0],b=s.players[1];a.currentNodeId=s.map.finishId;b.currentNodeId=s.map.finishId;
 P.win(s,a);P.win(s,b);assert.deepEqual(plain(s.winnerIds),[a.id,b.id]);a.item='bomber';press(s,a,'B');assert.equal(a.item,'bomber');assert.equal(s.phase,'finished');
});
test('Full-session stress: 1–12 bots, 20 seeds each, minigame rewards and finish',()=>{
 let games=0,rounds=0,used=new Set();
 for(let n=1;n<=12;n++)for(let seed=0;seed<20;seed++){
  const s=game(n,seed,true),map=s.map;let order=null;
  for(let frame=0;frame<80000&&s.phase!=='finished';frame++){
   const phase=s.phase,item=P.current(s)?.item;P.update(s,.1);
   if(s.phase==='order_result')order=plain(s.order);
   if(phase==='ready'&&['aim','car','moving','effect'].includes(s.phase)&&item)used.add(item);
   if(s.phase==='minigame_pending'){
    const hp=s.players.map(p=>p.hp),positions=s.players.map(p=>p.currentNodeId);P.minigameStarted(s,'chickens');
    const r=G.ranking({mode:'chickens'},s.players.map(p=>({...p,active:true,score:Math.floor(s.rng()*5)})));P.minigameEnded(s,r);rounds++;
    assert.deepEqual(s.players.map(p=>p.hp),hp);assert.deepEqual(s.players.map(p=>p.currentNodeId),positions);
   }
   assert.equal(s.map,map);if(order)assert.deepEqual(plain(s.order),order);
   for(const p of s.players)assert.ok(p.hp>=1&&p.hp<=3&&s.map.nodes[p.currentNodeId]);
  }
  assert.equal(s.phase,'finished','session n='+n+' seed='+seed);assert.equal(s.winnerIds.length,1);assert.equal(s.players.find(p=>p.id===s.winnerIds[0]).currentNodeId,s.map.finishId);games++;
 }
 assert.equal(used.size,5);console.log('  Completed',games,'sessions,',rounds,'board rounds, all five bot items');
});
console.log('BOARD PARTY:',tests.length,'suites passed');
