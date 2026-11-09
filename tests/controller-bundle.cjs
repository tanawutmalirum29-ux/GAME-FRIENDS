'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const build=require('../scripts/build-app.cjs');
const itemBuild=require('../scripts/build-board-item-brief.cjs');
const outcome=build.assemble();
assert.ok(outcome.controllerBytes<outcome.bytes-15000,
 'controller bundle must exclude substantial host authority code');
itemBuild.build();
const defaults=vm.runInNewContext(
 fs.readFileSync(path.join(root,'src/app/core/legacy-game-defaults.js'),'utf8')+
 '\nLEGACY_GAME_DATA',{}
);
assert.deepEqual(Object.keys(defaults),[
 'ghost','chickens','fruit_memory','shockwave','color_switch','pizza_time',
 'knight_match','boulder_bash','snow_brawl','shopping_time','witching_snake',
 'lawn_mower','color_claim','ice_race','gladiators'
],'Migrating to generated metadata must preserve the original picker order');
assert.equal(defaults.ghost.controller.labels.A,'ตีสตั้น');
assert.equal(defaults.shockwave.controller.status,'SHOCKWAVE • รอด {survivors} คน');
const coreSource=fs.readFileSync(path.join(root,'src/app/core/runtime.js'),'utf8');
assert.doesNotMatch(coreSource,/const MODES\s*=\s*\{ghost:/,
 'core cannot own a hardcoded list of games');
assert.match(coreSource,/Object\.entries\(LEGACY_GAME_DATA\)/);
const controllerSource=fs.readFileSync(path.join(root,'src/app/controller/connection.js'),'utf8');
assert.doesNotMatch(controllerSource,/mode==='color_claim'\?'ลากเส้น/,
 'game-specific help should come from manifests');
const host=fs.readFileSync(path.join(root,'app.js'),'utf8');
const controller=fs.readFileSync(path.join(root,'app-controller.js'),'utf8');
assert.ok(host.includes('function startRound('));
assert.ok(host.includes('function endPluginRound('));
assert.ok(!controller.includes('function startRound('),
 'host physics cannot be sent with controller runtime');
assert.ok(!controller.includes('function endPluginRound('),
 'host-only results cannot be sent with controller runtime');
assert.ok(controller.includes('function receiveBoardState('),
 'controller BOARD state must survive code splitting');
assert.ok(controller.includes('function joinRoom('));
const original={window:{}},small={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'board-items.js'),'utf8'),original);
vm.runInNewContext(fs.readFileSync(path.join(root,'src/platform/board-items-brief.js'),'utf8'),small);
assert.deepEqual(Array.from(small.window.PartyBoardItemMeta.ids),
 Array.from(original.window.BoardItems.ids));
for(const id of original.window.BoardItems.ids){
 assert.equal(small.window.PartyBoardItemMeta.names[id],original.window.BoardItems.names[id]);
}
assert.ok(controller.includes('window.BoardItems||window.PartyBoardItemMeta'));

const sourceController=fs.readFileSync(path.join(root,'src/app/controller/connection.js'),'utf8');
const first=sourceController.indexOf('function gameControllerDescriptor(');
const last=sourceController.indexOf('function renderPhoneLawnStatus(',first);
assert.ok(first>=0&&last>first,'native controller plug-in metadata functions exist');
const elements=new Map();
function element(id){
 if(!elements.has(id))elements.set(id,{
  disabled:false,textContent:'',title:'',
  style:{removeProperty(){},setProperty(){}},
  classList:{toggle(){},remove(){},contains(){return false;}},
  setAttribute(name,value){this[name]=value;}
 });
 return elements.get(id);
}
const candidate={id:'meteor_dash',name:'METEOR DASH',global:null,
 controls:['joystick','A','C'],
 controller:{help:'หลบอุกกาบาตด้วยจอย',labels:{A:'กระโดด',C:'เปิดโล่'},
  status:'{name} • รอด {survivors} คน • อีก {remaining} วิ'}};
const scope={window:{GamePlatform:{descriptor:id=>id==='meteor_dash'?candidate:null}},
 controllerPlayerEliminated:false,
 MODES:{meteor_dash:'METEOR DASH'},controllerReady:true,controllerPlayerActive:true,
 controllerGamePhase:'playing',controllerBoard:null,controllerLobbyVotes:{total:0},
 controllerResultVotes:{},$:element};
vm.runInNewContext(sourceController.slice(first,last)+
 '\nwindow.showNativeController=showControllerMode;window.nativeStatus=pluginControllerPlayingStatus;',scope);
scope.window.showNativeController('meteor_dash');
assert.equal(element('buttonALabel').textContent,'กระโดด');
assert.equal(element('buttonB').disabled,true,'unlisted action B is disabled');
assert.equal(element('buttonC').disabled,false,'C uses the new game manifest');
assert.equal(element('buttonCLabel').textContent,'เปิดโล่');
assert.equal(element('controllerHelp').textContent,'หลบอุกกาบาตด้วยจอย');
assert.equal(scope.window.nativeStatus('meteor_dash',{survivors:6,remaining:12.2}),
 'METEOR DASH • รอด 6 คน • อีก 13 วิ');

console.log('CONTROLLER BUNDLE PASS: role-specific runtime, no Host round authority bundled, canonical BOARD metadata');
