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
 console.log('UFO ARENA 1-12-player API and simulation PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
