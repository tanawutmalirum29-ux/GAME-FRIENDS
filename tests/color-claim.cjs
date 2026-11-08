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
// A one-tile-wide connected invader path, exactly like the result of a
// successfully closed capture. Do not create disconnected fake enemy islands.
function landPath(s,slot,from,to){
 let a=Math.floor((from.x-s.field.x)/10),b=Math.floor((from.y-s.field.y)/10);
 const x2=Math.floor((to.x-s.field.x)/10),y2=Math.floor((to.y-s.field.y)/10);
 const paint=()=>{s.owner[b*s.cols+a]=slot;};
 paint();
 while(a!==x2){a+=Math.sign(x2-a);paint();}
 while(b!==y2){b+=Math.sign(y2-b);paint();}
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
 s.owner.fill(-1);
 z.e.claimDisk(s,0,130,125,30);
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
check('zero land is a permanent elimination and can never regenerate an island',()=>{
 const z=make(2),[a,b]=z.ps,s=z.s;
 s.owner.fill(b.cc.slot);z.e.recount(s,z.ps);
 assert.equal(count(s,a.cc.slot),0);
 assert.equal(a.cc.alive,false);
 assert.equal(a.cc.eliminated,true);
 z.e.kill(s,a);tick(z,120);
 assert.equal(a.cc.alive,false);
 assert.equal(z.e.revive(s,a,z.ps),false);
 assert.equal(count(s,a.cc.slot),0);
 assert.equal(a.score,0);
 assert.equal(z.e.hud(z.ps,z.round).survivors,1);
});
check('disconnected small islands become neutral and respawn uses only the retained largest',()=>{
 const z=make(2),[a,b]=z.ps,s=z.s;
 s.owner.fill(-1);
 z.e.claimDisk(s,a.cc.slot,130,125,21);
 z.e.claimDisk(s,a.cc.slot,680,345,55);
 z.e.claimDisk(s,b.cc.slot,470,260,30);
 z.e.recount(s,z.ps);
 const land=z.e.largestTerritory(s,a.cc.slot);
 assert.ok(land.size>40,'dominant island exists');
 const small=z.e.index(s,130,125),large=z.e.index(s,680,345);
 assert.equal(s.owner[small],-1,'small component vanishes at recount');
 assert.equal(s.owner[large],a.cc.slot);
 assert.equal(land.size,count(s,a.cc.slot),'only the retained component is counted');
 z.e.kill(s,a);tick(z,45);
 assert.equal(a.cc.alive,true);
 assert.equal(a.cc.eliminated,false);
 assert.ok(z.e.owned(s,a,a.x,a.y));
 assert.ok(Math.hypot(a.x-680,a.y-345)<65,'must spawn on larger island');
 assert.ok(Math.hypot(a.x-130,a.y-125)>200,'must not choose smaller fragment');
 assert.ok(a.cc.invulnerable>0);
});
check('stolen origin during open loop kills instantly and respawns on remaining own land',()=>{
 const z=make(2),[a,b]=z.ps,s=z.s;
 z.e.claimDisk(s,a.cc.slot,a.x,a.y,70);z.e.recount(s,z.ps);
 const origin={x:a.x,y:a.y},anchor=z.e.index(s,a.x,a.y);
 a.cc.anchor=anchor;a.cc.origin=origin;
 a.cc.trail=poly([origin,{x:origin.x+70,y:origin.y+10}]);
 a.cc.distance=71;
 const before=count(s,a.cc.slot);
 landPath(s,b.cc.slot,b,origin);
 z.e.recount(s,z.ps);
 assert.notEqual(s.owner[anchor],a.cc.slot,'unplayable enemy stripe still severs the anchor');
 assert.ok(count(s,a.cc.slot)>0&&count(s,a.cc.slot)<before);
 assert.equal(a.cc.alive,false,'original loop no longer connects to this colour');
 assert.equal(a.cc.eliminated,false,'other friendly land remains');
 assert.equal(a.cc.trail.length,0);
 assert.equal(a.cc.anchor,null);
 tick(z,43);
 assert.equal(a.cc.alive,true);
 assert.ok(z.e.owned(s,a,a.x,a.y));
 assert.notEqual(z.e.index(s,a.x,a.y),anchor);
});
check('captured respawn tile triggers new death instead of leaving protected player on enemy land',()=>{
 const z=make(2),[a,b]=z.ps,s=z.s;
 z.e.claimDisk(s,a.cc.slot,a.x,a.y,65);z.e.recount(s,z.ps);
 z.e.kill(s,a);tick(z,43);
 assert.equal(a.cc.alive,true);
 assert.ok(a.cc.invulnerable>0);
 const spawn={x:a.x,y:a.y};
 landPath(s,b.cc.slot,b,spawn);
 z.e.recount(s,z.ps);
 assert.equal(a.cc.alive,false);
 assert.equal(a.cc.eliminated,false);
 tick(z,43);
 assert.equal(a.cc.alive,true);
 assert.ok(z.e.owned(s,a,a.x,a.y));
 assert.ok(Math.hypot(a.x-spawn.x,a.y-spawn.y)>1,'must pick a new owned tile');
});
check('a capture slices enemy land: retain the largest side, neutralize every smaller side',()=>{
 const z=make(2),[victim,attacker]=z.ps,s=z.s,cols=s.cols;
 s.owner.fill(-1);
 // Left block: 10 columns, right block: 27 columns. Both initially joined.
 for(let y=8;y<26;y++)for(let x=7;x<45;x++)s.owner[y*cols+x]=victim.cc.slot;
 z.e.claimDisk(s,attacker.cc.slot,650,385,30);
 z.e.recount(s,z.ps);
 const before=count(s,victim.cc.slot);
 assert.equal(before,38*18,'continuous territory starts fully owned');
 for(let y=8;y<26;y++)s.owner[y*cols+17]=attacker.cc.slot;
 // The attacking stripe connects to the attacker's own land via a neutral
 // outer corridor; detached fragments, not invalid attacker islands, vanish.
 landPath(s,attacker.cc.slot,{x:650,y:385},
  {x:s.field.x+(17+.5)*10,y:s.field.y+(8+.5)*10});
 // Simulated final ownership transfer from a thin enemy cut.
 z.e.recount(s,z.ps);
 assert.equal(count(s,victim.cc.slot),27*18,'only 27-column right side remains');
 assert.equal(s.owner[15*cols+9],-1,'cut off 10-column piece is neutral');
 assert.equal(s.owner[15*cols+17],-1,
  'too-narrow attacker stroke is also neutral rather than unfairly owned');
 assert.equal(s.owner[15*cols+35],victim.cc.slot);
 assert.ok(count(s,victim.cc.slot)<before);
 assert.ok(Math.abs(victim.score-count(s,victim.cc.slot)/s.owner.length*100)<1e-9);
 const contours=z.e.buildContours(s);
 assert.equal(contours[victim.cc.slot].length,1,'render only one continuous island');
});
check('a cut makes three pieces: two smaller pieces vanish simultaneously',()=>{
 const z=make(2),[victim,attacker]=z.ps,s=z.s,cols=s.cols;
 s.owner.fill(-1);
 for(let y=7;y<20;y++)for(let x=6;x<52;x++)s.owner[y*cols+x]=victim.cc.slot;
 z.e.claimDisk(s,attacker.cc.slot,750,370,30);
 z.e.recount(s,z.ps);
 for(let y=7;y<20;y++){
  s.owner[y*cols+14]=attacker.cc.slot;
  s.owner[y*cols+30]=attacker.cc.slot;
 }
 landPath(s,attacker.cc.slot,{x:750,y:370},
  {x:s.field.x+(14+.5)*10,y:s.field.y+(7+.5)*10});
 landPath(s,attacker.cc.slot,{x:750,y:370},
  {x:s.field.x+(30+.5)*10,y:s.field.y+(7+.5)*10});
 z.e.recount(s,z.ps);
 assert.equal(count(s,victim.cc.slot),21*13,
  'largest component after cuts x=31..51 stays');
 assert.equal(s.owner[10*cols+10],-1);
 assert.equal(s.owner[10*cols+23],-1);
 assert.equal(s.owner[10*cols+43],victim.cc.slot);
 assert.equal(s.owner[10*cols+30],-1,'a one-cell attacker cut cannot be retained');
 assert.equal(s.owner[10*cols+14],-1,'both hairline cuts are neutral');
});
check('a one-cell bridge fails clearance, while a three-cell-wide bridge stays playable',()=>{
 const mk=(width)=>{
  const z=make(2),[a,b]=z.ps,s=z.s;
  s.owner.fill(-1);
  for(let y=10;y<25;y++)for(let x=5;x<18;x++)s.owner[y*s.cols+x]=a.cc.slot;
  for(let y=10;y<25;y++)for(let x=39;x<57;x++)s.owner[y*s.cols+x]=a.cc.slot;
  for(let y=17;y<17+width;y++)for(let x=18;x<39;x++)s.owner[y*s.cols+x]=a.cc.slot;
  z.e.claimDisk(s,b.cc.slot,690,370,35);
  z.e.recount(s,z.ps);
  return {z,s,a};
 };
 const narrow=mk(1),wide=mk(3);
 assert.equal(narrow.s.owner[17*narrow.s.cols+27],-1,
  'one-cell bottleneck is impossible for the avatar');
 assert.equal(narrow.s.owner[14*narrow.s.cols+10],-1,
  'small left lobe is no longer reachable');
 assert.equal(narrow.s.owner[14*narrow.s.cols+46],narrow.a.cc.slot);
 assert.equal(wide.s.owner[18*wide.s.cols+27],wide.a.cc.slot,
  'three-cell-wide bridge remains traversable');
 assert.equal(wide.s.owner[14*wide.s.cols+10],wide.a.cc.slot,
  'wide bridge keeps both lobes connected');
});
check('diagonal-only connections do not preserve a smaller detached island',()=>{
 const z=make(2),[a,b]=z.ps,s=z.s;
 s.owner.fill(-1);
 for(let y=5;y<14;y++)for(let x=5;x<14;x++)s.owner[y*s.cols+x]=a.cc.slot;
 for(let y=14;y<27;y++)for(let x=14;x<27;x++)s.owner[y*s.cols+x]=a.cc.slot;
 z.e.claimDisk(s,b.cc.slot,680,360,35);z.e.recount(s,z.ps);
 assert.equal(s.owner[8*s.cols+8],-1);
 assert.equal(s.owner[20*s.cols+20],a.cc.slot);
});
check('thin fingers vanish but a broad peninsula survives repeated recounts',()=>{
 const z=make(2),[a,b]=z.ps,s=z.s;
 s.owner.fill(-1);
 for(let y=15;y<32;y++)for(let x=12;x<30;x++)s.owner[y*s.cols+x]=a.cc.slot;
 for(let y=30;y<46;y++){
  s.owner[y*s.cols+17]=a.cc.slot;
  s.owner[y*s.cols+18]=a.cc.slot;
 }
 // A 3-cell-wide extension is genuinely wide enough to navigate.
 for(let y=30;y<43;y++)for(let x=22;x<25;x++)s.owner[y*s.cols+x]=a.cc.slot;
 z.e.claimDisk(s,b.cc.slot,710,320,35);
 z.e.recount(s,z.ps);
 const before=count(s,a.cc.slot);
 assert.equal(s.owner[41*s.cols+17],-1,'narrow finger is stripped');
 assert.equal(s.owner[38*s.cols+23],a.cc.slot,'broad extension survives');
 assert.equal(s.owner[23*s.cols+18],a.cc.slot,'main area is not eroded away');
 z.e.recount(s,z.ps);
 assert.equal(count(s,a.cc.slot),before,'normalization is idempotent');
 assert.ok(Math.abs(a.score-before/s.owner.length*100)<1e-9);
 const outline=z.e.buildContours(s);
 assert.equal(outline[a.cc.slot].length,1,'one practical continuous island');
});
check('a territory thinner than avatar diameter has zero score and no respawn',()=>{
 const z=make(2),[a,b]=z.ps,s=z.s;
 s.owner.fill(-1);
 for(let y=8;y<35;y++)for(let x=8;x<10;x++)s.owner[y*s.cols+x]=a.cc.slot;
 z.e.claimDisk(s,b.cc.slot,650,330,35);z.e.recount(s,z.ps);
 assert.equal(count(s,a.cc.slot),0);
 assert.equal(a.cc.eliminated,true);
 assert.equal(z.e.spawnPlace(s,a,z.ps),null);
});
check('victim on a detached patch dies and respawns on surviving main region',()=>{
 const z=make(2),[victim,attacker]=z.ps,s=z.s,cols=s.cols;
 s.owner.fill(-1);
 for(let y=8;y<25;y++)for(let x=7;x<46;x++)s.owner[y*cols+x]=victim.cc.slot;
 z.e.claimDisk(s,attacker.cc.slot,720,350,30);
 z.e.recount(s,z.ps);
 victim.x=s.field.x+(10+.5)*10;victim.y=s.field.y+(15+.5)*10;
 victim.cc.invulnerable=0;victim.cc.trail=[];
 for(let y=8;y<25;y++)s.owner[y*cols+19]=attacker.cc.slot;
 z.e.recount(s,z.ps);
 assert.equal(victim.cc.alive,false,'standing on lost territory forces a real death');
 assert.equal(victim.cc.eliminated,false,'larger region is still owned');
 tick(z,43);
 assert.equal(victim.cc.alive,true);
 assert.ok(z.e.owned(s,victim,victim.x,victim.y));
 assert.ok(victim.x>s.field.x+20*10,'respawned on main, not detached, region');
});
check('smooth territory contours follow ownership and are cached between captures',()=>{
 const z=make(2),s=z.s;
 const original=z.e.buildContours(s);
 assert.equal(original.length,2);
 assert.ok(original.every(loops=>loops.length>0));
 const stats={curves:0,rectangles:0};
 const no=()=>{};
 const g=new Proxy({quadraticCurveTo(){stats.curves++;},fillRect(){stats.rectangles++;}},
  {get(target,key){return key in target?target[key]:no;},set(target,key,value){target[key]=value;return true;}});
 z.e.draw(g,0,z.round,z.ps);
 assert.ok(stats.curves>12,'SVG-like quadratic contours are rendered');
 assert.ok(stats.rectangles<20,'no per-tile rectangle paints remain');
 assert.equal(s.dirty,false);
 const cached=s.contours;
 z.e.draw(g,0,z.round,z.ps);
 assert.equal(s.contours,cached,'no contour rebuild without ownership change');
 z.e.claimDisk(s,z.ps[0].cc.slot,470,260,35);
 z.e.recount(s,z.ps);z.e.draw(g,0,z.round,z.ps);
 assert.notEqual(s.contours,cached,'capture invalidates curved contour cache');
 assert.equal(s.dirty,false);
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
 // Every ranking fixture must represent land an actual character can stand on.
 for(let y=6;y<11;y++)for(let x=6;x<11;x++)s.owner[y*s.cols+x]=a.cc.slot;
 for(let y=6;y<11;y++)for(let x=18;x<23;x++)s.owner[y*s.cols+x]=b.cc.slot;
 for(let y=6;y<9;y++)for(let x=32;x<35;x++)s.owner[y*s.cols+x]=c.cc.slot;
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
