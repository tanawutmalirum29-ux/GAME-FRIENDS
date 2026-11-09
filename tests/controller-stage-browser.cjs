/* Fixed-stage geometry in real Chromium/WebKit, including rotated iPhone. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require('playwright'),root=path.resolve(__dirname,'..');
const engine=process.env.BOARD_BROWSER||'chromium';
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!target.startsWith(root+path.sep)||!fs.existsSync(target)){res.writeHead(404).end();return;}
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
 res.writeHead(200,{'content-type':mime[path.extname(target)]||'application/octet-stream'});
 res.end(fs.readFileSync(target));
});
async function run(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await playwright[engine].launch({headless:true,
  executablePath:engine==='chromium'?(process.env.CHROME_PATH||'/usr/bin/chromium'):undefined,
  args:engine==='chromium'?['--no-sandbox']:[]});
 try{
  let reference=null;
  for(const [width,height,portrait] of [[844,390,false],[667,305,false],[740,360,false],[390,844,true]]){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true});
   await context.route('https://**/*',route=>route.fulfill({body:'',contentType:'text/javascript'}));
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/?controller=1');
   await page.evaluate(p=>{
    document.body.classList.add('controller-playing');
    if(p)document.body.classList.add('portrait-fallback');
    document.getElementById('controller').classList.remove('hidden');
    document.getElementById('controllerActive').classList.remove('hidden');
    document.getElementById('joinForm').classList.add('hidden');
    // Test the joined portrait fallback without triggering a fresh
    // disconnected-controller orientation policy (this fixture has no PeerJS).
    if(p&&window.visualViewport)
      window.visualViewport.dispatchEvent(new Event('resize'));
    else window.dispatchEvent(new Event('resize'));
   },portrait);
   await page.waitForFunction(()=>
    getComputedStyle(document.getElementById('controller')).getPropertyValue('--gf-controller-stage-scale').trim()!==''
   ,null,{timeout:8000});
   const sizes=await page.evaluate(()=>{
    const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();
      return{w:r.width,h:r.height,left:r.left,top:r.top,right:r.right,bottom:r.bottom};};
    const stage=rect('controllerActive'),a=rect('buttonA'),b=rect('buttonB'),stick=rect('joystickBase');
    const v=window.visualViewport;
    const root=getComputedStyle(document.getElementById('controller'));
    return {stage,a,b,stick,viewport:{width:v?.width||innerWidth,height:v?.height||innerHeight},
      scale:parseFloat(root.getPropertyValue('--gf-controller-stage-scale')),
      safeX:parseFloat(root.paddingLeft)+parseFloat(root.paddingRight),
      safeY:parseFloat(root.paddingTop)+parseFloat(root.paddingBottom)};
   });
   assert.ok(Number.isFinite(sizes.scale)&&sizes.scale>0,JSON.stringify(sizes));
   const expected=portrait?Math.min((sizes.viewport.height-sizes.safeY)/844,
     (sizes.viewport.width-sizes.safeX)/390):Math.min((sizes.viewport.width-sizes.safeX)/844,
     (sizes.viewport.height-sizes.safeY)/390);
   assert.ok(Math.abs(expected-sizes.scale)<.003,JSON.stringify(sizes));
   assert.ok(Math.abs(sizes.stage.w-(portrait?390:844)*expected)<3,JSON.stringify(sizes));
   assert.ok(Math.abs(sizes.stage.h-(portrait?844:390)*expected)<3,JSON.stringify(sizes));
   assert.ok(sizes.stage.left>=-3&&sizes.stage.top>=-3&&
     sizes.stage.right<=sizes.viewport.width+3&&sizes.stage.bottom<=sizes.viewport.height+3,
     'fixed stage may not escape visible viewport '+JSON.stringify(sizes));
   assert.ok(Math.abs(sizes.a.w-102*expected)<2.5&&Math.abs(sizes.b.w-102*expected)<2.5,
     'A/B should scale exactly once '+JSON.stringify(sizes));
   assert.ok(Math.abs(sizes.stick.w-72*expected)<2.5,
     'floating stick should share stage scale '+JSON.stringify(sizes));
   if(!portrait){
    const ratio=sizes.a.w/sizes.stage.h;
    if(reference!==null)assert.ok(Math.abs(ratio-reference)<.005,'same control proportions across phones');
    reference=ratio;
   }
   assert.deepEqual(errors,[],'controller stage has no script exceptions');
   await context.close();
  }
  console.log('CONTROLLER STAGE PASS '+engine+': 844x390 baseline, two short landscape phones, rotated portrait, touch geometry');
 }finally{await browser.close();server.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;server.close();});
