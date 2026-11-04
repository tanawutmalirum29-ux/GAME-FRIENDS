'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('app.js','utf8');
// Expose test-only readers inside the existing private IIFE without changing
// production code or relying on internal globals.
const appForTest=source.replace('requestAnimationFrame(animate);\n})();',
  'window.__ghostTest={getRound:()=>round,getPlayers:()=>players,renderLeaderboard};\nrequestAnimationFrame(animate);\n})();');
assert.notEqual(appForTest,source,'test injection must find the IIFE footer');
const ghostSource=fs.readFileSync('ghost-attack.js','utf8');
const artSource=fs.readFileSync('graveyard-art.js','utf8');
const combatSource=fs.readFileSync('combat-motion.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('style.css','utf8');
const hostLauncher=fs.readFileSync('host.html','utf8');

// Game catalog retains Ghost Attack and now adds CHICKENS as game two.
assert.match(html,/data-pick="ghost"/);
assert.equal([...html.matchAll(/data-pick="/g)].length,2);
assert.doesNotMatch(html,/data-pick="stars"|data-pick="paint"|data-pick="tanks"/);
assert.match(html,/src=".\/ghost-attack\.js"/);
assert.match(html,/src=".\/chickens\.js"/);
assert.match(html,/data-pick="chickens"/);
assert.match(html,/src="\.\/graveyard-art\.js"/);
assert.match(artSource,/window\.GhostCemeteryArt=Object\.freeze/);
assert.match(html,/<script defer src="\.\/combat-motion\.js"><\/script>[\s\S]*?<script defer src="\.\/ghost-attack\.js"><\/script>/);
assert.match(combatSource,/window\.PartyCombatMotion=/);
assert.doesNotMatch(html,/src="\.\/minigames\.js"/);
assert.equal(fs.existsSync('minigames.js'),false,'delete legacy game engine');
assert.doesNotMatch(source,/window\.PartyMiniGames|function spawnStar|function drawBackdrop/);
assert.match(source,/const MODES = \{ghost:'GHOST ATTACK',chickens:'CHICKENS'\}/);
assert.match(source,/const MAX_PLAYERS = 12;/);
assert.match(source,/MODE_COVER_SVG/);
assert.match(html,/data-session-mode="queue"/);
assert.match(html,/data-session-mode="quick"/);
assert.match(html,/id="uiModal"/);
assert.doesNotMatch(source,/\b(?:alert|confirm)\(/);
assert.match(css,/#hostLobby #hostQueue\{display:none!important\}/);
assert.match(css,/#hostLobby \.lobby-roster \.roster-pick\.picked\{[\s\S]*?display:flex;/);
// Only the corner world obstacle displays the start countdown/player total.
assert.doesNotMatch(html,/id="gameMode"|id="timer"|class="game-name"/);
assert.doesNotMatch(source,/\$\('gameMode'\)|\$\('timer'\)/);
assert.match(ghostSource,/function drawCornerHud\(ctx,round,players,state\)/);
assert.match(ghostSource,/kind:'hud-blocker'/);
assert.match(css,/body\.host-playing #game \.leader-chip\{[\s\S]*?grid-template-rows:17px 16px 18px/);
assert.match(css,/body\.host-playing #game \.leaderboard\{[\s\S]*?height:58px!important/);
assert.match(css,/body\.host-playing #game \.leader-chip span\.leader-held-icon\{/);
assert.match(source,/itemSlot\.classList\.add\('leader-held-icon'\)/);
assert.doesNotMatch(source,/leader-held-item/);
assert.doesNotMatch(css,/leader-held-item/);
assert.match(ghostSource,/function drawPickupNotice\(ctx,p,w,h\)/);
assert.match(ghostSource,/p\.pickupNoticeTime=2\.1/);
assert.match(source,/root\.style\.setProperty\('--leader-count'/);
assert.match(html,/ไม่จับเวลา/);
assert.doesNotMatch(html,/id="duration"/);
assert.match(html,/id="controllerInventory"/);
assert.match(html,/<div class="gamepad-hud">[\s\S]*?<div id="controllerInventory" class="controller-inventory hidden"[\s\S]*?<div class="gamepad-top-actions">/,
  'game-specific inventory starts hidden and lives in the top header');
assert.equal([...html.matchAll(/id="controllerInventory"/g)].length,1);
assert.match(html,/<button[^>]*data-control="alt"[^>]*>[\s\S]*?<span class="face-button-letter">B<\/span><span id="buttonBLabel" class="face-caption">/);
assert.match(html,/<button[^>]*data-control="action"[^>]*>[\s\S]*?<span class="face-button-letter">A<\/span><span id="buttonALabel" class="face-caption">/);
assert.match(css,/#controller #controllerActive #controllerInventory\.hidden\{\s*display:none!important/);
assert.match(css,/#controller #controllerActive \.gamepad-preview-column\{\s*transform:translateX\(clamp\(18px,3\.15vw,56px\)\)/,
  'preview is translated to the right without changing width or height');
assert.match(css,/#controller #controllerActive \.face-button \.face-caption\{[\s\S]*?position:static!important/);
assert.match(html,/id="targetCycleControls"/);
assert.match(html,/id="targetPrevBtn"/);
assert.match(html,/id="targetNextBtn"/);
assert.ok(html.indexOf('class="face-button-wrap face-b"')<html.indexOf('id="targetCycleControls"'),
  'slow target controls live after B in DOM');
assert.match(css,/#joystickZone\{[\s\S]*?grid-column:1 \/ -1;/);
assert.match(css,/#phoneGameChoices \.phone-game-choice\.selected\{/);
assert.match(css,/\.gamepad-face-buttons \.target-cycle-controls\{[\s\S]*?order:2;/);
assert.match(source,/const travel=64;/);
assert.match(css,/\.gamepad-face-buttons\{\s*pointer-events:none;/);
assert.match(css,/\.gamepad-face-buttons \.face-button\s*,[\s\S]*?pointer-events:auto;/);
assert.match(css,/\.gamepad-preview-column #videoStartBtn\{\s*pointer-events:auto;/);
assert.match(css,/#controllerActive \.target-cycle-controls/);
assert.match(css,/#controller #controllerInventory/);
assert.match(css,/body\.controller-playing #controllerActive #phoneGameChoices/);
assert.match(css,/html,body\{\s*height:100%;width:100%;margin:0;\s*overflow:hidden!important/);
assert.match(hostLauncher,/\?host=1/);
assert.match(html,/id="joinLandscapeBtn"/);
assert.match(source,/function tryLandscapeOrientation\(/);
assert.match(source,/request\.then\(tryLandscapeOrientation,tryLandscapeOrientation\)/);
assert.match(source,/width:256,height:256,correctLevel:QRCode\.CorrectLevel\.M/);
assert.match(css,/#hostLobby \.qr-share-stack \.qr-box\{\s*flex:0 0 auto;\s*aspect-ratio:1 \/ 1;/);
assert.match(css,/body\.host-playing #game\.game-page\{[\s\S]*?rotate\(90deg\)/);
assert.match(css,/#controller #joinForm \.join-orientation/);
assert.doesNotMatch(source,/document\.exitFullscreen\(/);
assert.match(source,/const root=document\.documentElement;/);

// Engine unit tests: deterministic rules are exercised without any browser.
const loadedImages=[];
class FakeSvgImage{
 constructor(){this.complete=false;this.naturalWidth=0;loadedImages.push(this);}
 set src(v){this._src=v;this.complete=true;this.naturalWidth=v.startsWith('data:image/svg+xml')?64:0;}
 get src(){return this._src;}
}
const ghostSandbox=vm.createContext({window:{},Image:FakeSvgImage});
vm.runInContext(combatSource,ghostSandbox,{filename:'combat-motion.js'});
vm.runInContext(artSource,ghostSandbox,{filename:'graveyard-art.js'});
vm.runInContext(ghostSource,ghostSandbox,{filename:'ghost-attack.js'});
const ghost=ghostSandbox.window.GhostAttack;
const art=ghostSandbox.window.GhostCemeteryArt;
const mkPlayers=n=>Array.from({length:n},(_,i)=>({
 id:'p'+i,name:'Tester '+i,color:['#ff628c','#3fe4ef','#ffcf62','#ae94ff'][i%4],
 type:'remote',active:true,input:{},alive:true,score:0
}));
const init=n=>{const players=mkPlayers(n),round={mode:'ghost',phase:'countdown'};
 ghost.setup(round,players);return {round,players,state:round.ghost};};
for(const n of [1,4,5,6,7,8,9,12]){
 const x=init(n);
 assert.equal(x.state.npcs.length,1,'one starting ghost at every player count');
 assert.equal(x.state.world.w,n>=9?1280:n>=5?1080:960);
 assert.equal(x.state.world.h,n>=9?720:n>=5?608:540);
 assert.equal(x.round.rules.viewMode,'topdown');
 assert.ok(x.state.obstacles.length>=6,'solid corner plus cemetery obstacles');
 assert.equal(x.state.obstacles[0].kind,'hud-blocker');
 assert.equal(x.state.hudBlocker,x.state.obstacles[0]);
 // The corner panel is deliberately compact for all room sizes. Its actual
 // collision box must shrink with the art rather than remaining invisible.
 assert.ok(Math.abs(x.state.hudBlocker.w-88*x.state.world.w/960)<1e-7,
   'HUD obstacle width matches the smaller visual footprint');
 assert.ok(Math.abs(x.state.hudBlocker.h-58*x.state.world.h/540)<1e-7,
   'HUD obstacle height matches the smaller visual footprint');
 assert.ok(x.state.hudBlocker.w<x.state.world.w*.1);
 assert.ok(x.state.hudBlocker.h<x.state.world.h*.12);
 assert.ok(['graveyard','egypt'].includes(x.state.theme));
 const kinds=art.kindsForTheme(x.state.theme);
 assert.ok(x.state.obstacles.slice(1).every(o=>kinds.includes(o.kind)),
   'all visual props match the randomly selected arena theme');
 const signature=x.state.theme==='egypt'?'sarcophagus':'coffin';
 assert.equal(x.state.obstacles[1].kind,signature,
   'the first large monument makes the chosen theme obvious');
 assert.ok(x.state.obstacles.slice(1).every(o=>o.x>0&&o.y>0));
 assert.equal(x.players.filter(p=>p.active&&!p.ghost).length,n);
 for(const p of x.players){
  assert.ok(p.x>0&&p.x<x.state.world.w&&p.y>0&&p.y<x.state.world.h);
  assert.equal(p.item,null);
  const o=x.state.hudBlocker;
  assert.ok(p.x>o.x+o.w||p.y>o.y+o.h,'no player spawns inside the HUD');
 }
}
{
 // Even ghost movement cannot cross the physical corner HUD barrier.
 const x=init(9),[p]=x.players,o=x.state.hudBlocker;
 x.round.phase='playing';
 x.state.npcs.forEach(n=>n.stun=999);
 x.players.slice(1).forEach((q,i)=>{q.x=500+i*35;q.y=450;});
 p.x=o.x+o.w+45;p.y=o.y+o.h/2;
 p.input.axisX=-1;p.input.axisY=0;
 for(let i=0;i<22;i++)ghost.update(.045,x.round,x.players);
 assert.ok(p.x>=o.x+o.w+14,'human cannot cross solid HUD');
 p.ghost=true;p.stun=0;p.x=o.x+o.w+45;
 for(let i=0;i<22;i++)ghost.update(.045,x.round,x.players);
 assert.ok(p.x>=o.x+o.w+14,'ghost cannot cross solid HUD');
}
assert.equal(ghost.constants.humanSpeed,172);
assert.equal(ghost.constants.ghostSpeed,186,'modest ghost speed advantage');
assert.ok(ghost.constants.ghostSpeed>ghost.constants.humanSpeed);
assert.ok(ghost.constants.ghostSpeed/ghost.constants.humanSpeed<1.10,
  'ghosts must not become unfairly fast');
assert.equal(ghost.constants.cloakTime,2);
assert.equal(ghost.ITEM_NAMES.slow,'ยาสโลว์เพื่อน');
assert.equal(Object.keys(ghost.ITEM_SVG).length,5);
assert.equal(art.KINDS.length,16);
assert.equal(art.GRAVEYARD_KINDS.length,8);
assert.equal(art.EGYPT_KINDS.length,8);
assert.ok(art.KINDS.includes('coffin')&&art.KINDS.includes('plaque'));
assert.ok(art.EGYPT_KINDS.includes('sarcophagus')&&art.EGYPT_KINDS.includes('pharaoh-bust'));
assert.equal(art.pickTheme('',()=>0),'graveyard');
assert.equal(art.pickTheme('',()=>.9999),'egypt');
assert.equal(art.pickTheme('graveyard',()=>0),'egypt');
assert.equal(art.pickTheme('egypt',()=>0),'graveyard');
assert.equal(art.themeLabel('egypt'),'อียิปต์ฟาโรห์');
assert.notEqual(art.lootSVG('egypt'),art.lootSVG('graveyard'),
  'loot chests have their own art in each theme');
assert.match(art.actorSVG(false,'#ff628c','walk0'),/<svg/);
assert.notEqual(art.actorSVG(false,'#ff628c','walk0'),
  art.actorSVG(false,'#ff628c','walk2'),'moving legs use distinct SVG frames');
assert.match(art.actorSVG(true,'#f5faff','float0'),/<svg/);
const cemeteryGhost=art.actorSVG(true,'#ff628c','float0','graveyard');
const pharaohGhost=art.actorSVG(true,'#ff628c','float0','egypt');
assert.match(pharaohGhost,/data-actor="pharaoh-ghost"/,
  'Egyptian ghosts wear the pharaoh headdress');
assert.match(pharaohGhost,/url\(#nemes\)/,
  'Egyptian ghost crown uses lapis-blue nemes cloth');
assert.notEqual(cemeteryGhost,pharaohGhost,'themes have unique ghost art');
assert.notEqual(pharaohGhost,art.actorSVG(true,'#3fe4ef','float0','egypt'),
  'each converted player retains its character color');
assert.notEqual(pharaohGhost,art.actorSVG(true,'#ff628c','float1','egypt'),
  'pharaoh ghosts have independent animation frames');
assert.equal(art.getActorImage(true,'#ff628c','float0','egypt'),
  art.getActorImage(true,'#ff628c','float0','egypt'),
  'pharaoh ghost frame is cached');
assert.notEqual(art.getActorImage(true,'#ff628c','float0','egypt'),
  art.getActorImage(true,'#ff628c','float0','graveyard'),
  'image cache never mixes ghosts between themes');
assert.notEqual(art.obstacleSVG('coffin',0),art.obstacleSVG('headstone',0));
assert.match(art.obstacleSVG('sarcophagus',0),/<svg[\s>]/);
assert.match(art.obstacleSVG('egypt-obelisk',1),/<svg[\s>]/);
assert.notEqual(art.obstacleSVG('pharaoh-bust',1),
  art.obstacleSVG('sandstone-pillar',1));
assert.equal(art.getObstacleImage('coffin',0),art.getObstacleImage('coffin',0),
  'coffin SVG is cached');
assert.equal(art.getObstacleImage('sarcophagus',1),
  art.getObstacleImage('sarcophagus',1),'Egypt SVG is cached');
assert.equal(art.getLootImage('egypt'),art.getLootImage('egypt'),
  'Egypt-themed crate image stays cached');
assert.ok(loadedImages.length>=5,'preloaded item and cemetery art SVGs');
assert.equal(ghost.getItemIconImage('boost'),ghost.getItemIconImage('boost'));
{
 // Every new round changes the inner arena theme, but retains the same
 // fixed game mode, player capacity and unchanged external game cover.
 const first=init(9),second=init(9),third=init(9);
 assert.notEqual(second.state.theme,first.state.theme);
 assert.notEqual(third.state.theme,second.state.theme);
 for(const x of [first,second,third]){
  if(x.state.theme==='egypt'){
    // Egyptian actor images are preloaded in both the NPC and every user's
    // converted-ghost colors, preventing blank first frames in gameplay.
    const testNPC=art.getActorImage(true,'#f5faff','float0','egypt');
    assert.ok(testNPC.complete&&testNPC.naturalWidth>0);
    for(const p of x.players)
      for(const pose of ['float0','float1','float2'])
        assert.ok(art.getActorImage(true,p.color,pose,'egypt').complete);
  }
  assert.equal(x.state.npcs.length,1,'both themes start with one ghost');
  assert.equal(x.state.world.w,1280,'crowded arena size unchanged');
  const before=x.state.theme;
  x.round.phase='playing';x.state.npcs.forEach(n=>n.stun=999);
  ghost.update(.016,x.round,x.players);
  assert.equal(x.state.theme,before,'theme remains fixed during the round');
 }
}


// Hunting AI predicts paths and assigns distinct pack roles. Ghost bots
// continue to use the same velocity physics, with NO punch or teleporting.
{
 const x=init(4);x.round.phase='countdown';
 const [runner,botA,botB,remote]=x.players;
 x.state.obstacles=[];
 runner.x=500;runner.y=295;runner.vx=160;runner.vy=0;
 remote.x=900;remote.y=490;
 botA.isBot=true;botA.ghost=true;botA.stun=0;botA.botMind=null;
 botA.x=340;botA.y=300;
 botB.isBot=true;botB.ghost=true;botB.stun=0;botB.botMind=null;
 botB.x=285;botB.y=355;
 const npc=x.state.npcs[0];
 npc.x=295;npc.y=245;npc.stun=0;
 ghost.update(.016,x.round,x.players);
 const hunters=[npc,botA,botB];
 const roles=hunters.map(h=>h.huntRole);
 const chaseHunter=hunters.find(h=>h.huntRole==='chase');
 ghost.update(.45,x.round,x.players);
 assert.equal(chaseHunter.huntRole,'chase',
   'pack roles stay stable between pursuit plans');
 assert.ok(roles.includes('chase'),'one hunter presses from behind');
 assert.ok(roles.includes('intercept'),'another hunter runs to the exit');
 assert.ok(roles.includes('flank-left'),'the third cuts a side escape route');
 const cutOff=hunters.find(h=>h.huntRole==='intercept');
 assert.ok(cutOff.huntGoal.x>runner.x,
   'interceptor goes AHEAD of the moving survivor, not behind');
 assert.equal(botA.input.action,false,'converted bot ghost never punches');
 assert.equal(botB.input.action,false,'other converted ghost never punches');
}
{
 // Larger packs split into groups rather than piling all ghosts on one prey.
 const x=init(5);x.round.phase='countdown';x.state.obstacles=[];
 const [runnerA,runnerB,...bots]=x.players;
 runnerA.x=340;runnerA.y=240;runnerB.x=860;runnerB.y=475;
 const npc=x.state.npcs[0];npc.x=180;npc.y=220;npc.stun=0;
 bots.forEach((p,i)=>{
  p.isBot=true;p.ghost=true;p.stun=0;p.botMind=null;
  p.x=270+i*70;p.y=300+i*20;
 });
 ghost.update(.016,x.round,x.players);
 const targets=[npc,...bots].map(p=>p.huntTargetId);
 assert.equal(new Set(targets).size,2,'four ghosts split to intercept two survivors');
}
// Bots use threat-aware movement, activate speed items and seek loot.
{
 const x=init(3);x.round.phase='playing';x.state.ghostSpawned=true;
 const p=x.players[0];p.isBot=true;p.botMind=null;
 x.players[1].x=800;x.players[1].y=430;
 x.players[2].x=700;x.players[2].y=400;
 p.x=300;p.y=250;
 const npc=x.state.npcs[0];
 npc.x=385;npc.y=250;npc.stun=0;x.state.obstacles=[];
 p.item='boost';
 ghost.update(.016,x.round,x.players);
 assert.ok(p.input.axisX<0,'bot runs away from ghost');
 assert.equal(p.input.alt,true,'bot activates speed boost to flee');
 assert.equal(p.item,null,'used item is consumed');
 npc.stun=999;x.state.boxes=[{x:p.x+100,y:p.y,ttl:8,item:'cloak'}];
 ghost.update(.016,x.round,x.players);
 assert.ok(p.input.axisX>.4,'bot seeks loot when the ghost is stunned');
}
// Corridor escape: the AI must navigate around a solid wall, without
// frame-by-frame left/right oscillation.
{
 const x=init(3);x.round.phase='playing';x.state.ghostSpawned=true;
 const [p,q,r]=x.players;p.isBot=true;p.botMind=null;
 p.x=320;p.y=265;q.x=850;q.y=80;r.x=820;r.y=450;
 x.state.obstacles=[{x:355,y:145,w:85,h:250,style:0}];
 x.state.npcs.forEach(g=>g.stun=999);
 x.state.boxes=[{x:520,y:265,ttl:30,item:'cloak'}];
 let flips=0,lastX=0;
 for(let i=0;i<130;i++){
   ghost.update(.05,x.round,x.players);
   const sign=Math.sign(p.input.axisX||0);
   if(lastX&&sign&&sign!==lastX)flips++;
   if(sign)lastX=sign;
 }
 assert.ok(p.x>450||p.item==='cloak','bot reaches exit around wall');
 assert.ok(flips<16,'bot keeps path instead of jittering');
}
 // Movement starts while the three-second warning counts down.
{
 const x=init(2),p=x.players[0],prev=p.x;
 p.input.axisX=1;
 ghost.update(.06,x.round,x.players);
 assert.ok(p.x>prev,'humans can move before the ghost spawns');
 assert.equal(x.round.phase,'countdown');
}
// Humans collide with props, but player-ghosts can move through them.
{
 const x=init(3);x.round.phase='playing';
 x.state.npcs.forEach(n=>n.stun=999);
 const obstacle=x.state.obstacles.find(o=>o.kind!=='hud-blocker'),p=x.players[0];
 p.x=obstacle.x-16;p.y=obstacle.y+obstacle.h/2;
 p.input.axisX=1;
 const before=p.x;
 ghost.update(.1,x.round,x.players);
 assert.equal(p.x,before,'human cannot step into a solid object');
 p.ghost=true;p.stun=0;
 ghost.update(.1,x.round,x.players);
 assert.ok(p.x>before,'converted player ghosts pass through obstacles');
}
// Player bodies resist each other; drag strength pushes a resting player.
{
 const x=init(3),[a,b,c]=x.players;
 x.state.obstacles=[];x.round.phase='countdown';
 a.x=390;a.y=220;b.x=417;b.y=220;c.x=790;c.y=450;
 a.input.axisX=1;b.input.axisX=-1;
 const mid=(a.x+b.x)/2;
 ghost.update(.04,x.round,x.players);
 assert.ok(Math.hypot(b.x-a.x,b.y-a.y)>=31.9,'opposing humans cannot overlap');
 assert.ok(Math.abs((a.x+b.x)/2-mid)<1,'equal force holds the midpoint');
 a.x=390;b.x=423;a.input.axisX=1;b.input.axisX=0;
 ghost.update(.04,x.round,x.players);
 assert.ok(b.x>423,'a moving joystick pushes a resting player');
}
// Shared punch has windup, a locked movement animation and tinted impact.
{
 const Combat=ghostSandbox.window.PartyCombatMotion;
 assert.equal(Combat.ATTACK.windup,.18);
 assert.ok(Math.abs(Combat.TOTAL-.48)<1e-9);
 const x=init(3);x.round.phase='playing';
 x.state.npcs.forEach(n=>n.stun=999);
 x.state.obstacles=[]; // Attack test is for timing, not random map geometry.
 const [attacker,victim,far]=x.players;
 attacker.x=120;attacker.y=120;attacker.input.action=true;attacker.input.axisX=1;
 victim.x=157;victim.y=120;far.x=800;far.y=400;
 ghost.update(.016,x.round,x.players);
 assert.equal(victim.stun,0,'no instant punch');
 assert.equal(attacker.x,120,'start of strike freezes movement');
 assert.ok(attacker.punchCooldown>.9);
 ghost.update(.16,x.round,x.players);
 assert.equal(victim.stun,0,'windup is not done');
 assert.equal(attacker.x,120);
 ghost.update(.025,x.round,x.players);
 assert.ok(victim.stun>.35&&victim.stun<1,'punch impact after windup');
 assert.equal(victim.stunColor,attacker.color,'stun uses attacker color');
 assert.equal(attacker.x,120);
 ghost.update(.27,x.round,x.players);
 assert.equal(attacker.x,120,'recovery animation roots attacker');
 attacker.input.action=false;
 ghost.update(.03,x.round,x.players);
 ghost.update(.03,x.round,x.players);
 assert.ok(attacker.x>120,'movement resumes after attack finishes');
}
// Punch rights: only living humans can initiate and receive a punch.
// The facing cone ignores ghosts and players behind the attacker.
{
 const x=init(4);x.round.phase='playing';x.state.obstacles=[];
 x.state.npcs.forEach(n=>n.stun=999);
 const [attacker,friend,spirit,behind]=x.players;
 attacker.x=140;attacker.y=160;attacker.dir={x:1,y:0};
 friend.x=185;friend.y=160;
 spirit.x=172;spirit.y=122;spirit.ghost=true;
 behind.x=94;behind.y=160;
 attacker.input.action=true;
 ghost.update(.02,x.round,x.players);
 ghost.update(.19,x.round,x.players);
 assert.ok(friend.stun>0,'human punches another human in front');
 assert.equal(spirit.stun,0,'human punch does not stun a ghost');
 assert.equal(behind.stun,0,'punch does not hit behind attacker');
 attacker.ghost=true;attacker.stun=0;attacker.attackRemaining=0;
 attacker.punchCooldown=0;attacker.input.action=false;
 ghost.update(.02,x.round,x.players);
 attacker.input.action=true;
 ghost.update(.02,x.round,x.players);
 assert.equal(attacker.attackRemaining,0,'player ghost cannot punch');
 const bot=spirit;bot.isBot=true;bot.botMind=null;
 bot.input.action=false;
 ghost.update(.02,x.round,x.players);
 assert.equal(bot.input.action,false,'AI ghost never punches');
}
 // The render test observes exactly what spectators see over the collector.
const drawTexts=[],drawImages=[];
const drawProbe=new Proxy({},{
  get(_obj,key){
    if(key==='createLinearGradient')return ()=>({addColorStop(){}});
    if(key==='measureText')return v=>({width:String(v).length*8});
    if(key==='drawImage')return (...args)=>drawImages.push(args);
    if(key==='fillText')return (...args)=>drawTexts.push(args);
    return ()=>{};
  },
  set(){return true;}
});
// Renderer integration: BOTH the initial AI ghost and a converted
// participant must use Pharaoh sprites on Egyptian rounds, without changing
// player-specific color or leaking Pharaoh art into cemetery rounds.
{
 for(const theme of ['egypt','graveyard']){
  const x=init(3),player=x.players[0];
  x.state.theme=theme;x.state.ghostSpawned=true;
  player.ghost=true;player.stun=0;
  art.preload(x.players,theme);
  const pose='float0';
  const ai=art.getActorImage(true,'#f5faff',pose,theme);
  const converted=art.getActorImage(true,player.color,pose,theme);
  drawImages.length=0;
  ghost.draw(drawProbe,0,x.round,x.players);
  assert.ok(drawImages.some(args=>args[0]===ai),
    'AI ghost uses the '+theme+' themed sprite in the actual canvas draw');
  assert.ok(drawImages.some(args=>args[0]===converted),
    'converted player uses the '+theme+' themed sprite in the actual canvas draw');
  const wrong=theme==='egypt'?'graveyard':'egypt';
  assert.ok(!drawImages.some(args=>args[0]===
    art.getActorImage(true,'#f5faff',pose,wrong)),
    'ghost sprite from another map theme must not be drawn');
 }
}
// Thai text placement regression: Canvas implementations that ignore
// textAlign='center' must not push "12 คน" or the footer beyond the compact HUD.
{
 const styles={font:'16px system-ui',textAlign:'start'};
 const captures=[];
 let clipped=false;
 const hudProbe=new Proxy({},{
  get(_target,key){
   if(key==='createLinearGradient')return ()=>({addColorStop(){}});
   if(key==='measureText')return text=>{
    const size=Number((styles.font.match(/([\\d.]+)px/)||[])[1]||16);
    return {width:Array.from(String(text)).length*size*.63};
   };
   if(key==='fillText')return (text,x,y,maxWidth)=>
    captures.push({text,x,y,maxWidth,font:styles.font,align:styles.textAlign});
   if(key==='clip')return ()=>{clipped=true;};
   return ()=>{};
  },
  set(_target,key,value){styles[key]=value;return true;}
 });
 for(const n of [1,9,12]){
  const x=init(n),o=x.state.hudBlocker;
  for(const phase of ['countdown','playing']){
   captures.length=0;
   x.round.phase=phase;x.round.countdown=3;
   ghost.draw(hudProbe,0,x.round,x.players);
   const main=phase==='countdown'?'3 วิ':n+' คน';
   const lines=[phase==='countdown'?'เริ่มใน':'ผู้เล่น',
     main,phase==='countdown'?n+' คน':'กำลังแข่ง'];
   for(const line of lines){
    const entry=captures.find(e=>e.text===line);
    assert.ok(entry,'HUD must draw '+line);
    assert.equal(entry.align,'left','never rely on center-alignment on Thai Canvas');
    const size=Number((entry.font.match(/([\\d.]+)px/)||[])[1]||16);
    const rendered=Math.min(Array.from(line).length*size*.63,entry.maxWidth);
    assert.ok(entry.x>=o.x+4*o.w/88-1,
      'HUD label left edge fits inside '+n+'-person panel');
    assert.ok(entry.x+rendered<=o.x+o.w-4*o.w/88+1,
      'HUD label right edge fits inside '+n+'-person panel');
    assert.ok(entry.y>=o.y+9*o.h/58&&entry.y<=o.y+48*o.h/58,
      'HUD text stays between inner top/bottom borders');
   }
  }
 }
 assert.equal(clipped,true,'HUD prevents glyph overflow outside the frame');
}
// Five items, one carried at a time. B first arms slow targeting, second uses it.
for(const item of ['cloak','boost','stun','trap','slow']){
 const x=init(3);x.round.phase='playing';
 const [p,q,r]=x.players;
 x.state.npcs.forEach(n=>{n.stun=999;n.x=p.x+70;n.y=p.y;});
 q.x=x.state.world.w-90;q.y=90;r.x=90;r.y=x.state.world.h-90;
 x.state.boxes.push({x:p.x,y:p.y,ttl:20,item});
 ghost.update(.016,x.round,x.players);
 assert.equal(p.item,item,'pickup '+item);
 assert.equal(p.pickupNotice,ghost.ITEM_NAMES[item],'popup shows the actual item name');
 assert.equal(p.pickupNoticeItem,item);
 assert.ok(p.pickupNoticeTime>2,'popup starts immediately after a real pickup');
 drawTexts.length=0;drawImages.length=0;
 const originalX=p.x,originalY=p.y;
 p.x=400;p.y=240;
 ghost.draw(drawProbe,0,x.round,x.players);
 const itemText=drawTexts.find(args=>args[0]==='ได้รับ: '+ghost.ITEM_NAMES[item]);
 const nameText=drawTexts.find(args=>args[0]===p.name);
 assert.ok(itemText,'collector sees obtained item above the character: '+item);
 const iconDraw=drawImages.find(args=>args[0]===ghost.getItemIconImage(item));
 assert.ok(iconDraw,'loot icon rendered even with extra actor and prop SVGs');
 assert.ok(iconDraw[1]<itemText[1]);
 assert.ok(nameText&&itemText[2]<nameText[2],
   'item notification is vertically above the collector name');
 p.x=originalX;p.y=originalY; // Do not move the item-stun test out of range.
 // A second box is not collectible while already carrying something.
 x.state.boxes.push({x:p.x,y:p.y,ttl:20,item:'cloak'});
 ghost.update(.016,x.round,x.players);
 assert.equal(p.item,item);
 // Clear the optional second crate before consuming: after using an item,
 // collecting another available crate immediately is permitted.
 x.state.boxes=[];
 if(item==='stun')x.state.npcs[0].stun=0;
 p.input.alt=true;
 ghost.update(.016,x.round,x.players);
 if(item==='slow'){
  assert.equal(p.selecting,true);
  assert.equal(p.item,'slow');
  assert.equal(p.targetId,q.id);
  assert.equal(ghost.cycleTarget(x.state,x.players,p,1),true);
  assert.equal(p.targetId,r.id);
  const state=ghost.itemStatus(x.players).find(z=>z.id===p.id);
  assert.equal(state.targetName,r.name);
  p.input.alt=false;ghost.update(.016,x.round,x.players);
  p.input.alt=true;ghost.update(.016,x.round,x.players);
  assert.ok(r.slow>2,'the selected target receives slow');
  assert.equal(p.item,null);
  assert.equal(p.selecting,false);
 }else{
  assert.equal(p.item,null,'B consumes '+item);
  if(item==='cloak')assert.ok(p.cloak>1.8);
  if(item==='boost')assert.ok(p.boost>2.3);
  if(item==='stun')assert.ok(x.state.npcs[0].stun>1.3,
    'ghost is temporarily stunned by the item');
  if(item==='trap'){
   assert.equal(x.state.traps.length,1);
   assert.equal(p.stun,0,'trap does not instantly bite its owner');
   q.x=p.x;q.y=p.y;q.stun=0;
   ghost.update(.5,x.round,x.players);
   assert.ok(q.stun>0,'human stepping on armed trap is rooted');
  }
 }
}
// Cloak must protect from every infection source for its full duration.
{
 const x=init(3);x.round.phase='playing';x.state.ghostSpawned=true;
 const [human,spirit,other]=x.players;
 x.state.obstacles=[];x.state.npcs.forEach(g=>g.stun=999);
 human.x=310;human.y=260;human.cloak=1;
 spirit.x=human.x+3;spirit.y=human.y;spirit.ghost=true;spirit.stun=0;
 other.x=850;other.y=430;
 ghost.update(.016,x.round,x.players);
 assert.equal(human.ghost,false,'cloak prevents infected player touch');
 spirit.stun=999;
 const npc=x.state.npcs[0];npc.stun=0;npc.x=human.x+1;npc.y=human.y;
 ghost.update(.016,x.round,x.players);
 assert.equal(human.ghost,false,'cloak prevents NPC infection');
 human.cloak=0;npc.stun=999;spirit.stun=0;
 spirit.x=human.x+2;spirit.y=human.y; // Contact must be re-established after body push.
 ghost.update(.016,x.round,x.players);
 assert.equal(human.ghost,true,'infection resumes when cloak expires');
}
// Traps affect humans only. A ghost cannot trigger or consume the trap.
{
 const x=init(4);x.round.phase='playing';
 const [owner,human,spirit,far]=x.players;
 x.state.npcs.forEach(g=>g.stun=999);
 spirit.ghost=true;
 owner.x=260;owner.y=250;owner.cloak=5;
 human.x=600;human.y=430;far.x=850;far.y=80;
 spirit.x=owner.x;spirit.y=owner.y;
 owner.item='trap';owner.input.alt=true;
 ghost.update(.016,x.round,x.players);
 assert.equal(x.state.traps.length,1);
 ghost.update(.5,x.round,x.players);
 assert.equal(spirit.stun,0,'trap ignores ghost');
 assert.equal(x.state.traps.length,1,'ghost does not consume trap');
 spirit.stun=999;human.x=owner.x;human.y=owner.y;human.stun=0;
 ghost.update(.016,x.round,x.players);
 assert.ok(human.stun>0,'trap hits human');
 assert.equal(human.stunColor,owner.color,'trap sparkle has owner color');
}
// Slow can select only other human players, never converted ghosts.
{
 const x=init(3);x.round.phase='playing';
 const [owner,friend,spirit]=x.players;
 x.state.npcs.forEach(g=>g.stun=999);
 spirit.ghost=true;owner.item='slow';owner.input.alt=true;
 ghost.update(.016,x.round,x.players);
 assert.equal(owner.targetId,friend.id);
 assert.equal(ghost.cycleTarget(x.state,x.players,owner,1),true);
 assert.equal(owner.targetId,friend.id,'ghost is excluded from target rotation');
 owner.input.alt=false;ghost.update(.016,x.round,x.players);
 owner.input.alt=true;ghost.update(.016,x.round,x.players);
 assert.ok(friend.slow>0);
 assert.equal(spirit.slow,0);
}
// A pickup notice fades automatically; using an item does not replay pickup.
{
 const x=init(3);x.round.phase='playing';
 const p=x.players[0];x.state.npcs.forEach(n=>n.stun=999);
 x.state.boxes=[{x:p.x,y:p.y,ttl:8,item:'boost'}];
 ghost.update(.01,x.round,x.players);
 assert.equal(p.pickupNotice,'บูสต์สปีด');
 x.state.boxes=[];x.round.phase='countdown';
 ghost.update(2.5,x.round,x.players);
 assert.equal(p.pickupNoticeTime,0);
 drawTexts.length=0;
 ghost.draw(drawProbe,0,x.round,x.players);
 assert.ok(!drawTexts.some(args=>String(args[0]).startsWith('ได้รับ:')),
   'expired pickup announcement is no longer painted');
 const nextRound={mode:'ghost',phase:'countdown'};
 ghost.setup(nextRound,x.players);
 assert.equal(p.pickupNotice,null,'no stale item popup in a fresh round');
 assert.equal(p.pickupNoticeItem,null);
 assert.equal(p.pickupNoticeTime,0);
}
// AI target lock only changes for very close alternatives; conversion retains
// player control as a colored ghost, with a clear last-survivor winner.
{
 const x=init(3),[a,b,c]=x.players;x.round.phase='playing';
 x.state.npcs.forEach(n=>n.stun=0);
 const npc=x.state.npcs[0];
 a.x=npc.x+120;a.y=npc.y;
 // Keep B far enough that the AI's intentionally rare nearby-target
 // variation cannot select it before the switching test.
 b.x=npc.x+200;b.y=npc.y;
 c.x=npc.x+280;c.y=npc.y;
 ghost.update(.016,x.round,x.players);
 assert.equal(npc.targetId,a.id);
 b.x=npc.x+50;b.y=npc.y;
 ghost.update(.016,x.round,x.players);
 assert.equal(npc.targetId,b.id,'switch when alternative becomes much closer');
}
{
 const x=init(3),[a,b,c]=x.players;x.round.phase='playing';
 const npc=x.state.npcs[0];
 npc.stun=0;
 b.x=90;b.y=90;c.x=x.state.world.w-80;c.y=x.state.world.h-80;
 a.x=npc.x;a.y=npc.y;
 a.item='cloak';a.pickupNotice='ผ้าคลุมล่องหน';a.pickupNoticeTime=2.1;
 ghost.update(.016,x.round,x.players);
 assert.equal(a.ghost,true,'AI ghost touch infects a human');
 assert.equal(a.item,null,'infected player no longer holds an item');
 assert.equal(a.pickupNotice,null,'infection clears an outdated pickup notification');
 assert.equal(a.pickupNoticeItem,null);
 assert.equal(a.active,true,'infected human remains controllable');
 npc.stun=999;
 a.x=c.x-4;a.y=c.y;
 ghost.update(.2,x.round,x.players); // Freshly converted ghosts are briefly stunned.
 assert.equal(c.ghost,true,'player-ghost infects when initial stun wears off');
 assert.equal(x.state.winnerId,b.id,'the last human wins');
}

const persistedNicknames=new Map();
function setup(url='https://game.example/?host=1',portrait=false) {
  const elements=new Map();
  const makeElement=(id='')=>{
    const handlers={},classes=new Set();
    return {
      id,style:{setProperty(name,value){this[name]=value;},removeProperty(name){delete this[name];}},dataset:{},children:[],value:'',textContent:'',disabled:false,
      classList:{
        add(c){classes.add(c);},remove(c){classes.delete(c);},
        toggle(c,flag){if(flag===undefined? !classes.has(c):flag)classes.add(c);else classes.delete(c);},
        contains(c){return classes.has(c);}
      },
      addEventListener(name,fn){(handlers[name]??=[]).push(fn);},
      fire(name,extra={}){for(const fn of handlers[name]||[])fn({preventDefault(){},pointerId:1,...extra});},
      append(...items){this.children.push(...items);},
      replaceChildren(...items){this.children=items;},
      prepend(item){this.children.unshift(item);},
      setAttribute(name,value){this.attributes??={};this.attributes[name]=value;if(name==='content')this.content=value;},
      select(){},scrollIntoView(){},setPointerCapture(){},matches(){return false;},
      querySelector(selector){
         const key=id+'|'+selector;
         if(!elements.has(key))elements.set(key,makeElement(key));
         return elements.get(key);
       },
       getContext(){return context;},
      captureStream(...args){
        assert.equal(args.length,0,'quality must not set captureStream frameRate');
        return {
        width:this.width,height:this.height,
        getTracks(){return [{stop(){this.stopped=true;}}];}
      };},
      play(){this.played=true;return Promise.resolve();},
      pause(){this.paused=true;},
      toDataURL(mime){assert.equal(mime,'image/jpeg');return 'data:image/jpeg;base64,QUJDRA==';},
      getBoundingClientRect(){return {left:0,top:0,width:200,height:200};},parentElement:null
    };
  };
  const context=new Proxy({},{
    get(_,key){
      if(key==='createLinearGradient')return ()=>({addColorStop(){}});
      // Used by the bounded Thai HUD label renderer.
      if(key==='measureText')return text=>({width:String(text).length*8});
      return ()=>{};
    },
    set(){return true;}
  });
  for(const [,id] of html.matchAll(/\bid="([^"]+)"/g))elements.set(id,makeElement(id));
  elements.get('autoNext').checked=true;
  const sessionButtons=['queue','quick'].map(mode=>{
    const btn=makeElement('session-'+mode);btn.dataset.sessionMode=mode;return btn;
  });
  const pickButtons=[...html.matchAll(/data-pick="([^"]+)"/g)].map(([,game])=>{
    const button=makeElement('pick-'+game);button.dataset.pick=game;return button;
  });
  const padButtons=Object.fromEntries(['action','alt'].map(key=>{
    const button=makeElement('pad-'+key);button.dataset.control=key;return [key,button];
  }));
  const docHandlers={};
  const document={
    head:makeElement('head'),body:makeElement('body'),
    fire(name,props={}){
      const e={cancelable:true,defaultPrevented:false,
        preventDefault(){this.defaultPrevented=true;},...props};
      for(const fn of docHandlers[name]||[])fn(e);
      return e;
    },
    getElementById(id){assert(elements.has(id),'Missing ID: '+id);return elements.get(id);},
    createElement(tag){return makeElement(tag);},
    querySelectorAll(selector){
      if(selector==='[data-pick]')return pickButtons;
      if(selector==='[data-session-mode]')return sessionButtons;
      if(selector==='#controllerActive [data-control]')return Object.values(padButtons);
      return [];
    },
    addEventListener(name,fn){(docHandlers[name]??=[]).push(fn);},execCommand(){return true;}
  };
  // Browser Fullscreen belongs to the persistent document root on the host.
  // A controller can independently fullscreen its persistent #controller view.
  document.documentElement=makeElement('html');
  document.fullscreenElement=null;
  document.fullscreenRequests=0;
  document.fullscreenExits=0;
  document.documentElement.requestFullscreen=()=>{
    document.fullscreenRequests++;
    document.fullscreenElement=document.documentElement;
    return Promise.resolve();
  };
  document.exitFullscreen=()=>{
    document.fullscreenExits++;
    document.fullscreenElement=null;
    return Promise.resolve();
  };
  elements.get('controller').requestFullscreen=()=>{
    document.fullscreenRequests++;
    document.fullscreenElement=elements.get('controller');
    return Promise.resolve();
  };
  const instances=[];
  class FakeMediaCall{
    constructor(peer,stream,options={}){
      this.peer=peer;this.stream=stream;
      this.metadata=options.metadata||{};
      this.handlers={};this.open=false;this.closed=false;
    }
    on(name,fn){this.handlers[name]=fn;}
    answer(){this.open=true;this.answered=true;}
    fire(name,value){this.handlers[name]?.(value);}
    close(){
      if(this.closed)return;
      this.closed=true;this.open=false;this.handlers.close?.();
    }
  }
  class FakeConn{
    constructor(){this.handlers={};this.open=true;this.sent=[];this.peer='phone-'+instances.length;}
    on(name,fn){this.handlers[name]=fn;}
    send(value){this.sent.push(value);}
    close(){this.open=false;this.handlers.close?.();}
    fire(name,value){this.handlers[name]?.(value);}
  }
  class FakePeer{
    constructor(id){this.id=id;this.handlers={};instances.push(this);}
    on(name,fn){this.handlers[name]=fn;}
    connect(){this.conn=new FakeConn();return this.conn;}
    call(peer,stream,options){
      const call=new FakeMediaCall(peer,stream,options);
      (this.mediaCalls??=[]).push(call);return call;
    }
    destroy(){}
    fire(name,value){this.handlers[name]?.(value);}
  }
  let raf=null;
  const windowHandlers={};
  const sessionData=new Map();
  const win={
    location:new URL(url),crypto:webcrypto,portrait,
    screen:{width:360,height:800},devicePixelRatio:2,
    innerWidth:800,innerHeight:360,
    localStorage:{
      getItem(key){return persistedNicknames.get(key)||null;},
      setItem(key,value){persistedNicknames.set(key,String(value));}
    },
    matchMedia(){return {matches:this.portrait};},
    addEventListener(name,fn){(windowHandlers[name]??=[]).push(fn);},
    fire(name){for(const fn of windowHandlers[name]||[])fn();},
    scrollTo(){}
  };
  win.location.assign=function(url){this.href=url;};
  // History API mutates the current browser Location, preserving its methods.
  win.history={replaceState(_state,_title,next){win.location.href=next;}};
  const sessionStorage={
    getItem(key){return sessionData.get(key)||null;},
    setItem(key,value){sessionData.set(key,String(value));}
  };
  const globals={window:win,location:win.location,document,crypto:webcrypto,sessionStorage,
    navigator:{},Peer:FakePeer,URL,URLSearchParams,
    setInterval(){return 1;},setTimeout(){return 1;},
    requestAnimationFrame(fn){raf=fn;},alert(){},confirm(){return true;}};
  const scope=vm.createContext(globals);
  vm.runInContext(combatSource,scope,{filename:'combat-motion.js'});
  vm.runInContext(artSource,scope,{filename:'graveyard-art.js'});
  vm.runInContext(ghostSource,scope,{filename:'ghost-attack.js'});
  vm.runInContext(appForTest,scope,{filename:'app.js'});
  return {elements,pickButtons,sessionButtons,padButtons,instances,scope,
    mediaCall(peer){return new FakeMediaCall(peer);},
    step(ms){assert(raf);raf(ms);},
    click(id){elements.get(id).fire('click');},
    pick(mode){const button=pickButtons.find(x=>x.dataset.pick===mode);assert(button);button.fire('click');}
  };
}



// Browser/controller integration: keep QR, multiplayer, native fullscreen and
// WebRTC video transport while replacing only the minigame implementation.
const bare=setup('https://game.example/');
assert.equal(bare.elements.get('controller').classList.contains('hidden'),false);
const host=setup();
host.click('addLocalBtn');
host.click('offlineBtn');
assert.equal(host.elements.get('hostLobby').classList.contains('hidden'),false);
assert.equal(host.elements.get('roster').children.length,12,'all slots exist with one player');
assert.equal(host.elements.get('roster').style['--roster-cols'],'3');
assert.equal(host.elements.get('roster').style['--roster-rows'],'4');
assert.equal(host.elements.get('roster').children[1].className,'roster-item roster-empty');
assert.equal(host.elements.get('roster').children[11].children[1].textContent,'ช่อง 12');
// Zero and partial occupancy must retain the identical twelve-slot grid.
const freshLobby=setup();
assert.equal(freshLobby.elements.get('roster').children.length,12,'new lobby reserves twelve slots');
assert.equal(freshLobby.elements.get('roster').children[0].className,'roster-item roster-empty');
assert.equal(freshLobby.elements.get('roster').style['--roster-rows'],'4');
const portraitLobby=setup('https://game.example/?host=1',true);
assert.equal(portraitLobby.elements.get('roster').children.length,12);
assert.equal(portraitLobby.elements.get('roster').style['--roster-cols'],'2');
assert.equal(portraitLobby.elements.get('roster').style['--roster-rows'],'6');
assert.match(css,/#hostLobby \.lobby-roster \.roster-pick\.picked\{[\s\S]*?flex-direction:column;/);
assert.match(css,/#hostLobby \.lobby-roster \.roster-pick\.picked \.mode-choice-title\{[\s\S]*?text-align:center;/);
assert.equal(host.elements.get('roster').children[0].children[1].textContent,'บอท 1');
assert.equal(host.elements.get('roster').children[0].children[3].children[1].textContent,'GHOST ATTACK');
assert.match(host.elements.get('roster').children[0].children[3].children[0].innerHTML,/<svg[\s>]/);
host.click('startBtn');
assert.equal(host.elements.get('game').classList.contains('hidden'),false);
assert.equal(host.scope.document.fullscreenElement,host.scope.document.documentElement);
let rr=host.scope.window.__ghostTest.getRound();
assert.equal(rr.phase,'countdown');assert.equal(rr.ghost.npcs.length,1);
for(let i=0;i<245;i++)host.step(i*16.667);
assert.equal(rr.ghost.ghostSpawned,true);
assert.equal(rr.phase,'results','one-player practice has a winner after ghost spawn');
assert.equal(rr.remaining,null,'there is no per-round time limit');
assert.equal(host.elements.get('leaderboard').children.length,1);
assert.equal(host.elements.get('leaderboard').style['--leader-count'],'1');
const matchPlayers=host.scope.window.__ghostTest.getPlayers();
// This UI assertion tests a human carrying an item, independent of the
// single-player AI round outcome (which may have converted the player).
matchPlayers[0].ghost=false;matchPlayers[0].stun=0;
matchPlayers[0].item='cloak';
host.scope.window.__ghostTest.renderLeaderboard();
let firstChip=host.elements.get('leaderboard').children[0];
assert.equal(firstChip.children[1].textContent,matchPlayers[0].name);
assert.equal(firstChip.children[2].textContent,'คน');
assert.equal(firstChip.children[3].className,'leader-item-slot');
assert.equal(firstChip.children[3].textContent,'');
assert.match(firstChip.children[3].innerHTML,/<svg[\s>]/);
assert.equal(firstChip.children[3].title,'ผ้าคลุมล่องหน');
assert.equal(firstChip.children[3].attributes['aria-label'],'ผ้าคลุมล่องหน');
matchPlayers[0].item=null;
host.scope.window.__ghostTest.renderLeaderboard();
firstChip=host.elements.get('leaderboard').children[0];
assert.equal(firstChip.children.length,4,'empty item keeps a stable visual row');
assert.equal(firstChip.children[3].textContent,'—');

const addedPlayers=mkPlayers(11).map((p,i)=>({...p,id:'extra-'+i,ghost:i%2===0}));
matchPlayers.push(...addedPlayers);
addedPlayers[1].item='boost';
host.scope.window.__ghostTest.renderLeaderboard();
assert.equal(host.elements.get('leaderboard').children.length,12);
const busyItemChip=host.elements.get('leaderboard').children.find(chip=>
 chip.children[1].textContent===addedPlayers[1].name);
assert.ok(busyItemChip,'held-item player remains visible after survivor/ghost sorting');
assert.equal(busyItemChip.children[2].textContent,'คน');
assert.equal(busyItemChip.children[3].textContent,'');
assert.match(busyItemChip.children[3].innerHTML,/<svg[\s>]/);
assert.equal(busyItemChip.children[3].title,'บูสต์สปีด');
assert.equal(host.elements.get('leaderboard').style['--leader-count'],'12',
  'twelve players use one fixed row instead of extending into the arena');
matchPlayers.splice(-11);host.scope.window.__ghostTest.renderLeaderboard();
assert.equal(host.elements.get('results').classList.contains('hidden'),false,
 'one player wins after the initial ghost spawn');
host.click('backBtn');
assert.equal(host.elements.get('hostLobby').classList.contains('hidden'),false);
assert.equal(host.scope.document.fullscreenElement,host.scope.document.documentElement);

const online=setup();
online.click('hostBtn');online.instances[0].fire('open');
const conn=online.instances[0].connect();
online.instances[0].fire('connection',conn);
conn.fire('data',{t:'join',name:'Wut'});
assert.equal(online.elements.get('startBtn').disabled,true);
conn.fire('data',{t:'pick',mode:'ghost'});
assert.equal(online.elements.get('startBtn').disabled,false);
conn.fire('data',{t:'pick',mode:'stars'});
assert.equal(online.elements.get('roster').children[0].children[3].children[1].textContent,'GHOST ATTACK');
online.click('startBtn');
assert.equal(online.instances[0].mediaCalls.length,1,'WebRTC game stream still starts');
assert.equal(online.instances[0].mediaCalls[0].stream.height,540);
const pair=online.instances[0].mediaCalls[0];
assert.ok(pair.stream.width===960);
assert.equal(pair.stream.fps,undefined);
assert.equal(online.scope.window.__ghostTest.getRound().ghost.npcs.length,1);
assert.equal(conn.sent.some(x=>x.t==='inventory'),true);
// A slow medicine target selection is always host authoritative.
const oround=online.scope.window.__ghostTest.getRound();
const owut=online.scope.window.__ghostTest.getPlayers()[0];
owut.item='slow';owut.selecting=true;owut.targetId='not-a-player';
conn.fire('data',{t:'target-cycle',direction:1});
assert.equal(owut.targetId,'not-a-player',
 'target controls are disabled during the pre-ghost countdown');
oround.phase='playing';
conn.fire('data',{t:'target-cycle',direction:1});
// With only one participant there is no valid target; no fabricated target ID.
assert.equal(owut.targetId,null);
online.click('pauseBtn');
assert.equal(online.elements.get('pauseMenu').classList.contains('hidden'),false);
online.click('exitBtn');
assert.equal(online.elements.get('hostLobby').classList.contains('hidden'),false);
assert.equal(online.scope.document.fullscreenExits,0);

// Twelve is the HARD CAP. The large empty lobby panel is filled by its cards,
// without adding extra players and without changing Ghost Attack's ghost tiers.
const bigRoom=setup();
bigRoom.click('offlineBtn');
for(let i=0;i<10;i++)bigRoom.click('addLocalBtn');
assert.equal(bigRoom.scope.window.__ghostTest.getPlayers().length,12);
assert.equal(bigRoom.elements.get('rosterCount').textContent,'12/12');
assert.equal(bigRoom.elements.get('addLocalBtn').disabled,true);
bigRoom.click('addLocalBtn');
assert.equal(bigRoom.scope.window.__ghostTest.getPlayers().length,12,'cannot add player thirteen');
assert.equal(new Set(bigRoom.scope.window.__ghostTest.getPlayers().map(p=>p.color)).size,12);
assert.equal(bigRoom.scope.window.__ghostTest.getPlayers().every(p=>p.isBot),true);
assert.equal(bigRoom.elements.get('roster').style['--roster-rows'],'4');
assert.equal(bigRoom.elements.get('roster').children.length,12);
assert.equal(bigRoom.elements.get('roster').children.filter(x=>x.className.includes('roster-empty')).length,0);
bigRoom.sessionButtons[1].fire('click');
assert.equal(bigRoom.sessionButtons[1].classList.contains('active'),true);
bigRoom.sessionButtons[0].fire('click');
bigRoom.click('startBtn');
assert.equal(bigRoom.scope.window.__ghostTest.getRound().ghost.npcs.length,1);
assert.equal(bigRoom.elements.get('leaderboard').style['--leader-rows'],'1');
assert.equal(bigRoom.elements.get('leaderboard').style['--leader-cols'],'12');
assert.match(css,/#hostLobby \.lobby-roster\{[\s\S]*?grid-template-rows:repeat\(var\(--roster-rows,4\),minmax\(0,1fr\)\)/);
assert.match(css,/#hostLobby \.lobby-roster \.roster-item\{[\s\S]*?grid-template-rows:auto minmax\(0,1fr\)/);
assert.match(css,/#hostLobby \.lobby-roster \.roster-pick\.picked\{[\s\S]*?height:100%/);

// Closing an online room displays an in-app dialog; cancellation keeps peers.
const confirmHost=setup();
confirmHost.click('hostBtn');
confirmHost.instances[0].fire('open');
confirmHost.click('closeRoomBtn');
assert.equal(confirmHost.elements.get('uiModal').classList.contains('hidden'),false);
assert.equal(confirmHost.elements.get('hostLobby').classList.contains('hidden'),false);
confirmHost.click('uiCancelBtn');
assert.equal(confirmHost.elements.get('uiModal').classList.contains('hidden'),true);
assert.equal(confirmHost.elements.get('hostLobby').classList.contains('hidden'),false);

const phone=setup('https://game.example/?join=ABCDE3');
phone.elements.get('nick').value='Wut';phone.click('joinBtn');
phone.instances[0].fire('open');
const phoneConn=phone.instances[0].conn;
phoneConn.fire('open');
phoneConn.fire('data',{t:'welcome',id:'p1',name:'Wut',color:'#ff628c',
 mode:'ghost',phase:'lobby'});
assert.equal(phone.elements.get('controller').classList.contains('hidden'),false);
assert.equal(phone.elements.get('phoneGamePicker').classList.contains('hidden'),false);
assert.equal(phone.elements.get('controllerInventory').classList.contains('hidden'),true,
  'joining room must not reveal role or items before gameplay');
assert.equal(phone.elements.get('buttonALabel').textContent,'');
assert.equal(phone.elements.get('buttonBLabel').textContent,'');
assert.equal(phone.elements.get('controllerModeName').textContent,'');
phoneConn.fire('data',{t:'inventory',id:'p1',mode:'ghost',phase:'playing',item:'slow',
 ghost:false,selecting:true,targetId:'p2',targetName:'Friend'});
assert.equal(phone.elements.get('controllerInventory').classList.contains('hidden'),true,
  'premature inventory messages must not render in lobby');
assert.equal(phone.elements.get('targetCycleControls').classList.contains('hidden'),true);
assert.equal(phone.pickButtons.length,1);
assert.match(phone.pickButtons[0].children[0].innerHTML,/<svg[\s>]/);
assert.equal(phone.pickButtons[0].children[1].textContent,'GHOST ATTACK');
phone.pick('ghost');
assert.equal(phoneConn.sent.at(-1).mode,'ghost');
phoneConn.fire('data',{t:'roster',phase:'playing',mode:'ghost',
 players:[{id:'p1',active:true,choice:'ghost'}]});
assert.equal(phone.elements.get('phoneGamePicker').classList.contains('hidden'),true);
assert.equal(phone.elements.get('controllerInventory').classList.contains('hidden'),false,
  'active Ghost Attack displays HUD in top rail');
assert.equal(phone.elements.get('buttonALabel').textContent,'ตีสตั้น');
assert.equal(phone.elements.get('buttonBLabel').textContent,'ใช้ไอเทม');
phoneConn.fire('data',{t:'inventory',id:'p1',mode:'rally',phase:'playing',
 item:'cloak',ghost:false,selecting:false});
assert.equal(phone.elements.get('inventoryItem').textContent,'',
  'inventory for the wrong minigame is ignored');
phoneConn.fire('data',{t:'inventory',id:'p1',mode:'ghost',phase:'playing',
 item:'slow',ghost:false,selecting:true,targetId:'p2',targetName:'Friend'});
assert.equal(phone.elements.get('inventoryItem').textContent,'ไอเทม: ยาสโลว์เพื่อน');
assert.equal(phone.elements.get('targetCycleControls').classList.contains('hidden'),false);
assert.equal(phone.elements.get('targetName').textContent,'Friend');
phone.click('targetPrevBtn');
assert.equal(phoneConn.sent.at(-1).direction,-1);
phone.click('targetNextBtn');
assert.equal(phoneConn.sent.at(-1).direction,1);
phoneConn.fire('data',{t:'inventory',id:'p1',mode:'ghost',phase:'playing',
 ghost:true,selecting:false,item:null});
assert.equal(phone.elements.get('targetCycleControls').classList.contains('hidden'),true);
assert.equal(phone.elements.get('controllerRole').textContent,'ผี');
phoneConn.fire('data',{t:'roster',phase:'results',mode:'ghost',
 players:[{id:'p1',active:true,choice:'ghost'}]});
assert.equal(phone.elements.get('controllerInventory').classList.contains('hidden'),true,
 'role and item must disappear as soon as a round ends');
assert.equal(phone.elements.get('inventoryItem').textContent,'');
assert.equal(phone.elements.get('buttonALabel').textContent,'');
assert.equal(phone.elements.get('buttonBLabel').textContent,'');
phoneConn.fire('data',{t:'inventory',id:'p1',mode:'ghost',phase:'playing',item:'slow',
 ghost:false,selecting:true,targetId:'p2',targetName:'Friend'});
assert.equal(phone.elements.get('controllerInventory').classList.contains('hidden'),true,
 'late packet from a finished game cannot bring the HUD back');
phoneConn.fire('data',{t:'roster',phase:'playing',mode:'new_future_game',
 players:[{id:'p1',active:true,choice:null}]});
assert.equal(phone.elements.get('controllerInventory').classList.contains('hidden'),true,
 'future minigames will never inherit Ghost Attack status');
phone.click('leaveBtn');phone.click('confirmLeaveBtn');
assert.equal(phone.elements.get('controller').classList.contains('hidden'),false);
assert.equal(phone.scope.window.location.search,'?controller=1');
console.log('SMOKE PASS: 12-player cap and spacious roster, tactical bots, SVG covers, async confirmations, QR, WebRTC');

// All chicken gameplay rules run alongside the existing GHOST ATTACK regression suite.
require('./chickens.cjs');
