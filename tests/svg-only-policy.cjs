'use strict';
// Run: node tests/svg-only-policy.cjs
// Visual icons in GAME-FRIENDS must be original SVG markup (not emoji fonts).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const files=['index.html','app.js','style.css','ghost-attack.js','chickens.js',
 'fruit-memory.js','shockwave.js','color-switch.js','color-switch-mayan.js',
 'pizza-time.js','pizza-ingredient-art.js','party-ui-art.js','board-art.js','board-party.js','board-items.js'];
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
for(const name of ['party-ui-art.js','pizza-ingredient-art.js','pizza-time.js']){
 assert.ok(scripts.includes(name),'missing '+name+' script in HTML');
 assert.ok(assets.includes("'"+name+"'"),'missing build version entry '+name);
}
assert.ok(scripts.indexOf('party-ui-art.js')<scripts.indexOf('color-switch.js'));
assert.ok(scripts.indexOf('party-ui-art.js')<scripts.indexOf('shockwave.js'));
assert.ok(scripts.indexOf('pizza-ingredient-art.js')<scripts.indexOf('pizza-time.js'));
assert.ok(scripts.indexOf('pizza-time.js')<scripts.indexOf('app.js'));
const vm=require('node:vm');
const context=vm.createContext({window:{}});
for(const name of ['party-ui-art.js','pizza-ingredient-art.js'])
 vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});
const art=context.window.PizzaIngredientArt;
assert.equal(art.ids.length,8);
for(const id of art.ids) {
 const svg=art.svg(id);
 assert.match(svg,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*viewBox="0 0 48 48"/);
 assert.match(svg,/<\/svg>$/);
 assert.equal(art.svg(id,{done:true}).includes('path'),true);
}
const icons=context.window.PartyUiArt;
for(const key of ['star','sparkle','check'])assert.match(icons.svg(key),/<svg[^>]*>/);
console.log('SVG-only policy PASS: eight original pizza ingredients, UI icon set, versioned assets, no emoji glyphs');
