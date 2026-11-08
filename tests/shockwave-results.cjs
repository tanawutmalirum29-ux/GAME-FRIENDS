'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const app=fs.readFileSync('app.js','utf8');
const start=app.indexOf('function endShockwaveRound(){');
const end=app.indexOf('function endSnowBrawlRound(){',start);
assert.ok(start>=0&&end>start);
const resultCode=app.slice(start,end);
const run=new Function('round','players','resetInputs','broadcastRoster','$','tournament',
 'awardRoundPoints','canAutoAdvanceResults','totalScoreNote',
 'beginResultVoting','renderLeaderboard','document',resultCode+';endShockwaveRound();');
function runResult(events,winnerIds){
 class Element{
  constructor(){this.textContent='';this.children=[];this.style={};
   this.classList={add(){},remove(){}};}
  append(...nodes){this.children.push(...nodes);}
  prepend(node){this.children.unshift(node);}
  replaceChildren(...nodes){this.children=[...nodes];}
  querySelector(){return heading;}
 }
 const heading=new Element(),els=new Map();
 const get=id=>{if(id==='results')return Object.assign(els.get(id)||new Element(),{
   querySelector(){return heading;}});
   if(!els.has(id))els.set(id,new Element());return els.get(id);};
 const players=events.map((event,id)=>({id:'p'+id,name:'Player '+id,
  active:true,shockEliminatedAt:event,shockEliminatedWave:event,color:'#ffddaa'}));
 const round={phase:'playing',paused:false,mode:'shockwave',
  shockwave:{winnerId:winnerIds.length===1?winnerIds[0]:null,winnerIds,wave:4}};
 run(round,players,()=>{},()=>{},get,null,()=>{},()=>false,()=>'',()=>{},()=>{},
  {createElement:()=>new Element()});
 return {heading:heading.textContent,rows:els.get('resultList').children,
  round,players};
}
{
 const r=runResult([1,2,3,3],['p2','p3']);
 assert.equal(r.heading,'ผู้ชนะร่วม: Player 2 / Player 3');
 assert.deepEqual(r.rows.map(row=>row.children[0].textContent),[
  'อันดับ 1 • Player 2','อันดับ 1 • Player 3',
  'อันดับ 3 • Player 1','อันดับ 4 • Player 0']);
 assert.ok(r.rows.slice(0,2).every(row=>row.children[1].textContent==='อันดับ 1 ร่วม'));
}
for(const n of [2,3,4,12]){
 const ids=Array.from({length:n},(_,i)=>'p'+i);
 const r=runResult(Array(n).fill(1),ids);
 assert.ok(r.heading.startsWith('ผู้ชนะร่วม:'));
 assert.ok(r.rows.every(row=>row.children[0].textContent.startsWith('อันดับ 1 •')));
}
{
 const r=runResult([1,2,3,4],['p3']);
 assert.equal(r.heading,'ผู้ชนะ: Player 3');
 assert.equal(r.rows[0].children[0].textContent,'อันดับ 1 • Player 3');
 assert.equal(r.rows[1].children[0].textContent,'อันดับ 2 • Player 2');
}
console.log('SHOCKWAVE RESULTS PASS: single winner, multi-winner headers, proper competition ranking');
