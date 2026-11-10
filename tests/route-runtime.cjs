'use strict';
// Stub DOM tests prove route-separated assets and safe retries without
// a real CDN. Full Chromium/WebKit cold starts run in lazy-boot-browser.cjs.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const HOST={
 'arena-scale.js':'PartyArenaScale',
 'arena-art.js':'PartyArenaArt',
 'combat-motion.js':'PartyCombatMotion',
 'character-system.js':'PartyCharacters'
};
const BOARD={
 'src/board-party/runtime/board-map.js':'BoardMap',
 'src/board-party/runtime/board-dice.js':'BoardDice',
 'src/board-party/runtime/board-items.js':'BoardItems',
 'src/board-party/runtime/board-bots.js':'BoardBots',
 'src/board-party/runtime/board-minigame.js':'BoardMinigame',
 'src/board-party/runtime/board-party.js':'BoardParty',
 'src/board-party/runtime/board-art.js':'BoardArt'
};
function fixture(file,mapping,failFile){
 const window={GAME_DEPLOY_ID:'route-test'},calls=[];
 let failurePending=!!failFile;
 const document={
  baseURI:'https://example.org/subdir/index.html',
  createElement(name){assert.equal(name,'script');return {remove(){}};},
  head:{append(tag){
   const base=new URL(document.baseURI).pathname.replace(/[^/]*$/,'');
   const filename=new URL(tag.src).pathname.slice(base.length);
   calls.push({filename,src:tag.src});
   setImmediate(()=>{
    if(failurePending&&filename===failFile){
     failurePending=false;tag.onerror();return;
    }
    if(mapping[filename])window[mapping[filename]]={loaded:filename};
    tag.onload();
   });
  }}
 };
 const source=fs.readFileSync(path.join(root,file),'utf8');
 vm.runInNewContext(source,{window,document,URL,console});
 return {window,calls};
}
async function host(){
 const {window,calls}=fixture('src/platform/host-runtime.js',HOST,'combat-motion.js');
 const api=window.GameHostRuntime;
 assert.equal(api.ready(),false);
 await assert.rejects(api.ensure(),/Host dependency unavailable: combat-motion.js/);
 assert.deepEqual(calls.map(x=>x.filename),
  ['arena-scale.js','arena-art.js','combat-motion.js']);
 assert.equal(api.ready(),false);
 const p1=api.ensure(),p2=api.ensure();
 await Promise.all([p1,p2]);
 assert.equal(api.ready(),true);
 assert.equal(calls.filter(x=>x.filename==='arena-scale.js').length,1);
 assert.equal(calls.filter(x=>x.filename==='arena-art.js').length,1);
 assert.equal(calls.filter(x=>x.filename==='combat-motion.js').length,2);
 assert.ok(calls.every(x=>!new URL(x.src).search),'Canonical script URLs must not include build IDs');
 const before=calls.length;
 await api.ensure();
 assert.equal(calls.length,before,'host reloads do not refetch loaded assets');
}
async function board(){
 const {window,calls}=fixture('src/platform/board-runtime.js',BOARD,'src/board-party/runtime/board-scenery.js');
 const api=window.BoardRuntime;
 await assert.rejects(api.ensure(),/BOARD PARTY asset unavailable: src\/board-party\/runtime\/board-scenery\.js/);
 const first=calls.map(x=>x.filename);
 assert.deepEqual(first,['src/board-party/runtime/board-map.js','src/board-party/runtime/board-design.js','src/board-party/runtime/board-scenery.js']);
 const p1=api.ensure(),p2=api.ensure();
 await Promise.all([p1,p2]);
 assert.equal(api.ready(),true);
 assert.equal(calls.filter(x=>x.filename==='src/board-party/runtime/board-map.js').length,1);
 assert.equal(calls.filter(x=>x.filename==='src/board-party/runtime/board-design.js').length,1);
 assert.equal(calls.filter(x=>x.filename==='src/board-party/runtime/board-scenery.js').length,2);
 assert.equal(calls.length,13,'12-board-file bundle plus one retried broken asset');
 const before=calls.length;await api.ensure();
 assert.equal(calls.length,before);
}
Promise.resolve().then(host).then(board).then(()=>
 console.log('ROUTE RUNTIME PASS: host-only assets, stable asset URLs, deduped retries, BOARD partial recovery')
).catch(error=>{console.error(error);process.exitCode=1;});
