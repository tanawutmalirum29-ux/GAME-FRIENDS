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
 'controller A must not cast ready outside authoritative Party Plaza input');
assert.match(source,/window\.PartyPlaza\?\.configure\(/,
 'lobby zones must be wired into the existing host controller');
assert.doesNotMatch(source,/case 'ready_area':/,
 'the old physical READY pad no longer exists');
assert.match(source,/if\(typeof window!=='undefined'&&window\.PartyPlaza\?\.zoneAt\(p\)\)return false;/,
 'A can toggle ready only in free lobby space without overriding stations');
assert.match(source,/if\(!z\)\{[\s\S]*?castLobbyReadyVote\(p\.conn\)/,
 'A in empty lobby space retains ready vote functionality');
const plazaLayout=JSON.parse(fs.readFileSync(path.join(root,'src/lobby/lobby-zones.json'),'utf8'));
assert.ok(!plazaLayout.zones.some(z=>z.id==='ready_area'||z.id==='room_corner'),
 'no obsolete physical READY/room-popup zones remain');
assert.match(html,/id="plazaCenterQrBtn"/,
 'one central tappable QR replaces the READY disc');
assert.match(html,/id="qrBox"/,
 'existing QR generator targets the central button');
assert.match(source,/\$\('plazaCenterQrBtn'\)\.addEventListener\('click',copyInvite\)/,
 'tapping the central QR copies the room invite');
assert.match(css,/\.plaza-center-qr-btn\{/,
 'central QR has an opaque round backing that masks old READY artwork');
assert.match(html,/id="plazaRoomToggle"[^>]*hidden/,
 'the redundant top QR button is no longer shown');

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
 assert.match(source,/const COLOR_NAMES=/,'host has human-readable seat color names');
 assert.match(source,/showToast\(p.name\+' เปลี่ยนสีเป็น '\+colorName\)/,
  'color-change toast must say the Thai name rather than HEX');
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
  // Requested purple/magenta are ~29.3 apart in CIELAB; prioritize six
  // strongly separated starting colors (minimum >39) without changing HEX.
  const minimum=i<6&&j<6?35:28;
  assert.ok(distance>=minimum,'player colors '+(i+1)+'/'+(j+1)+' are too similar: '+distance);
 }
 const assigned=Array.from({length:12},()=>c.add());
 assert.deepEqual(assigned,palette,'colors issued in high-contrast priority order');
 assert.equal(c.add(),null,'thirteenth player cannot reuse another color');
 // Both the immediately previous 12-color palette and the older 12 pastel
 // colors are valid persisted sessions and must migrate independently.
 const legacy=Array.from(c.legacy);
 assert.equal(legacy.length,24,'both historic palettes remain supported');
 for(const oldColors of [legacy.slice(0,12),legacy.slice(12)]){
  const saved=oldColors.map((color,i)=>({
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
}
// COLOR STUDIO replaces the unused lower-left PLAY CORNER; only B acts there.
const zones=JSON.parse(fs.readFileSync(path.join(root,'src/lobby/lobby-zones.json'),'utf8'));
const station=zones.zones.find(z=>z.id==='color_studio');
assert.ok(station&&station.center.x===144&&station.center.y===437);
assert.equal(station.trigger,'button_B');
assert.ok(station.interactionRadiusPx>=45,'left-bottom color zone must be walkable and usable');
assert.ok(!zones.zones.some(z=>z.id==='play_corner'),'unused PLAY CORNER removed');
const plaza=fs.readFileSync(path.join(root,'src/lobby/party-plaza.js'),'utf8');
assert.match(plaza,/zone\?\.id==='color_studio'\)callbacks\.changeColor\?\.\(p\)/,
 'B input invokes color change only in the correct zone');
assert.match(plaza,/plazaBPressed=b/,'held B is edge-triggered, not repeated');
const colorStart=source.indexOf('function nextFreeLobbyColor(');
const colorEnd=source.indexOf('window.PartyPlaza?.configure(',colorStart);
assert.ok(colorStart>0&&colorEnd>colorStart);
const pStart=source.indexOf('const COLORS = ');
const pEnd=source.indexOf('// The legacy bridge',pStart);
const colorContext={};
vm.createContext(colorContext);
vm.runInContext(source.slice(pStart,pEnd)+'\n'+source.slice(colorStart,colorEnd)+
 '\nthis.colors=COLORS;this.cycle=nextFreeLobbyColor;',colorContext);
const paletteForZone=Array.from(colorContext.colors);
const p1={id:'p1',color:paletteForZone[0]};
const p2={id:'p2',color:paletteForZone[1]};
const p3={id:'p3',color:paletteForZone[2]};
const room=[p1,p2,p3];
assert.equal(colorContext.cycle(p1,room),paletteForZone[3],
 'B skips colors already worn by others');
p1.color=paletteForZone[3];
assert.equal(colorContext.cycle(p1,room),paletteForZone[4],
 'repeated B presses move to the next unoccupied color');
assert.equal(new Set(room.map(p=>p.color)).size,3,'no duplicate after cycling');
assert.equal(colorContext.cycle({id:'fake',color:paletteForZone[0]},room),null,
 'non-member cannot change a room color');
const fullRoom=paletteForZone.map((color,i)=>({id:'seat-'+i,color}));
assert.equal(colorContext.cycle(fullRoom[0],fullRoom),null,
 'full 12-player room has no free colors to cycle');
fullRoom.splice(8,1);
assert.equal(colorContext.cycle(fullRoom[7],fullRoom),paletteForZone[8],
 'a newly freed color immediately becomes available for selection');
assert.match(source,/!players\.includes\(p\)/,
 'color change must require a current authoritative participant');
assert.match(source,/inZone\(p,'color_studio'\)/,
 'color change must check real position before allowing B');
assert.ok(source.includes("zoneBAction(p,zone)"),'host computes the contextual B action');
assert.ok(source.includes("zone?.id==='color_studio'&&nextFreeLobbyColor(p)"),'no color glow if all colors are used');
assert.ok(source.includes("t:'plaza-b-zone',zone"),'host sends B status to only that player');
assert.ok(plaza.includes('p.plazaBActionConn===p.conn&&p.plazaBAction===action'),'no per-frame B prompt spam');
assert.ok(source.includes("['wardrobe','color_studio'].includes(data.zone)"),'controller only accepts known B zones');
assert.ok(source.includes("classList.toggle('plaza-b-ready',!!plazaBAction)"),'controller turns glow on/off');
assert.doesNotMatch(plaza,/B • เปลี่ยนสี|WARDROBE • B|COLOR STUDIO • กด B/,
 'no host B legends in the zone picture');
assert.match(source,/broadcastRoster\(\); \/\/ Immediately update all clients/,
 'color changes must be sent to peers immediately');
assert.match(source,/if\(self\)syncControllerAvatarColor\(self\.color\)/,
 'controller portrait must update when its roster color changes');
// Room/BOARD loading transition must not expose unfinished scene geometry.
const plazaLoading=fs.readFileSync(path.join(root,'src/lobby/party-plaza.js'),'utf8');
const artLoading=fs.readFileSync(path.join(root,'src/lobby/party-plaza-art.js'),'utf8');
const boardLoading=fs.readFileSync(path.join(root,'src/app/board/integration.js'),'utf8');
assert.match(html,/id="transitionLoading"/,'full-screen transition exists at first host creation');
assert.match(html,/id="transitionLoadingRetry"/,'failed scene can be retried in the same room');
assert.match(css,/\.transition-loading\.hidden\{display:none!important\}/,'loading screen fully detaches when ready');
assert.match(source,/showTransitionLoading\('plaza'/,'first room waits behind the curtain');
assert.match(source,/hideTransitionLoading\('plaza'\)/,'room loader can close after scene is ready');
assert.match(plazaLoading,/await next\.decode\(\)/,'lobby SVG decodes before scene becomes ready');
assert.match(plazaLoading,/paint\(\); \/\/ Paint the finished map BEFORE/,'first completed paint precedes readiness');
assert.doesNotMatch(plazaLoading,/else backgroundFallback\(c\)/,
 'circle-zone diagnostic grid must never flash as a visible temporary lobby');
assert.match(plazaLoading,/callbacks\.error\?\.\(error\)/,'failed SVG is recoverable without closing a room');
assert.match(plazaLoading,/function retry\(\)/,'SVG loader offers a bounded/manual retry path');
assert.match(artLoading,/function reset\(\)/,'broken encoded SVG cache can be retried');
assert.match(boardLoading,/showTransitionLoading\('board'/,'board creates a loading curtain during map setup');
assert.match(boardLoading,/drawGame\(graphicsClock\);/,'board paints the first full frame before revealing it');
assert.match(boardLoading,/setTimeout\(\(\)=>hideTransitionLoading\('board'\),150\)/,
 'suspended requestAnimationFrame cannot strand the board loading curtain');
console.log('LOBBY START PASS: votes, bot quorum, A toggle, UI cleanup, 12 distinct player colors and legacy migration');
