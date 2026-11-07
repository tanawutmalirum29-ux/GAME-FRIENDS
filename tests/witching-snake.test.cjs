/* WITCHING SNAKE deterministic engine, collision and integration regressions. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('witching-snake.js','utf8');
const tests=[];
const check=(name,run)=>tests.push({name,run});
function engine(){
 const window={PartyCharacters:{control:(i={})=>{
  let x=Number(i.axisX)||Number(!!i.right)-Number(!!i.left);
  let y=Number(i.axisY)||Number(!!i.down)-Number(!!i.jump);
  const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}
  return {x,y,action:!!i.action,alt:!!i.alt};
 },resolve:(ps,opts)=>{
  assert.equal(opts.radius,12);
  for(let k=0;k<3;k++)for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){
   const a=ps[i],b=ps[j],d=Math.hypot(a.x-b.x,a.y-b.y);
   if(d>1e-8&&d<24){const v=(24-d)/2,nx=(b.x-a.x)/d,ny=(b.y-a.y)/d;
    a.x-=nx*v;a.y-=ny*v;b.x+=nx*v;b.y+=ny*v;}
  }
 }}};
 vm.runInNewContext(source,{window,Math,console},{filename:'witching-snake.js'});
 return window.WitchingSnake;
}
function roster(n){
 return Array.from({length:n},(_,i)=>({id:'p'+i,name:'แม่มด '+i,color:'#ff628c',
  active:true,isBot:false,input:{axisX:0,axisY:0,action:false,alt:false}}));
}
function game(n){
 const e=engine(),round={mode:'witching_snake',phase:'playing',paused:false},ps=roster(n);
 const s=e.setup(round,ps);return{e,round,ps,s};
}
function approx(a,b,eps=1e-6){assert.ok(Math.abs(a-b)<=eps,a+' !== '+b);}
check('supports 1, 2, 4, 6, 7, 9 and 12 separated, valid spawns',()=>{
 for(const n of [1,2,4,6,7,9,12]){
  const {e,ps,s}=game(n);
  assert.equal(s.w,n<=6?960:1280);
  assert.equal(s.h,n<=6?540:720);
  for(const p of ps)assert.equal(e.inside(s,p.x,p.y,35),true,'invalid spawn '+n);
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)
   assert.ok(Math.hypot(ps[i].x-ps[j].x,ps[i].y-ps[j].y)>=24,'overlapping spawns');
 }
});
check('60Hz coasting, pause and no early trail during countdown',()=>{
 const {e,round,ps,s}=game(1),p=ps[0],start={x:p.x,y:p.y};
 round.phase='countdown';e.update(.5,round,ps);
 approx(p.x,start.x);assert.equal(p.ws.trail.length,0);assert.equal(s.tick,0);
 round.phase='playing';e.update(1/60,round,ps);
 assert.ok(Math.hypot(p.x-start.x,p.y-start.y)>2);
 assert.ok(p.ws.trail.length>0);assert.equal(s.tick,1);
 round.paused=true;const before={x:p.x,y:p.y,t:s.tick};
 e.update(1,round,ps);approx(p.x,before.x);approx(p.y,before.y);assert.equal(s.tick,before.t);
});
check('90/180 degree turns are gradual; thrust is constant and A/B have no effect',()=>{
 const g=game(1),other=game(1),p=g.ps[0],q=other.ps[0],start=p.ws.heading;
 p.input={axisX:-Math.sin(start),axisY:Math.cos(start),action:true,alt:true};
 q.input={axisX:-Math.sin(start),axisY:Math.cos(start),action:false,alt:false};
 for(let t=0;t<8;t++){g.e.update(1/60,g.round,g.ps);other.e.update(1/60,other.round,other.ps);}
 const turned=Math.abs(Math.atan2(Math.sin(p.ws.heading-start),Math.cos(p.ws.heading-start)));
 assert.ok(turned>.01&&turned<Math.PI/2,'instant 90 degree rotation');
 approx(p.x,q.x);approx(p.y,q.y);
 const turnBefore=p.ws.heading;
 p.input.axisX=-Math.cos(turnBefore);p.input.axisY=-Math.sin(turnBefore);
 g.e.update(1/60,g.round,g.ps);
 assert.ok(Math.abs(Math.atan2(Math.sin(p.ws.heading-turnBefore),Math.cos(p.ws.heading-turnBefore)))<.05);
 assert.ok(Math.abs(p.ws.angular)<=g.e.config.turnMax);
});
check('continuous segment hit detects crossings and grazing',()=>{
 const {e}=game(1),a={x:0,y:10},b={x:20,y:10},c={x:10,y:0},d={x:10,y:20};
 assert.equal(e.segmentsTouch(a,b,c,d,0),true);
 assert.equal(e.segmentsTouch({x:0,y:15},{x:20,y:15},c,d,0),true);
 assert.equal(e.segmentsTouch({x:0,y:35},{x:20,y:35},c,d,0),false);
 assert.equal(e.segmentsTouch({x:0,y:10},{x:3,y:10},{x:25,y:10},{x:35,y:10},0),false);
 assert.equal(e.segmentsTouch({x:0,y:28},{x:20,y:28},c,d,9),true);
});
check('old self trails and enemy trails kill but own newest segment is exempt',()=>{
 const {e,ps,s}=game(2),a=ps[0],b=ps[1];
 a.ws.trail=[{x:10,y:10,d:0},{x:50,y:10,d:40},{x:90,y:10,d:100},{x:130,y:10,d:200}];
 a.ws.distance=200;
 b.ws.trail=[];e.indexTrails(s,ps);
 assert.equal(e.strikesTrail(s,a,{x:30,y:0},{x:30,y:20}),true);
 assert.equal(e.strikesTrail(s,a,{x:120,y:0},{x:120,y:20}),false);
 assert.equal(e.strikesTrail(s,b,{x:120,y:0},{x:120,y:20}),true);
});
check('real-world-length trimming and maximum length bounds trail storage',()=>{
 const {e,ps}=game(1),p=ps[0];
 p.ws.trailCap=190;
 for(let i=0;i<200;i++){p.x+=7;e.addTrail(p);}
 const trail=p.ws.trail;
 assert.ok(trail.length<40,'unbounded trail');
 approx(trail.at(-1).d-trail[0].d,190,.01);
 assert.ok(trail.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.d)));
});
check('star pickup extends limit, but not beyond configured cap',()=>{
 const {e,s,round,ps}=game(1),p=ps[0],start=p.ws.trailCap;
 s.starClock=999;s.stars=[{x:p.x,y:p.y,phase:0}];
 e.step(1/60,round,ps);assert.equal(p.ws.trailCap,start+48);
 assert.equal(p.ws.stars,1);assert.equal(s.stars.length,0);
 p.ws.trailCap=s.settings.trailMax-3;
 s.stars=[{x:p.x,y:p.y,phase:0}];e.step(1/60,round,ps);
 assert.equal(p.ws.trailCap,s.settings.trailMax);
});
check('hitting arena boundary eliminates and no respawn occurs',()=>{
 const {e,s,round,ps}=game(1),p=ps[0];
 p.x=s.w/2+s.rx-13;p.y=s.h/2;p.ws.heading=0;p.ws.moveHeading=0;
 e.step(1/60,round,ps);assert.equal(p.ws.alive,false);
 assert.equal(s.finished,true);const tick=p.ws.eliminatedTick;
 e.update(1,round,ps);assert.equal(p.ws.alive,false);
 assert.equal(p.ws.eliminatedTick,tick);
});
check('same simulation tick simultaneous deaths produce genuine tied ranks',()=>{
 const {e,s,round,ps}=game(2),a=ps[0],b=ps[1];
 a.x=s.w/2+s.rx-13;a.y=s.h/2;a.ws.heading=0;a.ws.moveHeading=0;
 b.x=s.w/2-s.rx+13;b.y=s.h/2;b.ws.heading=Math.PI;b.ws.moveHeading=Math.PI;
 e.step(1/60,round,ps);
 assert.equal(s.finished,true);assert.equal(s.winnerIds.length,0);
 assert.deepEqual(Array.from(s.ranking,r=>r.rank),[1,1]);
});
check('solo survival at 60 seconds is a success',()=>{
 const {e,s,round,ps}=game(1),p=ps[0];
 s.clock=59.99;
 e.step(1/60,round,ps);
 assert.equal(s.finished,true);
 assert.deepEqual(Array.from(s.winnerIds),[p.id]);
});
check('bots use physical steering and never teleport',()=>{
 const {e,ps,s,round}=game(4);
 for(const p of ps)p.isBot=true;
 for(let i=0;i<15&&!s.finished;i++){
  const before=ps.map(p=>({x:p.x,y:p.y}));
  e.update(1/60,round,ps);
  ps.forEach((p,k)=>{
   assert.ok(Math.abs(p.ws.angular)<=e.config.turnMax+1e-7);
   assert.ok(Math.hypot(p.x-before[k].x,p.y-before[k].y)<10,'bot teleported');
  });
 }
 assert.ok(s.tick>0);
});
check('existing party, board, asset and controller paths are wired',()=>{
 const app=fs.readFileSync('app.js','utf8'),
  html=fs.readFileSync('index.html','utf8'),
  board=fs.readFileSync('board-minigame.js','utf8'),
  build=fs.readFileSync('scripts/build-static.cjs','utf8');
 for(const token of ["witching_snake:'WITCHING SNAKE'","witching_snake:'WitchingSnake'",
  "endWitchingSnakeRound","witch-status","p.ws?.eliminatedTick"])assert.ok(app.includes(token),token);
 assert.ok(html.includes('data-pick="witching_snake"'));
 assert.ok(html.includes('src="./witching-snake.js"'));
 assert.ok(board.includes("case 'witching_snake'"));
 assert.ok(build.includes("'witching-snake.js'"));
});
let failures=0;
for(const t of tests){
 try{t.run();console.log('PASS '+t.name);}
 catch(error){failures++;console.error('FAIL '+t.name,error);}
}
console.log((tests.length-failures)+'/'+tests.length+' WITCHING SNAKE checks passed');
if(failures)process.exitCode=1;
