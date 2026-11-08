/* Chromium/WebKit integration: same-core hot game patch without host navigation. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const playwright=require('playwright');
const browserName=process.env.BOARD_BROWSER||'chromium';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gf-plugin-browser-'));
const ROOT=path.resolve(__dirname,'..');
const CORE='a'.repeat(20);
const H1='1'.repeat(24),H2='2'.repeat(24),H3='3'.repeat(24),
 H4='4'.repeat(24),H5='5'.repeat(24),H6='6'.repeat(24),H7='7'.repeat(24);
function file(name,value){
 const p=path.join(tmp,name);
 fs.mkdirSync(path.dirname(p),{recursive:true});
 fs.writeFileSync(p,value);
}
function makeGame(id,hash,version){
 file('game-assets/'+id+'/'+hash+'/game.js',
  'export default {version:'+JSON.stringify(version)+',setup(){},update(){},draw(){},'+
  'hud(){return {survivors:1}},getResult(){return []}};\n');
 return {id,name:id.toUpperCase(),version:'1.0.0',enabled:true,apiVersion:1,
   modes:['normal','board'],players:{min:1,max:12},controls:['joystick'],
   hash,global:null,entryUrl:'/game-assets/'+id+'/'+hash+'/game.js',legacyUrls:[]};
}
const one=makeGame('pilot',H1,'v1');
const two=makeGame('pilot',H2,'v2');
const extra=makeGame('extra',H3,'new');
let current={schema:1,coreHash:CORE,games:[one]};
function sendCatalog(){file('game-catalog.json',JSON.stringify(current));}
sendCatalog();
fs.mkdirSync(path.join(tmp,'src/platform'),{recursive:true});
fs.copyFileSync(path.join(ROOT,'src/platform/game-platform.js'),path.join(tmp,'src/platform/game-platform.js'));
file('index.html','<!doctype html><html><head><meta charset="utf-8">'+
 '<script>window.GAME_CORE_VERSION='+JSON.stringify(CORE)+';<\/script>'+
 '<script defer src="/src/platform/game-platform.js"><\/script>'+
 '</head><body><main id="ok">board remains mounted<\/main></body></html>');
const server=http.createServer((req,res)=>{
 let name;
 try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');}
 catch(_){res.writeHead(400).end();return;}
 const filename=path.resolve(tmp,name||'index.html');
 if(!filename.startsWith(tmp+path.sep)||!fs.existsSync(filename)){
  res.writeHead(404,{'content-type':'text/plain'}).end('not found');return;
 }
 const ext=path.extname(filename);
 const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json'}[ext]||'text/plain';
 res.writeHead(200,{'content-type':mime,'cache-control':'no-store'});
 res.end(fs.readFileSync(filename));
});
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await playwright[browserName].launch({
  headless:true,
  executablePath:browserName==='chromium'?(process.env.CHROME_PATH||undefined):undefined,
  args:browserName==='chromium'?['--no-sandbox']:[]
 });
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const url='http://127.0.0.1:'+server.address().port+'/index.html';
  await page.goto(url);
  await page.waitForFunction(()=>window.GamePlatform?.revision===1);
  const start=await page.evaluate(async()=>{
   const engine=await GamePlatform.ensure('pilot');
   window.__ongoing=engine;
   return {version:engine.version,available:GamePlatform.games('board').length,
    mounted:document.getElementById('ok').textContent};
  });
  assert.equal(start.version,'v1');
  assert.equal(start.available,1);
  assert.equal(start.mounted,'board remains mounted');
  current={schema:1,coreHash:CORE,games:[two,extra]};sendCatalog();
  const changed=await page.evaluate(async()=>{
   await GamePlatform.refresh();
   return {count:GamePlatform.games().length,ready:GamePlatform.ready('pilot'),
    pinned:window.__ongoing.version};
  });
  assert.equal(changed.count,2,'new minigames appear without reloading board');
  assert.equal(changed.ready,false,'updated engine is not incorrectly reused');
  assert.equal(changed.pinned,'v1','current round retains original engine object');
  const after=await page.evaluate(async()=>{
   const engine=await GamePlatform.ensure('pilot');
   return {next:engine.version,old:window.__ongoing.version,ready:GamePlatform.ready('pilot')};
  });
  assert.equal(after.next,'v2');
  assert.equal(after.old,'v1','previous round is never modified by update');
  assert.equal(after.ready,true);
  assert.equal(await page.evaluate(async()=>(await GamePlatform.ensure('extra')).version),'new');
  // Publish an invalid API under the same core. The old engine remains usable.
  const broken=makeGame('pilot',H4,'invalid-api');
  file('game-assets/pilot/'+H4+'/game.js','export default null;\\n');
  current={schema:1,coreHash:CORE,games:[broken,extra]};sendCatalog();
  assert.equal(await page.evaluate(()=>GamePlatform.refresh()),true);
  const recovered=await page.evaluate(async()=>{
   const engine=await GamePlatform.ensure('pilot');
   return {version:engine.version,ready:GamePlatform.ready('pilot'),
    published:GamePlatform.descriptor('pilot').hash,old:window.__ongoing.version,
    rejected:GamePlatform.getRejected()};
  });
  assert.equal(recovered.version,'v2','invalid update falls back to last good in-memory engine');
  assert.equal(recovered.old,'v1','running round remains pinned');
  assert.equal(recovered.ready,true);
  assert.equal(recovered.published,H2);
  assert.equal(recovered.rejected.length,1);
  assert.equal(recovered.rejected[0].hash,H4);
  assert.equal(await page.evaluate(()=>GamePlatform.refresh()),false,
   'same broken version stays quarantined');

  // A new game with missing immutable assets disappears from both selection modes.
  const missing=makeGame('unavailable',H5,'not-found');
  fs.rmSync(path.join(tmp,'game-assets/unavailable/'+H5+'/game.js'));
  current={schema:1,coreHash:CORE,games:[broken,extra,missing]};sendCatalog();
  await page.evaluate(()=>GamePlatform.refresh());
  const hidden=await page.evaluate(async()=>{
   let error='';
   try{await GamePlatform.ensure('unavailable');}
   catch(e){error=String(e.message||e);}
   return {error,found:!!GamePlatform.descriptor('unavailable'),
    selectable:GamePlatform.games('board').map(g=>g.id)};
  });
  assert.ok(hidden.error,'an uncached missing module must fail');
  assert.equal(hidden.found,false);
  assert.deepEqual(hidden.selectable.sort(),['extra','pilot']);
  assert.equal(await page.evaluate(()=>GamePlatform.refresh()),false,
   'quarantine also prevents re-listing a missing newly added game');

  // After the cooldown, the quarantined hash can be tried again.
  const expired=await page.evaluate(async()=>{
   const actual=Date.now;
   Date.now=()=>actual()+95_000;
   try{await GamePlatform.refresh();return GamePlatform.descriptor('pilot').hash;}
   finally{Date.now=actual;}
  });
  assert.equal(expired,H4,'expired hash is retried without forcing page navigation');
  const rolledBackAgain=await page.evaluate(async()=>(
   await GamePlatform.ensure('pilot')).version);
  assert.equal(rolledBackAgain,'v2');

  // Publishing a valid *different* hash recovers immediately, no wait for TTL.
  const valid=makeGame('pilot',H6,'v3');
  const restored=makeGame('unavailable',H7,'restored');
  current={schema:1,coreHash:CORE,games:[valid,extra,restored]};sendCatalog();
  assert.equal(await page.evaluate(()=>GamePlatform.refresh()),true);
  const healthy=await page.evaluate(async()=>({
   pilot:(await GamePlatform.ensure('pilot')).version,
   newGame:(await GamePlatform.ensure('unavailable')).version,
   rejected:GamePlatform.getRejected().length,
   pinned:window.__ongoing.version,
   count:GamePlatform.games().length
  }));
  assert.equal(healthy.pilot,'v3');
  assert.equal(healthy.newGame,'restored');
  assert.equal(healthy.rejected,0);
  assert.equal(healthy.pinned,'v1');
  assert.equal(healthy.count,3);

  current={schema:1,coreHash:CORE,games:[{...valid,enabled:false},extra,restored]};sendCatalog();
  await page.evaluate(()=>GamePlatform.refresh());
  assert.equal(await page.evaluate(()=>GamePlatform.descriptor('pilot')),null,
   'a disabled game is never resurrected by last-known-good fallback');
  current={schema:1,coreHash:'b'.repeat(20),games:[valid,extra,restored]};sendCatalog();
  const coreUpdate=await page.evaluate(async()=>{
   const applied=await GamePlatform.refresh();
   return {applied,pending:GamePlatform.pendingCoreUpdate,count:GamePlatform.games().length};
  });
  assert.equal(coreUpdate.applied,false);
  assert.equal(coreUpdate.pending,true);
  assert.equal(coreUpdate.count,2,'the incompatible core cannot reenable the disabled game');
  assert.equal(page.url(),url,'neither a game update nor a core mismatch navigates');
  assert.deepEqual(errors,[],'no unhandled script errors in '+browserName);
  console.log('GAME PLATFORM BROWSER PASS '+browserName+
    ': live rollback, quarantine/TTL, missing assets, hash recovery, disable and core guard');
  await page.close();
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{
 server.close();fs.rmSync(tmp,{recursive:true,force:true});
});
