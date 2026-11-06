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
function press(s,p,key,extra={}){
 const send=keys=>P.input(s,p.id,{turnId:s.turnId,actionId:(s.lastActions[p.id]??0)+1,keys});
 send(extra);
 const result=send({...extra,action:key==='A',alt:key==='B'});
 // Adapt legacy item-effect fixtures to the new two-press backpack UI.
 // Dedicated backpack tests below exercise BOTH presses individually.
 if(key==='B'&&s.phase==='ready'&&p.bagOpen&&(p.item||p.bag?.length)){
  send(extra);return send({...extra,alt:true});
 }
 return result;
}
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
   while(at.id!==map.finishId){assert.ok(at.nextNodes.length);const next=map.nodes[at.nextNodes[seed%at.nextNodes.length]];assert.ok(next.progress>at.progress);at=next;assert.ok(++steps<map.length+10);}
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
 for(let frame=0;frame<60;frame++)advance(s,.2);
 assert.ok(Math.abs(s.time-12)<.001,'5 FPS must advance twelve game seconds in twelve real seconds');
 assert.equal(s.players[0].dice.length,2,'order timeout must resolve even on low FPS');
});
test('Backpack B opens, A cycles across items and Close, B uses only the selected slot',()=>{
 const s=ready(3),p=s.players[0];p.hp=1;
 I.add(p,'shield');I.add(p,'potion');I.add(p,'rocket');
 const input=keys=>P.input(s,p.id,{turnId:s.turnId,actionId:(s.lastActions[p.id]??0)+1,keys});
 const tap=button=>{input({});return input({action:button==='A',alt:button==='B'});};
 tap('B');assert.equal(p.bagOpen,true);assert.equal(s.phase,'ready');
 assert.equal(p.bagIndex,0);assert.equal(P.controls(s,p.id).b,'ใช้ไอเทม');
 tap('A');assert.equal(p.bagIndex,1);assert.equal(p.bag[p.bagIndex],'potion');
 tap('B');assert.equal(p.hp,31);assert.equal(p.usedRound,1);
 assert.deepEqual(plain(p.bag),['shield','rocket']);
 assert.equal(s.phase,'effect');until(s,()=>s.phase==='ready');
 tap('B');assert.equal(p.bagOpen,true);
 tap('A');tap('A');assert.equal(p.bagIndex,2,'selection reaches the Close slot');
 assert.equal(P.controls(s,p.id).b,'ปิดกระเป๋า');
 tap('B');assert.equal(p.bagOpen,false);assert.deepEqual(plain(p.bag),['shield','rocket']);
 tap('A');assert.equal(s.phase,'dice','A resumes dice rolling after closing backpack');
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
 tick(s,1);assert.equal(P.remainingSteps(s,p.id),2);until(s,()=>s.phase==='move_ready');
 tick(s,1);assert.equal(p.currentNodeId,'n0');assert.equal(P.remainingSteps(s,p.id),2);
 press(s,p,'A');press(s,p,'B');assert.equal(p.item,'rocket');assert.equal(s.phase,'move_ready');
 assert.equal(P.input(s,p.id,{turnId:oldToken,actionId:(s.lastActions[p.id]??0)+1,keys:{axisX:1}}),false);
 const token=s.turnId;steer(s,p);tick(s,.3);assert.equal(s.phase,'moving');assert.equal(p.currentNodeId,'n0');assert.equal(P.remainingSteps(s,p.id),2);
 const fraction=s.move.t,position=plain(I.position(s,p));assert.ok(fraction>0&&fraction<1);
 press(s,p,null);tick(s,.5);assert.equal(s.move.t,fraction);assert.deepEqual(plain(I.position(s,p)),position);
 for(let i=0;i<5;i++){press(s,p,'A');press(s,p,'B');tick(s,.05);}assert.equal(s.move.t,fraction);assert.equal(p.item,'rocket');
 steer(s,p);until(s,()=>p.currentNodeId==='n1');assert.equal(P.remainingSteps(s,p.id),1);assert.equal(s.turnId,token);
 tick(s,.25);assert.equal(s.phase,'moving','held direction continues across a node without A or a new token');
 until(s,()=>{if(s.move)steer(s,p);return s.phase==='effect';});assert.equal(p.currentNodeId,'n2');assert.equal(P.remainingSteps(s,p.id),0);
 assert.equal(P.remainingSteps(s,s.players[1].id),0);assert.equal(p.item,'rocket');assert.notEqual(s.turnId,token);
});
test('Free 2D walking: reverse and sideways inputs are real movement, no accidental spent steps',()=>{
 const s=ready(),p=s.players[0];P.beginMove(s,p,3);
 const start=plain(I.position(s,p));
 press(s,p,null,{left:true});tick(s,.5);assert.equal(s.phase,'move_ready');
 assert.ok(Math.hypot(I.position(s,p).x-start.x,I.position(s,p).y-start.y)>5,'can roam at a node');
 press(s,p,null,{right:true});tick(s,.25);assert.equal(s.phase,'moving');
 const fraction=s.move.t,remaining=s.move.remaining;
 const from=s.map.nodes.n0.position,to=s.map.nodes.n1.position;
 const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy);
 press(s,p,null,{axisX:-dy/d,axisY:dx/d});tick(s,.2);
 assert.ok(Math.abs(s.move.lateral)>2,'can walk sideways within a bounded lane');
 assert.equal(s.move.remaining,remaining);
 press(s,p,null,{axisX:-dx/d,axisY:-dy/d});tick(s,.3);
 assert.ok(s.phase==='move_ready'||s.move.t<fraction,'reversing must recover a slightly premature turn');
 assert.equal(s.move.remaining,remaining,'reversing cannot spend extra dice');
 steer(s,p);until(s,()=>p.currentNodeId==='n1');assert.equal(s.move.remaining,2);
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
     assert.ok(Math.abs(s.move.lateral||0)<=50.001);
     assert.ok(I.segmentDistance(pos,s.move.startPosition,s.move.endPosition)<=51,
      '2D walking stays inside the safe corridor');
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
 const s=ready(3,512),p=s.players[0];p.currentNodeId='n9';
 const a=s.map.nodes.n9.position,b=s.map.nodes.n10.position;
 assert.ok(s.map.bridges.some(pair=>pair[0]==='n9'&&pair[1]==='n10'));
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
  if(p.currentNodeId==='n9'){
   assert.ok(I.segmentDistance(pos,a,b)<=18.001,'cannot step out onto the water');
  }else{
   crossed=true;
   assert.equal(p.currentNodeId,'n10');
   assert.ok(Math.abs(pos.x-b.x)+Math.abs(pos.y-b.y)>5,'crossing a checkpoint retains side offset');
   assert.ok(Math.abs(Math.hypot(pos.x-b.x,pos.y-b.y)-Math.abs(lateral))<2,'side offset survives');
  }
  last=plain(pos);
 }
 assert.ok(crossed,'crosses the bridge normally');
 assert.equal(s.move.remaining,1,'one graph edge consumes exactly one die step');
});

