'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({window:{},console});
for(const f of ['board-map','board-dice','board-items','board-bots','board-minigame','board-party'])vm.runInContext(fs.readFileSync('src/board-party/runtime/'+f+'.js','utf8'),ctx,{filename:f+'.js'});
const {BoardMap:M,BoardDice:D,BoardItems:I,BoardParty:P,BoardMinigame:G}=ctx.window;
const plain=x=>JSON.parse(JSON.stringify(x));
const roster=(n,bots=false)=>Array.from({length:n},(_,i)=>({id:'p'+(i+1),name:'Player '+(i+1),color:'#66aacc',isBot:bots}));
// The BOARD adapter must consume the game-owned result contract, never
// reproduce individual game formulas or depend on an ID whitelist.
const scoreProvider={getResult(round,ps){return ps.filter(p=>p.active).map(p=>({
 id:p.id,value:Number(p.score)||0,label:(Number(p.score)||0)+' คะแนน'
}));}};
const game=(n=3,seed=42,bots=false)=>{
 const s=P.create(roster(n,bots),{seed,rng:M.random(seed)});
 assert.equal(s.phase,'overview');
 assert.equal(P.startOrder(s),true);
 assert.equal(s.phase,'intro_zoom');
 for(let i=0;i<30;i++)P.update(s,.05);
 assert.equal(s.phase,'order','new games begin dice ordering automatically');
 return s;
};
const tick=(s,seconds)=>{for(let i=0;i<Math.ceil(seconds/.05);i++)P.update(s,.05);};
const until=(s,pred,seconds=100)=>{for(let i=0;i<seconds/.05;i++){if(pred())return;P.update(s,.05);}assert.fail('Timeout '+s.phase+' at '+s.time);};
function ready(n=3,seed=42){const s=game(n,seed);s.order=s.players.map(p=>p.id);P.startTurn(s);return s;}
function press(s,p,key,extra={}){
 const send=keys=>P.input(s,p.id,{turnId:s.turnId,actionId:(s.lastActions[p.id]??0)+1,keys});
 // Historical test scenarios calling B to "use item" emulate B-select then
 // A-confirm. Dedicated selector tests below exercise raw phone input instead.
 if(key==='B'&&s.phase==='ready'&&I.bag(p).length){
  p.actionIndex=0;
  send(extra);send({...extra,alt:true});
  send(extra);const result=send({...extra,action:true});
  if(s.phase==='ready')p.actionIndex=0;
  return result;
 }
 send(extra);
 return send({...extra,action:key==='A',alt:key==='B',cancel:key==='C'});
}
// A real joystick tick arms UFO targeting; fixtures then position the cursor
// on a named player without bypassing the A-release and aim-movement rules.
function aimUfoAt(s,p,q){
 assert.equal(s.phase,'aim');
 const send=keys=>P.input(s,p.id,{turnId:s.turnId,actionId:(s.lastActions[p.id]??0)+1,keys});
 send({axisX:1});P.update(s,.05);send({});
 assert.ok(s.skill.aimTravel>=I.UFO_AIM_TRAVEL_MIN,'UFO cursor physically moved before confirmation');
 Object.assign(s.skill,I.position(s,q));
 s.skill.targetId=I.target(s,s.skill,p)?.id||null;
}
function steer(s,p,to=s.move?.to||s.map.nodes[p.currentNodeId].nextNodes[0]){
 const a=s.map.nodes[p.currentNodeId].position,b=s.map.nodes[to].position,d=Math.hypot(b.x-a.x,b.y-a.y);
 press(s,p,null,{axisX:(b.x-a.x)/d,axisY:(b.y-a.y)/d});
}
const tests=[];function test(name,fn){fn();tests.push(name);console.log('PASS',name);}
test('1,000 seeds: connected DAG, reciprocal edges, all branches finish',()=>{
 for(let seed=0;seed<1000;seed++){
  const map=M.create(seed);assert.equal(M.validate(map),true);
  // This winter board keeps its topology, but never rolls legacy inactive
  // event/key/neutral nodes. Other maps retain their support code.
  assert.ok(Object.values(map.nodes).every(n=>!['event','key','neutral'].includes(n.type)),
    'Winter map contains no unused tiles for seed '+seed);
  assert.ok(Object.values(map.nodes).every(n=>['start','finish','movement','healing','danger','lucky','sword'].includes(n.type)),
    'Every winter tile has a supported role for seed '+seed);
  for(const n of Object.values(map.nodes)){
   assert.ok(n.position&&n.effects&&n.type);let at=n,steps=0;
   while(at.id!==map.finishId){assert.ok(at.nextNodes.length);const next=map.nodes[at.nextNodes[seed%at.nextNodes.length]];assert.ok(next.progress>at.progress);at=next;assert.ok(++steps<=map.nodes[map.startId].longestRemainingSteps);}
  }
 }
});
test('Both human and bot games show the panorama for 2s, then zoom to START without A',()=>{
 for(const botsOnly of [false,true]){
  const s=P.create(roster(botsOnly?12:3,botsOnly),{seed:37,rng:M.random(37)});
  tick(s,1.95);assert.equal(s.phase,'overview','panorama stays for two seconds');
  assert.equal(s.deadline,Infinity);
  assert.ok(s.players.every(p=>p.dice===null));
  assert.equal(P.beginOrder(s),false);
  tick(s,.05);assert.equal(s.phase,'intro_zoom','no controller A required');
  assert.equal(P.startOrder(s),false,'duplicate start cannot restart camera');
  tick(s,1.45);assert.equal(s.phase,'intro_zoom');
  tick(s,.05);assert.equal(s.phase,'order','order starts automatically');
  assert.ok(s.players.every(p=>p.dice===null),'human dice are not rolled for them');
 }
});
test('1–12 players: manual A/B order rolls, no human timeout, double-input protection',()=>{
 for(let n=1;n<=12;n++){
  const s=game(n);for(let i=0;i<n-1;i++)press(s,s.players[i],i%2?'A':'B');
  assert.equal(P.remainingSteps(s,P.current(s)?.id),0,'initial order has no active walker');
  const first=plain(s.players[0].dice);if(n>1){press(s,s.players[0],'A');assert.deepEqual(plain(s.players[0].dice),first);}
  tick(s,17);
  assert.equal(s.phase,'order','unrolled human must never be forced to throw after 12 seconds');
  assert.equal(s.players[n-1].dice,null,'last human remains unrolled until input');
  press(s,s.players[n-1],'A');tick(s,2.5);
  assert.equal(s.order.length,n);
  assert.ok(s.players.every(p=>p.dice.length===2&&p.dice.every(v=>v>=1&&v<=6)));
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
 assert.equal(P.input(s,p.id,{turnId:newTurn,actionId:3,keys:{action:true}}),false,'ready token expires after moving to dice');
 assert.equal(s.phase,'dice','stale press cannot trigger a second roll');
 assert.equal(P.input(s,p.id,{turnId:oldTurn,actionId:4,keys:{alt:true}}),false);
});
test('Board clock uses true elapsed time with bounded steps even at low FPS',()=>{
 const source=fs.readFileSync('app.js','utf8');
 assert.match(source,/const boardDt=Math\.min\(1,elapsed\)/);
 assert.match(source,/updateRound\(round\.mode==='board'\?boardDt:dt\)/);
 assert.match(source,/if\(boardSession&&round\.mode==='board'\)return/,
  'late duplicate end callbacks must not show a second normal results page');
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
 const start=s.time;
 for(let frame=0;frame<60;frame++)advance(s,.2);
 assert.ok(Math.abs(s.time-start-12)<.001,'5 FPS must advance twelve game seconds in twelve real seconds');
 assert.equal(s.phase,'order','real-time clock must not force human dice rolls');
 assert.equal(s.players[0].dice,null,'human can wait past 12 seconds even at low FPS');
 press(s,s.players[0],'A');tick(s,2.5);assert.equal(s.players[0].dice.length,2);
});
test('Human turn stays ready indefinitely; only a real action rolls dice',()=>{
 const s=ready(3),p=s.players[0],original=s.players.map(v=>v.currentNodeId);
 assert.equal(s.deadline,Infinity);
 tick(s,75);
 assert.equal(s.phase,'ready','no 12s forced roll even after 75s');
 assert.equal(s.die,null);
 assert.equal(s.moveDice,null);
 assert.deepEqual(s.players.map(v=>v.currentNodeId),original);
 assert.equal(P.controls(s,p.id).a,'ทอยลูกเต๋า');
 assert.equal(P.action(s,p.id,'A'),true);
 assert.equal(s.phase,'dice');
 assert.equal(s.moveDice.length,2);
});
test('Contextual board button labels distinguish roll, use, aim and A/B/C target actions',()=>{
 const s=ready(3,497),p=s.players[0];
 const label=()=>plain(P.controls(s,p.id));
 assert.equal(label().a,'ทอยลูกเต๋า');
 assert.equal(label().b,'เปลี่ยนไอเทม');
 I.add(p,'shield');p.actionIndex=I.ids.indexOf('shield')+1;
 assert.equal(label().a,'ใช้ไอเทม');
 I.add(p,'bomber');p.actionIndex=I.ids.indexOf('bomber')+1;
 assert.equal(label().a,'เล็งเป้า');
 assert.equal(P.action(s,p.id,'A'),true);
 assert.equal(s.phase,'aim');
 assert.deepEqual([label().a,label().b,label().c],
  ['ยืนยันโจมตี','หมุน 45°','ยกเลิก']);
 assert.equal(P.action(s,p.id,'C'),true);
 p.item='ufo';p.actionIndex=I.ids.indexOf('ufo')+1;
 assert.equal(label().a,'เล็งเป้า');
 assert.equal(P.action(s,p.id,'A'),true);
 assert.equal(s.phase,'aim');
 assert.deepEqual([label().a,label().b,label().c],
  ['ยืนยันสลับ','ไม่ใช้','ยกเลิก']);
 assert.equal(P.action(s,p.id,'C'),true);
 assert.equal(s.phase,'ready');
 assert.equal(p.usedRound,0,'canceling the aim does not consume an item');
});
test('Bot order still progresses without human auto-roll timeout',()=>{
 const s=game(4,1777,true);
 assert.equal(s.phase,'order');
 tick(s,3.5);
 assert.ok(s.players.every(p=>p.dice&&p.dice.length===2));
 assert.ok(s.order.length===4,'all bots determine their order by AI');
});
test('B cycles [Roll, inventory], A activates selected action; no bag popup',()=>{
 const s=ready(3),p=s.players[0];p.hp=1;
 I.add(p,'shield');I.add(p,'potion');I.add(p,'rocket');
 const input=keys=>P.input(s,p.id,{turnId:s.turnId,actionId:(s.lastActions[p.id]??0)+1,keys});
 const tap=button=>{input({});return input({action:button==='A',alt:button==='B'});};
 assert.equal(p.actionIndex,0);
 assert.equal(P.controls(s,p.id).a,'ทอยลูกเต๋า');
 assert.equal(P.controls(s,p.id).b,'เปลี่ยนไอเทม');
 tap('B');assert.equal(p.actionIndex,1,'the first B selects potion in fixed type order');
 assert.equal(I.ids[p.actionIndex-1],'potion');
 assert.match(P.controls(s,p.id).help,/Healing Potion/);
 tap('A');assert.equal(p.hp,51);assert.equal(p.usedRound,1);
 assert.deepEqual(plain(p.bag),['shield','rocket']);assert.equal(s.phase,'effect');
 until(s,()=>s.phase==='ready');
 assert.equal(P.current(s).id,p.id,'potion returns to the same owner for a manual dice roll');
 assert.equal(p.actionIndex,0,'after a used item only Roll is selected');
 assert.deepEqual(plain(I.availableSlots(p,s.roundNumber)),[0],'all item options are locked for the round');
 assert.deepEqual(plain(I.counts(p)),{potion:0,ufo:0,rocket:1,bomber:0,car:0,shield:1},'unused stock remains visible');
 tap('B');assert.equal(p.actionIndex,0,'B cannot select another item after use');
 p.actionIndex=3;assert.equal(P.action(s,p.id,'A'),false,'forged selection cannot reuse an item');
 p.actionIndex=0;tap('A');
 assert.equal(s.phase,'dice','owner explicitly presses A to throw dice after using potion');
 assert.equal(s.moveDice.length,2);
 assert.equal(p.bagOpen,false,'popup is never opened');
});
test('Fixed seven-slot item grid counts duplicates and skips zero-stock types',()=>{
 const s=ready(3),p=s.players[0];
 assert.deepEqual(plain(I.availableSlots(p)),[0]);
 assert.deepEqual(plain(I.counts(p)),{potion:0,ufo:0,rocket:0,bomber:0,car:0,shield:0});
 I.add(p,'rocket');I.add(p,'rocket');I.add(p,'shield');I.add(p,'potion');
 assert.deepEqual(plain(I.counts(p)),{potion:1,ufo:0,rocket:2,bomber:0,car:0,shield:1});
 assert.deepEqual(plain(I.availableSlots(p)),[0,1,3,6]);
 assert.equal(P.action(s,p.id,'B'),true);assert.equal(p.actionIndex,1);
 assert.equal(P.action(s,p.id,'B'),true);assert.equal(p.actionIndex,3);
 assert.equal(P.action(s,p.id,'B'),true);assert.equal(p.actionIndex,6);
 assert.equal(P.action(s,p.id,'B'),true);assert.equal(p.actionIndex,0);
 // An out-of-date reconnect cannot activate an empty slot.
 p.actionIndex=2;assert.equal(P.action(s,p.id,'A'),false);
 assert.equal(p.actionIndex,0);assert.match(p.bagMessage,/ไม่มีไอเทม/);
 p.actionIndex=3;assert.equal(P.controls(s,p.id).a,'ใช้ไอเทม');
 const count=I.counts(p).rocket;assert.equal(count,2);
});
test('Two independent dice: all 36 combinations move the exact sum, landing effect once',()=>{
 for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
  const s=ready(),rolls=[a,b];s.rng=()=> (rolls.shift()-.5)/6;const p=s.players[0];
  for(const n of Object.values(s.map.nodes))if(!['start','finish'].includes(n.type))n.type='danger';
  press(s,p,'A');assert.deepEqual(plain(s.moveDice),[a,b]);assert.equal(s.die,a+b);let last='n0',steps=0;
  until(s,()=>{if(p.currentNodeId!==last){assert.ok(s.map.nodes[last].nextNodes.includes(p.currentNodeId));steps++;last=p.currentNodeId;}if(s.move){assert.equal(s.move.auto,false);steer(s,p);}return s.phase==='effect';});
  assert.equal(steps,a+b);assert.equal(p.hp,65);tick(s,.1);assert.equal(p.hp,65);
 }
});
test('Directional walking: release stops mid-edge, A/B cannot move, counts only completed edges',()=>{
 const s=ready(),p=s.players[0];p.item='rocket';s.rng=()=>0;
 press(s,p,'A',{axisX:1});const oldToken=s.turnId;assert.equal(P.remainingSteps(s,p.id),0);
 tick(s,1);assert.equal(P.remainingSteps(s,p.id),0,'no early steps while dice still fly');
  tick(s,.8);assert.equal(P.remainingSteps(s,p.id),2,'steps become visible after dice settle');until(s,()=>s.phase==='move_ready');
 tick(s,1);assert.equal(p.currentNodeId,'n0');assert.equal(P.remainingSteps(s,p.id),2);
 press(s,p,'A');press(s,p,'B');assert.equal(p.item,'rocket');assert.equal(s.phase,'move_ready');
 assert.equal(P.input(s,p.id,{turnId:oldToken,actionId:(s.lastActions[p.id]??0)+1,keys:{axisX:1}}),false);
 const token=s.turnId;steer(s,p);tick(s,.3);assert.equal(s.phase,'moving');assert.equal(p.currentNodeId,'n0');assert.equal(P.remainingSteps(s,p.id),2);
 const fraction=s.move.t,position=plain(I.position(s,p));assert.ok(fraction>0&&fraction<1);
 press(s,p,null);tick(s,.5);assert.equal(s.move.t,fraction);assert.deepEqual(plain(I.position(s,p)),position);
 for(let i=0;i<5;i++){press(s,p,'A');press(s,p,'B');tick(s,.05);}assert.equal(s.move.t,fraction);assert.equal(p.item,'rocket');
 steer(s,p);until(s,()=>{if(s.move)steer(s,p);return p.currentNodeId==='n1';});assert.equal(P.remainingSteps(s,p.id),1);assert.equal(s.turnId,token);
 tick(s,.25);assert.equal(s.phase,'moving','held direction continues across a node without A or a new token');
 until(s,()=>{if(s.move)steer(s,p);return s.phase==='effect';});assert.equal(p.currentNodeId,'n2');assert.equal(P.remainingSteps(s,p.id),0);
 assert.equal(P.remainingSteps(s,s.players[1].id),0);assert.equal(p.item,'rocket');assert.notEqual(s.turnId,token);
});
test('Free 2D walking: reverse and sideways inputs are real movement, no accidental spent steps',()=>{
 const s=ready(),p=s.players[0];P.beginMove(s,p,3);
 const start=plain(I.position(s,p));
 const from=s.map.nodes.n0.position,to=s.map.nodes.n1.position;
 const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy);
 press(s,p,null,{axisX:-dx/d,axisY:-dy/d});tick(s,.5);assert.equal(s.phase,'move_ready');
 assert.ok(Math.hypot(I.position(s,p).x-start.x,I.position(s,p).y-start.y)>5,'can roam at a node');
 press(s,p,null,{axisX:dx/d,axisY:dy/d});tick(s,.25);assert.equal(s.phase,'moving');
 const fraction=s.move.t,remaining=s.move.remaining;
 press(s,p,null,{axisX:-dy/d,axisY:dx/d});tick(s,.2);
 assert.ok(Math.abs(s.move.lateral)>2,'can walk sideways within a bounded lane');
 assert.equal(s.move.remaining,remaining);
 press(s,p,null,{axisX:-dx/d,axisY:-dy/d});tick(s,.3);
 assert.ok(s.phase==='move_ready'||s.move.t<fraction,'reversing must recover a slightly premature turn');
 assert.equal(s.move.remaining,remaining,'reversing cannot spend extra dice');
 steer(s,p);until(s,()=>{if(s.move)steer(s,p);return p.currentNodeId==='n1';});assert.equal(s.move.remaining,2);
 press(s,p,null);tick(s,.2);
 if(s.phase==='moving'&&!s.move.auto){
  const stale=plain(I.position(s,p));tick(s,.3);
  assert.deepEqual(plain(I.position(s,p)),stale,'released stick stops mid-edge');
 }
 const parked=plain(I.position(s,p)),steps=s.move.remaining,phase=s.phase;
 tick(s,35);
 assert.equal(s.phase,phase,'idle player must remain in the same movement phase indefinitely');
 assert.equal(s.move.remaining,steps,'idle player must not spend dice steps');
 assert.deepEqual(plain(I.position(s,p)),parked,'no automatic movement after 35 seconds');
 assert.equal(s.move.auto,false,'no assisted walk may be enabled');
 until(s,()=>{if(s.move)steer(s,p);return s.phase==='effect';},30);
 assert.equal(p.currentNodeId,'n3','resuming the joystick completes only manual steps');
});
test('Player can reach the inner edge of an 88-unit road and circular pad without skipping steps',()=>{
 const s=ready(3,608),p=s.players[0];
 P.beginMove(s,p,3);
 const from=s.map.nodes.n0.position,to=s.map.nodes.n1.position;
 const dist=Math.hypot(to.x-from.x,to.y-from.y);
 const direction={x:(to.x-from.x)/dist,y:(to.y-from.y)/dist};
 const side={x:-direction.y,y:direction.x};
 // Stay on the circular pad: a perpendicular joystick must not automatically
 // choose a forward road or spend any of the dice.
 press(s,p,null,{axisX:side.x,axisY:side.y});
 tick(s,.15);
 assert.equal(s.phase,'move_ready');
 const pad=I.position(s,p);
 assert.ok(Math.hypot(pad.x-from.x,pad.y-from.y)>30,
  'player can approach the outer tile rim, not stop after only 18 units');
 assert.ok(Math.hypot(pad.x-from.x,pad.y-from.y)<=34.001);
 assert.equal(s.move.remaining,3,'pad exploration never consumes a step');
 // A normal chosen segment must allow the same near-edge movement. Its
 // centre is not the only valid walking line.
 assert.equal(P.step(s,'n1'),true);
 press(s,p,null,{axisX:direction.x,axisY:direction.y});
 tick(s,.18);
 assert.equal(s.move.to,'n1');
 press(s,p,null,{axisX:side.x,axisY:side.y});
 tick(s,.26);
 assert.ok(Math.abs(s.move.lateral)>=32,'can reach a road shoulder');
 assert.ok(Math.abs(s.move.lateral)<=34.001,'cannot walk outside the visual deck');
 assert.equal(s.move.remaining,3,'sideways travel does not consume a dice step');
 const edge=I.position(s,p);
 assert.ok(I.segmentDistance(edge,from,to)<=34.001,
  'avatar remains inside the road while hugging its edge');
 // Turning forward again keeps the same lateral position instead of
 // snapping the character back to the road's centre line.
 const before=s.move.lateral;
 press(s,p,null,{axisX:direction.x,axisY:direction.y});
 P.update(s,.05);
 assert.ok(Math.abs(s.move.lateral-before)<.01,
  'continuing forward preserves a chosen road shoulder');
});

