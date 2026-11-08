/* ICE RACE: deterministic 60 Hz physics, scoring, respawn and party integration. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const checks=[];
const test=(label,fn)=>checks.push({label,fn});
function engine(){
 const window={PartyCharacters:{control:(input={})=>{
  let x=Number(input.axisX)||0,y=Number(input.axisY)||0;
  const d=Math.hypot(x,y);if(d>1){x/=d;y/=d;}
  return {x,y};
 }}};
 vm.runInNewContext(fs.readFileSync('ice-race.js','utf8'),{window,console,Math},
   {filename:'ice-race.js'});
 return window.IceRace;
}
function match(n,bots=false,seed=1459){
 const e=engine(),round={mode:'ice_race',phase:'playing',paused:false,iceSeed:seed};
 const ps=Array.from({length:n},(_,i)=>({id:'p'+i,name:'Sled '+i,
  color:['#fc686a','#5ad8ee','#ffe263','#8fee9b'][i%4],active:true,isBot:bots,
  input:{axisX:0,axisY:0}}));
 const s=e.setup(round,ps);return{e,round,ps,s};
}
const almost=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<=eps,a+' !== '+b);
test('1–6 use 960×540 and 40 seconds; 7–12 use 1280×720 and 70 seconds',()=>{
 for(const n of [1,2,4,6,7,8,10,12]){
  const {e,s,round,ps}=match(n);
  assert.equal(s.w,n<=6?960:1280);assert.equal(s.h,n<=6?540:720);
  assert.equal(s.duration,n<=6?40:70);
  assert.equal(round.remaining,s.duration);
  assert.equal(s.checkpoints.length,4);
  for(const p of ps)assert.ok(e.nearest(s,p.x,p.y).dist<s.halfWidth-1,
    'spawn is off-track: '+n);
  for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++)
   assert.ok(Math.hypot(ps[i].x-ps[j].x,ps[i].y-ps[j].y)>=2*e.config.radius,
    'overlapping start positions');
 }
});
test('closed sampled path, four ordered checkpoint gates and safe start',()=>{
 const {e,s,ps}=match(6);
 const a=e.sample(s,0),b=e.sample(s,s.trackLength);
 almost(a.x,b.x);almost(a.y,b.y);
 for(const f of [0,.13,.24,.37,.51,.62,.76,.91]){
  const at=e.sample(s,s.trackLength*f);
  assert.ok(e.nearest(s,at.x,at.y).dist<.01);
 }
 for(const [i,cp] of s.checkpoints.entries()){
  assert.equal(cp.id,i);
  assert.ok(e.nearest(s,cp.x,cp.y).dist<.1);
 }
 assert.ok(ps.every(p=>p.score===0&&p.ice.nextCheckpoint===1));
});
test('only the next gate and correct crossing direction score',()=>{
 const {e,s,ps}=match(1),p=ps[0],first=s.checkpoints[1];
 const travel=(cp,forward)=>{
  const d=forward?1:-1;
  const before={x:cp.x-cp.tx*10*d,y:cp.y-cp.ty*10*d};
  p.x=cp.x+cp.tx*10*d;p.y=cp.y+cp.ty*10*d;
  return e.checkpoint(s,p,before);
 };
 assert.equal(travel(s.checkpoints[0],true),false,'start spawn is free');
 assert.equal(travel(first,false),false,'reverse pass must not count');
 assert.equal(p.score,0);
 assert.equal(travel(first,true),true);assert.equal(p.score,1);
 assert.equal(travel(first,true),false,'old gate must not repeat');
 assert.equal(travel(s.checkpoints[2],true),true);assert.equal(p.score,2);
 assert.equal(travel(s.checkpoints[3],true),true);assert.equal(p.score,3);
 assert.equal(travel(s.checkpoints[0],true),true);assert.equal(p.score,4);
 assert.equal(p.ice.nextCheckpoint,1);
});
test('drift retains sideways momentum; A/B are not gameplay actions',()=>{
 const x=match(1),y=match(1),a=x.ps[0],b=y.ps[0];
 for(const p of [a,b]){
  const h=p.ice.heading;
  p.input={axisX:Math.cos(h),axisY:Math.sin(h),action:p===a,alt:p===a};
 }
 for(let i=0;i<22;i++){x.e.update(1/60,x.round,x.ps);y.e.update(1/60,y.round,y.ps);}
 almost(a.x,b.x);almost(a.y,b.y);
 const before={x:a.x,y:a.y,speed:Math.hypot(a.ice.vx,a.ice.vy)};
 a.input.axisX=0;a.input.axisY=0;
 x.e.update(1/60,x.round,x.ps);
 assert.ok(Math.hypot(a.x-before.x,a.y-before.y)>1,'no instant stop');
 const h=a.ice.heading;
 a.input={axisX:-Math.sin(h),axisY:Math.cos(h)};
 for(let i=0;i<7;i++)x.e.update(1/60,x.round,x.ps);
 assert.equal(a.ice.state,'racing');
 assert.ok(Math.abs(a.ice.driftAngle)>.01,'heading must differ from travel');
 assert.ok(Math.abs(a.ice.angularVelocity)<x.e.config.turnSpeed);
 x.round.paused=true;const frozen={x:a.x,y:a.y,t:x.s.tick};
 x.e.update(1,x.round,x.ps);
 almost(a.x,frozen.x);almost(a.y,frozen.y);assert.equal(x.s.tick,frozen.t);
});
test('equal mass vehicle collision changes both velocities and separates bodies',()=>{
 const {e,ps}=match(2),[a,b]=ps;
 a.x=400;a.y=250;b.x=425;b.y=250;
 a.ice.vx=155;a.ice.vy=0;b.ice.vx=-75;b.ice.vy=0;
 e.collide(ps);
 assert.ok(a.ice.vx<155,'striking car receives recoil');
 assert.ok(b.ice.vx>-75,'struck car receives impulse');
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=27.99);
});
test('fall/respawn retains score, target and cancels old velocity',()=>{
 const {e,s,ps,round}=match(3),p=ps[0];
 p.score=3;p.ice.lastCheckpoint=3;p.ice.nextCheckpoint=0;
 p.ice.vx=190;p.ice.vy=-70;p.x=-300;p.y=-300;
 e.step(1/60,round,ps);assert.equal(p.ice.state,'falling');
 for(let i=0;i<55;i++)e.step(1/60,round,ps);
 assert.equal(p.ice.state,'racing');
 assert.equal(p.score,3);assert.equal(p.ice.nextCheckpoint,0);
 assert.equal(p.ice.vx,0);assert.equal(p.ice.vy,0);
 assert.ok(e.nearest(s,p.x,p.y).dist<s.halfWidth);
 assert.ok(p.ice.invulnerable>0);
});
test('time expiry gives 1st-place ties and stops every score',()=>{
 for(const n of [1,6,7,12]){
  const {e,s,round,ps}=match(n);
  ps.forEach((p,i)=>p.score=i%3);
  s.elapsed=s.duration-1/60;s.remaining=1/60;
  e.step(1/60,round,ps);
  assert.equal(s.finished,true);assert.equal(round.remaining,0);
  assert.ok(s.ranking.every(q=>q.rank>=1));
  assert.equal(s.winnerIds.length,ps.filter(p=>p.score===Math.min(2,n-1)).length);
  const old=ps[0].score;
  assert.equal(e.update(1/60,round,ps),'winner');assert.equal(ps[0].score,old);
 }
});
test('bot controls share physics and never move by teleporting',()=>{
 for(const n of [1,6,12]){
  const {e,s,round,ps}=match(n,true);
  for(let i=0;i<90;i++){
   const old=ps.map(p=>({x:p.x,y:p.y,state:p.ice.state}));
   e.update(1/60,round,ps);
   for(let j=0;j<n;j++){
    const p=ps[j];assert.ok(Number.isFinite(p.x+p.y+p.ice.vx+p.ice.vy));
    if(old[j].state==='racing'&&p.ice.state==='racing')
     assert.ok(Math.hypot(p.x-old[j].x,p.y-old[j].y)<10);
   }
  }
  assert.ok(s.tick>=90);
 }
});
test('party selection, timed results, board ranking and cover are registered',()=>{
 const app=fs.readFileSync('app.js','utf8'),
  html=fs.readFileSync('index.html','utf8'),
  board=fs.readFileSync('board-minigame.js','utf8'),
  build=fs.readFileSync('scripts/build-static.cjs','utf8'),
  covers=fs.readFileSync('game-cover-art.js','utf8');
 for(const term of ["ice_race:'ICE RACE'","ice_race:'IceRace'",
  "round.mode==='ice_race'","data.t==='ice-status'"])assert.ok(app.includes(term),term);
 assert.ok(html.includes('data-pick="ice_race"'));
 assert.ok(html.includes('src="./ice-race.js"'));
 assert.ok(board.includes("case 'ice_race'"));
 assert.ok(build.includes("'ice-race.js'"));
 assert.ok(covers.includes('ice_race:iceRaceScene'));
 const window={BoardDice:{shuffle:p=>p}};
 vm.runInNewContext(board,{window,console},{filename:'board-minigame.js'});
 const {round,ps}=match(4);
 ps.forEach((p,i)=>p.score=[4,3,3,1][i]);
 assert.deepEqual(Array.from(window.BoardMinigame.ranking(round,ps),p=>p.rank),[1,2,2,4]);
});
let failures=0;
for(const item of checks){try{item.fn();console.log('PASS '+item.label);}
 catch(e){failures++;console.error('FAIL '+item.label,e);}}
console.log((checks.length-failures)+'/'+checks.length+' ICE RACE tests passed');
if(failures)process.exitCode=1;
