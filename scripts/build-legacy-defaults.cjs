/* Derive dev-only legacy compatibility metadata from game-owned manifests.
 * Native game additions are excluded, so they do NOT change the Core hash. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.env.GAME_BUILD_ROOT||path.join(__dirname,'..'));
const folder=path.join(root,'src/games');
const target=path.join(root,'src/app/core/legacy-game-defaults.js');
function generated(){
 const values={};
 const legacyOrder=["ghost","chickens","fruit_memory","shockwave","color_switch","pizza_time","knight_match","boulder_bash","snow_brawl","shopping_time","witching_snake","lawn_mower","color_claim","ice_race","gladiators"];
 for(const slug of fs.readdirSync(folder,{withFileTypes:true})
   .filter(x=>x.isDirectory()).map(x=>x.name).sort()){
  const pathToManifest=path.join(folder,slug,'manifest.json');
  if(!fs.existsSync(pathToManifest))throw Error('Missing manifest: '+slug);
  const meta=JSON.parse(fs.readFileSync(pathToManifest,'utf8'));
  if(!meta.global||!legacyOrder.includes(meta.id))continue;
  assert.ok(/^[a-z][a-z0-9_]*$/.test(meta.id),'Invalid legacy game ID: '+slug);
  assert.ok(!Object.hasOwn(values,meta.id),'Duplicate legacy ID: '+meta.id);
  values[meta.id]={name:meta.name,global:meta.global,
   controls:meta.controls,controller:meta.controller||null};
 }

 const sequence=Object.fromEntries(Object.entries(values).sort(([a],[b])=>{
  const rank=id=>{const i=legacyOrder.indexOf(id);return i<0?legacyOrder.length:i;};
  return rank(a)-rank(b)||a.localeCompare(b);
 }));
 return '/* Generated legacy game metadata from game manifests. Do not edit. */\n'+
  'const LEGACY_GAME_DATA=Object.freeze('+JSON.stringify(sequence,null,2)+');\n';
}
function buildLegacyDefaults({write=false}={}){
 const content=generated();
 if(write){
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,content);
 }else{
  assert.equal(fs.readFileSync(target,'utf8'),content,
   'Legacy metadata is stale: node scripts/build-legacy-defaults.cjs --write');
 }
 return content;
}
if(require.main===module){
 const arg=process.argv[2];if(arg&&arg!=='--check'&&arg!=='--write')throw Error('Usage: node scripts/build-legacy-defaults.cjs [--check|--write]');
 buildLegacyDefaults({write:arg==='--write'});
 console.log('Game-owned legacy controller metadata verified');
}
module.exports={buildLegacyDefaults,generated};
