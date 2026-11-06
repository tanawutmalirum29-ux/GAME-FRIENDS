/* Optional real Chromium layout/input checks. npm install --no-save playwright
   Run: CHROME_PATH=/usr/bin/chromium node tests/board-browser.cjs
   Network transport is covered by smoke.cjs; this forwards rendered phone inputs
   to the host engine so this test needs neither PeerJS servers nor real phones. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.BOARD_SCREENSHOTS||'/tmp/game-friends-board';
const injection=`window.__boardTest={get board(){return boardSession},get round(){return round},get players(){return players},beginBoard,updateBoard,updateRound,drawGame,addLocal,returnToLobby,
 phone(info){controllerReady=true;controllerPlayerActive=true;controllerId='p1';controllerSessionMode='board';controllerBoard=info;
 controllerConn={open:true,send:msg=>window.__boardPackets.push(msg)};window.__boardPackets=[];
 $('controllerName').textContent='Snow explorer';$('controllerAvatar').style.background='#ff628c';
 $('joinForm').classList.add('hidden');$('controllerActive').classList.remove('hidden');document.body.classList.add('controller-playing');
 setView('controller');updatePhoneGamePicker('playing',null);setControllerGameContext('board','playing',true);renderPhoneBoard();
 }};requestAnimationFrame(animate);\n})();`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 const type=path.extname(file),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png'}[type]||'application/octet-stream';
 let body=fs.readFileSync(file);if(file===path.join(root,'app.js'))body=body.toString().replace('requestAnimationFrame(animate);\n})();',injection);
 res.writeHead(200,{'content-type':mime});res.end(body);
});
async function noScroll(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true);}
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
  }
  await host.screenshot({path:path.join(out,'order-12.png')});
  await host.screenshot({path:path.join(out,'board-order.jpg'),type:'jpeg',quality:82,scale:'css'});
  for(const view of [{width:1440,height:900},{width:1024,height:768},{width:844,height:390}]){
   await host.setViewportSize(view);
   await host.evaluate(()=>{__boardTest.beginBoard();__boardTest.drawGame(0);});
   await noScroll(host);
   const rect=await host.locator('#arena').boundingBox();assert.ok(rect.x>=-1&&rect.y>=-1&&rect.x+rect.width<=view.width+1&&rect.y+rect.height<=view.height+1);
   const bitmap=await host.locator('#arena').evaluate(c=>({w:c.width,h:c.height}));assert.ok(bitmap.w>=960&&bitmap.h>=540);
   await host.screenshot({path:path.join(out,`order-${view.width}.png`)});
  }
  await host.setViewportSize({width:1440,height:900});
  await host.evaluate(()=>{const s=__boardTest.board;s.players.forEach(p=>p.isBot=false);s.order=s.players.map(p=>p.id);s.players.forEach((p,i)=>p.currentNodeId='n'+(i+1));s.players[0].currentNodeId='n3';BoardParty.startTurn(s);for(let i=0;i<80;i++){BoardParty.update(s,.01);__boardTest.drawGame(s.time);}});
  await host.screenshot({path:path.join(out,'board-12.png')});
  await host.screenshot({path:path.join(out,'board-preview.jpg'),type:'jpeg',quality:82,scale:'css'});
  // Render the real mobile UI and click its actual pointer-bound A/B buttons.
  const mobile=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await mobile.route('https://**/*',route=>route.fulfill({body:'',contentType:'text/javascript'}));
  await mobile.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(String(e)));await phone.goto(base+'/?join=ABC123');
  async function refreshPhone(){
   const info=await host.evaluate(()=>{const s=__boardTest.board,p=s.players[0];return{phase:'playing',turnId:s.turnId,boardPhase:s.phase,round:s.roundNumber,hp:p.hp,item:BoardItems.names[p.item]||'ไม่มีไอเทม',...BoardParty.controls(s,p.id)};});
   await phone.evaluate(info=>__boardTest.phone(info),info);return info;
  }
  async function tap(button){
   await phone.locator(button).locator('..').tap();const packets=await phone.evaluate(()=>__boardPackets.filter(p=>p.t==='input'));
   await host.evaluate(packets=>{const s=__boardTest.board;for(const p of packets)BoardParty.input(s,s.players[0].id,p);},packets);
  }
  await host.evaluate(()=>{const s=__boardTest.board;s.players[0].item='potion';s.players[0].hp=2;});
  await refreshPhone();await noScroll(phone);await phone.screenshot({path:path.join(out,'phone.png')});
  assert.match(await phone.locator('#buttonBLabel').innerText(),/ใช้ไอเทม/);await tap('#buttonB');
  assert.equal(await host.evaluate(()=>__boardTest.board.players[0].hp),3);
  await host.evaluate(()=>{for(let i=0;i<30;i++)BoardParty.update(__boardTest.board,.05);});await refreshPhone();await tap('#buttonA');
  assert.equal(await host.evaluate(()=>__boardTest.board.phase),'dice');
  // Bomber: B changes to rotation after entering aim, A commits the same preview.
  await host.evaluate(()=>{const s=__boardTest.board;BoardParty.startTurn(s);s.players[0].usedRound=0;s.players[0].item='bomber';});
  await refreshPhone();await tap('#buttonB');await refreshPhone();assert.match(await phone.locator('#buttonBLabel').innerText(),/45/);await tap('#buttonB');
  assert.equal(await host.evaluate(()=>__boardTest.board.skill.angle),Math.PI/4);
  await refreshPhone();await tap('#buttonA');assert.equal(await host.evaluate(()=>__boardTest.board.phase),'effect');
  // Drag the actual floating joystick before confirming a forward branch.
  await host.evaluate(()=>{const s=__boardTest.board;s.players[0].currentNodeId='n3';BoardParty.startTurn(s);BoardParty.beginMove(s,s.players[0],2);});
  await refreshPhone();
  const zone=await phone.locator('#joystickZone').boundingBox(),x=zone.x+zone.width/2,y=zone.y+zone.height/2;
  await phone.mouse.move(x,y);await phone.mouse.down();await phone.mouse.move(x+40,y-64,{steps:4});
  const stick=await phone.evaluate(()=>__boardPackets.filter(p=>p.t==='input'&&p.keys.axisY<-.3).at(-1));assert.ok(stick,'joystick produces analog axes');
  await host.evaluate(packet=>{const s=__boardTest.board;BoardParty.input(s,s.players[0].id,packet);BoardParty.update(s,.05);},stick);
  assert.equal(await host.evaluate(()=>__boardTest.board.branch.selected),'b3_1');
  await phone.mouse.up();await refreshPhone();await tap('#buttonA');assert.equal(await host.evaluate(()=>__boardTest.board.phase),'moving');
  // Draw all effect/item phases, including split selection and the 12-row reward grid.
  for(const kind of ['ufo','bomber','car','rocket']){
   await host.evaluate(kind=>{const s=__boardTest.board;BoardParty.startTurn(s);s.players[0].item=kind;s.players[0].usedRound=0;BoardParty.action(s,s.players[0].id,'B');for(let i=0;i<4;i++){BoardParty.update(s,.05);__boardTest.drawGame(s.time);}},kind);
   await host.screenshot({path:path.join(out,kind+'.png')});
  }
  await host.evaluate(()=>{const s=__boardTest.board;BoardParty.phase(s,'minigame');s.players.forEach(p=>p.item='ufo');BoardParty.minigameEnded(s,s.players.map((p,i)=>({id:p.id,rank:i<2?1:i+1,label:'12 คะแนน'})));for(let i=0;i<85;i++)BoardParty.update(s,.05);__boardTest.drawGame(s.time);});
  await host.screenshot({path:path.join(out,'rewards.png')});await noScroll(host);
  assert.deepEqual(errors,[]);console.log('BROWSER PASS: 1–12 players; 1440/1024/844 viewports; DPR 2; actual phone A/B inputs; all item renderers; no JavaScript errors. Screenshots: '+out);
 }finally{await browser.close();server.close();}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
