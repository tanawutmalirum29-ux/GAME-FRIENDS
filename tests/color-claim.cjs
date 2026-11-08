/* COLOR CLAIM: territory ownership, swept kills, timed freezing and rank tie QA. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const checks=[];const check=(name,run)=>checks.push({name,run});
function make(n=2,bots=false,seed=13271){
 const ctx=vm.createContext({window:{},console,Math});
 for(const file of ['character-system.js','board-minigame.js','color-claim.js'])
  vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
 const e=ctx.window.ColorClaim,ps=Array.from({length:n},(_,i)=>({
  id:'p'+i,name:'player'+i,color:['#ff3366','#39c4ff','#60e24f','#ffcc44'][i%4],
  isBot:bots,active:true,input:{axisX:0,axisY:0}
 }));
 const round={mode:'color_claim',phase:'playing',paused:false,colorClaimSeed:seed};
 const s=e.setup(round,ps);
 return{ctx,e,ps,round,s};
}
const tick=(z,n)=>{for(let i=0;i<n;i++)z.e.step(1/60,z.round,z.ps);};
const count=(s,id)=>s.counts[id];
const poly=(points,d=0)=>points.map((p,i)=>({...p,d:i?d+=Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y):d}));
function capture(z,p,points){
 p.cc.trail=poly(points);
 z.e.applyCaptures(z.s,[p],z.ps);
}
check('map sizes, clocks, all players own equal nonoverlapping starting land',()=>{
 for(const n of [1,2,4,6,7,9,12]){
  const {e,s,ps,round}=make(n);
  assert.equal(s.w,n<=6?960:1280);
  assert.equal(s.h,n<=6?540:720);
  assert.equal(round.remaining,n<=6?40:60);
  assert.equal(new Set(ps.map(p=>p.cc.slot)).size,n);
  assert.ok(ps.every(p=>e.owned(s,p,p.x,p.y)));
  assert.ok(ps.every(p=>count(s,p.cc.slot)>0));
  assert.ok(s.counts.every((v,i)=>v===s.counts[0]),'home areas must match');
  assert.ok(ps.reduce((v,p)=>v+p.score,0)<=100+1e-9);
 }
});
check('open trail has no percentage; closing loop claims interior accurately',()=>{
 const z=make(1),p=z.ps[0],a={x:p.x,y:p.y};
 const before=count(z.s,0);
 p.cc.trail=poly([a,{x:a.x+115,y:a.y},{x:a.x+115,y:a.y+75}]);
 assert.equal(count(z.s,0),before,'unclosed trail is unscored');
 capture(z,p,[a,{x:a.x+115,y:a.y},{x:a.x+115,y:a.y+85},
   {x:a.x+20,y:a.y+85},a]);
 assert.ok(count(z.s,0)>before+30,'closed contour should own its enclosed grid');
 assert.equal(p.cc.trail.length,0);
 assert.equal(p.score,count(z.s,0)/z.s.owner.length*100);
});
check('steal land transfers scores, sums stay <= 100% and never double-owned',()=>{
 const z=make(2),[a,b]=z.ps,s=z.s;
 const x=470,y=260;
 z.e.claimDisk(s,1,x,y,30);z.e.recount(s,z.ps);
 const bBefore=count(s,1),aBefore=count(s,0);
 capture(z,a,[{x:430,y:200},{x:535,y:200},{x:535,y:335},
  {x:430,y:335},{x:430,y:200}]);
 assert.ok(count(s,0)>aBefore,'capturer gained territory');
 assert.ok(count(s,1)<bBefore,'former owner lost territory');
 assert.ok([...s.owner].every(slot=>slot>=-1&&slot<2));
 assert.ok(z.ps.reduce((v,p)=>v+p.score,0)<=100.000001);
});
check('flood does not claim the entire world for an open, edge-touching trail',()=>{
 const z=make(1),p=z.ps[0],s=z.s,before=count(s,0);
 capture(z,p,[{x:40,y:40},{x:40,y:160},{x:90,y:160}]);
 assert.ok(count(s,0)<before+s.owner.length*.05,'invalid contour captures entire world');
});
check('a crossing enemy kills trail owner while preserving owned land',()=>{
 const z=make(2),[a,b]=z.ps,s=z.s;
 const before=count(s,a.cc.slot);
 a.x=480;a.y=310;
 a.cc.trail=[{x:480,y:200,d:0},{x:480,y:310,d:110}];a.cc.distance=110;
 b.x=476;b.y=260;b.input.axisX=1;
 tick(z,3);
 assert.equal(a.cc.alive,false);
 assert.equal(a.cc.trail.length,0);
 assert.equal(count(s,a.cc.slot),before);
 tick(z,45);assert.equal(a.cc.alive,true);
 assert.ok(z.e.owned(s,a,a.x,a.y));
});
check('self cutting old segments kills owner, but the immediate head is ignored',()=>{
 const z=make(1),p=z.ps[0],s=z.s;
 p.x=510;p.y=300;
 p.cc.trail=[{x:500,y:240,d:0},{x:500,y:320,d:80},
  {x:550,y:320,d:130},{x:550,y:300,d:150},{x:510,y:300,d:190}];
 p.cc.distance=190;p.input.axisX=-1;
 tick(z,25);
 assert.equal(p.cc.alive,false);
 assert.equal(p.cc.trail.length,0);
});
check('zero-land death creates new claim and protected respawn, protection ends on exit',()=>{
 const z=make(2),[a,b]=z.ps,s=z.s;
 s.owner.fill(b.cc.slot);z.e.recount(s,z.ps);
 assert.equal(count(s,a.cc.slot),0);
 z.e.kill(s,a);tick(z,46);
 assert.equal(a.cc.alive,true);
 assert.ok(z.e.owned(s,a,a.x,a.y));
 assert.ok(count(s,a.cc.slot)>0);
 assert.ok(a.cc.invulnerable>0);
});
check('FREEZE lasts 4 simulation seconds, excludes collector, pauses and cancels on finish',()=>{
 const z=make(2),[a,b]=z.ps,s=z.s;
 s.nextItem=999;s.item={x:a.x,y:a.y};tick(z,1);
 assert.equal(s.freeze.ownerId,a.id);
 const at={x:b.x,y:b.y};b.input.axisX=1;
 tick(z,120);
 assert.equal(b.x,at.x);assert.equal(b.y,at.y);
 assert.equal(s.item,null);
 z.round.paused=true;
 const t=s.elapsed;z.e.update(1,z.round,z.ps);assert.equal(s.elapsed,t);
 z.round.paused=false;
 tick(z,121);
 assert.equal(s.freeze,null);
 tick(z,3);assert.ok(b.x>at.x,'movement must resume');
 z.e.finish(s,z.round,z.ps);assert.equal(s.freeze,null);
 assert.equal(z.round.remaining,0);
});
check('board integration and ties rank by raw tile count',()=>{
 const z=make(3),s=z.s,[a,b,c]=z.ps;
 s.owner.fill(-1);
 s.owner[0]=a.cc.slot;s.owner[1]=a.cc.slot;
 s.owner[2]=b.cc.slot;s.owner[3]=b.cc.slot;
 s.owner[4]=c.cc.slot;
 z.e.recount(s,z.ps);z.e.finish(s,z.round,z.ps);
 const ranked=z.ctx.window.BoardMinigame.ranking(z.round,z.ps);
 assert.equal(ranked.length,3);
 const own=x=>ranked.find(v=>v.id===x.id);
 assert.equal(own(a).rank,1);assert.equal(own(b).rank,1);assert.equal(own(c).rank,3);
 assert.ok(own(a).label.includes('ช่องพื้นที่'));
});
check('1, 6, 7 and 12 bots run to timed results without NaN or ownership duplication',()=>{
 for(const n of [1,6,7,12]){
  const z=make(n,true,1937+n);
  const steps=z.s.duration*60+2;
  for(let i=0;i<steps&&!z.s.finished;i++)z.e.step(1/60,z.round,z.ps);
  assert.equal(z.s.finished,true,'match timeout n='+n);
  assert.equal(z.s.ranking.length,n);
  assert.ok(z.ps.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&
   Number.isFinite(p.score)),'finite bot coordinates and percentages');
  assert.ok(z.ps.reduce((v,p)=>v+p.score,0)<=100.000001);
 }
});
let passed=0;
for(const t of checks){
 try{t.run();console.log('PASS '+t.name);passed++;}
 catch(e){console.error('FAIL '+t.name,e);process.exitCode=1;}
}
console.log(passed+'/'+checks.length+' COLOR CLAIM checks passed');
