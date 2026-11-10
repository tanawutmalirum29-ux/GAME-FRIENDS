/* Focused regression: two new party games, redesigned ICE RACE and scoped balance changes. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=process.env.GAME_BUILD_ROOT||path.join(__dirname,'..');
const dir=path.join(root,'src/games');
globalThis.window={PartyCharacters:{
 activate(ps){for(const p of ps)p.active=true;},
 control(input={}){let x=Number(input.axisX)||0,y=Number(input.axisY)||0;
 const m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}return{x,y,action:!!input.action,alt:!!input.alt};}
}};
const players=n=>Array.from({length:n},(_,i)=>({
 id:'p'+i,name:'Player '+i,active:false,isBot:i>0,color:'#16a8ff',
 input:{axisX:0,axisY:0,action:false,alt:false}
}));
async function load(slug){
 const folder=path.join(dir,slug),m=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
 assert.equal(m.enabled,true);
 assert.deepEqual(m.modes,['normal','board']);
 assert.deepEqual(m.legacyScripts,[]);
 assert.ok(m.players.min<=1&&m.players.max>=12);
 const engine=(await import(pathToFileURL(path.join(folder,'game.js')).href)).default;
 for(const k of ['setup','update','draw','hud','getResult'])
  assert.equal(typeof engine[k],'function',slug+'.'+k);
 return engine;
}
(async()=>{
 for(const slug of ['cannon-chaos','countdown-drop','ice-race']){
  const game=await load(slug);
  for(const n of [1,2,4,5,6,7,8,9,12]){
   const ps=players(n),round={phase:'playing',paused:false,iceSeed:1551};
   const state=game.setup(round,ps);
   assert.ok(state&&ps.every(p=>p.active),'setup '+slug+' '+n);
   for(let i=0;i<90;i++)game.update(1/60,round,ps);
   assert.equal(game.getResult(round,ps).length,n,'results '+slug+' '+n);
   for(const p of ps)assert.ok(Number.isFinite(p.x+p.y),'invalid position '+slug+' '+n);
   if(slug==='ice-race'){
    const tier=n<=4?'small':n<=8?'medium':'large';
    assert.equal(state.sizeClass,tier);
    assert.equal(state.checkpoints.length,n<=4?6:n<=8?8:10);
    assert.equal(state.duration,n<=4?30:n<=8?50:70);
   }
  }
 }
 const candy=await load('candy-chaos');
 {
  const ps=players(4),round={phase:'countdown',paused:false,candySeed:891},
    state=candy.setup(round,ps);
  assert.equal(state.candies.length,0,'three-second countdown starts empty');
  for(let i=0;i<180;i++)candy.update(1/60,round,ps);
  assert.equal(state.candies.length,0,'no candy during countdown');
  assert.equal(state.bombs.length,0,'no bombs during countdown');
  round.phase='playing';candy.update(1/60,round,ps);
  assert.ok(state.candies.length>0,'candies arrive only when play begins');
  for(let i=0;i<210;i++)candy.update(1/60,round,ps);
  assert.ok(state.bombs.every(b=>b.state==='live'),'bombs never warn before appearing');
  assert.equal(candy.config.warnTime,0,'bomb warning period disabled');
 }
 const shopping=await load('shopping-time');
 assert.equal(shopping.config.speed,126,'shopping movement reduced by 30%');
 const mole=await load('mole-mayhem');
 assert.equal(mole.config.attack.recovery,.35,'hammer animation extended by .15s');
 console.log('NEW CANNON + COUNTDOWN, 3-TIER ICE RACE, CANDY, SHOPPING, MOLE REGRESSION PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
