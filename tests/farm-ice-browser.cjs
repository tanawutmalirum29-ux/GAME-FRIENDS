/* Actual HOST, SVG decoding, controls, scored props and stable render caches. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require('playwright'),name=process.env.BOARD_BROWSER||'chromium';
const root=path.resolve(__dirname,'..'),out=process.env.FARM_ICE_SCREENSHOTS||'/tmp/game-friends-board/farm-ice';
const hook='window.__farmView={startRound,addLocal,returnToLobby,drawGame,renderLeaderboard,get round(){return round},get players(){return players}};requestAnimationFrame(animate);\n})();';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 let body=fs.readFileSync(file);
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
   window.requestAnimationFrame=()=>0;window.__farmImages=[];window.__farmSurfaces=0;
   const NativeImage=window.Image;window.Image=class extends NativeImage{constructor(...args){super(...args);__farmImages.push(this);}};
   if(window.OffscreenCanvas){const Native=window.OffscreenCanvas;window.OffscreenCanvas=class extends Native{constructor(...args){super(...args);__farmSurfaces++;}};}
  });
  const page=await context.newPage(),errors=[],timings=[],base='http://127.0.0.1:'+server.address().port;
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(base);await page.evaluate(()=>document.getElementById('offlineBtn').click());
  const assets=await page.evaluate(async()=>{
   const result=[];
   for(const kind of ['chicken','chicken-flap','water','island','cliff0','cliff1','cliff2','rock0','rock1','rock2','tree']){
    const svg=FarmIceArt.assetSVG(kind,'#ef6556'),parsed=new DOMParser().parseFromString(svg,'image/svg+xml');
    if(parsed.querySelector('parsererror'))throw Error('Malformed SVG: '+kind);
    const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await image.decode();
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const g=canvas.getContext('2d');g.drawImage(image,0,0,128,128);
    const data=g.getImageData(0,0,128,128).data,colors=new Set();let visible=0;
    for(let i=0;i<data.length;i+=4)if(data[i+3]){visible++;colors.add(data[i]+','+data[i+1]+','+data[i+2]);}
    result.push({kind,visible,colors:colors.size});
   }
   return result;
  });
  for(const a of assets){assert.ok(a.visible>3000,a.kind+' has a visible body');assert.ok(a.colors>50,a.kind+' rasterizes its shading');}
  async function decode(){await page.evaluate(async()=>{
   for(let pass=0;pass<2;pass++){
    __farmView.drawGame(1.5);
    await Promise.all(__farmImages.filter(i=>i.src.startsWith('data:image/svg+xml')).map(i=>i.decode()));
   }
   __farmView.renderLeaderboard();__farmView.drawGame(1.5);
  });}
  async function assertSafeScene(){
   const v=await page.evaluate(()=>{
    const canvas=document.getElementById('arena'),v=FarmIceArt.viewport(canvas.getContext('2d'));
    return {...v,badge:PartyArenaScenes.badgeBottomY()};
   });
   assert.ok(v.y>=v.badge+5,'the whole scene starts below the shared HUD');
   assert.ok(Math.abs(v.y+540*v.scale-540)<1e-8,'the bottom of the world stays in view');
   assert.ok(v.x>=0&&v.x+960*v.scale<=960,'both sides of the world stay in view');
  }
  for(const [mode,engine,key] of [['chickens','Chickens','chickens'],['snow_brawl','SnowBrawl','snowBrawl'],['boulder_bash','BoulderBash','boulderBash']])for(const n of [1,3,4,6,8,9,12]){
   await page.evaluate(({mode,engine,n})=>{
    const a=__farmView;a.returnToLobby();a.players.splice(n);while(a.players.length<n)a.addLocal();
    a.startRound(mode);a.round.boulderSeed=42;window[engine].setup(a.round,a.players);a.round.phase='playing';
    for(const p of a.players){p.isBot=false;p.input={};}
   },{mode,engine,n});
   if(mode==='chickens'){
    const result=await page.evaluate(()=>{
     const a=__farmView,s=a.round.chickens,p=a.players[0],bird=s.chickens[0],pen=s.pens[0];
     p.x=s.center.x;p.y=s.center.y;p.dir={x:1,y:0};
     bird.x=p.x+12;bird.y=p.y;bird.invulnerable=0;Chickens.update(1/60,a.round,a.players);
     const caught=p.carriedChickenId===bird.id&&bird.status==='carried';
     const carryError=Math.hypot(bird.x-p.x-p.dir.x*37,bird.y-p.y-p.dir.y*37);
     p.x=s.center.x+pen.normal.x*(s.radius-16);p.y=s.center.y+pen.normal.y*(s.radius-16);p.dir=pen.normal;
     for(let i=0;i<10;i++)Chickens.update(1/60,a.round,a.players);
     const deposited=bird.status==='penned'&&bird.penId===pen.id,score=p.score;
     for(let i=0;i<10;i++)Chickens.update(1/60,a.round,a.players);
     const actual={x:bird.x,y:bird.y},slot=pen.slots[0];
     p.x=s.center.x-65;p.y=s.center.y;
     // A second genuine pickup leaves a bird visibly held in the review frame.
     const next=s.chickens.find(c=>c.status==='free');next.x=p.x+12;next.y=p.y;next.invulnerable=0;
     p.dir={x:1,y:0};Chickens.update(1/60,a.round,a.players);
     return {caught,carryError,deposited,score,after:p.score,actual,slot};
    });
    assert.equal(result.caught,true);assert.ok(result.carryError<1e-6);assert.equal(result.deposited,true);
    assert.equal(result.score,1);assert.equal(result.after,1);assert.deepEqual(result.actual,result.slot);
   }
   if(mode==='snow_brawl'){
    const result=await page.evaluate(()=>{
     const a=__farmView,s=a.round.snowBrawl,p=a.players[0];p.x=0;p.y=0;p.dir={x:1,y:0};p.input={axisX:1};
     for(let i=0;i<24;i++)SnowBrawl.update(1/60,a.round,a.players);
     const grown=s.balls.find(b=>b.ownerId===p.id),radius=grown?.r;
     p.input={action:true};for(let i=0;i<11;i++)SnowBrawl.update(1/60,a.round,a.players);
     return {radius,rolling:grown.state==='ROLLING',distance:Math.hypot(grown.x-p.x,grown.y-p.y),scale:SnowBrawl.viewScale(s)};
    });
    assert.ok(result.radius>12);assert.equal(result.rolling,true);assert.ok(result.distance>40);
   }
   if(mode==='boulder_bash'){
    const result=await page.evaluate(()=>{
     const a=__farmView,s=a.round.boulderBash,p=a.players[0],r=BoulderBash.rockAt(s,p.y);
     r.x=p.x+r.r+BoulderBash.config.radius+3;r.y=p.y;r.oldX=r.x;r.oldY=r.y;r.vx=-390;r.vy=0;
     BoulderBash.update(1/60,a.round,a.players);const hit=!p.bb.alive;
     BoulderBash.setup(a.round,a.players);a.round.phase='playing';const state=a.round.boulderBash;
     const rock=BoulderBash.rockAt(state,355);Object.assign(rock,{x:690,oldX:690,y:355,oldY:355});
     return {hit,bounds:state.bounds,starts:a.players.map(p=>({x:p.x,y:p.y}))};
    });assert.equal(result.hit,true);assert.equal(result.bounds.x,218);assert.ok(result.starts.every(p=>p.x===290||p.x===363));
   }
   await decode();
   await assertSafeScene();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true,'HOST fits its viewport');
   if(n===4||n===12){
    await page.locator('#arena').screenshot({path:path.join(out,`${name}-${mode}-${n}-host.png`)});
    const png=await page.evaluate(engine=>{
     const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const g=canvas.getContext('2d');g.scale(4/3,4/3);
     window[engine].draw(g,1.5,__farmView.round,__farmView.players);return canvas.toDataURL('image/png').split(',')[1];
    },engine);
    fs.writeFileSync(path.join(out,`${name}-${mode}-${n}-map.png`),Buffer.from(png,'base64'));
   }
   const metric=await page.evaluate(key=>{
    const a=__farmView,s=a.round[key];for(let i=0;i<5;i++)a.drawGame(i/10);
    const before={images:__farmImages.length,surfaces:__farmSurfaces},state=JSON.stringify({s,players:a.players}),ms=[];
    for(let i=0;i<35;i++){const start=performance.now();a.drawGame(i/30);ms.push(performance.now()-start);}
    ms.sort((a,b)=>a-b);
    return {images:__farmImages.length-before.images,surfaces:__farmSurfaces-before.surfaces,p95:ms[Math.floor(ms.length*.95)],unchanged:state===JSON.stringify({s,players:a.players})};
   },key);
   assert.equal(metric.images,0);assert.equal(metric.surfaces,0);assert.equal(metric.unchanged,true);
   // A generous headless-CI ceiling catches vector-cache replay stalls, which
   // previously took over a second per farm frame after fitting under the HUD.
   assert.ok(metric.p95<100,mode+' '+n+' cached render stalled: '+metric.p95+'ms');
   timings.push({mode,n,p95:metric.p95});
   if(mode==='snow_brawl'){
    const extra=await page.evaluate(()=>{
     const s=__farmView.round.snowBrawl,start=__farmSurfaces,scale=SnowBrawl.viewScale(s);
     for(let i=0;i<40;i++){s.radius*=.98;__farmView.drawGame(i/30);}
     const after=SnowBrawl.viewScale(s);s.radius=s.baseRadius;
     return {surfaces:__farmSurfaces-start,scale,after};
    });assert.equal(extra.surfaces,0,'shrinking ice must reuse water cache');assert.equal(extra.scale,extra.after);
   }
   if(n===12){
    await page.setViewportSize({width:844,height:390});await page.evaluate(()=>{__farmView.renderLeaderboard();__farmView.drawGame(2);});
    await assertSafeScene();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true);
    await page.screenshot({path:path.join(out,`${name}-${mode}-12-landscape.png`)});await page.setViewportSize({width:1440,height:900});
   }
  }
  await page.reload();await page.evaluate(()=>{document.getElementById('offlineBtn').click();__farmView.startRound('chickens');});await decode();
  await page.goto(base+'/tools/art-preview.html');
  assert.equal(await page.locator('canvas').count(),11,'standalone gallery contains all upgraded scenes');
  assert.deepEqual(errors,[],'SVG assets, HOST controls, resizing and reload stay error-free');
  console.log('FARM/ICE BROWSER PASS '+name+': 21 real HOST rounds, 11 rasterized assets, pickup/deposit, snow growth/release, boulder sweep, stable caches and phone landscape. '+JSON.stringify(timings));
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
