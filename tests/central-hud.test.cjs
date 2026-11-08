'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = name => fs.readFileSync(new URL('../'+name, 'file://' + __filename), 'utf8');

const engines = [
 'app.js','party-arena-scenes.js','chickens.js','ghost-attack.js',
 'fruit-memory.js','shockwave.js','boulder-bash.js','snow-brawl.js',
 'shopping-time.js','pizza-time.js','knight-match.js','lawn-mower.js',
 'color-switch.js','witching-snake.js'
];

test('every changed JavaScript engine parses', () => {
 for(const name of engines)assert.doesNotThrow(() => new Function(read(name)),name);
});

test('all minigame timers are drawn by one host dispatcher', () => {
 const app=read('app.js');
 const start=app.indexOf('function hostClockValue(');
 const end=app.indexOf('function animate(ts)',start);
 assert.ok(start>=0&&end>start,'shared HUD dispatcher exists');
 const runner = new Function('window','gameEngine','syncArenaResolution','g','players','round','t',app.slice(start,end)+'\ndrawGame(t);');
 const cases=[
  ['ghost','countdown',null,3,'clock'],['ghost','playing',null,0,'person'],
  ['shockwave','countdown',null,2,'person'],['shockwave','playing',2,null,'person'],
  ['fruit_memory','playing',null,null,'person'],['fruit_memory','playing',5,null,'clock'],
  ['boulder_bash','playing',null,null,'person'],['boulder_bash','playing',35,null,'clock'],
  ['snow_brawl','playing',null,null,'person'],['snow_brawl','playing',42,null,'clock'],
  ['witching_snake','playing',null,null,'person'],['witching_snake','playing',18,null,'clock'],
  ['chickens','playing',32,null,'clock'],['color_switch','playing',25,null,'clock'],
  ['shopping_time','playing',18,null,'clock'],['pizza_time','playing',20,null,'clock'],
  ['knight_match','playing',12,null,'clock'],['lawn_mower','playing',11,null,'clock'],
  ['board','playing',null,null,'none']
 ];
 for(const [mode,phase,remaining,countdown,expected] of cases){
  const calls=[];
  const window={PartyArenaScenes:{
   clock:(_g,v)=>calls.push(['clock',v]),
   playerCount:(_g,n)=>calls.push(['person',n])
  }};
  const round={mode,phase,remaining,countdown};
  runner(window,()=>({draw(){},hud(){return {survivors:6}}}),()=>{},{},[],round,0);
  if(expected==='none')assert.equal(calls.length,0,mode);
  else{
   assert.equal(calls.length,1,mode+' displays exactly one badge');
   assert.equal(calls[0][0],expected,mode+' badge mode');
   if(expected==='person')assert.equal(calls[0][1],6,mode+' survivor total');
  }
 }
});

