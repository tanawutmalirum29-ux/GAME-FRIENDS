/* Real HOST and SVG rasterization in Chromium + WebKit, with review images. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require('playwright'),name=process.env.BOARD_BROWSER||'chromium';
const root=path.resolve(__dirname,'..'),out=process.env.ARENA_SCREENSHOTS||'/tmp/game-friends-board/party-arenas';
const hook='window.__arenaView={startRound,addLocal,returnToLobby,drawGame,renderLeaderboard,beginGameSelection,get round(){return round},get players(){return players}};requestAnimationFrame(animate);\n})();';
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
   window.requestAnimationFrame=()=>0;window.__svgImages=[];window.__surfaces=0;
   const NativeImage=window.Image;window.Image=class extends NativeImage{constructor(...args){super(...args);window.__svgImages.push(this);}};
   if(window.OffscreenCanvas){const Native=window.OffscreenCanvas;window.OffscreenCanvas=class extends Native{constructor(...a){super(...a);window.__surfaces++;}};}
  });
  const page=await context.newPage(),errors=[],timings=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base);await page.evaluate(()=>document.getElementById('offlineBtn').click());
  const svgResult=await page.evaluate(async()=>{
   const all=[];
   for(const id of PartyGameCovers.ids){
    const svg=PartyGameCovers.svg(id),parsed=new DOMParser().parseFromString(svg,'image/svg+xml');
    if(parsed.querySelector('parsererror'))throw Error('Invalid SVG '+id);
    const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await image.decode();
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const g=canvas.getContext('2d');g.drawImage(image,0,0);
    const data=g.getImageData(0,0,320,180).data,colors=new Set();let opaque=0;
    for(let i=0;i<data.length;i+=16){if(data[i+3])opaque++;colors.add([data[i],data[i+1],data[i+2]].join(','));}
    all.push({id,opaque,colors:colors.size});
   }
   return all;
  });
  assert.equal(svgResult.length,12);for(const r of svgResult){assert.ok(r.opaque>13000,r.id+' fills the cover');assert.ok(r.colors>150,r.id+' is a complete rendered scene');}
  assert.equal(await page.locator('[data-pick] svg[data-cover]').count(),12,'phone picker has every new cover');
  await page.evaluate(()=>{while(__arenaView.players.length<4)__arenaView.addLocal();document.getElementById('cycleAllBotsBtn').click();});
  assert.equal(await page.locator('#bulkBotPickerChoices svg[data-cover]').count(),12);
  await page.locator('#bulkBotPicker').screenshot({path:path.join(out,`${name}-all-bot-covers.png`)});
  await page.locator('.bulk-bot-game-choice[data-mode="shopping_time"]').click();
  assert.equal(await page.evaluate(()=>__arenaView.players.every(p=>!p.isBot||p.choice==='shopping_time')),true);
  await page.evaluate(()=>__arenaView.beginGameSelection('witching_snake'));
  assert.equal(await page.locator('#rouletteTrack svg[data-cover]').count(),12);
  const duplicate=await page.evaluate(()=>{
   const ids=[...document.querySelectorAll('svg.mode-cover-svg [id]')].map(n=>n.id);return ids.length-new Set(ids).size;
  });assert.equal(duplicate,0,'repeated roulette and bot cards never share paint IDs');
  async function decode(){
   await page.evaluate(async()=>{
    for(let pass=0;pass<2;pass++){
     __arenaView.drawGame(1.2);
     await Promise.all(__svgImages.filter(i=>i.src.startsWith('data:image/svg+xml')).map(i=>i.decode()));
    }
    __arenaView.drawGame(1.2);__arenaView.renderLeaderboard();
   });
  }
  for(const [mode,engine,key] of [['shopping_time','ShoppingTime','shoppingTime'],['knight_match','KnightMatch','knightMatch'],['witching_snake','WitchingSnake','witchingSnake']])for(const n of [1,4,6,9,12]){
   await page.evaluate(({mode,engine,n})=>{
    const a=__arenaView;a.returnToLobby();a.players.splice(n);while(a.players.length<n)a.addLocal();
    a.startRound(mode);Object.assign(a.round,{shoppingSeed:42,knightSeed:42,witchSeed:42});
    window[engine].setup(a.round,a.players);a.round.phase='playing';
    for(const p of a.players){p.isBot=false;p.input={};}
    if(mode==='shopping_time')for(let i=0;i<260;i++)ShoppingTime.update(1/60,a.round,a.players);
    if(mode==='witching_snake'){
     a.players.forEach(p=>p.isBot=true);for(let i=0;i<60;i++)WitchingSnake.update(1/60,a.round,a.players);
    }
    a.drawGame(1.2);
   },{mode,engine,n});
   await decode();
   if(mode==='shopping_time'){
    const pickup=await page.evaluate(()=>{
     const a=__arenaView,s=a.round.shoppingTime,p=a.players[0],q=p.shopping,u=s.unit;
     p.x=s.world.w/2;p.y=270*u;q.angle=0;q.cartX=p.x+34*u;q.cartY=p.y;q.vx=0;q.vy=0;q.basket=[];
     s.objects=s.objects.filter(o=>Math.hypot(o.x-q.cartX,o.y-q.cartY)>120*u);
     s.objects.push({id:s.nextId++,kind:'item',type:'watermelon',active:true,x:q.cartX,y:q.cartY,prevY:q.cartY,dir:1,lane:2,radius:13*u,phase:0});
     ShoppingTime.step(1/60,a.round,a.players);
     return {basket:[...q.basket],score:p.score,phone:ShoppingTime.playerStatus(p).count};
    });
    assert.deepEqual(pickup.basket,['watermelon']);assert.equal(pickup.phone,1);assert.equal(pickup.score,0);
   }
   if(mode==='knight_match'){
    const result=await page.evaluate(()=>{
     const a=__arenaView,s=a.round.knightMatch,p=a.players[0],b=s.balloons.find(b=>b.kind==='normal'&&b.baseOwnerId===p.id);
     p.km.angle=0;p.dir={x:1,y:0};p.x=s.center.x;p.y=s.center.y;p.input={action:true};
     b.x=p.x+61;b.y=p.y+13*.7;s.balloons=[b];const before=p.score;
     KnightMatch.step(1/60,a.round,a.players);
     return {score:p.score-before,popped:!s.balloons.includes(b),tip:p.km.tip,visible:KnightMatch.lanceTip(p,p.km,p.km.visualExtension)};
    });
    assert.equal(result.score,1);assert.equal(result.popped,true);assert.deepEqual(result.tip,result.visible);
    // Restore a full arena for screenshots after verifying the genuine strike.
    await page.evaluate(()=>{KnightMatch.setup(__arenaView.round,__arenaView.players);__arenaView.round.phase='playing';});
   }
   if(mode==='witching_snake')assert.equal(await page.evaluate(()=>__arenaView.players.some(p=>p.ws.trail.length>1)),true,'actual moving brooms leave dangerous trails');
   await decode();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true,'HOST stays within the screen');
   if(n===4||n===12){
    await page.locator('#arena').screenshot({path:path.join(out,`${name}-${mode}-${n}-host.png`)});
    const png=await page.evaluate(engine=>{
     const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const g=canvas.getContext('2d');g.scale(2,2);
     window[engine].draw(g,1.2,__arenaView.round,__arenaView.players);return canvas.toDataURL('image/png').split(',')[1];
    },engine);
    fs.writeFileSync(path.join(out,`${name}-${mode}-${n}-map.png`),Buffer.from(png,'base64'));
   }
   if(mode==='shopping_time'){
    const paid=await page.evaluate(()=>{
     const a=__arenaView,s=a.round.shoppingTime,p=a.players[0],z=s.checkouts[0];p.shopping.cartX=z.x;p.shopping.cartY=z.y;
     ShoppingTime.checkoutPlayer(s,p);const score=p.score;ShoppingTime.checkoutPlayer(s,p);
     return {score,again:p.score,basket:p.shopping.basket.length};
    });assert.deepEqual(paid,{score:1,again:1,basket:0});
   }
   const metric=await page.evaluate(key=>{
    const a=__arenaView,s=a.round[key];for(let i=0;i<8;i++)a.drawGame(i/10);
    const before={images:__svgImages.length,surfaces:__surfaces},state=JSON.stringify({seed:s.seed,clock:s.clock,players:a.players}),ms=[];
    for(let i=0;i<45;i++){const now=performance.now();a.drawGame(i/30);ms.push(performance.now()-now);}
    ms.sort((a,b)=>a-b);
    return {images:__svgImages.length-before.images,surfaces:__surfaces-before.surfaces,p95:ms[Math.floor(ms.length*.95)],unchanged:state===JSON.stringify({seed:s.seed,clock:s.clock,players:a.players})};
   },key);
   assert.equal(metric.images,0);assert.equal(metric.surfaces,0);assert.equal(metric.unchanged,true);timings.push({mode,n,p95:metric.p95});
  }
  await page.setViewportSize({width:844,height:390});await page.evaluate(()=>__arenaView.drawGame(2));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true);
  await page.screenshot({path:path.join(out,`${name}-witch-12-landscape.png`)});
  await page.reload();await page.evaluate(()=>{document.getElementById('offlineBtn').click();__arenaView.startRound('shopping_time');__arenaView.drawGame(0);});await decode();
  assert.deepEqual(errors,[],'real HOST, SVG decoding, input, resizing and reload have no errors');
  // A standalone contact sheet is also a review artifact, independent of UI crop.
  const markup=await page.evaluate(()=>PartyGameCovers.ids.map(id=>`<article>${PartyGameCovers.svg(id)}<p>${id.replaceAll('_',' ').toUpperCase()}</p></article>`).join(''));
  const gallery=await context.newPage();await gallery.setViewportSize({width:1280,height:1100});
  await gallery.setContent(`<style>*{box-sizing:border-box}body{margin:0;padding:18px;background:#172d43;color:#edf1dd;font:14px system-ui;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}svg{width:100%;height:auto}p{text-align:center;margin:4px 0}article{min-width:0}</style>${markup}`);
  await gallery.screenshot({path:path.join(out,`${name}-all-12-covers.png`),fullPage:true});
  console.log('PARTY ARENAS BROWSER PASS '+name+': 1/4/6/9/12 HOST, SVG rasterization, real cart/piercing/trails, 12 covers in phone/bulk/roulette, cached state-isolated frames, resize/reload. '+JSON.stringify(timings));
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
