/* Actual Start button + animation loop. Run with BOARD_BROWSER=webkit or chromium.
   Requires Playwright and its selected browser; no PeerJS service is needed. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require('playwright'),root=path.resolve(__dirname,'..');
const engine=process.env.BOARD_BROWSER||'chromium',out=process.env.BOARD_SCREENSHOTS||'/tmp/game-friends-board';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'};
 let data=fs.readFileSync(file);
 if(file===path.join(root,'index.html'))
  data=require('./helpers/legacy-game-html.cjs').withLegacyGameFixtures(data.toString());
 if(file===path.join(root,'app.js'))data=data.toString().replace('requestAnimationFrame(animate);\n})();','window.__boardStartup={get board(){return boardSession},get view(){return currentView},get locals(){return players},refreshBoardTools};requestAnimationFrame(animate);\n})();');
 res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);
});
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));fs.mkdirSync(out,{recursive:true});
 const executablePath=engine==='chromium'?(process.env.CHROME_PATH||'/usr/bin/chromium'):undefined;
 const browser=await playwright[engine].launch({headless:true,executablePath,args:engine==='chromium'?['--no-sandbox']:[]});
 try{
  for(const denyTerrain of [false,true]){
   const context=await browser.newContext({viewport:{width:1280,height:740},deviceScaleFactor:2,hasTouch:true});
   await context.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
   await context.addInitScript(()=>{
    // Emulate the delayed first rAF seen during mobile fullscreen transitions.
    const raf=requestAnimationFrame;let pending;
    window.__holdBoardFrame=true;
    window.requestAnimationFrame=cb=>{if(window.__holdBoardFrame){pending=cb;return 0;}return raf(cb);};
    window.__resumeBoardFrame=()=>{window.__holdBoardFrame=false;if(pending)raf(pending);};
    const get=HTMLCanvasElement.prototype.getContext,fill=CanvasRenderingContext2D.prototype.fillText;
    window.__terrainSizes=[];window.__drawnTexts=[];
    HTMLCanvasElement.prototype.getContext=function(type,...args){
     if(!this.id&&this.width*this.height>1000000){
      window.__terrainSizes.push(this.width*this.height);
      if(window.__denyTerrain||this.width*this.height>4000000)return null;
     }
     return get.call(this,type,...args);
    };
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(this.canvas.id==='arena')window.__drawnTexts.push(text);return fill.call(this,text,...args);};
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   page.on('console',m=>{if(m.type()==='error'&&m.text().includes('failed'))errors.push(m.text());});
   await page.goto('http://127.0.0.1:'+server.address().port+'/?host=1');
   await page.locator('#offlineBtn').click();await page.locator('#plazaSettingsToggle').click();if(denyTerrain)for(let i=0;i<10;i++)await page.locator('#addLocalBtn').click();
   await page.locator('[data-session-mode="board"]').click();
   await page.evaluate(deny=>{
    window.__denyTerrain=deny;
    // A previous renderer/context must not leave a clipping region on a new board.
    const g=document.getElementById('arena').getContext('2d');g.beginPath();g.rect(0,0,0,0);g.clip();
   },denyTerrain);
   await page.locator('#startBtn').click();
   const startup=await page.evaluate(()=>({time:__boardStartup.board.time,view:__boardStartup.view,texts:__drawnTexts,allocations:__terrainSizes,pixel:[...document.getElementById('arena').getContext('2d').getImageData(100,100,1,1).data]}));
   assert.equal(startup.view,'game');assert.equal(startup.time,0);assert.equal(startup.pixel[3],255,'overview is painted even before the first rAF');
   assert.ok(startup.texts.includes('BOARD PARTY'));assert.equal(startup.allocations.length,1);assert.ok(startup.allocations[0]<=3500000);
   assert.equal(await page.locator('#boardStartDiceBtn').isVisible(),false,
    'BOARD preview is timed and does not require A or a manual Start button');
   // Order screen paints on the next frame; the initial overview already painted synchronously.
   await page.screenshot({path:path.join(out,engine+'-start-'+(denyTerrain?'fallback':'normal')+'.png')});
   await page.evaluate(()=>window.__resumeBoardFrame());
   await page.waitForFunction(()=>__boardStartup.board?.time>.05,{},{timeout:20000});
   await page.waitForFunction(()=>__boardStartup.board?.phase==='order',{},{timeout:20000});
   // The dice-order card screen must not expose controls from the map.
   for(const id of ['boardExitBtn','boardNodeDebugBtn','pauseBtn'])
    assert.equal(await page.locator('#'+id).isVisible(),false,
     id+' must stay hidden on the BOARD dice-order overlay');
   assert.ok(await page.evaluate(()=>__boardStartup.board.time>=3.49),'automatic 2-second overview and 1.5-second fly-in');
   assert.equal(await page.evaluate(()=>__boardStartup.view),'game','initial order must also survive real animation frames');
   await page.evaluate(()=>{
    const s=__boardStartup.board;s.order=s.players.map(p=>p.id);s.players.forEach(p=>p.isBot=false);BoardParty.startTurn(s);
    // This fixture calls BoardParty directly, bypassing the normal
    // updateBoard phase-change hook. Refresh the Host UI explicitly.
    __boardStartup.refreshBoardTools();
    window.__drawnTexts=[];
   });
   await page.waitForFunction(()=>__drawnTexts.includes('ทอยลูกเต๋า')&&__boardStartup.board.phase==='ready',{},{timeout:20000});
   assert.equal(await page.evaluate(()=>__boardStartup.view),'game');
   const sizes=await page.evaluate(()=>__terrainSizes);assert.equal(sizes.length,1);assert.ok(sizes[0]<=3500000);
   await page.locator('#pauseBtn').click();assert.equal(await page.locator('#pauseBtn').getAttribute('aria-label'),'เล่นต่อ');
   await page.locator('#pauseBtn').click();assert.equal(await page.locator('#pauseBtn').getAttribute('aria-label'),'หยุดเกม');
   await page.screenshot({path:path.join(out,engine+'-terrain-'+(denyTerrain?'fallback':'normal')+'.png')});
   // Only Pause, Exit and Show ID may remain on the BOARD Host.
   await page.evaluate(()=>{
    const s=__boardStartup.board,p=s.players[0];
    __boardStartup.locals[0].isBot=false;p.isBot=false;
    BoardParty.beginMove(s,p,2);__boardStartup.refreshBoardTools();
   });
   assert.equal(await page.locator('#boardTools button').count(),1);
   assert.equal(await page.locator('#boardNodeDebugBtn').isVisible(),true,
    'Show ID stays visible with human players');
   await page.locator('#boardNodeDebugBtn').click();
   assert.equal(await page.evaluate(()=>__boardStartup.board.camera.debugNodes),true);
   await page.locator('#boardNodeDebugBtn').click();
   assert.equal(await page.evaluate(()=>__boardStartup.board.camera.debugNodes),false);
   // EXIT must be available in live BOARD, without having to pause first.
   assert.equal(await page.locator('#boardExitBtn').isVisible(),true,
    'board exit remains visible while a session is running');
   await page.locator('#boardExitBtn').click();
   assert.equal(await page.locator('#uiModal').isVisible(),true,
    'exit requires a separate confirmation');
   await page.locator('#uiCancelBtn').click();
   assert.equal(await page.evaluate(()=>__boardStartup.view),'game',
    'cancel keeps the current board session');
   assert.equal(await page.locator('#pauseBtn').getAttribute('aria-label'),'หยุดเกม');
   // Exit while paused, cancel and resume must also work on WebKit.
   await page.locator('#pauseBtn').click();
   await page.locator('#boardExitBtn').click();
   await page.locator('#uiCancelBtn').click();
   assert.equal(await page.locator('#pauseBtn').getAttribute('aria-label'),'เล่นต่อ');
   await page.locator('#pauseBtn').click();
   await page.locator('#boardExitBtn').click();
   await page.locator('#uiConfirmBtn').click();
   await page.waitForFunction(()=>__boardStartup.board===null&&__boardStartup.view==='hostLobby',
    null,{timeout:10000});
   assert.equal(await page.locator('#boardExitBtn').isVisible(),false,
    'exit control disappears on returning to lobby');
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('STARTUP PASS ('+engine+'): actual Start, 2/12 players, DPR 2, delayed rAF, old clip reset, <=3.5MP terrain, allocation failure fallback, pause/resume/overview/follow');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
