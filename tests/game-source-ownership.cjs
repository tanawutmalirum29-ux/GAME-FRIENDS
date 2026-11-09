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
 assert.equal(meta.cover,'cover.svg','Every legacy game now owns a standalone cover');
 assert.ok(descriptor.coverUrl?.endsWith('/cover.svg'),'Catalog should version each game-owned SVG');
 const svg=fs.readFileSync(path.join(gamesRoot,slug,meta.cover),'utf8');
 assert.ok(svg.startsWith('<svg')&&svg.includes('</svg>')&&svg.length>2000,'Missing original game SVG: '+slug);
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
  for(const shared of meta.legacyScripts||[])
   assert.ok(shared.startsWith('src/shared/')&&fs.existsSync(path.join(root,shared)),
    'Legacy dependencies must reference maintained shared game assets: '+slug);
  imported++;
 }else{
  assert.ok(code.length>200&&/export\s+default/.test(code),
   'Native plug-in must supply a real ES module entry: '+slug);
 }
}
assert.equal(imported,15,'Expected all 15 existing minigames to own their imports');

// Each legacy game owns its controller-state packet; generic Host dispatch may
// not accumulate per-mode branches as new plug-ins are added.
const roomCode=fs.readFileSync(path.join(root,'src/app/host/room.js'),'utf8');
const startStatus=roomCode.indexOf('function sendPlayerInventory(conn){');
const endStatus=roomCode.indexOf('function broadcastPlayerInventories(){',startStatus);
assert.ok(startStatus>=0&&endStatus>startStatus);
const statusDispatch=roomCode.slice(startStatus,endStatus);

const vm=require('node:vm');
const deliveries=[],warnings=[];
const badEngine={getControllerPacket(){throw Error('faulty update')}};
const goodEngine={getControllerPacket(){return {t:'custom-status',mode:'forged',phase:'forged',score:7}}};
let selectedEngine=badEngine;
const peer={playerId:'p1'},context={
 players:[{id:'p1',active:true}],round:{mode:'unknown_future_game'},
 gameEngine:()=>selectedEngine,networkPhase:()=> 'playing',
 send:(_,msg)=>deliveries.push(msg),
 console:{warn:(...args)=>warnings.push(args)},
 WeakSet
};
vm.createContext(context);
vm.runInContext('const failedControllerStatusEngines=new WeakSet();\n'+statusDispatch+
 '\nthis.dispatchControllerStatus=sendPlayerInventory;',context);
assert.doesNotThrow(()=>context.dispatchControllerStatus(peer));
assert.doesNotThrow(()=>context.dispatchControllerStatus(peer));
assert.equal(warnings.length,1,'failed game packet must not spam or crash the room');
assert.equal(deliveries.length,0,'broken hook must not emit invalid data');
selectedEngine=goodEngine;
context.dispatchControllerStatus(peer);
assert.equal(deliveries.length,1);
assert.equal(deliveries[0].mode,'unknown_future_game',
 'new game IDs work without Host branches');
assert.equal(deliveries[0].phase,'playing',
 'Host phase cannot be overridden by a status hook');

assert.match(statusDispatch,/gameEngine\(round\.mode\)\?\.getControllerPacket\?\.\(p,round,players\)/);
assert.doesNotMatch(statusDispatch,/round\.mode\s*[!=]==?\s*['"][a-z_]+/);
for(const slug of fs.readdirSync(gamesRoot).filter(x=>fs.statSync(path.join(gamesRoot,x)).isDirectory())){
 const meta=JSON.parse(fs.readFileSync(path.join(gamesRoot,slug,'manifest.json'),'utf8'));
 if(!meta.global||meta.id==='knight_match')continue; // KNIGHT has no custom status packet
 const source=fs.readFileSync(path.join(gamesRoot,slug,slug+'.js'),'utf8');
 assert.match(source,/function getControllerPacket\(/,slug+' controller packet must be game-owned');
 assert.match(source,/window\.[A-Za-z]+=(?:Object\.freeze\()?\{getControllerPacket,/,slug+' must expose its packet hook');
}
console.log('GAME SOURCE OWNERSHIP PASS: '+imported+' independently imported local game sources');
