/* Party Plaza small-screen regression: full scene plus exclusive QR, roster
 * and settings popovers, with safe-area placement in Chromium and WebKit. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require('playwright'),engine=process.env.BOARD_BROWSER||'chromium';
const root=path.resolve(__dirname,'..'),out=process.env.BOARD_SCREENSHOTS||'/tmp/game-friends-board';
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!target.startsWith(root+path.sep)||!fs.existsSync(target)){res.writeHead(404).end();return;}
 const ext=path.extname(target),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.b64':'text/plain','.png':'image/png'};
 res.writeHead(200,{'content-type':types[ext]||'application/octet-stream'});res.end(fs.readFileSync(target));
});
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 fs.mkdirSync(out,{recursive:true});
 const browser=await playwright[engine].launch({headless:true,
  executablePath:engine==='chromium'?(process.env.CHROME_PATH||'/usr/bin/chromium'):undefined,
  args:engine==='chromium'?['--no-sandbox']:[]});
 try{
  for(const view of [{width:360,height:640},{width:390,height:780},{width:412,height:915}]){
   const context=await browser.newContext({viewport:view,deviceScaleFactor:2,isMobile:true,hasTouch:true});
   await context.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/?host=1');
   await page.locator('#offlineBtn').click();
   await page.waitForFunction(()=>window.PartyPlaza?.isReady(),null,{timeout:10000});
   assert.equal(await page.locator('#plazaCanvas').isVisible(),true);
   const original=await page.locator('#plazaCanvas').boundingBox();
   assert.equal(await page.locator('#hostLobby').evaluate(e=>e.classList.contains('plaza-loaded')),true);
   const buttons=['#plazaRosterToggle','#plazaSettingsToggle','#plazaStartBtn'];
   assert.equal(await page.locator('#plazaRoomToggle').isVisible(),false,
    'old header QR button must be absent');
   assert.equal(await page.locator('#plazaCenterQrBtn').isVisible(),true,
    'central room QR remains on the map');
   for(const selector of buttons)assert.equal(await page.locator(selector).isVisible(),true,selector);
   // All twelve slots still exist, but do not consume the entire display.
   assert.equal(await page.locator('#roster .roster-item').count(),12);
   await page.evaluate(()=>{
    document.getElementById('roomPanel').classList.remove('hidden');
    document.getElementById('offlineRoomHint').classList.add('hidden');
    document.getElementById('roomCode').textContent='Q4AFYQ';
    document.getElementById('roomUrl').value='https://main.example.amplifyapp.com/?join=Q4AFYQ';
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,256,256);
    ctx.fillStyle='#111';for(let y=0;y<21;y++)for(let x=0;x<21;x++)
     if((x*x+3*y+x*y)%5<2)ctx.fillRect(8+x*11,8+y*11,11,11);
    document.getElementById('qrBox').replaceChildren(canvas);
   });
   assert.equal(await page.locator('#qrBox').isVisible(),true,'QR remains in the central button');
   assert.equal(await page.locator('#copyBtn').isVisible(),false,'old copy button is hidden');
   assert.ok((await page.locator('#qrBox').boundingBox()).width>=65,'QR legible');
   await page.locator('#plazaRosterToggle').click();
   assert.equal(await page.locator('#roster').isVisible(),true);
   assert.equal(await page.locator('#plazaRoomPanel').isVisible(),false,
    'QR must close when roster opens');
   await page.locator('#plazaSettingsToggle').click();
   assert.equal(await page.locator('#addLocalBtn').isVisible(),true);
   assert.equal(await page.locator('#plazaRosterPanel').isVisible(),false,
    'roster must close when Settings opens');
   assert.equal(await page.locator('#plazaRoomToggle').getAttribute('aria-expanded'),'false');
   assert.equal(await page.locator('#plazaSettingsToggle').getAttribute('aria-expanded'),'true');
   // iPad safe-area and compact phone layouts: the Settings popover starts
   // BELOW the actual visible header, and all three game choices form rows.
   const popup=await page.evaluate(()=>{
    const host=document.getElementById('hostLobby'),
     panel=host.querySelector('.lobby-controls'),
     bar=host.querySelector('.lobby-bar'),
     choices=Array.from(host.querySelectorAll('#sessionMode .seg-option'));
    return {
     headerBottom:(parseFloat(getComputedStyle(bar).top)||0)+bar.offsetHeight,
     panelTop:parseFloat(getComputedStyle(panel).top)||0,
     optionTops:choices.map(choice=>choice.offsetTop),
     optionHeights:choices.map(choice=>choice.offsetHeight)
    };
   });
   assert.ok(popup.panelTop>=popup.headerBottom+2,
    'Settings must start below safe-area header: '+JSON.stringify(popup));
   assert.ok(popup.optionHeights.every(h=>h>=36),
    'Settings game choices must remain readable: '+JSON.stringify(popup));
   assert.ok(popup.optionTops[0]<popup.optionTops[1]&&popup.optionTops[1]<popup.optionTops[2],
    'game mode buttons must be three stacked rows: '+JSON.stringify(popup));
   await page.locator('#addLocalBtn').click();
   assert.equal(await page.locator('#roster .roster-item:not(.roster-empty)').count(),3);
   // Hiding panels restores full map, not a new layout or smaller canvas.
   await page.locator('#plazaSettingsToggle').click();
   await page.locator('#plazaRoomToggle').click();
   await page.locator('#plazaRosterToggle').click();
   const after=await page.locator('#plazaCanvas').boundingBox();
   for(const field of ['x','y','width','height'])
    assert.ok(Math.abs(original[field]-after[field])<=1,'world canvas resized/reflowed: '+field);
   assert.equal(await page.locator('#qrBox').isVisible(),true,
    'central QR remains visible when panels close');
   await page.screenshot({path:path.join(out,'mobile-party-plaza-'+engine+'-'+view.width+'x'+view.height+'.png')});
   assert.deepEqual(errors,[],'no runtime errors on mobile host');
   await context.close();
  }
  console.log('MOBILE PARTY PLAZA '+engine+': central QR, roster/settings overlays and full scene stable');
 }finally{await browser.close();server.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
