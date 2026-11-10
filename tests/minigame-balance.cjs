/* Focused gameplay regression: footprint collapse, scattered scoops, 60% veggie holes, candy plugin. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const root=process.env.GAME_BUILD_ROOT||path.resolve(__dirname,'..');
const w={PartyCharacters:{control(input){return{x:Number(input?.axisX)||0,y:Number(input?.axisY)||0,action:!!input?.action}},activate(){}}};
globalThis.window=w;
const ctx=vm.createContext({window:w,Math,Date});
for(const file of ['block-breakers-art.js','block-breakers.js'])
 vm.runInContext(fs.readFileSync(path.join(root,'src/games/block-breakers',file),'utf8'),ctx,{filename:file});
const make=n=>Array.from({length:n},(_,i)=>({id:'p'+i,name:'Player '+i,isBot:i>0,active:false,color:'#ff4477',input:{axisX:0,axisY:0}}));
const block=w.BlockBreakers;
{
 const ps=make(1),rd={phase:'playing',paused:false,blockBreakersSeed:21},s=block.setup(rd,ps),start=ps[0].bk.lastTile;
 for(let i=0;i<120;i++)block.update(1/60,rd,ps);
 assert.equal(s.holes,0,'idle player does not trigger random tile collapse');
 assert.equal(s.st[start],0,'starting tile stays solid while still occupied');
 ps[0].input.axisX=1;
 for(let i=0;i<22;i++)block.update(1/60,rd,ps);
 assert.equal(s.st[start],1,'old tile cracks only after the player leaves');
 assert.equal(s.st[ps[0].bk.lastTile],0,'current tile begins intact');
 for(let i=0;i<100;i++)block.update(1/60,rd,ps);
 assert.equal(s.st[start],4,'old tile finishes collapsing into a hole');
}
(async()=>{
 for(const slug of ['scoop-rush','mole-mayhem','candy-chaos']){
  const plugin=(await import(pathToFileURL(path.join(root,'src/games',slug,'game.js')).href)).default;
  assert.ok(['setup','update','draw','hud','getResult'].every(k=>typeof plugin[k]==='function'),slug+' API');
  for(const n of [1,6,7,12]){
   const ps=make(n),rd={phase:'playing',paused:false,scoopRushSeed:1024,moleSeed:1024,candySeed:1024};
   const s=plugin.setup(rd,ps);assert.ok(s&&ps.every(p=>p.active),slug+' setup');
   if(slug==='scoop-rush'){
    assert.equal(s.scoops.length,n*5,'five scoops per player');
    assert.ok(s.scoops.every(q=>q.mass===1&&q.r===22),'double initial scoop radius');
    for(let i=0;i<s.scoops.length;i++)for(let j=i+1;j<s.scoops.length;j++)
     assert.ok(Math.hypot(s.scoops[i].x-s.scoops[j].x,s.scoops[i].y-s.scoops[j].y)>44,'no starting overlap');
   }
   if(slug==='mole-mayhem'){
    assert.equal(s.slots.length,n<=6?13:19,'fewer holes');
    assert.ok(Math.abs(s.vegs.length/s.slots.length-.6)<.05,'60% vegetable holes');
   }
   if(slug==='candy-chaos')assert.ok(s.candies.length>0,'candy field populated');
   for(let t=0;t<60;t++)plugin.update(1/60,rd,ps);
  }
 }
 console.log('NEW MINIGAME BALANCE REGRESSION PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
