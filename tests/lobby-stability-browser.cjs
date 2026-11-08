/* Host lobby anti-jitter regression in Chromium + WebKit.
 * Verify geometry is invariant under 0..12 bots, game selection and session
 * switching (including the bulk-game button appearing/disappearing). */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require('playwright'),engine=process.env.BOARD_BROWSER||'chromium';
const root=path.resolve(__dirname,'..'),out='/tmp/game-friends-board/lobby-stability';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 const ext=path.extname(file),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png'};
 res.writeHead(200,{'content-type':types[ext]||'application/octet-stream'});
 res.end(fs.readFileSync(file));
});
async function geometry(page){
 return page.evaluate(()=>{
  const selectors=[
   '#hostLobby .lobby-bar','#hostLobby .host-lobby-grid',
   '#hostLobby .lobby-qr-panel','#hostLobby .lobby-player-panel',
   '#hostLobby .lobby-section-title','#hostLobby #rosterCount',
   '#hostLobby #cycleAllBotsBtn','#hostLobby #roster',
   '#hostLobby #roster .roster-item:first-child',
   '#hostLobby #roster .roster-item:last-child',
   '#hostLobby .lobby-controls','#hostLobby #sessionMode',
   '#hostLobby [data-session-mode="queue"]',
   '#hostLobby [data-session-mode="endless"]',
   '#hostLobby [data-session-mode="board"]',
   '#hostLobby .lobby-room-actions',
   '#hostLobby #addLocalBtn','#hostLobby #startBtn'
  ];
  const rect=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(v=>Math.round(v*4)/4);};
  return {
   boxes:Object.fromEntries(selectors.map(selector=>{
    const e=document.querySelector(selector);
    if(!e)throw Error('Missing lobby element: '+selector);
    return [selector,rect(e)];
   })),
   scrollX:document.documentElement.scrollWidth-innerWidth,
   scrollY:document.documentElement.scrollHeight-innerHeight,
   bots:document.querySelectorAll('#roster .roster-item:not(.roster-empty)').length,
   slots:document.querySelectorAll('#roster .roster-item').length,
   buttonHidden:getComputedStyle(document.getElementById('cycleAllBotsBtn')).visibility==='hidden'
  };
 });
}
function stable(base,now,label){
 assert.equal(now.slots,12,label+' preserves all twelve reserved positions');
 assert.ok(now.scrollX<=1&&now.scrollY<=1,label+' fits one viewport');
 for(const [selector,position] of Object.entries(base.boxes)){
  assert.ok(now.boxes[selector],label+' missing '+selector);
  for(let i=0;i<4;i++)assert.ok(Math.abs(now.boxes[selector][i]-position[i])<=.75,
    label+' '+selector+' moved '+['x','y','width','height'][i]+
    ' from '+position[i]+' to '+now.boxes[selector][i]);
 }
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await playwright[engine].launch({
  headless:true,
  executablePath:engine==='chromium'?(process.env.CHROME_PATH||'/usr/bin/chromium'):undefined,
  args:engine==='chromium'?['--no-sandbox']:[]
 });
 try{
  fs.mkdirSync(out,{recursive:true});
  const views=[{width:1473,height:1024},{width:844,height:390},{width:390,height:780}];
  for(const view of views){
   const context=await browser.newContext({viewport:view,deviceScaleFactor:2});
   await context.route('https://**/*',route=>route.fulfill({body:'',contentType:'text/javascript'}));
   await context.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.goto('http://127.0.0.1:'+server.address().port+'/?host=1');
   await page.locator('#offlineBtn').click();
   // Offline setup deliberately starts with 2 demo bots. Remove them to
   // compare genuine 0-to-12 additions against the same initial geometry.
   while(await page.locator('#roster .roster-item:not(.roster-empty)').count()){
    await page.locator('#roster .roster-item:not(.roster-empty) button[aria-label^="เอา"]').last().click();
   }
   // Show identical QR/link content at every stage, like an actual hosted room.
   await page.evaluate(()=>{
    document.getElementById('roomPanel').classList.remove('hidden');
    document.getElementById('offlineRoomHint').classList.add('hidden');
    document.getElementById('roomCode').textContent='JM9V5L';
    document.getElementById('roomUrl').value='https://main.example.amplifyapp.com/?join=JM9V5L';
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,256,256);
    c.fillStyle='#000';for(let y=0;y<21;y++)for(let x=0;x<21;x++)
     if((x*7+y*13+x*y)%7<3)c.fillRect(9+x*11,9+y*11,11,11);
    document.getElementById('qrBox').replaceChildren(canvas);
   });
   const baseline=await geometry(page);
   assert.equal(baseline.bots,0);
   assert.equal(baseline.buttonHidden,true,'zero-bot button is invisible but reserves its slot');
   for(let count=1;count<=12;count++){
    await page.locator('#addLocalBtn').click();
    const now=await geometry(page);
    assert.equal(now.bots,count);
    assert.equal(now.buttonHidden,false);
    stable(baseline,now,view.width+'x'+view.height+' '+count+' bots');
    if(count===1||count===12)
      await page.screenshot({path:path.join(out,engine+'-'+view.width+'x'+view.height+'-'+count+'-bots.png')});
   }
   await page.locator('#roster .roster-item:not(.roster-empty) .roster-pick').first().click();
   stable(baseline,await geometry(page),'change individual bot game');
   for(const mode of ['endless','board','queue','board','endless','queue']){
    await page.locator('[data-session-mode="'+mode+'"]').click();
    const now=await geometry(page);
    assert.equal(now.buttonHidden,mode==='board','board hides bulk switch without collapsing track');
    stable(baseline,now,view.width+'x'+view.height+' '+mode);
    if(mode==='board')await page.screenshot({path:path.join(out,engine+'-'+view.width+'x'+view.height+'-board.png')});
   }
   // Test removing all bots, including the last transition back to zero.
   for(let count=11;count>=0;count--){
    await page.locator('#roster .roster-item:not(.roster-empty) button[aria-label^="เอา"]').last().click();
    const now=await geometry(page);
    assert.equal(now.bots,count);
    stable(baseline,now,'remove to '+count+' bots');
   }
   assert.equal((await geometry(page)).buttonHidden,true);
   assert.deepEqual(errors,[],'lobby state changes do not throw JavaScript errors');
   await context.close();
  }
  console.log('LOBBY STABILITY '+engine+': 3 viewports, 0–12 joins/removals, bot selection, all 3 modes: no layout motion');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
