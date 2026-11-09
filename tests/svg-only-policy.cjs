'use strict';
// Run: node tests/svg-only-policy.cjs
// Visual icons in GAME-FRIENDS must be original SVG markup (not emoji fonts).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const files=['index.html','app.js','style.css','src/games/ghost-attack/ghost-attack.js','src/games/chickens/chickens.js',
 'src/games/fruit-memory/fruit-memory.js','src/games/shockwave/shockwave.js','src/games/color-switch/color-switch.js','src/games/color-switch/color-switch-mayan.js',
 'src/shared/farm-ice-art.js','party-arena-scenes.js','game-cover-art.js','src/games/pizza-time/pizza-time.js','src/games/pizza-time/pizza-kitchen-art.js','src/games/pizza-time/pizza-ingredient-art.js','party-ui-art.js','board-art.js','board-party.js','board-items.js'];
const emoji=/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
for(const name of files){
 const body=fs.readFileSync(path.join(root,name),'utf8');
 const matches=[...body.matchAll(emoji)];
 assert.equal(matches.length,0, name+' contains emoji-capable Unicode symbols: '+
   matches.slice(0,8).map(m=>m[0]).join(' '));
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const assets=fs.readFileSync(path.join(root,'scripts/build-static.cjs'),'utf8');
const scripts=[...html.matchAll(/<script[^>]*src="(\.\/[^"]+)"/g)].map(m=>m[1].replace('./',''));
for(const name of ['party-arena-scenes.js','party-ui-art.js','app.js'])
 assert.ok(scripts.includes(name),'shared shell dependency must remain: '+name);
assert.doesNotMatch(html,/src="\.\/src\/games\//,
 'all game-specific JS and art are deferred to the per-folder registry');
assert.doesNotMatch(html,/src="\.\/game-cover-art\.js"/,
 'the shared legacy cover renderer is not boot-time production code');
assert.match(assets,/const deployAsset=/,'build validates links without a game allowlist');
const meta=JSON.parse(fs.readFileSync(path.join(root,'src/games/pizza-time/manifest.json'),'utf8'));
assert.deepEqual(meta.modes,['normal','board']);
const entry=fs.readFileSync(path.join(root,'src/games/pizza-time/game.js'),'utf8');
for(const filename of ['pizza-ingredient-art.js','pizza-kitchen-art.js','pizza-time.js'])
 assert.ok(entry.includes("import './"+filename+"'"),'Pizza engine must import its own SVG art: '+filename);
assert.ok(entry.indexOf("import './pizza-ingredient-art.js'")<entry.indexOf("import './pizza-time.js'"));
assert.ok(entry.indexOf("import './pizza-kitchen-art.js'")<entry.indexOf("import './pizza-time.js'"));
const vm=require('node:vm');
const context=vm.createContext({window:{}});
for(const name of ['party-ui-art.js','src/games/pizza-time/pizza-ingredient-art.js'])
 vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});
const art=context.window.PizzaIngredientArt;
assert.equal(art.ids.length,10);
for(const id of art.ids) {
 const svg=art.svg(id);
 assert.match(svg,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*viewBox="0 0 48 48"/);
 assert.match(svg,/<\/svg>$/);
 assert.equal(art.svg(id,{done:true}).includes('path'),true);
}
const icons=context.window.PartyUiArt;
for(const key of ['star','sparkle','check','bag','potion','ufo','rocket','bomber','car','shield','close']){
 assert.match(icons.svg(key),/<svg[^>]*>/,'missing original SVG board icon '+key);
 assert.doesNotMatch(icons.svg(key),/[\u{1F300}-\u{1FAFF}]/u);
}
console.log('SVG-only policy PASS: ten original pizza ingredients, UI icon set, versioned assets, no emoji glyphs');