test('72-step board extends the map and retains two consecutive neutral sword tiles',()=>{
 for(const seed of [1,42,2026,999]){
  const map=M.create(seed);
  assert.equal(map.length,72);assert.equal(map.finishId,'n72');
  assert.ok(map.height>=2750&&map.rows>=8,'snow map must extend far enough for eight rows');
  assert.deepEqual(plain(M.SWORD_TILES),['n20','n21']);
  assert.equal(map.nodes.n20.type,'sword');assert.equal(map.nodes.n21.type,'sword');
  assert.equal(map.nodes.n20.ownerId,null);assert.equal(map.nodes.n21.ownerId,null);
  assert.ok(map.nodes.n20.nextNodes.includes('n21'),'sword tiles are adjacent on the main path');
  assert.ok(map.nodes.n19.nextNodes.includes('n20'));
  assert.equal(M.validate(map),true);
 }
});
test('Lucky Star locations are reachable purple/gold reward tiles, spread across the larger board',()=>{
 for(let seed=0;seed<120;seed++){
  const map=M.create(seed),lucky=Object.values(map.nodes).filter(n=>n.type==='lucky');
  assert.equal(lucky.length,6,'6 lucky tiles in the 6-8% range');
  assert.deepEqual(plain(lucky.map(n=>n.id).sort()),plain([...map.luckyTileIds].sort()));
  for(const node of lucky){assert.equal(node.effects.item,true);assert.ok(node.nextNodes.length);assert.ok(node.previousNodes.length);}
  assert.equal(map.nodes.n20.type,'sword');assert.equal(map.nodes.n21.type,'sword');
  assert.equal(M.validate(map),true);
 }
});
test('Lucky Star landing adds one stackable item and must finish reel + above-player reveal before next turn',()=>{
 const s=ready(3,645),p=s.players[0],id=s.map.luckyTileIds[0],node=s.map.nodes[id];
 const predecessor='n'+(Number(id.slice(1))-1);
 assert.ok(s.map.nodes[predecessor].nextNodes.includes(id));
 p.currentNodeId=predecessor;I.add(p,'rocket');I.add(p,'rocket');
 const before=I.bag(p).length;
 P.beginMove(s,p,1,'rocket');
 until(s,()=>s.phase==='lucky_roulette',4);
 assert.equal(p.currentNodeId,id);assert.equal(I.bag(p).length,before+1);
 assert.ok(I.bag(p).includes(s.lucky.item));
 assert.equal(s.lucky.holdDuration,1.4);
 const reward=s.lucky.item,token=s.turnId;
 assert.equal(P.action(s,p.id,'A'),false);
 assert.equal(P.action(s,p.id,'B'),false);
 P.land(s);assert.equal(s.phase,'lucky_roulette','duplicate landing must not skip the reveal');
 assert.equal(I.bag(p).length,before+1,'only one item for the landing');
 tick(s,3.2);assert.equal(s.phase,'lucky_roulette');
 until(s,()=>s.phase==='effect',2);
 assert.equal(s.effect.kind,'luckyReward');assert.equal(s.effect.item,reward);
 assert.deepEqual(plain(s.effect.targets),[p.id]);
 assert.equal(I.bag(p).length,before+1);
 until(s,()=>s.phase==='ready',3);
 assert.equal(s.turnIndex,0,'rocket grants a following roll, not a next-player transition');
 assert.equal(p.bag.filter(x=>x==='rocket').length,2+(reward==='rocket'?1:0),'duplicate items remain stacked');
 assert.equal(s.lucky,null);
 assert.notEqual(s.turnId,token);
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
test('Sword territory claims are permanent, separately owned and deal 12 only to visitors',()=>{
 const s=ready(3,2026),[a,b,c]=s.players;
 const arrive=(p,from)=>{
  s.order=[p.id,...s.players.filter(x=>x.id!==p.id).map(x=>x.id)];
  s.turnIndex=0;P.startTurn(s);
  p.currentNodeId=from;delete p.worldPosition;
  P.beginMove(s,p,1,'rocket');
  until(s,()=>s.phase==='effect',5);
 };
 arrive(a,'n19');
 assert.equal(s.map.nodes.n20.ownerId,a.id);assert.equal(a.hp,100);
 assert.equal(s.effect.kind,'swordClaim');
 arrive(c,'n20');
 assert.equal(s.map.nodes.n21.ownerId,c.id);assert.equal(c.hp,100);
 assert.notEqual(s.map.nodes.n20.ownerId,s.map.nodes.n21.ownerId);
 arrive(b,'n19');
 assert.equal(b.hp,88,'unowned tile first visit has no damage, owned tile visit takes 12');
 assert.equal(s.effect.kind,'swordHit');
 assert.equal(s.hits.at(-1).amount,12);
 assert.equal(s.map.nodes.n20.ownerId,a.id);
 arrive(a,'n19');assert.equal(a.hp,100);assert.equal(s.effect.kind,'swordSafe');
 b.shieldTurns=1;arrive(b,'n19');
 assert.equal(b.hp,88,'shield blocks enemy sword tile damage');
 assert.equal(s.effect.kind,'shield');
 b.shieldTurns=0;b.hp=10;arrive(b,'n19');
 assert.equal(b.currentNodeId,s.map.startId);assert.equal(b.hp,100,'defeated player respawns at full HP');
 assert.equal(s.map.nodes.n20.ownerId,a.id,'captured territory persists after a visitor is defeated');
 assert.equal(s.map.nodes.n21.ownerId,c.id,'second sword owner is independent');
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
test('HP cap, death keeps item/order, clears movement and awards no free roll',()=>{
 const s=ready(),p=s.players[0];p.currentNodeId='n1';p.hp=1;p.item='ufo';s.map.nodes.n2.type='danger';const order=plain(s.order);
 P.beginMove(s,p,1,'rocket');until(s,()=>s.phase==='effect');assert.equal(p.hp,100);assert.equal(p.currentNodeId,'n0');assert.equal(p.item,'ufo');assert.equal(s.effect.next,'end');tick(s,2);assert.equal(P.current(s).id,'p2');assert.deepEqual(plain(s.order),order);
 const q=s.players[2];q.hp=1;q.item='car';q.currentNodeId='n9';P.damage(s,q,1);assert.equal(q.currentNodeId,'n0');assert.equal(q.hp,100);assert.equal(q.item,'car');assert.equal(P.current(s).id,'p2');
});
test('Potion requires HP below maximum; backpack can be closed without using an item',()=>{
 const s=ready(),p=s.players[0];p.item='potion';
 press(s,p,'B');assert.equal(p.item,'potion');assert.equal(s.phase,'ready');
 p.hp=1;press(s,p,'B');assert.equal(p.hp,31);assert.equal(p.item,null);
 until(s,()=>s.phase==='ready');p.item='rocket';
 press(s,p,'B');assert.equal(p.item,'rocket');assert.equal(p.bagOpen,true);
 press(s,p,'A');assert.equal(p.bagIndex,1,'Close is included in the item selection');
 press(s,p,'B');assert.equal(p.bagOpen,false);
 press(s,p,'A');assert.equal(s.phase,'dice');
});
test('Shield is a sixth reward item, once per round, and preserves the dice roll',()=>{
 assert.equal(I.ids.length,6);assert.ok(I.ids.includes('shield'));
 const s=ready(),p=s.players[0];p.item='shield';press(s,p,'B');
 assert.equal(p.item,null);assert.equal(p.usedRound,1);assert.equal(p.shieldTurns,2);
 until(s,()=>s.phase==='ready');p.item='rocket';press(s,p,'B');
 assert.equal(p.item,'rocket');assert.equal(s.phase,'ready');
 press(s,p,'A');press(s,p,'B');press(s,p,'A');assert.equal(s.phase,'dice');
 assert.equal(s.moveDice.length,2);
 const t=ready(),q=t.players[0];q.item='shield';q.shieldTurns=1;press(t,q,'B');
 assert.equal(q.item,'shield');assert.equal(q.usedRound,0);assert.equal(q.shieldTurns,1);
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
   assert.equal(r.hp,kind==='bomber'?74:82);assert.equal(p.item,null);assert.equal(s.effect.next,'end');
  }
  assert.equal(q.hp,1);assert.equal(q.currentNodeId,'n1');assert.equal(q.shieldTurns,1);
 }
});
test('Shield lasts through intermission/reordering until its owner completes their next turn',()=>{
 const s=ready(),[p,q,r]=s.players;p.item='shield';press(s,p,'B');until(s,()=>s.phase==='ready');
 P.endTurn(s);assert.equal(p.shieldTurns,1);assert.equal(P.current(s),q);P.damage(s,p,1);assert.equal(p.hp,100);
 P.endTurn(s);assert.equal(p.shieldTurns,1);assert.equal(P.current(s),r);P.endTurn(s);assert.equal(p.shieldTurns,1);
 P.minigameStarted(s,'chickens');P.minigameEnded(s,[{id:r.id,rank:1},{id:p.id,rank:2},{id:q.id,rank:3}]);until(s,()=>s.phase==='ready');
 assert.equal(P.current(s),r);assert.equal(p.shieldTurns,1);P.endTurn(s);assert.equal(P.current(s),p);assert.equal(p.shieldTurns,1);
 P.damage(s,p,1);assert.equal(p.hp,100);P.endTurn(s);assert.equal(p.shieldTurns,0);P.damage(s,p,1);assert.equal(p.hp,99);
});
test('250 UFO cases: real world hitboxes, stacked players, atomic swap, no landing effects',()=>{
 for(let seed=0;seed<250;seed++){
  const s=ready(12,seed),p=s.players[0],q=s.players[1];p.item='ufo';for(const q of s.players.slice(1))q.currentNodeId='n10';
  press(s,p,'B');assert.equal(s.phase,'aim');s.skill.x=9999;press(s,p,'A');assert.equal(p.item,'ufo');assert.equal(p.currentNodeId,'n0');
  const pos=I.position(s,q);Object.assign(s.skill,pos);assert.equal(I.target(s,s.skill,p).id,q.id);press(s,p,'A');
  assert.equal(p.currentNodeId,'n10');assert.equal(q.currentNodeId,'n0');assert.equal(p.hp,100);assert.equal(q.hp,100);assert.equal(p.item,null);assert.equal(s.effect.next,'end');assert.equal(new Set(s.players.map(p=>p.id)).size,12);press(s,p,'A');assert.equal(s.phase,'effect');
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
  for(const q of s.players.slice(1))assert.equal(q.hp,expected.includes(q.id)?74:100);assert.equal(p.hp,100);assert.equal(s.effect.next,'end');tick(s,.5);for(const q of s.players.slice(1))assert.equal(q.hp,expected.includes(q.id)?74:100);
 }
});
test('250 RC cars: backward input cannot reverse, no repeated node, swept hit detection',()=>{
 for(let seed=0;seed<250;seed++){
  const s=ready(3,seed),p=s.players[0];p.item='car';p.currentNodeId='n'+(seed%30);s.players[1].currentNodeId='n35';s.players[2].currentNodeId='n34';press(s,p,'B');
  let visited=[p.currentNodeId];until(s,()=>{if(s.skill){press(s,p,null,{axisX:-1,axisY:-1});visited=plain(s.skill.visited);}return s.phase==='effect';},10);
  assert.equal(new Set(visited).size,visited.length);for(let i=1;i<visited.length;i++)assert.ok(s.map.nodes[visited[i-1]].nextNodes.includes(visited[i]));assert.equal(s.effect.next,'end');assert.equal(p.item,null);
 }
 assert.equal(I.segmentDistance({x:50,y:0},{x:0,y:0},{x:100,y:0}),0);
 const s=ready(),p=s.players[0],q=s.players[1];p.item='car';q.currentNodeId='n1';q.hp=1;s.players[2].currentNodeId='n20';press(s,p,'B');until(s,()=>s.phase==='effect');assert.equal(q.currentNodeId,'n0');assert.equal(q.hp,100);
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
   for(const p of s.players)assert.ok(p.hp>=1&&p.hp<=100&&s.map.nodes[p.currentNodeId]);
  }
  assert.equal(s.phase,'finished','session n='+n+' seed='+seed);assert.equal(s.winnerIds.length,1);assert.equal(s.players.find(p=>p.id===s.winnerIds[0]).currentNodeId,s.map.finishId);games++;
 }
 assert.equal(used.size,6);console.log('  Completed',games,'sessions,',rounds,'board rounds, all six bot items');
});
console.log('BOARD PARTY:',tests.length,'suites passed');
