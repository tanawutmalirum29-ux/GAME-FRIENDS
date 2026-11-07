/* node tests/lawn-mower.cjs — gameplay, fairness, bots and integration checks. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const sandbox={window:{},Math,Date};
for(const f of ['character-system.js','lawn-mower.js'])
 vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),sandbox,{filename:f});
const G=sandbox.window.LawnMower;
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
 for(let k=0;k<steps+2;k++)G.update(1/60,round,ps);
 assert.equal(s.finished,true,'round terminates at time limit');
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
// Distribution of 0/1/2/3 sun outcomes approximates 55/15/15/15.
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
 for(const [i,expected] of [0.55,.15,.15,.15].entries())
  assert.ok(Math.abs(hist[i]/sample-expected)<.026,'sun distribution '+i+': '+hist[i]+'/'+sample);
}
// Board + browser deployment references must remain in sync.
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),
 html=fs.readFileSync(path.join(root,'index.html'),'utf8'),
 board=fs.readFileSync(path.join(root,'board-minigame.js'),'utf8'),
 build=fs.readFileSync(path.join(root,'scripts/build-static.cjs'),'utf8');
for(const re of [/lawn_mower:'LawnMower'/,/endLawnMowerRound/,/renderPhoneLawnStatus/,/lawn-status/])assert.match(app,re);
assert.match(html,/data-pick="lawn_mower"/);assert.match(html,/src="\.\/lawn-mower\.js"/);
assert.match(board,/case 'lawn_mower':/);assert.match(build,/'lawn-mower\.js'/);
console.log('LAWN MOWER: timing, physics, bots, unique cuts, 55/15/15/15 rewards, party integration PASS');