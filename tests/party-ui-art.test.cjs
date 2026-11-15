'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({ window: {}, console });
const source = fs.readFileSync('party-ui-art.js', 'utf8');
vm.runInContext(source, context, { filename: 'party-ui-art.js' });

const art = context.window.PartyUiArt;
assert.equal(typeof art.svg, 'function');
for (const id of ['potion', 'ufo', 'rocket', 'bomber', 'car', 'shield']) {
  const svg = art.svg(id);
  assert.ok(svg.startsWith('<svg '), id + ' starts with an SVG root');
  assert.ok(svg.endsWith('</svg>'), id + ' closes its SVG root');
}
const sleigh = art.svg('bomber');
assert.ok(sleigh.length > 2500, 'Santa sleigh and reindeer artwork is present');
assert.ok(sleigh.includes('#ff4d4d'), 'Rudolph has a red nose highlight');
assert.ok(sleigh.includes('gf-crimson'), 'sleigh uses the holiday palette');
console.log('PASS: six item icons render; Santa sleigh and Rudolph artwork verified');
