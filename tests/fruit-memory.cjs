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
  active:true,isBot:false,color:'#ddd',input:{axisX:0,axisY:0,action:false}}));
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
 assert.equal(x.state.revealGroups.length,small?8:10);
 assert.equal(new Set(x.state.revealGroups.flat()).size,tiles.length,'reveal all, without skipping');
 assert.equal(x.state.moveSeconds,small?5:7);assert.equal(x.state.memorizeSeconds,small?20:28);
 assert.equal(x.state.collapseSeconds,small?1.5:1.8);
}
{
 const a=init(6),b=init(6);
 assert.notEqual(a.state.tiles.map(t=>t.fruitType).join(','),b.state.tiles.map(t=>t.fruitType).join(','),
   'layouts randomize every memorization');
}
for(const n of [1,6,7,12]){
 const x=init(n);
 advance(x,.5);
 assert.ok(x.state.revealedTileIds.size<x.state.tiles.length,'no full reveal');
 advance(x,n<=6?19.6:27.6);
 assert.equal(x.state.revealedTileIds.size,x.state.tiles.length,'all tiles are revealed before hide');
 assert.ok(['hide','target','move'].includes(x.state.phase));
 const before=x.state.tiles.map(t=>t.fruitType);
 advance(x,1.4);
 assert.deepEqual(x.state.tiles.map(t=>t.fruitType),before,'fruit identities are immutable during round');
 assert.ok(before.includes(x.state.target),'target exists');
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
 assert.equal(r.survive,false,'50/50 at tile edge uses center');
 s.tiles[1].fruitType='apple';assert.equal(game.calculateFootSupport(s,p).survive,true,'two safe tiles share area');
 p.x=s.board.x-5;assert.equal(game.calculateFootSupport(s,p).survive,false,'outside board has no platform');
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
 game.evaluateSurvivors(s,x.players);
 assert.deepEqual([...s.replayEntrants],['p1','p2'],'simultaneous wipe must replay, not invent winner');
 advance(x,2.6);
 assert.equal(s.rounds,2);assert.equal(x.players.filter(p=>p.fruitAlive).length,2);
 assert.equal(s.finished,false);
}
{
 const x=init(2),s=x.state,[p,q]=x.players;
 s.phase='move';s.target='apple';
 p.x=s.board.x+s.tileW*.5;p.y=s.board.y+s.tileH*.5;p.dir={x:1,y:0};
 q.x=p.x+43;q.y=p.y;p.input.action=true;
 advance(x,.23);
 assert.ok(q.fruitStun>0,'forward punch stuns');
 assert.ok(p.fruitCooldown>0,'cooldown is host-authoritative');
 advance(x,.35);assert.equal(p.fruitAttack,null,'punch recovery is finite');
 advance(x,1.1);assert.equal(p.fruitAttack,null,'holding A cannot auto-repeat');
 assert.equal(p.fruitCooldown,0);
}
{
 const a=init(2),b=init(2);
 for(const x of [a,b]){x.state.phase='move';x.state.target='apple';x.players[0].input.axisX=1;}
 advance(a,.5,30);advance(b,.5,60);
 assert.ok(Math.abs(a.players[0].x-b.players[0].x)<.01,'30/60 FPS host simulation consistent');
}
console.log('FRUIT MEMORY PASS: 1-12 players, map sizes, shuffle, all reveals, foot overlap, shared support, last survivor, all-fall replay, punch and FPS');
