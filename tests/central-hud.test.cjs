'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = name => fs.readFileSync(new URL('../'+name, 'file://' + __filename), 'utf8');

const engines = [
 'app.js','party-arena-scenes.js','src/games/chickens/chickens.js','src/games/ghost-attack/ghost-attack.js',
 'src/games/fruit-memory/fruit-memory.js','src/games/shockwave/shockwave.js','src/games/boulder-bash/boulder-bash.js','src/games/snow-brawl/snow-brawl.js',
 'src/games/shopping-time/shopping-time.js','src/games/pizza-time/pizza-time.js','src/games/knight-match/knight-match.js','src/games/lawn-mower/lawn-mower.js',
 'src/games/color-switch/color-switch.js','src/games/witching-snake/witching-snake.js'
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
  ['fruit_memory','playing',null,null,'person'],['fruit_memory','playing',5,null,'person'],
   ['fruit_memory','countdown',null,3,'clock'],
   ['fruit_memory','countdown',null,2,'clock'],
   ['fruit_memory','countdown',null,1,'clock'],
  ['boulder_bash','playing',null,null,'person'],['boulder_bash','playing',35,null,'clock'],
  ['snow_brawl','playing',null,null,'person'],['snow_brawl','playing',42,null,'clock'],
  ['witching_snake','playing',null,null,'person'],['witching_snake','playing',18,null,'clock'],
  ['chickens','playing',32,null,'clock'],['color_switch','playing',25,null,'clock'],
  ['shopping_time','playing',18,null,'clock'],['pizza_time','playing',20,null,'clock'],
  ['knight_match','playing',12,null,'clock'],['lawn_mower','playing',11,null,'clock'],
  ['board','playing',null,null,'none'],
  ['new_game','countdown',null,2,'person'],
  ['new_game','playing',25,null,'person']
 ];
 for(const [mode,phase,remaining,countdown,expected] of cases){
  const calls=[];
  const window={PartyArenaScenes:{
   clock:(_g,v)=>calls.push(['clock',v]),
   playerCount:(_g,n)=>calls.push(['person',n])
  }};
  const round={mode,phase,remaining,countdown};
  runner(window,()=>({
   draw(){},hud(){return {survivors:6}},
   hudBadge:mode==='shockwave'||mode==='new_game'?
    {duringCountdown:'players',duringPlay:'players'}:
    mode==='fruit_memory'?{duringCountdown:'clock',duringPlay:'players'}:undefined
  }),()=>{},{},[],round,0);
  if(expected==='none')assert.equal(calls.length,0,mode);
  else{
   assert.equal(calls.length,1,mode+' displays exactly one badge');
   assert.equal(calls[0][0],expected,mode+' badge mode');
   if(expected==='person')assert.equal(calls[0][1],6,mode+' survivor total');
  }
 }
});

test('shared start countdown advances Fruit Memory movement before memorization', () => {
 const app=read('app.js');
 const start=app.indexOf('function updateRound(dt)');
 const end=app.indexOf('// Result decisions are host-authoritative.',start);
 assert.ok(start>=0&&end>start,'host round update dispatcher exists');
 const runner=new Function('window','round','players','dt','$','broadcastRoster',
   'updateBoard','gameEngine','endRound',app.slice(start,end)+'\nupdateRound(dt);');
 const updates=[],signals=[],banner={textContent:''};
 const window={FruitMemory:{update(dt){updates.push(dt);}}};
 const round={mode:'fruit_memory',phase:'countdown',paused:false,countdown:3,
  pluginEngine:{updateDuringCountdown:true,update(dt){updates.push(dt);}}};
 const go=dt=>runner(window,round,[],dt,()=>banner,()=>signals.push('playing'),
   ()=>{},()=>({update(){return null;}}),()=>{});
 go(1);
 assert.equal(round.countdown,2);
 assert.equal(round.phase,'countdown');
 assert.equal(updates.length,1,'Fruit Memory prestart movement updates through the host');
 go(1);
 assert.equal(round.countdown,1);
 assert.equal(updates.length,2);
 go(1);
 assert.equal(round.countdown,0);
 assert.equal(round.phase,'playing','the host owns the three-second transition');
 assert.equal(updates.length,3,'movement also updates during the last countdown second');
 assert.equal(signals.length,1);
 round.paused=true;go(1);
 assert.equal(updates.length,3,'pause must block prestart motion');
});

test('clock and SVG count share the same safe screen position', () => {
 const scenes=read('party-arena-scenes.js');
 assert.match(scenes,/HUD_BADGE_MIN_DROP=0/);
 assert.match(scenes,/HUD_BADGE_ROSTER_GAP_PX=4/);
 assert.match(scenes,/function hudBadgeDrop\(\)/);
 assert.match(scenes,/function clock\(g,value[^]*?g\.translate\(0,hudBadgeDrop\(\)\)/);
 assert.match(scenes,/function playerCount\(g,value\)[^]*?g\.translate\(0,hudBadgeDrop\(\)\)/);
 assert.match(scenes,/personIconSVG=\(\)=>svg\(24,24/);
 assert.doesNotMatch(scenes,/function bareCount\(/,'avoid number-only Fruit Memory renderer');
 assert.match(scenes,/const icon=imageFor\('hud:player-count',personIconSVG\)/,
  'shared survivor HUD renders the cached person SVG');
});

test('no duplicate mode-level clocks or top-left information banners', () => {
 for(const name of ['src/games/shopping-time/shopping-time.js','src/games/pizza-time/pizza-time.js','src/games/knight-match/knight-match.js','src/games/witching-snake/witching-snake.js'])
  assert.doesNotMatch(read(name),/PartyArenaScenes\.clock\(|art\.clock\(|art\.drawClock\(/,name);
 const forbidden={
  'src/games/chickens/chickens.js': /ctx\.fillText\('CHICKENS'/,
  'src/games/ghost-attack/ghost-attack.js': /drawCornerHud\(|id:'HUD-00'/,
  'src/games/shockwave/shockwave.js': /ctx\.fillText\('SHOCKWAVE'/,
  'src/games/boulder-bash/boulder-bash.js': /g\.fillText\('BOULDER BASH'/,
  'src/games/snow-brawl/snow-brawl.js': /ctx\.fillText\('SNOW BRAWL'/,
  'src/games/lawn-mower/lawn-mower.js': /ctx\.fillText\('LAWN MOWER'/,
  'src/games/color-switch/color-switch.js': /ctx\.fillText\('COLOR SWITCH'/,
  'src/games/fruit-memory/fruit-memory.js': /label\('FRUIT MEMORY'/
 };
 for(const [name,re] of Object.entries(forbidden))assert.doesNotMatch(read(name),re,name);
 assert.match(read('src/games/fruit-memory/fruit-memory.js'),/function drawSideScreens\(ctx,state,round\)/,
  'Fruit Memory uses mirrored SVG side screens');
 assert.match(read('app.js'),/r\.mode==='fruit_memory'/,
  'Fruit Memory has a shared host countdown, not a memorize timer');
 assert.doesNotMatch(read('app.js'),/drawTargetFruits/,
  'old three-fruit HUD is removed');
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
