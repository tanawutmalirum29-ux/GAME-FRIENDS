'use strict';
// No BOARD engine file may be kept in the repository root or booted twice.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const runtime='src/board-party/runtime/';
const scripts=[
 'board-map.js','board-v7-design.js','board-v7-art.js',
 'board-branch-naming.js','board-v7-adapter.js','board-dice.js',
 'board-dice-renderer.js','board-items.js','board-bots.js',
 'board-minigame.js','board-party.js','board-art.js'
];
const camera='board-controller-camera.js';
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const loader=fs.readFileSync(path.join(root,'src/platform/board-runtime.js'),'utf8');
const lazy=require('../scripts/lazy-game-scripts.cjs');
for(const name of [...scripts,camera]){
 assert.ok(!fs.existsSync(path.join(root,name)),
  'Duplicate BOARD script in project root: '+name);
 assert.ok(fs.statSync(path.join(root,runtime,name)).isFile(),
  'Canonical BOARD runtime missing: '+runtime+name);
 assert.ok(html.includes('src="./'+runtime+name+'"'),
  'HTML must reference canonical BOARD runtime: '+name);
}
assert.ok(!fs.existsSync(path.join(root,'board-v7-source')),
 'Old root V7 archive must not be recreated');
const v7=path.join(root,'src/board-party/legacy/v7-source');
assert.ok(fs.statSync(v7).isDirectory(),'V7 archive must live inside BOARD');
assert.equal(fs.readdirSync(v7).filter(n=>/\.deflate\.b64\.part\d+$/.test(n)).length,7);
for(const file of scripts){
 assert.ok(loader.includes('"'+runtime+file+'"'),
  'Lazy loader must use the moved BOARD entry: '+file);
 assert.ok(lazy.BOARD_CORE_SCRIPTS.has(runtime+file),
  'Production HTML pruning must recognize the moved BOARD entry: '+file);
}
const pruned=lazy.pruneBoardCore(html);
for(const file of scripts)assert.ok(!pruned.includes('src="./'+runtime+file+'"'),
 'Production must not eagerly load BOARD core: '+file);
assert.ok(pruned.includes('src="./'+runtime+camera+'"'),
 'Controller camera shim remains a single shared script');
const assembled=require('../scripts/build-board-party.cjs').assemble({check:true});
assert.equal(assembled,fs.readFileSync(path.join(root,runtime,'board-party.js'),'utf8'));
console.log('BOARD SINGLE LOCATION PASS: no root duplicates, one generated engine, archived V7, HTML and lazy loader consistent');
