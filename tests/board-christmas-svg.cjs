'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('party-ui-art.js','utf8');
const ctx=vm.createContext({window:{},console});
vm.runInContext(source,ctx,{filename:'party-ui-art.js'});
const art=ctx.window.PartyUiArt;
const kinds=['potion','ufo','rocket','bomber','car','shield'];
assert.equal(typeof art.svg,'function');
assert.ok(art.ids.length>=kinds.length);
for(const kind of kinds){
 const svg=art.svg(kind);
 assert.ok(svg.startsWith('<svg '),kind+' is a real inline SVG');
 assert.match(svg,/viewBox="0 0 48 48"/);
 assert.match(svg,/<defs>[\s\S]*?<\/defs>/);
 assert.match(svg,/<linearGradient id="gf-ice"/);
 assert.match(svg,/<linearGradient id="gf-evergreen"/);
 assert.match(svg,/<linearGradient id="gf-crimson"/);
 assert.match(svg,/<linearGradient id="gf-brass"/);
 assert.ok((svg.match(/<path\b/g)||[]).length>=5,kind+' requires layered, hand-drawn vectors');
 assert.ok((svg.match(/url\(#gf-/g)||[]).length>=3,kind+' uses multiple lit/3D facets');
 assert.ok(svg.endsWith('</svg>'));
 assert.ok(svg.length<8000,'lightweight image for phone controller '+kind);
 assert.ok(!/\p{Extended_Pictographic}/u.test(svg),'icons must be vector shapes, not platform emoji');
}
assert.equal(art.svg('nonexistent'),'','unknown assets do not cause an image fetch');
assert.match(art.svg('bag'),/<svg\b/,'non-board symbols remain supported');
const board=fs.readFileSync('src/board-party/runtime/board-art.js','utf8');
const dice=fs.readFileSync('src/board-party/runtime/board-dice-renderer.js','utf8');
assert.match(board,/window\.PartyUiArt\?\.draw\?\.\(g,kind,x,y,size\*2\.05\)/,
 'board uses the same original SVG symbols as the phone');
assert.match(board,/I\.bomberFlight\(fx\.points,s\.time-fx\.at\)/,
 'aircraft rendering follows the rule-owned flight timeline');
assert.match(board,/shot\.phase==='falling'/);
assert.match(board,/shot\.phase==='exploding'/);
assert.match(board,/icon\(g,'bomber',0,0,62\)/,'aircraft is visibly larger than the previous 34 size');
assert.match(dice,/face\.value%2\?'#ac4052':'#28735f'/,
 'ivory 3D dice have alternating Christmas red and evergreen trim');
assert.match(dice,/engraved snowflake/);
console.log('CHRISTMAS SVG PASS: six layered festive symbols, mobile asset parity, large aircraft + projected dice trim');
