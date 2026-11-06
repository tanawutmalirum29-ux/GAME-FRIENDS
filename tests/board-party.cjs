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
function steer(s,p,to=s.move?.to||s.map.nodes[p.currentNodeId].nextNodes[0]){
 const a=s.map.nodes[p.currentNodeId].position,b=s.map.nodes[to].position,d=Math.hypot(b.x-a.x,b.y-a.y);
 press(s,p,null,{axisX:(b.x-a.x)/d,axisY:(b.y-a.y)/d});
}
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
  assert.equal(P.remainingSteps(s,P.current(s)?.id),0,'initial order has no active walker');
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
test('Fresh turn token accepts A/B despite old pressed state',()=>{
 const s=game(2,122),p=s.players[0];
 const oldTurn=s.turnId;
 assert.equal(P.input(s,p.id,{turnId:oldTurn,actionId:1,keys:{action:true}}),true);
 assert.equal(s.players[0].dice.length,2);
 s.order=[p.id,s.players[1].id];s.turnIndex=0;
 P.startTurn(s);
 const newTurn=s.turnId;
 assert.notEqual(newTurn,oldTurn);
 assert.equal(P.input(s,p.id,{turnId:newTurn,actionId:2,keys:{action:true}}),true);
 assert.equal(s.phase,'dice','new A press must roll immediately, even if old A was held');
 assert.equal(P.input(s,p.id,{turnId:newTurn,actionId:3,keys:{action:true}}),true);
 assert.equal(s.phase,'dice','same turn repeated held A cannot trigger again');
 assert.equal(P.input(s,p.id,{turnId:oldTurn,actionId:4,keys:{alt:true}}),false);
});
test('Board clock uses true elapsed time with bounded steps even at low FPS',()=>{
 const source=fs.readFileSync('app.js','utf8');
 assert.match(source,/const boardDt=Math\.min\(1,elapsed\)/);
 assert.match(source,/updateRound\(round\.mode==='board'\?boardDt:dt\)/);
 assert.match(source,/updateGameSelection\(boardSession\?boardDt:dt\)/,
  'board-to-minigame roulette should advance in real time');
 assert.match(source,/denseBoard\?2\.4:MAX_ARENA_SCALE/,
  'dense board should limit Canvas bitmap memory without affecting minigames');
 assert.match(source,/for\(let ticks=0;ticks<20&&pending>1e-6;ticks\+\+\)/);
 function advance(s,frameSeconds){
  let pending=Math.max(0,Math.min(1,frameSeconds));
  for(let count=0;count<20&&pending>1e-6;count++){
   const step=Math.min(.05,pending);P.update(s,step);pending-=step;
  }
 }
 const s=game(1,7);s.players[0].isBot=false;
 for(let frame=0;frame<60;frame++)advance(s,.2);
 assert.ok(Math.abs(s.time-12)<.001,'5 FPS must advance twelve game seconds in twelve real seconds');
 assert.equal(s.players[0].dice.length,2,'order timeout must resolve even on low FPS');
});
test('Two independent dice: all 36 combinations move the exact sum, landing effect once',()=>{
 for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
  const s=ready(),rolls=[a,b];s.rng=()=> (rolls.shift()-.5)/6;const p=s.players[0];
  for(const n of Object.values(s.map.nodes))if(!['start','finish'].includes(n.type))n.type='danger';
  press(s,p,'A');assert.deepEqual(plain(s.moveDice),[a,b]);assert.equal(s.die,a+b);let last='n0',steps=0;
  until(s,()=>{if(p.currentNodeId!==last){assert.ok(s.map.nodes[last].nextNodes.includes(p.currentNodeId));steps++;last=p.currentNodeId;}if(s.move){assert.equal(s.move.auto,false);steer(s,p);}return s.phase==='effect';});
  assert.equal(steps,a+b);assert.equal(p.hp,2);tick(s,.1);assert.equal(p.hp,2);
 }
});
test('Directional walking: release stops mid-edge, A/B cannot move, counts only completed edges',()=>{
 const s=ready(),p=s.players[0];p.item='rocket';s.rng=()=>0;
 press(s,p,'A',{axisX:1});const oldToken=s.turnId;assert.equal(P.remainingSteps(s,p.id),0);
 tick(s,1);assert.equal(P.remainingSteps(s,p.id),2);until(s,()=>s.phase==='move_ready');
 tick(s,1);assert.equal(p.currentNodeId,'n0');assert.equal(P.remainingSteps(s,p.id),2);
 press(s,p,'A');press(s,p,'B');assert.equal(p.item,'rocket');assert.equal(s.phase,'move_ready');
 assert.equal(P.input(s,p.id,{turnId:oldToken,actionId:(s.lastActions[p.id]??0)+1,keys:{axisX:1}}),false);
 const token=s.turnId;steer(s,p);tick(s,.2);assert.equal(s.phase,'moving');assert.equal(p.currentNodeId,'n0');assert.equal(P.remainingSteps(s,p.id),2);
 const fraction=s.move.t,position=plain(I.position(s,p));assert.ok(fraction>0&&fraction<1);
 press(s,p,null);tick(s,.5);assert.equal(s.move.t,fraction);assert.deepEqual(plain(I.position(s,p)),position);
 for(let i=0;i<5;i++){press(s,p,'A');press(s,p,'B');tick(s,.05);}assert.equal(s.move.t,fraction);assert.equal(p.item,'rocket');
 steer(s,p);until(s,()=>p.currentNodeId==='n1');assert.equal(P.remainingSteps(s,p.id),1);assert.equal(s.turnId,token);
 tick(s,.05);assert.equal(s.phase,'moving','held direction continues across a node without A or a new token');
 until(s,()=>{if(s.move)steer(s,p);return s.phase==='effect';});assert.equal(p.currentNodeId,'n2');assert.equal(P.remainingSteps(s,p.id),0);
 assert.equal(P.remainingSteps(s,s.players[1].id),0);assert.equal(p.item,'rocket');assert.notEqual(s.turnId,token);
});
test('Direction buttons, reverse/sideways rejection, stale input stop and idle fallback',()=>{
 const s=ready(),p=s.players[0];P.beginMove(s,p,3);
 press(s,p,null,{left:true});tick(s,.5);assert.equal(s.phase,'move_ready');assert.equal(p.currentNodeId,'n0');
 press(s,p,null,{right:true});tick(s,.2);assert.equal(s.phase,'moving');const fraction=s.move.t;
 const a=s.map.nodes.n0.position,b=s.map.nodes.n1.position,dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
 press(s,p,null,{axisX:-dx/d,axisY:-dy/d});tick(s,.3);assert.equal(s.move.t,fraction,'cannot reverse during an edge');
 press(s,p,null,{axisX:-dy/d,axisY:dx/d});tick(s,.3);assert.equal(s.move.t,fraction,'cannot steer off the side of a path');
 steer(s,p);until(s,()=>p.currentNodeId==='n1');press(s,p,null);tick(s,.3);assert.equal(p.currentNodeId,'n1');
 steer(s,p);tick(s,1.1);const stale=plain(I.position(s,p));tick(s,.5);assert.deepEqual(plain(I.position(s,p)),stale,'lost packets stop walking');
 until(s,()=>P.current(s).id!==p.id,20);assert.equal(p.currentNodeId,'n3','idle timeout completes only remaining forward edges');
});
test('Joystick takes a forward branch without A; committed edge cannot be switched or skipped',()=>{
 const s=ready(),p=s.players[0];p.currentNodeId='n3';P.beginMove(s,p,2);assert.equal(s.phase,'branch');
 assert.equal(P.step(s,'n2'),false);assert.equal(P.step(s,'n8'),false);assert.equal(P.step(s,'missing'),false);
 steer(s,p,'b3_1');tick(s,.05);assert.equal(s.phase,'moving');assert.equal(s.move.to,'b3_1');
 assert.equal(P.step(s,'n4'),false,'cannot replace an in-flight edge');
 until(s,()=>{if(s.move)steer(s,p);return s.phase==='effect';});assert.equal(p.currentNodeId,'b3_2');
});
test('300 adversarial walks: no reverse, repeated/skipped nodes, off-path positions or extra steps',()=>{
 for(let seed=0;seed<300;seed++){
  const s=ready(3,seed),p=s.players[0],rng=M.random(seed+99),steps=2+seed%11;p.currentNodeId='n'+(seed%25);
  P.beginMove(s,p,steps);let last=p.currentNodeId,edges=0,prevFraction=0,edge=null,visited=new Set([last]);
  for(let frame=0;frame<10000&&!['effect','finished'].includes(s.phase);frame++){
   if(frame%9<6)steer(s,p);else press(s,p,null,{axisX:rng()*2-1,axisY:rng()*2-1,action:true,alt:true});
   P.update(s,.05);
   if(p.currentNodeId!==last){assert.ok(s.map.nodes[last].nextNodes.includes(p.currentNodeId));assert.ok(!visited.has(p.currentNodeId));visited.add(p.currentNodeId);last=p.currentNodeId;edges++;}
   if(s.move){
    assert.equal(s.move.remaining,steps-edges);assert.ok(edges<=steps);
    if(s.move.to){
     const m=s.move;if(edge===m.from+'>'+m.to)assert.ok(m.t>=prevFraction);edge=m.from+'>'+m.to;prevFraction=m.t;
     assert.ok(I.segmentDistance(I.position(s,p),m.startPosition,m.endPosition)<1e-7,'world hitbox stays on the committed segment');
    }else{edge=null;prevFraction=0;}
   }
  }
  assert.ok(['effect','finished'].includes(s.phase));assert.ok(edges<=steps);if(s.phase!=='finished')assert.equal(edges,steps);
 }
});
test('HP cap, death keeps item/order, clears movement and awards no free roll',()=>{
 const s=ready(),p=s.players[0];p.currentNodeId='n1';p.hp=1;p.item='ufo';s.map.nodes.n2.type='danger';const order=plain(s.order);
 P.beginMove(s,p,1,'rocket');until(s,()=>s.phase==='effect');assert.equal(p.hp,3);assert.equal(p.currentNodeId,'n0');assert.equal(p.item,'ufo');assert.equal(s.effect.next,'end');tick(s,2);assert.equal(P.current(s).id,'p2');assert.deepEqual(plain(s.order),order);
 const q=s.players[2];q.hp=1;q.item='car';q.currentNodeId='n9';P.damage(s,q,1);assert.equal(q.currentNodeId,'n0');assert.equal(q.hp,3);assert.equal(q.item,'car');assert.equal(P.current(s).id,'p2');
});
test('Potion only below max HP, consumes once per round and allows roll',()=>{
 const s=ready(),p=s.players[0];p.item='potion';press(s,p,'B');assert.equal(p.item,'potion');assert.equal(s.phase,'ready');p.hp=1;press(s,p,'B');assert.equal(p.hp,2);assert.equal(p.item,null);until(s,()=>s.phase==='ready');p.item='rocket';press(s,p,'B');assert.equal(p.item,'rocket');press(s,p,'A');assert.equal(s.phase,'dice');
});
test('Shield is a sixth reward item, usable once, still permits two-dice rolling',()=>{
 assert.equal(I.ids.length,6);assert.ok(I.ids.includes('shield'));
 const s=ready(),p=s.players[0];p.item='shield';press(s,p,'B');assert.equal(p.item,null);assert.equal(p.usedRound,1);assert.equal(p.shieldTurns,2);
 until(s,()=>s.phase==='ready');p.item='rocket';press(s,p,'B');assert.equal(p.item,'rocket');assert.equal(s.phase,'ready');
 press(s,p,'A');assert.equal(s.phase,'dice');assert.equal(s.moveDice.length,2);
 p.item='shield';press(s,p,'B');assert.equal(p.item,'shield');
 const t=ready(),q=t.players[0];q.item='shield';q.shieldTurns=1;press(t,q,'B');assert.equal(q.item,'shield');assert.equal(q.usedRound,0);assert.equal(q.shieldTurns,1);
});
test('Shield blocks danger and random damage, keeps HP and node without consuming protection',()=>{
 for(const type of ['danger','event']){
  const s=ready(),p=s.players[0];p.hp=1;p.item='shield';press(s,p,'B');until(s,()=>s.phase==='ready');
  p.currentNodeId='n1';s.map.nodes.n2.type=type;s.rng=()=>.99;P.beginMove(s,p,1,'rocket');until(s,()=>s.phase==='effect');
  assert.equal(s.effect.kind,'shield');assert.equal(p.hp,1);assert.equal(p.currentNodeId,'n2');assert.equal(p.shieldTurns,2);
  P.damage(s,p,3);assert.equal(p.hp,1);assert.equal(p.shieldTurns,2);assert.ok(p.blockedUntil>s.time);
 }
});
test('100 protected attacks each: UFO cannot swap, bomber/car hit unprotected neighbours only',()=>{
 for(let seed=0;seed<100;seed++)for(const kind of ['ufo','bomber','car']){
  const s=ready(3,seed),[p,q,r]=s.players;p.item=kind;q.hp=1;q.shieldTurns=1;q.currentNodeId='n1';r.currentNodeId='n1';
  press(s,p,'B');
  if(kind==='ufo'){
   Object.assign(s.skill,I.position(s,q));press(s,p,'A');assert.equal(s.phase,'aim');assert.equal(p.item,'ufo');assert.equal(p.currentNodeId,'n0');assert.equal(q.currentNodeId,'n1');assert.equal(p.usedRound,0);
   Object.assign(s.skill,I.position(s,r));press(s,p,'A');assert.equal(p.currentNodeId,'n1');assert.equal(r.currentNodeId,'n0');
  }else{
   if(kind==='bomber'){Object.assign(s.skill,I.position(s,q));press(s,p,'A');}else until(s,()=>s.phase==='effect');
   assert.equal(r.hp,2);assert.equal(p.item,null);assert.equal(s.effect.next,'end');
  }
  assert.equal(q.hp,1);assert.equal(q.currentNodeId,'n1');assert.equal(q.shieldTurns,1);
 }
});
test('Shield lasts through intermission/reordering until its owner completes their next turn',()=>{
 const s=ready(),[p,q,r]=s.players;p.item='shield';press(s,p,'B');until(s,()=>s.phase==='ready');
 P.endTurn(s);assert.equal(p.shieldTurns,1);assert.equal(P.current(s),q);P.damage(s,p,1);assert.equal(p.hp,3);
 P.endTurn(s);assert.equal(p.shieldTurns,1);assert.equal(P.current(s),r);P.endTurn(s);assert.equal(p.shieldTurns,1);
 P.minigameStarted(s,'chickens');P.minigameEnded(s,[{id:r.id,rank:1},{id:p.id,rank:2},{id:q.id,rank:3}]);until(s,()=>s.phase==='ready');
 assert.equal(P.current(s),r);assert.equal(p.shieldTurns,1);P.endTurn(s);assert.equal(P.current(s),p);assert.equal(p.shieldTurns,1);
 P.damage(s,p,1);assert.equal(p.hp,3);P.endTurn(s);assert.equal(p.shieldTurns,0);P.damage(s,p,1);assert.equal(p.hp,2);
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
 assert.equal(G.ranking({mode:'shockwave',shockwave:{winnerId:'p1'}},list)[1].label,'ตกรอบชุดที่ 7','elimination event is not mislabeled as a wave number');
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
test('Next-round order follows actual minigame ranks; tied players retain prior relative order',()=>{
 const s=ready(4);s.order=['p3','p2','p1','p4'];s.turnIndex=3;const before=plain(s.order);
 P.phase(s,'minigame_pending');P.minigameStarted(s,'chickens');
 const results=[{id:'p4',rank:1,label:'15 คะแนน'},{id:'p1',rank:2,label:'12 คะแนน'},{id:'p2',rank:2,label:'12 คะแนน'},{id:'p3',rank:4,label:'7 คะแนน'}];
 P.minigameEnded(s,results);assert.deepEqual(plain(s.order),before);assert.deepEqual(plain(s.nextOrder),['p4','p2','p1','p3']);
 assert.deepEqual(plain(s.results.map(r=>r.rank)),[1,2,2,4]);assert.equal(s.results.filter(r=>r.reward).length,2);
 until(s,()=>s.phase==='round_order');assert.deepEqual(plain(s.order),['p4','p2','p1','p3']);assert.equal(s.roundNumber,2);
 until(s,()=>s.phase==='ready');assert.equal(P.current(s).id,'p4');assert.equal(s.rolled,false);
 assert.ok(s.players.every(p=>p.dice===null),'no new order roll after a minigame');
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
  const s=game(n,seed,true),map=s.map;let order=null,nextOrder=null;
  for(let frame=0;frame<80000&&s.phase!=='finished';frame++){
   const phase=s.phase,item=P.current(s)?.item;P.update(s,.1);
   if(s.phase==='order_result')order=plain(s.order);
   if(s.phase==='round_order'){order=nextOrder;assert.ok(order);}
   if(phase==='ready'&&['aim','car','moving','effect'].includes(s.phase)&&item)used.add(item);
   if(s.phase==='minigame_pending'){
    const hp=s.players.map(p=>p.hp),positions=s.players.map(p=>p.currentNodeId);P.minigameStarted(s,'chickens');
    const r=G.ranking({mode:'chickens'},s.players.map(p=>({...p,active:true,score:Math.floor(s.rng()*5)})));P.minigameEnded(s,r);rounds++;
    nextOrder=[...order].sort((a,b)=>r.find(p=>p.id===a).rank-r.find(p=>p.id===b).rank);
    assert.deepEqual(s.players.map(p=>p.hp),hp);assert.deepEqual(s.players.map(p=>p.currentNodeId),positions);
   }
   assert.equal(s.map,map);if(order)assert.deepEqual(plain(s.order),order);
   for(const p of s.players)assert.ok(p.hp>=1&&p.hp<=3&&s.map.nodes[p.currentNodeId]);
  }
  assert.equal(s.phase,'finished','session n='+n+' seed='+seed);assert.equal(s.winnerIds.length,1);assert.equal(s.players.find(p=>p.id===s.winnerIds[0]).currentNodeId,s.map.finishId);games++;
 }
 assert.equal(used.size,6);console.log('  Completed',games,'sessions,',rounds,'board rounds, all six bot items');
});
console.log('BOARD PARTY:',tests.length,'suites passed');
