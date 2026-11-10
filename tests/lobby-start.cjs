'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const begin=source.indexOf('function lobbyReadySnapshot(){');
const end=source.indexOf('function broadcastRoster(){',begin);
assert.ok(begin>=0&&end>begin,'real lobby vote functions exist');
const votingSource=source.slice(begin,end);
const players=[
 {id:'p1',type:'remote',isBot:false,conn:null},
 {id:'p2',type:'remote',isBot:false,conn:null},
 {id:'p3',type:'local',isBot:true,conn:null}
];
const one={open:true,playerId:'p1'},two={open:true,playerId:'p2'};
players[0].conn=one;players[1].conn=two;
let rendered=0,broadcast=0,started=0,blocked=false;
const context={players,Set,gameSelection:null,round:null,currentView:'hostLobby',
 renderRoster:()=>rendered++,broadcastRoster:()=>broadcast++,
 beginParty:()=>started++,
 $:id=>{assert.equal(id,'startBtn');return {disabled:blocked};}
};
vm.createContext(context);
vm.runInContext('const lobbyReadyVotes=new Set();\n'+votingSource+
 '\nthis.snapshot=lobbyReadySnapshot;this.vote=castLobbyReadyVote;this.votes=lobbyReadyVotes;',context);
const count=()=>{const {ready,total}=context.snapshot();return [ready,total];};
assert.deepEqual(count(),[1,3],'bots should be ready by default');
assert.equal(context.vote({playerId:'p1'}),false,'forged connection cannot vote');
assert.deepEqual(count(),[1,3]);
assert.equal(context.vote(one),true);assert.deepEqual(count(),[2,3]);
assert.equal(started,0,'not all remote players have voted');
assert.equal(context.vote(one),true);assert.deepEqual(count(),[1,3],'pressing A again cancels vote');
assert.equal(context.vote(one),true);assert.equal(context.vote(two),true);
assert.deepEqual(count(),[3,3]);assert.equal(started,1,'all ready triggers start');
context.round={phase:'playing'};
assert.equal(context.vote(one),false,'A must not vote while in a match');
assert.equal(started,1);
context.round=null;context.votes.clear();blocked=true;
assert.equal(context.vote(one),true);assert.equal(context.vote(two),true);
assert.equal(started,1,'invalid game selection cannot bypass disabled start button');
context.votes.clear();blocked=false;context.currentView='game';
assert.equal(context.vote(one),false,'cannot vote from active game screen');
context.currentView='hostLobby';context.votes.add('removed-seat');
assert.deepEqual(count(),[1,3],'removed seats cannot count toward the vote');
assert.ok(!context.votes.has('removed-seat'));
assert.ok(rendered>=4&&broadcast>=4,'live roster and controller counts update on every vote');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
assert.ok(!html.includes('ให้เพื่อนสแกน QR'),'marked QR title removed');
assert.ok(!html.includes('ทุกคนต้องเลือกก่อนเริ่ม • เลือกซ้ำ'),'marked hint removed');
assert.ok(!html.includes('เล่นเกมต่อเนื่อง</label>'),'marked toggle removed');
assert.match(html,/<input id="autoNext"[^>]*hidden/,'underlying auto-next preference still works');
assert.match(css,/#hostLobby \.lobby-controls>\.lobby-room-actions/,'buttons positioned on right');
assert.match(source,/msg\.t==='lobby-ready'/,'host listens for controller-ready packets');
assert.doesNotMatch(source,/send\(controllerConn,\{t:'lobby-ready'\}\)/,
 'controller A must not cast ready outside Party Plaza READY zone');
assert.match(source,/window\.PartyPlaza\?\.configure\(/,
 'lobby zones must be wired into the existing host controller');
assert.match(source,/case 'ready_area':/,
 'READY interaction triggers the existing vote path');

// The shared host palette must stay distinct at every room size. Verify actual
// app.js source rather than copying a second palette into the tests.
{
 const start=source.indexOf('const MAX_PLAYERS =');
 // The picker is generated from manifests; stop at its derived declaration.
 const stop=source.indexOf('const MODES=Object.fromEntries(',start);
 const rStart=source.indexOf('function restorePlayers(');
 const rStop=source.indexOf('function cancelSeat(',rStart);
 assert.ok(start>=0&&stop>start&&rStart>=0&&rStop>rStart);
 const c={};
 vm.createContext(c);
 vm.runInContext(source.slice(start,stop)+
  "\nconst MODES={ghost:'GHOST ATTACK'};let players=[],nextId=1;"+
  "const cleanName=x=>String(x||'');const blankInput=()=>({});\n"+
  source.slice(rStart,rStop)+
  "\nthis.palette=COLORS;this.legacy=LEGACY_COLORS;"+
  "this.add=()=>{const color=pickUnusedColor();if(color)players.push({color});return color};"+
  "this.restore=items=>{restorePlayers(items);return players.map(p=>({id:p.id,color:p.color,name:p.name,total:p.total,token:p.clientToken}))};",c);
 const palette=Array.from(c.palette);
 assert.equal(palette.length,12);
 assert.equal(new Set(palette).size,12,'room has 12 distinct identity colors');
 // CIELAB color differences penalize hues that technically differ in RGB
 // but look nearly identical in a small top-down avatar.
 function lab(hex){
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
   .map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));
  const [r,g,b]=rgb;
  const xyz=[(.4124564*r+.3575761*g+.1804375*b)/.95047,
   .2126729*r+.7151522*g+.072175*b,
   (.0193339*r+.119192*g+.9503041*b)/1.08883];
  const f=v=>v>.0088564517?Math.cbrt(v):7.787037*v+16/116;
  const [x,y,z]=xyz.map(f);
  return [116*y-16,500*(x-y),200*(y-z)];
 }
 for(let i=0;i<palette.length;i++)for(let j=i+1;j<palette.length;j++){
  const a=lab(palette[i]),b=lab(palette[j]);
  const distance=Math.hypot(...a.map((v,k)=>v-b[k]));
  assert.ok(distance>=30,'player colors '+(i+1)+'/'+(j+1)+' are too similar: '+distance);
 }
 const assigned=Array.from({length:12},()=>c.add());
 assert.deepEqual(assigned,palette,'colors issued in high-contrast priority order');
 assert.equal(c.add(),null,'thirteenth player cannot reuse another color');
 const saved=Array.from(c.legacy,(color,i)=>({
  id:'p'+(i+1),name:'Bot '+i,color,type:'local',total:i,token:'token-'+i,choice:'ghost'
 }));
 const restored=c.restore(saved);
 assert.equal(restored.length,12,'legacy room retains all 12 players');
 assert.equal(new Set(restored.map(p=>p.color)).size,12,'legacy colors migrate uniquely');
 for(let i=0;i<12;i++){
  assert.equal(restored[i].id,saved[i].id);
  assert.equal(restored[i].name,saved[i].name);
  assert.equal(restored[i].total,i);
  assert.equal(restored[i].token,saved[i].token);
 }
 const reloaded=c.restore(restored.map(p=>({...p,type:'local',choice:'ghost'})));
 assert.deepEqual(reloaded,restored,'new colors remain stable on subsequent reload');
}
console.log('LOBBY START PASS: votes, bot quorum, A toggle, UI cleanup, 12 distinct player colors and legacy migration');
