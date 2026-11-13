/* Real HOST + Canvas/SVG rendering in Chromium and WebKit; no game server. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require('playwright'),name=process.env.BOARD_BROWSER||'chromium';
const root=path.resolve(__dirname,'..'),out=process.env.GHOST_SCREENSHOTS||'/tmp/game-friends-board/ghost-courtyards';
const hook='window.__ghostView={startRound,addLocal,returnToLobby,drawGame,updateRound,get round(){return round},get players(){return players}};requestAnimationFrame(animate);\n})();';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 let body=fs.readFileSync(file);
 if(file===path.join(root,'index.html'))
  body=require('./helpers/legacy-game-html.cjs').withLegacyGameFixtures(body.toString());
 if(file===path.join(root,'app.js'))body=body.toString().replace('requestAnimationFrame(animate);\n})();',hook);
 res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(body);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await playwright[name].launch({headless:true,...(name==='chromium'?{
  executablePath:process.env.CHROME_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']}:{} )});
 try{
  fs.mkdirSync(out,{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2});
  await context.route('https://**/*',route=>route.fulfill({body:'',contentType:'text/javascript'}));
  await context.addInitScript(()=>{
   window.requestAnimationFrame=()=>0;window.__svgImages=[];window.__surfaces=0;
   const NativeImage=window.Image;window.Image=class extends NativeImage{constructor(...args){super(...args);window.__svgImages.push(this);}};
   if(window.OffscreenCanvas){const NativeCanvas=window.OffscreenCanvas;window.OffscreenCanvas=class extends NativeCanvas{constructor(...args){super(...args);window.__surfaces++;}};}
   let seed=55;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base);await page.evaluate(()=>document.getElementById('offlineBtn').click());
  const snapshots=new Map(),timings=[];
  for(const n of [1,6,7,12])for(const theme of ['graveyard','egypt']){
   const info=await page.evaluate(({n,theme})=>{
    const a=__ghostView;a.returnToLobby();a.players.splice(n);while(a.players.length<n)a.addLocal();
    a.startRound('ghost');if(a.round.ghost.theme!==theme)a.startRound('ghost');
    a.round.phase='playing';a.round.ghost.ghostSpawned=true;
    a.drawGame(1.2);const s=a.round.ghost;
    return {id:s.mapId,theme:s.theme,players:a.players.length,geometry:JSON.stringify(s.obstacles)};
   },{n,theme});
   assert.equal(info.theme,theme);assert.equal(info.players,n);
   if(snapshots.has(info.id))assert.equal(info.geometry,snapshots.get(info.id));else snapshots.set(info.id,info.geometry);
   await page.evaluate(async()=>{
    for(let pass=0;pass<2;pass++){
     for(let i=0;i<12;i++)__ghostView.drawGame(i/4);
     await Promise.all(__svgImages.filter(i=>i.src.startsWith('data:image/svg+xml')).map(i=>i.decode()));
    }
    __ghostView.drawGame(1.2);
   });
   // Newly assigned hats recolor SVGs asynchronously. Wait for actual browser
   // decode completion instead of asserting on an intermediate loading frame.
   await page.waitForFunction(()=>__svgImages.filter(i=>i.src.startsWith('data:image/svg+xml'))
     .every(i=>i.complete&&i.naturalWidth>0),null,{polling:50,timeout:5000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true,'HOST fits the screen');
   if(n===6||n===12){
    await page.locator('#arena').screenshot({path:path.join(out,`${name}-${theme}-${n}.png`)});
    // Save a clean 2x board view too, independent of surrounding host controls.
    const png=await page.evaluate(()=>{
     const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
     const c=canvas.getContext('2d');c.scale(2,2);GhostAttack.draw(c,1.2,__ghostView.round,__ghostView.players);
     return canvas.toDataURL('image/png').split(',')[1];
    });
    fs.writeFileSync(path.join(out,`${name}-${theme}-${n}-map.png`),Buffer.from(png,'base64'));
    const metric=await page.evaluate(()=>{
     // Warm cache at the host DPR again after the export, then measure draws.
     for(let i=0;i<12;i++)__ghostView.drawGame(i/4);
     const before={images:__svgImages.length,surfaces:__surfaces},ms=[];
     for(let i=0;i<90;i++){const t=performance.now();__ghostView.drawGame(i/30);ms.push(performance.now()-t);}
     ms.sort((a,b)=>a-b);
     return {images:__svgImages.length-before.images,surfaces:__surfaces-before.surfaces,p95:ms[Math.floor(ms.length*.95)]};
    });
    assert.equal(metric.images,0,'steady frames reuse decoded prop/actor SVGs');
    assert.equal(metric.surfaces,0,'steady frames reuse scenery');timings.push({theme,n,p95:metric.p95});
   }
   // The existing inspector shows the same real collider IDs and can be closed.
   await page.locator('#botGhostIdsBtn').click();
   assert.equal(await page.evaluate(()=>__ghostView.round.ghost.showObstacleIds),true);
   await page.locator('#botGhostIdsBtn').click();
   assert.equal(await page.evaluate(()=>__ghostView.round.ghost.showObstacleIds),false);
  }
  assert.equal(snapshots.size,4);
  // A real browser reload recreates the exact same themed layout.
  await page.reload();await page.evaluate(()=>document.getElementById('offlineBtn').click());
  const reload=await page.evaluate(()=>{
   const a=__ghostView;a.players.splice(6);while(a.players.length<6)a.addLocal();a.startRound('ghost');
   const s=a.round.ghost;return {id:s.mapId,geometry:JSON.stringify(s.obstacles)};
  });
  assert.equal(reload.geometry,snapshots.get(reload.id));
  await page.goto(base+'/tools/art-preview.html');
  for(const n of ['6','12'])await page.locator('#count').selectOption(n);
  // WebKit can report an access-control failure for a blob: image while a
  // document is being torn down during reload/navigation. That resource
  // cancellation is not a JavaScript page error in the current document.
  // Preserve every other pageerror, including all script/runtime failures.
  const unexpectedErrors=errors.filter(message=>name!=='webkit'||
   !/^Cannot load blob: [^\n]+ due to access control checks\.$/.test(message));
  assert.deepEqual(unexpectedErrors,[],'HOST, reload and art gallery produce no browser errors');
  console.log('GHOST BROWSER PASS '+name+': 1/6/7/12-player host, 4 layouts, SVG decoding, inspector, reload, cached drawing. '+JSON.stringify(timings));
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
