'use strict';
const assert=require('node:assert/strict');
global.window={};
require('../src/games/shockwave/shockwave.js');
const engine=window.Shockwave;
assert.equal(typeof engine.getResult,'function');
assert.equal(typeof engine.getResultHeading,'function');
function runResult(events,winnerIds){
 const players=events.map((event,id)=>({id:'p'+id,name:'Player '+id,
  active:true,shockEliminatedAt:event,shockEliminatedWave:event,color:'#ffddaa'}));
 const round={phase:'playing',mode:'shockwave',
  shockwave:{winnerId:winnerIds.length===1?winnerIds[0]:null,winnerIds,wave:4}};
 const scores=engine.getResult(round,players),byId=new Map(scores.map(x=>[x.id,x]));
 assert.equal(scores.length,players.length);
 const ordered=players.slice().sort((a,b)=>
  byId.get(b.id).value-byId.get(a.id).value||String(a.id).localeCompare(String(b.id)));
 const rank=p=>1+ordered.filter(q=>byId.get(q.id).value>byId.get(p.id).value).length;
 return {heading:engine.getResultHeading(round,ordered),
  ranks:ordered.map(p=>rank(p)),ordered,scores,byId,round};
}
{
 const r=runResult([1,2,3,3],['p2','p3']);
 assert.equal(r.heading,'ผู้ชนะร่วม: Player 2 / Player 3');
 assert.deepEqual(r.ranks,[1,1,3,4]);
 assert.ok(r.ordered.slice(0,2).every(p=>r.byId.get(p.id).label==='อันดับ 1 ร่วม'));
}
for(const n of [2,3,4,12]){
 const ids=Array.from({length:n},(_,i)=>'p'+i);
 const r=runResult(Array(n).fill(1),ids);
 assert.ok(r.heading.startsWith('ผู้ชนะร่วม:'));
 assert.ok(r.ranks.every(rank=>rank===1));
}
{
 const r=runResult([1,2,3,4],['p3']);
 assert.equal(r.heading,'ผู้ชนะ: Player 3');
 assert.deepEqual(r.ordered.slice(0,2).map(p=>p.id),['p3','p2']);
 assert.deepEqual(r.ranks.slice(0,2),[1,2]);
}
{
 const r=runResult([1,2,3],[]);
 assert.equal(r.heading,'ไม่มีผู้ชนะ');
}
console.log('SHOCKWAVE RESULTS PASS: plugin ranking, ties, headlines and no-winner case');
