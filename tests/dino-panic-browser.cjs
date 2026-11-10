'use strict';
/* Focused native minigame render smoke for Chromium and WebKit.
 * This does not load old games or the heavyweight lobby/board runtime. */
const assert=require('node:assert/strict'),fs=require('node:fs'),
 path=require('node:path'),http=require('node:http');
const playwright=require('playwright'),name=process.env.BOARD_BROWSER||'chromium';
const root=path.resolve(__dirname,'..');
const out=process.env.DINO_PANIC_SCREENSHOTS||'/tmp/game-friends-board/dino-panic';
const html='<!doctype html><html><body style="margin:0"><canvas id="arena" width="960" height="540"></canvas>'+
 '<script type="module">import engine from "/src/games/dino-panic/game.js";window.dinoEngine=engine;</script></body></html>';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.setHeader('content-type','text/html');res.end(html);return;}
 const file=path.resolve(root,'.'+url.pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('content-type',path.extname(file)==='.js'?'text/javascript':'text/plain');
 res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await playwright[name].launch({headless:true,...(name==='chromium'?{
  executablePath:process.env.CHROME_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),
  args:['--no-sandbox']}:{} )});
 try{
  fs.mkdirSync(out,{recursive:true});
  const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction('!!window.dinoEngine');
  for(const n of [1,6,7,12]){
   const result=await page.evaluate(n=>{
    const players=Array.from({length:n},(_,i)=>({
     id:'p'+i,name:'P'+i,color:['#ffd34f','#45c1fa','#55dd65'][i%3],
     active:true,isBot:i%2===1,input:{axisX:1,axisY:0}
    }));
    const round={phase:'playing',paused:false,dinoSeed:42};
    const s=window.dinoEngine.setup(round,players);
    for(let i=0;i<60;i++)window.dinoEngine.update(1/60,round,players);
    const c=document.getElementById('arena'),g=c.getContext('2d');
    window.dinoEngine.draw(g,1,round,players);
    const data=g.getImageData(0,0,960,540).data;
    let opaque=0;for(let i=3;i<data.length;i+=64)if(data[i]>0)opaque++;
    return{opaque,spawns:players.length,valid:players.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),
     survivors:window.dinoEngine.hud(players,round).survivors};
   },n);
   assert.ok(result.opaque>25000,'painted full viewport');
   assert.equal(result.spawns,n);
   assert.equal(result.valid,true);
   assert.ok(result.survivors>=0&&result.survivors<=n);
   if(n===6||n===12)
    await page.locator('#arena').screenshot({path:path.join(out,name+'-'+n+'.png')});
  }
  assert.deepEqual(errors,[],'no browser runtime exceptions');
  console.log('DINO PANIC '+name+': native renderer/browser smoke specified.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
