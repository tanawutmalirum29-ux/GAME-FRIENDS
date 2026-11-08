'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const builder=require('../scripts/build-game-catalog.cjs');
const catalog=builder.build();
const {pruneLegacy,pruneBoardCore,pruneExternal,pruneAppBoot,BOARD_CORE_SCRIPTS}=require('../scripts/lazy-game-scripts.cjs');
assert.equal(catalog.schema,1);
const originalHTML=fs.readFileSync(path.join(root,'index.html'),'utf8');
const lazyHTML=pruneAppBoot(pruneExternal(pruneBoardCore(pruneLegacy(originalHTML,catalog))));
assert.ok(!lazyHTML.includes('cdn.jsdelivr.net/npm/peerjs@'),'offline bootstrap never fetches PeerJS');
assert.ok(!lazyHTML.includes('cdn.jsdelivr.net/npm/qrcodejs@'),'controller bootstrap never fetches QRCode');
assert.ok(lazyHTML.includes('src="./src/platform/runtime-deps.js"'));

for(const file of BOARD_CORE_SCRIPTS)assert.ok(!lazyHTML.includes('src="./'+file+'"'),'BOARD core should be lazy: '+file);
for(const game of catalog.games){
 for(const legacy of game.legacyUrls){
  const asset=legacy.split('/legacy/')[1];
  assert.ok(!lazyHTML.includes('src="./'+asset+'"'),
   'production HTML must not eagerly download '+asset);
 }
}
assert.ok(!lazyHTML.includes('src="./app.js"'));
assert.ok(lazyHTML.includes('src="./src/platform/main-loader.js"'));
assert.ok(originalHTML.includes('src="./app.js"'),'local dev retains immediate compatibility bundle');
assert.ok(lazyHTML.includes('src="./game-cover-art.js"'));
assert.ok(lazyHTML.includes('src="./src/platform/board-runtime.js"'),
 'production loads BOARD through the deferred core runtime');
assert.equal(catalog.games.length,15,'all 15 legacy games must be automatically discovered');
assert.equal(new Set(catalog.games.map(g=>g.id)).size,15);
for(const game of catalog.games){
 assert.match(game.hash,/^[a-f0-9]{24}$/);
 assert.ok(game.entryUrl.endsWith('/game.js'));
 assert.ok(game.modes.includes('board')&&game.modes.includes('normal'));
 assert.ok(game.legacyUrls.length>0,'original gameplay is retained by adapter');
}
assert.ok(!fs.existsSync(path.join(root,'game-catalog.json')),
 'catalog is generated at build time, not relied upon as a manually committed index');

function fixture(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'game-catalog-'));
 const folder=path.join(temp,'src/games/demo');
 fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(path.join(temp,'app.js'),'// core fixture\n');
 fs.writeFileSync(path.join(temp,'index.html'),'<html></html>\n');
 const manifest={id:'demo_game',name:'DEMO GAME',version:'1.0.0',apiVersion:1,enabled:true,
  players:{min:1,max:12},modes:['normal','board'],controls:['joystick'],
  entry:'./game.js',legacyScripts:[]};
 fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest));
 fs.writeFileSync(path.join(folder,'game.js'),
  'export default {setup(){},update(){},draw(){},hud(){return {survivors:1}},getResult(){return []}};');
 const run=()=>execFileSync(process.execPath,[path.join(root,'scripts/build-game-catalog.cjs'),'--write'],
  {env:{...process.env,GAME_BUILD_ROOT:temp},encoding:'utf8'});
 try{
  run();
  const first=JSON.parse(fs.readFileSync(path.join(temp,'game-catalog.json'),'utf8'));
  assert.equal(first.games.length,1);
  const source=path.join(temp,first.games[0].entryUrl.slice(1));
  assert.equal(fs.readFileSync(source,'utf8'),fs.readFileSync(path.join(folder,'game.js'),'utf8'));
  fs.appendFileSync(path.join(folder,'game.js'),'// v2\n');
  run();
  const second=JSON.parse(fs.readFileSync(path.join(temp,'game-catalog.json'),'utf8'));
  assert.notEqual(first.games[0].hash,second.games[0].hash,
   'changing game bytes creates an entirely new asset path');
  assert.ok(fs.existsSync(source),'old version stays present in this build directory');
  manifest.entry='./../escape.js';
  fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest));
  const bad=spawnSync(process.execPath,[path.join(root,'scripts/build-game-catalog.cjs'),'--check'],
   {env:{...process.env,GAME_BUILD_ROOT:temp},encoding:'utf8'});
  assert.notEqual(bad.status,0,'path traversal is rejected before release');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
fixture();

async function platform(){
 const data={schema:1,coreHash:'a'.repeat(20),games:[{
  id:'ghost',name:'GHOST ATTACK',version:'1.0.0',enabled:true,apiVersion:1,
  modes:['normal','board'],players:{min:1,max:12},controls:[],
  hash:'b'.repeat(24),global:'GhostAttack',
  entryUrl:'/game-assets/ghost/'+ 'b'.repeat(24) +'/game.js',
  legacyUrls:['/game-assets/ghost/'+ 'b'.repeat(24) +'/legacy/ghost-attack.js']
 }]};
 const moduleSource=fs.readFileSync(path.join(root,'src/platform/game-platform.js'),'utf8');
 const listeners={},window={
  GAME_CORE_VERSION:'a'.repeat(20),
  GAME_GAME_HASHES:{ghost:'b'.repeat(24)},
  GhostAttack:{setup(){},update(){},draw(){},hud(){return {survivors:1}}},
  addEventListener(type,fn){(listeners[type]??=[]).push(fn);},
  dispatchEvent(){},
 };
 const document={hidden:false,head:{appendChild(){throw Error('Adopted legacy engine should not reload scripts');}},
  addEventListener(){}};
 const ctx={window,document,location:{origin:'https://example.org',href:'https://example.org/?host=1'},
  URL,Date,CustomEvent:class{constructor(){}},setInterval(){},console,
  fetch:async()=>({ok:true,json:async()=>JSON.parse(JSON.stringify(data))})};
 vm.runInNewContext(moduleSource,ctx);
 await window.GamePlatform.initialize();
 assert.equal(window.GamePlatform.revision,1);
 assert.equal(window.GamePlatform.games().length,1);
 assert.equal(window.GamePlatform.engine('ghost'),window.GhostAttack);
 assert.equal(window.GamePlatform.ready('ghost'),true);
 assert.equal(await window.GamePlatform.ensure('ghost'),window.GhostAttack);
 data.games[0].enabled=false;
 assert.equal(await window.GamePlatform.refresh(),true);
 assert.equal(window.GamePlatform.games().length,0,'disabled manifest must disappear');
 assert.equal(await window.GamePlatform.refresh(),false,'unchanged disabled catalog does not rerender');
 data.coreHash='c'.repeat(20);
 assert.equal(await window.GamePlatform.refresh(),false,'core changes cannot hot-activate');
 assert.equal(window.GamePlatform.pendingCoreUpdate,true);
}
platform().then(()=>console.log('GAME PLATFORM PASS: 15 manifests, atomic assets, runtime core guard, legacy adapter'))
 .catch(error=>{console.error(error);process.exitCode=1;});
