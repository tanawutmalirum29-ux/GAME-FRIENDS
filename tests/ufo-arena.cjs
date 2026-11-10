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
 assert.ok(engine.config.maxCollisionSpeed<=engine.config.maxSpeed*1.15,'bounded chain energy');
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
  assert.ok(energy<=initialEnergy*1.001,'a UFO-to-UFO chain must not amplify energy');
  for(let t=0;t<200&&!state.finished;t++){
   engine.step(1/120,round,ps);
   for(const p of ps)assert.ok(Math.hypot(p.vx,p.vy)<=engine.config.maxCollisionSpeed*state.geo.u+1,
    'chain reaction must stay speed capped');
  }
 }
 console.log('UFO ARENA 1-12-player API, springy impact and dissipative chain PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
