/* Real Chromium/WebKit landscape geometry: web host and installed PWA.
 * Physics and browser orientation permissions are not mocked. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require('playwright'),root=path.resolve(__dirname,'..');
const engine=process.env.BOARD_BROWSER||'chromium';
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png'};
 res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});
 res.end(fs.readFileSync(file));
});
async function test(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await playwright[engine].launch({headless:true,
  executablePath:engine==='chromium'?(process.env.CHROME_PATH||'/usr/bin/chromium'):undefined,
  args:engine==='chromium'?['--no-sandbox']:[]});
 try{
  for(const installed of [false,true]){
   const context=await browser.newContext({viewport:{width:390,height:844},
     deviceScaleFactor:2,isMobile:true,hasTouch:true});
   await context.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
   if(installed){
    await context.addInitScript(()=>{
     Object.defineProperty(navigator,'standalone',{value:true,configurable:true});
    });
   }
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/?host=1');
   if(installed){
    await page.waitForFunction(()=>document.body.classList.contains('gf-virtual-landscape'));
    assert.equal(await page.locator('#home').isVisible(),true);
    const body=await page.evaluate(()=>{
     const r=document.body.getBoundingClientRect();
     return {width:r.width,height:r.height,x:r.x,y:r.y};
    });
    assert.ok(Math.abs(body.width-390)<3&&Math.abs(body.height-844)<3,
     'installed home must fill physical portrait viewport with rotated landscape layout');
   }else{
    assert.equal(await page.evaluate(()=>document.body.classList.contains('gf-virtual-landscape')),false,
     'web landing page remains readable before entering a room');
   }
   // The offline button belongs to the home page; add bot is a lobby control.
   await page.locator('#offlineBtn').click();
   await page.locator('#addLocalBtn').click();
   await page.waitForFunction(()=>document.body.classList.contains('gf-virtual-landscape'));
   const r=await page.evaluate(()=>{
    const x=document.getElementById('hostLobby').getBoundingClientRect();
    return {left:x.left,top:x.top,right:x.right,bottom:x.bottom,width:x.width,height:x.height};
   });
   assert.ok(Math.abs(r.width-390)<4&&Math.abs(r.height-844)<4&&
    r.left>=-3&&r.top>=-3&&r.right<=393&&r.bottom<=847,
    'host lobby should fill all available physical viewport, even when orientation cannot lock: '+JSON.stringify(r));
   assert.equal(await page.locator('#roster .roster-item').count(),12,
    'landscape lobby preserves 12 available player seats');
   assert.equal(await page.locator('#startBtn').isVisible(),true);
   assert.equal(await page.locator('#rotateNotice').isVisible(),false,
    'orientation dialog must never cover a joined controller');
   // The Start button is a real hit-test target in a transformed shell.
   const at=await page.locator('#startBtn').boundingBox();
   assert.ok(at&&at.width>15&&at.height>10&&at.x>=-3&&at.y>=-3&&
    at.x+at.width<=393&&at.y+at.height<=847,'start button must be on-screen');
   assert.deepEqual(errors,[],'no runtime errors in immersive landscape');
   await context.close();
  }
  console.log('LANDSCAPE SHELL '+engine+' PASS: installed home, web host lobby, 12 seats and touchscreen hitboxes');
 }finally{await browser.close();server.close();}
}
test().catch(e=>{console.error(e);process.exitCode=1;server.close();});
