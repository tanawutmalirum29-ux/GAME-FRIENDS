/* Browser integration with a controllable PeerJS signaling transport.
 * Actual Chromium/WebKit DOM + game engine; network faults are simulated,
 * not a certification of real Internet/ICE/WebRTC behavior. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require('playwright');
const kind=process.env.BOARD_BROWSER||'chromium';
const root=path.resolve(__dirname,'..');
const inject='window.__peerQA={get players(){return players},get board(){return boardSession},get round(){return round},get room(){return roomCode},get view(){return currentView},closeHost};requestAnimationFrame(animate);\n})();';
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 let content=fs.readFileSync(file);
 if(file===path.join(root,'index.html'))
  content=require('./helpers/legacy-game-html.cjs').withLegacyGameFixtures(content.toString());
 if(file===path.join(root,'app.js')){
  const source=content.toString();
  assert.ok(source.includes('requestAnimationFrame(animate);\n})();'));
  content=source.replace('requestAnimationFrame(animate);\n})();',inject);
 }
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml',
  '.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
 res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});
 res.end(content);
});
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await playwright[kind].launch({headless:true,
  executablePath:kind==='chromium'?(process.env.CHROME_PATH||'/usr/bin/chromium'):undefined,
  args:kind==='chromium'?['--no-sandbox']:[]});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  await context.route('https://**/*',route=>route.fulfill({body:'',contentType:'text/javascript'}));
  await context.addInitScript(()=>{
   window.requestAnimationFrame=()=>0;
   window.__peerInstances=[];
   window.MockConnection=class{
    constructor(){this.peer='test-phone';this.open=true;this.handlers={};this.sent=[];}
    on(event,fn){this.handlers[event]=fn;}
    send(data){this.sent.push(data);}
    fire(event,payload){this.handlers[event]?.(payload);}
    close(){if(!this.open)return;this.open=false;this.fire('close');}
   };
   window.Peer=class{
    constructor(id){this.id=id;this.handlers={};this.open=false;this.disconnected=false;this.destroyed=false;
     this.reconnectCount=0;window.__peerInstances.push(this);}
    on(event,fn){this.handlers[event]=fn;}
    fire(event,payload){
     if(event==='open'){this.open=true;this.disconnected=false;}
     if(event==='disconnected'){this.open=false;this.disconnected=true;}
     if(event==='close'){this.open=false;this.destroyed=true;}
     this.handlers[event]?.(payload);
    }
    disconnect(){if(this.disconnected)return;this.fire('disconnected');}
    reconnect(){
     if(!this.disconnected||this.destroyed)throw Error('PeerJS reconnect precondition');
     this.disconnected=false;this.reconnectCount++;
     setTimeout(()=>this.fire('open',this.id),0);
    }
    destroy(){if(!this.destroyed)this.fire('close');}
   };
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?host=1');
  await page.locator('#hostBtn').click();
  await page.waitForFunction(()=>!!window.__peerInstances[0]&&!!window.__peerQA,null,{polling:100});
  await page.evaluate(()=>__peerInstances[0].fire('open',__peerInstances[0].id));
  const initial=await page.evaluate(()=>{
   const peer=__peerInstances[0],a=new MockConnection();
   window.__originalConn=a;
   peer.fire('connection',a);
   a.fire('data',{t:'join',name:'👩🏽‍💻 สวัสดี',clientToken:'stable-phone-aaaa'});
   return {code:__peerQA.room,id:a.sent.find(x=>x.t==='welcome')?.id,instances:__peerInstances.length};
  });
  assert.ok(initial.id,'remote player joins by real Host data listener');
  await page.evaluate(()=>{
   const p=__peerInstances[0];
   p.fire('disconnected');
   __originalConn.fire('data',{t:'input',keys:{axisX:.7,axisY:0}});
  });
  const alive=await page.evaluate(()=>({
   x:__peerQA.players[0].input.axisX,room:__peerQA.room,
   connected:__originalConn.open,instances:__peerInstances.length
  }));
  assert.equal(alive.x,.7,'existing DataConnection still delivers joystick after lost signaling');
  assert.equal(alive.connected,true);
  await page.waitForFunction(()=>__peerInstances[0].reconnectCount===1,null,{polling:100,timeout:10000});
  const recovered=await page.evaluate(()=>{
   const peer=__peerInstances[0],b=new MockConnection();
   peer.fire('connection',b);
   b.fire('data',{t:'join',name:'New Friend'});
   return {room:__peerQA.room,newId:b.sent.find(x=>x.t==='welcome')?.id,
    players:__peerQA.players.length,instances:__peerInstances.length};
  });
  assert.equal(recovered.room,initial.code);
  assert.ok(recovered.newId&&recovered.newId!==initial.id,'new player joins after same-Peer reconnect');
  assert.equal(recovered.instances,1,'do not replace a recoverable PeerJS instance');
  await page.locator('#plazaSettingsToggle').click();
  await page.locator('[data-session-mode="board"]').click();
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>!!__peerQA.board,null,{polling:100,timeout:15000});
  const before=await page.evaluate(()=>{
   const s=__peerQA.board;
   window.__savedBoard=s;
   s.players[0].hp=73;
   s.players[0].bag.push('shield');
   return {round:s.roundNumber,turn:s.turnId,players:s.players.length,
    room:__peerQA.room,playerId:__peerQA.players[0].id};
  });
  await page.evaluate(()=>{
   const peer=__peerInstances[0];
   peer.fire('disconnected');
   __originalConn.close();
  });
  await page.waitForFunction(()=>__peerInstances[0].reconnectCount===2,null,{polling:100,timeout:10000});
  const result=await page.evaluate(()=>{
   const peer=__peerInstances[0],c=new MockConnection();
   peer.fire('connection',c);
   c.fire('data',{t:'join',name:'Returning',clientToken:'stable-phone-aaaa'});
   return {same:__peerQA.board===__savedBoard,hp:__peerQA.board.players[0].hp,
    bag:[...__peerQA.board.players[0].bag],
    round:__peerQA.board.roundNumber,turn:__peerQA.board.turnId,
    players:__peerQA.board.players.length,room:__peerQA.room,
    playerId:c.sent.find(x=>x.t==='welcome')?.id};
  });
  assert.deepEqual(result,{same:true,hp:73,bag:['shield'],round:before.round,turn:before.turn,
   players:before.players,room:before.room,playerId:before.playerId},
   'BOARD session/HP/turn-order/seat identity survive signal loss and player rejoin');
  await page.evaluate(()=>{
   __peerInstances[0].fire('disconnected');
   __peerQA.closeHost();
  });
  const stopped=await page.evaluate(()=>({
   room:__peerQA.room,closed:__peerInstances[0].destroyed,
   reconnects:__peerInstances[0].reconnectCount
  }));
  assert.equal(stopped.room,'');
  assert.equal(stopped.closed,true);
  await page.waitForTimeout(1300);
  assert.equal(await page.evaluate(()=>__peerInstances[0].reconnectCount),stopped.reconnects,
   'explicit close cancels reconnect timer');
  assert.deepEqual(errors,[]);
  console.log('HOST SIGNAL BROWSER PASS '+kind+': live controller, signaling fault, rejoin, active BOARD preservation, teardown (mock PeerJS)');
  await context.close();
 }finally{await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
