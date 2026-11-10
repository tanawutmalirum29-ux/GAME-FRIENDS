/* Focused gameplay regression: two-layer contact/idle tiles, solid holes, scoops and candy. */
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
 block.update(1/60,rd,ps);
 assert.equal(s.st[start],1,'stationary contact begins top-layer cracking');
 for(let i=0;i<35;i++)block.update(1/60,rd,ps);
 assert.equal(s.st[start],1,'first layer must not disappear instantly');
 for(let i=0;i<20;i++)block.update(1/60,rd,ps);
 assert.equal(s.st[start],2,'first impact exposes a safe second layer');
 for(let i=0;i<30;i++)block.update(1/60,rd,ps);
 assert.equal(s.st[start],3,'standing still counts as second contact after grace');
 for(let i=0;i<65;i++)block.update(1/60,rd,ps);
 assert.equal(s.st[start],4,'only the second layer creates a real hole');
 assert.equal(s.holes,1);
 assert.equal(ps[0].bk.alive,false,'standing still eventually causes a fall');
 assert.equal(s.finished,true,'solo round must finish after player falls');
}
{
 const ps=make(1),rd={phase:'playing',paused:false,blockBreakersSeed:42},s=block.setup(rd,ps),start=ps[0].bk.lastTile;
 block.update(1/60,rd,ps);
 ps[0].input.axisX=1;
 for(let i=0;i<20;i++)block.update(1/60,rd,ps);
 assert.notEqual(ps[0].bk.lastTile,start,'player left the original tile');
 ps[0].input.axisX=0;
 for(let i=0;i<73;i++)block.update(1/60,rd,ps);
 assert.equal(s.st[start],2,'lower layer waits for a second contact if player left');
 assert.equal(s.holes,0,'no off-path or random collapse');
}
{
 const ps=make(2),rd={phase:'playing',paused:false,blockBreakersSeed:42},s=block.setup(rd,ps);
 s.clock=s.cap-1/60;block.update(1/60,rd,ps);
 assert.ok(s.finished,'90-second multiplayer safety timeout ends stalled rounds');
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
    const u=s.world.unit,r=15*u;
    const clear=player=>{
     for(const hole of s.slots){
      const dx=(player.x-hole.x)/(22*u+r+2*u),dy=(player.y-hole.y)/(17*u+r+2*u);
      assert.ok(Math.hypot(dx,dy)>=.995,'players and bots cannot stand inside solid holes');
     }
     for(const v of s.vegs)if(v.t<1){
      const dx=(player.x-v.x)/(22*u+r+2*u),dy=(player.y-v.y)/(20*u+r+2*u);
      assert.ok(Math.hypot(dx,dy)>=.995,'players cannot walk through a swapping vegetable');
     }
    };
    for(const player of ps)clear(player);
    const target=s.slots[0],p=ps[0];
    for(let tick=0;tick<300;tick++){
     const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy)||1;
     p.input.axisX=dx/d;p.input.axisY=dy/d;
     plugin.update(1/60,rd,ps);
     for(const player of ps)clear(player);
    }
   }
   if(slug==='candy-chaos')assert.ok(s.candies.length>0,'candy field populated');
   if(slug!=='mole-mayhem')for(let t=0;t<60;t++)plugin.update(1/60,rd,ps);
  }
 }
 console.log('NEW MINIGAME BALANCE REGRESSION PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
