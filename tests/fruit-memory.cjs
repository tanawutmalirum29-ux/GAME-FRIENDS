'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('fruit-memory.js','utf8');
const context={window:{},Image:class {constructor(){this.complete=true;this.naturalWidth=64;}}};
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
for(let n=1;n<=12;n++){
 const x=init(n),small=n<=6,tiles=x.state.tiles;
 assert.equal(x.state.cols,small?4:6);assert.equal(x.state.rows,small?4:5);
 assert.equal(tiles.length,small?16:30);
 const counts={};for(const t of tiles)counts[t.fruitType]=(counts[t.fruitType]||0)+1;
 assert.equal(Object.keys(counts).length,small?4:5);
 for(const count of Object.values(counts))assert.equal(count,small?4:6);
 const groups=x.state.revealGroups;
 assert.ok(groups.length>= (small?4:8),'enough batches');
 for(const g of groups)assert.ok(g.length>=2&&g.length<=4,'each flip reveals 2–4 cards');
 assert.equal(new Set(groups.flat()).size,tiles.length,'all cards scheduled exactly once');
 assert.equal(groups.flat().length,tiles.length,'no repeated card before full coverage');
 assert.equal(x.state.revealTimeline.length,groups.length);
 assert.ok(x.state.revealDuration>0&&x.state.revealDuration<50,'completion-controlled duration');
 for(const batch of x.state.revealTimeline){
   assert.ok(batch.duration>1,'each batch is visible long enough to remember');
   assert.equal(batch.ids.length>=2&&batch.ids.length<=4,true);
 }
 assert.equal(x.state.moveSeconds,small?5:7);
 assert.equal(x.state.collapseSeconds,small?1.5:1.8);
 assert.equal(Object.hasOwn(x.state,'memorizeSeconds'),false,'no fixed memorization timer');
}
{
 const seen=new Set();
 for(let i=0;i<20;i++){
   const x=init(7);seen.add(x.state.revealGroups.map(g=>g.length).join(','));
 }
 assert.ok(seen.size>1,'group sizes vary between matches');
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
 const origBoard=s.board,tiles=[...s.tiles],positions=x.players.map(p=>[p.x,p.y]);
 game.evaluateSurvivors(s,x.players);
 assert.deepEqual([...s.replayEntrants],['p1','p2'],'all-fall replay is fair');
 advance(x,2.7);
 assert.equal(s.rounds,2);assert.equal(s.finished,false);
 assert.equal(s.board,origBoard,'map never rebuilds at a new coordinate');
 for(let i=0;i<tiles.length;i++)assert.equal(s.tiles[i],tiles[i],'tile geometry is not recreated');
 assert.deepEqual(x.players.map(p=>[p.x,p.y]),positions,'no teleport after simultaneous wipe');
 assert.equal(x.players.filter(p=>p.fruitAlive).length,2);
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
 tiles.forEach((tile,i)=>assert.equal(s.tiles[i],tile,'physical tile object remains the same'));
 assert.deepEqual(x.players.slice(0,2).map(z=>[z.x,z.y,z.dir]),pos,
   'human and bot survivors never change position or direction between rounds');
 assert.equal(x.players.filter(z=>z.fruitAlive).length,2,'eliminated player stays out');
}
{
 const x=init(2),s=x.state,[p,q]=x.players;
 s.phase='move';s.target='apple';
 p.x=s.board.x+s.tileW*.5;p.y=s.board.y+s.tileH*.5;p.dir={x:1,y:0};
 q.x=p.x+43;q.y=p.y;p.input.action=true;
 advance(x,.23);
 assert.ok(q.fruitStun>0,'front hit stuns');assert.ok(p.fruitCooldown>0,'cooldown authoritative');
 advance(x,.35);assert.equal(p.fruitAttack,null,'recovery finite');
 advance(x,1.1);assert.equal(p.fruitAttack,null,'held A never auto-repeats');
 assert.equal(p.fruitCooldown,0);
}
{
 const a=init(2),b=init(2);
 for(const x of [a,b]){x.state.phase='move';x.state.target='apple';x.players[0].input.axisX=1;}
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
 q.x=p.x+(side==='behind'?-44:90);q.y=p.y;
 p.input.action=true;advance(x,.22);
 assert.equal(q.fruitStun,0,'punch cannot hit '+side);
}
console.log('FRUIT MEMORY PASS: variable 2–4 card reveal, completion-only transition, preserved map and bot positions, existing physics and gameplay');
