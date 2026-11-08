/* Physical gates, full-flock storage, visible boundary transforms and all room sizes. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let seed=271828;
const math=Object.create(Math);math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
const host=vm.createContext({window:{},Math:math,Date});
for(const file of ['arena-art.js','player-avatar.js','combat-motion.js','character-system.js','farm-ice-art.js','chickens.js','snow-brawl.js','boulder-bash.js'])
 vm.runInContext(fs.readFileSync(file,'utf8'),host,{filename:file});
const {Chickens:Ch,SnowBrawl:Sn,BoulderBash:Bo,FarmIceArt:Art}=host.window;
const players=n=>Array.from({length:n},(_,i)=>({id:'p'+i,name:'Player '+i,color:'#51afe9',type:'remote',isBot:false,active:true,input:{},score:0}));
const make=(engine,n)=>{const ps=players(n),round={phase:'playing',boulderSeed:42};engine.setup(round,ps);round.phase='playing';return {ps,round};};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function insidePen(p,q){
 if(p.rect)return q.x>p.rect.x&&q.x<p.rect.x+p.rect.w&&q.y>p.rect.y&&q.y<p.rect.y+p.rect.h;
 const x=q.x-p.gatePosition.x,y=q.y-p.gatePosition.y,d=x*p.normal.x+y*p.normal.y,t=x*p.tangent.x+y*p.tangent.y;
 return d>0&&d<p.depth&&Math.abs(t)<p.width/2;
}
for(let n=1;n<=12;n++){
 const {ps,round}=make(Ch,n),s=round.chickens;
 for(const pen of s.pens){
  assert.ok(pen.slots.length>=s.totalChickens,'any pen can contain the entire finite flock: '+n);
  assert.equal(new Set(pen.slots.map(p=>p.x+','+p.y)).size,pen.slots.length);
  for(const slot of pen.slots){
   assert.ok(insidePen(pen,slot),'stored bird is inside its own painted pen');
   assert.ok(dist(slot,s.center)>s.radius+12,'penned birds stay outside the playable circle');
   assert.ok(slot.x>8&&slot.y>8&&slot.x<s.world.w-8&&slot.y<s.world.h-8,'storage remains on screen');
   for(const other of s.pens)if(other!==pen)assert.equal(insidePen(other,slot),false,'different owners have separate storage');
  }
  for(const corner of pen.corners||[]){
   assert.ok(corner.x>=0&&corner.y>=0&&corner.x<=s.world.w&&corner.y<=s.world.h,'fences stay inside world');
  }
  const p=ps.find(p=>p.id===pen.ownerId);
  p.x=s.center.x+pen.normal.x*(s.radius-16);p.y=s.center.y+pen.normal.y*(s.radius-16);p.dir=pen.normal;
  assert.ok(Ch.gateInside(s,pen,Ch.goalHead(p)),'the true gate is reachable without walking through the circular fence');
  for(const other of s.pens)if(other!==pen)assert.equal(Ch.gateInside(s,other,Ch.goalHead(p)),false,'gates cannot award two owners');
 }
 if(n===4){
  assert.deepEqual(Array.from(s.pens,p=>[Math.sign(p.normal.x),Math.sign(p.normal.y)]),[[-1,-1],[1,-1],[-1,1],[1,1]]);
  assert.ok(s.pens.every(p=>p.rect.w>250&&p.rect.h>220),'four broad corner yards');
 }
 // Exercise real dwell/deposit/refill for every gate, including a 61-bird win
 // in ONE pen. This catches slot wrapping and incorrect placement after refill.
 for(let pi=0;pi<n;pi++){
  const m=make(Ch,n),state=m.round.chickens,pen=state.pens[pi],carrier=m.ps[pi];
  for(const p of m.ps)p.active=p===carrier;
  carrier.x=state.center.x+pen.normal.x*(state.radius-16);
  carrier.y=state.center.y+pen.normal.y*(state.radius-16);carrier.dir=pen.normal;
  for(let k=0;k<state.totalChickens;k++){
   const bird=state.chickens.find(c=>c.status==='free');assert.ok(bird,'reserve replenishes a scored bird');
   bird.status='carried';bird.carrierId=carrier.id;carrier.carriedChickenId=bird.id;
   Ch.update(.08,m.round,m.ps);Ch.update(.08,m.round,m.ps);
   assert.equal(bird.status,'penned');assert.equal(bird.penId,pen.id);assert.ok(insidePen(pen,bird));
   assert.equal(carrier.score,k+1,'one point per actual deposit');
  }
  assert.equal(new Set(state.chickens.map(c=>c.x+','+c.y)).size,state.totalChickens,'no storage slot wraps');
  assert.equal(state.remainingReserve,0);assert.equal(Ch.update(.02,m.round,m.ps),'winner');
 }
 const snow=make(Sn,n).round.snowBrawl,scale=Sn.viewScale(snow);
 assert.ok(snow.radius*scale>=225&&snow.radius*scale<=226);
 const radius=snow.radius;
 for(const ratio of [1,.7,.2,0]){snow.radius=radius*ratio;assert.equal(Sn.viewScale(snow),scale,'sudden death never zooms in');}
 const b=make(Bo,n),bounds=b.round.boulderBash.bounds;
 assert.deepEqual(JSON.parse(JSON.stringify(bounds)),{x:218,y:58,w:677,h:428});
 for(const p of b.ps){
  assert.ok(p.x-Bo.config.radius>bounds.x&&p.x+Bo.config.radius<bounds.x+bounds.w);
  assert.ok(p.y-Bo.config.radius>bounds.y&&p.y+Bo.config.radius<bounds.y+bounds.h);
 }
}
// The carried SVG beak tip is (48,24), relative to the center (32,24),
// rendered at 48/64 scale. It must be the same point that crosses the gate.
assert.ok(Art.chickenSVG().includes('m44 21 4 3-4 3Z'));
for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
 const p={x:450,y:260,dir:{x:Math.cos(angle),y:Math.sin(angle)}},head=Ch.goalHead(p);
 assert.ok(dist(head,{x:p.x+p.dir.x*(Ch.constants.carryOffset+(48-32)*48/64),y:p.y+p.dir.y*(Ch.constants.carryOffset+(48-32)*48/64)})<1e-8);
}
// Assert the actual raster transform, rather than a separate drawing constant.
{
 const artHost=vm.createContext({window:{},Math:math,Image:class{constructor(){this.complete=true;this.naturalWidth=512;}}});
 vm.runInContext(fs.readFileSync('farm-ice-art.js','utf8'),artHost);
 for(const radius of [188,216,244,276,312,30]){
  let args;artHost.window.FarmIceArt.island({drawImage(...v){args=v;}},{radius});
  const [,x,y,w,h]=args;
  assert.ok(Math.abs(x+256*w/512)<1e-8&&Math.abs(y+250*h/512)<1e-8,'SVG surface center is physical origin');
  assert.ok(Math.abs(220*w/512-radius)<1e-8,'surface edge is elimination radius');
 }
}
const bots=[];
for(const [label,engine,key,limit] of [['chickens',Ch,'chickens',45],['snow',Sn,'snowBrawl',125],['boulder',Bo,'boulderBash',240]]){
 for(let n=1;n<=12;n++){
  const {ps,round}=make(engine,n);ps.forEach(p=>{p.isBot=true;p.type='local';});let result,ticks=0;
  while(result!=='winner'&&ticks<limit*60){result=engine.update(1/60,round,ps);ticks++;}
  assert.equal(result,'winner',label+' '+n+' bots must finish');
  assert.ok(ps.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.score)));
  bots.push({mode:label,n,seconds:Math.round(ticks/60)});
 }
}
console.log('FARM/ICE PASS: 1–12 layouts, every gate/full-flock deposits, distinct storage, SVG beak and ice boundaries, 36 complete bot rounds. '+JSON.stringify(bots));
