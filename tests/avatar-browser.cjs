/* Real SVG rasterization: projections, heading, inline colors and vector fallback. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1080,height:760},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>body{margin:0;background:#152c3d;color:#dfedf5;font:14px system-ui}h1{font-size:20px;margin:20px}#portraits{display:flex;gap:10px;margin:20px}#portraits svg{width:68px;height:68px}canvas{display:block;margin:20px;background:#b0a377;border-radius:10px}</style><h1>FRONT PORTRAITS / player colors</h1><div id="portraits"></div><h1>OVERHEAD / eight headings · actual 52 px sprite + enlarged view</h1><canvas id="sheet" width="1040" height="300"></canvas><h1>POSES / idle · walk · walk2 · hold · attack</h1><canvas id="poses" width="1040" height="110"></canvas>');
  await page.addScriptTag({path:path.resolve('player-avatar.js')});
  const result=await page.evaluate(async()=>{
   const A=PartyPlayerAvatar,colors=['#ff0000','#ff628c','#fd9855','#ffd45b','#65d8a1','#47d9d3','#69b4f7','#8f92f5','#bd85f0','#e39ce5','#8cc48d','#e3c59f'];
   document.getElementById('portraits').innerHTML=colors.map(c=>A.svgForFront(c)).join('');
   A.preload(colors.map(color=>({color})));
   await Promise.all(colors.flatMap(c=>['idle','walk','walk2','hold','attack'].map(p=>A.imageFor(c,p).decode())));
   await Promise.all(colors.map(c=>A.imageForFront(c).decode()));
   const g=document.getElementById('sheet').getContext('2d');
   for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,dir={x:Math.sin(angle),y:-Math.cos(angle)},x=65+i*130;
    A.draw(g,{x,y:56,color:'#ff0000',dir},{label:false});
    A.draw(g,{x,y:190,color:'#ff0000',dir},{label:false,scale:2.7});
    g.font='13px system-ui';g.fillStyle='#26352d';g.textAlign='center';g.fillText(i*45+'°',x,285);
   }
   const poses=['idle','walk','walk2','hold','attack'],h=document.getElementById('poses').getContext('2d');
   for(let i=0;i<poses.length;i++)h.drawImage(A.imageFor('#ff0000',poses[i]),i*200+50,10,90,90);
   // White eye pixels must be on the forward rim for all eight headings.
   const eyeDots=[];
   for(let i=0;i<8;i++){
    const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
    const angle=i*Math.PI/4,dir={x:Math.sin(angle),y:-Math.cos(angle)};
    A.draw(ctx,{x:64,y:64,color:'#ff0000',dir},{scale:2,label:false});
    const pixels=ctx.getImageData(0,0,128,128).data;let x=0,y=0,count=0;
    for(let j=0;j<pixels.length;j+=4)if(pixels[j]>235&&pixels[j+1]>235&&pixels[j+2]>235&&pixels[j+3]>220){x+=(j/4)%128-64;y+=Math.floor(j/4/128)-64;count++;}
    eyeDots.push({count,forward:(x*dir.x+y*dir.y)/count,side:Math.abs(-x*dir.y+y*dir.x)/count});
   }
   const ids=[...document.querySelectorAll('#portraits [id]')].map(n=>n.id);
   // SVG and loading/error Canvas fallback must agree pixel-for-pixel in shape.
   const frame=document.createElement('iframe');document.body.append(frame);
   frame.contentWindow.Image=undefined;
   return {eyeDots,ids};
  });
  for(const e of result.eyeDots){assert.ok(e.count>30);assert.ok(e.forward>20,'eyes belong to forward rim, not face center');assert.ok(e.side<2,'left/right eyes balanced');}
  assert.equal(new Set(result.ids).size,result.ids.length,'inline portrait gradients must not borrow another player color');
  // A second isolated realm without Image executes the same fallback path.
  const source=fs.readFileSync('player-avatar.js','utf8');
  const comparison=await page.evaluate(source=>{
   const frame=document.querySelector('iframe'),w=frame.contentWindow;w.eval(source);
   let maxMean=0;
   for(const front of [false,true])for(const pose of ['idle','hold','attack']){
    const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=a.height=b.width=b.height=128;
    const opts={label:false,scale:2,holding:pose==='hold',attacking:pose==='attack'},p={x:64,y:64,color:'#ff0000',dir:{x:1,y:0}};
    if(front){PartyPlayerAvatar.drawFront(a.getContext('2d'),p,64,64,104);w.PartyPlayerAvatar.drawFront(b.getContext('2d'),p,64,64,104);}
    else{PartyPlayerAvatar.draw(a.getContext('2d'),p,opts);w.PartyPlayerAvatar.draw(b.getContext('2d'),p,opts);}
    const aa=a.getContext('2d').getImageData(0,0,128,128).data,bb=b.getContext('2d').getImageData(0,0,128,128).data;
    let diff=0;for(let j=0;j<aa.length;j++)diff+=Math.abs(aa[j]-bb[j]);maxMean=Math.max(maxMean,diff/aa.length);
   }
   frame.remove();return maxMean;
  },source);
  assert.ok(comparison<4,'SVG/fallback rendering mismatch: '+comparison);
  assert.deepEqual(errors,[]);
  fs.mkdirSync('/tmp/game-friends-avatar',{recursive:true});
  await page.screenshot({path:'/tmp/game-friends-avatar/reference-projections.jpg',type:'jpeg',quality:92,scale:'css'});
  console.log('AVATAR BROWSER PASS: eight forward-rim headings,12 isolated color gradients, poses, SVG/fallback mean error '+comparison.toFixed(3));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
