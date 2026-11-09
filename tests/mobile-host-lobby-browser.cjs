/* Real mobile HOST lobby geometry regression — no PeerJS required.
   Tests compact QR/share and all 12 cards at Android and iPhone portrait sizes. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const playwright=require('playwright');
const root=path.resolve(__dirname,'..');
const engine=process.env.BOARD_BROWSER||'chromium';
const out=process.env.BOARD_SCREENSHOTS||'/tmp/game-friends-board';
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!target.startsWith(root+path.sep)||!fs.existsSync(target)){res.writeHead(404).end();return;}
 const ext=path.extname(target),types={'.html':'text/html','.js':'text/javascript','.css':'text/css',
  '.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
 res.writeHead(200,{'content-type':types[ext]||'application/octet-stream'});
 res.end(fs.readFileSync(target));
});
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 fs.mkdirSync(out,{recursive:true});
 const browser=await playwright[engine].launch({
  headless:true,
  executablePath:engine==='chromium'?(process.env.CHROME_PATH||'/usr/bin/chromium'):undefined,
  args:engine==='chromium'?['--no-sandbox']:[]
 });
 try{
  for(const view of [{width:360,height:640},{width:390,height:780},{width:412,height:915}]){
   const context=await browser.newContext({viewport:view,deviceScaleFactor:2,isMobile:true,hasTouch:true});
   // CDN scripts are not needed for an offline lobby. Keep tests deterministic.
   await context.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
   await context.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/?host=1');
   await page.locator('#offlineBtn').click();
   for(let i=0;i<10;i++)await page.locator('#addLocalBtn').click();
   assert.equal(await page.locator('#roster .roster-item').count(),12);
   // Offline test mode uses an empty invite area. Reveal a representative
   // QR canvas to test the same DOM/CSS used by an ONLINE room.
   await page.evaluate(()=>{
    document.getElementById('roomPanel').classList.remove('hidden');
    document.getElementById('offlineRoomHint').classList.add('hidden');
    document.getElementById('roomCode').textContent='Q4AFYQ';
    document.getElementById('roomUrl').value='https://main.example.amplifyapp.com/?join=Q4AFYQ';
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,256,256);
    ctx.fillStyle='#111';for(let y=0;y<21;y++)for(let x=0;x<21;x++){
     if((x*x+3*y+x*y)%5<2)ctx.fillRect(8+x*11,8+y*11,11,11);
    }
    document.getElementById('qrBox').replaceChildren(canvas);
   });
   const bounds=await page.evaluate(()=>{
    const rotated=document.body.classList.contains('gf-virtual-landscape');
    // Compare in the LOGICAL landscape coordinate system, regardless of
    // whether the device/browser physically rotated or the shell did.
    const pos=el=>{
     const x=el.getBoundingClientRect();
     if(!rotated)return{top:x.top,bottom:x.bottom,left:x.left,right:x.right,
       width:x.width,height:x.height};
     return{top:innerWidth-x.right,bottom:innerWidth-x.left,
       left:x.top,right:x.bottom,width:x.height,height:x.width};
    };
    const r=id=>pos(document.getElementById(id));
    const card=document.querySelector('#roster .roster-item');
    const pick=card.querySelector('.roster-pick'),
     mode=pick.querySelector('.mode-choice-title');
    return{rotated,vh:rotated?innerWidth:innerHeight,
     vw:rotated?innerHeight:innerWidth,
     qrPanel:r('roomPanel'),panel:r('hostLobby'),
     qr:r('qrBox'),url:r('roomUrl'),copy:r('copyBtn'),
     playerPanel:r('roster'),first:pos(card),
     last:pos(document.querySelector('#roster .roster-item:last-child')),
     pick:pos(pick),mode:pos(mode),
     rootScroll:document.documentElement.scrollHeight>innerHeight+1,
     pageScroll:document.documentElement.scrollWidth>innerWidth+1};
   });
   assert.ok(bounds.rotated,'opened host rooms must present landscape even in portrait browser');
   assert.ok(bounds.qrPanel.top>=bounds.panel.top-2&&
     bounds.qrPanel.bottom<=bounds.panel.bottom+2&&
     bounds.qrPanel.width<=bounds.panel.width*.52,
     'invite section must occupy a compact left column: '+JSON.stringify(bounds));
   assert.ok(bounds.qr.width>=65&&bounds.qr.height>=65,
     'real 256px QR must remain legible on a small landscape viewport: '+JSON.stringify(bounds));
   assert.ok(bounds.qr.right+5<bounds.url.left&&bounds.qr.right+5<bounds.copy.left,
     'QR is at LEFT of both share controls in logical landscape coordinates');
   assert.ok(bounds.url.bottom<bounds.copy.top,
     'URL and copy remain stacked inside the share column');
   assert.ok(bounds.playerPanel.width>bounds.qrPanel.width*.9&&
      bounds.playerPanel.height>bounds.qrPanel.height*.55,
     'twelve-seat grid must get a full right-hand landscape column');
   assert.ok(bounds.last.bottom<=bounds.playerPanel.bottom+2&&
     bounds.first.top>=bounds.playerPanel.top-2,
     'all 12 slots remain inside the landscape roster panel');
   assert.ok(bounds.mode.top>=bounds.pick.top-3&&bounds.mode.bottom<=bounds.pick.bottom+3,
     'selected game title must remain inside its touch target');
   assert.ok(bounds.panel.bottom<=bounds.vh+2&&!bounds.rootScroll&&!bounds.pageScroll,
     'landscape lobby must fit its viewport without document scrolling');
   assert.equal(await page.locator('#copyBtn').isVisible(),true);
   assert.equal(await page.locator('#startBtn').isVisible(),true);
   // Game-selection remains functional at full room capacity.
   await page.locator('#roster .roster-item .roster-pick').first().click();
   assert.equal(await page.locator('#roster .roster-item .mode-choice-title').first().innerText(),'CHICKENS');
   await page.screenshot({path:path.join(out,'mobile-host-lobby-'+engine+'-'+view.width+'x'+view.height+'.png')});
   assert.deepEqual(errors,[],'no client JS error on mobile lobby');
   await context.close();
  }
  console.log('MOBILE LOBBY '+engine+': compact left QR, right share, unclipped 12-slot roster at 360/390/412px — PASS');
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
