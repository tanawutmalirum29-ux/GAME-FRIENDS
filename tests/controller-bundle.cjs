'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const build=require('../scripts/build-app.cjs');
const itemBuild=require('../scripts/build-board-item-brief.cjs');
const outcome=build.assemble();
assert.ok(outcome.controllerBytes<outcome.bytes-15000,
 'controller bundle must exclude substantial host authority code');
itemBuild.build();
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
console.log('CONTROLLER BUNDLE PASS: role-specific runtime, no Host round authority bundled, canonical BOARD metadata');
