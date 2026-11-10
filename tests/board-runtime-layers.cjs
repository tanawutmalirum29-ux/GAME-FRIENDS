'use strict';
// The 213-node literal is the authored base, not the deployed V10 graph.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
require('../scripts/build-board-assets.cjs');
const html=fs.readFileSync('index.html','utf8');
const lazy=fs.readFileSync('src/platform/board-runtime.js','utf8');
const build=fs.readFileSync('scripts/build-static.cjs','utf8');
const files=['src/board-party/runtime/board-map.js','src/board-party/runtime/board-design.js','src/board-party/runtime/board-scenery.js',
 'src/board-party/runtime/board-branch-naming.js','src/board-party/runtime/board-layout.js','src/board-party/runtime/board-dice.js',
 'src/board-party/runtime/board-dice-renderer.js','src/board-party/runtime/board-items.js','src/board-party/runtime/board-bots.js',
 'src/board-party/runtime/board-minigame.js','src/board-party/runtime/board-party.js','src/board-party/runtime/board-art.js'];
function checkOrder(content,pattern){
 let last=-1;
 for(const file of files){
  const pos=content.indexOf(pattern(file),last+1);
  assert.ok(pos>last,'missing or out-of-order BOARD runtime asset: '+file);
  last=pos;
 }
}
checkOrder(html,file=>'src="./'+file+'"');
checkOrder(lazy,file=>'"'+file+'"');
assert.match(build,/require\('\.\/build-board-assets\.cjs'\)/,
 'production build must restore generated BOARD assets');
const ctx=vm.createContext({window:{},Math,Date,console});
vm.runInContext(fs.readFileSync('src/board-party/runtime/board-map.js','utf8'),ctx,{filename:'src/board-party/runtime/board-map.js'});
const base=ctx.window.BoardMap.create(0);
assert.equal(base.id,'winter-expedition');
assert.equal(Object.keys(base.nodes).length,213);
assert.equal(base.islands.length,9);
for(const file of ['src/board-party/runtime/board-design.js','src/board-party/runtime/board-scenery.js',
 'src/board-party/runtime/board-branch-naming.js','src/board-party/runtime/board-layout.js'])
 vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
const active=ctx.window.BoardMap.create(0);
assert.equal(active.id,'winter-expedition');
assert.equal(Object.keys(active.nodes).length,302);
assert.equal(active.islands.length,17);
assert.equal(ctx.window.BoardMap.validate(active),true);
assert.equal(typeof ctx.window.BOARD_SCENERY.render,'function');
console.log('BOARD RUNTIME LAYERS PASS: 213/9 authored base -> 302/17 active V10; entrypoint, lazy loader, build assets');
