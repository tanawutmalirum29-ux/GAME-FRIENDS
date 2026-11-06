'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('fruit-memory.js','utf8');
const context={window:{},Image:class {constructor(){this.complete=true;this.naturalWidth=64;}}};
vm.runInNewContext(fs.readFileSync('player-avatar.js','utf8'),context);
vm.runInNewContext(fs.readFileSync('character-system.js','utf8'),context);
vm.runInNewContext(source,context);
const game=context.window.FruitMemory;
assert.ok(game&&game.setup&&game.update&&game.draw&&game.hud);
const makePlayers=n=>Array.from({length:n},(_,i)=>({id:'p'+(i+1),name:'P'+(i+1),
  active:true,isBot:i%2===1,color:'#ddd',input:{axisX:0,axisY:0,action:false}}));
function init(n){
 const players=makePlayers(n),round={mode:'fruit_memory',phase:'countdown',countdown:3,paused:false};
 const state=game.setup(round,players);return {players,round,state};
}
function advance(x,seconds,fps=60){
 x.round.phase='playing';
 for(let i=0;i<Math.ceil(seconds*fps);i++)game.update(1/fps,x.round,x.players);
}
// Progressive timers apply inside Fruit Memory, not across the six-game
// playlist. Each wave is harder but exposure and run duration have floors.
{
 for(const large of [false,true]){
  const first=game.memoryPace(1,large);
  assert.equal(first.revealFactor,1,'first wave uses original exposure');
  assert.equal(first.moveSeconds,large?7:5,'first wave uses original run time');
  let previous=first;
  for(let wave=2;wave<=20;wave++){
   const current=game.memoryPace(wave,large);
   assert.ok(current.revealFactor<=previous.revealFactor,'never increase visibility in later wave');
   assert.ok(current.moveSeconds<=previous.moveSeconds,'never increase running time in later wave');
   assert.ok(current.revealFactor>=.55,'preserve minimum per-batch visibility');
   assert.ok(current.moveSeconds>=(large?3.2:2.5),'preserve safe minimum running time');
   previous=current;
  }
  assert.equal(game.memoryPace(2,large).revealFactor,.92);
  assert.equal(game.memoryPace(2,large).moveSeconds,large?6.4:4.5);
  assert.equal(game.memoryPace(12,large).revealFactor,.55);
  assert.equal(game.memoryPace(12,large).moveSeconds,large?3.2:2.5);
 }
 const restarted=init(7);
 assert.equal(restarted.state.rounds,1,'fresh match resets wave count');
 assert.equal(restarted.state.revealFactor,1);
 assert.equal(restarted.state.moveSeconds,7);
}

