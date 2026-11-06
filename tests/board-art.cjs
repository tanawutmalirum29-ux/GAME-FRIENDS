'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const surfaces=[],labels=[];let denyTerrain=false;
const artSource=fs.readFileSync('board-art.js','utf8');
assert.match(artSource,/else sceneryLite\(g,s\)/,
 'low-memory renderer must avoid repainting full scenery every frame');
assert.match(artSource,/if\(!visible\(x,y,75\)\)continue/,
 'off-screen tiles should be culled');

function brush(main=false){return new Proxy({globalAlpha:1},{get(target,key){
 if(key in target)return target[key];
 if(key==='createLinearGradient')return()=>({addColorStop(){}});
 if(key==='fillText')return text=>{if(main)labels.push(text);};
 return()=>{};
},set(target,key,value){target[key]=value;return true;}});}
const ctx=vm.createContext({window:{PartyPlayerAvatar:{draw(){},costumeFor(){return 'crown';}}},console,document:{createElement(tag){
 assert.equal(tag,'canvas');const surface={width:0,height:0,getContext(){
  assert.ok(this.width*this.height<=3500000,'terrain allocation stays below the mobile budget');
  return denyTerrain?null:brush();
 }};surfaces.push(surface);return surface;
}}});
for(const name of ['board-map','board-dice','board-items','board-minigame','board-party','board-art'])vm.runInContext(fs.readFileSync(name+'.js','utf8'),ctx,{filename:name+'.js'});
const {BoardParty:P,BoardArt:A}=ctx.window,g=brush(true);
function game(seed){return P.create(Array.from({length:12},(_,i)=>({id:'p'+i,name:'Player '+i,color:'#66aacc'})),{seed});}
const s=game(1);A.draw(g,0,s);assert.equal(surfaces.length,0,'initial order screen does not allocate the world');assert.ok(labels.includes('ทอยลูกเต๋าเพื่อจัดลำดับ'));
s.order=s.players.map(p=>p.id);P.startTurn(s);A.draw(g,0,s);assert.equal(surfaces.length,1);const old=surfaces[0];
assert.ok(old.width*old.height>1000000);
ctx.window.BoardItems.add(s.players[0],'shield');
ctx.window.BoardItems.add(s.players[0],'potion');
P.action(s,s.players[0].id,'B');A.draw(g,0,s);
assert.ok(labels.some(x=>String(x).includes('กระเป๋าไอเทม (2 ชิ้น)')),
 'backpack overlay must be visible on the main board');
P.action(s,s.players[0].id,'A');A.draw(g,0,s);
assert.ok(labels.some(x=>String(x).includes('Healing Potion')),
 'cycling selection draws the selected item name in the backpack');
s.players[0].bagOpen=false;
const snapshot=JSON.stringify(s.players);
for(let i=0;i<60;i++)A.draw(g,i/60,s);assert.equal(surfaces.length,1,'terrain is reused');assert.equal(JSON.stringify(s.players),snapshot);
const t=game(2);t.order=t.players.map(p=>p.id);P.startTurn(t);denyTerrain=true;A.draw(g,0,t);
assert.equal(old.width,1);assert.equal(old.height,1,'previous match pixels are released');assert.equal(surfaces.length,2);
assert.equal(surfaces[1].width,1,'failed allocation is released too');assert.ok(labels.includes('A • ทอยลูกเต๋า'));
for(let i=0;i<10;i++)A.draw(g,i,t);assert.equal(surfaces.length,2,'allocation failure falls back without a retry loop');
// A BOARD minigame must show exactly one results/reward page. During return,
// sprites and scores must not be presented as a second prize roll.
const intermission=game(4);
intermission.order=intermission.players.map(p=>p.id);
P.phase(intermission,'minigame_pending');
assert.equal(P.minigameStarted(intermission,'chickens'),true);
assert.equal(P.minigameEnded(intermission,intermission.players.map((p,i)=>({
 id:p.id,rank:i+1,label:(20-i)+' คะแนน'
}))),true);
const frameLabels=()=>{
 const start=labels.length;
 A.draw(g,intermission.time,intermission);
 return labels.slice(start).map(String);
};
assert.ok(frameLabels().includes('สรุปผลมินิเกมและรางวัล'));
for(let i=0;i<52;i++)P.update(intermission,.05);
assert.equal(intermission.phase,'rewards');
const firstReveal=frameLabels();
assert.ok(firstReveal.includes('สรุปผลมินิเกมและรางวัล'));
assert.ok(firstReveal.includes('กำลังสุ่ม...'),'prizes spin once on reward reveal');
for(let i=0;i<76;i++)P.update(intermission,.05);
assert.equal(intermission.phase,'returning');
const back=frameLabels();
assert.ok(!back.includes('กำลังสุ่ม...'),'returning cannot start a second spinner');
assert.ok(!back.includes('สรุปผลมินิเกมและรางวัล'),
 'returning never repeats the results full-screen panel');
for(let i=0;i<13;i++)P.update(intermission,.05);
assert.equal(intermission.phase,'round_order');
const newTurn=frameLabels();
assert.ok(!newTurn.includes('กำลังสุ่ม...'));
assert.ok(!newTurn.includes('สรุปผลมินิเกมและรางวัล'));
assert.ok(newTurn.some(x=>x.includes('เริ่มรอบที่ 2')),
 'new round shows a short on-map notice rather than a second result page');
console.log('BOARD ART PASS: immediate order screen, bounded/reused terrain, replay release and null-context vector fallback');
