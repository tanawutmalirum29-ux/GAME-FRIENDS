/* node tests/lawn-mower.cjs — gameplay, fairness, bots and integration checks. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const sandbox={window:{},Math,Date};
for(const f of ['character-system.js','src/games/lawn-mower/lawn-mower.js'])
 vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),sandbox,{filename:f});
const G=sandbox.window.LawnMower;
assert.equal(G.config.speed,50.75,'30% slower than the previous 72.5 units/second');
assert.equal(G.config.bladeHalfWidth,15,'cutting strip follows the 30px-wide mower deck');
assert.equal(G.config.bladeStart,16);
assert.equal(G.config.bladeDepth,28);
assert.equal(G.config.mowerHalfWidth,22);
assert.equal(G.config.mowerHalfLength,31);
assert.ok(['setup','update','draw','hud','playerStatus','finish','cutTuft'].every(k=>typeof G[k]==='function'));
const make=(n,bots=true)=>Array.from({length:n},(_,i)=>({
 id:'p'+i,name:'Player '+i,color:['#ee3344','#33ddbb','#ffe34b'][i%3],active:false,isBot:bots,
 input:{axisX:0,axisY:0,action:false,alt:false},score:0
}));
function start(n,seed=1001,bots=true){const ps=make(n,bots),round={phase:'playing',paused:false,lawnSeed:seed};
 const s=G.setup(round,ps);return {ps,round,s};}
for(const n of [1,2,4,6,7,9,12]){
 const {s,ps,round}=start(n);
 assert.equal(s.kind,n<=6?'small':'large');
 assert.equal(s.duration,n<=6?30:60);
 assert.equal(s.grass.length>500,true,'field must contain dense physical clumps');
 assert.equal(new Set(ps.map(p=>p.x.toFixed(2)+':'+p.y.toFixed(2))).size,n,'spawn points unique');
 assert.ok(ps.every(p=>p.active&&p.mower&&p.score===0));
 const t=s.remaining;round.paused=true;G.update(1,round,ps);assert.equal(s.remaining,t);
 round.paused=false;
 const steps=s.duration*60;
 for(let k=0;k<steps+2;k++){
  G.update(1/60,round,ps);
  if(k%7===0)for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
   const hit=G.mowerOverlap(ps[i],ps[j]);
   assert.ok(!hit||hit.depth<.02,'car bodies never visibly intersect, n='+n+' frame '+k);
  }
 }
 assert.equal(s.finished,true,'round ends by clock or fully cleared lawn');
 assert.ok(s.elapsed<=s.duration+1e-7);
 assert.ok(['cleared','timeout'].includes(s.finishReason));
 if(s.finishReason==='cleared')assert.equal(s.cutTotal,s.grass.length);
 assert.equal(s.remaining,0);
 assert.equal(round.remaining,0);
 assert.ok(ps.every(p=>p.score%5===0),'all scores are multiples of five');
 assert.ok(ps.every(p=>p.score>0),'every bot earns real suns at this seed; n='+n);
 assert.ok(s.cutTotal>0,'bots physically cut grass');
 assert.equal(s.grass.filter(t=>t.cut).length,s.cutTotal,'unique grass-cut accounting');
 assert.equal(s.ranking.length,n);
 assert.equal(s.winnerIds.length>=1,true);
 assert.equal(G.update(1/60,round,ps),'winner');
 assert.equal(G.hud(ps,round).remaining,0);
 assert.equal(G.playerStatus(ps[0]).mode,'lawn_mower');
}
// Whole rotated bodies, including riders, wheels and mowing units, must collide.
{const {s,ps}=start(2,201,false),a=ps[0],b=ps[1],f=s.field;
 const cx=f.x+f.w/2,cy=f.y+f.h/2;
 a.x=cx;a.y=cy;b.x=cx;b.y=cy+35;
 a.mower.heading=0;b.mower.heading=0;
 assert.ok(G.mowerOverlap(a,b),'chassis collide even where 17px player circles miss');
 G.resolveMowerCollisions(s,ps);
 assert.equal(G.mowerOverlap(a,b),null,'side-by-side vehicles cannot overlap');
 assert.ok(Math.abs(b.y-a.y)>=44,'all 44 units of physical mower width are solid');
}
// Opposing mowers halt against each other and never swap positions/tunnel through.
{const {s,ps,round}=start(2,202,false),a=ps[0],b=ps[1],f=s.field;
 a.x=f.x+f.w/2-60;b.x=f.x+f.w/2+60;
 a.y=b.y=f.y+f.h/2;
 a.mower.heading=0;b.mower.heading=Math.PI;
 a.input.axisX=1;b.input.axisX=-1;
 let touched=false;
 for(let k=0;k<220;k++){
  G.update(1/60,round,ps);
  assert.ok(a.x<b.x,'head-on colliders must never pass each other');
  const hit=G.mowerOverlap(a,b);
  assert.ok(!hit||hit.depth<.02,'head-on mowing units stay separated');
  if(b.x-a.x<63)touched=true;
 }
 assert.ok(touched,'opposing cars make contact');
}
// Diagonal chassis remain inside the playable field on every edge.
{const {s,ps,round}=start(1,204,false),p=ps[0],f=s.field;
 p.x=f.x+3;p.y=f.y+4;p.mower.heading=Math.PI/4;
 p.input.axisX=-1;p.input.axisY=-1;
 for(let i=0;i<50;i++){
  G.update(1/60,round,ps);
  const ext=G.mowerExtents(p);
  assert.ok(p.x-ext.x>=f.x-.001&&p.y-ext.y>=f.y-.001);
  assert.ok(p.x+ext.x<=f.x+f.w+.001&&p.y+ext.y<=f.y+f.h+.001);
 }
}
// When the very last grass tuft is cut, finish immediately without using timer.
{const {s,ps,round}=start(2,203,false);
 for(const tuft of s.grass)G.cutTuft(s,ps[0],tuft);
 assert.equal(s.cutTotal,s.grass.length);
 assert.equal(G.update(1/60,round,ps),'winner');
 assert.equal(s.finished,true);
 assert.equal(s.finishReason,'cleared');
 assert.ok(s.elapsed<1,'no 30s wait after mowing the field');
 assert.equal(round.remaining,0);
 assert.equal(s.ranking[0].id,ps[0].id);
}
// Blade must not mow grass behind the vehicle, through the chassis,
// too far forward, or beyond the physical width of its cutting deck.
{const {s,ps}=start(1,145,false),p=ps[0],x=p.x,y=p.y;
 p.mower.heading=0;p.x=x+1;
 const locs=[[x+20,y],[x+20,y+14],[x+20,y+19],[x+11,y],[x+33,y]];
 s.grass=locs.map(([px,py],id)=>({id,x:px,y:py,cut:false,variant:0,rotation:0,size:9}));
 s.grid=new Map();
 for(const tuft of s.grass){
  const ix=Math.floor((tuft.x-s.field.x)/24),iy=Math.floor((tuft.y-s.field.y)/24);
  const k=ix+':'+iy,list=s.grid.get(k)||[];list.push(tuft.id);s.grid.set(k,list);
 }
 assert.equal(G.cutSwath(s,p,x,y),2,'only the two tufts under the moving blade are cut');
 assert.deepEqual(s.grass.map(t=>t.cut),[true,true,false,false,false]);
}
// Foreground umbrella and flowers must be painted over the opaque grass layer.
{const {s,ps,round}=start(1,146,false);
 const calls=[];
 const ctx={
  fillStyle:'#000',strokeStyle:'#000',
  save(){},restore(){},scale(){},translate(){},rotate(){},beginPath(){},
  ellipse(){},arc(){},arcTo(){},moveTo(){},lineTo(){},closePath(){},
  quadraticCurveTo(){},stroke(){},strokeRect(){},fillText(){},strokeText(){},
  fill(){if(['#b33832','#fce87c','#283f32'].includes(this.fillStyle))calls.push('fill:'+this.fillStyle);},
  fillRect(){if(this.fillStyle==='#408e26')calls.push('lawn');
   if(this.fillStyle==='#283f32')calls.push('fill:#283f32');}
 };
 G.draw(ctx,0,round,ps);
 const grass=calls.indexOf('lawn'),umbrella=calls.indexOf('fill:#b33832');
 const flower=calls.indexOf('fill:#fce87c'),mower=calls.indexOf('fill:#283f32');
 assert.ok(grass>=0&&umbrella>grass,'the parasol paints on top of grass');
 assert.ok(flower>umbrella&&mower>flower,'flowers paint above grass but under the mower');
}
// A single clump pays once even if two cars both cross it.
{const {s,ps}=start(2,99,false),tuft=s.grass[0];
 assert.equal(G.cutTuft(s,ps[0],tuft),true);
 const score=ps[0].score;
 assert.equal(G.cutTuft(s,ps[0],tuft),false);
 assert.equal(G.cutTuft(s,ps[1],tuft),false);
 assert.equal(ps[0].score,score);assert.equal(ps[1].score,0);
}
// No idling, no button-only shortcuts, and joystick cuts real lawn.
{const {s,ps,round}=start(1,147,false),p=ps[0];
 for(let i=0;i<150;i++){p.input.action=true;p.input.alt=true;G.update(1/60,round,ps);}
 assert.equal(s.cutTotal||0,0,'buttons and idle do not cut');
 p.input.axisX=1;p.input.axisY=0;
 for(let i=0;i<80;i++)G.update(1/60,round,ps);
 assert.ok(s.cutTotal>0);
}
// Distribution of 0/1/2/3 sun outcomes approximates 55/20/15/10.
{let hist=[0,0,0,0],sample=0;
 for(let seed=10;seed<28;seed++){
  const {s,ps}=start(1,seed,false),p=ps[0];
  for(const tuft of s.grass){
   const was=p.score;
   G.cutTuft(s,p,tuft);
   const amount=(p.score-was)/5;
   assert.ok([0,1,2,3].includes(amount));hist[amount]++;sample++;
  }
 }
 for(const [i,expected] of [0.55,.20,.15,.10].entries())
  assert.ok(Math.abs(hist[i]/sample-expected)<.026,'sun distribution '+i+': '+hist[i]+'/'+sample);
}
// Board + browser deployment references must remain in sync.
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),
 html=fs.readFileSync(path.join(root,'index.html'),'utf8'),
 board=fs.readFileSync(path.join(root,'src/board-party/runtime/board-minigame.js'),'utf8'),
 build=fs.readFileSync(path.join(root,'scripts/build-static.cjs'),'utf8');
assert.match(app,/"lawn_mower": \{[\s\S]*?"global": "LawnMower"/,
 'compiled manifest must retain LAWN MOWER engine registration');
for(const re of [/const MODES=Object\.fromEntries\(/,/function endPluginRound\(/,/renderPhoneLawnStatus/,/lawn-status/])assert.match(app,re);
assert.doesNotMatch(html,/data-pick="/,'game picker must be generated from registry');
assert.doesNotMatch(html,/src="\.\/src\/games\//,'game sources must load on demand');
const meta=JSON.parse(fs.readFileSync(path.join(root,'src/games/lawn-mower/manifest.json'),'utf8'));
assert.deepEqual(meta.modes,['normal','board'],'manifest enables both party modes');
assert.match(fs.readFileSync(path.join(root,'src/games/lawn-mower/game.js'),'utf8'),/import '.\/lawn-mower.js'/);
assert.equal(typeof G.getResult,'function','LAWN MOWER owns its results');
assert.doesNotMatch(board,/case 'lawn_mower':/);
assert.match(board,/plugin\.getResult/);
assert.ok(build.includes("const deployAsset="),'static build auto-validates referenced assets');
console.log('LAWN MOWER: 30% slower movement, deck-aligned mowing, garden foreground, 55/20/15/10 odds, collisions and 1–12 bots PASS');