test('Early fork can be changed without consuming a die step or jumping over nodes',()=>{
 const s=ready(),p=s.players[0];p.currentNodeId='n3';P.beginMove(s,p,2);assert.equal(s.phase,'branch');
 assert.equal(P.step(s,'n2'),false);assert.equal(P.step(s,'n8'),false);assert.equal(P.step(s,'missing'),false);
 steer(s,p,'b3_1');tick(s,.25);assert.equal(s.phase,'moving');assert.equal(s.move.to,'b3_1');
 const to=s.map.nodes.n4.position,from=s.map.nodes.n3.position;
 const dist=Math.hypot(to.x-from.x,to.y-from.y);
 press(s,p,null,{axisX:(to.x-from.x)/dist,axisY:(to.y-from.y)/dist});tick(s,.3);
 assert.equal(s.move.remaining,2,'changing a partially entered branch must not cost dice');
 assert.ok(['n4','b3_1',null].includes(s.move.to),'only valid outgoing branches may be selected');
 until(s,()=>{if(s.move)steer(s,p);return s.phase==='effect';});
 assert.ok(s.map.nodes[p.currentNodeId].progress>3,'legal forward steps were completed');
});
test('Near n3 upper junction: a late upward turn stays possible without snapping or dice loss',()=>{
 const s=ready(3,303),p=s.players[0];
 p.currentNodeId='n3';P.beginMove(s,p,4);
 assert.equal(P.step(s,'n4'),true);
 s.move.t=.52;s.move.lateral=-15;
 const oldPosition=plain(I.position(s,p)),oldRemaining=s.move.remaining;
 const target=s.map.nodes.b3_1.position,delta={x:target.x-oldPosition.x,y:target.y-oldPosition.y};
 const distance=Math.hypot(delta.x,delta.y);
 assert.ok(distance>50&&distance<200,'screenshot shows the player already off the fork center');
 press(s,p,null,{axisX:delta.x/distance,axisY:delta.y/distance});
 P.update(s,.05);
 assert.equal(s.move.to,'b3_1','upper branch can be selected while still inside rounded junction');
 const afterSwitch=plain(I.position(s,p));
 assert.ok(Math.hypot(afterSwitch.x-oldPosition.x,afterSwitch.y-oldPosition.y)<.0001,
  'branch switch must never teleport the avatar to the other lane');
 assert.equal(s.move.remaining,oldRemaining,'switch does not consume or add a dice step');
 assert.ok(Math.abs(s.move.lateral)>18,'reprojection preserves the world position');
 let before=afterSwitch;
 for(let i=0;i<11;i++){
  press(s,p,null,{axisX:delta.x/distance,axisY:delta.y/distance});
  P.update(s,.05);
  const now=I.position(s,p);
  assert.ok(Math.hypot(now.x-before.x,now.y-before.y)<=27,
   'one 50ms tick cannot snap the player sideways across the fork');
  before=plain(now);
 }
 assert.ok(s.move.remaining<=oldRemaining,'valid progress still counts real nodes');
 assert.ok(s.move.visited.every((id,i,list)=>i===0||s.map.nodes[list[i-1]].nextNodes.includes(id)));
});
test('300 adversarial 2D walks: legal graph edges, finite positions, bounded paths and dice',()=>{
 for(let seed=0;seed<300;seed++){
  const s=ready(3,seed),p=s.players[0],rng=M.random(seed+99),steps=2+seed%11;
  p.currentNodeId='n'+(seed%25);P.beginMove(s,p,steps);
  let last=p.currentNodeId,edges=0,visited=new Set([last]);
  for(let frame=0;frame<10000&&!['effect','finished'].includes(s.phase);frame++){
   if(frame%9<6)steer(s,p);else press(s,p,null,{axisX:rng()*2-1,axisY:rng()*2-1,action:true,alt:true});
   P.update(s,.05);
   if(p.currentNodeId!==last){
    assert.ok(s.map.nodes[last].nextNodes.includes(p.currentNodeId));
    assert.ok(!visited.has(p.currentNodeId));visited.add(p.currentNodeId);
    last=p.currentNodeId;edges++;
   }
   if(s.move){
    assert.equal(s.move.remaining,steps-edges);assert.ok(edges<=steps);
    const pos=I.position(s,p);assert.ok(Number.isFinite(pos.x)&&Number.isFinite(pos.y));
    if(s.move.to&&s.move.kind==='walk'){
     const isRoundedFork=s.map.nodes[s.move.from]?.nextNodes.length>1;
     const maxOffset=isRoundedFork?86:50;
     assert.ok(Math.abs(s.move.lateral||0)<=maxOffset+.001,
      'rounded branch junction allows a gradual turn without teleporting across the road');
     assert.ok(I.segmentDistance(pos,s.move.startPosition,s.move.endPosition)<=maxOffset+1,
      '2D walking stays within the wider curved junction or the normal safe corridor');
    }
    if(!s.move.to&&s.move.kind==='walk')
     assert.ok(Math.hypot(s.move.nodeOffset.x,s.move.nodeOffset.y)<=55.001);
   }
  }
  assert.ok(['effect','finished'].includes(s.phase),'every walk finishes even if stick is abandoned');
  assert.ok(edges<=steps);if(s.phase!=='finished')assert.equal(edges,steps);
 }
});
test('No auto walk after 90 seconds before the first step or at a fork',()=>{
 for(const id of ['n0','n3']){
  const s=ready(3,id==='n0'?785:786),p=s.players[0];
  p.currentNodeId=id;
  P.beginMove(s,p,3);
  const before=plain(I.position(s,p)),turn=s.turnId;
  assert.ok(['move_ready','branch'].includes(s.phase));
  tick(s,90);
  assert.equal(p.currentNodeId,id);
  assert.deepEqual(plain(I.position(s,p)),before);
  assert.equal(s.move.remaining,3);
  assert.equal(s.move.auto,false);
  assert.equal(s.camera.explore,true,'map exploration must stay available without a timer');
  assert.equal(s.turnId,turn,'idle movement must not invalidate the current turn token');
  assert.equal(s.deadline,Infinity,'manual walk has no deadline');
  assert.equal(P.controls(s,p.id).a,'เริ่มเดิน');
 }
});
test('No auto walk after joystick packets expire in the middle of a bridge',()=>{
 const s=ready(3,787),p=s.players[0];p.currentNodeId='n9';
 P.beginMove(s,p,2);
 steer(s,p,'n10');
 until(s,()=>s.phase==='moving',2);
 for(let i=0;i<4;i++)P.update(s,.05);
 press(s,p,null);
 const stopped=plain(I.position(s,p)),progress=s.move.t,steps=s.move.remaining,turn=s.turnId;
 tick(s,90);
 assert.equal(s.phase,'moving');
 assert.deepEqual(plain(I.position(s,p)),stopped);
 assert.equal(s.move.t,progress);
 assert.equal(s.move.remaining,steps);
 assert.equal(s.turnId,turn);
 assert.equal(s.move.auto,false);
});
test('After the dice roll, camera can explore until A or first walking input',()=>{
 const s=ready(3,510),p=s.players[0];
 press(s,p,'A');until(s,()=>s.phase==='move_ready');
 assert.equal(s.camera.explore,true);
 assert.equal(s.move.started,false);
 assert.equal(P.controls(s,p.id).a,'เริ่มเดิน');
 press(s,p,'A');
 assert.equal(s.move.started,true);
 assert.equal(s.camera.explore,false);
 assert.equal(s.phase,'move_ready');
 steer(s,p);tick(s,.25);assert.equal(s.phase,'moving');
 const t=ready(3,511),q=t.players[0];
 P.beginMove(t,q,2);
 steer(t,q);tick(t,.05);
 assert.equal(t.move.started,true);
 assert.equal(t.camera.explore,false,'first joystick walk should relock the camera');
});
test('Walking on a water bridge remains inside its deck and does not snap to the checkpoint centre',()=>{
 const s=ready(3,512),p=s.players[0];
 const [fromId,toId]=s.map.bridges[0];p.currentNodeId=fromId;
 const a=s.map.nodes[fromId].position,b=s.map.nodes[toId].position;
 assert.notEqual(s.map.nodes[fromId].islandId,s.map.nodes[toId].islandId,'bridge crosses between islands');
 P.beginMove(s,p,2);
 const d=Math.hypot(b.x-a.x,b.y-a.y),forward={x:(b.x-a.x)/d,y:(b.y-a.y)/d};
 press(s,p,null,{axisX:forward.x,axisY:forward.y});until(s,()=>s.phase==='moving',3);
 // Step sideways, then travel forward while retaining the offset on the bridge.
 press(s,p,null,{axisX:-forward.y,axisY:forward.x});tick(s,.12);
 assert.ok(Math.abs(s.move.lateral)>5,'walking sideways should be possible ON the bridge');
 const lateral=s.move.lateral;
 press(s,p,null,{axisX:forward.x,axisY:forward.y});
 let last=plain(I.position(s,p)),crossed=false;
 for(let i=0;i<100&&!crossed;i++){
  // Controller axis packets expire after 0.9s, just like on real devices.
  if(i%8===0)press(s,p,null,{axisX:forward.x,axisY:forward.y});
  P.update(s,.05);
  const pos=I.position(s,p);
  assert.ok(Math.hypot(pos.x-last.x,pos.y-last.y)<25,'must not teleport toward pad centre');
  if(p.currentNodeId===fromId){
   assert.ok(I.segmentDistance(pos,a,b)<=34.001,'walker remains within the physical width of the bridge');
  }else{
   crossed=true;
   assert.equal(p.currentNodeId,toId);
   assert.ok(Math.abs(pos.x-b.x)+Math.abs(pos.y-b.y)>5,'crossing a checkpoint retains side offset');
   assert.ok(Math.abs(Math.hypot(pos.x-b.x,pos.y-b.y)-Math.abs(lateral))<2,'side offset survives');
  }
  last=plain(pos);
 }
 assert.ok(crossed,'crosses the bridge normally');
 assert.equal(s.move.remaining,1,'one graph edge consumes exactly one die step');
});

