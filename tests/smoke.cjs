'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('app.js','utf8');
const miniSource=fs.readFileSync('minigames.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('style.css','utf8');
assert.match(css,/@media\(orientation:portrait\)/);
assert.match(html,/id="joystickBase"/);
assert.match(html,/data-control="alt"/);
assert.match(html,/id="viewportMeta"/);
assert.match(css,/body\.zoom-locked/);
assert.match(css,/\.pad-buttons\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(css,/\.face-button\{\s*width:clamp\(94px,27vh,152px\)/);
assert.match(css,/\.joystick-base\{width:clamp\(148px,43vh,270px\)/);

function setup(url='https://game.example/') {
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
      getContext(){return context;},getBoundingClientRect(){return {left:0,top:0,width:200,height:200};},parentElement:null
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
  elements.get('mode').value='stars';elements.get('duration').value='60';elements.get('sessionMode').value='quick';
  elements.get('localPads').parentElement=makeElement('pad-section');
  const cards=[...html.matchAll(/data-game="([^"]+)"/g)].map(([,game])=>{
    const card=makeElement('card-'+game);card.dataset.game=game;return card;
  });
  const padButtons=Object.fromEntries(['action','alt'].map(key=>{
    const button=makeElement('pad-'+key);button.dataset.control=key;return [key,button];
  }));
  const docHandlers={};
  const document={
    body:makeElement('body'),
    fire(name,props={}){
      const e={cancelable:true,defaultPrevented:false,
        preventDefault(){this.defaultPrevented=true;},...props};
      for(const fn of docHandlers[name]||[])fn(e);
      return e;
    },
    getElementById(id){assert(elements.has(id),'Missing ID: '+id);return elements.get(id);},
    createElement(tag){return makeElement(tag);},
    querySelectorAll(selector){
      if(selector==='[data-game]')return cards;
      if(selector==='#controllerActive [data-control]')return Object.values(padButtons);
      return [];
    },
    addEventListener(name,fn){(docHandlers[name]??=[]).push(fn);},execCommand(){return true;}
  };
  const instances=[];
  class FakeConn{
    constructor(){this.handlers={};this.open=true;this.sent=[];}
    on(name,fn){this.handlers[name]=fn;}
    send(value){this.sent.push(value);}
    close(){this.open=false;this.handlers.close?.();}
    fire(name,value){this.handlers[name]?.(value);}
  }
  class FakePeer{
    constructor(id){this.id=id;this.handlers={};instances.push(this);}
    on(name,fn){this.handlers[name]=fn;}
    connect(){this.conn=new FakeConn();return this.conn;}
    destroy(){}
    fire(name,value){this.handlers[name]?.(value);}
  }
  let raf=null;
  const win={location:new URL(url),crypto:webcrypto,addEventListener(){},scrollTo(){},};
  const sessionStorage={getItem(){return '';},setItem(){}};
  const globals={window:win,location:win.location,document,crypto:webcrypto,sessionStorage,
    navigator:{},Peer:FakePeer,URL,URLSearchParams,
    setInterval(){return 1;},setTimeout(){return 1;},
    requestAnimationFrame(fn){raf=fn;},alert(){},confirm(){return true;}};
  const scope=vm.createContext(globals);
  vm.runInContext(miniSource,scope,{filename:'minigames.js'});
  vm.runInContext(source,scope,{filename:'app.js'});
  return {elements,cards,padButtons,instances,scope,step(ms){assert(raf);raf(ms);},click(id){elements.get(id).fire('click');},clickCard(mode){const card=cards.find(b=>b.dataset.game===mode);assert(card);card.fire('click');}};
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
colors.elements.get('roster').children[3].children[3].fire('click');
assert.equal(colors.elements.get('rosterCount').textContent,'11/12');
colors.click('addLocalBtn');
assert.equal(new Set(getColors()).size,12,'color uniqueness persists after replacement');

const host=setup();
assert.equal(host.elements.get('home').classList.contains('hidden'),false);
assert.equal(host.scope.document.body.classList.contains('zoom-locked'),false);
assert.doesNotMatch(host.elements.get('viewportMeta').content,/user-scalable=no/);
assert.equal(host.scope.document.fire('gesturestart').defaultPrevented,false);
host.click('addLocalBtn');
assert.equal(host.elements.get('rosterCount').textContent,'1/12');
host.click('offlineBtn');
assert.equal(host.elements.get('game').classList.contains('hidden'),false);
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
for(let i=0;i<120;i++)host.step(i*16.67);
assert.equal(host.elements.get('gameMode').textContent,'STAR RUSH');
host.click('exitBtn');
assert.equal(host.scope.document.body.classList.contains('zoom-locked'),false);
assert.doesNotMatch(host.elements.get('viewportMeta').content,/user-scalable=no/);
assert.equal(host.scope.document.fire('touchmove',{touches:[{},{}]}).defaultPrevented,false);
host.click('hostBtn');
assert.equal(host.instances.length,1);
host.instances[0].fire('open');
assert.equal(host.elements.get('roomCode').textContent.length,6);
assert.match(host.elements.get('roomUrl').value,/join=[A-Z2-9]{6}/);

// Remote player can be kicked without a recursive connection-close loop.
const guest=host.instances[0].connect();
host.instances[0].fire('connection',guest);
guest.fire('data',{t:'join',name:'Friend'});
assert.equal(host.elements.get('rosterCount').textContent,'2/12');
host.elements.get('roster').children[1].children[3].fire('click');
assert.equal(host.elements.get('rosterCount').textContent,'1/12');

const mobile=setup('https://game.example/?join=ABCD23');
assert.equal(mobile.elements.get('controller').classList.contains('hidden'),false);
mobile.elements.get('nick').value='ทดสอบ';
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
assert.equal(mobile.scope.document.body.classList.contains('controller-playing'),true);
assert.equal(mobile.scope.document.body.classList.contains('zoom-locked'),true);
assert.match(mobile.elements.get('viewportMeta').content,/user-scalable=no/);
mobile.padButtons.action.fire('pointerdown');
assert.equal(conn.sent.at(-1).keys.action,true);
mobile.padButtons.action.fire('pointerup');
mobile.padButtons.alt.fire('pointerdown');
assert.equal(conn.sent.at(-1).keys.alt,true);
mobile.padButtons.alt.fire('pointerup');
const stick=mobile.elements.get('joystickBase');
stick.fire('pointerdown',{pointerId:11,clientX:200,clientY:100});
assert.ok(conn.sent.at(-1).keys.axisX>.99,'full right analog');
stick.fire('pointermove',{pointerId:11,clientX:100,clientY:50});
assert.ok(conn.sent.at(-1).keys.axisY<-.8,'up analog');
stick.fire('pointerup',{pointerId:11});
assert.equal(conn.sent.at(-1).keys.axisX,0);
assert.equal(conn.sent.at(-1).keys.axisY,0);
conn.fire('data',{t:'roster',phase:'lobby',mode:'tanks',players:[]});
assert.equal(mobile.elements.get('buttonALabel').textContent,'FIRE');
assert.equal(mobile.elements.get('buttonBLabel').textContent,'DODGE');
// Exercise all top-down mini-games through countdown and active simulation.
for(const mode of ['tanks','soccer','rally','paint']){
  const test=setup();
  test.click('addLocalBtn');test.click('addLocalBtn');
  test.clickCard(mode);
  assert.equal(test.elements.get('mode').value,mode,'card sets game selector');
  assert.equal(test.cards.find(c=>c.dataset.game===mode).classList.contains('selected'),true);
  test.click('startBtn');
  for(let i=0;i<270;i++)test.step(i*16.667);
  assert.equal(test.elements.get('gameMode').textContent,{
    tanks:'TANK BLAST',soccer:'FOOTBALL',rally:'MICRO RALLY',paint:'COLOR CLASH'}[mode]);
  assert.equal(test.elements.get('game').classList.contains('hidden'),false);
}
// Tourney should start a random one of seven games and use round transitions.
const tour=setup();
tour.click('addLocalBtn');tour.click('addLocalBtn');
tour.elements.get('sessionMode').value='tournament';
tour.click('startBtn');
assert.match(tour.elements.get('gameMode').textContent,/STAR RUSH|BRAWL ARENA|LAVA RUN|TANK BLAST|FOOTBALL|MICRO RALLY|COLOR CLASH/);
for(let i=0;i<1660;i++)tour.step(i*45);
assert.equal(tour.elements.get('results').classList.contains('hidden'),false);
assert.match(tour.elements.get('replayBtn').textContent,/เกมถัดไป/);
tour.click('replayBtn');
assert.equal(tour.elements.get('results').classList.contains('hidden'),true);
// Finish tournament and verify the overall podium exists.
for(let roundIndex=1;roundIndex<5;roundIndex++){
  for(let i=0;i<1660;i++)tour.step(i*45);
  assert.equal(tour.elements.get('results').classList.contains('hidden'),false);
  if(roundIndex<4)tour.click('replayBtn');
}
assert.match(tour.elements.get('resultList').children[0].textContent,/แชมป์ทัวร์นาเมนต์/);
assert.equal(tour.elements.get('replayBtn').textContent,'เริ่มทัวร์นาเมนต์ใหม่');
// Disconnect must exit landscape mode and clear the analog stick.
conn.fire('close');
assert.equal(mobile.scope.document.body.classList.contains('controller-playing'),false);
assert.equal(mobile.scope.document.body.classList.contains('zoom-locked'),false);
assert.doesNotMatch(mobile.elements.get('viewportMeta').content,/user-scalable=no/);
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
console.log('SMOKE PASS: scoped zoom guard, 7 game cards, A/B joystick, mini-games, tournament and QR controller');
