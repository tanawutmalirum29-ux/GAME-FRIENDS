'use strict';
// Guard the source-ownership contract: adding/updating a game must not put game
// rules back in the repository root or depend on a different game's source.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {build}=require('../scripts/build-game-catalog.cjs');
const gamesRoot=path.join(root,'src','games');
const catalog=build();
let owned=0;
for(const game of catalog.games){
 const slug=fs.readdirSync(gamesRoot).find(folder=>{
  const file=path.join(gamesRoot,folder,'manifest.json');
  return fs.existsSync(file)&&JSON.parse(fs.readFileSync(file,'utf8')).id===game.id;
 });
 assert.ok(slug,'Manifest must exist for '+game.id);
 const manifest=JSON.parse(fs.readFileSync(path.join(gamesRoot,slug,'manifest.json'),'utf8'));
 const legacy=manifest.legacyScripts||[];
 if(manifest.global){
  assert.ok(legacy.length,'Global engine requires a source list: '+slug);
  const own=legacy.filter(asset=>asset.startsWith('src/games/'+slug+'/'));
  assert.ok(own.length,'Engine must own its actual game source: '+slug);
  for(const asset of own){
   const full=path.join(root,asset);
   assert.ok(fs.statSync(full).isFile()&&fs.statSync(full).size>200,
    'The local gameplay engine cannot be a stub: '+asset);
   assert.ok(!fs.existsSync(path.join(root,path.basename(asset))),
    'Duplicate root source is forbidden: '+asset);
  }
  owned++;
 }else{
  assert.ok(fs.statSync(path.join(gamesRoot,slug,manifest.entry.slice(2))).size>200,
   'ES module entry must provide an actual game implementation: '+slug);
 }
}
assert.equal(owned,15,'All 15 legacy-backed games must own their logic now');
console.log('GAME SOURCE OWNERSHIP PASS: '+owned+' locally owned engines; root duplicates forbidden');
