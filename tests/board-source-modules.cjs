/* Verify every authored subsystem rebuilds the exact legacy runtime wrapper. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest=require('../src/board-party/modules.json');
const {assemble}=require('../scripts/build-board-party.cjs');
assert.equal(manifest.schema,1);
assert.equal(manifest.parts.length,10);
assert.equal(new Set(manifest.parts).size,10);
const assembled=assemble({check:true});
assert.equal(assembled,fs.readFileSync(path.join(root,'src/board-party/runtime/board-party.js'),'utf8'),
 'Source fragments must reproduce the exact original BOARD engine');
assert.ok(assembled.startsWith('/* Host-authoritative session state'));
assert.ok(assembled.includes('window.BoardParty=Object.freeze(api)'));
assert.ok(assembled.includes('map:M().create(seed,{players:roster.length})'),
 'The map plug-in must receive the party size to select its 1–6 or 7–12 tier');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.ok(html.includes('src="./src/board-party/runtime/board-party.js"'));
for(const file of manifest.parts)
 assert.ok(!html.includes('src="./'+file+'"'),'BOARD internal source must not be eager loaded');
console.log('BOARD SOURCE MODULES PASS: ten authored subsystems, unchanged runtime, no HTML source imports');
