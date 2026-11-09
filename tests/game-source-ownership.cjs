'use strict';
// A versioned game entry must own and import its source, not rely on Root
// gameplay scripts or duplicate source files in immutable "legacy" bundles.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const gamesRoot=path.join(root,'src','games');
const {build}=require('../scripts/build-game-catalog.cjs');
const catalog=build();
let imported=0;
for(const slug of fs.readdirSync(gamesRoot).filter(x=>
 fs.statSync(path.join(gamesRoot,x)).isDirectory())){
 const file=path.join(gamesRoot,slug,'manifest.json');
 const meta=JSON.parse(fs.readFileSync(file,'utf8'));
 const descriptor=catalog.games.find(game=>game.id===meta.id);
 assert.ok(descriptor,'Catalog must discover '+slug);
 const entry=path.join(gamesRoot,slug,meta.entry.slice(2));
 const code=fs.readFileSync(entry,'utf8');
 const imports=[...code.matchAll(/^\s*import\s+['"]\.\/([^'"]+\.js)['"];?\s*$/gm)].map(x=>x[1]);
 if(meta.global){
  assert.ok(imports.includes(slug+'.js'),
   'ES module must import its own gameplay engine: '+slug);
  for(const local of imports){
   const source=path.join(gamesRoot,slug,local);
   assert.ok(fs.statSync(source).size>200,'Imported engine/art cannot be a stub: '+source);
   assert.ok(!fs.existsSync(path.join(root,local)),
    'Duplicate Root minigame source forbidden: '+local);
  }
  assert.ok(!(meta.legacyScripts||[]).some(x=>x.startsWith('src/games/'+slug+'/')),
   'Game-owned imports must not also be copied as legacy dependencies: '+slug);
  imported++;
 }else{
  assert.ok(code.length>200&&/export\s+default/.test(code),
   'Native plug-in must supply a real ES module entry: '+slug);
 }
}
assert.equal(imported,15,'Expected all 15 existing minigames to own their imports');
console.log('GAME SOURCE OWNERSHIP PASS: '+imported+' independently imported local game sources');
