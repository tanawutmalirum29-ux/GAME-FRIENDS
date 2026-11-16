'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.resolve(__dirname,'../src/app/rounds/results.js'),'utf8');
const start=source.indexOf('// Rank 1 earns 11');
const end=source.indexOf('\nfunction totalScoreNote',start);
assert.ok(start>=0&&end>start,'tournament score functions must be present');

const context=vm.createContext({MAX_PLAYERS:12,tournament:{endless:false}});
vm.runInContext(source.slice(start,end),context,{filename:'results-scoring.js'});

function score(count,endless){
 context.tournament={endless};
 const roster=Array.from({length:count},(_,index)=>({id:'p'+(index+1),total:0}));
 context.awardRoundPoints(roster,player=>Number(player.id.slice(1)));
 return roster.map(player=>player.lastRoundPoints);
}

for(const endless of [false,true]){
 assert.deepEqual(score(2,endless),[11,10],
  'two-player rooms retain the fixed 12-player scale in '+(endless?'Endless':'normal')+' mode');
 assert.deepEqual(score(5,endless),[11,10,9,8,7],
  'five-player rooms do not rescale points in '+(endless?'Endless':'normal')+' mode');
 assert.deepEqual(score(12,endless),[11,10,9,8,7,6,5,4,3,2,1,0],
  'the twelfth-place player receives zero points in '+(endless?'Endless':'normal')+' mode');
}
context.tournament={endless:false};
assert.equal(context.pointsForRank(12),0);
assert.equal(context.pointsForRank(13),0,'ranks beyond the 12-player scale cannot receive negative points');
assert.equal(context.pointsForRank(2),10,'rank points do not depend on room size');
console.log('RESULT SCORING PASS: fixed 12-player scale in normal and Endless tournaments');
