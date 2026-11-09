/* WITCHING SNAKE deterministic engine, collision and integration regressions. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('src/games/witching-snake/witching-snake.js','utf8');
const tests=[];
const check=(name,run)=>tests.push({name,run});
function engine(doc){
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
 const sandbox={window,Math,console,...(doc?{document:doc}:{})};
 vm.runInNewContext(fs.readFileSync('party-arena-scenes.js','utf8'),sandbox,{filename:'party-arena-scenes.js'});
 vm.runInNewContext(source,sandbox,{filename:'src/games/witching-snake/witching-snake.js'});
 return window.WitchingSnake;
}
function roster(n){
 return Array.from({length:n},(_,i)=>({id:'p'+i,name:'แม่มด '+i,color:'#ff628c',
  active:true,isBot:false,input:{axisX:0,axisY:0,action:false,alt:false}}));
}
function game(n,doc,witchSeed=1337){
 // Match spawns now vary by seed. Physics comparisons need the same starting
 // state; normal, unseeded gameplay still receives fresh entropy per match.
 const e=engine(doc),round={mode:'witching_snake',phase:'playing',paused:false,witchSeed},ps=roster(n);
 const s=e.setup(round,ps);return{e,round,ps,s};
}
function approx(a,b,eps=1e-6){assert.ok(Math.abs(a-b)<=eps,a+' !== '+b);}
check('explicit QA seed reproduces spawns while different seeds vary them',()=>{
 const positions=g=>g.ps.map(p=>[p.x,p.y,p.ws.heading]);
 for(const n of [1,6,12]){
  assert.deepEqual(positions(game(n,undefined,1337)),positions(game(n,undefined,1337)));
  assert.notDeepEqual(positions(game(n,undefined,1337)),positions(game(n,undefined,977)));
 }
});
check('supports 1, 2, 4, 6, 7, 9 and 12 separated, valid spawns',()=>{
 for(const n of [1,2,4,6,7,9,12]){
  const {e,ps,s}=game(n);
  assert.equal(s.w,n<=6?960:1280);
  assert.equal(s.h,n<=6?540:720);
  assert.ok(2*s.rx/s.w>.60&&2*s.rx/s.w<.78,'compact arena reserves visible margins for shrines and groves');
  assert.ok(2*s.ry/s.h>.8&&2*s.ry/s.h<.85,'top and bottom rails remain fully in frame');
  for(const p of ps)assert.equal(e.inside(s,p.x,p.y,35),true,'invalid spawn '+n);
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)
   assert.ok(Math.hypot(ps[i].x-ps[j].x,ps[i].y-ps[j].y)>=24,'overlapping spawns');
 }
});
check('broad faceted oval has matching playable and collision bounds',()=>{
 for(const n of [1,6,7,12]){
  const {e,s}=game(n),x=s.w/2,y=s.h/2;
  assert.equal(e.inside(s,x,y,20),true);
  // Faceted ends stay wide; the actual right rail is almost at the world edge.
  assert.equal(e.inside(s,x+s.rx-36,y,12),true);
  assert.equal(e.inside(s,x+s.rx-7,y,12),false);
  assert.equal(e.inside(s,x+s.rx+1,y),false);
  assert.equal(e.inside(s,x,y-s.ry+27,12),true);
  assert.equal(e.inside(s,x,y-s.ry+2,12),false);
  assert.equal(e.inside(s,x+s.rx*.97,y-s.ry*.92,0),false,'facet corners clip the playfield');
 }
});
check('new arena scenery is cached after first vector render',()=>{
 let allocations=0,blits=0,paint=0;
 const gradient=()=>({addColorStop(){}});
 const mock=new Proxy({},{
  get(_,key){
   if(key==='createLinearGradient'||key==='createRadialGradient')return gradient;
   if(key==='drawImage')return()=>{blits++;};
   if(key==='fillRect'||key==='fill')return()=>{paint++;};
   return()=>{};
  },
  set(){return true;}
 });
 const doc={createElement(tag){
  assert.equal(tag,'canvas');allocations++;
  return{width:0,height:0,getContext:()=>mock};
 }};
 const {e,ps,s,round}=game(12,doc);
 assert.equal(s.w,1280);
 e.draw(mock,.1,round,ps);
 e.draw(mock,.2,round,ps);
 assert.equal(allocations,1,'scenery canvas allocated only once per round');
 assert.ok(paint>25,'new detailed arena drawn into the backdrop');
 assert.equal(blits,2,'later frames reuse cached scenery');
 assert.equal(s.boundary.length,12,'cached scenery uses the authoritative 12-sided rail');
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
  board=fs.readFileSync('src/board-party/runtime/board-minigame.js','utf8'),
  build=fs.readFileSync('scripts/build-static.cjs','utf8');
 assert.match(app,/"witching_snake": \{[\s\S]*?"name": "WITCHING SNAKE",[\s\S]*?"global": "WitchingSnake"/,
  'generated metadata preserves WITCHING SNAKE title and engine');
 for(const token of ["endPluginRound","witch-status"])assert.ok(app.includes(token),token);
 assert.match(fs.readFileSync('src/games/witching-snake/witching-snake.js','utf8'),/p\.ws\?\.eliminatedTick/);
 const manifest=JSON.parse(fs.readFileSync('src/games/witching-snake/manifest.json','utf8'));
 assert.deepEqual(manifest.modes,['normal','board'],'manifest enables both party modes');
 assert.match(fs.readFileSync('src/games/witching-snake/game.js','utf8'),
  /import '.\/witching-snake.js'/,'game entry imports its own engine');
 assert.doesNotMatch(html,/data-pick="/,'picker is generated at runtime');
 assert.doesNotMatch(html,/src="\.\/src\/games\//,'game engine is not an eager HTML dependency');
 assert.ok(board.includes("plugin.getResult"),"BOARD must use game-owned scoring");
 assert.match(build,/const deployAsset=/,'build automatically versions referenced assets');
});
let failures=0;
for(const t of tests){
 try{t.run();console.log('PASS '+t.name);}
 catch(error){failures++;console.error('FAIL '+t.name,error);}
}
console.log((tests.length-failures)+'/'+tests.length+' WITCHING SNAKE checks passed');
if(failures)process.exitCode=1;
