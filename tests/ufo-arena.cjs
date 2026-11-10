/* UFO ARENA: native plugin, two arena sizes, 1–12 players and deterministic simulation. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
global.window={PartyCharacters:{
 activate(){},
 control(input={}){const x=Number(input.axisX)||0,y=Number(input.axisY)||0,d=Math.hypot(x,y)||1;return{x:x/Math.max(1,d),y:y/Math.max(1,d)};}
}};
(async()=>{
 const root=path.resolve(__dirname,'..'),folder=path.join(root,'src/games/ufo-arena');
 const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
 assert.equal(manifest.id,'ufo_arena');
 assert.equal(manifest.enabled,true);
 assert.deepEqual(manifest.modes,['normal','board']);
 assert.deepEqual(manifest.legacyScripts,[]);
 const engine=(await import('file://'+path.join(folder,'game.js'))).default;
 for(const method of ['setup','update','draw','hud','step','finish','getResult','getControllerPacket'])
  assert.equal(typeof engine[method],'function',method+' missing');
 assert.equal(engine.config.hp,5);
 assert.ok(engine.config.ufoRest>=.8,'direct UFO impact has responsive restitution');
 assert.equal(engine.config.bounceBoost,2,'all UFO collision rebounds doubled');
 assert.equal(engine.config.maxCollisionSpeed,1200,'collision cap raised with rebound impulse');
 assert.equal(engine.config.spike.knock,380,'spike impact knockback also doubled');
 assert.equal(engine.config.edgeBounceMultiplier,1.5,'perimeter collisions must rebound 1.5x harder');
 assert.ok(engine.config.minPairSeparationSpeed>=140,'fresh contact must have visible separating motion');
 assert.ok(fs.readFileSync(path.join(folder,'cover.svg'),'utf8').includes('<svg'));
 for(const n of [1,2,6,7,12]){
  const ps=Array.from({length:n},(_,i)=>({
   id:'u'+i,name:'UFO '+i,active:false,isBot:i>0,color:'#ff4466',
   input:{axisX:0,axisY:0}
  }));
  const round={phase:'playing',paused:false,ufoArenaSeed:1234+n};
  const state=engine.setup(round,ps);
  assert.ok(ps.every(p=>p.active&&p.ufo?.hp===5));
  assert.equal(state.world.w,n<=6?960:1280);
  assert.equal(state.world.h,n<=6?540:720);
  assert.ok(state.zones.length>12,'corner, straight-wall and central bumper zones');
  const ticks=240;
  for(let i=0;i<ticks&&!state.finished;i++){
   engine.update(1/60,round,ps);
   for(const p of ps)assert.ok(Number.isFinite(p.x+p.y+p.vx+p.vy));
  }
  assert.ok(state.clock>0,'game simulation must advance');
  assert.equal(engine.getResult(round,ps).length,n);
 }
 // A direct moving-into-stationary collision must transfer most of the
 // momentum, but a ship-to-ship chain cannot create kinetic energy.
 {
  const ps=Array.from({length:3},(_,i)=>({
   id:'pair'+i,name:'Pair '+i,active:false,isBot:false,color:'#bbff99',
   input:{axisX:0,axisY:0}
  }));
  const round={phase:'playing',paused:false,ufoArenaSeed:33331};
  const state=engine.setup(round,ps);
  for(let i=0;i<3;i++){ps[i].x=300+i*34;ps[i].y=270;ps[i].vx=0;ps[i].vy=0;}
  ps[0].vx=210;
  const initialEnergy=ps.reduce((sum,p)=>sum+p.vx*p.vx+p.vy*p.vy,0);
  engine.step(1/120,round,ps);
  assert.ok(Math.max(ps[1].vx,ps[2].vx)>110,'first collision must transfer a clearly noticeable impulse through the ships');
  const energy=ps.reduce((sum,p)=>sum+p.vx*p.vx+p.vy*p.vy,0);
  assert.ok(energy<=initialEnergy*8,'one-shot doubled contact impulses must have bounded energy');
  for(let t=0;t<200&&!state.finished;t++){
   engine.step(1/120,round,ps);
   for(const p of ps)assert.ok(Math.hypot(p.vx,p.vy)<=engine.config.maxCollisionSpeed*state.geo.u+1,
    'chain reaction must stay speed capped');
  }
 }
 // Slow/overlapping ships must recoil in opposite directions, not stick
 // together or repeatedly inject energy every physics solver iteration.
 {
  const ps=Array.from({length:2},(_,i)=>({
   id:'touch'+i,name:'Touch '+i,active:false,isBot:false,
   input:{axisX:0,axisY:0},color:'#aabbcc'
  }));
  const round={phase:'playing',paused:false,ufoArenaSeed:5012},state=engine.setup(round,ps);
  ps[0].x=300;ps[0].y=270;ps[1].x=330;ps[1].y=270;
  ps.forEach(p=>{p.vx=0;p.vy=0;});
  engine.step(1/120,round,ps);
  const u=state.geo.u,closing=(ps[1].vx-ps[0].vx);
  assert.ok(ps[0].vx<-60*u&&ps[1].vx>60*u,'touching UFOs must BOTH bounce outward');
  assert.ok(closing>=engine.config.minPairSeparationSpeed*u*.98,'minimum outward separation on first contact');
  assert.ok(ps[1].x-ps[0].x>=2*engine.config.radius*u-.1,'ships must not overlap after collision');
  let peak=Math.max(Math.abs(ps[0].vx),Math.abs(ps[1].vx));
  for(let t=0;t<80;t++){
   engine.step(1/120,round,ps);
   peak=Math.max(peak,Math.abs(ps[0].vx),Math.abs(ps[1].vx));
  }
  assert.ok(peak<400*u,'one-shot double rebound must not self-amplify on sustained contact');
  assert.ok(ps[1].x-ps[0].x>80*u,'ships must move apart instead of remaining attached');
 }
 // Boundary restitution is now 2x the previous 1.5x build on normal and
 // coloured corner edges, independently of the centre bumper.
 for(const n of [1,7])for(const edgeId of [0,1]){
  const ps=[{id:'wall',name:'Wall',active:false,isBot:false,color:'#ffeeaa',input:{axisX:0,axisY:0}}];
  const round={phase:'playing',paused:false,ufoArenaSeed:9191+n+edgeId},
   state=engine.setup(round,ps),p=ps[0],u=state.geo.u,e=state.geo.edges[edgeId],R=engine.config.radius*u;
  const midX=(e.a.x+e.b.x)/2,midY=(e.a.y+e.b.y)/2;
  p.x=midX+e.n.x*(R-.8*u);
  p.y=midY+e.n.y*(R-.8*u);
  p.vx=-120*u*e.n.x;p.vy=-120*u*e.n.y;
  const inSpeed=120*u*Math.exp(-engine.config.brake/120);
  const rest=e.strong?engine.config.cornerRest:engine.config.wallRest;
  const base=e.strong?engine.config.cornerBase*u:0;
  const gain=e.strong?engine.config.cornerGain:0;
  const before=Math.max(inSpeed*rest,base+Math.min(inSpeed,260*u)*gain)*engine.config.impactMultiplier;
  engine.step(1/120,round,ps);
  const rebound=p.vx*e.n.x+p.vy*e.n.y;
  assert.ok(Math.abs(rebound/before-3)<.03,
   'perimeter '+(e.strong?'strong bumper':'gray wall')+' must bounce exactly 3x the original unboosted baseline at tier '+n+' players');
 }
 // 50% of spike slots must always be lethally deployed, including setup
 // and during exact same-tick retraction/extension handoffs.
 for(const n of [2,7]){
  const ps=Array.from({length:n},(_,i)=>({id:'hazard'+i,name:'Hazard '+i,active:false,
   isBot:false,color:'#e3c9ff',input:{axisX:0,axisY:0}}));
  const round={phase:'playing',paused:false,ufoArenaSeed:75126+n},state=engine.setup(round,ps);
  const required=Math.round(state.zones.length*engine.config.spike.maxLiveFrac);
  const count=()=>state.zones.filter(z=>z.state==='active'&&z.ext>=1).length;
  assert.equal(count(),required,'initial setup must display exactly 50% full-length spikes');
  let handoffs=0,seenRetracting=false;
  for(let t=0;t<2300;t++){
   const before=new Set(state.zones.filter(z=>z.state==='active').map(z=>z.id));
   engine.step(1/120,round,ps);
   assert.equal(count(),required,'no frame may have fewer than 50% full-length lethal spikes');
   const after=state.zones.filter(z=>z.state==='active');
   const entered=after.filter(z=>!before.has(z.id));
   const exited=state.zones.filter(z=>before.has(z.id)&&z.state==='rest');
   if(entered.length){
    handoffs++;
    assert.equal(entered.length,exited.length,'same-frame spike handoff must swap equal numbers');
    assert.ok(entered.every(z=>z.ext===1),'incoming spikes must strike immediately at full length');
    assert.ok(exited.every(z=>z.ext>0),'outgoing spikes retract while replacements already attack');
   }
   if(state.zones.some(z=>z.state==='rest'&&z.ext>0))seenRetracting=true;
  }
  assert.ok(handoffs>=7,'spike groups must continue rotating, never reach a cooldown pause');
  assert.ok(seenRetracting,'retiring spikes must retract alongside live incoming spikes');
 }
 // Centre bumper rebound is also exactly twice the previous release.
 for(const n of [1,7]){
  const p={id:'centre',name:'Centre',active:false,isBot:false,color:'#fff',
   input:{axisX:0,axisY:0}},round={phase:'playing',paused:false,ufoArenaSeed:888+n};
  const state=engine.setup(round,[p]),u=state.geo.u,b=state.geo.bumper;
  const R=engine.config.radius*u;
  p.x=b.x+b.r+R-.5*u;p.y=b.y;p.vx=-120*u;p.vy=0;
  const v=120*u*Math.exp(-engine.config.brake/120);
  const base=Math.max(v*engine.config.bumperRest,
   engine.config.bumperBase*u+Math.min(v,260*u)*engine.config.bumperGain)
   *engine.config.impactMultiplier;
  engine.step(1/120,round,[p]);
  assert.ok(Math.abs(p.vx/base-2)<.04,'centre bumper rebound must double at world tier '+n);
 }
 console.log('UFO ARENA doubled rebounds, permanent 50% spikes and bounded contact physics PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
