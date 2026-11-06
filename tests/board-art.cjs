'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const surfaces=[],labels=[],labelDraws=[],avatarDraws=[],portraitDraws=[];let denyTerrain=false;
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
const ctx=vm.createContext({window:{PartyPlayerAvatar:{draw(_g,p){avatarDraws.push(JSON.parse(JSON.stringify(p)));},drawFront(_g,p){portraitDraws.push(p.id);},costumeFor(){return 'standard';}}},console,document:{createElement(tag){
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
 const n=s.map.nodes.n35,top=94,viewH=452-top;
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
 match.camera.overview=false;
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
assert.equal(s.players[0].actionIndex,1,'B selects the stocked potion slot without a popup');
assert.ok(labels.includes('ยา'),'permanent grid labels the potion slot, without verbose footer instructions');
P.action(s,s.players[0].id,'B');A.draw(g,0,s);
assert.equal(s.players[0].actionIndex,6,'second B skips empty slots to shield');
assert.ok(labels.includes('โล่'),'permanent grid includes shield, regardless of selection');
s.players[0].actionIndex=0;
const snapshot=JSON.stringify(s.players);
for(let i=0;i<60;i++)A.draw(g,i/60,s);assert.equal(surfaces.length,initialSurfaces+1,'terrain is reused');assert.equal(JSON.stringify(s.players),snapshot);
const t=game(2);t.order=t.players.map(p=>p.id);P.startTurn(t);denyTerrain=true;A.draw(g,0,t);
assert.equal(old.width,1);assert.equal(old.height,1,'previous match pixels are released');assert.equal(surfaces.length,initialSurfaces+2);
assert.equal(surfaces.at(-1).width,1,'failed allocation is released too');assert.ok(labels.some(x=>String(x).includes('A ทอย')));
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
assert.ok(!firstReveal.includes('กำลังสุ่ม...'),'result rewards reveal the assigned item without spinning');
for(const earned of intermission.results.filter(r=>r.reward))
 assert.ok(firstReveal.includes('ได้รับ: '+ctx.window.BoardItems.names[earned.reward]),
  'the exact assigned item is visible in both standings and reward phases');
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

// Board actors retain their last world heading after stopping, while UI cards
// deliberately use the frontal portrait and never add world-facing avatars.
{
 const s=game(420);s.order=s.players.map(p=>p.id);P.startTurn(s);
 const p=s.players[0],from=s.map.nodes[p.currentNodeId],to=s.map.nodes[from.nextNodes[0]];
 P.beginMove(s,p,2);
 const dx=to.position.x-from.position.x,dy=to.position.y-from.position.y,d=Math.hypot(dx,dy);
 P.input(s,p.id,{turnId:s.turnId,actionId:1,keys:{axisX:dx/d,axisY:dy/d}});
 const before=JSON.stringify(s.players);avatarDraws.length=0;portraitDraws.length=0;
 A.draw(g,0,s);
 const first=avatarDraws.find(v=>v.id===p.id);
 assert.ok(first&&Math.abs(first.dir.x-dx/d)<1e-8&&Math.abs(first.dir.y-dy/d)<1e-8);
 assert.equal(JSON.stringify(s.players),before,'facing cache cannot write to host-owned player data');
 s.move=null;s.inputs={};P.phase(s,'ready',12);s.time=2;
 avatarDraws.length=0;portraitDraws.length=0;A.draw(g,2,s);
 const stopped=avatarDraws.find(v=>v.id===p.id);
 assert.deepEqual(stopped.dir,first.dir,'idle keeps the last meaningful world direction');
 assert.equal(avatarDraws.length,s.players.length,'only world actors use the overhead projection');
 assert.ok(portraitDraws.includes(p.id),'current-player HUD uses frontal portrait');
 P.beginOrder(s);P.phase(s,'order',12);s.camera.overview=false;
 avatarDraws.length=0;portraitDraws.length=0;A.draw(g,2,s);
 assert.equal(avatarDraws.length,0,'dice cards never use the overhead world sprite');
 assert.equal(portraitDraws.length,s.players.length,'all dice cards show the frontal portrait');
}
console.log('BOARD AVATAR PASS: retained world heading, unchanged player state, front-facing HUD/order portraits');


// The dice panel and its content use one shared screen center. Neither the
// selected item nor long player name may spill outside the centered panel.
{
 const s=game(2),p=s.players[0];s.order=[p.id,s.players[1].id];P.startTurn(s);
 p.name='ชื่อผู้เล่นภาษาไทยยาวมากเพื่อทดสอบตำแหน่งให้อยู่ตรงกลาง';
 const start=labelDraws.length;A.draw(g,0,s);
 const frame=labelDraws.slice(start);
 assert.ok(frame.some(x=>x.text===p.name&&x.align==='center'&&x.x===480),
   'the full player title is anchored on the dice panel center');
 assert.ok(frame.some(x=>x.text.includes('B เปลี่ยนตัวเลือก')&&x.x===480),
   'instruction sits below the dice without drifting right');
 assert.doesNotMatch(artSource,/% • รอ|backpackOverlay\(g,s\)/,
   'progress percentages and popup bag are gone from the board renderer');
}


// Compact BOARD HUD: no numeric HP/status captions, 7 inventory types + Roll,
// zero-stock badges, duplicate counts, and fixed-width visible names.
{
 const s=game(2026),p=s.players[0];s.order=s.players.map(v=>v.id);P.startTurn(s);
 p.name='บอทยาวมากกว่าบอท 12 เพื่อทดสอบการตัดชื่อบน HUD';
 p.bag=['potion','potion','shield'];p.item='potion';p.actionIndex=6;p.hp=72;
 const start=labelDraws.length;A.draw(g,0,s);
 const frame=labelDraws.slice(start);
 const texts=frame.map(x=>x.text);
 assert.ok(texts.includes('2'),'duplicate potion quantity appears in one slot');
 assert.ok(texts.includes('1'),'shield quantity appears in one slot');
 assert.ok(texts.filter(x=>x==='0').length>=4,'all unavailable types display zero badges');
 assert.deepEqual(texts.filter(x=>/\/100$/.test(x)),['72/100'],'only the active player footer displays a numerical HP fraction');
 assert.ok(!texts.includes('ก้าวที่เหลือ')&&!texts.includes('รอ'),
  'unnecessary top status and bottom caption are gone');
 assert.ok(!texts.some(x=>x.includes('ลากจอยเพื่อเดิน')),
  'old instruction below the portrait is not drawn');
 assert.match(artSource,/clippedPlayerName\(g,p\.name,nameX/,'all top names use a measured clipping window');
 assert.match(artSource,/footsteps\(g,855,footerY\+32/,'two vector footprints precede the step total');
 assert.match(artSource,/kinds=\['roll',\.\.\.window\.BoardItems\.ids\]/,
  'all fixed inventory types appear alongside the Roll slot');
}

// 12 players fit into one row at y=37. The bottom active card includes HP.
{
 const s=game(401),p=s.players[0];s.order=s.players.map(v=>v.id);P.startTurn(s);
 p.hp=43;
 const rects=[],old=g.roundRect;g.roundRect=(...r)=>{rects.push(r);old(...r);};
 const before=labelDraws.length;A.draw(g,0,s);
 g.roundRect=old;
 const badges=rects.filter(([x,y,w,h])=>y===37&&h===42&&w>20);
 assert.equal(badges.length,12,'all twelve scoreboard cards fit one top row');
 assert.ok(badges.every((r,i)=>i===0||r[0]>badges[i-1][0]));
 assert.ok(badges.at(-1)[0]+badges.at(-1)[2]<=960);
 assert.ok(rects.some(([x,y,w,h])=>x===82&&y===513&&w===162&&h===6),
  'active-player health bar is located below the name in the footer');
 const health=labelDraws.slice(before).filter(v=>v.text.endsWith('/100'));
 assert.deepEqual(health.map(v=>v.text),['43/100']);
 assert.equal(health[0].y,501,'numeric HP remains beneath the active player name');
}

// BOARD PARTY tall / split-screen views must GAIN scene area, not stretch
// actors, cover HUD overlays, or move the game-camera input target.
{
 const session=game(509);
 session.order=session.players.map(p=>p.id);
 P.startTurn(session);
 const smallZoom=A.fitZoom(session);
 session.camera.viewHeight=720; // 1024 × 768 iPad: 960 logical pixels wide
 const tallZoom=A.fitZoom(session);
 assert.ok(tallZoom>=smallZoom,'extra height lets the overview show more of the island map');
 const rects=[],fills=[],oldRect=g.roundRect,oldFill=g.fillRect;
 g.roundRect=(...params)=>{rects.push(params);oldRect(...params);};
 g.fillRect=(...params)=>{fills.push(params);oldFill(...params);};
 const initial=JSON.stringify(session.players);
 A.draw(g,0,session);
 assert.ok(fills.some(([x,y,w,h])=>x===0&&y===94&&w===960&&h===538),
  'world is painted through all available height before the 80px footer');
 assert.ok(rects.some(([x,y,w,h])=>x===12&&y===640&&w===936&&h===68),
  'HUD footer is pinned 80 logical pixels above the real bottom');
 assert.equal(JSON.stringify(session.players),initial,'adaptive layout cannot change host player state');
 assert.equal(session.map.nodes.n35.id,'n35');
 session.camera.zoom=1;
 const center=session.map.nodes.n35.position;
 session.camera.x=center.x;session.camera.y=center.y;
 A.toggleDebug(session);
 assert.equal(A.inspect(session,480,94+538/2)?.id,'n35',
  'map inspection uses the taller viewport center');
 g.roundRect=oldRect;g.fillRect=oldFill;
 // 1:1 Split View adds another 240 logical pixels; do not hardcode 16:9.
 session.camera.viewHeight=960;
 const footerRects=[];g.roundRect=(...params)=>{footerRects.push(params);oldRect(...params);};
 A.draw(g,1,session);
 assert.ok(footerRects.some(([x,y,w,h])=>x===12&&y===880&&w===936&&h===68),
  'square viewport anchors the footer near the actual bottom');
 g.roundRect=oldRect;
}
console.log('BOARD VIEWPORT PASS: 16:9 / 4:3 / 1:1 map expansion, footer anchoring and stable game state');
