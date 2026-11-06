'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const surfaces=[],labels=[],labelDraws=[];let denyTerrain=false;
const artSource=fs.readFileSync('board-art.js','utf8');
assert.match(artSource,/else sceneryLite\(g,s\)/,
 'low-memory renderer must avoid repainting full scenery every frame');
assert.match(artSource,/if\(!visible\(x,y,75\)\)continue/,
 'off-screen tiles should be culled');

function brush(main=false){return new Proxy({globalAlpha:1},{get(target,key){
 if(key in target)return target[key];
 if(key==='createLinearGradient')return()=>({addColorStop(){}});
 if(key==='fillText')return (text,x,y,maxWidth)=>{if(main){labels.push(text);labelDraws.push({text:String(text),x,y,maxWidth,align:target.textAlign});}};
 return()=>{};
},set(target,key,value){target[key]=value;return true;}});}
const ctx=vm.createContext({window:{PartyPlayerAvatar:{draw(){},drawFront(){},costumeFor(){return 'standard';}}},console,document:{createElement(tag){
 assert.equal(tag,'canvas');const surface={width:0,height:0,getContext(){
  assert.ok(this.width*this.height<=3500000,'terrain allocation stays below the mobile budget');
  return denyTerrain?null:brush();
 }};surfaces.push(surface);return surface;
}}});
for(const name of ['board-map','board-dice','board-dice-renderer','board-items','board-minigame','board-party','board-art'])vm.runInContext(fs.readFileSync(name+'.js','utf8'),ctx,{filename:name+'.js'});
const {BoardParty:P,BoardArt:A}=ctx.window,g=brush(true);
function game(seed){return P.create(Array.from({length:12},(_,i)=>({id:'p'+i,name:'Player '+i,color:'#66aacc'})),{seed});}

// Host overview starts at the full-board fitted zoom, with manual map
// inspection and debug labels that never modify tile positions or HP.
{
 const s=game(17);assert.equal(s.phase,'overview');
 A.overview(s);const fit=A.fitZoom(s);
 assert.ok(Math.abs(s.camera.zoom-fit)<1e-7&&A.canPan(s));
 assert.ok(fit<.3,'the entire 2800-unit world must fit in the viewport');
 const original=JSON.stringify(s.players);
 assert.equal(A.zoom(s,1.5),true);assert.ok(s.camera.zoom>fit);
 assert.equal(A.toggleDebug(s),true);
 const n=s.map.nodes.n35,top=145,viewH=452-top;
 const x=480+(n.position.x-s.camera.x)*s.camera.zoom;
 const y=top+viewH/2+(n.position.y-s.camera.y)*s.camera.zoom;
 const info=A.inspect(s,x,y);
 assert.ok(info&&info.id==='n35');assert.equal(info.type,n.type);
 assert.deepEqual(JSON.parse(JSON.stringify(info.next)),JSON.parse(JSON.stringify(n.nextNodes)));
 assert.equal(s.camera.selectedId,'n35','inspector stores selected visible node without changing game state');
 assert.equal(JSON.stringify(s.players),original,'debug selection cannot move or damage players');
 assert.equal(A.toggleDebug(s),false);
 const labelsBefore=labels.length;
 A.draw(g,0,s);
 const introLabels=labels.slice(labelsBefore).map(String);
 assert.ok(introLabels.includes('ยึดพื้นที่')&&introLabels.includes('ฟื้น HP')&&
   introLabels.includes('อันตราย')&&introLabels.includes('ไอเทม'),
   'overview legend lists only currently supported board benefits and hazards');
 assert.ok(!introLabels.includes('สุ่มเหตุการณ์'),'unavailable event tile no longer appears in overview legend');
}
// Rank labels must stay inside each card at both 2-column (4 players) and
// compact 4-column (12 players) layouts. This catches badge overflow.
for(const n of [4,12]){
 const ranked=P.create(Array.from({length:n},(_,i)=>({id:'r'+i,name:'Player '+i,color:'#66aacc'})),{seed:97+n});
 for(let i=0;i<70;i++)P.update(ranked,.05);
 assert.equal(ranked.phase,'order');
 ranked.players.forEach(p=>{p.dice=[4,3];p.rollAt=0;});
 ranked.order=ranked.players.map(p=>p.id);
 ranked.time=2;P.phase(ranked,'order_result',3);
 labelDraws.length=0;
 A.draw(g,ranked.time,ranked);
 const ranks=labelDraws.filter(v=>v.text.startsWith('ลำดับ '));
 assert.equal(ranks.length,n,'every player rank must be visible');
 const cols=n<=4?2:4,w=cols===2?392:211,h=Math.min(108,310/Math.ceil(n/cols));
 const left=(960-(cols*w+(cols-1)*12))/2;
 ranks.forEach((rank,i)=>{
  const cardX=left+(i%cols)*(w+12),cardY=127+Math.floor(i/cols)*(h+10);
  assert.equal(rank.align,'left','rank text must use a stable left-aligned badge anchor');
  assert.ok(rank.maxWidth>0,'rank text width must be bounded');
  assert.ok(rank.x>=cardX+8&&rank.x+rank.maxWidth<=cardX+w-8,
    'rank must fit within the card horizontally');
  assert.ok(rank.y>cardY+68&&rank.y<=cardY+h-5,
    'rank must sit below dice/score and inside the card vertically');
 });
}
// Awarded items are revealed on the FIRST standings paint, not a fake reel.
for(const n of [4,12]){
 const match=P.create(Array.from({length:n},(_,i)=>({id:'k'+i,name:'Hero '+i,
   color:['#ff628c','#3fe4ef','#ffcf62','#ae94ff'][i%4]})),{seed:320+n});
 P.phase(match,'minigame');
 const finish=match.players.map((p,i)=>({id:p.id,rank:i+1,label:(80-i)+' คะแนน'}));
 assert.equal(P.minigameEnded(match,finish),true);
 assert.equal(match.phase,'standings');
 const before=labels.length;
 A.draw(g,match.time,match);
 const immediate=labels.slice(before).map(String);
 for(const earned of match.results.filter(r=>r.reward))
  assert.ok(immediate.includes('ได้รับ: '+ctx.window.BoardItems.names[earned.reward]),
    'real item name is visible immediately on standings for '+n+' players');
 assert.ok(!immediate.some(s=>s.includes('กำลังสุ่ม')),
   'result page must not show random item animation');
 assert.ok(immediate.some(s=>s.includes('ST')),'large podium ordinal must appear');
}
// Map inspection is an explicit pre-walk state, not a free camera during
// movement. Panning must never change the logical position or remaining dice.
const explore=game(17),walker=explore.players[0];
explore.order=explore.players.map(p=>p.id);P.startTurn(explore);
P.beginMove(explore,walker,4);
explore.camera.zoom=1;explore.camera.x=870;explore.camera.y=720;
assert.equal(A.canPan(explore),true);
const before={x:explore.camera.x,y:explore.camera.y,node:walker.currentNodeId,steps:explore.move.remaining};
assert.equal(A.pan(explore,120,-90),true);
assert.ok(explore.camera.x<before.x&&explore.camera.y>before.y);
assert.equal(explore.move.remaining,before.steps);assert.equal(walker.currentNodeId,before.node);
assert.equal(A.zoom(explore,1.25),true);
const chosenZoom=explore.camera.zoom,explorePlayers=JSON.stringify(explore.players);
for(let i=0;i<30;i++)A.draw(g,i/60,explore);
assert.equal(explore.camera.zoom,chosenZoom,'pre-walk manual zoom survives subsequent render frames');
assert.equal(JSON.stringify(explore.players),explorePlayers);
P.action(explore,walker.id,'A');
assert.equal(A.canPan(explore),false);
assert.equal(A.pan(explore,100,100),false);
assert.match(artSource,/for\(const \[from,to\] of map\.bridges\)/,
 'the low-memory renderer must also paint bridge decks');
