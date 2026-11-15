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
assert.ok(!sleigh.includes('M24 3 29 19'), 'the active bomber SVG is no longer an aircraft');
const fallbackOps = [];
const fallbackCanvas = new Proxy({}, { get(_target, key) {
  if (key === 'drawImage') return () => { throw new Error('fallback must not wait for an image'); };
  if (['save','restore','translate','scale','beginPath','moveTo','lineTo','quadraticCurveTo','bezierCurveTo','closePath','fill','stroke','ellipse','arc','rect'].includes(key))
    return (...args) => fallbackOps.push(String(key));
  return undefined;
}, set() { return true; } });
assert.equal(art.draw(fallbackCanvas, 'bomber', 24, 24, 48), true,
  'Santa Sleigh remains visible before the SVG image is decoded');
assert.ok(fallbackOps.includes('fill') && fallbackOps.includes('stroke'),
  'the immediate fallback draws the Santa Sleigh artwork');
console.log('PASS: six item icons render; Santa sleigh and Rudolph artwork verified');
