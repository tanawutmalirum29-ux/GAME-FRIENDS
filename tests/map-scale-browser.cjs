/* Real browser scale smoke: 15 game modes × every 1–12-player count.
 * The deterministic loop renders each actual HOST canvas, not just syntax.
 * Chromium + WebKit executions are invoked from verify.yml. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require('playwright');
const browserName=process.env.BOARD_BROWSER||'chromium';
const root=path.resolve(__dirname,'..');
const out=process.env.MAP_SCALE_SCREENSHOTS||'/tmp/game-friends-board/map-scale';
const hook='window.__mapScaleView={startRound,addLocal,returnToLobby,drawGame,renderLeaderboard,get round(){return round},get players(){return players}};requestAnimationFrame(animate);\n})();';
const modes=[
 ['fruit_memory','fruitMemory'],['color_switch','colorSwitch'],['chickens','chickens'],
 ['snow_brawl','snowBrawl'],['knight_match','knightMatch'],['lawn_mower','lawnMower'],
 ['color_claim','colorClaim'],['witching_snake','witchingSnake'],['ghost','ghost'],
 ['ice_race','iceRace'],['shockwave','shockwave'],['boulder_bash','boulderBash'],
 ['shopping_time','shoppingTime'],['pizza_time','pizzaTime'],['gladiators','gladiators']
];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 let body=fs.readFileSync(file);
 if(file===path.join(root,'app.js')){
  const source=body.toString();
  assert.ok(source.includes('requestAnimationFrame(animate);\n})();'),'HOST hook is required');
  body=source.replace('requestAnimationFrame(animate);\n})();',hook);
 }
 res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript',
  '.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[path.extname(file)]||'application/octet-stream');
 res.end(body);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await playwright[browserName].launch({headless:true,...(browserName==='chromium'?{
  executablePath:process.env.CHROME_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),
  args:['--no-sandbox']}:{} )});
 try{
  fs.mkdirSync(out,{recursive:true});
  const context=await browser.newContext({viewport:{width:1180,height:820},deviceScaleFactor:2});
  await context.route('https://**/*',route=>route.fulfill({body:'',contentType:'text/javascript'}));
  await context.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base);
  await page.evaluate(()=>document.getElementById('offlineBtn').click());
  let checks=0;
  for(const [mode,key] of modes){
   for(let n=1;n<=12;n++){
    const result=await page.evaluate(({mode,key,n})=>{
     const app=window.__mapScaleView;
     if(!app)throw Error('Missing HOST browser QA hook');
     app.returnToLobby();
     app.players.splice(n);
     while(app.players.length<n)app.addLocal();
     app.startRound(mode);
     if(app.round?.mode!==mode)throw Error('Mode did not start: '+mode);
     const state=app.round[key];
     if(!state)throw Error('State is missing: '+key);
     app.round.phase='playing';
     app.drawGame(1.25);
     const canvas=document.getElementById('arena'),rect=canvas.getBoundingClientRect();
     const players=app.players;
     let tile=null;
     if(mode==='fruit_memory')tile={w:state.tileW,h:state.tileH,
       boardW:state.board.w,boardX:state.board.x};
     if(mode==='color_switch')tile={w:state.size,h:state.size,
       boardW:state.board.w,boardX:state.board.x};
     return {count:players.length,mode:app.round.mode,
      width:rect.width,height:rect.height,
      canvasW:canvas.width,canvasH:canvas.height,
      finite:players.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),
      unique:new Set(players.map(p=>p.x.toFixed(3)+','+p.y.toFixed(3))).size,
      tile,unit:state.unit||null};
    },{mode,key,n});
    assert.equal(result.count,n,mode+' '+n+': roster');
    assert.equal(result.unique,n,mode+' '+n+': spawn collision');
    assert.equal(result.finite,true,mode+' '+n+': invalid actor position');
    assert.ok(result.width>=300&&result.height>=140&&result.canvasW>0&&result.canvasH>0,
      mode+' '+n+': invisible host canvas');
    if(mode==='fruit_memory'){
     assert.equal(result.tile.w,80);assert.equal(result.tile.h,80);
     assert.equal(result.tile.boardW,(n<=6?4:5)*80);
    }
    if(mode==='color_switch'){
     assert.equal(result.tile.w,44);assert.equal(result.tile.h,44);
     assert.equal(result.tile.boardW,(n<=6?11:13)*44);
    }
    if(mode==='chickens')assert.ok(Math.abs(result.unit-(n<=4?1:n<=8?1.25:1.5))<1e-8);
    if(n===6||n===7||n===12){
     if(['fruit_memory','color_switch','chickens'].includes(mode)){
      await page.locator('#arena').screenshot({
       path:path.join(out,`${browserName}-${mode}-${n}p.png`)});
     }
    }
    checks++;
   }
   assert.deepEqual(errors,[],mode+' browser errors');
  }
  // Final small-landscape host regression: tiers must not collapse the canvas.
  await page.setViewportSize({width:844,height:390});
  for(const [mode,key] of modes.slice(0,3)){
   for(const n of [1,6,7,12]){
    const result=await page.evaluate(({mode,n})=>{
     const a=__mapScaleView;a.returnToLobby();a.players.splice(n);
     while(a.players.length<n)a.addLocal();
     a.startRound(mode);a.round.phase='playing';a.drawGame(1.5);
     const r=document.getElementById('arena').getBoundingClientRect();
     return {mode:a.round.mode,n:a.players.length,w:r.width,h:r.height};
    },{mode,key,n});
    assert.equal(result.mode,mode);
    assert.equal(result.n,n);
    assert.ok(result.w>0&&result.h>0,'mobile HOST canvas visible');
    checks++;
   }
  }
  assert.deepEqual(errors,[],'no uncaught browser exceptions');
  console.log('MAP SCALE BROWSER PASS:',browserName,checks,'live HOST draws across 15 engines and 1–12 players, mobile spot checks');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