const initialSurfaces=surfaces.length;
const s=game(1);for(let i=0;i<70;i++)P.update(s,.05);assert.equal(s.phase,'order');A.draw(g,0,s);assert.equal(surfaces.length,initialSurfaces,'dice order screen does not allocate the world');assert.ok(labels.includes('ทอยลูกเต๋าเพื่อจัดลำดับ'));
s.order=s.players.map(p=>p.id);P.startTurn(s);A.draw(g,0,s);assert.equal(surfaces.length,initialSurfaces+1);const old=surfaces.at(-1);
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
for(let i=0;i<60;i++)A.draw(g,i/60,s);assert.equal(surfaces.length,initialSurfaces+1,'terrain is reused');assert.equal(JSON.stringify(s.players),snapshot);
const t=game(2);t.order=t.players.map(p=>p.id);P.startTurn(t);denyTerrain=true;A.draw(g,0,t);
assert.equal(old.width,1);assert.equal(old.height,1,'previous match pixels are released');assert.equal(surfaces.length,initialSurfaces+2);
assert.equal(surfaces.at(-1).width,1,'failed allocation is released too');assert.ok(labels.includes('A • ทอยลูกเต๋า'));
for(let i=0;i<10;i++)A.draw(g,i,t);assert.equal(surfaces.length,initialSurfaces+2,'allocation failure falls back without a retry loop');
// A BOARD minigame must show exactly one results/reward page. During return,
// sprites and scores must not be presented as a second prize roll.
const intermission=game(4);
intermission.order=intermission.players.map(p=>p.id);
P.startTurn(intermission);
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
for(let i=0;i<92;i++)P.update(intermission,.05); // 4.5s reward hold (+0.8s)
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
// A Lucky Star item reel must show the actual result, then the prize above
// the landing player's head before any turn advancement.
const lucky=game(2);
lucky.order=lucky.players.map(p=>p.id);P.startTurn(lucky);
const luckyPlayer=lucky.players[0],tile=lucky.map.luckyTileIds[0];
luckyPlayer.currentNodeId=tile;
P.land(lucky);
assert.equal(lucky.phase,'lucky_roulette');
const luckyItem=lucky.lucky.item;
let luckyLabelStart=labels.length;A.draw(g,lucky.time,lucky);
assert.ok(labels.slice(luckyLabelStart).includes('LUCKY STAR'));
assert.ok(labels.slice(luckyLabelStart).some(x=>String(x).includes('กำลังสุ่มไอเทม')));
for(let i=0;i<41;i++)P.update(lucky,.05);
luckyLabelStart=labels.length;A.draw(g,lucky.time,lucky);
assert.ok(labels.slice(luckyLabelStart).some(x=>String(x).includes('ได้รับ: '+ctx.window.BoardItems.names[luckyItem])));
for(let i=0;i<29;i++)P.update(lucky,.05);
assert.equal(lucky.phase,'effect');assert.equal(lucky.effect.kind,'luckyReward');
luckyLabelStart=labels.length;A.draw(g,lucky.time,lucky);
assert.ok(labels.slice(luckyLabelStart).some(x=>String(x).includes('ได้รับ: '+ctx.window.BoardItems.names[luckyItem])));
console.log('BOARD ART PASS: automatic order screen, bounded/reused terrain, replay release and null-context vector fallback');
