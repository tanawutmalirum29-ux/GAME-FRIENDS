/* Production-like lazy boot in real Chromium/WebKit: no engine at page load,
 * engine fetched on roulette, and BOARD PARTY still starts with placeholders. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),kind=process.env.BOARD_BROWSER||'chromium';
const {build}=require('../scripts/build-game-catalog.cjs');
const {pruneLegacy}=require('../scripts/lazy-game-scripts.cjs');
const catalog=build();
const manifests=new Map();
for(const dir of fs.readdirSync(path.join(root,'src/games'),{withFileTypes:true}).filter(x=>x.isDirectory())){
 const folder=path.join(root,'src/games',dir.name),manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
 manifests.set(manifest.id,{folder,manifest});
}
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const html=pruneLegacy(source,catalog);
assert.ok(!html.includes('src="./ghost-attack.js"'),'production must strip eager ghost engine');
const buildVersion='window.GAME_BUILD_VERSION="lazy-browser-test";'+
 'window.GAME_CORE_VERSION='+JSON.stringify(catalog.coreHash)+';'+
 'window.GAME_GAME_HASHES='+JSON.stringify(Object.fromEntries(catalog.games.map(g=>[g.id,g.hash])))+';';
const injection=`window.__lazyGameTest={get round(){return round},
 get board(){return boardSession},get selection(){return gameSelection},
 get players(){return players},get view(){return currentView},
 beginBoard,beginGameSelection,updateGameSelection,returnToLobby,addLocal};
 requestAnimationFrame(animate);\n})();`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),pathname=url.pathname;
 let content,ext='.js';
 if(pathname==='/'||pathname==='/index.html'){content=html;ext='.html';}
 else if(pathname==='/game-catalog.json'){content=JSON.stringify(catalog);ext='.json';}
 else if(pathname==='/version.json'){content=JSON.stringify({version:'lazy-browser-test'});ext='.json';}
 else if(pathname==='/build-version.js'){content=buildVersion;}
 else if(pathname.startsWith('/game-assets/')){
  const parts=pathname.split('/').filter(Boolean);
  const id=parts[1],hash=parts[2],record=catalog.games.find(g=>g.id===id);
  const local=manifests.get(id);
  if(!record||record.hash!==hash||!local){res.writeHead(404).end();return;}
  const rel=parts.slice(3);
  const base=rel[0]==='legacy'?root:local.folder;
  const filename=path.resolve(base,...(rel[0]==='legacy'?rel.slice(1):rel));
  if(!filename.startsWith(base+path.sep)||!fs.existsSync(filename)){res.writeHead(404).end();return;}
  content=fs.readFileSync(filename);ext=path.extname(filename);
 }else{
  const filename=path.resolve(root,'.'+pathname);
  if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename)){res.writeHead(404).end();return;}
  content=fs.readFileSync(filename);ext=path.extname(filename);
  if(filename===path.join(root,'app.js')){
   const text=content.toString('utf8');
   assert.ok(text.includes('requestAnimationFrame(animate);\n})();'));
   content=text.replace('requestAnimationFrame(animate);\n})();',injection);
  }
 }
 const mime={'.html':'text/html','.json':'application/json','.js':'text/javascript',
  '.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
 res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream','cache-control':'no-store'});
 res.end(content);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const b=kind==='webkit'?webkit:chromium;
 const browser=await b.launch({
  headless:true,
  executablePath:kind==='chromium'?(process.env.CHROME_PATH||undefined):undefined,
  args:kind==='chromium'?['--no-sandbox']:[]
 });
 try{
  const ctx=await browser.newContext({viewport:{width:1280,height:800}});
  await ctx.route('https://**/*',route=>route.fulfill({body:'',contentType:'text/javascript'}));
  await ctx.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?host=1');
  await page.waitForFunction(()=>window.GamePlatform?.revision===1,null,{polling:100,timeout:15000});
  assert.equal(await page.evaluate(()=>window.GhostAttack),undefined,
   'host/controller start does not fetch unused minigame code');
  await page.locator('#offlineBtn').click();
  await page.evaluate(()=>window.__lazyGameTest.beginGameSelection('ghost'));
  const initialSelection=await page.evaluate(()=>({
    url:location.href,view:__lazyGameTest.view,players:__lazyGameTest.players.length,
    selection:__lazyGameTest.selection?.mode||null,
    choices:GamePlatform.games('normal').map(g=>g.id)
  }));
  assert.equal(initialSelection.selection,'ghost',
   'roulette must start: '+JSON.stringify(initialSelection));
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())console.log('LAZY NAVIGATED '+frame.url());});
  page.on('requestfailed',req=>console.log('LAZY REQUEST FAILED '+req.url()+' '+req.failure()?.errorText));
  page.on('console',msg=>{if(msg.type()==='error')console.log('LAZY CONSOLE '+msg.text());});

  await page.waitForFunction(()=>window.__lazyGameTest?.selection?.ready===true||
   !!window.__lazyGameTest?.selection?.error,null,{polling:100,timeout:15000}).catch(async err=>{
    console.error('LAZY DIAGNOSTIC',JSON.stringify(await page.evaluate(()=>({
     url:location.href,view:__lazyGameTest?.view,players:__lazyGameTest?.players.length,
     selection:__lazyGameTest?.selection&&{
      mode:__lazyGameTest.selection.mode,ready:__lazyGameTest.selection.ready,
      error:String(__lazyGameTest.selection.error||'')},
     registered:GamePlatform?.revision,loaded:!!window.GhostAttack,
     ready:GamePlatform?.ready('ghost')
    })).catch(e=>({navigationError:String(e)}))),errors);
    throw err;
   });
  const loadError=await page.evaluate(()=>String(window.__lazyGameTest?.selection?.error||''));
  assert.equal(loadError,'','engine must load without an error');
  const played=await page.evaluate(()=>{
   __lazyGameTest.updateGameSelection(4);
   return {mode:__lazyGameTest.round?.mode,phase:__lazyGameTest.round?.phase,
    loaded:!!window.GhostAttack,ready:GamePlatform.ready('ghost')};
  });
  assert.equal(played.mode,'ghost');assert.equal(played.phase,'countdown');
  assert.equal(played.loaded,true);assert.equal(played.ready,true);
  await page.evaluate(()=>{__lazyGameTest.returnToLobby();__lazyGameTest.beginBoard();});
  const board=await page.evaluate(()=>({
   round:__lazyGameTest.round?.mode,board:!!__lazyGameTest.board,
   total:GamePlatform.games('board').length
  }));
  assert.equal(board.round,'board');
  assert.equal(board.board,true);
  assert.equal(board.total,15);
  assert.deepEqual(errors,[],'no unhandled page errors in production-like lazy boot');
  console.log('LAZY BOOT BROWSER PASS '+kind+': cold load, engine selection, BOARD PARTY');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
