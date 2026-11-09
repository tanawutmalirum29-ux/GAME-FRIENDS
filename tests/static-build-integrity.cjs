'use strict';
// Run the actual production builder in an isolated fresh checkout snapshot.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const target=fs.mkdtempSync(path.join(os.tmpdir(),'gf-static-fresh-'));
const version='f'.repeat(40);
try{
 fs.cpSync(root,target,{recursive:true,filter:source=>{
  const parts=path.relative(root,source).split(path.sep);
  return !parts.some(part=>['.git','node_modules','game-assets'].includes(part));
 }});

 // A new, unknown game is added exclusively to its own directory. Neither
 // index.html, app.js, board-minigame.js nor the build script is edited.
 // Normalize all generated Core files first; the second build must change
 // only the catalog and the unknown native game's immutable asset folder.
 for(const file of ['board-v7-design.js','board-v7-art.js','game-catalog.json'])
  fs.rmSync(path.join(target,file),{force:true});
 execFileSync(process.execPath,['scripts/build-static.cjs'],{
  cwd:target,env:{...process.env,GAME_BUILD_ROOT:target,AWS_COMMIT_ID:version},
  encoding:'utf8',stdio:['ignore','pipe','pipe']
 });
 const baseline=execFileSync(process.execPath,
  ['-e',"process.stdout.write(require('./scripts/build-game-catalog.cjs').coreHash())"],
  {cwd:target,env:{...process.env,GAME_BUILD_ROOT:target},encoding:'utf8'}).trim();
 const fixture=path.join(target,'src/games/ci-autoload');
 fs.mkdirSync(fixture,{recursive:true});
 fs.writeFileSync(path.join(fixture,'manifest.json'),JSON.stringify({
  id:'ci_autoload',name:'CI AUTOLOAD',version:'1.0.0',apiVersion:1,
  enabled:true,players:{min:1,max:12},modes:['normal','board'],
  controls:['joystick','A'],controller:{labels:{A:'Test'}},
  entry:'./game.js',legacyScripts:[]
 })+'\n');
 fs.writeFileSync(path.join(fixture,'game.js'),
  'export default {setup(){},update(){},draw(){},hud(){return {}},getResult(){return []}};\n');
 execFileSync(process.execPath,['scripts/build-static.cjs'],{
  cwd:target,env:{...process.env,GAME_BUILD_ROOT:target,AWS_COMMIT_ID:version},
  encoding:'utf8',stdio:['ignore','pipe','pipe']
 });
 const exists=file=>assert.ok(fs.statSync(path.join(target,file)).isFile(),
  'static deploy missing file: '+file);
 for(const file of ['index.html','version.json','build-version.js',
  'app.js','app-controller.js','board-v7-design.js','board-v7-art.js',
  'game-catalog.json','board-map-catalog.json','sw.js'])exists(file);
 assert.equal(JSON.parse(fs.readFileSync(path.join(target,'version.json'),'utf8')).version,version);
 const html=fs.readFileSync(path.join(target,'index.html'),'utf8');
 assert.ok(html.includes('src="./src/platform/board-runtime.js?v='+version+'"'),
  'production still loads lazy BOARD runtime');
 for(const [,ref] of html.matchAll(/\b(?:src|href)="\.\/([^"?]+)(?:\?[^"]*)?"/g)){
  const local=path.resolve(target,ref);
  assert.ok(local.startsWith(target+path.sep)&&fs.existsSync(local),
   'production HTML has missing relative dependency: '+ref);
 }
 const catalog=JSON.parse(fs.readFileSync(path.join(target,'game-catalog.json'),'utf8'));
 assert.equal(catalog.schema,1);
 const boardCatalog=JSON.parse(fs.readFileSync(path.join(target,'board-map-catalog.json'),'utf8'));
 assert.equal(boardCatalog.schema,1);
 assert.equal(boardCatalog.coreHash,catalog.coreHash);
 assert.ok(boardCatalog.maps.some(m=>m.id==='winter-expedition'&&m.kind==='legacy'));
 assert.ok(!html.includes('board-map-assets/'),'Map plug-ins must not eager load from HTML');
 assert.equal(catalog.coreHash,baseline,
  'Adding a native folder-only game must not alter the shared core fingerprint');
 const extra=catalog.games.find(game=>game.id==='ci_autoload');
 assert.ok(extra,'New folder must become a registry entry automatically');
 assert.deepEqual(extra.modes,['normal','board'],
  'Normal Party and Board Party share the same generated game catalog');
 assert.equal(extra.controller.labels.A,'Test','Controller UI metadata comes from the game folder');
 assert.ok(!html.includes('src="./src/games/'),
  'Neither game HTML imports nor hardcoded game names may appear in the bootstrap');
 assert.ok(!html.includes('ci-autoload'),'HTML must remain unaware of newly added game IDs');
 assert.ok(!html.includes('src="./game-cover-art.js'),
  'Unused global cover artwork must not be requested during bootstrap');

 assert.ok(catalog.games.length>=15,'game discovery must produce all current plug-ins');
 for(const game of catalog.games){
  assert.match(game.hash,/^[a-f0-9]{24}$/);
  for(const url of [game.entryUrl,game.coverUrl,...game.legacyUrls]){
   if(!url)continue;
   assert.ok(url.startsWith('/game-assets/'+game.id+'/'+game.hash+'/'));
   exists(url.slice(1));
  }
 }
 execFileSync(process.execPath,['scripts/build-app.cjs','--check'],{cwd:target,
  env:{...process.env,GAME_BUILD_ROOT:target},stdio:'pipe'});
 console.log('FRESH STATIC BUILD PASS: '+catalog.games.length+
  ' game manifests, all versioned plugin files, BOARD modules and HTML references');
}finally{
 fs.rmSync(target,{recursive:true,force:true});
}
