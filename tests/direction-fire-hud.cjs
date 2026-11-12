'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=path=>fs.readFileSync(path,'utf8');
const cowboy=read('src/games/cowboy-crossfire/crossfire.js');
const cannon=read('src/games/cannon-chaos/cannon-chaos.js');
const count=read('src/games/countdown-drop/countdown-drop.js');
const shared=read('src/app/rounds/render.js');
function between(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,'cannot find original game logic: '+start);
 return source.slice(a,b);
}
const controls={control(k){
 const x=Number.isFinite(k.axisX)?k.axisX:Number(!!k.right)-Number(!!k.left);
 const y=Number.isFinite(k.axisY)?k.axisY:Number(!!k.down)-Number(!!k.jump);
 return {x,y,action:!!k.action,alt:!!k.alt};
}};
const cowboyEnv=vm.createContext({window:{PartyCharacters:controls},Math});
vm.runInContext(between(cowboy,'function heldFire(p){','// Single entry point')+
 '\nthis.heldFire=heldFire;',cowboyEnv);
const cannonEnv=vm.createContext({PartyCharacters:controls,Math});
vm.runInContext(between(cannon,'const BTN=','/* ------------------------------ firing ------------------------------ */')+
 '\nthis.readFire=readFire;this.sampleInput=sampleInput;',cannonEnv);
const directionInputs=[
 {axisX:1},{axisX:-.5},{axisY:1},{axisY:-.7},
 {left:true},{right:true},{up:true},{down:true},{jump:true}
];
for(const input of directionInputs){
 assert.equal(cowboyEnv.heldFire({input}),true,'cowboy direction should shoot: '+JSON.stringify(input));
 assert.equal(cannonEnv.readFire({input}),true,'cannon direction should shoot: '+JSON.stringify(input));
}
for(const input of [{action:true},{alt:true},{A:true},{B:true},{C:true}]){
 assert.equal(cowboyEnv.heldFire({input}),true,'original cowboy fire buttons retained');
 assert.equal(cannonEnv.readFire({input}),true,'original cannon fire buttons retained');
}
for(const input of [{},{axisX:.05,axisY:.04},{pause:true},{cancel:true}]){
 assert.equal(cowboyEnv.heldFire({input}),false,'cowboy must ignore idle/system');
 assert.equal(cannonEnv.readFire({input}),false,'cannon must ignore idle/system');
}
assert.equal(cannonEnv.readFire({isBot:true,input:{axisX:1}}),false,'bot aim remains AI owned');
const p={input:{axisX:1},isBot:false,cn:{alive:true,prevPress:false,req:false}};
const round={phase:'playing',paused:false},state={finished:false};
cannonEnv.sampleInput(state,round,[p]);
assert.equal(p.cn.req,true,'fresh joystick movement requests one shot');
p.cn.req=false;
cannonEnv.sampleInput(state,round,[p]);
assert.equal(p.cn.req,false,'holding direction cannot auto-fire repeatedly');
p.input={axisX:0};cannonEnv.sampleInput(state,round,[p]);
p.input={axisY:-1};cannonEnv.sampleInput(state,round,[p]);
assert.equal(p.cn.req,true,'release and press another direction fires again');
assert.match(cowboy,/if\(held&&!c\.held\)c\.pendingFire=true;c\.held=held/,
 'cowboy retains one-shot-per-rising-edge guard');
const hudEnv=vm.createContext({});
vm.runInContext(between(shared,'function hostClockValue(r,engine){','function drawGame(t){')+
 '\nthis.hostClockValue=hostClockValue;',hudEnv);
assert.equal(hudEnv.hostClockValue({mode:'countdown_drop',phase:'playing',remaining:null},{}),null,
 'unlimited multiplayer round uses the shared survivors HUD');
assert.equal(hudEnv.hostClockValue({mode:'countdown_drop',phase:'playing',remaining:21},{}),21,
 'solo mode keeps its real finite clock');
assert.equal(hudEnv.hostClockValue({mode:'countdown_drop',phase:'countdown',countdown:2},{}),2);
assert.match(shared,/PartyArenaScenes\?\.playerCount\?\.\(g,survivors\)/,
 'shared survivor HUD is used when time is absent');
assert.doesNotMatch(count,/round\.remaining\s*=\s*9999/,'never manufacture an unlimited timer');
assert.match(count,/round\.remaining=s\.solo\?C\.soloSeconds:null/);
console.log('DIRECTION FIRE & SHARED HUD PASS: joystick, D-pad, buttons, edge latch and unlimited rounds');
