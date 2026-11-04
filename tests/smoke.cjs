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
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('style.css','utf8');
const hostLauncher=fs.readFileSync('host.html','utf8');

// Game catalog must contain ONLY the new original Ghost Attack.
assert.match(html,/data-pick="ghost"/);
assert.equal([...html.matchAll(/data-pick="/g)].length,1);
assert.doesNotMatch(html,/data-pick="stars"|data-pick="paint"|data-pick="tanks"/);
assert.match(html,/src="\.\/ghost-attack\.js"/);
assert.doesNotMatch(html,/src="\.\/minigames\.js"/);
assert.equal(fs.existsSync('minigames.js'),false,'delete legacy game engine');
assert.doesNotMatch(source,/window\.PartyMiniGames|function spawnStar|function drawBackdrop/);
assert.match(source,/const MODES = \{ghost:'GHOST ATTACK'\}/);
assert.match(source,/const MAX_PLAYERS = 12;/);
assert.match(source,/MODE_COVER_SVG/);
assert.match(html,/data-session-mode="queue"/);
assert.match(html,/data-session-mode="quick"/);
assert.match(html,/id="uiModal"/);
assert.doesNotMatch(source,/\b(?:alert|confirm)\(/);
assert.match(css,/#hostLobby #hostQueue\{display:none!important\}/);
assert.match(css,/#hostLobby \.lobby-roster \.roster-pick\.picked\{[\s\S]*?display:flex;/);
// No duplicated HUD counters on canvas, no map description beneath the title.
assert.doesNotMatch(html,/HUMANS LEFT|id="gameTitle"/);
assert.match(html,/<div class="game-name"><span class="eyebrow" id="gameMode">GHOST ATTACK<\/span><\/div>/);
assert.doesNotMatch(source,/\$\('gameTitle'\)/);
assert.doesNotMatch(ghostSource,/มนุษย์เหลือ|ผีจะเกิดกลางแผนที่ใน 3 วินาที/);
assert.match(css,/#game \.game-center-hud\{\s*position:relative;\s*transform:translateY\(-9px\)/);
assert.match(css,/#game \.leaderboard\{\s*display:grid;\s*grid-template-columns:repeat\(var\(--leader-count,1\),minmax\(0,1fr\)\)/);
assert.match(css,/#game \.leaderboard\{[\s\S]*?height:23px;[\s\S]*?overflow:hidden;/);
assert.match(css,/#game \.leader-chip span\.leader-held-icon\{[\s\S]*?width:16px/);
assert.match(source,/itemIcon\.className='leader-held-icon'/);
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
vm.runInContext(ghostSource,ghostSandbox,{filename:'ghost-attack.js'});
const ghost=ghostSandbox.window.GhostAttack;
const mkPlayers=n=>Array.from({length:n},(_,i)=>({
 id:'p'+i,name:'Tester '+i,color:['#ff628c','#3fe4ef','#ffcf62','#ae94ff'][i%4],
 type:'remote',active:true,input:{},alive:true,score:0
}));
const init=n=>{const players=mkPlayers(n),round={mode:'ghost',phase:'countdown'};
 ghost.setup(round,players);return {round,players,state:round.ghost};};
for(const n of [1,4,6,7,8,12]){
 const x=init(n),tier=n<=6?1:2;
 assert.equal(x.state.npcs.length,tier,'one ghost for 1-6, two for 7-12');
 assert.equal(x.state.world.w,960);
 assert.equal(x.state.world.h,540);
 assert.equal(x.round.rules.viewMode,'topdown');
 assert.ok(x.state.obstacles.length>=5,'map has distributed solid obstacles');
 assert.equal(x.players.filter(p=>p.active&&!p.ghost).length,n);
 for(const p of x.players){
  assert.ok(p.x>0&&p.x<x.state.world.w&&p.y>0&&p.y<x.state.world.h);
  assert.equal(p.item,null);
 }
}
assert.equal(ghost.constants.humanSpeed,172);
assert.equal(ghost.constants.ghostSpeed,176,'ghosts were slowed from 184');
assert.ok(ghost.constants.ghostSpeed>ghost.constants.humanSpeed);
assert.ok(ghost.constants.ghostSpeed/ghost.constants.humanSpeed<1.04);
assert.equal(ghost.constants.cloakTime,2);
assert.equal(ghost.ITEM_NAMES.slow,'ยาสโลว์เพื่อน');
assert.equal(Object.keys(ghost.ITEM_SVG).length,5);
assert.equal(loadedImages.length,5,'five cached SVG images');
assert.equal(ghost.getItemIconImage('boost'),ghost.getItemIconImage('boost'));

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
 const obstacle=x.state.obstacles[0],p=x.players[0];
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
 // Punch A causes a short stun on a nearby friend.
{
 const x=init(3);x.round.phase='playing';
 x.state.npcs.forEach(n=>n.stun=999);
 x.players[0].x=120;x.players[0].y=120;
 x.players[1].x=151;x.players[1].y=120;
 x.players[2].x=800;x.players[2].y=400;
 x.players[0].input.action=true;
 ghost.update(.016,x.round,x.players);
 assert.ok(x.players[1].stun>.35&&x.players[1].stun<1);
 assert.ok(x.players[0].punchCooldown>.9);
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
 assert.equal(drawImages.length,1,'canvas paints SVG popup');
 assert.equal(drawImages[0][0],ghost.getItemIconImage(item));
 assert.ok(drawImages[0][1]<itemText[1]);
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
 ghost.update(.016,x.round,x.players);
 assert.equal(c.ghost,true,'player-ghost touch infects another human');
 assert.equal(x.state.winnerId,b.id,'the last human wins');
}

const persistedNicknames=new Map();
function setup(url='https://game.example/?host=1',portrait=false) {
  const elements=new Map();
  const makeElement=(id='')=>{
    const handlers={},classes=new Set();
    return {
      id,style:{setProperty(name,value){this[name]=value;}},dataset:{},children:[],value:'',textContent:'',disabled:false,
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
assert.equal(host.elements.get('roster').children.length,1);
assert.equal(host.elements.get('roster').children[0].children[1].textContent,'บอท 1');
assert.equal(host.elements.get('roster').children[0].children[3].children[1].textContent,'GHOST ATTACK');
assert.match(host.elements.get('roster').children[0].children[3].children[0].innerHTML,/<svg[\s>]/);
host.click('startBtn');
assert.equal(host.elements.get('gameMode').textContent,'GHOST ATTACK');
assert.equal(host.elements.get('game').classList.contains('hidden'),false);
assert.equal(host.scope.document.fullscreenElement,host.scope.document.documentElement);
assert.equal(host.elements.get('timer').textContent,'รอผี');
let rr=host.scope.window.__ghostTest.getRound();
assert.equal(rr.phase,'countdown');assert.equal(rr.ghost.npcs.length,1);
for(let i=0;i<245;i++)host.step(i*16.667);
assert.equal(rr.ghost.ghostSpawned,true);
assert.equal(rr.phase,'results','one-player practice has a winner after ghost spawn');
assert.equal(rr.remaining,null,'there is no per-round time limit');
assert.ok(/คน/.test(host.elements.get('timer').textContent));
assert.equal(host.elements.get('leaderboard').children.length,1);
assert.equal(host.elements.get('leaderboard').style['--leader-count'],'1');
const matchPlayers=host.scope.window.__ghostTest.getPlayers();
matchPlayers[0].item='cloak';
host.scope.window.__ghostTest.renderLeaderboard();
let firstChip=host.elements.get('leaderboard').children[0];
assert.equal(firstChip.children[1].textContent,matchPlayers[0].name);
assert.equal(firstChip.children[2].className,'leader-held-icon');
assert.equal(firstChip.children[2].textContent,'');
assert.match(firstChip.children[2].innerHTML,/<svg[\s>]/);
assert.equal(firstChip.children[2].title,'ผ้าคลุมล่องหน');
assert.equal(firstChip.children[2].attributes['aria-label'],'ผ้าคลุมล่องหน');
matchPlayers[0].item=null;
host.scope.window.__ghostTest.renderLeaderboard();
firstChip=host.elements.get('leaderboard').children[0];
assert.equal(firstChip.children.length,3,'item tag disappears after use');

const addedPlayers=mkPlayers(11).map((p,i)=>({...p,id:'extra-'+i,ghost:i%2===0}));
matchPlayers.push(...addedPlayers);
addedPlayers[1].item='boost';
host.scope.window.__ghostTest.renderLeaderboard();
assert.equal(host.elements.get('leaderboard').children.length,12);
const busyItemChip=host.elements.get('leaderboard').children.find(chip=>
 chip.children[1].textContent===addedPlayers[1].name);
assert.ok(busyItemChip,'held-item player remains visible after survivor/ghost sorting');
assert.equal(busyItemChip.children[2].textContent,'');
assert.match(busyItemChip.children[2].innerHTML,/<svg[\s>]/);
assert.equal(busyItemChip.children[2].title,'บูสต์สปีด',
 'full item label remains accessible in a tooltip');
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
bigRoom.sessionButtons[1].fire('click');
assert.equal(bigRoom.sessionButtons[1].classList.contains('active'),true);
bigRoom.sessionButtons[0].fire('click');
bigRoom.click('startBtn');
assert.equal(bigRoom.scope.window.__ghostTest.getRound().ghost.npcs.length,2);
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