test('clock and SVG count share the same safe screen position', () => {
 const scenes=read('party-arena-scenes.js');
 assert.match(scenes,/HUD_BADGE_MIN_DROP=0/);
 assert.match(scenes,/HUD_BADGE_ROSTER_GAP_PX=4/);
 assert.match(scenes,/function hudBadgeDrop\(\)/);
 assert.match(scenes,/function clock\(g,value[^]*?g\.translate\(0,hudBadgeDrop\(\)\)/);
 assert.match(scenes,/function playerCount\(g,value\)[^]*?g\.translate\(0,hudBadgeDrop\(\)\)/);
 assert.match(scenes,/personIconSVG=\(\)=>svg\(24,24/);
});

test('no duplicate mode-level clocks or top-left information banners', () => {
 for(const name of ['shopping-time.js','pizza-time.js','knight-match.js','witching-snake.js'])
  assert.doesNotMatch(read(name),/PartyArenaScenes\.clock\(|art\.clock\(|art\.drawClock\(/,name);
 const forbidden={
  'chickens.js': /ctx\.fillText\('CHICKENS'/,
  'ghost-attack.js': /drawCornerHud\(|id:'HUD-00'/,
  'shockwave.js': /ctx\.fillText\('SHOCKWAVE'/,
  'boulder-bash.js': /g\.fillText\('BOULDER BASH'/,
  'snow-brawl.js': /ctx\.fillText\('SNOW BRAWL'/,
  'lawn-mower.js': /ctx\.fillText\('LAWN MOWER'/,
  'color-switch.js': /ctx\.fillText\('COLOR SWITCH'/,
  'fruit-memory.js': /label\('FRUIT MEMORY'/
 };
 for(const [name,re] of Object.entries(forbidden))assert.doesNotMatch(read(name),re,name);
 assert.match(read('fruit-memory.js'),/ctx\.drawImage\(img,x-22,y-22,44,44\)/,
  'essential fruit target must remain visible to humans');
});

test('central badge clears actual one-row and two-row player headers', () => {
 const source=read('party-arena-scenes.js');
 const view={width:1473,height:1024,bottom:112};
 const screen={innerWidth:1473,innerHeight:1024};
 const document={
  getElementById(id){
   if(id==='arena')return {getBoundingClientRect:()=>({
    left:0,top:0,width:view.width,height:view.height
   })};
   if(id==='leaderboard')return {getBoundingClientRect:()=>({
    left:0,top:40,width:view.width,height:view.bottom-40,bottom:view.bottom
   })};
   return null;
  }
 };
 class MockImage{constructor(){this.complete=true;this.naturalWidth=24;}set src(v){this._src=v;}}
 const scene=new Function('window','document','Image',source+';return window.PartyArenaScenes;')(screen,document,MockImage);
 const offsets=[];
 const g=new Proxy({},{
  get(_target,k){if(k==='translate')return (_x,y)=>offsets.push(y);return ()=>{};},
  set(){return true;}
 });
 for(const bounds of [
  {width:1473,height:1024,bottom:112},
  {width:900,height:510,bottom:148},
  {width:780,height:438,bottom:148}
 ]){
  Object.assign(view,bounds);screen.innerWidth=bounds.width;screen.innerHeight=bounds.height;
  offsets.length=0;
  scene.clock(g,20);scene.playerCount(g,6);
  assert.equal(offsets.length,2);
  assert.equal(offsets[0],offsets[1],'both badges share exactly the same Y offset');
  const scale=Math.min(view.width/960,view.height/540);
  const contentTop=(view.height-540*scale)/2;
  const badgeTop=contentTop+(offsets[0]+5)*scale;
  assert.ok(badgeTop>=view.bottom+3,
   'badge must clear '+view.width+'px viewport player roster');
  assert.ok(badgeTop<=view.bottom+7,
   'badge should sit just below the roster, not deep inside the game arena');
 }
});

test('the iPad screenshot layout no longer leaves a large blank HUD gap', () => {
 const source=read('party-arena-scenes.js');
 const view={width:1473,height:1024,bottom:112};
 const window={innerWidth:1473,innerHeight:1024};
 const document={
  getElementById(id){
   if(id==='arena')return {getBoundingClientRect:()=>({
    left:0,top:0,width:view.width,height:view.height
   })};
   if(id==='leaderboard')return {getBoundingClientRect:()=>({
    left:165,top:40,width:1200,height:view.bottom-40,bottom:view.bottom
   })};
   return null;
  }
 };
 class MockImage{constructor(){this.complete=true;this.naturalWidth=24;}set src(v){this._src=v;}}
 const scene=new Function('window','document','Image',source+';return window.PartyArenaScenes;')(
  window,document,MockImage);
 const positions=[];
 const context=new Proxy({},{
  get(_t,k){return k==='translate'?(_x,y)=>positions.push(y):()=>{};},
  set(){return true;}
 });
 scene.clock(context,60);scene.playerCount(context,6);
 assert.equal(positions.length,2);
 assert.equal(positions[0],positions[1],'both modes use one placement');
 const scale=Math.min(view.width/960,view.height/540);
 const contentTop=(view.height-540*scale)/2;
 const screenY=contentTop+(positions[0]+5)*scale;
 assert.ok(screenY>=view.bottom+3&&screenY<=view.bottom+7,
  'badge is within 3–7 physical pixels below the player cards');
 assert.ok(positions[0]<15,
  'landscape iPad must not retain the old 45-world-unit drop');
});