test('152-step winter map preserves requested tiles plus n42 star and 11 linked sword pairs',()=>{
 const pairs=[['n14','n15'],['n43','n44'],['b33_9','b33_10'],['n27','n28'],['n59','n60'],['n69','n70'],
  ['n85','n86'],['c76_10','c76_11'],['n103','n104'],
  ['n124','n125'],['n137','n138']];
 const danger=['n5','n49','n120','n148'];
 const arrows=['n20','n21','n71','n113'];
 const swords=pairs.flat();
 for(const seed of [1,42,2026,999]){
  const map=M.create(seed);
  assert.equal(map.length,152);assert.equal(map.finishId,'n152');
  assert.ok(map.islands.length>=7&&map.width>5000&&map.height>3000);
  assert.equal(map.version,'winter-expedition-152-v6');
  assert.deepEqual(plain(M.SWORD_TILES),swords);
  assert.deepEqual(plain(M.SWORD_PAIRS.map(p=>p.nodeIds)),pairs);
  assert.equal(Object.keys(map.territories).length,11);
  assert.equal(map.nodes.n42.type,'lucky');
  assert.deepEqual(plain(map.nodes.n42.effects),{item:true});
  assert.ok(map.luckyTileIds.includes('n42'),'Lucky Star has moved one step earlier');
  assert.ok(!map.luckyTileIds.includes('n43'),'n43 is now a sword not a reward');
  for(const id of danger){
   assert.equal(map.nodes[id].type,'danger',id);
   assert.deepEqual(plain(map.nodes[id].effects),{hp:-35},id);
  }
  for(const id of arrows){
   assert.equal(map.nodes[id].type,'movement',id);
   assert.deepEqual(plain(map.nodes[id].effects),{},id);
   assert.equal(map.nodes[id].territoryId,undefined);
   assert.ok(!map.luckyTileIds.includes(id),id+' is no longer a Lucky Star');
  }
  for(const [a,b] of pairs){
   const first=map.nodes[a],last=map.nodes[b];
   assert.equal(first.type,'sword');assert.equal(last.type,'sword');
   assert.ok(first.nextNodes.includes(b),'linked sword tiles are traversable: '+a);
   assert.equal(first.territoryId,last.territoryId);
   assert.equal(first.ownerId,null);assert.equal(last.ownerId,null);
   assert.deepEqual(plain(map.territories[first.territoryId].nodeIds),[a,b]);
  }
  assert.deepEqual(plain(Object.values(map.nodes).filter(n=>n.type==='sword').map(n=>n.id).sort()),[...swords].sort(),
   'no forgotten sword tiles or metadata');
  assert.equal(map.luckyTileIds.length,19);
  assert.equal(M.validate(map),true);
  assert.throws(()=>M.assertCompatible({...map,version:'winter-expedition-152-v3'}),/Incompatible BOARD PARTY map/,
   'old room maps are rejected because their territories no longer match');
  assert.throws(()=>M.assertCompatible({...map,version:'winter-expedition-152-v5'}),/Incompatible BOARD PARTY map/,
   'v5 map rooms cannot carry outdated shield/sword tile roles');
 }
});
test('Star bridge b72_5 offers old n74 exit and new b72_6 to c76_2 link',()=>{
 for(const seed of [1,42,1024]){
  const map=M.create(seed);
  assert.deepEqual(plain(map.nodes.b72_5.nextNodes),['n74','b72_6']);
  assert.deepEqual(plain(map.nodes.b72_6.nextNodes),['c76_2']);
  assert.ok(map.nodes.c76_2.previousNodes.includes('b72_6'));
  assert.equal(map.nodes.b72_6.type,'movement');
  assert.equal(map.bridgeStyles['b72_5>b72_6'],'ice');
  assert.equal(M.validate(map),true);
 }
 for(const target of ['n74','b72_6']){
  const s=ready(2,741),p=s.players[0];p.currentNodeId='b72_5';
  P.beginMove(s,p,target==='n74'?1:2);
  const a=s.map.nodes.b72_5.position,b=s.map.nodes[target].position;
  const d=Math.hypot(a.x-b.x,a.y-b.y);
  let i=0;
  while(p.currentNodeId!=='b72_6'&&p.currentNodeId!=='n74'&&i++<300){
   P.input(s,p.id,{turnId:s.turnId,actionId:i,keys:{
    axisX:(b.x-a.x)/d,axisY:(b.y-a.y)/d
   }});
   P.update(s,.05);
   if(s.move?.to)assert.equal(s.move.to,target,'stick chooses requested exit');
  }
  assert.equal(p.currentNodeId,target,'real host controller can drive ice branch to '+target);
  if(target==='b72_6'){
   const next=s.map.nodes.c76_2.position,from=s.map.nodes.b72_6.position;
   const dist=Math.hypot(next.x-from.x,next.y-from.y);
   for(let j=0;j<300&&p.currentNodeId!=='c76_2';j++){
    P.input(s,p.id,{turnId:s.turnId,actionId:i+j+1,keys:{
     axisX:(next.x-from.x)/dist,axisY:(next.y-from.y)/dist
    }});
    P.update(s,.05);
   }
   assert.equal(p.currentNodeId,'c76_2','new shortcut connects to the existing c76 route');
  }
 }
});
test('Lucky Star locations are reachable purple/gold reward tiles, spread across the larger board',()=>{
 for(let seed=0;seed<120;seed++){
  const map=M.create(seed),lucky=Object.values(map.nodes).filter(n=>n.type==='lucky');
  assert.ok(lucky.length>=18&&lucky.length<=24,'18–24 separated Lucky Stars on 212 nodes with long-route bonuses');
  assert.deepEqual(plain(lucky.map(n=>n.id).sort()),plain([...map.luckyTileIds].sort()));
  for(const node of lucky){assert.equal(node.effects.item,true);assert.ok(node.nextNodes.length);assert.ok(node.previousNodes.length);}
  assert.equal(map.nodes.n20.type,'movement');assert.equal(map.nodes.n21.type,'movement');
  assert.equal(M.validate(map),true);
 }
});
test('Lucky Star landing awards once, and waits for the full reel before switching',()=>{
 const s=ready(3,645),p=s.players[0],id=s.map.luckyTileIds[0];
 p.currentNodeId=id;I.add(p,'rocket');I.add(p,'rocket');const count=I.bag(p).length;
 P.land(s);assert.equal(s.phase,'lucky_roulette');assert.equal(I.bag(p).length,count+1);
 const reward=s.lucky.item,token=s.turnId;
 assert.equal(P.action(s,p.id,'A'),false);assert.equal(P.action(s,p.id,'B'),false);
 P.land(s);assert.equal(s.phase,'lucky_roulette');assert.equal(I.bag(p).length,count+1);
 tick(s,3.2);assert.equal(s.phase,'lucky_roulette');
 until(s,()=>s.phase==='effect',2);assert.equal(s.effect.kind,'luckyReward');
 assert.equal(s.effect.item,reward);
 until(s,()=>s.phase==='ready'||s.turnIndex>0,3);
 assert.equal(s.turnIndex,1,'ordinary Lucky landing advances exactly once');
 assert.equal(p.bag.filter(x=>x==='rocket').length,2+(reward==='rocket'?1:0));
 assert.notEqual(s.turnId,token);
});
test('Different Lucky Star landings award separately without duplication',()=>{
 const s=ready(3,680),p=s.players[0],ids=s.map.luckyTileIds.slice(0,2);
 // Rocket landings can give a bonus roll, but never allow a second item
 // on the same board round. Different Lucky Star nodes still award fairly.
 for(let i=0;i<2;i++){
  const before=I.bag(p).length;p.currentNodeId=ids[i];
  s.roundNumber=i+1;s.turnIndex=0;s.order[0]=p.id;P.ready(s);
  s.move={kind:'rocket',playerId:p.id};
  p.usedRound=s.roundNumber; // Simulated rocket was already committed.
  P.land(s);assert.equal(s.phase,'lucky_roulette');
  assert.equal(I.bag(p).length,before+1);
  until(s,()=>s.phase==='ready',6);
  assert.equal(s.turnIndex,0,'rocket Lucky Star returns to Roll on the same turn');
  assert.equal(P.current(s).id,p.id);
  assert.deepEqual(plain(I.availableSlots(p,s.roundNumber)),[0]);
 }
 assert.ok(s.luckyGrantKey.endsWith(':'+ids[1]));
});
test('Board result holds add 0.8 seconds for both minigame and item reels',()=>{
 const app=fs.readFileSync('app.js','utf8');
 assert.match(app,/holdDuration:1\.18/);
 assert.match(app,/gameSelection\.holdDuration=1\.4/);
 const s=ready();s.order=s.players.map(p=>p.id);s.turnIndex=0;
 s.phase='minigame';P.minigameEnded(s,s.players.map((p,i)=>({id:p.id,rank:i+1,label:'ok'})));
 until(s,()=>s.phase==='rewards',5);
 assert.ok(s.deadline-s.time>4.4&&s.deadline-s.time<=4.5,'item results hold 4.5 seconds');
});
test('Every sword pair captures two tiles and independently enforces 12 HP damage, shield and respawn',()=>{
 for(const pair of M.SWORD_PAIRS){
  for(const first of pair.nodeIds){
   const s=ready(3,2026),[a,b,c]=s.players,second=pair.nodeIds.find(id=>id!==first);
   const arrive=(p,id)=>{
    s.order=[p.id,...s.players.filter(q=>q.id!==p.id).map(q=>q.id)];
    s.turnIndex=0;P.startTurn(s);p.currentNodeId=id;delete p.worldPosition;P.land(s);
   };
   arrive(a,first);
   assert.equal(s.map.territories[pair.id].ownerId,a.id,'pair '+pair.id);
   for(const id of pair.nodeIds)assert.equal(s.map.nodes[id].ownerId,a.id);
   assert.equal(s.effect.kind,'swordClaim');assert.equal(a.hp,100);
   arrive(c,second);assert.equal(c.hp,88);assert.equal(s.effect.kind,'swordHit');
   assert.equal(s.hits.at(-1).amount,12);
   arrive(a,second);assert.equal(a.hp,100);assert.equal(s.effect.kind,'swordSafe');
   b.shieldTurns=1;b.shieldRound=s.roundNumber;arrive(b,first);
   assert.equal(b.hp,100);assert.equal(s.effect.kind,'shieldBreak');assert.equal(b.shieldTurns,0);
   b.shieldTurns=0;b.shieldRound=null;b.hp=10;arrive(b,second);
   assert.equal(b.currentNodeId,s.map.startId);assert.equal(b.hp,100);
   for(const id of pair.nodeIds)assert.equal(s.map.nodes[id].ownerId,a.id);
   for(const other of M.SWORD_PAIRS.filter(group=>group.id!==pair.id)){
    assert.equal(s.map.territories[other.id].ownerId,null,'other territories remain independent');
   }
  }
 }
});
test('Lethal rival sword tile awards exactly ONE random item to its owner',()=>{
 for(const pair of M.SWORD_PAIRS){
  for(const nodeId of pair.nodeIds){
   const s=ready(3,403),[owner,victim,third]=s.players;
   const landAs=(player,id)=>{
    s.order=[player.id,...s.players.filter(q=>q.id!==player.id).map(q=>q.id)];
    s.turnIndex=0;P.startTurn(s);player.currentNodeId=id;delete player.worldPosition;
    P.land(s);
   };
   landAs(owner,pair.nodeIds[0]);
   const before=I.bag(owner).length,randomCalls=s.swordRewards.length;
   victim.hp=11;landAs(victim,nodeId);
   assert.equal(victim.currentNodeId,s.map.startId,'fatal sword hit respawns the victim');
   assert.equal(victim.hp,100);
   assert.equal(I.bag(owner).length,before+1,'sword owner earns one item for a fatal hit');
   assert.equal(s.swordRewards.length,randomCalls+1,'exactly one reward entry is logged');
   const prize=s.swordRewards.at(-1);
   assert.equal(prize.ownerId,owner.id);
   assert.equal(prize.victimId,victim.id);
   assert.equal(prize.territoryId,pair.id);
   assert.ok(I.ids.includes(prize.item));
   assert.equal(s.effect.swordLoot.item,prize.item,'death animation includes the real prize');
   assert.equal(s.effect.kind,'death');
   assert.equal(I.bag(third).length,0,'other players receive no loot');
   assert.equal(I.bag(victim).length,0,'the dying player receives no loot');
   assert.equal(s.map.territories[pair.id].ownerId,owner.id,'death never clears ownership');
  }
 }
});
test('Nonfatal or shield-absorbed sword damage never grants loot, and one-hit shield breaks',()=>{
 for(const pair of M.SWORD_PAIRS){
  const s=ready(3,114),[owner,victim]=s.players;
  const landAs=(player,id)=>{
   s.order=[player.id,...s.players.filter(q=>q.id!==player.id).map(q=>q.id)];
   s.turnIndex=0;P.startTurn(s);player.currentNodeId=id;delete player.worldPosition;P.land(s);
  };
  landAs(owner,pair.nodeIds[0]);
  landAs(victim,pair.nodeIds[1]);
  assert.equal(victim.hp,88);
  assert.equal(I.bag(owner).length,0);
  victim.hp=4;victim.shieldTurns=1;victim.shieldRound=s.roundNumber;
  landAs(victim,pair.nodeIds[1]);
  assert.equal(victim.hp,4,'first hit is fully absorbed');
  assert.equal(victim.shieldTurns,0,'shield instantly shatters');
  assert.equal(victim.shieldRound,null);
  assert.equal(s.effect.kind,'shieldBreak');
  assert.equal(I.bag(owner).length,0,'blocked lethal blow is not a kill');
  landAs(victim,pair.nodeIds[1]);
  assert.equal(victim.hp,100,'a second incoming hit now kills');
  assert.equal(I.bag(owner).length,1,'only this fatal event rewards owner');
  assert.equal(s.swordRewards.length,1);
 }
});
test('Multiple sword territories can be claimed by different players without interfering',()=>{
 const s=ready(3,2026),[a,b]=s.players,[left,right]=M.SWORD_PAIRS;
 const claim=(p,id)=>{
  s.order=[p.id,...s.players.filter(q=>q.id!==p.id).map(q=>q.id)];
  s.turnIndex=0;P.startTurn(s);p.currentNodeId=id;delete p.worldPosition;P.land(s);
 };
 claim(a,left.nodeIds[0]);claim(b,right.nodeIds[1]);
 assert.equal(s.map.territories[left.id].ownerId,a.id);
 assert.equal(s.map.territories[right.id].ownerId,b.id);
 for(const id of left.nodeIds)assert.equal(s.map.nodes[id].ownerId,a.id);
 for(const id of right.nodeIds)assert.equal(s.map.nodes[id].ownerId,b.id);
 claim(a,right.nodeIds[0]);assert.equal(a.hp,88,'opposing owned sword pair hits for 12');
 claim(b,left.nodeIds[0]);assert.equal(b.hp,88,'each sword territory is defended separately');
});
test('Damage has distinct 100-HP values and healing clamps to max',()=>{
 const s=ready(3,999),p=s.players[0];
 assert.equal(p.hp,100);assert.equal(P.MAX_HP,100);
 assert.deepEqual(plain(P.DAMAGE),{sword:12,car:18,bomber:26,skull:35,event:14});
 P.damage(s,p,P.DAMAGE.car);assert.equal(p.hp,82);
 P.damage(s,p,P.DAMAGE.bomber);assert.equal(p.hp,56);
 P.damage(s,p,P.DAMAGE.skull);assert.equal(p.hp,21);
 assert.deepEqual(plain(s.hits.map(x=>x.amount)),[18,26,35]);
 p.hp=95;p.item='potion';I.begin(s,p,P,'potion');
 assert.equal(p.hp,100,'potion cannot overfill beyond 100');
});
test('HP cap, death keeps items and board order after dangerous landing',()=>{
 const s=ready(),p=s.players[0],q=s.players[2],order=plain(s.order);
 p.currentNodeId='n2';s.map.nodes.n2.type='danger';p.hp=1;p.item='ufo';
 P.land(s);assert.equal(s.effect.kind,'death');assert.equal(p.currentNodeId,s.map.startId);
 assert.equal(p.hp,100);assert.equal(p.item,'ufo');
 tick(s,2);assert.equal(P.current(s).id,'p2');assert.deepEqual(plain(s.order),order);
 q.hp=1;q.item='car';q.currentNodeId='n9';P.damage(s,q,1);
 assert.equal(q.currentNodeId,'n0');assert.equal(q.hp,100);assert.equal(q.item,'car');
});
test('Potion only activates with missing HP; rejected item keeps selection',()=>{
 const s=ready(),p=s.players[0];p.item='potion';
 const input=keys=>P.input(s,p.id,{turnId:s.turnId,actionId:(s.lastActions[p.id]??0)+1,keys});
 const tap=button=>{input({});return input({action:button==='A',alt:button==='B'});};
 tap('B');assert.equal(p.actionIndex,1);
 tap('A');assert.equal(s.phase,'ready');assert.equal(p.item,'potion');
 assert.match(p.bagMessage,/HP เต็ม/);
 p.hp=1;tap('A');assert.equal(p.hp,51);assert.equal(p.item,null);
 until(s,()=>s.phase==='ready');
 assert.equal(P.current(s).id,p.id,'potion effect returns to its owner');
 assert.equal(s.moveDice,null,'dice do not roll without A');
 assert.equal(p.actionIndex,0);
 assert.equal(tap('B'),true);assert.equal(p.actionIndex,0,'spent item blocks further item choice');
 tap('A');assert.equal(s.phase,'dice');
 const t=ready(),q=t.players[0];q.item='rocket';
 const send=keys=>P.input(t,q.id,{turnId:t.turnId,actionId:(t.lastActions[q.id]??0)+1,keys});
 send({alt:true});assert.equal(q.actionIndex,3,'rocket retains the canonical slot');
 send({});send({alt:true});assert.equal(q.actionIndex,0,'B wraps back to Roll');
 send({});send({action:true});assert.equal(t.phase,'dice');
});
test('Shield requires an explicit A, then protects the current BOARD round without rolling dice',()=>{
 assert.equal(I.ids.length,6);assert.ok(I.ids.includes('shield'));
 const s=ready(),p=s.players[0];I.add(p,'shield');
 assert.equal(p.shieldTurns,0,'earning a shield does not activate it');
 assert.equal(p.shieldRound,null);
 assert.equal(P.isProtected(s,p),false);
 assert.equal(P.damage(s,p,1),false);assert.equal(p.hp,99,'an unused shield does not prevent harm');
 assert.equal(P.action(s,p.id,'B'),true,'B only selects shield slot');
 assert.equal(p.actionIndex,6);assert.equal(P.isProtected(s,p),false);
 assert.equal(I.bag(p).includes('shield'),true,'selection never spends shield');
 assert.equal(P.action(s,p.id,'A'),true,'A deliberately activates the selected shield');
 assert.equal(p.item,null);assert.equal(p.usedRound,1);assert.equal(p.shieldTurns,1);
 assert.equal(p.shieldRound,s.roundNumber);assert.equal(P.isProtected(s,p),true);
 assert.equal(s.moveDice,null,'shield does not auto-roll dice');
 until(s,()=>s.phase==='ready');
 assert.equal(P.current(s).id,p.id,'shield returns to manual dice selection');
 assert.equal(P.isProtected(s,p),true);
 p.item='rocket';p.actionIndex=3;
 assert.equal(P.action(s,p.id,'A'),false,'cannot use rocket after shield in same round');
 p.actionIndex=0;
 assert.equal(P.action(s,p.id,'A'),true,'owner can roll dice after equipping shield');
 assert.equal(s.phase,'dice');
 const t=ready(),q=t.players[0];q.item='shield';q.shieldTurns=1;q.shieldRound=t.roundNumber;
 press(t,q,'B');
 assert.equal(q.item,'shield');assert.equal(q.usedRound,0);assert.equal(P.isProtected(t,q),true);
});
test('Shield absorbs exactly one hostile damage hit, shatters, then future attacks land',()=>{
 for(const [kind,amount] of Object.entries(P.DAMAGE)){
  const s=ready(3,707),p=s.players[0];p.hp=30;I.add(p,'shield');
  p.actionIndex=I.ids.indexOf('shield')+1;assert.equal(P.action(s,p.id,'A'),true);
  assert.equal(P.damage(s,p,0),false,'zero damage must not waste shield');
  assert.equal(P.isProtected(s,p),true);
  const count=s.hits.length;
  assert.equal(P.damage(s,p,amount),false,'first '+kind+' damage absorbed');
  assert.equal(p.hp,30);assert.equal(s.hits.length,count);
  assert.equal(P.isProtected(s,p),false,'first hit shatters shield');
  assert.equal(p.shieldTurns,0);assert.equal(p.shieldRound,null);
  assert.ok(Number.isFinite(p.shieldBrokenAt));
  P.damage(s,p,1);assert.equal(p.hp,29,'next damage is effective');
  assert.equal(s.hits.length,count+1);
 }
});
test('Shield also blocks exactly one UFO/status effect, then no longer blocks it',()=>{
 const s=ready(3,1777),[owner,victim,other]=s.players;
 victim.currentNodeId='n5';victim.hp=80;I.add(victim,'shield');
 assert.equal(P.isProtected(s,victim),false);
 assert.equal(P.blockHarm(s,victim),false,'stored shields never auto-equip');
 P.damage(s,victim,18);assert.equal(victim.hp,62);
 s.order=[victim.id,owner.id,other.id];s.turnIndex=0;P.startTurn(s);
 victim.actionIndex=I.ids.indexOf('shield')+1;
 assert.equal(P.action(s,victim.id,'A'),true);
 const nodes=plain(s.players.map(q=>q.currentNodeId)),hp=victim.hp;
 assert.equal(P.blockHarm(s,victim),true,'first teleport is blocked');
 assert.equal(P.isProtected(s,victim),false,'protection is consumed');
 assert.deepEqual(plain(s.players.map(q=>q.currentNodeId)),nodes);
 assert.equal(P.blockHarm(s,victim),false,'second teleport would succeed');
 assert.equal(P.damage(s,victim,1),false);assert.equal(victim.hp,hp-1);
 assert.equal(victim.shieldTurns,0);assert.equal(victim.shieldRound,null);
 assert.ok(!I.bag(victim).includes('shield'));
});
test('Bots do not automatically consume shield stock before a player presses A',()=>{
 const s=ready(2,283),p=s.players[0];p.isBot=true;I.add(p,'shield');
 tick(s,1.3);
 assert.equal(P.isProtected(s,p),false);
 assert.equal(p.usedRound,0);
 assert.ok(I.bag(p).includes('shield'),'AI must leave shield in the bag');
 assert.ok(s.moveDice?.length===2,'AI may still roll normally without auto-shielding');
});
test('100 protected UFO/bomber/car hits consume shields once, not unshielded neighbours',()=>{
 for(let seed=0;seed<100;seed++)for(const kind of ['ufo','bomber','car']){
  const s=ready(3,seed),[p,q,r]=s.players;
  p.item=kind;q.hp=1;q.shieldTurns=1;q.shieldRound=s.roundNumber;
  q.currentNodeId='n1';r.currentNodeId=kind==='car'?'n0':'n1';
  // RC detonates at the car's real position; place the shielded target
  // inside its blast rather than assuming adjacent pads overlap.
  if(kind==='car')q.worldPosition={...I.position(s,p)};
  press(s,p,'B');
  if(kind==='ufo'){
   aimUfoAt(s,p,q);assert.equal(press(s,p,'A'),true);
   assert.equal(s.phase,'effect');assert.equal(s.effect.kind,'shieldBreak');
   assert.equal(s.effect.source,'ufo');
   assert.equal(p.item,null,'UFO is spent on the one-hit shield');
   assert.equal(p.usedRound,s.roundNumber);
   assert.equal(p.currentNodeId,'n0');assert.equal(q.currentNodeId,'n1');
  }else{
   if(kind==='bomber'){
    Object.assign(s.skill,I.position(s,q));press(s,p,'A');
    assert.equal(r.hp,100);tick(s,1.2);
   }else until(s,()=>s.phase==='effect');
   assert.equal(r.hp,kind==='bomber'?74:82,'unshielded neighbour is damaged');
   assert.equal(p.item,null);assert.equal(s.effect.next,'ready');
  }
  assert.equal(q.hp,1,'first attack absorbed');
  assert.equal(q.shieldTurns,0);assert.equal(q.shieldRound,null);
  P.damage(s,q,1);
  assert.equal(q.hp,100,'next attack kills and respawns vulnerable target');
  assert.equal(q.currentNodeId,'n0');
 }
});
test('After the shield is broken, a new UFO can teleport the same player',()=>{
 const s=ready(3,900),[attacker,victim]=s.players;
 victim.currentNodeId='n10';victim.shieldTurns=1;victim.shieldRound=s.roundNumber;
 attacker.item='ufo';press(s,attacker,'B');
 aimUfoAt(s,attacker,victim);press(s,attacker,'A');
 assert.equal(s.effect.kind,'shieldBreak');
 assert.equal(victim.currentNodeId,'n10');assert.equal(attacker.currentNodeId,'n0');
 until(s,()=>s.phase==='ready',3);
 s.roundNumber++;s.order=[attacker.id,...s.players.filter(q=>q.id!==attacker.id).map(q=>q.id)];
 s.turnIndex=0;P.startTurn(s);I.add(attacker,'ufo');
 press(s,attacker,'B');assert.equal(s.phase,'aim');
 aimUfoAt(s,attacker,victim);press(s,attacker,'A');
 assert.equal(s.effect.kind,'ufo','second UFO works with no active shield');
 assert.equal(attacker.currentNodeId,'n10');assert.equal(victim.currentNodeId,'n0');
});
test('Shield persists through the minigame, expires for everyone at the next BOARD round',()=>{
 const s=ready(),[p,q,r]=s.players;p.item='shield';press(s,p,'B');until(s,()=>s.phase==='ready');
 assert.equal(p.shieldTurns,1);assert.equal(p.shieldRound,s.roundNumber);
 P.endTurn(s);assert.equal(P.current(s),q.id===p.id?p:q);assert.equal(P.isProtected(s,p),true);
 assert.equal(P.isProtected(s,p),true,'unused shield remains through other turns');
 assert.equal(p.hp,100);
 P.endTurn(s);assert.equal(P.current(s),r);P.endTurn(s);
 assert.equal(s.phase,'minigame_pending');assert.equal(P.isProtected(s,p),true);
 P.minigameStarted(s,'chickens');
 P.minigameEnded(s,[{id:r.id,rank:1},{id:p.id,rank:2},{id:q.id,rank:3}]);
 until(s,()=>s.phase==='round_order');
 assert.equal(s.roundNumber,2);
 assert.equal(P.isProtected(s,p),false,'new round revokes previous round protection');
 assert.ok(s.players.every(v=>v.shieldTurns===0&&v.shieldRound===null));
 P.damage(s,p,1);assert.equal(p.hp,99,'new round damage is not blocked by old shield');
});
test('UFO clears stale mid-rocket edges on BOTH swapped players; walk rejects invalid traverse',()=>{
 const s=ready(3,880),[p,q]=s.players;p.item='ufo';q.currentNodeId='n20';
 const pending=(from,to)=>({from,to,t:.65,lateral:2,
  startPosition:{...s.map.nodes[from].position},endPosition:{...s.map.nodes[to].position}});
 p.pendingTraverse=pending('n0','n1');
 q.pendingTraverse=pending('n20','n21');
 p.worldPosition={x:330,y:470};q.worldPosition={x:520,y:900};
 assert.equal(I.begin(s,p,P,'ufo'),true);
 aimUfoAt(s,p,q);
 assert.equal(P.action(s,p.id,'A'),true);
 assert.equal(p.currentNodeId,'n20');assert.equal(q.currentNodeId,'n0');
 assert.equal(p.pendingTraverse,undefined);
 assert.equal(q.pendingTraverse,undefined);
 assert.equal(p.worldPosition,undefined);assert.equal(q.worldPosition,undefined);
 // Defensive fallback also validates legacy/rejoined states which contain
 // a stale pending traverse from a different node.
 q.pendingTraverse=pending('n0','n1');q.currentNodeId='n20';
 P.beginMove(s,q,2);
 assert.equal(q.pendingTraverse,undefined);
 assert.equal(s.move.from,'n20');
 assert.equal(s.move.to,null,'a stale edge must not be resumed after teleport');
 assert.ok(['move_ready','branch'].includes(s.phase),'rejoined walker may require a new fork choice');
});
test('250 UFO cases: real world hitboxes, stacked players, atomic swap, no landing effects',()=>{
 for(let seed=0;seed<250;seed++){
  const s=ready(12,seed),p=s.players[0],q=s.players[1];p.item='ufo';for(const q of s.players.slice(1))q.currentNodeId='n10';
  press(s,p,'B');assert.equal(s.phase,'aim');s.skill.x=9999;press(s,p,'A');assert.equal(p.item,'ufo');assert.equal(p.currentNodeId,'n0');
  aimUfoAt(s,p,q);assert.equal(I.target(s,s.skill,p).id,q.id);press(s,p,'A');
  assert.equal(p.currentNodeId,'n10');assert.equal(q.currentNodeId,'n0');assert.equal(p.hp,100);assert.equal(q.hp,100);assert.equal(p.item,null);assert.equal(s.effect.next,'end');assert.equal(new Set(s.players.map(p=>p.id)).size,12);press(s,p,'A');assert.equal(s.phase,'effect');
 }
 const s=ready(),p=s.players[0],q=s.players[1];p.item='ufo';q.currentNodeId=s.map.finishId;press(s,p,'B');aimUfoAt(s,p,q);press(s,p,'A');assert.equal(p.item,'ufo');assert.equal(s.phase,'aim');press(s,p,'C');assert.equal(p.item,'ufo');assert.equal(s.phase,'ready');assert.equal(p.usedRound,0);
});
test('UFO aim does not expire for humans; C cancels repeatedly without spending or rolling',()=>{
 const s=ready(),p=s.players[0];p.item='ufo';
 for(let i=0;i<3;i++){
  press(s,p,'B');assert.equal(s.phase,'aim');
  assert.equal(s.deadline,Infinity,'human UFO aim has no timeout');
  tick(s,9+i*3);assert.equal(s.phase,'aim','human stays in targeting mode until A or C');
  assert.equal(press(s,p,'C'),true);assert.equal(s.phase,'ready');
  assert.equal(p.actionIndex,I.ids.indexOf('ufo')+1,'C keeps UFO selected');
  assert.equal(p.item,'ufo');assert.equal(p.usedRound,0);
  assert.equal(s.moveDice,null,'C never rolls dice');
 }
 tick(s,30);assert.equal(s.phase,'ready','cancel does not force a later roll');
 assert.equal(P.action(s,p.id,'B'),true,'B can cycle back to Roll');
 assert.equal(p.actionIndex,0);
 assert.equal(press(s,p,'A'),true);assert.equal(s.phase,'dice','A now starts the chosen dice roll');
});
test('UFO next to another player never swaps on first/held A or without deliberate cursor movement',()=>{
 const s=ready(3,1199),[p,q,r]=s.players;
 p.item='ufo';q.currentNodeId='n1';r.currentNodeId='n20';
 const own=I.position(s,p);
 q.worldPosition={x:own.x+20,y:own.y}; // Inside the UFO radius immediately on entering aim.
 const original=[p.currentNodeId,q.currentNodeId,r.currentNodeId];
 p.actionIndex=I.ids.indexOf('ufo')+1;
 const raw=keys=>P.input(s,p.id,{turnId:s.turnId,actionId:(s.lastActions[p.id]??0)+1,keys});
 assert.equal(raw({action:true}),true,'first A starts the preview');
 assert.equal(s.phase,'aim');assert.equal(s.skill.requiresConfirmRelease,true);
 assert.equal(s.skill.targetId,null,'nearby player is not preselected');
 assert.equal(s.skill.aimTravel,0);
 raw({action:true});assert.equal(s.phase,'aim','held A replay on the new token cannot swap');
 raw({});assert.equal(s.skill.requiresConfirmRelease,false,'real A release arms confirmation');
 raw({action:true});assert.equal(s.phase,'aim','second A without moving cursor is rejected');
 assert.deepEqual(plain(s.players.map(v=>v.currentNodeId)),original);
 assert.ok(I.bag(p).includes('ufo'),'UFO stock is untouched before aiming');
 raw({});raw({axisX:1});P.update(s,.05);raw({});
 assert.ok(s.skill.aimTravel>=I.UFO_AIM_TRAVEL_MIN,'joystick deliberately moves cursor');
 assert.equal(s.skill.targetId,q.id,'nearby player is now visibly selected');
 assert.equal(raw({cancel:true}),true);
 assert.equal(s.phase,'ready','C exits aim without applying the swap');
 assert.deepEqual(plain(s.players.map(v=>v.currentNodeId)),original);
 assert.equal(p.usedRound,0);assert.equal(s.moveDice,null);
 assert.ok(I.bag(p).includes('ufo'),'cancel keeps the UFO for reuse');
 raw({});raw({action:true});assert.equal(s.phase,'aim','UFO may be reselected');
 raw({action:true});assert.equal(s.phase,'aim','held A is still safe after retry');
 raw({});raw({axisX:1});P.update(s,.05);raw({});
 assert.equal(s.skill.targetId,q.id);
 raw({action:true});
 assert.equal(s.phase,'effect','a fresh A after actual aiming commits the swap');
 assert.equal(s.effect.kind,'ufo');
 assert.equal(p.currentNodeId,'n1');assert.equal(q.currentNodeId,'n0');
 assert.equal(p.usedRound,s.roundNumber);assert.equal(p.item,null);
});
test('5-second rocket: continuous steering, no five-node cap and preserved mid-edge landing',()=>{
 let multiple=0;
 for(let seed=0;seed<80;seed++){
  const s=ready(3,seed),p=s.players[0];p.currentNodeId='n'+(seed%20);p.item='rocket';
  const start=p.currentNodeId,prev=new Set([start]);press(s,p,'B');
  assert.equal(s.phase,'rocket');assert.ok(Math.abs(s.move.expires-s.time-5)<1e-8,'rocket stays active for five seconds');
  for(let j=0;j<103&&s.phase==='rocket';j++){
   const id=s.move.to||p.currentNodeId;
   const startAt=I.position(s,p),end=s.map.nodes[id].nextNodes[0]&&s.move.to?
    s.map.nodes[s.move.to].position:s.map.nodes[s.map.nodes[p.currentNodeId].nextNodes[0]]?.position;
   if(end){const dx=end.x-startAt.x,dy=end.y-startAt.y,d=Math.hypot(dx,dy)||1;
    press(s,p,null,{axisX:dx/d,axisY:dy/d});}
   P.update(s,.05);prev.add(p.currentNodeId);
  }
  assert.ok(['effect','lucky_roulette','finished'].includes(s.phase));
  if(prev.size>6)multiple++;
  if(s.pendingTraverse){
   const old=plain(p.worldPosition);
   until(s,()=>s.phase==='ready',7);
   assert.equal(P.current(s).id,p.id,'rocket bonus roll remains on the same turn');
   P.beginMove(s,p,2);
   assert.deepEqual(plain(I.position(s,p)),old,'the next walk resumes from exact landing');
  }
 }
 assert.ok(multiple>0,'rocket must be capable of going farther than five checkpoints');
});
test('Bomber two-step A flow: release guard, 8 orientations and C cancels with stock intact',()=>{
 const s=ready(3,660),p=s.players[0],q=s.players[1];
 p.item='bomber';q.currentNodeId='n10';p.actionIndex=4;
 const hp=q.hp,bag=plain(I.bag(p)),state=plain(s.players.map(v=>v.currentNodeId));
 // FIRST A must only enter an indefinite preview, not deal damage.
 assert.equal(press(s,p,'A'),true);
 assert.equal(s.phase,'aim');
 assert.equal(s.skill.kind,'bomber');
 assert.equal(s.deadline,Infinity);
 assert.equal(s.skill.requiresConfirmRelease,true);
 assert.deepEqual(plain(I.bag(p)),bag);
 assert.equal(q.hp,hp);
 assert.equal(p.usedRound,0);
 assert.equal(P.controls(s,p.id).c,'ยกเลิก');
 const raw=keys=>P.input(s,p.id,{turnId:s.turnId,actionId:(s.lastActions[p.id]??0)+1,keys});
 // WebKit can replay an A still held on the newly broadcast turn token.
 raw({action:true});
 assert.equal(s.phase,'aim','resending held A with a NEW token cannot fire the bomber');
 assert.equal(s.skill.requiresConfirmRelease,true);
 raw({});
 assert.equal(s.skill.requiresConfirmRelease,false,'release arms the second A');
 for(let i=1;i<=8;i++){
  assert.equal(press(s,p,'B'),true);
  assert.ok(Math.abs(s.skill.angle-((i%8)*Math.PI/4))<1e-9,'B rotates '+i+' steps of eight');
  assert.equal(s.phase,'aim');
 }
 assert.equal(s.skill.angle,0,'eight B presses wrap back to the initial heading');
 assert.equal(press(s,p,'C'),true);
 assert.equal(s.phase,'ready');
 assert.equal(s.skill,null);
 assert.equal(p.actionIndex,4,'cancel returns to the selected bomber item');
 assert.deepEqual(plain(I.bag(p)),bag);
 assert.equal(p.usedRound,0);
 assert.equal(s.moveDice,null,'cancel does not roll');
 assert.equal(q.hp,hp,'cancel does not deal damage');
 assert.deepEqual(plain(s.players.map(v=>v.currentNodeId)),state,'cancel preserves positions');
 assert.equal(P.action(s,p.id,'C'),false,'C does nothing outside bomber aim');
 assert.equal(press(s,p,'A'),true);
 assert.equal(s.phase,'aim');
 assert.deepEqual(plain(I.bag(p)),bag);
 raw({}); // new turn token observes physical A release
 Object.assign(s.skill,I.position(s,q));
 const preview=plain(I.bombs(s.skill));
 assert.equal(press(s,p,'A'),true,'SECOND deliberate A fires exactly once');
 assert.equal(s.phase,'effect');
 assert.equal(s.effect.kind,'bomber');
 assert.deepEqual(plain(s.effect.points),preview);
 assert.equal(I.bag(p).includes('bomber'),false,'only the actual strike consumes stock');
 assert.equal(P.action(s,p.id,'C'),false,'cancel cannot undo an already committed volley');
});
test('Christmas bomber passes every drop point before successive physical impacts',()=>{
 const s=ready(6,125),[owner,...targets]=s.players;
 owner.item='bomber';
 assert.equal(I.begin(s,owner,P,'bomber'),true);
 const points=I.bombs(s.skill);
 // Perpendicular offsets place each target inside only one blast circle.
 for(let i=0;i<5;i++)targets[i].worldPosition={x:points[i].x,y:points[i].y+50};
 const timeline=I.bomberFlight(points,0);
 assert.equal(timeline.bombs.length,5);
 assert.ok(timeline.bombs[4].impact<I.BOMBER_EFFECT_SECONDS);
 for(let i=0;i<5;i++){
  const point=points[i],shot=timeline.bombs[i];
  assert.ok(shot.pass<shot.drop&&shot.drop<shot.impact,'pass < drop < explosion: '+i);
  const passing=I.bomberFlight(points,shot.pass).plane;
  assert.ok(Math.hypot(passing.x-point.x,passing.y-point.y)<1e-6,'plane traverses marker '+i);
  assert.equal(I.bomberFlight(points,shot.drop+.005).bombs[i].phase,'falling');
  assert.equal(I.bomberFlight(points,shot.impact+.005).bombs[i].phase,'exploding');
 }
 s.skill.requiresConfirmRelease=false;
 assert.equal(I.confirm(s,'A',P),true);
 assert.equal(s.phase,'effect');
 assert.equal(s.effect.pendingHits.length,5);
 assert.ok(targets.every(p=>p.hp===100),'no player loses HP at confirmation');
 for(let i=0;i<5;i++){
  const at=timeline.bombs[i].impact;
  while(s.time-s.effect.at<at+.015)P.update(s,.025);
  targets.forEach((p,j)=>assert.equal(p.hp,j<=i?74:100,
   'damage follows individual bomb impact not airplane confirmation'));
 }
 while(s.phase==='effect')P.update(s,.025);
 assert.equal(s.phase,'ready');
 assert.equal(P.current(s).id,owner.id,'bomber returns the owner to manual dice');
 assert.equal(s.moveDice,null,'no automatic dice roll');
 assert.ok(targets.every(p=>p.hp===74));
});
test('250 Bomber attacks: 45-degree rotations, frozen preview, one hit per volley',()=>{
 for(let seed=0;seed<250;seed++){
  const s=ready(12,seed),p=s.players[0];p.item='bomber';for(const q of s.players.slice(1))q.currentNodeId='n10';
  press(s,p,'B');Object.assign(s.skill,s.map.nodes.n10.position);const before=s.skill.angle;press(s,p,'B');assert.equal(s.skill.angle,before+Math.PI/4);assert.equal(p.item,'bomber');
  const preview=plain(I.bombs(s.skill)),expected=I.victims(s,preview,p).map(p=>p.id);press(s,p,'A');assert.deepEqual(plain(s.effect.points),preview);
  for(const q of s.players.slice(1))assert.equal(q.hp,100,'no HP damage at the moment A confirms');
  tick(s,.2);for(const q of s.players.slice(1))assert.equal(q.hp,100,'the plane has not passed the first site yet');
  tick(s,1.0);
  for(const q of s.players.slice(1))assert.equal(q.hp,expected.includes(q.id)?74:100);
  assert.equal(p.hp,100);assert.equal(s.effect.next,'ready');
  tick(s,.2);for(const q of s.players.slice(1))assert.equal(q.hp,expected.includes(q.id)?74:100,'no target is hit twice');
 }
});
test('250 RC cars: backward input cannot reverse, no repeated node, swept hit detection',()=>{
 for(let seed=0;seed<250;seed++){
  const s=ready(3,seed),p=s.players[0];p.item='car';p.currentNodeId='n'+(seed%30);s.players[1].currentNodeId='n35';s.players[2].currentNodeId='n34';press(s,p,'B');
  let visited=[p.currentNodeId];until(s,()=>{if(s.skill){press(s,p,null,{axisX:-1,axisY:-1});visited=plain(s.skill.visited);}return s.phase==='effect';},10);
  for(let i=1;i<visited.length;i++)assert.ok(M.neighbors(s.map,visited[i-1]).includes(visited[i]),'RC route stays on bidirectional connected roads');assert.equal(s.effect.next,'ready');assert.equal(p.item,null);
 }
 assert.equal(I.segmentDistance({x:50,y:0},{x:0,y:0},{x:100,y:0}),0);
 const s=ready(),p=s.players[0],q=s.players[1];p.item='car';q.currentNodeId='n1';q.hp=1;q.worldPosition={...I.position(s,p)};s.players[2].currentNodeId='n20';press(s,p,'B');until(s,()=>s.phase==='effect');assert.equal(q.currentNodeId,'n0');assert.equal(q.hp,100);
});
test('Game-owned results handle competition ranks, ties and supplied labels',()=>{
 const list=roster(4).map((p,i)=>({...p,active:true,score:[15,12,12,7][i]}));
 for(const mode of ['chickens','color_switch','pizza_time'])
  assert.deepEqual(plain(G.ranking({mode,pluginEngine:scoreProvider},list).map(r=>r.rank)),[1,2,2,4]);
 list.forEach((p,i)=>{p.infectedAt=[9,7,7,3][i];p.shockEliminatedAt=[9,7,7,3][i];
  p.fruitEliminatedRound=[4,3,3,2][i];});
 for(const mode of ['ghost','shockwave','fruit_memory']){
  const provider={getResult:(_,ps)=>ps.map(p=>{
   const value=p.id==='p1'?Infinity:(mode==='fruit_memory'?p.fruitEliminatedRound:
    mode==='ghost'?p.infectedAt:p.shockEliminatedAt);
   return {id:p.id,value,label:value===Infinity?'ผู้รอดชีวิต':'ตกรอบชุดที่ '+value};
  })};
  const ranked=G.ranking({mode,pluginEngine:provider},list);
  assert.deepEqual(plain(ranked.map(r=>r.rank)),[1,2,2,4]);
  assert.equal(ranked[1].label,mode==='fruit_memory'?'ตกรอบชุดที่ 3':'ตกรอบชุดที่ 7');
 }
 assert.throws(()=>G.ranking({mode:'missing_new_game'},list),/Missing minigame getResult provider/);
});
test('unknown future minigames use plugin score providers without Board adapters',()=>{
 const ps=roster(4).map((p,i)=>({...p,active:true,score:[12,10,10,3][i]}));
 const round={mode:'future_game',pluginEngine:{getResult:(_,people)=>
  people.map(p=>({id:p.id,value:p.score,label:p.score+' stars'}))}};
 const ranked=G.ranking(round,ps);
 assert.deepEqual(plain(ranked.map(x=>x.rank)),[1,2,2,4]);
 assert.equal(ranked[0].label,'12 stars');
 assert.throws(()=>G.ranking({mode:'future_game'},ps),/Missing minigame getResult provider/);
});
test('Every count 1–12, 500 random tied rankings each: exact floor(50%) quota',()=>{
 for(let count=1;count<=12;count++)for(let seed=0;seed<500;seed++){
  const rng=M.random(seed),scores=roster(count).map(p=>({...p,active:true,score:Math.floor(rng()*4)}));const r=G.ranking({mode:'chickens',pluginEngine:scoreProvider},scores),before=plain(r),ids=G.rewards(r,count,rng);
  assert.equal(ids.length,Math.floor(count*.5));assert.equal(new Set(ids).size,ids.length);assert.deepEqual(plain(r),before);
  const bestExcluded=r.filter(p=>!ids.includes(p.id)).map(p=>p.rank);for(const id of ids)assert.ok(r.find(p=>p.id===id).rank<=Math.min(...bestExcluded));
 }
});
test('All earned rewards accumulate in backpack; board, order and HP survive intermissions',()=>{
 const s=ready(4),p=s.players[0];p.currentNodeId='n12';p.hp=2;p.item='ufo';
 const map=s.map,order=plain(s.order),snapshot=P.snapshot(s);
 P.phase(s,'minigame_pending');assert.equal(P.minigameStarted(s,'chickens'),true);
 assert.equal(P.minigameStarted(s,'chickens'),false);
 assert.equal(P.minigameEnded(s,s.players.map((p,i)=>({id:p.id,rank:i+1,label:'score'}))),true);
 assert.equal(P.minigameEnded(s,[]),false);
 until(s,()=>s.phase==='rewards');
 assert.equal(s.pendingItems[p.id],undefined,'no forced replacement prompt');
 assert.equal(p.bag.length,2,'new reward and old UFO are both retained');
 assert.ok(p.bag.includes('ufo'));
 until(s,()=>s.phase==='ready');
 assert.equal(s.map,map);assert.deepEqual(plain(s.order),order);
 assert.equal(p.currentNodeId,snapshot.players[0].currentNodeId);
 assert.equal(p.hp,2);assert.equal(s.roundNumber,2);
 I.add(p,'rocket');assert.equal(p.bag.length,3);
 I.add(p,'rocket');assert.equal(p.bag.filter(id=>id==='rocket').length,2,
  'duplicate items occupy independent backpack slots');
});
test('One minigame reveals results and grants item rewards exactly once, without repeated randomization',()=>{
 for(let n=1;n<=12;n++){
  const s=ready(n,117+n),round=s.roundNumber;
  const before=s.players.map(p=>I.bag(p).length),ranking=s.players.map((p,i)=>({
    id:p.id,rank:i+1,label:(100-i)+' คะแนน',value:100-i
  }));
  P.phase(s,'minigame_pending');
  assert.equal(P.minigameStarted(s,'chickens'),true);
  assert.equal(P.minigameEnded(s,ranking),true);
  assert.equal(P.minigameEnded(s,ranking),false,'duplicate end report must be rejected');
  assert.equal(s.phase,'standings');
  const assigned=plain(s.results.map(r=>r.reward));
  const quota=Math.floor(n/2);
  assert.equal(assigned.filter(Boolean).length,quota);
  until(s,()=>s.phase==='rewards',10);
  assert.equal(s.rewardGrantRound,round);
  const after=s.players.map(p=>I.bag(p).length);
  assert.equal(after.reduce((sum,x,i)=>sum+x-before[i],0),quota);
  assert.deepEqual(plain(s.results.map(r=>r.reward)),assigned);
  until(s,()=>s.phase==='returning',10);
  assert.deepEqual(s.players.map(p=>I.bag(p).length),after,
    'returning must not award again');
  until(s,()=>s.phase==='round_order',10);
  assert.deepEqual(s.players.map(p=>I.bag(p).length),after,
    'new turn order must not replay rewards');
  assert.deepEqual(plain(s.results.map(r=>r.reward)),assigned,
    'reward IDs must remain stable across all intermission phases');
  until(s,()=>s.phase==='ready',10);
  assert.deepEqual(s.players.map(p=>I.bag(p).length),after);
 }
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
test('Fresh plugin IDs enter the BOARD roulette and use the same result API',()=>{
 const fresh={setup(){},update(){},draw(){},getResult:scoreProvider.getResult};
 const registry={meteor_dash:fresh,board:fresh};
 assert.deepEqual(plain(G.eligible(registry,2)),['meteor_dash']);
 assert.equal(G.pick(registry,2,null,()=>0),'meteor_dash');
 const ps=roster(2).map((p,i)=>({...p,active:true,score:i===0?1:3}));
 const ranked=G.ranking({mode:'meteor_dash',pluginEngine:fresh},ps);
 assert.deepEqual(plain(ranked.map(p=>p.id)),['p2','p1']);
 assert.deepEqual(plain(ranked.map(p=>p.rank)),[1,2]);
});
test('A failed new plugin skips the mini-game without losing the BOARD session',()=>{
 const s=ready(4,113),originalMap=s.map,originalOrder=plain(s.order);
 const before=s.players.map(p=>({node:p.currentNodeId,hp:p.hp,bag:plain(I.bag(p))}));
 P.phase(s,'minigame_pending');assert.equal(P.minigameStarted(s,'meteor_dash'),true);
 assert.equal(P.minigameCancelled(s),true);
 assert.equal(P.minigameCancelled(s),false,'cannot skip a minigame twice');
 assert.equal(s.phase,'standings');
 assert.equal(s.results.length,s.players.length);
 assert.ok(s.results.every(x=>x.rank===1&&x.reward===null));
 assert.equal(P.minigameEnded(s,[]),false,'cannot deliver stale results after skip');
 until(s,()=>s.phase==='ready',20);
 assert.equal(s.map,originalMap);
 assert.deepEqual(plain(s.order),originalOrder);
 assert.deepEqual(s.players.map(p=>({node:p.currentNodeId,hp:p.hp,bag:plain(I.bag(p))})),before);
});
test('Finish stops new actions and supports genuinely simultaneous finishers',()=>{
 const s=ready(),a=s.players[0],b=s.players[1];a.currentNodeId=s.map.finishId;b.currentNodeId=s.map.finishId;
 P.win(s,a);P.win(s,b);assert.deepEqual(plain(s.winnerIds),[a.id,b.id]);a.item='bomber';press(s,a,'B');assert.equal(a.item,'bomber');assert.equal(s.phase,'finished');
});
test('1,000 generated boards contain no trophy or graph-adjacent heal/Lucky spaces',()=>{
 for(let seed=0;seed<1000;seed++){
  const map=M.create(seed);
  assert.ok(Object.values(map.nodes).every(n=>n.type!=='milestone'));
  for(const n of Object.values(map.nodes)){
   if(!['healing','lucky'].includes(n.type))continue;
   for(const otherId of M.neighbors(map,n.id)){
    assert.notEqual(map.nodes[otherId].type,n.type,
      'same-type tiles touch through graph edge '+n.id+' / '+otherId);
   }
  }
  for(const b of map.branches.filter(b=>b.count>b.b-b.a-1)){
   const long=b.nodeIds.map(id=>map.nodes[id]);
   assert.ok(long.some(n=>n.type==='healing'||n.type==='lucky'),
    'longer path must provide a meaningful benefit');
  }
 }
});
test('One item per round: non-UFO item returns to Roll; UFO ends turn',()=>{
 assert.equal(I.afterUse('ufo'),'end');
 for(const kind of ['potion','shield','car','ufo','bomber','rocket']){
  assert.equal(I.afterUse(kind),kind==='ufo'?'end':'ready');
  const s=ready(3,753),[p,q]=s.players;
  p.hp=35;p.item=kind;q.currentNodeId='n10';
  if(kind==='rocket')p.currentNodeId='n0';
  p.actionIndex=I.ids.indexOf(kind)+1;
  assert.equal(P.action(s,p.id,'A'),true,'item begins: '+kind);
  if(kind==='ufo'){aimUfoAt(s,p,q);assert.equal(P.action(s,p.id,'A'),true);}
  if(kind==='bomber'){
   const packet=keys=>P.input(s,p.id,{turnId:s.turnId,actionId:(s.lastActions[p.id]??0)+1,keys});
   packet({action:true});packet({});assert.equal(P.action(s,p.id,'A'),true);
  }
  if(kind==='rocket')tick(s,5.05);
  else if(kind==='car')tick(s,6.05);
  assert.ok(['effect','lucky_roulette','finished'].includes(s.phase),'item resolves effect '+kind);
  if(s.phase==='lucky_roulette')until(s,()=>s.phase==='effect',6);
  if(s.phase==='effect')until(s,()=>s.phase==='ready',7);
  assert.equal(p.usedRound,s.roundNumber,'committed item counts for the round: '+kind);
  assert.equal(s.moveDice,null,'no free automatic dice for item: '+kind);
  if(kind==='ufo'){
   assert.equal(P.current(s).id,q.id,'UFO ends owner turn');
   assert.equal(P.action(s,p.id,'A'),false,'previous player cannot roll after UFO');
  }else{
   assert.equal(P.current(s).id,p.id,'after '+kind+', same owner gets a dice roll');
   assert.equal(p.actionIndex,0,'Roll remains selected after effect: '+kind);
   assert.deepEqual(plain(I.availableSlots(p,s.roundNumber)),[0]);
   assert.equal(P.action(s,p.id,'B'),true);
   assert.equal(p.actionIndex,0,'B skips every item after one is consumed');
   p.actionIndex=I.ids.indexOf(kind)+1;
   assert.equal(P.action(s,p.id,'A'),false,'host rejects forced repeat item: '+kind);
   p.actionIndex=0;
   assert.equal(P.action(s,p.id,'A'),true,'manual dice roll is permitted: '+kind);
   assert.equal(s.phase,'dice');
   assert.equal(s.moveDice.length,2);
  }
 }
});
test('A canceled or invalid item does not lock other items or force a roll',()=>{
 const s=ready(),p=s.players[0];
 I.add(p,'bomber');I.add(p,'shield');
 p.actionIndex=I.ids.indexOf('bomber')+1;
 assert.equal(P.action(s,p.id,'A'),true);
 assert.equal(s.phase,'aim');
 assert.equal(p.usedRound,0,'aiming without committing has not spent the item');
 assert.equal(P.action(s,p.id,'C'),true);
 assert.equal(s.phase,'ready');
 assert.equal(p.usedRound,0);
 assert.deepEqual(plain(I.availableSlots(p,s.roundNumber)),[0,4,6]);
 p.actionIndex=6;
 assert.equal(P.action(s,p.id,'A'),true,'can choose shield after canceling bomber');
 assert.equal(p.usedRound,s.roundNumber);
 until(s,()=>s.phase==='ready',4);
 assert.deepEqual(plain(I.availableSlots(p,s.roundNumber)),[0]);
});
test('Unlimited debug stock still respects one item per round',()=>{
 const s=ready(),p=s.players[0];p.debugUnlimitedItems=true;p.item='potion';p.hp=10;
 assert.equal(I.begin(s,p,P,'potion'),true);
 assert.equal(p.usedRound,s.roundNumber);
 assert.equal(I.bag(p).length,1,'debug stock stays available');
 P.ready(s);assert.equal(I.begin(s,p,P,'potion'),false,'debug stock does not bypass round lock');
});
test('UFO targeting uses the same larger radius for capture and visible ring',()=>{
 const s=ready(),[p,q,r]=s.players;
 p.currentNodeId='n0';q.currentNodeId='n10';r.currentNodeId='n30';
 const pos=I.position(s,q);
 assert.ok(I.ufoRadius>26,'ring grows beyond the previous 26px footprint');
 assert.equal(I.target(s,{x:pos.x+I.ufoRadius+I.radius-1,y:pos.y},p)?.id,q.id);
 assert.equal(I.target(s,{x:pos.x+I.ufoRadius+I.radius+2,y:pos.y},p),null);
});
test('Green heal +20 and potion +50 change real HP without exceeding 100',()=>{
 const s=ready(3,47),p=s.players[0],node='n10';
 p.currentNodeId=node;s.map.nodes[node].type='healing';
 p.hp=60;P.land(s);assert.equal(p.hp,80);
 assert.equal(s.heals.at(-1).amount,20);
 P.ready(s);p.hp=95;P.land(s);assert.equal(p.hp,100);
 assert.equal(s.heals.at(-1).amount,5);
 P.ready(s);p.hp=10;I.add(p,'potion');
 assert.equal(I.begin(s,p,P,'potion'),true);assert.equal(p.hp,60);
 assert.equal(s.heals.at(-1).amount,50);
 assert.equal(I.bag(p).includes('potion'),false);
});
test('Stationary rocket times out after 5s without re-triggering the pad reward',()=>{
 const s=ready(2,42),p=s.players[0];p.currentNodeId=s.map.luckyTileIds[0];
 const before=I.bag(p).length;P.beginMove(s,p,Infinity,'rocket');
 tick(s,5.2);assert.equal(s.phase,'effect');assert.equal(I.bag(p).length,before);
 assert.equal(s.effect.kind,'land');
 until(s,()=>s.phase==='ready',2);assert.equal(s.turnIndex,0,'rocket lands and owner may now roll');
 assert.equal(P.current(s).id,p.id);
});
test('RC car drives backward on the same segment and backtracks previous nodes',()=>{
 const s=ready(2,55),p=s.players[0];
 s.players[1].currentNodeId='n60';I.add(p,'car');
 assert.equal(I.begin(s,p,P,'car'),true);
 const begin={x:s.skill.x,y:s.skill.y},a=s.map.nodes.n0.position,b=s.map.nodes.n1.position;
 const d=Math.hypot(b.x-a.x,b.y-a.y),dx=(b.x-a.x)/d,dy=(b.y-a.y)/d;
 const steer=(x,y)=>P.input(s,p.id,{turnId:s.turnId,
   actionId:(s.lastActions[p.id]??0)+1,keys:{axisX:x,axisY:y}});
 steer(dx,dy);tick(s,.25);
 const outbound=Math.hypot(s.skill.x-begin.x,s.skill.y-begin.y);
 assert.ok(outbound>10,'forward steering moves the car');
 steer(-dx,-dy);tick(s,.10);
 const inbound=Math.hypot(s.skill.x-begin.x,s.skill.y-begin.y);
 assert.ok(inbound<outbound-5,'backward stick reverses along the same physical edge');
 tick(s,.3);assert.equal(s.skill.nodeId,'n0','car can return to original node');
 assert.ok(!s.skill.step);
 // Move to n1, then reverse onto the incoming road n1 -> n0.
 steer(dx,dy);tick(s,.9);
 assert.equal(s.skill.nodeId,'n1');
 steer(-dx,-dy);tick(s,.9);
 assert.equal(s.skill.nodeId,'n0','car can visit the same road twice in reverse');
 assert.ok(s.skill.visited.filter(id=>id==='n0').length>=2);
 assert.equal(p.currentNodeId,'n0','RC travel cannot move the owner');
 until(s,()=>s.phase==='effect',7);
 assert.equal(s.effect.kind,'car');assert.equal(s.effect.next,'ready');
});
test('Bots complete acute branch merges without steering backwards before the checkpoint',()=>{
 const s=ready(1,0),p=s.players[0];p.isBot=true;p.currentNodeId='b3_3';delete p.worldPosition;
 P.beginMove(s,p,1);
 until(s,()=>p.currentNodeId==='n'+s.map.branches.find(b=>b.a===3).b,5);
 assert.equal(s.move?.remaining||0,0);
});
test('Bot recovers from failed UFO aim without a 12s forced roll',()=>{
 const s=ready(2,2790),p=s.players[0],q=s.players[1];
 p.isBot=true;p.item='ufo';q.currentNodeId='n10';
 tick(s,1);
 assert.equal(s.phase,'aim','bot should attempt available UFO once');
 assert.equal(p.botItemAttemptKey,s.roundNumber+':'+s.turnIndex);
 q.shieldTurns=1;q.shieldRound=s.roundNumber; // Target becomes protected while bot is aiming.
 tick(s,9.5);
 assert.equal(p.item,'ufo','a failed aim must not consume the item');
 assert.ok(['dice','move_ready','moving','branch','effect'].includes(s.phase),
  'bot chooses Roll after failed aim instead of looping the same item forever');
 assert.ok(s.moveDice&&s.moveDice.length===2,'AI can roll using the original dice rules');
});
test('A resumed bridge edge completes at floating-point endpoint without extra input',()=>{
 const s=ready(1),p=s.players[0];p.currentNodeId='n57';
 P.beginMove(s,p,2);P.step(s,'n58');s.move.t=1-Number.EPSILON;
 P.update(s,.05);
 assert.equal(p.currentNodeId,'n58');assert.equal(s.move.remaining,1);
 P.update(s,.05);assert.equal(s.move.remaining,1,'arrival consumes only one die step');
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
    const r=G.ranking({mode:'chickens',pluginEngine:scoreProvider},s.players.map(p=>({...p,active:true,score:Math.floor(s.rng()*5)})));P.minigameEnded(s,r);rounds++;
    nextOrder=[...order].sort((a,b)=>r.find(p=>p.id===a).rank-r.find(p=>p.id===b).rank);
    assert.deepEqual(s.players.map(p=>p.hp),hp);assert.deepEqual(s.players.map(p=>p.currentNodeId),positions);
   }
   assert.equal(s.map,map);if(order)assert.deepEqual(plain(s.order),order);
   for(const p of s.players)assert.ok(p.hp>=1&&p.hp<=100&&s.map.nodes[p.currentNodeId]);
  }
  assert.equal(s.phase,'finished','session n='+n+' seed='+seed);assert.equal(s.winnerIds.length,1);assert.equal(s.players.find(p=>p.id===s.winnerIds[0]).currentNodeId,s.map.finishId);games++;
 }
 assert.ok(used.size>=5,'bots should use five or more item types in real 100-HP situations');console.log('  Completed',games,'sessions,',rounds,'board rounds,',used.size,'bot item types');
});
console.log('BOARD PARTY:',tests.length,'suites passed');
