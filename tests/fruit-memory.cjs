'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const env={window:{},Image:class{constructor(){this.complete=true;this.naturalWidth=64;}}};
for(const path of ['player-avatar.js','combat-motion.js','character-system.js','fruit-memory.js'])
 vm.runInNewContext(fs.readFileSync(path,'utf8'),env,{filename:path});
const E=env.window.FruitMemory;
assert.ok(E?.setup&&E?.update&&E?.draw&&E?.drawSideScreens);
const players=n=>Array.from({length:n},(_,i)=>({id:'p'+i,name:'P'+i,
 active:true,isBot:i%2===1,color:'#ddd',input:{axisX:0,axisY:0,action:false}}));
function game(n){
 const ps=players(n),round={mode:'fruit_memory',phase:'countdown',paused:false};
 const state=E.setup(round,ps);return {ps,round,state};
}
function tick(g,seconds,fps=60){
 g.round.phase='playing';
 for(let i=0;i<Math.ceil(seconds*fps);i++)E.update(1/fps,g.round,g.ps);
}
const memoryTimes=[13,11,9,6,4,2];
for(const big of [false,true]){
 for(let wave=1;wave<=18;wave++){
  const p=E.memoryPace(wave,big);
  assert.equal(p.memorizeSeconds,memoryTimes[Math.min(5,wave-1)]);
  assert.equal(p.moveSeconds,big?Math.max(3.5,7-.5*Math.max(0,wave-6)):
    Math.max(2.5,5-.5*Math.max(0,wave-6)));
 }
}
for(let n=1;n<=12;n++){
 const g=game(n),s=g.state,small=n<=6,size=small?4:5;
 assert.equal(s.cols,size);assert.equal(s.rows,size);
 assert.equal(s.tiles.length,size*size);
 assert.equal(s.tileW,400/size);assert.equal(s.tileH,s.tileW);
 assert.deepEqual({x:s.board.x,y:s.board.y,w:s.board.w,h:s.board.h},
  {x:280,y:104,w:400,h:400});
 assert.equal(new Set(g.ps.map(p=>p.x+':'+p.y)).size,n,'unique player spawns');
 const histogram={};
 for(const tile of s.tiles)histogram[tile.fruitType]=(histogram[tile.fruitType]||0)+1;
 assert.equal(Object.keys(histogram).length,size);
 assert.ok(Object.values(histogram).every(count=>count>=size-1),
  'all selected fruit types must meet their minimum allocation');
 assert.equal(Object.values(histogram).reduce((sum,n)=>sum+n,0),size*size);
 assert.equal(Object.values(histogram).reduce((sum,n)=>sum+n-(size-1),0),size,
  'all remaining tiles use a randomized surplus across the selected kinds');
 assert.ok((small?[8,9]:[10,11]).includes(s.revealCount));
 assert.equal(s.revealGroups.length,4);
 assert.ok(s.revealGroups.every(group=>group.length===s.revealCount));
 assert.ok(s.revealGroups.every(group=>new Set(group).size===group.length));
 assert.equal(new Set(s.revealGroups.flat()).size,s.tiles.length);
 assert.ok(s.revealGroups.flat().length>s.tiles.length,'cross-group repeats allowed');
 assert.equal(s.revealDuration,13);
 assert.equal(s.revealTimeline.length,4);
 assert.ok(s.revealTimeline.every((batch,i)=>batch.start===i*13/4&&
  batch.end===(i+1)*13/4&&batch.duration===13/4));
 assert.equal(s.moveSeconds,small?5:7);
 assert.equal(s.revealFactor,1);
}
// The random remainder must produce multiple different distributions,
// instead of silently keeping the old exact-equality rule.
for(const count of [4,12]){
 const samples=new Set();
 for(let i=0;i<160;i++){
  const s=game(count).state,counts={};
  s.tiles.forEach(t=>counts[t.fruitType]=(counts[t.fruitType]||0)+1);
  samples.add(Object.values(counts).sort((a,b)=>a-b).join(','));
  assert.ok(Object.values(counts).every(n=>n>=(count<=6?3:4)));
 }
 assert.ok(samples.size>1,'surplus should genuinely vary across matches');
}
for(const n of [1,6,7,12]){
 for(let i=0;i<80;i++){
  const s=game(n).state;
  assert.ok(s.revealGroups.every(group=>group.length===s.revealCount));
  assert.equal(new Set(s.revealGroups.flat()).size,s.tiles.length);
 }
 const g=game(n),s=g.state;
 tick(g,.35);assert.equal(s.revealedTileIds.size,0);
 tick(g,12.3);assert.equal(s.phase,'memorize');
 tick(g,.38);assert.equal(s.phase,'hide');
 assert.equal(s.revealedTileIds.size,s.tiles.length);
 tick(g,.75);assert.ok(s.tiles.some(t=>t.fruitType===s.target));
 assert.equal(s.phase,'move','target appears only after all cards are hidden');
}
{
 const g=game(4),s=g.state,bot=g.ps.find(p=>p.isBot);
 assert.equal(Object.keys(s.botMemories[bot.id]).length,0);
 tick(g,13/4+.05);
 assert.ok(Object.keys(s.botMemories[bot.id]).length>=8);
 assert.ok(Object.keys(s.botMemories[bot.id]).length<s.tiles.length,
  'bot never knows a tile before it is shown');
 tick(g,10);
 assert.equal(Object.keys(s.botMemories[bot.id]).length,s.tiles.length);
}
{
 const g=game(4),s=g.state;
 g.round.paused=true;E.update(1,g.round,g.ps);
 assert.equal(s.elapsed,0);
 g.round.paused=false;tick(g,.2);assert.ok(s.elapsed>0);
}
{
 const g=game(3),s=g.state,[a,b,c]=g.ps;
 // When feet cover predominantly safe tiles the player survives.
 const balanced=s.tiles.map(t=>t.fruitType);
 for(const tile of s.tiles)tile.fruitType='banana';
 s.tiles[0].fruitType='apple';s.tiles[1].fruitType='apple';s.target='apple';
 a.x=s.board.x+s.tileW*.5;a.y=s.board.y+s.tileH*.5;
 b.x=s.board.x+s.tileW*1.5;b.y=a.y;
 c.x=s.board.x+s.tileW*2.5;c.y=a.y;
 const boundary=s.board.x+s.tileW;
 a.x=boundary-5;assert.equal(E.calculateFootSupport(s,a).survive,true);
 a.x=boundary+5;assert.equal(E.calculateFootSupport(s,a).survive,true);
 s.tiles[1].fruitType='banana';
 assert.equal(E.calculateFootSupport(s,a).survive,false);
 // Restore a genuinely balanced previous wave before testing reshuffle.
 // An artificial 15:1 fruit ratio would make per-cell derangement impossible.
 s.tiles.forEach((t,i)=>{t.fruitType=balanced[i];});
 s.target=s.tiles[0].fruitType;
 const safe=s.tiles.filter(t=>t.fruitType===s.target);
 const unsafe=s.tiles.find(t=>t.fruitType!==s.target);
 const place=(p,t)=>{p.x=s.board.x+(t.column+.5)*s.tileW;
   p.y=s.board.y+(t.row+.5)*s.tileH;};
 place(a,safe[0]);place(b,safe[1]);place(c,unsafe);
 E.evaluateSurvivors(s,g.ps);
 assert.equal(s.phase,'collapse');
 assert.equal(c.fruitAlive,false);
 assert.equal(s.pendingWinner,null);
 const old=s.tiles.map(t=>t.fruitType),tiles=[...s.tiles],count=s.revealCount;
 tick(g,2.7);
 assert.equal(s.rounds,2);
 assert.equal(s.moveSeconds,5);
 assert.equal(s.memorizeSeconds,11);
 assert.equal(s.revealDuration,11);
 assert.equal(s.revealCount,count);
 assert.ok(s.tiles.every((tile,i)=>tile===tiles[i]),'reuse physical tiles');
 assert.ok(s.tiles.every((tile,i)=>tile.fruitType!==old[i]),
  'every position receives a different fruit in the next wave');
 assert.ok(s.activeFruitKinds.some(id=>!s.firstFruitKinds.includes(id)));
 assert.equal(c.fruitAlive,false,'no resurrection');
 assert.ok(s.revealGroups.every(group=>group.length===count));
}
{
 const g=game(2),s=g.state;
 s.phase='move';s.target='apple';
 for(const tile of s.tiles)tile.fruitType='banana';
 E.evaluateSurvivors(s,g.ps);
 assert.equal(s.pendingTie,true);
 assert.equal(s.tieIds.length,2);
 tick(g,1.7);
 assert.equal(s.finished,true);
 assert.equal(s.winnerId,null);
}
{
 const g=game(3),s=g.state,[a,b,c]=g.ps;
 s.phase='move';s.target='apple';
 for(const tile of s.tiles)tile.fruitType='banana';
 s.tiles[0].fruitType='apple';
 a.x=s.board.x+s.tileW/2;a.y=s.board.y+s.tileH/2;
 b.x=s.board.x+s.tileW*1.5;b.y=a.y;
 c.x=s.board.x+s.tileW*2.5;c.y=a.y;
 E.evaluateSurvivors(s,g.ps);
 assert.equal(s.pendingWinner,a.id);
 tick(g,1.7);
 assert.equal(s.winnerId,a.id);
 assert.equal(E.update(.016,g.round,g.ps),'winner');
}
{
 const g=game(4),s=g.state,images=[],texts=[];
 const ctx=new Proxy({},{
  get(_target,k){
   if(k==='drawImage')return (...args)=>images.push(args);
   if(k==='fillText')return str=>texts.push(String(str));
   return ()=>{};
  },set(){return true;}
 });
 E.drawSideScreens(ctx,s);
 assert.equal(images.length,2);
 assert.deepEqual(texts,['13','13']);
 s.phase='move';s.target='grape';images.length=0;texts.length=0;
 E.drawSideScreens(ctx,s);
 assert.equal(images.length,4);
 assert.equal(images[1][0],images[3][0]);
 assert.equal(texts.length,0);
 s.phase='collapse';images.length=0;
 E.drawSideScreens(ctx,s);
 assert.equal(images.length,4);
}
{
 // Three seconds on the host clock are positioning time, not card exposure.
 const g=game(2),state=g.state,round=g.round,[human,bot]=g.ps;
 const p0={x:human.x,y:human.y},b0={x:bot.x,y:bot.y};
 human.input.axisX=1;human.input.axisY=0;
 const images=[],texts=[];
 const ctx=new Proxy({}, {
   get(_target,k){
     if(k==='drawImage')return (...args)=>images.push(args);
     if(k==='fillText')return value=>texts.push(String(value));
     return ()=>{};
   },set(){return true;}
 });
 E.drawSideScreens(ctx,state,round);
 assert.equal(images.length,0,'neither monitor appears during the shared countdown');
 assert.equal(texts.length,0,'no memory countdown on side panels before the match begins');
 round.paused=true;
 E.update(1/60,round,g.ps);
 assert.equal(human.x,p0.x,'pause also stops pre-start movement');
 round.paused=false;
 for(let i=0;i<180;i++)E.update(1/60,round,g.ps);
 assert.ok(Math.hypot(human.x-p0.x,human.y-p0.y)>20,
   'a human can move freely while the three-second clock is running');
 assert.ok(Math.hypot(bot.x-b0.x,bot.y-b0.y)>20,
   'a bot naturally wanders before card reveal without reading hidden fruits');
 assert.equal(state.elapsed,0,'13-second memory timer has not started');
 assert.equal(state.revealCursor,0,'no reveal batch started before clock expires');
 assert.equal(state.revealedTileIds.size,0,'all cards stay hidden');
 assert.equal(state.rounds,1,'the game does not advance waves during prestart');
 assert.equal(state.target,null,'the safe fruit is still unknown');
 assert.equal(Object.keys(state.botMemories[bot.id]).length,0,
   'bots cannot inspect any fruit during the pregame countdown');
 round.phase='playing';
 E.drawSideScreens(ctx,state,round);
 assert.equal(images.length,2,'both side monitors appear as the host starts playing');
 assert.deepEqual(texts,['13','13'],'both monitors now begin their own 13-second timer');
 E.update(1/60,round,g.ps);
 assert.ok(state.elapsed>0,'the memorization clock starts after the shared 3-second clock');
}
{
 // Solo bot also walks during prestart, with no other players to follow.
 const g=game(1),bot=g.ps[0];bot.isBot=true;
 const old={x:bot.x,y:bot.y};
 for(let i=0;i<120;i++)E.update(1/60,g.round,g.ps);
 assert.ok(Math.hypot(bot.x-old.x,bot.y-old.y)>15);
 assert.equal(g.state.revealedTileIds.size,0);
}
console.log('FRUIT MEMORY V2 PASS: arena, exact timers, full card coverage, bots, simultaneous ties and mirrored SVG screens');
