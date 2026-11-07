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
assert.match(source,/send\(controllerConn,\{t:'lobby-ready'\}\)/,'controller A sends ready packet');
console.log('LOBBY START PASS: votes, bot quorum, A toggle, guards, UI cleanup');
