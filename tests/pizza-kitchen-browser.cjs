/* Real HOST, shared SVG decoding and serving visuals in Chromium/WebKit. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require('playwright'),name=process.env.BOARD_BROWSER||'chromium';
const root=path.resolve(__dirname,'..'),out=process.env.PIZZA_SCREENSHOTS||'/tmp/game-friends-board/pizza-kitchen';
const hook='window.__pizzaView={startRound,addLocal,returnToLobby,drawGame,get round(){return round},get players(){return players}};requestAnimationFrame(animate);\n})();';
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
   if(window.OffscreenCanvas){const NativeCanvas=window.OffscreenCanvas;window.OffscreenCanvas=class extends NativeCanvas{constructor(...args){super(...args);window.__surfaces++;}};}
  });
  const page=await context.newPage(),errors=[],timings=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base);await page.evaluate(()=>document.getElementById('offlineBtn').click());
  async function decode(){
   await page.evaluate(async()=>{
    for(let pass=0;pass<2;pass++){
     for(let i=0;i<12;i++)__pizzaView.drawGame(i/4);
     await Promise.all(__svgImages.filter(i=>i.src.startsWith('data:image/svg+xml')).map(i=>i.decode()));
    }
    __pizzaView.drawGame(1.2);
   });
  }
  async function capture(label){
   await decode();
   await page.locator('#arena').screenshot({path:path.join(out,`${name}-${label}-host.png`)});
   const png=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
    const c=canvas.getContext('2d');c.scale(2,2);PizzaTime.draw(c,1.2,__pizzaView.round,__pizzaView.players);
    return canvas.toDataURL('image/png').split(',')[1];
   });
   fs.writeFileSync(path.join(out,`${name}-${label}-map.png`),Buffer.from(png,'base64'));
  }
  for(const n of [1,4,6,9,12]){
   const info=await page.evaluate(n=>{
    const a=__pizzaView;a.returnToLobby();a.players.splice(n);while(a.players.length<n)a.addLocal();
    a.startRound('pizza_time');a.round.pizzaSeed=102;PizzaTime.setup(a.round,a.players);a.round.phase='playing';
    for(const p of a.players){p.isBot=false;p.input={axisX:0,axisY:0};}
    a.drawGame(1.2);return {players:a.players.length,chefs:a.round.pizzaTime.chefs.length};
   },n);
   assert.equal(info.players,n);assert.equal(info.chefs,n);
   await decode();
   assert.equal(await page.evaluate(()=>__svgImages.filter(i=>i.src.startsWith('data:image/svg+xml')).every(i=>i.complete&&i.naturalWidth>0)),true,'every actual SVG decodes');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true,'HOST fits the screen');
   if(n===4||n===12){
    // Pick up with authoritative rules, then carry left, right and back toward
    // the chef. Empty and full plates use the actual facing vector.
    const carry=await page.evaluate(()=>{
     const a=__pizzaView,s=a.round.pizzaTime,p=a.players[0],id=p.pizza.order[0];
     Object.assign(p,s.tables.find(t=>t.ingredient===id).pick);
     PizzaTime.update(1/60,a.round,a.players);p.dir={x:0,y:-1};
     const plate=PizzaKitchenArt.carryPose(s,p);
     return {held:p.pizza.held,expected:id,above:plate.y<p.y};
    });
    assert.equal(carry.held,carry.expected);assert.equal(carry.above,true);
    await capture(n+'-carrying');
    const delivery=await page.evaluate(()=>{
     const a=__pizzaView,s=a.round.pizzaTime,p=a.players[0],id=p.pizza.held;
     Object.assign(p,s.chefById.get(p.id).deliver);PizzaTime.update(1/60,a.round,a.players);
     a.drawGame(1.2);
     return {id,held:p.pizza.held,placed:PizzaKitchenArt.counterContents(s,p).ingredients.map(x=>x.id),score:p.score,status:PizzaTime.playerStatus(p)};
    });
    assert.equal(delivery.held,null);assert.deepEqual(delivery.placed,[delivery.id]);assert.equal(delivery.score,0);
    assert.deepEqual(delivery.status.delivered,delivery.placed,'phone status and physical tray agree');
    await capture(n+'-delivered');
    const complete=await page.evaluate(()=>{
     const a=__pizzaView,s=a.round.pizzaTime,p=a.players[0],id=p.pizza.order.find(id=>!p.pizza.delivered.includes(id));
     Object.assign(p,s.tables.find(t=>t.ingredient===id).pick);PizzaTime.update(1/60,a.round,a.players);
     Object.assign(p,s.chefById.get(p.id).deliver);PizzaTime.update(1/60,a.round,a.players);
     for(let i=0;i<25;i++)PizzaTime.update(1/60,a.round,a.players);
     return {score:p.score,serial:p.pizza.orderSerial,dish:PizzaKitchenArt.counterContents(s,p).pizza?.length};
    });
    assert.deepEqual(complete,{score:1,serial:2,dish:2});await capture(n+'-served');
   }else await capture(n+'-layout');
   const metric=await page.evaluate(()=>{
    const a=__pizzaView,s=a.round.pizzaTime;
    for(let i=0;i<12;i++)a.drawGame(i/4);
    const before={images:__svgImages.length,surfaces:__surfaces},ms=[];
    const state=JSON.stringify({seed:s.seed,clock:s.clock,players:a.players.map(PizzaTime.playerStatus)});
    for(let i=0;i<90;i++){const t=performance.now();a.drawGame(i/30);ms.push(performance.now()-t);}
    ms.sort((a,b)=>a-b);
    return {images:__svgImages.length-before.images,surfaces:__surfaces-before.surfaces,p95:ms[Math.floor(ms.length*.95)],
     unchanged:state===JSON.stringify({seed:s.seed,clock:s.clock,players:a.players.map(PizzaTime.playerStatus)})};
   });
   assert.equal(metric.images,0,'steady frames reuse SVG images');assert.equal(metric.surfaces,0,'steady frames reuse cached kitchen');
   assert.equal(metric.unchanged,true,'drawing cannot alter game state or RNG');timings.push({n,p95:metric.p95});
  }
  await page.setViewportSize({width:844,height:390});await page.evaluate(()=>__pizzaView.drawGame(2));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true);
  await page.screenshot({path:path.join(out,`${name}-12-landscape.png`)});
  await page.reload();await page.evaluate(()=>document.getElementById('offlineBtn').click());
  await page.evaluate(()=>{__pizzaView.startRound('pizza_time');__pizzaView.drawGame(0);});await decode();
  assert.deepEqual(errors,[],'HOST, SVG load, gameplay, resize and reload have no browser errors');
  console.log('PIZZA BROWSER PASS '+name+': 1/4/6/9/12-player host, SVG decode, real pickup/delivery/serving, phone state, cached rendering, landscape/reload. '+JSON.stringify(timings));
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
