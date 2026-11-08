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
const H1='1'.repeat(24),H2='2'.repeat(24),H3='3'.repeat(24);
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
  current={schema:1,coreHash:'b'.repeat(20),games:[two,extra]};sendCatalog();
  const coreUpdate=await page.evaluate(async()=>{
   const applied=await GamePlatform.refresh();
   return {applied,pending:GamePlatform.pendingCoreUpdate,count:GamePlatform.games().length};
  });
  assert.equal(coreUpdate.applied,false);
  assert.equal(coreUpdate.pending,true);
  assert.equal(coreUpdate.count,2);
  assert.equal(page.url(),url,'neither a game update nor a core mismatch navigates');
  assert.deepEqual(errors,[],'no unhandled script errors in '+browserName);
  console.log('GAME PLATFORM BROWSER PASS '+browserName+
    ': hot activation, pinned round, new discovery, core mismatch, no navigation');
  await page.close();
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{
 server.close();fs.rmSync(tmp,{recursive:true,force:true});
});
