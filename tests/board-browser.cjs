/* Optional real Chromium layout/input checks. npm install --no-save playwright
   Run: CHROME_PATH=/usr/bin/chromium node tests/board-browser.cjs
   Network transport is covered by smoke.cjs; this forwards rendered phone inputs
   to the host engine so this test needs neither PeerJS servers nor real phones. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.BOARD_SCREENSHOTS||'/tmp/game-friends-board';
const injection=`window.__boardTest={get board(){return boardSession},get round(){return round},get players(){return players},beginBoard,updateBoard,updateRound,drawGame,addLocal,returnToLobby,pulse:sendInputs,
 phone(info){controllerReady=true;controllerPlayerActive=true;controllerId='p1';controllerSessionMode='board';
 controllerConn={open:true,send:msg=>window.__boardPackets.push(msg)};window.__boardPackets=[];
 $('controllerName').textContent='Snow explorer';$('controllerAvatar').style.background='#ff628c';
 $('joinForm').classList.add('hidden');$('controllerActive').classList.remove('hidden');document.body.classList.add('controller-playing');
 setView('controller');updatePhoneGamePicker('playing',null);receiveBoardState(info);
 }};requestAnimationFrame(animate);\n})();`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 const type=path.extname(file),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png'}[type]||'application/octet-stream';
 let body=fs.readFileSync(file);if(file===path.join(root,'app.js'))body=body.toString().replace('requestAnimationFrame(animate);\n})();',injection);
 res.writeHead(200,{'content-type':mime});res.end(body);
});
async function noScroll(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true);}
async function toolbarInside(page){
   const toolBounds=await page.evaluate(()=>{const a=document.getElementById('arena').getBoundingClientRect(),b=document.getElementById('boardTools').getBoundingClientRect(),scale=Math.min(a.width/960,a.height/540),x=a.left+(a.width-960*scale)/2,y=a.top+(a.height-540*scale)/2;return{left:(b.left-x)/scale,right:(b.right-x)/scale,top:(b.top-y)/scale,bottom:(b.bottom-y)/scale};});
   assert.ok(toolBounds.left>=340&&toolBounds.right<=910&&toolBounds.top>=0&&toolBounds.bottom<=35,'toolbar stays in the header above map/player cards');
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
  const host=await context.newPage(),errors=[];host.on('pageerror',e=>errors.push(String(e)));
  await host.goto(base);await host.evaluate(()=>document.getElementById('offlineBtn').click());
  for(let n=1;n<=12;n++){
   await host.evaluate(n=>{const a=__boardTest;a.returnToLobby();a.players.splice(n);while(a.players.length<n)a.addLocal();a.beginBoard();a.drawGame(0);},n);
   assert.equal(await host.evaluate(()=>__boardTest.board.players.length),n);await noScroll(host);
   await toolbarInside(host);
  }
  await host.screenshot({path:path.join(out,'overview-12.png')});
  await host.locator('#boardStartDiceBtn').click();await host.evaluate(()=>__boardTest.drawGame(0));
  await host.screenshot({path:path.join(out,'order-12.png')});
  await host.screenshot({path:path.join(out,'board-order.jpg'),type:'jpeg',quality:82,scale:'css'});
  async function drawnTexts(){return host.evaluate(()=>{
   const g=document.getElementById('arena').getContext('2d'),text=g.fillText,seen=[];
   g.fillText=function(value,...args){seen.push(String(value));return text.call(this,value,...args);};
   try{__boardTest.drawGame(__boardTest.board.time);}finally{g.fillText=text;}return seen;
  });}
  await host.locator('#boardOverviewBtn').click();
  assert.equal(await host.evaluate(()=>__boardTest.round.paused),true);
  assert.equal((await drawnTexts()).includes('ทอยลูกเต๋าเพื่อจัดลำดับ'),false,'overview hides dice-order modal so the map can be inspected');
  await host.locator('#boardFollowBtn').click();
  assert.equal(await host.evaluate(()=>__boardTest.round.paused),false);
  assert.ok((await drawnTexts()).includes('ทอยลูกเต๋าเพื่อจัดลำดับ'),'follow resumes same order screen');

  for(const view of [{width:1440,height:900},{width:1024,height:768},{width:844,height:390}]){
   await host.setViewportSize(view);
   await host.evaluate(()=>{__boardTest.beginBoard();__boardTest.drawGame(0);});
   await noScroll(host);await toolbarInside(host);
   const rect=await host.locator('#arena').boundingBox();assert.ok(rect.x>=-1&&rect.y>=-1&&rect.x+rect.width<=view.width+1&&rect.y+rect.height<=view.height+1);
   const bitmap=await host.locator('#arena').evaluate(c=>({w:c.width,h:c.height}));assert.ok(bitmap.w>=960&&bitmap.h>=540);
   await host.screenshot({path:path.join(out,`order-${view.width}.png`)});
  }
  await host.setViewportSize({width:1024,height:768});
  // The real host controls must explore the map without touching gameplay state.
  await host.locator('#boardStartDiceBtn').click();
  await host.evaluate(()=>{const s=__boardTest.board;s.order=s.players.map(p=>p.id);s.players.forEach(p=>p.isBot=false);BoardParty.startTurn(s);});
  await host.locator('#pauseBtn').click();
  assert.equal(await host.evaluate(()=>__boardTest.round.paused),true);
  const pausedPlayers=await host.evaluate(()=>JSON.stringify(__boardTest.board.players));
  await host.locator('#boardOverviewBtn').click();
  await host.locator('#boardNodeDebugBtn').click();
  for(let i=0;i<7;i++)await host.locator('#boardZoomInBtn').click();
  await host.evaluate(()=>__boardTest.drawGame(0));
  const beforePan=await host.evaluate(()=>({...__boardTest.board.camera}));
  const box=await host.locator('#arena').boundingBox(),scale=Math.min(box.width/960,box.height/540);
  const arena={x:box.x+(box.width-960*scale)/2,y:box.y+(box.height-540*scale)/2,width:960*scale,height:540*scale};
  await host.mouse.move(arena.x+arena.width*.50,arena.y+arena.height*.56);await host.mouse.down();
  await host.mouse.move(arena.x+arena.width*.60,arena.y+arena.height*.60,{steps:5});await host.mouse.up();
  const afterPan=await host.evaluate(()=>({...__boardTest.board.camera}));
  assert.ok(afterPan.x!==beforePan.x||afterPan.y!==beforePan.y,'real canvas drag pans while paused');
  const target=await host.evaluate(()=>{
   const s=__boardTest.board,c=s.camera,top=s.players.length>6?145:94;
   return Object.values(s.map.nodes).map(n=>({id:n.id,x:480+(n.position.x-c.x)*c.zoom,y:(top+452)/2+(n.position.y-c.y)*c.zoom})).find(n=>n.x>100&&n.x<860&&n.y>top+40&&n.y<410);
  });
  assert.ok(target,'zoomed map has an inspectable node');
  await host.mouse.click(arena.x+target.x*arena.width/960,arena.y+target.y*arena.height/540);
  assert.equal(await host.evaluate(()=>__boardTest.board.camera.selectedId),target.id);
  await host.evaluate(()=>__boardTest.drawGame(0));
  await host.screenshot({path:path.join(out,'pause-debug.png')});
  assert.equal(await host.evaluate(()=>JSON.stringify(__boardTest.board.players)),pausedPlayers,'camera tools cannot alter players');
  await host.locator('#boardOverviewBtn').click();await host.locator('#boardNodeDebugBtn').click();
  await host.locator('#pauseBtn').click();assert.equal(await host.evaluate(()=>__boardTest.round.paused),false);
  await host.setViewportSize({width:1440,height:900});
  await host.locator('#boardOverviewBtn').click();assert.equal(await host.evaluate(()=>__boardTest.round.paused),true,'overview freezes an active game');await host.evaluate(()=>__boardTest.drawGame(0));
  await host.locator('#boardEffectsBtn').click();assert.equal(await host.evaluate(()=>__boardTest.board.camera.lowDetail),true);
  await host.evaluate(()=>__boardTest.drawGame(0));await host.screenshot({path:path.join(out,'overview-low-detail.png')});
  await host.locator('#boardEffectsBtn').click();assert.equal(await host.evaluate(()=>__boardTest.board.camera.lowDetail),false);
  await host.evaluate(()=>__boardTest.drawGame(0));
  await host.screenshot({path:path.join(out,'board-overview.jpg'),type:'jpeg',quality:88,scale:'css'});
  const timings=await host.evaluate(()=>{
   const samples=[];for(let i=0;i<90;i++){const start=performance.now();__boardTest.drawGame(i/60);samples.push(performance.now()-start);}
   samples.sort((a,b)=>a-b);return{medianMs:samples[45],p95Ms:samples[85],sampleCount:samples.length};
  });
  await host.locator('#boardFollowBtn').click();assert.equal(await host.evaluate(()=>__boardTest.round.paused),false,'follow resumes paused overview');
  assert.ok(Number.isFinite(timings.p95Ms));console.log('Headless Chromium synchronous host draw timing (not device FPS): '+JSON.stringify(timings));
  await host.evaluate(()=>{const s=__boardTest.board;s.players.forEach(p=>p.isBot=false);s.order=s.players.map(p=>p.id);s.players.forEach((p,i)=>p.currentNodeId='n'+(i+1));s.players[0].currentNodeId='n3';BoardParty.startTurn(s);for(let i=0;i<80;i++){BoardParty.update(s,.01);__boardTest.drawGame(s.time);}});
  await host.screenshot({path:path.join(out,'board-12.png')});
  await host.screenshot({path:path.join(out,'board-preview.jpg'),type:'jpeg',quality:82,scale:'css'});
  // Render the real mobile UI and click its actual pointer-bound A/B buttons.
  const mobile=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await mobile.route('https://**/*',route=>route.fulfill({body:'',contentType:'text/javascript'}));
  await mobile.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(String(e)));await phone.goto(base+'/?join=ABC123');
  async function refreshPhone(){
   const info=await host.evaluate(()=>{const s=__boardTest.board,p=s.players[0];return{phase:'playing',turnId:s.turnId,boardPhase:s.phase,round:s.roundNumber,hp:p.hp,stepsRemaining:BoardParty.remainingSteps(s,p.id),shieldTurns:p.shieldTurns,item:BoardItems.names[p.item]||'ไม่มีไอเทม',bag:BoardItems.bag(p).slice(),bagOpen:!!p.bagOpen,bagIndex:p.bagIndex||0,...BoardParty.controls(s,p.id)};});
   await phone.evaluate(info=>__boardTest.phone(info),info);
   const packets=await phone.evaluate(()=>__boardPackets.filter(p=>p.t==='input'));
   await host.evaluate(packets=>{const s=__boardTest.board;for(const p of packets)BoardParty.input(s,s.players[0].id,p);},packets);return info;
  }
  async function tap(button){
   await phone.locator(button).locator('..').tap();const packets=await phone.evaluate(()=>__boardPackets.filter(p=>p.t==='input'));
   await host.evaluate(packets=>{const s=__boardTest.board;for(const p of packets)BoardParty.input(s,s.players[0].id,p);},packets);
  }
  await host.evaluate(()=>{const s=__boardTest.board;s.players[0].bag=['potion'];s.players[0].item='potion';s.players[0].hp=50;s.players[0].currentNodeId='n1';s.players[0].worldPosition=null;s.rng=()=>0;});
  await refreshPhone();await noScroll(phone);await phone.screenshot({path:path.join(out,'phone.png')});
  assert.match(await phone.locator('#buttonBLabel').innerText(),/เปิดกระเป๋า/);await tap('#buttonB');
  await refreshPhone();assert.match(await phone.locator('#buttonBLabel').innerText(),/ใช้ไอเทม/);
  await tap('#buttonB');assert.equal(await host.evaluate(()=>__boardTest.board.players[0].hp),100);
  await host.evaluate(()=>{for(let i=0;i<30;i++)BoardParty.update(__boardTest.board,.05);});await refreshPhone();await tap('#buttonA');
  assert.equal(await host.evaluate(()=>__boardTest.board.phase),'dice');
  await host.evaluate(()=>{const s=__boardTest.board;for(let i=0;i<20;i++)BoardParty.update(s,.05);__boardTest.drawGame(s.time);});
  assert.deepEqual(await host.evaluate(()=>__boardTest.board.moveDice),[1,1]);
  // Inspect the actual Canvas calls: two die faces inside the central third, correct pips/total.
  const diceDrawing=await host.evaluate(()=>{
   const g=document.createElement('canvas').getContext('2d'),faces=[],texts=[];let pips=0;
   const rr=g.roundRect.bind(g),arc=g.arc.bind(g),text=g.fillText.bind(g);
   g.roundRect=(x,y,w,h,...args)=>{if(w===h){const m=g.getTransform();faces.push({x:m.e+x+w/2,y:m.f+y+h/2});}rr(x,y,w,h,...args);};
   g.arc=(...args)=>{pips++;arc(...args);};g.fillText=(...args)=>{texts.push(args[0]);text(...args);};
   BoardArt.turnDice(g,__boardTest.board);return{centers:[...new Set(faces.map(p=>p.x))],faces,texts,pips};
  });
  assert.equal(diceDrawing.centers.length,2);assert.equal(diceDrawing.pips,2);assert.ok(diceDrawing.faces.every(p=>p.x>320&&p.x<640&&p.y>180&&p.y<360));assert.ok(diceDrawing.texts.includes('2 ก้าว'));
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
  assert.match(await phone.locator('#buttonBLabel').innerText(),/ใช้ไอเทม/);
  await tap('#buttonB');await refreshPhone();assert.match(await phone.locator('#buttonBLabel').innerText(),/45/);await tap('#buttonB');
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
   await host.evaluate(kind=>{const s=__boardTest.board;BoardParty.startTurn(s);s.players[0].bag=[kind];s.players[0].bagIndex=0;s.players[0].item=kind;s.players[0].usedRound=0;BoardParty.action(s,s.players[0].id,'B');BoardParty.action(s,s.players[0].id,'B');for(let i=0;i<4;i++){BoardParty.update(s,.05);__boardTest.drawGame(s.time);}},kind);
   await host.screenshot({path:path.join(out,kind+'.png')});
  }
  await refreshPhone();assert.match(await phone.locator('#controllerRole').innerText(),/โล่ป้องกัน/);await noScroll(phone);
  await host.evaluate(()=>{const s=__boardTest.board;BoardParty.phase(s,'minigame');s.players.forEach(p=>p.item='ufo');BoardParty.minigameEnded(s,[...s.players].reverse().map((p,i)=>({id:p.id,rank:i<2?1:i+1,label:(i<2?12:12-i)+' คะแนน'})));for(let i=0;i<85;i++)BoardParty.update(s,.05);__boardTest.drawGame(s.time);});
  await host.screenshot({path:path.join(out,'rewards.png')});await noScroll(host);
  await host.evaluate(()=>{const s=__boardTest.board;for(let i=0;i<250&&s.phase!=='round_order';i++)BoardParty.update(s,.05);__boardTest.drawGame(s.time);});
  assert.equal(await host.evaluate(()=>__boardTest.board.phase),'round_order');assert.equal(await host.evaluate(()=>__boardTest.board.nextOrder.slice(0,2).every(id=>__boardTest.board.players.slice(10).some(p=>p.id===id))),true);await host.screenshot({path:path.join(out,'round-order.png')});
  assert.deepEqual(errors,[]);console.log('BROWSER PASS: 1–12 players; 1440/1024/844 viewports; DPR 2; centered double dice; actual phone continuous joystick/stop/steering; shield and all item renderers; next-round order; no JavaScript errors. Screenshots: '+out);
 }finally{await browser.close();server.close();}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
