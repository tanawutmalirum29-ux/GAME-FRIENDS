/* Production Amplify build rehearsal in real Chromium/WebKit.
 * Two independent builds and HTTP deploy switching; no hand-built HTML stubs.
 * A running BOARD room must keep its app/core when only game hashes change. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {spawnSync}=require('node:child_process');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),kind=process.env.BOARD_BROWSER||'chromium';
const work=fs.mkdtempSync(path.join(os.tmpdir(),'gf-deploy-rehearsal-'));
const first=path.join(work,'release-a'),second=path.join(work,'release-b');
const REV_A='a'.repeat(40),REV_B='b'.repeat(40);
let serving=first;
function copyRelease(target){
 fs.cpSync(root,target,{recursive:true,filter:src=>{
  const rel=path.relative(root,src).replaceAll(path.sep,'/');
  return rel===''||!rel.split('/').some(part=>
   ['.git','.github','node_modules','game-assets','.cache','coverage'].includes(part));
 }});
}
function plugin(target,id,revision){
 const dir=path.join(target,'src/games/ci-'+id);
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({
  id:'ci_'+id,name:'CI '+id.toUpperCase(),version:revision==='v1'?'1.0.0':'2.0.0',
  apiVersion:1,enabled:true,players:{min:1,max:12},
  modes:['normal','board'],controls:['joystick'],entry:'./game.js',legacyScripts:[]
 })+'\n');
 fs.writeFileSync(path.join(dir,'game.js'),
  'export default {version:'+JSON.stringify(revision)+
  ',setup(){},update(){},draw(){},hud(){return {survivors:1}},getResult(){return []}};\n');
}
function build(target,version){
 const result=spawnSync(process.execPath,[path.join(root,'scripts/build-static.cjs')],{
  cwd:root,env:{...process.env,GAME_BUILD_ROOT:target,AWS_COMMIT_ID:version},
  encoding:'utf8',timeout:120000
 });
 assert.equal(result.status,0,
  'production build must succeed: '+result.stdout+'\n'+result.stderr);
 const catalog=JSON.parse(fs.readFileSync(path.join(target,'game-catalog.json'),'utf8'));
 const html=fs.readFileSync(path.join(target,'index.html'),'utf8');
 assert.ok(html.includes('src="./src/platform/main-loader.js?v='+version+'"'));
 assert.ok(!html.includes('src="./app.js?'),'production app must be lazy');
 assert.ok(fs.existsSync(path.join(target,'app-controller.js')),
  'build must emit controller-only app bundle');
 assert.ok(html.includes('src="./src/platform/board-items-brief.js?v='+version+'"'),
  'phone BOARD metadata must be version pinned');
 assert.ok(!html.includes('src="./character-system.js?'),'host physics must be lazy');
 assert.ok(!html.includes('src="./src/board-party/runtime/board-party.js?'),'BOARD core must be lazy');
 assert.ok(!html.includes('cdn.jsdelivr.net/npm/peerjs@'),'peer library must be on demand');
 assert.ok(fs.existsSync(path.join(target,'game-assets/ci_probe',
  catalog.games.find(g=>g.id==='ci_probe').hash,'game.js')));
 return catalog;
}
const mimetype={
 '.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8',
 '.json':'application/json;charset=utf-8','.svg':'image/svg+xml',
 '.css':'text/css','.webmanifest':'application/manifest+json',
 '.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'
};
const requestLog=[];
const server=http.createServer((req,res)=>{
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}
 catch(_){res.writeHead(400).end();return;}
 // Existing clients keep their shell. The catalog/version and new content
 // assets switch atomically to the newly deployed release.
 const release=(serving===second&&
  (pathname==='/game-catalog.json'||pathname==='/version.json'||
   pathname.startsWith('/game-assets/')))?second:first;
 const file=path.resolve(release,'.'+pathname.replace(/\/$/,'/index.html'));
 if(!file.startsWith(release+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
  res.writeHead(404,{'cache-control':'no-store'}).end('not found');return;
 }
 requestLog.push(pathname);
 res.writeHead(200,{'content-type':mimetype[path.extname(file)]||'application/octet-stream',
  'cache-control':'no-store','access-control-allow-origin':'*'});
 res.end(fs.readFileSync(file));
});
async function run(){
 copyRelease(first);copyRelease(second);
 plugin(first,'probe','v1');plugin(second,'probe','v2');
 plugin(second,'fresh','new');
 const a=build(first,REV_A),b=build(second,REV_B);
 assert.equal(a.coreHash,b.coreHash,
  'changing or introducing a minigame must never modify the shared core hash');
 assert.equal(a.games.length+1,b.games.length);
 assert.notEqual(a.games.find(g=>g.id==='ci_probe').hash,
  b.games.find(g=>g.id==='ci_probe').hash);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await (kind==='webkit'?webkit:chromium).launch({
  headless:true,executablePath:kind==='chromium'?(process.env.CHROME_PATH||undefined):undefined,
  args:kind==='chromium'?['--no-sandbox']:[]
 });
 try{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const errors=[],page=await context.newPage();
  page.on('pageerror',error=>errors.push(String(error)));
  const phone=await context.newPage(),phoneRequests=[],phoneErrors=[];
  phone.on('pageerror',e=>phoneErrors.push(String(e)));
  phone.on('request',r=>phoneRequests.push(new URL(r.url()).pathname));
  await phone.goto(base+'/?join=ABC123');
  await phone.waitForFunction(()=>document.getElementById('controller')?.classList.contains('hidden')===false,
   null,{timeout:15000,polling:100}).catch(async error=>{
    console.error('CONTROLLER BOOT DIAGNOSTIC',JSON.stringify({
     requests:phoneRequests.slice(-15),pageErrors:phoneErrors,
     state:await phone.evaluate(()=>({
      view:document.getElementById('controller')?.className,
      hasPeer:typeof window.GameRuntimeDeps,
      loadedScripts:[...document.scripts].filter(x=>/app-(controller|host)|app\\.js/.test(x.src)).map(x=>x.src)
     })).catch(e=>({error:String(e)}))
    }));
    throw error;
   });
  assert.deepEqual(phoneErrors,[],'controller bundle must initialize without page errors');
  assert.ok(phoneRequests.includes('/app-controller.js'));
  assert.ok(!phoneRequests.includes('/app.js'));
  assert.equal(await phone.evaluate(()=>window.BoardItems),undefined);
  assert.equal(await phone.evaluate(()=>!!window.PartyBoardItemMeta),true);
  await phone.close();
  await page.goto(base+'/?host=1');
  await page.waitForFunction(()=>window.GamePlatform?.revision>0,null,{timeout:20000,polling:100});
  assert.equal(await page.evaluate(()=>window.PartyCharacters),undefined);
  assert.equal(await page.evaluate(()=>window.GameHostRuntime.ready()),false);
  assert.ok(requestLog.includes('/game-catalog.json'));
  assert.ok(!requestLog.includes('/app.js'),'fresh host must not download full app');
  await page.locator('#offlineBtn').click();
  await page.waitForFunction(()=>document.querySelector('#hostLobby')?.classList.contains('hidden')===false,
   null,{timeout:20000,polling:100});
  assert.equal(await page.evaluate(()=>window.GameHostRuntime.ready()),true);
  const version1=await page.evaluate(async()=>{
   const engine=await GamePlatform.ensure('ci_probe');
   window.__rehearsalPinnedEngine=engine;
   return {version:engine.version,count:GamePlatform.games('board').length};
  });
  assert.equal(version1.version,'v1');
  assert.equal(version1.count,a.games.length);
  // Enter an actual BOARD party; core runtime must remain mounted on refresh.
  await page.locator('[data-session-mode="board"]').click();
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>!!window.BoardParty&&
   !document.querySelector('#game')?.classList.contains('hidden'),
   null,{timeout:25000,polling:100});
  const currentUrl=page.url();
  serving=second;
  const change=await page.evaluate(async()=>{
   const changed=await GamePlatform.refresh();
   return {changed,count:GamePlatform.games('board').length,
    fresh:!!GamePlatform.descriptor('ci_fresh'),
    ready:GamePlatform.ready('ci_probe'),old:window.__rehearsalPinnedEngine.version};
  });
  assert.equal(change.changed,true);
  assert.equal(change.count,b.games.length);
  assert.equal(change.fresh,true,'new manifest should appear without editing app.js');
  assert.equal(change.ready,false);
  assert.equal(change.old,'v1');
  const after=await page.evaluate(async()=>{
   const [engine,added]=await Promise.all([
    GamePlatform.ensure('ci_probe'),GamePlatform.ensure('ci_fresh')
   ]);
   await window.GameAutoUpdate.check();
   return {updated:engine.version,added:added.version,
    pinned:window.__rehearsalPinnedEngine.version,
    pending:window.GameAutoUpdate.getPendingVersion(),
    boardVisible:!document.querySelector('#game').classList.contains('hidden'),
    boardCoreReady:window.BoardRuntime.ready()};
  });
  assert.equal(after.updated,'v2');
  assert.equal(after.added,'new');
  assert.equal(after.pinned,'v1');
  assert.equal(after.pending,REV_B);
  assert.equal(after.boardVisible,true);
  assert.equal(after.boardCoreReady,true);
  assert.equal(page.url(),currentUrl,'core-compatible deployed hotpatch cannot navigate an active room');
  assert.deepEqual(errors,[],'no unhandled page errors in production build');
  console.log('PRODUCTION DEPLOY REHEARSAL PASS '+kind+
   ': two actual builds, host startup, active BOARD pin, discovered game and safe defer');
  await context.close();
 }finally{await browser.close();}
}
run().catch(err=>{console.error(err);process.exitCode=1;}).finally(()=>{
 server.close();fs.rmSync(work,{force:true,recursive:true});
});
