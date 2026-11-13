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
const {pruneLegacy,pruneBoardCore,pruneExternal,pruneAppBoot,pruneHostCore}=require('../scripts/lazy-game-scripts.cjs');
const catalog=build();
const manifests=new Map();
for(const dir of fs.readdirSync(path.join(root,'src/games'),{withFileTypes:true}).filter(x=>x.isDirectory())){
 const folder=path.join(root,'src/games',dir.name),manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
 manifests.set(manifest.id,{folder,manifest});
}
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const html=pruneAppBoot(pruneHostCore(pruneExternal(pruneBoardCore(pruneLegacy(source,catalog)))));
assert.ok(!html.includes('src="./src/games/ghost-attack/ghost-attack.js"'),'production must strip eager ghost engine');
assert.ok(!html.includes('src="./src/board-party/runtime/board-party.js"'),'production must defer BOARD core');
const buildVersion='window.GAME_DEPLOY_ID="lazy-browser-test";'+
 'window.GAME_CORE_HASH='+JSON.stringify(catalog.coreHash)+';'+
 'window.GAME_GAME_HASHES='+JSON.stringify(Object.fromEntries(catalog.games.map(g=>[g.id,g.hash])))+';';
const injection=`window.__lazyGameTest={get round(){return round},
 get board(){return boardSession},get selection(){return gameSelection},
 get players(){return players},get view(){return currentView},
 beginBoard,beginGameSelection,updateGameSelection,updateBoard,animate,returnToLobby,addLocal,receiveBoardState,
 startRoomScanner,stopRoomScanner,syncLandscapePresentation,
 simulateReloadGuard(kind){
  const old={onlineHost,hostPeer,hostNetworkLoad,controllerReady,controllerPeer,
   controllerConn,controllerNetworkLoad,currentView,round,gameSelection,boardSession};
  try{
   round=null;gameSelection=null;boardSession=null;
   if(kind==='host-connected'){currentView='hostLobby';onlineHost=true;hostPeer={};}
   else if(kind==='host-connecting'){currentView='home';hostNetworkLoad={};}
   else if(kind==='controller-connected'){currentView='controller';controllerReady=true;controllerPeer={};}
   else if(kind==='controller-connecting'){currentView='controller';controllerNetworkLoad={};}
   else throw Error('Unknown reload guard scenario');
   return window.GAME_CAN_AUTO_RELOAD();
  }finally{
   onlineHost=old.onlineHost;hostPeer=old.hostPeer;hostNetworkLoad=old.hostNetworkLoad;
   controllerReady=old.controllerReady;controllerPeer=old.controllerPeer;
   controllerConn=old.controllerConn;controllerNetworkLoad=old.controllerNetworkLoad;
   currentView=old.currentView;round=old.round;gameSelection=old.gameSelection;
   boardSession=old.boardSession;
  }
 }};
 requestAnimationFrame(animate);\n})();`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),pathname=url.pathname;
 let content,ext='.js';
 if(pathname==='/'||pathname==='/index.html'){content=html;ext='.html';}
 else if(pathname==='/game-catalog.json'){content=JSON.stringify(catalog);ext='.json';}
 else if(pathname==='/deployment.json'){content=JSON.stringify({deployId:'lazy-browser-test'});ext='.json';}
 else if(pathname==='/runtime-config.js'){content=buildVersion;}
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
  if(filename===path.join(root,'app.js')||filename===path.join(root,'app-controller.js')){
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
  assert.equal(await page.evaluate(()=>window.BoardParty),undefined,'BOARD core must not load at startup');
  assert.equal(await page.evaluate(()=>window.GhostAttack),undefined,
   'host/controller start does not fetch unused minigame code');
  assert.equal(await page.evaluate(()=>window.__lazyGameTest),undefined,'fresh welcome defers app.js');
  assert.equal(await page.evaluate(()=>window.PartyCharacters),undefined,'welcome defers host physics');
  await page.locator('#offlineBtn').click();
  await page.waitForFunction(()=>!!window.__lazyGameTest,null,{polling:100,timeout:15000});
  assert.equal(await page.evaluate(()=>window.GameHostRuntime.ready()),true,
   'host physics and scenery must finish loading before application init');
  assert.equal(await page.evaluate(()=>window.GAME_CAN_AUTO_RELOAD()),false,
   'offline Host lobby stays mounted while same-core updates load in place');
  for(const mode of ['host-connected','host-connecting'])
   assert.equal(await page.evaluate(m=>__lazyGameTest.simulateReloadGuard(m),mode),false,
    'core releases must not disconnect an online/connecting Host');
  // Controller routes still load app.js for reconnection, but not the host physics.
  const phone=await ctx.newPage(),phoneErrors=[],phoneRequests=[];
  phone.on('pageerror',e=>phoneErrors.push(String(e)));
  phone.on('request',r=>phoneRequests.push(new URL(r.url()).pathname));
  await phone.goto('http://127.0.0.1:'+server.address().port+'/?join=ABC123');
  await phone.waitForFunction(()=>!!window.__lazyGameTest,null,{polling:100,timeout:15000});
  assert.equal(await phone.evaluate(()=>window.PartyCharacters),undefined,
   'joining as controller must not fetch the collision/host runtime');
  assert.equal(await phone.evaluate(()=>window.PartyArenaArt),undefined);
  assert.equal(await phone.evaluate(()=>window.GhostCemeteryArt),undefined);
  assert.ok(phoneRequests.includes('/app-controller.js'),
   'controller must download only its role-specific runtime');
  assert.ok(!phoneRequests.includes('/app.js'),'controller must never download Host app.js');
  assert.equal(await phone.evaluate(()=>window.BoardItems),undefined,
   'controller does not load host BOARD item physics');
  assert.equal(await phone.evaluate(()=>!!window.PartyBoardItemMeta),true);
  const inventory=await phone.evaluate(()=>{
   __lazyGameTest.receiveBoardState({phase:'paused',boardPhase:'ready',round:1,
    hp:100,stepsRemaining:0,bag:['potion'],usedRound:0,actionIndex:1,
    a:'ทอย',b:'เลือก',help:'กระเป๋า',turnId:'regression'});
   return {
    slots:document.querySelectorAll('#inventoryItem .board-bag-item').length,
    selected:document.querySelector('#inventoryItem .board-bag-item.is-selected')?.title,
    mode:document.getElementById('controllerModeName').textContent
   };
  });
  assert.equal(inventory.slots,7,'controller BOARD UI renders every item and roll');
  assert.equal(inventory.selected,'Healing Potion');
  assert.ok(inventory.mode.includes('BOARD PARTY'));
  assert.deepEqual(phoneErrors,[],'controller startup/BOARD inventory must have no errors');
  for(const mode of ['controller-connected','controller-connecting'])
   assert.equal(await phone.evaluate(m=>__lazyGameTest.simulateReloadGuard(m),mode),false,
    'core releases must not drop connected or reconnecting controllers');
  // Installed iOS-like controller in portrait: visually rotated PWA must
  // temporarily unrotate for physical camera, then restore after cancel.
  await phone.setViewportSize({width:390,height:844});
  const cameraSetup=await phone.evaluate(()=>{
   Object.defineProperty(navigator,'standalone',{configurable:true,value:true});
   window.Html5Qrcode=function(){
    this.start=(_camera,settings)=>{window.__scannerSettings=settings;return Promise.resolve();};
    this.stop=()=>Promise.resolve();this.clear=()=>{};
   };
   __lazyGameTest.syncLandscapePresentation();
   return document.body.classList.contains('gf-virtual-landscape');
  });
  assert.equal(cameraSetup,true,'installed portrait PWA starts with a rotated landscape shell');
  await phone.locator('#scanRoomBtn').evaluate(button=>button.click());
  await phone.waitForFunction(()=>!!window.__scannerSettings,null,{timeout:8000});
  const scanned=await phone.evaluate(()=>{
   const panel=document.getElementById('roomScannerPanel');
   const rect=panel.getBoundingClientRect();
   return {visible:!panel.classList.contains('hidden'),
    rotated:document.body.classList.contains('gf-virtual-landscape'),
    size:[rect.width,rect.height],frame:window.__scannerSettings.qrbox(300,520)};
  });
  assert.equal(scanned.visible,true);
  assert.equal(scanned.rotated,false,'camera must not inherit virtual landscape CSS rotation');
  assert.ok(Math.abs(scanned.size[0]-390)<2&&Math.abs(scanned.size[1]-844)<2,
   'QR overlay matches real device portrait bounds: '+JSON.stringify(scanned));
  assert.equal(scanned.frame.width,252);
  assert.equal(scanned.frame.height,252);
  await phone.locator('#cancelScanBtn').evaluate(button=>button.click());
  await phone.waitForFunction(()=>document.body.classList.contains('gf-virtual-landscape'),
   null,{timeout:8000});
  assert.equal(await phone.locator('#roomScannerPanel').isVisible(),false);
  assert.deepEqual(phoneErrors,[],'QR camera fallback must not cause page errors');
  await phone.close();
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
  await page.evaluate(async()=>{__lazyGameTest.returnToLobby();await __lazyGameTest.beginBoard();});
  const board=await page.evaluate(()=>({
   round:__lazyGameTest.round?.mode,board:!!__lazyGameTest.board,
   total:GamePlatform.games('board').length
  }));
  assert.equal(board.round,'board');
  assert.equal(board.board,true);
  assert.equal(board.total,catalog.games.filter(g=>g.modes.includes('board')).length,
   'BOARD sees all dynamically discovered minigames');
  // Exercise a real BOARD -> randomly chosen minigame transition. A metadata
  // placeholder is not sufficient: its engine and game-owned dependencies
  // must actually download, activate and enter countdown.
  const transitionFrame=await page.evaluate(()=>{
   const board=__lazyGameTest.board;
   const originalBoardId=board.id;
   BoardParty.phase(board,'minigame_pending');
   // The real host RAF must NOT paint a missing engine after switching from
   // BOARD to the roulette. That used to throw and silently close the room.
   __lazyGameTest.animate(performance.now()+20);
   return {mode:__lazyGameTest.selection?.mode||null,
    phase:__lazyGameTest.round?.phase,view:__lazyGameTest.view,
    boardPreserved:__lazyGameTest.board?.id===originalBoardId};
  });
  assert.ok(transitionFrame.mode,'BOARD RAF must launch a minigame roulette');
  assert.equal(transitionFrame.phase,'roulette');
  assert.equal(transitionFrame.view,'game','RAF transition may not return to lobby');
  assert.equal(transitionFrame.boardPreserved,true);
  const selectedMode=transitionFrame.mode;
  await page.waitForFunction(()=>!!__lazyGameTest.selection &&
    (__lazyGameTest.selection.ready||__lazyGameTest.selection.error),
    null,{polling:100,timeout:20000});
  const transition=await page.evaluate(()=>{
   const error=String(__lazyGameTest.selection?.error||'');
   __lazyGameTest.updateGameSelection(4);
   return {error,mode:__lazyGameTest.round?.mode,
    phase:__lazyGameTest.round?.phase,board:__lazyGameTest.board?.phase};
  });
  assert.equal(transition.error,'','BOARD minigame must load real game assets');
  assert.equal(transition.mode,selectedMode);
  assert.equal(transition.phase,'countdown');
  assert.equal(transition.board,'minigame');
  // A failed cold roulette should switch to a loaded engine, not skip BOARD
  // rewards/turns or disconnect everyone.
  await page.evaluate(async()=>{
   await Promise.all([GamePlatform.ensure('ghost'),GamePlatform.ensure('chickens')]);
   __lazyGameTest.returnToLobby();
   __lazyGameTest.beginBoard();
  });
  const fallback=await page.evaluate(()=>{
   const s=__lazyGameTest.board;
   BoardParty.phase(s,'minigame_pending');
   __lazyGameTest.updateBoard(.05);
   const failure=__lazyGameTest.selection.mode;
   __lazyGameTest.selection.error=Error('simulated offline minigame');
   __lazyGameTest.updateGameSelection(4);
   return {failure,substitute:__lazyGameTest.selection?.mode||null,
    boardPhase:s.phase,boardSame:__lazyGameTest.board===s};
  });
  assert.ok(fallback.substitute&&fallback.substitute!==fallback.failure,
   'verified fallback game must replace the failed minigame');
  assert.equal(fallback.boardPhase,'minigame');
  assert.equal(fallback.boardSame,true,'BOARD state is retained after fallback');
  assert.deepEqual(errors,[],'no unhandled page errors in production-like lazy boot');
  console.log('LAZY BOOT BROWSER PASS '+kind+': controller bundle + BOARD bag, host physics, game selection');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
