/* Regression: Host lobby seats are inactive before minigame setup; minefield navigation must be reachable. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context=vm.createContext({window:{PartyCharacters:{activate(){}}},Date,Math});
vm.runInContext(fs.readFileSync('src/games/dangerfield/dangerfield.js','utf8'),context);
const G=context.window.DangerField;
assert.equal(typeof G.setup,'function');
for(const n of [1,2,6,7,12]){
 const players=Array.from({length:n},(_,i)=>({
  id:'p'+i,name:'Player '+i,type:i?'local':'remote',
  isBot:i>0,active:false,color:'#ff5522',input:{axisX:0,axisY:0}
 }));
 const round={phase:'countdown',dangerSeed:4242+n};
 const s=G.setup(round,players);
 assert.ok(s,'DANGERFIELD setup succeeds for '+n+' inactive lobby players');
 assert.ok(players.every(p=>p.active&&p.df&&p.df.state==='run'),'all players activate');
 assert.ok(s.mines.length>0,'minefield remains populated');
 assert.ok(s.startDist>0&&Number.isFinite(s.startDist),'valid navigation for '+n);
 assert.ok(s.slots.every(sl=>Number.isFinite(G.remainingAt(s,sl.x,sl.y))),
  'every possible spawn is connected to finish');
 assert.ok(round.remaining>0,'timer initialized');
}
console.log('DANGERFIELD setup/navigation regression OK');
