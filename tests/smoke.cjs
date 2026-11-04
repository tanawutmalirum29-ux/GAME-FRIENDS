'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('app.js','utf8');
const miniSource=fs.readFileSync('minigames.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('style.css','utf8');
const hostLauncher=fs.readFileSync('host.html','utf8');
assert.match(hostLauncher,/\?host=1/);
assert.match(html,/id="controllerPreviewVideo"/);
assert.match(html,/id="videoQuality"/);
assert.match(html,/value="low"/);
assert.match(html,/value="medium"/);
assert.match(html,/value="high"/);
assert.match(css,/\.joystick-zone\{[\s\S]*?grid-column:1;grid-row:1/);
assert.match(css,/\.gamepad-preview-column\{[\s\S]*?grid-column:1;grid-row:1/);
assert.match(css,/@media\(orientation:portrait\)/);
assert.match(html,/id="joystickBase"/);
assert.match(html,/id="joystickZone"/);
assert.match(html,/id="controllerPreviewImage"/);
assert.match(html,/id="controllerPreviewPlaceholder"/);
assert.match(html,/id="hostLobby"/);
assert.match(html,/id="hostQueue"/);
assert.match(html,/id="phoneGamePicker"/);
assert.match(html,/data-pick="stars"/);
assert.match(html,/data-pick="paint"/);
assert.doesNotMatch(html,/id="gameCards"/);
assert.match(css,/#hostLobby\.host-lobby/);
assert.match(css,/\.roster-pick\.picked/);
assert.match(html,/id="leaveConfirm"/);
assert.match(html,/id="confirmLeaveBtn"/);
assert.match(html,/id="stayInRoomBtn"/);
assert.match(css,/\.gamepad-preview\{/);
assert.match(css,/\.controller-leave-overlay\{/);
assert.match(css,/\.gamepad-preview-column/);
assert.match(html,/id="switchRoomBtn"/);
assert.match(html,/id="roomCodeInput"/);
assert.match(html,/id="scanRoomBtn"/);
assert.match(html,/id="roomQrReader"/);
assert.match(css,/\.room-scanner-panel/);
assert.match(css,/\.joystick-zone\.is-active \.joystick-base/);
assert.match(css,/\.joystick-zone\.hint-dismissed \.joystick-hint\{display:none!important\}/);
assert.match(css,/\.face-a\{order:0/);
assert.match(css,/\.face-b\{order:1;margin:-10px/);
assert.match(html,/data-control="alt"/);
assert.match(html,/id="portraitFallbackBtn"/);
assert.match(html,/id="portraitRestoreBtn"/);
assert.match(css,/portrait-fallback #controllerActive/);
assert.match(css,/rotate\(90deg\)/);
assert.match(html,/id="viewportMeta"/);
assert.match(css,/body\.zoom-locked/);
assert.match(css,/\.pad-buttons\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(css,/\.face-button\{\s*width:clamp\(94px,27vh,152px\)/);
assert.match(css,/\.joystick-base\{width:clamp\(148px,43vh,270px\)/);
assert.doesNotMatch(html,/id="localPads"/,'game screen must have no on-screen host pads');
assert.match(html,/id="pauseBtn"/);
assert.match(html,/id="pauseMenu"/);
assert.match(html,/id="resumeBtn"/);
assert.match(css,/#game\.game-page\{[\s\S]*?position:fixed/);
assert.match(css,/#game \.game-frame canvas\{[\s\S]*?object-fit:contain/);
// One center column contains both timer and the score chips, no bottom scoreboard.
assert.match(html,/<div class="game-center-hud">\s*<div class="timer-box">[\s\S]*?<div id="leaderboard" class="leaderboard"/);
assert.match(css,/#game \.leaderboard\{\s*position:relative/);
assert.match(css,/#game \.leaderboard\{[\s\S]*?flex-wrap:wrap;justify-content:center/);
assert.match(css,/#game \.game-name\{[\s\S]*?left:max\(116px/);
assert.match(css,/body\.controller-playing \.face-b\{margin-top:8px\}/);
assert.match(css,/body\.controller-playing \.gamepad-face-buttons\{[\s\S]*?justify-self:end/);
assert.match(css,/#game \.game-pause-btn\{[\s\S]*?min-height:35px/);

const persistedNicknames=new Map();
function setup(url='https://game.example/?host=1',portrait=false) {
  const elements=new Map();
  const makeElement=(id='')=>{
    const handlers={},classes=new Set();
    return {
      id,style:{},dataset:{},children:[],value:'',textContent:'',disabled:false,
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
      captureStream(fps){return {
        fps,width:this.width,height:this.height,
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
  elements.get('duration').value='60';elements.get('sessionMode').value='queue';
  elements.get('autoNext').checked=true;
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
      if(selector==='#controllerActive [data-control]')return Object.values(padButtons);
      return [];
    },
    addEventListener(name,fn){(docHandlers[name]??=[]).push(fn);},execCommand(){return true;}
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
  vm.runInContext(miniSource,scope,{filename:'minigames.js'});
  vm.runInContext(source,scope,{filename:'app.js'});
  return {elements,pickButtons,padButtons,instances,scope,
    mediaCall(peer){return new FakeMediaCall(peer);},
    step(ms){assert(raf);raf(ms);},
    click(id){elements.get(id).fire('click');},
    pick(mode){const button=pickButtons.find(x=>x.dataset.pick===mode);assert(button);button.fire('click');}
  };
}

// All 12 active players need unique, easily distinguishable colors.
const colors=setup();
for(let i=0;i<12;i++)colors.click('addLocalBtn');
const getColors=()=>colors.elements.get('roster').children.map(row=>row.children[0].style.background);
assert.equal(getColors().length,12,'all player slots available');
assert.equal(new Set(getColors()).size,12,'all players have distinct colors');
assert.equal(colors.elements.get('addLocalBtn').disabled,true);
// Removing someone must release only their color; a new join must not duplicate
// another player's color when the roster length changes.
colors.elements.get('roster').children[3].children[4].fire('click');
assert.equal(colors.elements.get('rosterCount').textContent,'11/12');
colors.click('addLocalBtn');
assert.equal(new Set(getColors()).size,12,'color uniqueness persists after replacement');
// Every player gets a separate score chip inside the centered score group.
// With 12 players the flex-wrap style moves chips to more rows, never below the arena.
colors.click('startBtn');
assert.equal(colors.elements.get('leaderboard').children.length,12);
assert.ok(colors.elements.get('leaderboard').children.every(chip=>
  chip.children.length===3&&chip.children[1].textContent&&chip.children[2].textContent.includes('pts')));
const host=setup();
assert.equal(host.elements.get('home').classList.contains('hidden'),false);
assert.equal(host.scope.document.body.classList.contains('zoom-locked'),false);
assert.doesNotMatch(host.elements.get('viewportMeta').content,/user-scalable=no/);
assert.equal(host.scope.document.fire('gesturestart').defaultPrevented,false);
host.click('addLocalBtn');
assert.equal(host.elements.get('rosterCount').textContent,'1/12');
host.click('offlineBtn');
assert.equal(host.elements.get('hostLobby').classList.contains('hidden'),false);
assert.equal(host.elements.get('startBtn').disabled,false);
host.click('startBtn');
assert.equal(host.elements.get('game').classList.contains('hidden'),false);
assert.equal(host.scope.document.body.classList.contains('host-playing'),true);
assert.equal(host.elements.get('leaderboard').children.length,1,'one player uses one score chip');
assert.equal(host.elements.get('pauseMenu').classList.contains('hidden'),true);
assert.equal(host.scope.document.body.classList.contains('zoom-locked'),true);
assert.match(host.elements.get('viewportMeta').content,/maximum-scale=1,user-scalable=no/);
assert.equal(host.scope.document.fire('gesturestart').defaultPrevented,true);
assert.equal(host.scope.document.fire('gesturechange').defaultPrevented,true);
assert.equal(host.scope.document.fire('touchmove',{touches:[{},{}]}).defaultPrevented,true);
assert.equal(host.scope.document.fire('touchmove',{touches:[{}]}).defaultPrevented,false);
const hitTarget={closest(selector){return selector.includes('#arena')?this:null;}};
host.scope.document.fire('touchend',{target:hitTarget,changedTouches:[{}]});
assert.equal(host.scope.document.fire('touchend',{target:hitTarget,changedTouches:[{}]}).defaultPrevented,true);
assert.equal(host.scope.document.fire('dblclick').defaultPrevented,true);
for(let i=0;i<250;i++)host.step(i*16.67);
assert.equal(host.elements.get('gameMode').textContent,'STAR RUSH');
// Pause genuinely freezes gameplay and the countdown timer, not just an overlay.
const timerBeforePause=host.elements.get('timer').textContent;
host.click('pauseBtn');
assert.equal(host.elements.get('pauseMenu').classList.contains('hidden'),false);
assert.equal(host.elements.get('pauseBtn').attributes['aria-expanded'],'true');
for(let i=250;i<480;i++)host.step(i*16.67);
assert.equal(host.elements.get('timer').textContent,timerBeforePause,'timer freezes during pause');
host.click('resumeBtn');
assert.equal(host.elements.get('pauseMenu').classList.contains('hidden'),true);
for(let i=480;i<560;i++)host.step(i*16.67);
assert.notEqual(host.elements.get('timer').textContent,timerBeforePause,'timer resumes after pause');
host.click('pauseBtn');
host.click('exitBtn');
assert.equal(host.elements.get('hostLobby').classList.contains('hidden'),false);
assert.equal(host.scope.document.body.classList.contains('host-playing'),false);
assert.equal(host.scope.document.body.classList.contains('zoom-locked'),false);
assert.doesNotMatch(host.elements.get('viewportMeta').content,/user-scalable=no/);
assert.equal(host.scope.document.fire('touchmove',{touches:[{},{}]}).defaultPrevented,false);
host.click('hostBtn');
assert.equal(host.instances.length,1);
host.instances[0].fire('open');
assert.equal(host.elements.get('roomCode').textContent.length,6);
assert.match(host.elements.get('roomUrl').value,/join=[A-Z2-9]{6}/);
assert.equal(host.elements.get('hostLobby').classList.contains('hidden'),false);

// Remote player can be kicked without a recursive connection-close loop.
const guest=host.instances[0].connect();
host.instances[0].fire('connection',guest);
guest.fire('data',{t:'join',name:'Friend'});
assert.equal(host.elements.get('rosterCount').textContent,'2/12');
// All active players must nominate a game. The host does not choose it.
assert.equal(host.elements.get('startBtn').disabled,true);
assert.match(host.elements.get('roster').children[1].children[3].textContent,/ยังไม่เลือกเกม/);
guest.fire('data',{t:'pick',mode:'tanks'});
assert.match(host.elements.get('roster').children[1].children[3].textContent,/TANK BLAST/);
assert.equal(host.elements.get('startBtn').disabled,false);
assert.match(host.elements.get('hostQueue').textContent,/TANK BLAST ×1/);
// Invalid choices do not affect the queue.
guest.fire('data',{t:'pick',mode:'invalid-injection'});
assert.match(host.elements.get('hostQueue').textContent,/TANK BLAST ×1/);
// A game frame is compressed on the host then sent only to joined controllers.
host.elements.get('sessionMode').value='quick';
host.click('startBtn');
host.step(10000);
const snapshot=guest.sent.find(packet=>packet.t==='preview');
assert.ok(snapshot,'a remote joined controller receives a real game-frame packet');
assert.match(snapshot.image,/^data:image\/jpeg;base64,/);
assert.ok(['stars','tanks'].includes(snapshot.mode));
host.click('pauseBtn');
assert.equal(host.elements.get('gameChoiceList').children.length,2);
assert.match(host.elements.get('gameChoiceList').children[1].textContent,/TANK BLAST/);
// Picks cannot be changed while any round is in progress.
guest.fire('data',{t:'pick',mode:'soccer'});
assert.match(host.elements.get('gameChoiceList').children[1].textContent,/TANK BLAST/);
assert.equal(guest.sent.at(-1).t,'state');
assert.equal(guest.sent.at(-1).phase,'paused');
host.click('resumeBtn');
assert.equal(guest.sent.at(-1).phase,'countdown');
host.click('pauseBtn');
host.click('exitBtn');
host.elements.get('roster').children[1].children[4].fire('click');
assert.equal(host.elements.get('rosterCount').textContent,'1/12');

const mobile=setup('https://game.example/?join=ABCD23',true);
assert.equal(mobile.elements.get('controller').classList.contains('hidden'),false);
mobile.elements.get('nick').value='ทดสอบ';
mobile.elements.get('nick').fire('input');
assert.equal(persistedNicknames.get('gf-nick'),'ทดสอบ');
assert.equal(mobile.elements.get('roomCodeInput').value,'ABCD23');
mobile.click('joinBtn');
assert.equal(mobile.instances.length,1);
mobile.instances[0].fire('open');
const conn=mobile.instances[0].conn;
conn.fire('open');
assert.equal(conn.sent[0].t,'join');
conn.fire('data',{t:'welcome',id:'p1',name:'ทดสอบ',color:'#ff628c',mode:'stars'});
assert.equal(mobile.elements.get('controllerActive').classList.contains('hidden'),false);
assert.equal(mobile.elements.get('controllerName').textContent,'ทดสอบ');
assert.equal(mobile.elements.get('controllerModeName').textContent,'STAR RUSH');
assert.equal(mobile.elements.get('phoneGamePicker').classList.contains('hidden'),false);
mobile.pick('soccer');
assert.equal(conn.sent.at(-1).t,'pick');
assert.equal(conn.sent.at(-1).mode,'soccer');
conn.fire('data',{t:'roster',phase:'lobby',mode:'stars',
  players:[{id:'p1',name:'ทดสอบ',active:false,choice:'soccer'}]});
assert.equal(mobile.pickButtons.find(x=>x.dataset.pick==='soccer').classList.contains('selected'),true);
assert.match(mobile.elements.get('phoneChoiceStatus').textContent,/FOOTBALL/);
conn.fire('data',{t:'state',phase:'playing',mode:'soccer',remaining:45});
assert.equal(mobile.elements.get('phoneGamePicker').classList.contains('hidden'),true);
const lockedVoteCount=conn.sent.length;
mobile.pick('tanks');
assert.equal(conn.sent.length,lockedVoteCount,'cannot send another vote after start');
assert.equal(mobile.elements.get('controllerPreviewImage').classList.contains('hidden'),true);
conn.fire('data',snapshot);
assert.equal(mobile.elements.get('controllerPreviewImage').src,snapshot.image,
  'controller shows the host-generated frame');
assert.equal(mobile.elements.get('controllerPreviewImage').classList.contains('hidden'),false);
assert.equal(mobile.elements.get('controllerPreviewPlaceholder').classList.contains('hidden'),true);
conn.fire('data',{t:'preview',image:'data:text/html;base64,PHNjcmlwdD4='});
assert.equal(mobile.elements.get('controllerPreviewImage').src,snapshot.image,'unsafe image ignored');
conn.fire('data',{t:'preview-reset'});
assert.equal(mobile.elements.get('controllerPreviewImage').classList.contains('hidden'),true);
assert.equal(mobile.elements.get('controllerPreviewPlaceholder').classList.contains('hidden'),false);
// The first press of Exit opens confirmation, not a disconnect.
mobile.click('leaveBtn');
assert.equal(conn.open,true,'still connected before confirmation');
assert.equal(mobile.elements.get('leaveConfirm').classList.contains('hidden'),false);
mobile.click('stayInRoomBtn');
assert.equal(conn.open,true,'cancel preserves session');
assert.equal(mobile.elements.get('leaveConfirm').classList.contains('hidden'),true);
assert.equal(mobile.scope.document.body.classList.contains('controller-playing'),true);
assert.equal(mobile.scope.document.body.classList.contains('portrait-fallback'),false,
  'normal landscape remains the default even on portrait phones');
assert.equal(mobile.scope.document.body.classList.contains('zoom-locked'),true);
assert.match(mobile.elements.get('viewportMeta').content,/user-scalable=no/);
mobile.padButtons.action.fire('pointerdown');
assert.equal(conn.sent.at(-1).keys.action,true);
mobile.padButtons.action.fire('pointerup');
mobile.padButtons.alt.fire('pointerdown');
assert.equal(conn.sent.at(-1).keys.alt,true);
mobile.padButtons.alt.fire('pointerup');
const stick=mobile.elements.get('joystickZone');
const ring=mobile.elements.get('joystickBase');
// The visual ring starts hidden and centers exactly on ANY first touch.
// The on-screen help disappears on the first valid touch and stays gone.
assert.equal(stick.classList.contains('is-active'),false);
assert.equal(stick.classList.contains('hint-dismissed'),false);
stick.fire('pointerdown',{pointerId:11,clientX:160,clientY:70});
assert.equal(stick.classList.contains('hint-dismissed'),true);
assert.equal(persistedNicknames.get('gf-joystick-hint-seen-v1'),'1');
assert.equal(stick.classList.contains('is-active'),true);
assert.equal(ring.style.left,'160px','ring anchors at first touch X');
assert.equal(ring.style.top,'70px','ring anchors at first touch Y');
assert.equal(conn.sent.at(-1).keys.axisX,0,'first touch does not move character');
stick.fire('pointermove',{pointerId:11,clientX:235,clientY:70});
assert.ok(conn.sent.at(-1).keys.axisX>.99,'drag right from first touch');
stick.fire('pointermove',{pointerId:11,clientX:160,clientY:5});
assert.ok(conn.sent.at(-1).keys.axisY<-.99,'drag up from first touch');
stick.fire('pointerup',{pointerId:11});
assert.equal(conn.sent.at(-1).keys.axisX,0);
assert.equal(conn.sent.at(-1).keys.axisY,0);
assert.equal(stick.classList.contains('is-active'),false);
assert.equal(stick.classList.contains('hint-dismissed'),true,
  'hint stays hidden when finger is lifted');
// Re-touching far away must create a NEW center, not reuse a fixed joystick.
stick.fire('pointerdown',{pointerId:14,clientX:35,clientY:145});
assert.equal(ring.style.left,'35px');
assert.equal(ring.style.top,'145px');
stick.fire('pointermove',{pointerId:14,clientX:110,clientY:145});
assert.ok(conn.sent.at(-1).keys.axisX>.99,'drag follows from new anchor');
stick.fire('pointercancel',{pointerId:14});
assert.equal(conn.sent.at(-1).keys.axisX,0,'pointercancel releases stick');
assert.equal(stick.classList.contains('is-active'),false);
// The user explicitly chooses sideways UI without physically rotating the device.
mobile.click('portraitFallbackBtn');
assert.equal(mobile.scope.document.body.classList.contains('portrait-fallback'),true);
assert.equal(mobile.elements.get('portraitRestoreBtn').classList.contains('hidden'),false);
// In rotated CSS, physical DOWN corresponds to the local RIGHT arrow.
stick.fire('pointerdown',{pointerId:12,clientX:140,clientY:75});
assert.equal(ring.style.left,'75px','rotated ring maps touch to local X');
assert.equal(ring.style.top,'60px','rotated ring maps touch to local Y');
stick.fire('pointermove',{pointerId:12,clientX:140,clientY:150});
assert.ok(conn.sent.at(-1).keys.axisX>.99,'sideways physical down maps right');
assert.equal(conn.sent.at(-1).keys.axisY,0);
stick.fire('pointermove',{pointerId:12,clientX:215,clientY:75});
assert.ok(conn.sent.at(-1).keys.axisY<-.99,'sideways physical right maps local up');
stick.fire('pointerup',{pointerId:12});
assert.equal(conn.sent.at(-1).keys.axisX,0);
assert.equal(conn.sent.at(-1).keys.axisY,0);
// A/B remain independent and usable simultaneously with a held analog touch.
stick.fire('pointerdown',{pointerId:20,clientX:50,clientY:110});
stick.fire('pointermove',{pointerId:20,clientX:50,clientY:190});
assert.ok(conn.sent.at(-1).keys.axisX>.99);
mobile.padButtons.action.fire('pointerdown',{pointerId:21});
mobile.padButtons.alt.fire('pointerdown',{pointerId:22});
assert.equal(conn.sent.at(-1).keys.action,true);
assert.equal(conn.sent.at(-1).keys.alt,true);
assert.ok(conn.sent.at(-1).keys.axisX>.99,'analog remains active while A+B held');
mobile.padButtons.action.fire('pointerup',{pointerId:21});
mobile.padButtons.alt.fire('pointerup',{pointerId:22});
stick.fire('pointerup',{pointerId:20});
assert.equal(conn.sent.at(-1).keys.axisX,0);
// Returning to default landscape is always available.
mobile.click('portraitRestoreBtn');
assert.equal(mobile.scope.document.body.classList.contains('portrait-fallback'),false);
assert.equal(mobile.elements.get('portraitRestoreBtn').classList.contains('hidden'),true);
// If a previously upright phone rotates normally, deactivate the fallback.
mobile.click('portraitFallbackBtn');
mobile.scope.window.portrait=false;
mobile.scope.window.fire('resize');
assert.equal(mobile.scope.document.body.classList.contains('portrait-fallback'),false);
mobile.scope.window.portrait=true;
conn.fire('data',{t:'state',phase:'paused',mode:'stars',remaining:35});
assert.match(mobile.elements.get('controllerState').textContent,/หยุดเกมชั่วคราว/);
conn.fire('data',{t:'roster',phase:'lobby',mode:'tanks',players:[]});
assert.equal(mobile.elements.get('buttonALabel').textContent,'FIRE');
assert.equal(mobile.elements.get('buttonBLabel').textContent,'DODGE');
// Each of the seven minigames can be nominated on a phone and launched by the host.
for(const mode of ['stars','brawl','lava','tanks','soccer','rally','paint']){
  const test=setup();
  test.click('hostBtn');test.instances[0].fire('open');
  const remote=test.instances[0].connect();test.instances[0].fire('connection',remote);
  remote.fire('data',{t:'join',name:'Picker'});
  remote.fire('data',{t:'pick',mode});
  assert.equal(test.elements.get('startBtn').disabled,false);
  test.click('startBtn');
  for(let i=0;i<270;i++)test.step(i*16.667);
  assert.equal(test.elements.get('gameMode').textContent,{
    stars:'STAR RUSH',brawl:'BRAWL ARENA',lava:'LAVA RUN',
    tanks:'TANK BLAST',soccer:'FOOTBALL',rally:'MICRO RALLY',paint:'COLOR CLASH'}[mode]);
  assert.equal(test.elements.get('game').classList.contains('hidden'),false);
}
// Duplicate picks are preserved: two people choosing TANK BLAST means two rounds.
const tour=setup();
tour.click('hostBtn');tour.instances[0].fire('open');
tour.elements.get('sessionMode').value='queue';
tour.elements.get('autoNext').checked=false;
const votes=[];
for(const mode of ['tanks','tanks','soccer']){
  const remote=tour.instances[0].connect();tour.instances[0].fire('connection',remote);
  remote.fire('data',{t:'join',name:'Picker '+votes.length});
  remote.fire('data',{t:'pick',mode});
  votes.push(remote);
}
assert.match(tour.elements.get('hostQueue').textContent,/TANK BLAST ×2/);
assert.match(tour.elements.get('hostQueue').textContent,/FOOTBALL ×1/);
tour.click('startBtn');
const modesPlayed=[];
for(let roundIndex=0;roundIndex<3;roundIndex++){
  modesPlayed.push(tour.elements.get('gameMode').textContent);
  for(let i=0;i<1660;i++)tour.step(i*45+roundIndex*80000);
  assert.equal(tour.elements.get('results').classList.contains('hidden'),false);
  if(roundIndex<2){
    assert.match(tour.elements.get('replayBtn').textContent,/เกมถัดไป/);
    tour.click('replayBtn');
    assert.equal(tour.elements.get('results').classList.contains('hidden'),true);
  }
}
assert.equal(modesPlayed.filter(x=>x==='TANK BLAST').length,2);
assert.equal(modesPlayed.filter(x=>x==='FOOTBALL').length,1);
assert.match(tour.elements.get('resultList').children[0].textContent,/แชมป์ทัวร์นาเมนต์/);
assert.equal(tour.elements.get('replayBtn').textContent,'สุ่มชุดใหม่จากตัวเลือกเดิม');
// Auto-next is optional and should advance the round without another host click.
const auto=setup();
auto.click('offlineBtn');
auto.elements.get('autoNext').checked=true;
auto.elements.get('sessionMode').value='queue';
auto.click('startBtn');
for(let i=0;i<1440;i++)auto.step(i*45);
assert.equal(auto.elements.get('results').classList.contains('hidden'),false);
for(let i=1440;i<1610;i++)auto.step(i*45);
assert.equal(auto.elements.get('results').classList.contains('hidden'),true,
  'queue proceeds automatically after results countdown');
// Disconnect must exit landscape mode and clear the analog stick.
conn.fire('close');
assert.equal(mobile.scope.document.body.classList.contains('controller-playing'),false);
assert.equal(mobile.scope.document.body.classList.contains('zoom-locked'),false);
assert.doesNotMatch(mobile.elements.get('viewportMeta').content,/user-scalable=no/);
// Confirming exit, unlike cancel, disconnects the phone and returns to the home URL.
const exitMobile=setup('https://game.example/?join=ABCDE3');
exitMobile.elements.get('nick').value='ทดสอบ';exitMobile.click('joinBtn');
exitMobile.instances[0].fire('open');
const exitConn=exitMobile.instances[0].conn;
exitConn.fire('open');
exitConn.fire('data',{t:'welcome',id:'p-exit',name:'ทดสอบ',color:'#ffcf62',mode:'stars'});
exitMobile.click('leaveBtn');
assert.equal(exitConn.open,true);
exitMobile.click('confirmLeaveBtn');
assert.equal(exitConn.open,false,'confirmation disconnects PeerJS');
assert.equal(exitMobile.scope.document.body.classList.contains('controller-playing'),false);
assert.equal(exitMobile.elements.get('leaveConfirm').classList.contains('hidden'),true);
assert.equal(exitMobile.scope.window.location.search,'','exiting removes join code');
// The new B secondary action and half-strength analog must alter minigame movement.
const fighter={
  id:'p-test',name:'Stick',color:'#fff',active:true,alive:true,
  input:{axisX:.5,axisY:0,alt:true,action:false},
  cooldown:0,invulnerable:0,score:0,angle:0
};
const miniRound={mode:'tanks'};
const engine=host.scope.window.PartyMiniGames;
engine.setup(miniRound,[fighter]);
const startX=fighter.x;
engine.update(.10,miniRound,[fighter]);
assert.ok(fighter.x>startX,'analog stick moves tank right');
assert.ok(fighter.altCooldown>0,'B triggered tank dodge');
// A new Chrome tab under the SAME origin retains the nickname and stick education.
const newTab=setup('https://game.example/?join=WXYZ56');
assert.equal(newTab.elements.get('joystickZone').classList.contains('hint-dismissed'),true,
  'joystick hint stays gone in newly opened Chrome tabs');
assert.equal(newTab.elements.get('nick').value,'ทดสอบ','nickname persists across QR-opened tabs');
assert.equal(newTab.elements.get('roomCodeInput').value,'WXYZ56');
assert.equal(newTab.elements.get('joinCode').textContent,'WXYZ56');
// Room changes should reuse THIS tab and close the prior data connection.
newTab.click('joinBtn');
newTab.instances[0].fire('open');
const firstConn=newTab.instances[0].conn;
firstConn.fire('open');
firstConn.fire('data',{t:'welcome',id:'p77',name:'ทดสอบ',color:'#fff',mode:'stars'});
assert.equal(newTab.scope.document.body.classList.contains('controller-playing'),true);
newTab.click('switchRoomBtn');
assert.equal(firstConn.open,false,'old controller transport released before switching');
assert.equal(newTab.elements.get('joinForm').classList.contains('hidden'),false);
assert.equal(newTab.scope.document.body.classList.contains('controller-playing'),false);
newTab.elements.get('roomCodeInput').value='EFGH45';
newTab.click('joinBtn');
assert.equal(newTab.instances.length,2,'new Peer is created in the same page');
assert.match(newTab.scope.window.location.href,/join=EFGH45/);
assert.equal(newTab.elements.get('nick').value,'ทดสอบ');
newTab.instances[1].fire('open');
const secondConn=newTab.instances[1].conn;
secondConn.fire('open');
assert.equal(secondConn.sent[0].name,'ทดสอบ');
secondConn.fire('data',{t:'welcome',id:'p88',name:'ทดสอบ',color:'#fff',mode:'tanks'});
assert.equal(newTab.scope.document.body.classList.contains('controller-playing'),true);
newTab.click('switchRoomBtn');
assert.equal(secondConn.open,false);
assert.equal(newTab.elements.get('roomCodeInput').value,'EFGH45');
// Test direct manual input sanitization and invalid room rejection.
newTab.elements.get('roomCodeInput').value='???';
newTab.click('joinBtn');
assert.equal(newTab.instances.length,2,'invalid room cannot create a Peer');
assert.match(newTab.elements.get('joinMessage').textContent,/รหัสห้องไม่ถูกต้อง/);
// In-app scan path: fake camera, no page navigation, and automatic join.
void (async()=>{
  const fake={started:0,stopped:0,cleared:0};
  class FakeQrScanner{
    constructor(){fake.reader=this;}
    start(_camera,_config,onSuccess){fake.started++;this.onSuccess=onSuccess;return Promise.resolve();}
    stop(){fake.stopped++;return Promise.resolve();}
    clear(){fake.cleared++;}
  }
  newTab.scope.window.Html5Qrcode=FakeQrScanner;
  newTab.elements.get('roomCodeInput').value='';
  newTab.click('scanRoomBtn');
  for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(fake.started,1,'in-page camera scanner starts');
  assert.equal(newTab.elements.get('roomScannerPanel').classList.contains('hidden'),false);
  fake.reader.onSuccess('https://game.example/?join=KLMN45');
  for(let i=0;i<16;i++)await Promise.resolve();
  assert.ok(fake.stopped>=1,'scanner camera stopped after successful read');
  assert.ok(fake.cleared>=1,'scanner cleared after read');
  assert.equal(newTab.elements.get('roomCodeInput').value,'KLMN45');
  assert.match(newTab.scope.window.location.href,/join=KLMN45/);
  assert.equal(newTab.instances.length,3,'QR joins a new room in the existing tab');
  assert.equal(newTab.elements.get('roomScannerPanel').classList.contains('hidden'),true);
  newTab.instances[2].fire('open');
  newTab.instances[2].conn.fire('open');
  assert.equal(newTab.instances[2].conn.sent[0].name,'ทดสอบ');
  console.log('SMOKE PASS: streamed phone game preview, compact HUD, confirmed exit, joystick, nickname, QR and 7 games');
})().catch(err=>{console.error(err);process.exitCode=1;});
