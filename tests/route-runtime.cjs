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
 'graveyard-art.js':'GhostCemeteryArt',
 'combat-motion.js':'PartyCombatMotion',
 'character-system.js':'PartyCharacters'
};
const BOARD={
 'board-map.js':'BoardMap',
 'board-dice.js':'BoardDice',
 'board-items.js':'BoardItems',
 'board-bots.js':'BoardBots',
 'board-minigame.js':'BoardMinigame',
 'board-party.js':'BoardParty',
 'board-art.js':'BoardArt'
};
function fixture(file,mapping,failFile){
 const window={GAME_BUILD_VERSION:'route-test'},calls=[];
 let failurePending=!!failFile;
 const document={
  baseURI:'https://example.org/subdir/index.html',
  createElement(name){assert.equal(name,'script');return {remove(){}};},
  head:{append(tag){
   const filename=new URL(tag.src).pathname.split('/').pop();
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
 const {window,calls}=fixture('src/platform/host-runtime.js',HOST,'graveyard-art.js');
 const api=window.GameHostRuntime;
 assert.equal(api.ready(),false);
 await assert.rejects(api.ensure(),/Host dependency unavailable: graveyard-art.js/);
 assert.deepEqual(calls.map(x=>x.filename),
  ['arena-scale.js','arena-art.js','graveyard-art.js']);
 assert.equal(api.ready(),false);
 const p1=api.ensure(),p2=api.ensure();
 await Promise.all([p1,p2]);
 assert.equal(api.ready(),true);
 assert.equal(calls.filter(x=>x.filename==='arena-scale.js').length,1);
 assert.equal(calls.filter(x=>x.filename==='arena-art.js').length,1);
 assert.equal(calls.filter(x=>x.filename==='graveyard-art.js').length,2);
 assert.ok(calls.every(x=>new URL(x.src).searchParams.get('v')==='route-test'));
 const before=calls.length;
 await api.ensure();
 assert.equal(calls.length,before,'host reloads do not refetch loaded assets');
}
async function board(){
 const {window,calls}=fixture('src/platform/board-runtime.js',BOARD,'board-v7-art.js');
 const api=window.BoardRuntime;
 await assert.rejects(api.ensure(),/BOARD PARTY asset unavailable: board-v7-art.js/);
 const first=calls.map(x=>x.filename);
 assert.deepEqual(first,['board-map.js','board-v7-design.js','board-v7-art.js']);
 const p1=api.ensure(),p2=api.ensure();
 await Promise.all([p1,p2]);
 assert.equal(api.ready(),true);
 assert.equal(calls.filter(x=>x.filename==='board-map.js').length,1);
 assert.equal(calls.filter(x=>x.filename==='board-v7-design.js').length,1);
 assert.equal(calls.filter(x=>x.filename==='board-v7-art.js').length,2);
 assert.equal(calls.length,13,'12-board-file bundle plus one retried broken asset');
 const before=calls.length;await api.ensure();
 assert.equal(calls.length,before);
}
Promise.resolve().then(host).then(board).then(()=>
 console.log('ROUTE RUNTIME PASS: host-only assets, version pins, deduped retries, BOARD partial recovery')
).catch(error=>{console.error(error);process.exitCode=1;});
