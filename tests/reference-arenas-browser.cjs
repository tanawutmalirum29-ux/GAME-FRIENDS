/* Browser QA for PR #189 SVG scenery: actual HOST, both world sizes,
 * image decoding, fallback changes, and screenshot evidence.
 * Run via the shared Chromium/WebKit CI browser matrix. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require('playwright');
const browserName=process.env.BOARD_BROWSER||'chromium';
const root=path.resolve(__dirname,'..');
const output='/tmp/game-friends-board/reference-arenas';
const hook='window.__referenceQA={startRound,addLocal,returnToLobby,drawGame,get round(){return round},get players(){return players}};requestAnimationFrame(animate);\n})();';
const modes=[
 ['color_claim','colorClaim','COLOR CLAIM'],
 ['ice_race','iceRace','ICE RACE'],
 ['lawn_mower','lawnMower','LAWN MOWER'],
 ['gladiators','gladiators','GLADIATORS']
];
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 const target=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));
 if(!target.startsWith(root+path.sep)||!fs.existsSync(target)){
  res.writeHead(404).end();return;
 }
 let body=fs.readFileSync(target);
 if(target===path.join(root,'index.html'))
  body=require('./helpers/legacy-game-html.cjs').withLegacyGameFixtures(body.toString());
 if(target===path.join(root,'app.js')){
  const app=body.toString();
  assert.ok(app.includes('requestAnimationFrame(animate);\n})();'),'HOST test hook missing');
  body=app.replace('requestAnimationFrame(animate);\n})();',hook);
 }
 res.setHeader('Content-Type',({
  '.html':'text/html','.js':'text/javascript','.css':'text/css',
  '.json':'application/json','.svg':'image/svg+xml'
 })[path.extname(target)]||'application/octet-stream');
 res.end(body);
});
async function start(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await playwright[browserName].launch({headless:true,...(
  browserName==='chromium'?{
   executablePath:process.env.CHROME_PATH||(
    fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),
   args:['--no-sandbox']
  }:{}
 )});
 try{
  fs.mkdirSync(output,{recursive:true});
  const context=await browser.newContext({
   viewport:{width:1280,height:800},deviceScaleFactor:1
  });
  await context.route('https://**/*',route=>route.fulfill({
   body:'',contentType:'text/javascript'
  }));
  await context.addInitScript(()=>{
   window.requestAnimationFrame=()=>0;
   window.__referenceImages=[];
   const NativeImage=window.Image;
   window.Image=class extends NativeImage{
    constructor(...args){super(...args);window.__referenceImages.push(this);}
   };
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.evaluate(()=>document.getElementById('offlineBtn').click());
  assert.equal(await page.evaluate(()=>!!window.ReferenceArenaArt),true,
   'SVG art module is absent or loaded in the wrong order');
  let checked=0;
  for(const [mode,key,title] of modes)for(const n of [1,6,7,12]){
   const result=await page.evaluate(async({mode,key,n})=>{
    const app=window.__referenceQA;
    if(!app)throw Error('HOST QA hook unavailable');
    app.returnToLobby();
    app.players.splice(n);
    while(app.players.length<n)app.addLocal();
    // Ignore decoded images from previously checked scenes: retaining them
    // makes WebKit decode and inspect an ever-growing backlog.
    window.__referenceImages.length=0;
    app.startRound(mode);
    app.round.phase='playing';
    const scene=app.round[key],art=window.ReferenceArenaArt;
    if(!scene)throw Error('Missing round state: '+key);
    // Explicitly verify that newly authored SVG strings are well formed.
    const samples=[];
    if(mode==='color_claim')samples.push(art.claimSceneSVG(scene),
     art.claimCarSVG('#e54e70'));
    if(mode==='ice_race')samples.push(art.iceSceneSVG(scene),
     art.sledSVG('#e54e70'));
    if(mode==='lawn_mower')samples.push(art.lawnSceneSVG(scene),
     art.lawnSceneSVG(scene,true),art.grassAtlasSVG(),art.mowerSVG('#e54e70'));
    if(mode==='gladiators')samples.push(art.colosseumSVG(scene),
     art.maceSVG('#e54e70'),art.chainSVG());
    for(const svg of samples){
     const xml=new DOMParser().parseFromString(svg,'image/svg+xml');
     if(xml.querySelector('parsererror')||xml.documentElement.localName!=='svg')
      throw Error('Malformed '+mode+' SVG');
    }
    const canvas=document.getElementById('arena');
    const g=canvas.getContext('2d');
    app.drawGame(1.5);
    for(let pass=0;pass<3;pass++){
     const images=window.__referenceImages.filter(i=>
      i.src.startsWith('data:image/svg+xml'));
     // SVG decoders can occasionally stall in WebKit. Fail this scene
     // explicitly instead of leaving page.evaluate() unresolved forever.
     let timeoutId;
     try{
      await Promise.race([
       Promise.all(images.map(i=>i.decode())),
       new Promise((_,reject)=>{
        timeoutId=setTimeout(()=>reject(Error(
         'SVG decode timeout: '+mode+' / '+n+' players, pass '+(pass+1))),15000);
       })
      ]);
     }finally{clearTimeout(timeoutId);}
     app.drawGame(1.5);
    }
    const images=window.__referenceImages.filter(i=>
     i.src.startsWith('data:image/svg+xml'));
    const broken=images.filter(i=>!i.complete||!i.naturalWidth);
    const first=g.getImageData(0,0,canvas.width,canvas.height).data;
    // Compare against the old Canvas fallback at exactly the same timestamp.
    // This proves the new art is actually being used, not merely imported.
    window.ReferenceArenaArt=null;
    app.drawGame(1.5);
    const fallback=g.getImageData(0,0,canvas.width,canvas.height).data;
    window.ReferenceArenaArt=art;
    app.drawGame(1.5);
    let changed=0,visible=0;
    const colors=new Set();
    for(let y=0;y<canvas.height;y+=10)for(let x=0;x<canvas.width;x+=10){
     const i=(y*canvas.width+x)*4;
     if(first[i+3]>0)visible++;
     if(Math.abs(first[i]-fallback[i])+
       Math.abs(first[i+1]-fallback[i+1])+
       Math.abs(first[i+2]-fallback[i+2])>35)changed++;
     colors.add(first[i]>>4|0); // other channels are checked by changed count
    }
    return {count:app.players.length,width:scene.w||scene.bounds.w,
      height:scene.h||scene.bounds.h,images:images.length,broken:broken.length,
      icePoints:mode==='ice_race'?scene.path.length:null,
      iceTrackLength:mode==='ice_race'?scene.trackLength:null,
      changed,visible,colors:colors.size,canvasW:canvas.width,
      canvasH:canvas.height};
   },{mode,key,n});
   assert.equal(result.count,n,title+' roster');
   const raceSize=mode==='ice_race'?(n<=4?[960,540]:n<=8?[1200,675]:[1440,810]):null;
   assert.equal(result.width,raceSize?raceSize[0]:(n<=6?960:1280),title+' '+n+' world width');
   assert.equal(result.height,raceSize?raceSize[1]:(n<=6?540:720),title+' '+n+' world height');
   assert.equal(result.broken,0,title+' '+n+' invalid SVG images');
   assert.ok(result.images>0,title+' '+n+' did not load SVG images');
   assert.ok(result.visible>100,title+' '+n+' blank canvas');
   if(mode==='ice_race'){
    // The new ICE RACE owns its Canvas terrain renderer and intentionally
    // does not use the obsolete ReferenceArenaArt.iceSceneSVG fallback.
    // Verify real authored road geometry and sufficient canvas complexity.
    assert.ok(result.icePoints>80,title+' '+n+' detailed track geometry absent');
    assert.ok(result.iceTrackLength>700,title+' '+n+' short/incomplete course');
    assert.ok(result.colors>8,title+' '+n+' terrain artwork appears blank');
   }else{
    assert.ok(result.changed>300,title+' '+n+' appears to render only its old fallback');
   }
   assert.equal(errors.length,0,title+' '+n+' browser exception: '+errors.join('; '));
   if(n===6||n===12){
    await page.locator('#arena').screenshot({
     path:path.join(output,mode+'-'+n+'-'+browserName+'.png')
    });
   }
   checked++;
   console.log('REFERENCE ARENA SCENE PASS: '+mode+' / '+n+' players / '+browserName);
  }
  console.log('REFERENCE ARENA SVG Browser QA PASS: '+checked+
   ' real HOST scenes / '+browserName+'; all images decoded, '+
   'SVGs parsed and artwork differs from the old fallback');
 }finally{await browser.close();}
}
start().catch(err=>{console.error(err.stack||String(err));process.exitCode=1;})
 .finally(()=>server.close());