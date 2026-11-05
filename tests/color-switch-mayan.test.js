'use strict';
const assert=require('node:assert/strict');
global.window={};
require('../color-switch-mayan.js');
require('../color-switch.js');
const E=window.ColorSwitch,M=window.ColorSwitchMayan;
let checks=0;
function ok(v,msg){assert.ok(v,msg);checks++;}
function eq(a,b,msg){assert.equal(a,b,msg);checks++;}
function game(count=2,theme='mayan'){
 const players=Array.from({length:count},(_,i)=>({
  id:'m'+i,name:'Tester '+i,color:'#ffc744',active:true,
  input:{axisX:0,axisY:0,action:false,alt:false},isBot:false}));
 const round={phase:'playing',paused:false,colorSeed:727272,colorTheme:theme};
 E.setup(round,players);
 return {players,round,s:round.colorSwitch};
}
{
 const a=game(6),b=game(7),normal=game(6,'classic');
 eq(a.s.theme,'mayan','forced Mayan');eq(normal.s.theme,'classic','classic preserved');
 eq(normal.s.mayan,null,'classic contains no skull state');
 eq(a.s.mayan.skulls.length,9,'9-row skull wall');
 eq(b.s.mayan.skulls.length,10,'10-row skull wall');
 for(const {s} of [a,b]){
  ok(s.mayan.skulls.every(c=>c.side===(c.row%2===0?'left':'right')),'skulls alternate row positions');
  ok(s.mayan.skulls.every(c=>c.x<s.board.x||c.x>s.board.x+s.board.w),'skulls outside play field');
 }
 for(let i=0;i<300;i++)E.update(1/60,normal.round,normal.players);
 eq(normal.s.mayan,null,'classic never spawns shots');
}
{
 const {s}=game(),m=s.mayan;
 eq(m.nextSide,'left','start left');
 ok(M.beginWarning(s,()=>0),'left warning begins');
 ok(!M.beginWarning(s,()=>0),'no stacked warning');
 eq(m.warning.side,'left','warn left');eq(m.warning.rows.length,3,'warn three lanes');
 eq(new Set(m.warning.rows).size,3,'three distinct left skulls');
 ok(m.warning.rows.every(r=>r%2===0),'even rows on left');
 eq(m.warning.remaining,M.constants.warning,'warning time');
 ok(M.fireWarning(s,()=>0),'left fires');eq(m.bullets.length,3,'three bullets on left');
 eq(m.nextSide,'right','next side is right');
 ok(M.beginWarning(s,()=>0),'right warning begins');
 ok(m.warning.rows.every(r=>r%2===1),'odd rows on right');
 eq(m.warning.rows.length,3,'warn three right-side lanes');
 eq(new Set(m.warning.rows).size,3,'three distinct right skulls');
 ok(M.fireWarning(s,()=>0),'right fires');
 eq(m.bullets.length,6,'six bullets after two volleys');
 eq(m.shots,6,'shot counter grows three per volley');
 eq(new Set(m.bullets.map(b=>b.side+':'+b.row)).size,6,'all three lanes per side unique');
 eq(m.volleyHistory.join(','),'left,right','alternating history');
 eq(m.nextSide,'left','third side left again');
}
{
 const {s,players,round}=game(),m=s.mayan;
 M.beginWarning(s,()=>0);M.fireWarning(s,()=>0);
 const shot=m.bullets[0],p=players[0],other=players[1];
 p.x=s.board.x+20;p.y=shot.y;
 other.x=s.board.x+s.board.w-30;other.y=p.y+s.size*.7;
 m.bullets=[{...shot,x:s.board.x-13}];
 const before=m.hits;
 M.update(.16,s,players,(target,duration)=>target.cs.stunRemaining=duration,()=>0);
 eq(m.hits,before+1,'swept collision hits player');
 eq(m.bullets.length,0,'bullet disappears on hit');
 eq(p.cs.stunRemaining,1,'one second stun');
 p.input.axisX=1;const oldX=p.x;E.update(1/60,round,players);
 eq(p.x,oldX,'stun blocks movement');ok(p.cs.stunRemaining<1,'stun decreases');
 m.bullets=[{...shot,x:s.board.x+40}];const frozen=m.bullets[0].x;
 round.paused=true;for(let i=0;i<40;i++)E.update(1/60,round,players);
 eq(m.bullets[0].x,frozen,'pause freezes bullets');round.paused=false;
 const test={...shot,x:s.board.x+25};
 p.x=test.x;p.y=test.y+60;
 ok(!M.bulletHitsPlayer(test,test.x-5,p),'different lane misses');
 p.y=test.y;ok(M.bulletHitsPlayer(test,test.x-5,p),'same lane hits');
}
{
 ok(Math.abs(E.constants.botPunchRate-.6)<1e-12,'bot punch frequency reduced 40 percent from original');
 eq(E.constants.botPunchRate,.6,'new punch frequency 60 percent of original');
 const {s,players,round}=game(2,'classic');
 const bot=players[0],enemy=players[1];bot.isBot=true;
 bot.x=s.board.x+s.size*4;bot.y=s.board.y+s.size*4;
 enemy.x=bot.x+32;enemy.y=bot.y;bot.dir={x:1,y:0};
 E.update(1/60,round,players);
 const delay=bot.cs.botNextPunch-s.clock;
 ok(delay>=1.15/.6-1e-6,'minimum delay after total 40 percent punch reduction');
 ok(delay<=1.6/.6+1e-6,'maximum delay after total 40 percent punch reduction');
}
{
 const {s,players,round}=game(12);
 for(const p of players)p.isBot=true;
 for(let i=0;i<2700;i++)E.update(1/60,round,players);
 ok(s.mayan.shots>=10,'skull traps remain active');
 ok(s.mayan.volleyHistory.every((side,i,all)=>i===0||side!==all[i-1]),'volley sides alternate');
 eq(players.reduce((n,p)=>n+p.score,0),s.tiles.filter(t=>t.ownerId!=null).length,'capture scores unaffected');
 ok(s.mayan.bullets.length<=10,'bounded bullets');
 const ctx=new Proxy({}, {get(o,k){return k in o?o[k]:(o[k]=()=>{});},set(o,k,v){o[k]=v;return true;}});
 E.draw(ctx,0,round,players);ok(true,'Mayan render works');
 const classic=game(3,'classic');
 E.draw(ctx,0,classic.round,classic.players);ok(true,'classic render works');
}
console.log('MAYAN SKULL PASS: '+checks+' checks');