for(let n=1;n<=12;n++){
 const x=init(n),small=n<=6,tiles=x.state.tiles;
 assert.equal(x.state.cols,small?5:6);assert.equal(x.state.rows,small?5:6);
 assert.equal(tiles.length,small?25:36);
 assert.deepEqual(
   {x:x.state.board.x,y:x.state.board.y,w:x.state.board.w,h:x.state.board.h},
   {x:270,y:105,w:420,h:420},
   'square arena centered below HUD'
 );
 assert.equal(x.state.tileW,small?84:70,'5x5 and 6x6 tile side lengths');
 assert.equal(x.state.tileH,x.state.tileW,'each tile is square');
 assert.equal(x.state.board.w,x.state.board.h,'entire board is square');
 assert.ok(x.state.board.y>=73&&x.state.board.y+x.state.board.h<=540,
   'board is below HUD and entirely in the viewport');
 const centers=tiles.map(t=>({
   x:x.state.board.x+(t.column+.5)*x.state.tileW,
   y:x.state.board.y+(t.row+.5)*x.state.tileH
 }));
 assert.equal(new Set(centers.map(c=>c.x+','+c.y)).size,tiles.length,
   'each cell center is unique');
 assert.ok(x.players.every(p=>
   p.x>=x.state.board.x&&p.x<x.state.board.x+x.state.board.w&&
   p.y>=x.state.board.y&&p.y<x.state.board.y+x.state.board.h),
   'all spawn positions remain inside square arena');
 assert.equal(game.constants.speed,207,'walking speed is unchanged');
 assert.equal(game.constants.footRadius,10,'collision footprint unchanged');
 assert.equal(game.constants.punchRange,53,'punch reach unchanged');
 const counts={};for(const t of tiles)counts[t.fruitType]=(counts[t.fruitType]||0)+1;
 assert.equal(Object.keys(counts).length,small?5:6);
 for(const count of Object.values(counts))assert.equal(count,small?5:6);
 const groups=x.state.revealGroups;
 assert.ok(groups.length>=5&&groups.length<=6,'5–6 complete batches cover each arena');
 for(const g of groups)assert.ok(g.length>=(small?4:6)&&g.length<=(small?6:8),'every batch obeys the player-count-specific reveal range');
 assert.equal(new Set(groups.flat()).size,tiles.length,'all cards scheduled exactly once');
 assert.equal(groups.flat().length,tiles.length,'no repeated card before full coverage');
 assert.equal(x.state.revealTimeline.length,groups.length);
 assert.ok(x.state.revealDuration>0&&x.state.revealDuration<50,'completion-controlled duration');
 for(const batch of x.state.revealTimeline){
   assert.ok(batch.duration>1,'each batch is visible long enough to remember');
   assert.equal(batch.ids.length>=(small?4:6)&&batch.ids.length<=(small?6:8),true);
 }
 assert.equal(x.state.moveSeconds,small?5:7);
 assert.equal(x.state.collapseSeconds,small?1.5:1.8);
 assert.equal(Object.hasOwn(x.state,'memorizeSeconds'),false,'no fixed memorization timer');
}
{
 const seen=new Set();
 for(let i=0;i<50;i++){
   const x=init(7);seen.add(x.state.revealGroups.map(g=>g.length).join(','));
 }
 assert.ok(seen.size>1,'group sizes vary between matches');
}
{
 // Repeatedly cover both 25-card and 36-card grids with no undersized tail batch.
 for(const n of [1,6,7,12]){
   for(let seed=0;seed<100;seed++){
     const state=init(n).state,groups=state.revealGroups;
     const min=n<=6?4:6,max=n<=6?6:8;
     assert.ok(groups.length>=5&&groups.length<=6);
     assert.ok(groups.every(batch=>batch.length>=min&&batch.length<=max),
       'no batch may underflow or overflow the specified range');
     const ids=groups.flat();
     assert.equal(new Set(ids).size,state.tiles.length,'no duplicate or missing tile');
     assert.equal(ids.length,state.tiles.length,'all cards revealed exactly once');
   }
 }

}
{
 const a=init(6),b=init(6);
 assert.notEqual(a.state.tiles.map(t=>t.fruitType).join(','),b.state.tiles.map(t=>t.fruitType).join(','),
   'layouts randomize for every match');
}
for(const n of [1,6,7,12]){
 const x=init(n),s=x.state,total=s.revealDuration;
 advance(x,.35);
 assert.equal(s.revealedTileIds.size,0,'first batch must actually be displayed first');
 advance(x,total-.7);
 assert.equal(s.phase,'memorize','still memorize until the last batch has finished');
 assert.ok(s.revealedTileIds.size<s.tiles.length,'last batch is not prematurely counted');
 advance(x,.38);
 assert.equal(s.phase,'hide','immediately hide after all batches, no fixed timer');
 assert.equal(s.revealedTileIds.size,s.tiles.length,'every tile displayed before hide');
 const before=s.tiles.map(t=>t.fruitType);
 advance(x,1.35);
 assert.deepEqual(s.tiles.map(t=>t.fruitType),before,'fruit identities fixed during guessing');
 assert.ok(before.includes(s.target),'target is in the current grid');
}
function seam(x){
 const s=x.state,p=x.players[0];for(const t of s.tiles)t.fruitType='banana';
 s.tiles[0].fruitType='apple';s.target='apple';
 p.y=s.board.y+s.tileH/2;
 return {s,p,boundary:s.board.x+s.tileW};
}
{
 const x=init(2),{s,p,boundary}=seam(x);
 p.x=boundary-5;let r=game.calculateFootSupport(s,p);
 assert.ok(r.ratio>.6);assert.equal(r.survive,true,'mostly safe survives');
 p.x=boundary+5;r=game.calculateFootSupport(s,p);
 assert.ok(r.ratio<.4);assert.equal(r.survive,false,'mostly falling loses');
 p.x=boundary;r=game.calculateFootSupport(s,p);
 assert.equal(r.survive,false,'50/50 uses foot center');
 s.tiles[1].fruitType='apple';assert.equal(game.calculateFootSupport(s,p).survive,true,'combine safe areas');
 p.x=s.board.x-5;assert.equal(game.calculateFootSupport(s,p).survive,false,'no exterior ghost platform');
}
{
 const x=init(3),s=x.state,[p,q,r]=x.players;
 s.phase='move';s.target='apple';for(const t of s.tiles)t.fruitType='banana';s.tiles[0].fruitType='apple';
 const {x:tx,y:ty}=s.board;
 p.x=tx+s.tileW*.5;p.y=ty+s.tileH*.5;
 q.x=tx+s.tileW*1.5;q.y=ty+s.tileH*.5;
 r.x=tx+s.tileW*2.5;r.y=ty+s.tileH*.5;
 game.evaluateSurvivors(s,x.players);
 assert.equal(s.phase,'collapse');assert.equal(s.pendingWinner,p.id);
 assert.equal(p.fruitAlive,true);assert.equal(q.fruitAlive,false);assert.equal(r.fruitAlive,false);
 advance(x,1.65);assert.equal(s.winnerId,p.id);
 assert.equal(game.update(.016,x.round,x.players),'winner');
}
{
 const x=init(2),s=x.state;
 s.phase='move';s.target='apple';for(const t of s.tiles)t.fruitType='banana';
 const board=s.board,tiles=[...s.tiles],positions=x.players.map(p=>[p.x,p.y]);
 game.evaluateSurvivors(s,x.players);
 assert.equal(s.pendingTie,true,'all-player wipe is an immediate draw after collapse');
 assert.deepEqual([...s.tieIds],['p1','p2']);
 assert.equal(x.players.filter(p=>p.fruitAlive).length,0);
 advance(x,1.6);
 assert.equal(s.rounds,1,'no replay on a complete wipe');
 assert.equal(s.finished,true);
 assert.equal(s.winnerId,null);
 assert.equal(game.update(.016,x.round,x.players),'winner',
   'the host must receive a results signal for the draw');
 assert.equal(s.board,board);
 assert.deepEqual(x.players.map(p=>[p.x,p.y]),positions);
 for(let i=0;i<tiles.length;i++)assert.equal(s.tiles[i],tiles[i]);
}
{
 const x=init(3),s=x.state,[p,q,r]=x.players;
 s.phase='move';s.target='apple';
 for(const t of s.tiles)t.fruitType='banana';
 s.tiles[0].fruitType='apple';s.tiles[1].fruitType='apple';
 p.x=s.board.x+s.tileW*.5;p.y=s.board.y+s.tileH*.5;
 q.x=s.board.x+s.tileW*1.5;q.y=p.y;r.x=s.board.x+s.tileW*2.5;r.y=p.y;
 game.evaluateSurvivors(s,x.players);
 assert.equal(s.pendingWinner,null,'multiple survivors must replay');
 const pos=x.players.slice(0,2).map(z=>[z.x,z.y,z.dir]);
 const tiles=s.tiles.slice(),b=s.board;
 advance(x,2.7);
 assert.equal(s.rounds,2);assert.equal(s.board,b);
 assert.equal(s.revealFactor,.92,'second survival wave shortens exposure by 8 percent');
 assert.equal(s.moveSeconds,4.5,'second survival wave shortens running time');
 assert.ok(s.revealTimeline.every(group=>group.duration>.65),
  'every sped-up reveal remains visible and readable');
 const secondWaveTiles=s.tiles.length;
 advance(x,s.revealDuration+.1);
 assert.equal(s.revealedTileIds.size,secondWaveTiles,
  'every tile is shown even on the faster second wave');
 assert.equal(s.phase,'hide','cards turn down only after the last group has been shown');
 tiles.forEach((tile,i)=>assert.equal(s.tiles[i],tile,'physical tile object remains the same'));
 assert.deepEqual(x.players.slice(0,2).map(z=>[z.x,z.y,z.dir]),pos,
   'human and bot survivors never change position or direction between rounds');
 assert.equal(x.players.filter(z=>z.fruitAlive).length,2,'eliminated player stays out');
}
{
 const x=init(2),s=x.state,[p,q]=x.players;
 s.phase='move';s.target='apple';
 p.x=s.board.x+s.tileW*.5;p.y=s.board.y+s.tileH*.5;p.dir={x:1,y:0};
 q.isBot=false;q.input.axisX=0;q.input.axisY=0;
 q.x=p.x+43;q.y=p.y;p.input.action=true;
 advance(x,.23);
 assert.ok(q.fruitStun>0,'front hit stuns');assert.ok(p.fruitCooldown>0,'cooldown authoritative');
 advance(x,.35);assert.equal(p.fruitAttack,null,'recovery finite');
 advance(x,1.1);assert.equal(p.fruitAttack,null,'held A never auto-repeats');
 assert.equal(p.fruitCooldown,0);
}
{
 const a=init(2),b=init(2);
 for(const x of [a,b]){
   const {board,tileW,tileH}=x.state;
   x.state.phase='move';x.state.target='apple';
   // Identical starting world coordinates isolate FPS from random initial spawns.
   x.players[0].x=board.x+tileW;
   x.players[0].y=board.y+tileH;
   x.players[1].x=board.x+board.w-tileW;
   x.players[1].y=board.y+board.h-tileH;
   x.players[0].input.axisX=1;
 }
 advance(a,.5,30);advance(b,.5,60);
 assert.ok(Math.abs(a.players[0].x-b.players[0].x)<.01,'30 and 60 fps are equivalent');
}
{
 const x=init(12),s=x.state;
 const coords=new Set(x.players.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2)));
 assert.equal(coords.size,12,'all 12 spawn at distinct tiles');
 for(const p of x.players){p.x=s.board.x+s.board.w/2;p.y=s.board.y+s.board.h/2;}
 game.resolvePlayerCollisions(s,x.players);
 for(const p of x.players)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
}
for(const side of ['behind','far']){
 const x=init(2),s=x.state,[p,q]=x.players;s.phase='move';s.target='apple';
 p.x=s.board.x+s.tileW*1.5;p.y=s.board.y+s.tileH*1.5;p.dir={x:1,y:0};
 // Keep the hit-test dummy still; a moving bot can walk into a punch.
 q.isBot=false;q.input.axisX=0;q.input.axisY=0;
 q.x=p.x+(side==='behind'?-44:90);q.y=p.y;
 p.input.action=true;advance(x,.22);
 assert.equal(q.fruitStun,0,'punch cannot hit '+side);
}
{
 // People eliminated in previous waves never reappear during the new collapse.
 const x=init(3),s=x.state,[a,b,c]=x.players;
 s.phase='move';s.target='apple';
 for(const t of s.tiles)t.fruitType='banana';
 s.tiles[0].fruitType='apple';s.tiles[1].fruitType='apple';
 a.x=s.board.x+s.tileW*.5;a.y=s.board.y+s.tileH*.5;
 b.x=s.board.x+s.tileW*1.5;b.y=a.y;
 c.x=s.board.x+s.tileW*2.5;c.y=a.y;
 game.evaluateSurvivors(s,x.players);
 assert.equal(c.fruitAlive,false);assert.equal(c.fruitEliminatedRound,1);
 advance(x,2.7);
 assert.equal(s.rounds,2);assert.equal(c.fruitAlive,false);
 s.target='apple';s.phase='move';
 for(const t of s.tiles)t.fruitType='banana';
 game.evaluateSurvivors(s,x.players);
 assert.equal(s.pendingTie,true);
 assert.deepEqual([...s.tieIds],['p1','p2']);
 assert.equal(c.fruitEliminatedRound,1);
 assert.equal(a.fruitEliminatedRound,2);assert.equal(b.fruitEliminatedRound,2);
 const names=[],saved=context.window.PartyPlayerAvatar;
 context.window.PartyPlayerAvatar={draw(_ctx,p){names.push(p.id);}};
 const ctx=new Proxy({},{get(_o,key){if(key==='globalAlpha')return 1;return ()=>{};},set(){return true;}});
 for(const p of x.players)game.drawPlayer(ctx,p,s,0);
 context.window.PartyPlayerAvatar=saved;
 assert.deepEqual(names,['p1','p2'],
   'players eliminated in a previous round must not be rendered again');
 advance(x,1.9);
 assert.equal(s.finished,true);assert.equal(s.rounds,2);
 assert.equal(x.players.filter(p=>p.fruitAlive).length,0);
}
{
 // Both amber side panels clip text and use bounded, left-aligned Thai lines.
 for(const n of [4,12]){
  const x=init(n),s=x.state;
  const textCalls=[],origins=[],clipCount={value:0};
  const ctx=new Proxy({},{
   get(_obj,key){
    if(key==='translate')return (...args)=>origins.push(args);
    if(key==='clip')return ()=>{clipCount.value++;};
    if(key==='fillText')return (...args)=>textCalls.push(args);
    return ()=>{};
   },set(){return true;}
  });
  for(const phase of ['memorize','hide','move','collapse','rebuild']){
   s.phase=phase;s.target='apple';
   game.drawSideDisplays(ctx,s,{phase:'playing'},x.players);
  }
  assert.equal(clipCount.value,10,'clip each side panel in each game phase');
  assert.equal(origins.length,10);assert.ok(textCalls.length>20);
  for(const [label,xPos,yPos,maxWidth] of textCalls){
   assert.ok(xPos>=17&&xPos<=73,'label is anchored in the panel');
   assert.ok(yPos>=0&&yPos<=350,'vertical text location stays in bounds');
   assert.ok(maxWidth<=112,'text width never extends beyond panel');
  }
  assert.ok(textCalls.some(t=>t[0]==='จำตำแหน่ง'));
  assert.ok(textCalls.some(t=>t[0]==='ให้ดี'));
  assert.ok(textCalls.some(t=>t[0]==='/ '+s.tiles.length+' ช่อง'));
 }
}
console.log('FRUIT MEMORY PASS: variable 4–6/6–8 card reveal, completion-only transition, preserved map and bot positions, existing physics and gameplay');
