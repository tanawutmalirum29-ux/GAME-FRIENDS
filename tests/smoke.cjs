'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('app.js','utf8');
const miniSource=fs.readFileSync('minigames.js','utf8');
const html=fs.readFileSync('index.html','utf8');

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
      setAttribute(){},select(){},scrollIntoView(){},setPointerCapture(){},matches(){return false;},
      getContext(){return context;},parentElement:null
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
  const document={
    getElementById(id){assert(elements.has(id),'Missing ID: '+id);return elements.get(id);},
    createElement(tag){return makeElement(tag);},
    querySelectorAll(){return [];},
    addEventListener(){},execCommand(){return true;}
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
  return {elements,instances,step(ms){assert(raf);raf(ms);},click(id){elements.get(id).fire('click');}};
}

const host=setup();
assert.equal(host.elements.get('home').classList.contains('hidden'),false);
host.click('addLocalBtn');
assert.equal(host.elements.get('rosterCount').textContent,'1/12');
host.click('offlineBtn');
assert.equal(host.elements.get('game').classList.contains('hidden'),false);
for(let i=0;i<120;i++)host.step(i*16.67);
assert.equal(host.elements.get('gameMode').textContent,'STAR RUSH');
host.click('exitBtn');
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
conn.fire('data',{t:'welcome',id:'p1',name:'ทดสอบ',color:'#ff628c'});
assert.equal(mobile.elements.get('controllerActive').classList.contains('hidden'),false);
assert.equal(mobile.elements.get('controllerName').textContent,'ทดสอบ');
// Exercise all top-down mini-games through countdown and active simulation.
for(const mode of ['tanks','soccer','rally','paint']){
  const test=setup();
  test.click('addLocalBtn');test.click('addLocalBtn');
  test.elements.get('mode').value=mode;
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
console.log('SMOKE PASS: offline, QR controller, all 4 top-down games and tournament transitions');
