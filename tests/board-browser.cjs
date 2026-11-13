/* Optional real Chromium layout/input checks. npm install --no-save playwright
   Run: CHROME_PATH=/usr/bin/chromium node tests/board-browser.cjs
   Network transport is covered by smoke.cjs; this forwards rendered phone inputs
   to the host engine so this test needs neither PeerJS servers nor real phones. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.BOARD_SCREENSHOTS||'/tmp/game-friends-board';
const injection=`window.__boardTest={get board(){return boardSession},get round(){return round},get players(){return players},beginBoard,updateBoard,updateRound,drawGame,refreshBoardTools,hostCanControlBoardZoom,pauseGame,resumeGame,addLocal,setView,returnToLobby,layoutFinalResults,beginGameSelection,updateGameSelection,pulse:sendInputs,
 phone(info){controllerReady=true;controllerPlayerActive=true;controllerId='p1';controllerSessionMode='board';
 controllerConn={open:true,send:msg=>window.__boardPackets.push(msg)};window.__boardPackets=[];
 $('controllerName').textContent='Snow explorer';$('controllerAvatar').style.background='#ff628c';
 $('joinForm').classList.add('hidden');$('controllerActive').classList.remove('hidden');document.body.classList.add('controller-playing');
 setView('controller');updatePhoneGamePicker('playing',null);receiveBoardState(info);
 }};requestAnimationFrame(animate);\n})();`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 const type=path.extname(file),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'}[type]||'application/octet-stream';
 let body=fs.readFileSync(file);
 if(file===path.join(root,'index.html'))
  body=require('./helpers/legacy-game-html.cjs').withLegacyGameFixtures(body.toString());if(file===path.join(root,'app.js'))body=body.toString().replace('requestAnimationFrame(animate);\n})();',injection);
 res.writeHead(200,{'content-type':mime});res.end(body);
});
async function noScroll(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true);}
async function toolbarInside(page){
   // Landscape iPad must never paint the HOST roster's 148px dark gradient
   // over the Canvas-rendered BOARD scoreboard or the order-phase headings.
   const backdrop=await page.evaluate(()=>{
     const toolbar=document.querySelector('#game .game-toolbar');
     const css=getComputedStyle(toolbar),rect=toolbar.getBoundingClientRect();
     return{background:css.backgroundImage,height:rect.height,
      body:document.body.className,toolbarExists:!!toolbar};
   });
   assert.ok(backdrop.body.includes('board-playing'),'board host mode must be active');
   assert.equal(backdrop.background,'none','no black overlay over BOARD player HUD');
   assert.ok(backdrop.height<1,'board host toolbar must not cover Canvas header');

   const controls=await page.evaluate(()=>{
     const a=document.getElementById('arena').getBoundingClientRect();
     const height=__boardTest.board.camera.viewHeight||540;
     const scale=Math.min(a.width/960,a.height/height);
     const x=a.left+(a.width-960*scale)/2,y=a.top+(a.height-height*scale)/2;
     return ['boardExitBtn','boardNodeDebugBtn','pauseBtn'].map(id=>{
       const b=document.getElementById(id),r=b.getBoundingClientRect();
       return{id,left:(r.left-x)/scale,top:(r.top-y)/scale,
        width:r.width/scale,height:r.height/scale,
        iconOnly:!!b.querySelector('svg')&&!b.textContent.trim(),
        accessible:!!b.getAttribute('aria-label')};
     });
   });
   assert.deepEqual(controls.map(v=>v.id),['boardExitBtn','boardNodeDebugBtn','pauseBtn']);
   controls.forEach((v,i)=>{
     assert.ok(Math.abs(v.left-[849,885,921][i])<=2&&Math.abs(v.top-101)<=2,
      v.id+' aligns inside the BOARD icon toolbar below the roster');
     assert.ok(Math.abs(v.width-29)<=2&&Math.abs(v.height-27)<=2,
      v.id+' has matching compact icon-button dimensions');
     assert.ok(v.iconOnly&&v.accessible,v.id+' shows an accessible icon without a visible text label');
   });
   assert.equal(await page.locator('#boardTools button').count(),1,'only Show ID remains in the BOARD toolbar');
   for(const id of ['boardOverviewBtn','boardStartDiceBtn','boardFollowBtn','boardZoomInBtn','boardZoomOutBtn','boardEffectsBtn'])
    assert.equal(await page.locator('#'+id).count(),0,'retired BOARD control must not exist: '+id);
}
// Check computed visibility, including the parent #boardTools hidden state.
async function assertBoardMapToolbar(page,visible,stage){
 for(const id of ['boardExitBtn','boardNodeDebugBtn','pauseBtn']){
  assert.equal(await page.locator('#'+id).isVisible(),visible,
   stage+': '+id+' should '+(visible?'be visible':'be hidden'));
 }
}
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const executablePath=process.env.CHROME_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
 try{
  fs.mkdirSync(out,{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2});
  await context.route('https://**/*',route=>route.fulfill({body:'',contentType:'text/javascript'}));
  await context.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  // Safari must be able to stay on /host.html while adding a distinct HOST
  // Web App, rather than being redirected immediately to the controller root.
  const installer=await context.newPage(),installErrors=[];
  installer.on('pageerror',e=>installErrors.push(String(e)));
  await installer.goto(base+'/host.html');
  assert.ok(installer.url().endsWith('/host.html'),
   'Safari installation must stay on the host launcher URL');
  assert.equal(await installer.locator('link[rel="manifest"]').getAttribute('href'),
   './host.webmanifest');
  const hostApp=await installer.evaluate(async()=>{
   const response=await fetch('./host.webmanifest');return response.json();
  });
  assert.equal(hostApp.id,'./host.html');
  assert.equal(hostApp.start_url,'./host.html');
  assert.equal(await installer.locator('h1').innerText(),'GAME FRIENDS — จอหลัก');
  await installer.locator('#openHostBtn').click();
  assert.ok(installer.url().includes('?host=1'),'host entry must retain the host role');
  assert.equal(await installer.locator('link[rel="manifest"]').getAttribute('href'),
   './host.webmanifest','direct host entry also installs as HOST');
  assert.equal(await installer.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content'),'GF HOST');
  assert.equal(await installer.locator('#home').isVisible(),true,'host opens room creation, not a controller');
  await installer.goto(base+'/');
  assert.equal(await installer.locator('link[rel="manifest"]').getAttribute('href'),
   './manifest.webmanifest','root install remains the separate controller');
  assert.equal(await installer.locator('#controller').isVisible(),true);
  assert.deepEqual(installErrors,[],'install and host launch produce no JS errors');
  await installer.close();
  // iPad Safari may capture the page URL instead of manifest start_url.
  // The installed /host.html must still open HOST immediately on standalone.
  const installedContext=await browser.newContext({viewport:{width:1024,height:768}});
  await installedContext.route('https://**/*',route=>route.fulfill({body:'',contentType:'text/javascript'}));
  await installedContext.addInitScript(()=>{
   Object.defineProperty(navigator,'standalone',{configurable:true,get:()=>true});
  });
  const shortcut=await installedContext.newPage();
  await shortcut.goto(base+'/host.html');
  await shortcut.waitForURL(url=>url.searchParams.get('host')==='1');
  assert.equal(await shortcut.locator('#home').isVisible(),true,
   'installed iPad GF HOST shortcut lands directly on the host home');
  assert.equal(await shortcut.locator('#controller').isVisible(),false);
  assert.equal(await shortcut.locator('link[rel="manifest"]').getAttribute('href'),
   './host.webmanifest');
  await installedContext.close();
  // Inspect the actual Chrome geometry: the glowing selection bezel must
  // cover exactly one card, without the oversized green frame in the image.
  const roulette=await context.newPage();await roulette.goto(base+'/?host=1');
  await roulette.locator('#offlineBtn').click();
  for(const size of [{width:1440,height:900},{width:844,height:390},{width:390,height:844}]){
   await roulette.setViewportSize(size);
   const boxes=await roulette.evaluate(()=>{
    __boardTest.returnToLobby();
    __boardTest.beginGameSelection('ghost');
    __boardTest.updateGameSelection(1.45);
    const mark=document.querySelector('#gameRoulette .roulette-center-mark'),
     card=document.querySelectorAll('#rouletteTrack .roulette-option')[9];
    const box=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height};};
    return{mark:box(mark),card:box(card)};
   });
   for(const key of ['x','y','w','h'])
    assert.ok(Math.abs(boxes.mark[key]-boxes.card[key])<2.5,
     size.width+'x'+size.height+' '+key+': selection frame matches the chosen card');
   if(size.width===1440)
    await roulette.screenshot({path:path.join(out,'roulette-aligned.png')});
  }
  await roulette.close();
  const host=await context.newPage(),errors=[];host.on('pageerror',e=>errors.push(String(e)));
  await host.goto(base+'/?host=1');
  // This shared browser context may contain a restored offline lobby from
  // the roulette fixture. Select HOME explicitly before validating its lock.
  await host.evaluate(()=>__boardTest.setView('home'));
  const pageZoom=()=>host.evaluate(()=>({
   content:document.querySelector('#viewportMeta').content,
   locked:document.body.classList.contains('zoom-locked'),
   view:document.querySelector('#home:not(.hidden)')?'home':
        document.querySelector('#hostLobby:not(.hidden)')?'hostLobby':'other'
  }));
  const homeZoom=await pageZoom();
  assert.equal(homeZoom.view,'home');
  assert.equal(homeZoom.locked,true,'Host HOME must never allow native page zoom');
  assert.match(homeZoom.content,/user-scalable=no/);
  await host.evaluate(()=>document.getElementById('offlineBtn').click());
  const lobbyZoom=await pageZoom();
  assert.equal(lobbyZoom.view,'hostLobby');
  assert.equal(lobbyZoom.locked,true,'Host lobby must never allow native page zoom');
  assert.match(lobbyZoom.content,/maximum-scale=1/);
  for(let n=1;n<=12;n++){
   await host.evaluate(n=>{const a=__boardTest;a.returnToLobby();a.players.splice(n);while(a.players.length<n)a.addLocal();a.beginBoard();a.drawGame(0);},n);
   assert.equal(await host.evaluate(()=>__boardTest.board.players.length),n);await noScroll(host);
   await toolbarInside(host);
  }
  await host.screenshot({path:path.join(out,'overview-12.png')});
  await assertBoardMapToolbar(host,true,'initial BOARD map panorama');
  assert.equal(await host.locator('#boardTools button').count(),1);
   await host.evaluate(()=>{for(let i=0;i<70;i++)__boardTest.updateBoard(.05);__boardTest.drawGame(__boardTest.board.time);});
   assert.equal(await host.evaluate(()=>__boardTest.board.phase),'order','2s panorama + 1.5s fly-in begins automatically');
  await host.screenshot({path:path.join(out,'order-12.png')});
  await assertBoardMapToolbar(host,false,'BOARD dice-order overlay');
  await host.screenshot({path:path.join(out,'board-order.jpg'),type:'jpeg',quality:82,scale:'css'});
  async function drawnTexts(){return host.evaluate(()=>{
   const g=document.getElementById('arena').getContext('2d'),text=g.fillText,seen=[];
   g.fillText=function(value,...args){seen.push(String(value));return text.call(this,value,...args);};
   try{__boardTest.drawGame(__boardTest.board.time);}finally{g.fillText=text;}return seen;
  });}
  // During dice ordering there is no current turn: spectators may not
  // invoke a zoom-changing Overview/Follow camera action.
  assert.equal(await host.evaluate(()=>__boardTest.hostCanControlBoardZoom()),false,
    'no host owner may zoom or force overview before the turn is assigned');
  await host.evaluate(()=>{
   const a=__boardTest,s=a.board;
   s.order=s.players.map(p=>p.id);s.players[0].isBot=false;a.players[0].isBot=false;
   BoardParty.startTurn(s);BoardParty.beginMove(s,s.players[0],2);
   a.updateBoard(.05);a.drawGame(s.time);
  });
  await host.evaluate(()=>{__boardTest.pauseGame();BoardArt.overview(__boardTest.board);});
  assert.equal(await host.evaluate(()=>__boardTest.round.paused),true);
  assert.equal((await drawnTexts()).includes('ทอยลูกเต๋าเพื่อจัดลำดับ'),false,
    'overview hides any dice-order overlay while inspecting the map');
  await host.evaluate(()=>{BoardArt.follow(__boardTest.board);__boardTest.resumeGame();});
  assert.equal(await host.evaluate(()=>__boardTest.round.paused),false,
    'local turn owner can follow/resume after inspecting overview');
  assert.equal(await host.evaluate(()=>__boardTest.board.phase),'move_ready');
  await host.evaluate(()=>__boardTest.refreshBoardTools());
  await assertBoardMapToolbar(host,true,'BOARD active map restored');

  for(const view of [{width:1440,height:900},{width:1024,height:768},{width:844,height:390}]){
   await host.setViewportSize(view);
   await host.evaluate(()=>{__boardTest.beginBoard();__boardTest.drawGame(0);});
   await noScroll(host);await toolbarInside(host);
   const rect=await host.locator('#arena').boundingBox();assert.ok(rect.x>=-1&&rect.y>=-1&&rect.x+rect.width<=view.width+1&&rect.y+rect.height<=view.height+1);
   const bitmap=await host.locator('#arena').evaluate(c=>({w:c.width,h:c.height}));assert.ok(bitmap.w>=960&&bitmap.h>=540);
   await host.screenshot({path:path.join(out,`order-${view.width}.png`)});
  }
  // Safari can resume from the background without any resize event, leaving
  // a portrait-proportioned bitmap inside a landscape frame (black sidebars).
  // Invalidate that stale bitmap via the same focus/visibility lifecycle.
  await host.setViewportSize({width:1474,height:1024});
  await host.evaluate(()=>{
   __boardTest.drawGame(0);
   const canvas=document.getElementById('arena');
   canvas.width=960;canvas.height=890;
   document.dispatchEvent(new Event('visibilitychange'));
   window.dispatchEvent(new Event('focus'));
  });
  await host.waitForTimeout(260);
  await host.evaluate(()=>__boardTest.drawGame(0));
  const resumed=await host.evaluate(()=>{
   const canvas=document.getElementById('arena'),rect=canvas.getBoundingClientRect();
   return{worldH:__boardTest.board.camera.viewHeight,cssRatio:rect.width/rect.height,
    bitmapRatio:canvas.width/canvas.height,cssWidth:rect.width,
    gameWidth:document.getElementById('game').getBoundingClientRect().width,
    zoomLocked:document.body.classList.contains('zoom-locked')};
  });
  assert.ok(Math.abs(resumed.cssRatio-resumed.bitmapRatio)<.025,
    'resumed BOARD bitmap must match viewport aspect without black sidebars');
  assert.ok(Math.abs(resumed.cssWidth-resumed.gameWidth)<3,
    'restored BOARD scene covers entire Host width');
  assert.equal(resumed.zoomLocked,true,'resume keeps Host page zoom locked');
  assert.ok(resumed.worldH>540&&resumed.worldH<850,
    'BOARD world height recalculated from restored landscape viewport');
  await host.setViewportSize({width:1024,height:768});
  await host.evaluate(()=>__boardTest.drawGame(0));
  // The real host controls must explore the map without touching gameplay state.
  await host.evaluate(()=>{BoardParty.startOrder(__boardTest.board);});
  await host.evaluate(()=>{const a=__boardTest,s=a.board;
   s.order=s.players.map(p=>p.id);s.players.forEach(p=>p.isBot=false);
   a.players[0].isBot=false;BoardParty.startTurn(s);BoardParty.beginMove(s,s.players[0],2);
   a.updateBoard(.05);
  });
  await host.locator('#pauseBtn').click();
  assert.equal(await host.evaluate(()=>__boardTest.round.paused),true);
  let pausedPlayers=await host.evaluate(()=>JSON.stringify(__boardTest.board.players));
  await host.evaluate(()=>BoardArt.overview(__boardTest.board));
  assert.equal(await host.locator('#boardNodeDebugBtn').isVisible(),true,
   'Show ID must be accessible even when humans are playing');
  await host.locator('#boardNodeDebugBtn').click();
  assert.equal(await host.evaluate(()=>__boardTest.board.camera.debugNodes),true);
  // Consume any viewport-resize canvas synchronization before setting a manual
  // zoom. At the board's fit-to-all view (roughly 0.09x), both axes are
  // clamped by map bounds and dragging correctly cannot move the camera.
  await host.evaluate(()=>__boardTest.drawGame(0));
  await host.evaluate(()=>{
    const s=__boardTest.board;
    BoardArt.zoom(s,.4/s.camera.zoom);
    __boardTest.drawGame(0);
  });
  assert.ok(await host.evaluate(()=>__boardTest.board.camera.zoom>=.39),
    'pan regression must start zoomed in, not at the clamped full-map overview');
  const beforePan=await host.evaluate(()=>({...__boardTest.board.camera}));
  const box=await host.locator('#arena').boundingBox(),viewHeight=await host.evaluate(()=>__boardTest.board.camera.viewHeight),scale=Math.min(box.width/960,box.height/viewHeight);
  const arena={x:box.x+(box.width-960*scale)/2,y:box.y+(box.height-viewHeight*scale)/2,width:960*scale,height:viewHeight*scale};
  // Use an actual hit-testable map point. A toolbar can cover part of the canvas.
  const hit=await host.evaluate(arena=>{
    const canvas=document.getElementById('arena');
    for(const [rx,ry] of [[.5,.75],[.4,.55],[.62,.55],[.5,.48],[.3,.75]]){
      const x=arena.x+arena.width*rx,y=arena.y+arena.height*ry;
      if(document.elementFromPoint(x,y)===canvas)return [rx,ry];
    }
    return null;
  },arena);
  assert.ok(hit,'BOARD paused map exposes a real canvas pointer target');
  async function dragMap(dx,dy){
    await host.mouse.move(arena.x+arena.width*hit[0],arena.y+arena.height*hit[1]);
    await host.mouse.down();
    await host.mouse.move(arena.x+arena.width*(hit[0]+dx),arena.y+arena.height*(hit[1]+dy),{steps:5});
    await host.mouse.up();
  }
  await dragMap(.10,.02);
  let afterPan=await host.evaluate(()=>({...__boardTest.board.camera}));
  if(afterPan.x===beforePan.x&&afterPan.y===beforePan.y){
    // A camera pinned to a map edge can clamp a drag in one direction.
    await dragMap(-.10,-.08);
    afterPan=await host.evaluate(()=>({...__boardTest.board.camera}));
  }
  if(afterPan.x===beforePan.x&&afterPan.y===beforePan.y){
    const diagnostic=await host.evaluate(arena=>({
      phase:__boardTest.board.phase,paused:__boardTest.round.paused,
      canPan:BoardArt.canPan(__boardTest.board),camera:__boardTest.board.camera,
      bounds:__boardTest.board.map.bounds,
      hitTarget:document.elementFromPoint(arena.x+arena.width*.5,arena.y+arena.height*.75)?.id||'none'
    }),arena);
    console.error('PAUSED BOARD DRAG DIAGNOSTIC: '+JSON.stringify(diagnostic));
  }
  assert.ok(afterPan.x!==beforePan.x||afterPan.y!==beforePan.y,'real canvas drag pans while paused');
  // The center of this archipelago is open sea. Pan onto a known island for tap inspection.
  await host.evaluate(()=>{const s=__boardTest.board,c=s.camera,p=s.map.nodes.n76.position;BoardArt.pan(s,(c.x-p.x)*c.zoom,(c.y-p.y)*c.zoom);__boardTest.drawGame(0);});
  const target=await host.evaluate(()=>{
   const s=__boardTest.board,c=s.camera,top=94;
   return Object.values(s.map.nodes).map(n=>({id:n.id,x:480+(n.position.x-c.x)*c.zoom,y:(top+c.viewHeight-88)/2+(n.position.y-c.y)*c.zoom})).find(n=>n.x>100&&n.x<860&&n.y>top+40&&n.y<c.viewHeight-120);
  });
  assert.ok(target,'zoomed map has an inspectable node');
  await host.mouse.click(arena.x+target.x*arena.width/960,arena.y+target.y*arena.height/viewHeight);
  assert.equal(await host.evaluate(()=>__boardTest.board.camera.selectedId),target.id);
  await host.evaluate(()=>__boardTest.drawGame(0));
  await host.screenshot({path:path.join(out,'pause-debug.png')});
  assert.equal(await host.evaluate(()=>JSON.stringify(__boardTest.board.players)),pausedPlayers,'camera tools cannot alter players');
  await host.evaluate(()=>BoardArt.overview(__boardTest.board));
  await host.locator('#boardNodeDebugBtn').click();
  await host.locator('#pauseBtn').click();assert.equal(await host.evaluate(()=>__boardTest.round.paused),false);
  await host.setViewportSize({width:1440,height:900});
  await host.locator('#pauseBtn').click();
  await host.evaluate(()=>{BoardArt.overview(__boardTest.board);__boardTest.drawGame(0);});
  assert.equal(await host.evaluate(()=>__boardTest.round.paused),true,'pause freezes an active game');
  await host.evaluate(()=>{__boardTest.board.camera.lowDetail=true;__boardTest.drawGame(0);});
  await host.screenshot({path:path.join(out,'overview-low-detail.png')});
  await host.evaluate(()=>{__boardTest.board.camera.lowDetail=false;__boardTest.drawGame(0);});
  await host.screenshot({path:path.join(out,'board-overview.jpg'),type:'jpeg',quality:88,scale:'css'});
  const timings=await host.evaluate(()=>{
   const samples=[];for(let i=0;i<90;i++){const start=performance.now();__boardTest.drawGame(i/60);samples.push(performance.now()-start);}
   samples.sort((a,b)=>a-b);return{medianMs:samples[45],p95Ms:samples[85],sampleCount:samples.length};
  });
  await host.evaluate(()=>{BoardArt.follow(__boardTest.board);__boardTest.resumeGame();});
  assert.equal(await host.evaluate(()=>__boardTest.round.paused),false,'host can resume paused overview');
  assert.ok(Number.isFinite(timings.p95Ms));console.log('Headless Chromium synchronous host draw timing (not device FPS): '+JSON.stringify(timings));
  await host.evaluate(()=>{const s=__boardTest.board;s.players.forEach(p=>p.isBot=false);s.order=s.players.map(p=>p.id);s.players.forEach((p,i)=>p.currentNodeId='n'+(i+1));s.players[0].currentNodeId='n3';BoardParty.startTurn(s);for(let i=0;i<80;i++){BoardParty.update(s,.01);__boardTest.drawGame(s.time);}});
  await host.screenshot({path:path.join(out,'board-12.png')});
  await host.screenshot({path:path.join(out,'board-preview.jpg'),type:'jpeg',quality:82,scale:'css'});
  // Real browser visual regression: winner row centered, all lower rows
  // full, and no cards overlapping at the 3/4/5/6/7/9/10/12-player sizes.
  for(const count of [3,4,5,6,7,9,10,12]){
   await host.evaluate(n=>{
    const list=document.getElementById('resultList');list.replaceChildren();
    for(let i=0;i<n;i++){
     const card=document.createElement('div');card.className='result-player';
     card.style.animation='none';
     const label=document.createElement('div'),detail=document.createElement('span');
     label.textContent='อันดับ '+(i+1)+' • Bot '+(i+1);
     label.style.color=['#f7899a','#74d7c1','#ffcc78','#83a6ef'][i%4];
     detail.textContent=(n-i)+' คะแนน';
     card.append(label,detail);list.append(card);
    }
    document.getElementById('results').classList.remove('hidden');
    __boardTest.layoutFinalResults();
   },count);
   const p=await host.evaluate(()=>{
    const list=document.getElementById('resultList'),b=list.getBoundingClientRect();
    const box=el=>{const z=el.getBoundingClientRect();
     return{x:z.x,y:z.y,right:z.right,bottom:z.bottom,width:z.width};};
    return{left:b.left,right:b.right,center:b.left+b.width/2,
     cols:Number(list.dataset.cols),top:Number(list.dataset.topCount),
     rows:[...list.querySelectorAll('.result-player')].map(box)};
   });
   const cards=p.rows,topCards=cards.slice(0,p.top),bottom=cards.slice(-p.cols);
   assert.equal(cards.length,count);
   assert.ok(Math.abs((topCards[0].x+topCards.at(-1).right)/2-p.center)<2.5,
    count+' players: short top row centered in the real viewport');
   assert.ok(topCards.every(c=>Math.abs(c.y-topCards[0].y)<2.5));
   if(count>p.cols){
    assert.ok(Math.abs(bottom[0].x-p.left)<2.5,
     count+' players: bottom row fills the left edge');
    assert.ok(Math.abs(bottom.at(-1).right-p.right)<2.5,
     count+' players: bottom row fills the right edge');
    assert.ok(topCards[0].y<bottom[0].y,
     count+' players: rank-one cards sit above the filled lower rows');
   }
   for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){
    const a=cards[i],b=cards[j];
    assert.ok(a.right<=b.x+.5||b.right<=a.x+.5||
      a.bottom<=b.y+.5||b.bottom<=a.y+.5,
     count+' players: rank cards must not overlap');
   }
   if([5,9,12].includes(count))
    await host.screenshot({path:path.join(out,'rankings-'+count+'.png')});
  }
  await host.evaluate(()=>{
   document.getElementById('results').classList.add('hidden');
   document.getElementById('resultList').replaceChildren();
  });
  // Render the real mobile UI and click its actual pointer-bound A/B buttons.
  const mobile=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await mobile.route('https://**/*',route=>route.fulfill({body:'',contentType:'text/javascript'}));
  await mobile.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(String(e)));await phone.goto(base+'/?join=ABC123');
  async function refreshPhone(){
   const info=await host.evaluate(()=>{const s=__boardTest.board,p=s.players[0];return{phase:'playing',canZoom:BoardArt.canPan(s)&&BoardParty.current(s)?.id===p.id,turnId:s.turnId,boardPhase:s.phase,round:s.roundNumber,hp:p.hp,stepsRemaining:BoardParty.remainingSteps(s,p.id),shieldTurns:p.shieldTurns,item:BoardItems.names[p.item]||'ไม่มีไอเทม',bag:BoardItems.bag(p).slice(),actionIndex:p.actionIndex||0,...BoardParty.controls(s,p.id)};});
   await phone.evaluate(info=>__boardTest.phone(info),info);
   const packets=await phone.evaluate(()=>__boardPackets.filter(p=>p.t==='input'));
   await host.evaluate(packets=>{const s=__boardTest.board;for(const p of packets)BoardParty.input(s,s.players[0].id,p);},packets);return info;
  }
  async function tap(button){
   await phone.locator(button).locator('..').tap();const packets=await phone.evaluate(()=>__boardPackets.filter(p=>p.t==='input'));
   await host.evaluate(packets=>{const s=__boardTest.board;for(const p of packets)BoardParty.input(s,s.players[0].id,p);},packets);
  }
  await host.evaluate(()=>{const s=__boardTest.board;s.players[0].bag=['potion'];s.players[0].item='potion';s.players[0].hp=50;s.players[0].currentNodeId='n1';s.players[0].worldPosition=null;s.rng=()=>0;});
  const readyInfo=await refreshPhone();await noScroll(phone);await phone.screenshot({path:path.join(out,'phone.png')});
   // Double-tapping the existing joystick before rolling closes the bag
   // and engages map drag/pinch; the second double-tap restores the SAME slot.
   assert.equal(readyInfo.boardPhase,'ready');
   assert.equal(await phone.locator('#controllerInventory').isVisible(),true);
   const slotBefore=await host.evaluate(()=>__boardTest.board.players[0].actionIndex);
   async function doubleTapReadyJoystick(){
    await phone.evaluate(()=>{
     const zone=document.getElementById('joystickZone'),box=zone.getBoundingClientRect(),
      x=box.left+box.width/2,y=box.top+box.height/2;
     for(let i=0;i<2;i++){
      const id=201+i;
      zone.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:id,clientX:x,clientY:y,pointerType:'touch',isPrimary:true}));
      zone.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerId:id,clientX:x,clientY:y,pointerType:'touch',isPrimary:true}));
     }
    });
   }
   await doubleTapReadyJoystick();
   assert.equal(await phone.locator('#controllerInventory').isVisible(),false,'pre-roll bag closes in map inspection');
   assert.equal(await phone.locator('#joystickZone').evaluate(e=>e.classList.contains('board-camera-mode')),true);
   assert.equal(await phone.evaluate(()=>__boardPackets.some(p=>p.t==='board-camera-mode'&&p.enabled===true)),true);
   await tap('#buttonA');
   assert.equal(await phone.evaluate(()=>__boardPackets.filter(p=>p.t==='input').at(-1)?.keys.action),false,
    'button A cannot roll while camera inspection is active');
   await doubleTapReadyJoystick();
   assert.equal(await phone.locator('#controllerInventory').isVisible(),true,'double-tap returns to backpack');
   assert.equal(await phone.locator('#joystickZone').evaluate(e=>e.classList.contains('board-camera-mode')),false);
   assert.equal(await host.evaluate(()=>__boardTest.board.players[0].actionIndex),slotBefore,'inspect does not change selected item');
  assert.match(await phone.locator('#buttonBLabel').innerText(),/เปลี่ยนไอเทม/);await tap('#buttonB');
  await refreshPhone();assert.match(await phone.locator('#buttonALabel').innerText(),/ใช้ไอเทม/);
  await tap('#buttonA');assert.equal(await host.evaluate(()=>__boardTest.board.players[0].hp),100);
  await host.evaluate(()=>{for(let i=0;i<30;i++)BoardParty.update(__boardTest.board,.05);});await refreshPhone();await tap('#buttonA');
  assert.equal(await host.evaluate(()=>__boardTest.board.phase),'dice');
  await host.evaluate(()=>{const s=__boardTest.board;for(let i=0;i<36;i++)BoardParty.update(s,.05);__boardTest.drawGame(s.time);});
  assert.deepEqual(await host.evaluate(()=>__boardTest.board.moveDice),[1,1]);
  // Inspect the actual Canvas calls: two die faces inside the central third, correct pips/total.
  const diceDrawing=await host.evaluate(()=>{
   const g=document.createElement('canvas').getContext('2d'),faces=[],texts=[],renderer=BoardDiceRenderer;
   const text=g.fillText.bind(g);g.fillText=(...args)=>{texts.push(args[0]);text(...args);};
   window.BoardDiceRenderer={...renderer,draw(g,value,x,y,size,t,index,lite){
    faces.push({value,x,y,front:renderer.frontFace(value,t,index)});
    return renderer.draw(g,value,x,y,size,t,index,lite);
   }};
   try{BoardArt.turnDice(g,__boardTest.board);}finally{window.BoardDiceRenderer=renderer;}
   return{faces,texts};
  });
  assert.equal(diceDrawing.faces.length,2);
  assert.ok(diceDrawing.faces.every(p=>p.value===1&&p.front===1&&p.x>320&&p.x<640&&p.y>180&&p.y<360));
  assert.ok(diceDrawing.faces[0].x<diceDrawing.faces[1].x);
  assert.ok(diceDrawing.texts.some(s=>String(s).includes('2 ก้าว')));
  await host.screenshot({path:path.join(out,'dice-center.png')});
  await host.screenshot({path:path.join(out,'board-dice.jpg'),type:'jpeg',quality:82,scale:'css'});
  await host.evaluate(()=>{const s=__boardTest.board;for(let i=0;i<20;i++)BoardParty.update(s,.05);__boardTest.drawGame(s.time);});
  assert.equal(await host.evaluate(()=>__boardTest.board.phase),'move_ready');await refreshPhone();
  assert.equal(await phone.locator('#buttonALabel').innerText(),'เริ่มเดิน');assert.match(await phone.locator('#controllerRole').innerText(),/เหลือ 2 ก้าว/);
  const zone=await phone.locator('#joystickZone').boundingBox(),x=zone.x+zone.width/2,y=zone.y+zone.height/2;
  async function forwardPhone(dt=0){
   const packets=await phone.evaluate(()=>{__boardTest.pulse();return __boardPackets.splice(0).filter(p=>p.t==='input');});
   await host.evaluate(({packets,dt})=>{const s=__boardTest.board;for(const p of packets)BoardParty.input(s,s.players[0].id,p);if(dt)BoardParty.update(s,dt);__boardTest.drawGame(s.time);},{packets,dt});
  }
  async function drag(dx,dy){await phone.mouse.move(x,y);await phone.mouse.down();await phone.mouse.move(x+dx,y+dy,{steps:4});}
  async function aim(node){const v=await host.evaluate(id=>{const s=__boardTest.board,a=BoardItems.position(s,s.players[0]),b=s.map.nodes[id].position,d=Math.hypot(b.x-a.x,b.y-a.y);return{x:(b.x-a.x)/d,y:(b.y-a.y)/d};},node);await phone.mouse.move(x+v.x*64,y+v.y*64,{steps:3});}
  async function dragTo(node){await phone.mouse.move(x,y);await phone.mouse.down();await aim(node);}
  async function reach(node){for(let i=0;i<130;i++){if(await host.evaluate(id=>__boardTest.board.players[0].currentNodeId===id,node))return;await aim(node);await forwardPhone(.05);}assert.fail('Did not reach '+node);}
  await tap('#buttonA');assert.equal(await host.evaluate(()=>__boardTest.board.phase),'move_ready','A no longer walks');
  const token=await host.evaluate(()=>__boardTest.board.turnId);
  await dragTo('n2');await forwardPhone(.1);await forwardPhone(.1);await forwardPhone(.1);
  const mid=await host.evaluate(()=>{const s=__boardTest.board;return{position:BoardItems.position(s,s.players[0]),remaining:BoardParty.remainingSteps(s,s.players[0].id)};});assert.equal(mid.remaining,2);
  await phone.mouse.up();await forwardPhone(.1);await forwardPhone(.1);
  assert.deepEqual(await host.evaluate(()=>{const s=__boardTest.board;return BoardItems.position(s,s.players[0]);}),mid.position,'releasing the actual joystick stops between nodes');
  await dragTo('n2');await reach('n2');await refreshPhone();
  assert.match(await phone.locator('#controllerRole').innerText(),/เหลือ 1 ก้าว/);
  assert.equal(await host.evaluate(()=>__boardTest.board.turnId),token);
  await host.screenshot({path:path.join(out,'manual-steps.png')});await phone.screenshot({path:path.join(out,'phone-steps.png')});
  await host.screenshot({path:path.join(out,'board-preview.jpg'),type:'jpeg',quality:82,scale:'css'});
  await reach('n3');await phone.mouse.up();await forwardPhone();
  // Bomber: B changes to rotation after entering aim, A commits the same preview.
  await host.evaluate(()=>{const s=__boardTest.board;BoardParty.startTurn(s);s.players[0].usedRound=0;s.players[0].bag=['bomber'];s.players[0].item='bomber';});
  await refreshPhone();await tap('#buttonB');await refreshPhone();
  assert.match(await phone.locator('#buttonALabel').innerText(),/เล็งเป้า/);
  await tap('#buttonA');await refreshPhone();assert.match(await phone.locator('#buttonBLabel').innerText(),/45/);await tap('#buttonB');
  assert.equal(await host.evaluate(()=>__boardTest.board.skill.angle),Math.PI/4);
  await refreshPhone();await tap('#buttonA');assert.equal(await host.evaluate(()=>__boardTest.board.phase),'effect');
  // A forward branch is selected and entered directly with the actual joystick.
  await host.evaluate(()=>{const s=__boardTest.board;s.players[0].currentNodeId='n3';s.players[0].worldPosition=null;BoardParty.startTurn(s);BoardParty.beginMove(s,s.players[0],2);});
  await refreshPhone();await dragTo('b3_1');await forwardPhone(.05);await forwardPhone(.1);await forwardPhone(.1);
  assert.equal(await host.evaluate(()=>__boardTest.board.phase),'moving');
  assert.equal(await host.evaluate(()=>__boardTest.board.move.to),'b3_1');
  await phone.mouse.up();await forwardPhone();
  // Draw all effect/item phases, including split selection and the 12-row reward grid.
  for(const kind of ['ufo','bomber','car','rocket','shield']){
   await host.evaluate(kind=>{const s=__boardTest.board;BoardParty.startTurn(s);s.players[0].bag=[kind];s.players[0].actionIndex=0;s.players[0].item=kind;s.players[0].usedRound=0;BoardParty.action(s,s.players[0].id,'B');BoardParty.action(s,s.players[0].id,'A');for(let i=0;i<4;i++){BoardParty.update(s,.05);__boardTest.drawGame(s.time);}},kind);
   await host.screenshot({path:path.join(out,kind+'.png')});
  }
  await refreshPhone();assert.match(await phone.locator('#controllerRole').innerText(),/โล่ป้องกัน/);await noScroll(phone);
  await host.evaluate(()=>{
   const s=__boardTest.board;
   BoardParty.phase(s,'minigame');
   s.players.forEach(p=>p.item='ufo');
   BoardParty.minigameEnded(s,[...s.players].reverse().map((p,i)=>({
    id:p.id,rank:i<2?1:i+1,label:(i<2?12:12-i)+' คะแนน'
   })));
   __boardTest.refreshBoardTools();__boardTest.drawGame(s.time);
  });
  await assertBoardMapToolbar(host,false,'BOARD standings as pictured');
  await host.evaluate(()=>{
   const s=__boardTest.board;
   for(let i=0;i<85;i++)BoardParty.update(s,.05);
   __boardTest.refreshBoardTools();__boardTest.drawGame(s.time);
  });
  await assertBoardMapToolbar(host,false,'BOARD minigame rewards overlay');
  await host.screenshot({path:path.join(out,'rewards.png')});await noScroll(host);
  await host.evaluate(()=>{const s=__boardTest.board;for(let i=0;i<250&&s.phase!=='round_order';i++)BoardParty.update(s,.05);__boardTest.drawGame(s.time);});
  assert.equal(await host.evaluate(()=>__boardTest.board.phase),'round_order');
  await host.evaluate(()=>__boardTest.refreshBoardTools());
  await assertBoardMapToolbar(host,true,'returned to BOARD map');
  assert.equal(await host.evaluate(()=>__boardTest.board.nextOrder.slice(0,2).every(id=>__boardTest.board.players.slice(10).some(p=>p.id===id))),true);
  await host.screenshot({path:path.join(out,'round-order.png')});
  assert.deepEqual(errors,[]);console.log('BROWSER PASS: 1–12 players; 1440/1024/844 viewports; DPR 2; centered double dice; actual phone continuous joystick/stop/steering; shield and all item renderers; next-round order; no JavaScript errors. Screenshots: '+out);
 }finally{await browser.close();server.close();}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
