/* Original overhead farm and ice scenery. The engines own gates, boundaries,
   chicken slots and collision radii; these painters never consume gameplay RNG. */
(() => {
'use strict';
const TAU=Math.PI*2,images=new Map(),backdrops=new WeakMap();
const noise=i=>{const n=Math.sin(i*127.1+63.7)*43758.5453;return n-Math.floor(n);};
const color=value=>/^#[\da-f]{6}$/i.test(value||'')?value:'#84979c';
const tint=(value,d)=>'#'+[1,3,5].map(i=>Math.max(0,Math.min(255,parseInt(color(value).slice(i,i+2),16)+d)).toString(16).padStart(2,'0')).join('');
const svg=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const oval=(g,x,y,rx,ry,fill)=>{g.beginPath();g.ellipse(x,y,rx,ry,0,0,TAU);g.fillStyle=fill;g.fill();};
function line(g,a,b,stroke,width=1){g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}
function path(g,points,fill){g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fillStyle=fill;g.fill();}
const ready=image=>!!(image?.complete&&image.naturalWidth>0);
function viewport(g){
 // Only the real HOST canvas shares a screen with the player roster. Gallery
 // canvases retain their full 16:9 world; physics never uses this transform.
 if(typeof document==='undefined'||g.canvas!==document.getElementById('arena'))return {x:0,y:0,scale:1};
 const bottom=window.PartyArenaScenes?.badgeBottomY?.();
 if(!Number.isFinite(bottom))return {x:0,y:0,scale:1};
 const y=Math.max(0,Math.min(450,bottom+6)),scale=(540-y)/540;
 return {x:(960-960*scale)/2,y,scale};
}
function beginScene(g,background,options){
 g.clearRect(0,0,960,540);g.fillStyle=background;g.fillRect(0,0,960,540);
 const v=viewport(g);
 if(v.scale!==1){
  // Boulder Bash is a left-to-right endless slope. Keep the top safe
  // area for the host HUD, but stretch ONLY its horizontal world to the
  // canvas edges, instead of creating blank bars on both sides.
  const edgeToEdge=options?.fullWidth===true;
  g.translate(edgeToEdge?0:v.x,v.y);
  g.scale(edgeToEdge?1:v.scale,v.scale);
 }
}
function imageFor(key,body){
 if(images.has(key))return images.get(key);
 if(typeof Image==='undefined')return null;
 const image=new Image();image.decoding='async';image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(body());images.set(key,image);return image;
}
function chickenSVG(flap=false){
 const dy=flap?3:0;
 return svg(64,48,`<defs><radialGradient id="feathers" cx=".35" cy=".25"><stop stop-color="#ffffff"/><stop offset=".6" stop-color="#f8f5e5"/><stop offset="1" stop-color="#c8cfc7"/></radialGradient></defs>
 <g data-prop="chicken"><path d="m24 16 9-5m-9 21 9 5" stroke="#b78c50" stroke-width="2" stroke-linecap="round"/>
 <path d="M19 24Q7 18 5 10Q15 9 22 18M18 25Q5 27 4 35Q17 38 23 29" fill="#f3f5eb" stroke="#aabbb1" stroke-width="1"/>
 <ellipse cx="27" cy="24" rx="15" ry="12" fill="url(#feathers)" stroke="#a6b6ac" stroke-width="1"/>
 <path d="M17 ${20-dy}Q18 ${7-dy} 31 ${9-dy}L35 20Q24 ${17-dy} 17 ${20-dy}Z" fill="#fffdf3" stroke="#bdc7bc"/>
 <path d="M17 ${28+dy}Q18 ${41+dy} 31 ${39+dy}L35 28Q24 ${31+dy} 17 ${28+dy}Z" fill="#f9f9ee" stroke="#bdc7bc"/>
 <path d="M20 19q7-4 11-2m-11 13q7 4 11 2" stroke="#d8dfd4" stroke-width="1" fill="none"/>
 <circle cx="39" cy="24" r="7" fill="url(#feathers)" stroke="#c2cec2"/>
 <path d="M36 18q-4-6 1-7q3-3 5 2q7-1 4 5l-5 2Z" fill="#ec5d52" stroke="#ba4e49" stroke-width=".7"/>
 <path d="m44 21 4 3-4 3Z" fill="#edb455" stroke="#a98449" stroke-width=".6"/>
 <ellipse cx="41.5" cy="21" rx="1.2" ry="1.6" fill="#354343"/><ellipse cx="41.5" cy="27" rx="1.2" ry="1.6" fill="#354343"/>
 <path d="M37 29q2 6 5 2" fill="#d75751"/><path d="M18 23q0-5 7-6" stroke="#fff" stroke-width="2.5" fill="none"/></g>`);
}
function iceBlockSVG(variant=0){
 const shift=variant*4;
 const cap=[
  'M10 43Q8 27 20 17Q34 5 52 7Q70 0 92 11Q109 13 115 33Q116 44 104 43Q91 55 77 44Q61 54 49 49Q24 62 10 43Z',
  'M11 43 20 20Q24 11 39 14L49 6Q62 3 73 10L91 12 108 27Q121 39 108 43L96 46 86 41Q70 51 60 43L43 54 24 48Z',
  'M10 42 21 19Q35 12 48 11L61 17 77 9Q93 8 102 23L114 33 109 44Q101 50 90 43L75 49 61 44 42 53Q22 56 10 42Z'
 ][variant%3];
 return svg(128,92,`<defs><linearGradient id="ice" x2=".4" y2="1"><stop stop-color="#d0faf8"/><stop offset=".5" stop-color="#77cbdc"/><stop offset="1" stop-color="#277e9c"/></linearGradient><linearGradient id="snow" x2=".3" y2="1"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#d9f5ee"/></linearGradient></defs>
 <g data-prop="ice-cliff"><path d="M5 49 15 18 48 5 91 8 117 32 124 57 107 82 39 90 9 74Z" fill="#38535e"/>
 <path d="M8 43 20 17 51 7 91 10 116 32 121 59 103 78 40 86 12 70Z" fill="url(#ice)" stroke="#72c4ce" stroke-width="2"/>
 <path d="M9 43 38 54 42 83M38 54 64 28 96 53 117 33M96 53 104 77M64 28 51 8" fill="none" stroke="#3b8aab" stroke-width="2.4"/>
 <path d="M20 17 52 7 92 11 115 33 96 52 68 42 40 55 10 43Z" fill="url(#snow)"/>
 <path d="${cap}" fill="url(#snow)" stroke="#c5edeb" stroke-width="1.4"/>
 <path d="M${25+shift} 20q14-10 29-5m15 4 20 8" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none"/>
 <path d="M18 53 24 66 35 72M99 59l8-5" stroke="#c3f3ed" stroke-width="3" fill="none" opacity=".7"/>
 <path d="M41 84 51 79 57 82 75 77 84 80 104 75" fill="none" stroke="#6c725b" stroke-width="3"/></g>`);
}
function waterSVG(){
 let facets='',ripples='';
 for(let i=0;i<32;i++){
  const x=noise(i+400)*1080-70,y=noise(i+800)*640-50,r=65+noise(i+50)*92;
  const points=Array.from({length:5},(_,j)=>{const a=j*TAU/5+i;return `${x+Math.cos(a)*r},${y+Math.sin(a)*r*.75}`;}).join(' ');
  facets+=`<polygon points="${points}" fill="${['#19c4e4','#78e7f0','#2158ac','#12a5dd'][i%4]}" opacity="${.07+(i%3)*.035}"/>`;
 }
 for(let i=0;i<35;i++){
  const x=noise(i+16)*960,y=noise(i+73)*540;
  ripples+=`<path d="M${x-13} ${y}q12-4 27 1m-21 6 16 1" fill="none" stroke="#a5f9fa" stroke-opacity=".13" stroke-width="1.4"/>`;
 }
 return svg(960,540,`<defs><radialGradient id="sea" cx=".48" cy=".5" r=".64"><stop stop-color="#43deec"/><stop offset=".53" stop-color="#17b9de"/><stop offset="1" stop-color="#1165c8"/></radialGradient></defs><g data-prop="glacial-water"><path d="M0 0H960V540H0Z" fill="url(#sea)"/>${facets}${ripples}</g>`);
}
function islandSVG(){
 let cliffs='',banks='',texture='';
 for(let i=0;i<35;i++){
  const a=i*TAU/35,co=Math.cos(a),si=Math.sin(a),r=228+noise(i)*3;
  const x=256+co*r,y=250+si*r,angle=a*180/Math.PI;
  cliffs+=`<path d="M${256+co*218} ${261+si*218}l${co*19-si*9} ${si*19+co*9} ${si*17} ${-co*17}Z" fill="${i%2?'#7fcbd6':'#a7dfe0'}" stroke="#b6e8e6" stroke-width="1"/>`;
  banks+=`<path transform="translate(${x} ${y}) rotate(${angle})" d="M-7-18Q${10+noise(i+9)*4}-20 12-7Q18 0 10 10Q11 23-7 20Q-14 8-7-18Z" fill="${i%3?'#edfdf4':'#dff8f1'}" stroke="#c3e9e7" stroke-width="1"/><path transform="translate(${x-2} ${y-3}) rotate(${angle})" d="M2-10Q7-3 4 7" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`;
 }
 for(let i=0;i<110;i++){
  const a=i*2.39996,r=Math.sqrt(noise(i+20))*211,x=256+Math.cos(a)*r,y=250+Math.sin(a)*r;
  texture+=`<ellipse cx="${x}" cy="${y}" rx="${1+noise(i+10)*2.6}" ry=".8" fill="${i%3?'#81c7d1':'#fff'}" opacity="${i%3?'.09':'.55'}"/>`;
 }
 return svg(512,512,`<defs><radialGradient id="snow" cx=".38" cy=".27"><stop stop-color="#f7fffa"/><stop offset=".6" stop-color="#e0faf6"/><stop offset="1" stop-color="#c9f2f1"/></radialGradient></defs><g data-prop="snow-island">
 <ellipse cx="259" cy="266" rx="237" ry="235" fill="#086ba56b"/><circle cx="256" cy="258" r="236" fill="#8ad9df"/>${cliffs}${banks}
 <circle cx="256" cy="250" r="220" fill="url(#snow)" stroke="#c2e9e7" stroke-width="1.6"/>
 <path d="M112 322q55 15 92 6m120-205q32 16 47 35m-63 240q-58 11-91-1" fill="none" stroke="#a4dce0" stroke-width="1.1" opacity=".2"/>${texture}</g>`);
}
function rockSVG(value,variant=0){
 const col=color(value),points=Array.from({length:11},(_,i)=>{
  const a=i*TAU/11,rad=46+noise(i+variant*31)*6;return{x:64+Math.cos(a)*rad,y:62+Math.sin(a)*rad};
 });
 let faces='';
 for(let i=0;i<11;i++){
  const a=points[i],b=points[(i+1)%11],mid={x:61+Math.cos(i*1.7)*13,y:58+Math.sin(i*1.7)*11};
  faces+=`<path d="M${a.x} ${a.y} ${b.x} ${b.y} ${mid.x} ${mid.y}Z" fill="${tint(col,[12,-18,0,-9,17,-23,5,12,-27,-10,8][i])}"/>`;
 }
 return svg(128,128,`<defs><radialGradient id="glint" cx=".3" cy=".2"><stop stop-color="#ffffff50"/><stop offset=".7" stop-color="#ffffff00"/><stop offset="1" stop-color="#152f3a45"/></radialGradient></defs><g data-prop="boulder">
 <polygon points="${points.map(p=>p.x+','+p.y).join(' ')}" fill="${col}"/>${faces}
 <polygon points="${points.map(p=>p.x+','+p.y).join(' ')}" fill="url(#glint)" stroke="${tint(col,-25)}" stroke-width="1.4"/>
 <path d="m36 35 18-11 17 4M91 59l8 10-6 15" fill="none" stroke="#e3f5ed" stroke-width="2.2" opacity=".28"/>
 <path d="m31 68 18 4 7 14m17-41 11 10-4 11" fill="none" stroke="#294652" stroke-opacity=".23" stroke-width="1.7"/></g>`);
}
function assetSVG(kind,value){
 if(kind==='chicken'||kind==='chicken-flap')return chickenSVG(kind==='chicken-flap');
 if(kind==='island')return islandSVG();if(kind==='water')return waterSVG();
 if(kind.startsWith('cliff'))return iceBlockSVG(Number(kind.slice(-1))||0);
 if(kind.startsWith('rock'))return rockSVG(value,Number(kind.slice(-1))||0);
 if(kind==='tree')return window.PartyArenaScenes?.treeSVG()||svg(160,160,'<circle cx="80" cy="80" r="65" fill="#72a945"/>');
 return '';
}
function asset(kind,value){return imageFor(kind+'/'+color(value),()=>assetSVG(kind,value));}
function sprite(g,kind,x,y,w,h,a=0,value){
 const image=asset(kind,value);g.save();g.translate(x,y);g.rotate(a);
 if(ready(image))g.drawImage(image,-w/2,-h/2,w,h);
 else oval(g,0,0,w*.35,h*.35,kind==='tree'?'#72a945':'#d6efec');g.restore();
}
function preload(mode){
 if(mode==='farm'){asset('tree');asset('chicken');asset('chicken-flap');}
 if(mode==='snow'){asset('water');asset('island');for(let i=0;i<3;i++)asset('cliff'+i);}
 if(mode==='boulder'){for(let i=0;i<3;i++){asset('cliff'+i);asset('rock'+i);}}
}
function cached(g,s,kind,w,h,paint){
 const t=g.getTransform?.(),density=t?Math.max(Math.hypot(t.a,t.b),Math.hypot(t.c,t.d)):1;
 const ratio=density>1.25&&w*h*4<=3000000?2:1;
 const key=[kind,ratio,[...images.values()].every(ready),s.radius,s.bounds?.x,s.bounds?.y,s.bounds?.w,s.bounds?.h].join('/');
 let entry=backdrops.get(s);
 if(!entry||entry.key!==key){
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w*ratio,h*ratio):typeof document!=='undefined'?document.createElement('canvas'):null;
  const c=canvas?.getContext?.('2d');
  if(c){
   canvas.width=w*ratio;canvas.height=h*ratio;c.scale(ratio,ratio);paint(c,s);
   // Flatten once: repeatedly downsampling an OffscreenCanvas containing the
   // clipped farm fence can replay its vector command list in Chromium.
   const source=canvas.transferToImageBitmap?.()||canvas;
   entry?.canvas?.close?.();entry={canvas:source,key};backdrops.set(s,entry);
  }
  else{paint(g,s);return;}
 }
 g.drawImage(entry.canvas,0,0,w,h);
}
function rail(g,a,b,value,thickness=5){
 line(g,{x:a.x+2,y:a.y+5},{x:b.x+2,y:b.y+5},'#35522555',thickness+3);
 line(g,a,b,tint(value,-53),thickness+2);line(g,a,b,value,thickness);
 line(g,{x:a.x,y:a.y-1.5},{x:b.x,y:b.y-1.5},tint(value,39),1.5);
 const length=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(length/40));
 for(let i=0;i<=n;i++){
  const x=a.x+(b.x-a.x)*i/n,y=a.y+(b.y-a.y)*i/n;
  g.fillStyle=tint(value,-29);g.fillRect(x-3,y-6,6,12);
  g.fillStyle=value;g.fillRect(x-3,y-6,5,8);g.fillStyle=tint(value,48);g.fillRect(x-3,y-6,5,2);
 }
}
function paintFarm(g,s){
 const u=s.world.w/960,c={x:s.center.x/u,y:s.center.y/u},r=s.radius/u;
 g.save();g.scale(u,u);
 const grass=g.createLinearGradient(0,0,960,540);grass.addColorStop(0,'#a4d933');grass.addColorStop(.6,'#8fc52f');grass.addColorStop(1,'#b2db48');
 g.fillStyle=grass;g.fillRect(0,0,960,540);
 for(let i=0;i<330;i++){
  const x=noise(i)*960,y=noise(i+999)*540;
  oval(g,x,y,4+noise(i+13)*10,2+noise(i+71)*6,i%3?'#d6ed6b30':'#478e3520');
  if(i%5===0){line(g,{x,y},{x:x-3,y:y-6},'#699e3660',1.3);line(g,{x:x+1,y},{x:x+4,y:y-8},'#bfe45a70',1.3);}
 }
 const pens=s.pens.map(p=>({...p,points:p.rect?[
  {x:p.rect.x/u,y:p.rect.y/u},{x:(p.rect.x+p.rect.w)/u,y:p.rect.y/u},
  {x:(p.rect.x+p.rect.w)/u,y:(p.rect.y+p.rect.h)/u},{x:p.rect.x/u,y:(p.rect.y+p.rect.h)/u}
 ]:p.corners.map(q=>({x:q.x/u,y:q.y/u}))}));
 for(const p of pens){path(g,p.points,'#b4d94955');
  for(let j=0;j<12;j++){
   const slot=p.slots[Math.floor(j*p.slots.length/12)];
   if(slot)oval(g,slot.x/u,slot.y/u,10,6,'#d9e97a29');
  }
 }
 // Cut pen fences against the actual round arena: no colored rail crosses dirt.
 g.save();g.beginPath();g.rect(0,0,960,540);g.arc(c.x,c.y,r-1,0,TAU,true);g.clip('evenodd');
 for(const p of pens)for(let i=0;i<4;i++){
  if(!p.rect&&i===3)continue;
  rail(g,p.points[i],p.points[(i+1)%4],p.color,5);
 }
 g.restore();
 oval(g,c.x+3,c.y+6,r+6,r+6,'#4c6b3050');oval(g,c.x,c.y,r+3,r+3,'#6d6233');
 const dirt=g.createRadialGradient(c.x-r*.25,c.y-r*.4,5,c.x,c.y,r*1.1);
 dirt.addColorStop(0,'#bf8c4f');dirt.addColorStop(.6,'#bb8447');dirt.addColorStop(1,'#a76f39');
 oval(g,c.x,c.y,r,r,dirt);
 g.save();g.beginPath();g.arc(c.x,c.y,r-2,0,TAU);g.clip();
 for(let i=0;i<190;i++){
  const a=i*2.39996,rr=Math.sqrt(noise(i+101))*r,x=c.x+Math.cos(a)*rr,y=c.y+Math.sin(a)*rr;
  if(i<12){oval(g,x,y,13+noise(i)*20,10,'#a2ac3e44');for(let j=0;j<4;j++)line(g,{x:x-7+j*5,y:y+3},{x:x-8+j*5,y:y-5},'#91ae4055',2);}
  else if(i%5===0){path(g,[{x:x-10,y:y-4},{x:x-2,y:y-11},{x:x+11,y:y-6},{x:x+15,y:y+3},{x,y:y+7}],'#d69d5c20');}
  else oval(g,x,y,1+noise(i+10)*2,1,i%3?'#dbaa6b40':'#8b5d3520');
 }
 g.restore();
 for(let i=0;i<120;i++){
  const a=i*TAU/120,b=(i+1)*TAU/120,mid=(a+b)/2;
  if(s.pens.some(p=>Math.abs(Math.atan2(Math.sin(mid-p.angle),Math.cos(mid-p.angle)))<Math.asin(p.gateWidth/2/s.radius)+.025))continue;
  const p={x:c.x+Math.cos(a)*r,y:c.y+Math.sin(a)*r},q={x:c.x+Math.cos(b)*r,y:c.y+Math.sin(b)*r};
  line(g,{x:p.x+2,y:p.y+4},{x:q.x+2,y:q.y+4},'#5d4f2c70',6);
  line(g,p,q,'#75502e',5);line(g,{x:p.x,y:p.y-1},{x:q.x,y:q.y-1},'#d3a75c',1.6);
  if(i%5===0){g.fillStyle='#8a5b31';g.fillRect(p.x-2.5,p.y-5,5,11);g.fillStyle='#e1b66b';g.fillRect(p.x-2.5,p.y-5,5,2);}
 }
 for(const pen of s.pens){
  const half=pen.gateWidth/2/u,depth=Math.sqrt(r*r-half*half);
  for(const side of [-1,1]){
   const x=c.x+pen.normal.x*depth+pen.tangent.x*half*side,y=c.y+pen.normal.y*depth+pen.tangent.y*half*side;
   rail(g,{x,y:y-1},{x:x+.1,y:y+1},pen.color,6);
  }
  for(let k=0;k<6;k++){
   const d=r+5+k*2,x=c.x+pen.normal.x*d+pen.tangent.x*((k%3)-1)*7,y=c.y+pen.normal.y*d+pen.tangent.y*((k%3)-1)*7;
   oval(g,x,y,1.7,1.2,'#ffe4a080');
  }
 }
 const trees=s.pens.length<=4?[[74,151,150],[864,391,158],[86,490,92],[876,42,95]]:[[63,120,123],[896,405,130],[82,479,103],[878,52,98]];
 for(const [x,y,size] of trees)sprite(g,'tree',x,y,size,size);
 // Timber benches, stones and flowering shrubs stay outside the play circle/pens.
 for(const [x,y,a] of [[84,250,-.35],[874,254,.36]]){
  g.save();g.translate(x,y);g.rotate(a);g.fillStyle='#80612f';g.fillRect(-11,-34,22,74);
  for(let j=0;j<3;j++){g.fillStyle=j%2?'#c5923e':'#d3a149';g.fillRect(-10+j*7,-36,6,70);line(g,{x:-9+j*7,y:-33},{x:-9+j*7,y:30},'#f0c466',1);}
  g.restore();
 }
 for(let i=0;i<22;i++){
  const x=i%2?822+noise(i)*22:116+noise(i)*22,y=50+noise(i+400)*440;
  oval(g,x+1,y+2,4,3,'#527b3b');oval(g,x,y,3,2.3,i%3?'#bdc6a1':'#eff1c5');
 }
 g.restore();
}
function farm(g,s){cached(g,s,'farm',s.world.w,s.world.h,paintFarm);}
function chicken(g,c,t,scale=1){
 const held=c.status==='carried',size=held?48:40*scale,angle=Math.atan2(c.dir.y,c.dir.x);
 const image=asset(c.status==='free'&&Math.sin(c.flap)>0?'chicken-flap':'chicken');
 g.save();g.translate(c.x,c.y);g.rotate(angle);
 oval(g,0,2,size*.22,size*.15,held?'#30452e24':'#46542e45');
 if(ready(image))g.drawImage(image,-size/2,-size*3/8,size,size*3/4);
 else{oval(g,0,0,size*.22,size*.16,'#fff7e7');oval(g,size*.14,0,size*.11,size*.11,'#fff');}
 g.restore();
}
function heldChicken(g,bird,p,time){
 const v=p.dir||{x:1,y:0},t={x:-v.y,y:v.x};
 // Two small hands visibly support the bird, with no floating caption or halo.
 for(const side of [-1,1])oval(g,bird.x-v.x*8+t.x*9*side,bird.y-v.y*8+t.y*9*side,4,3,'#f1d7af');
 chicken(g,bird,time,1);
}
function paintSea(g){
 const sea=asset('water');if(ready(sea))g.drawImage(sea,0,0,960,540);else{g.fillStyle='#179ed6';g.fillRect(0,0,960,540);}
 for(const [x,y,w,a] of [[233,113,45,.2],[711,457,36,-.5],[211,414,25,.6],[751,92,39,.4],[462,22,28,-.4],[538,514,37,.8]]){
  sprite(g,'cliff1',x,y,w,w*.7,a);
 }
}
function sea(g,s,t){
 // The sea is independent of the shrinking island, so it stays cached.
 let holder=snowWater.get(s);if(!holder){holder={};snowWater.set(s,holder);}
 cached(g,holder,'water',960,540,paintSea);
 for(let i=0;i<9;i++){
  const x=120+noise(i+40)*720,y=40+noise(i+300)*460;
  if(Math.hypot(x-480,y-270)<253)continue;
  const alpha=.12+.11*Math.sin(t*.7+i*1.4);
  g.save();g.globalAlpha=alpha;line(g,{x:x-5,y},{x:x+5,y},'#e7ffff',1);line(g,{x,y:y-4},{x,y:y+4},'#e7ffff',1);g.restore();
 }
}
const snowWater=new WeakMap();
function island(g,s){
 const image=asset('island'),factor=Math.max(0,s.radius)/220;
 if(ready(image))g.drawImage(image,-256*factor,-250*factor,512*factor,512*factor);
 else oval(g,0,0,s.radius,s.radius,'#e4faf6');
}
function paintBoulder(g,s){
 const b=s.bounds,left=b.x,top=b.y,bottom=b.y+b.h;
 const grass=g.createLinearGradient(0,0,left,540);grass.addColorStop(0,'#69873e');grass.addColorStop(.65,'#91ae45');grass.addColorStop(1,'#446d4b');
 g.fillStyle=grass;g.fillRect(0,0,960,540);
 for(let i=0;i<150;i++){
  const x=noise(i)*left,y=noise(i+110)*540;
  oval(g,x,y,3+noise(i+3)*7,2+noise(i+77)*6,i%3?'#d6e77555':'#3d703b55');
 }
 // Green shoulder, snowy drifts and a shaded cliff face, all outside MIN_X.
 const drift=[];
 for(let i=0;i<=28;i++)drift.push({x:35+noise(i+910)*23,y:i*540/28});
 path(g,[{x:0,y:0},...drift,{x:0,y:540}],'#e6faf0');
 path(g,[{x:left-36,y:0},{x:left-18,y:40},{x:left-23,y:120},{x:left-15,y:199},{x:left-27,y:287},{x:left-12,y:380},{x:left-25,y:464},{x:left-16,y:540},{x:left+5,y:540},{x:left+5,y:0}],'#497b88');
 for(let i=0;i<17;i++){
  const y=i*34;
  path(g,[{x:left-25,y},{x:left-14,y:y+9},{x:left-9,y:y+36},{x:left-27,y:y+30}],'#72b5c1');
  oval(g,left-35,y+4,12,23,'#edfdf1');
 }
 const floor=g.createLinearGradient(left,0,960,0);floor.addColorStop(0,'#e7f9f8');floor.addColorStop(.38,'#d8f5f4');floor.addColorStop(.68,'#9ee8ef');floor.addColorStop(1,'#27d0e5');
 g.fillStyle=floor;g.fillRect(left,top,960-left,b.h);
 // The cyan chute is a flat slope, with long shadows from the upper ice cliffs.
 for(const [i,y] of [70,225,403].entries()){
  const shadow=g.createLinearGradient(706,y,960,y);shadow.addColorStop(0,'#2cabc400');shadow.addColorStop(1,'#208bb745');
  path(g,[{x:970,y:y-44},{x:706+i*7,y:y+83},{x:960,y:y+28}],shadow);
  path(g,[{x:969,y:y-42},{x:739+i*7,y:y+71},{x:960,y:y-11}],'#b4f8f52c');
 }
 for(let i=0;i<12;i++){
  const y=top+23+i*(b.h-45)/12;
  g.beginPath();g.moveTo(left+24,y);g.bezierCurveTo(left+200,y-12,610,y+12,895,y-5);g.strokeStyle='#9fd8e529';g.lineWidth=i%3?1:2;g.stroke();
 }
 for(let i=0;i<115;i++)oval(g,left+16+noise(i+20)*(960-left-25),top+8+noise(i+400)*(b.h-16),.6+noise(i+4)*1.7,.7,i%3?'#ffffff66':'#89c8de26');
 // Continuous shelves are aligned to the actual TOP/BOTTOM collision walls.
 g.fillStyle='#497b8d';g.fillRect(left,0,960-left,top);g.fillRect(left,bottom,960-left,540-bottom);
 for(let i=0;i<10;i++){
  const x=left+20+i*83,w=94+noise(i)*25,h=60+noise(i+9)*23;
  sprite(g,'cliff'+i%3,x,top-h*.45,w,h,(noise(i+50)-.5)*.26);
  sprite(g,'cliff'+(i+1)%3,x+24,bottom+h*.46,w+5,h+3,Math.PI+(noise(i+90)-.5)*.24);
 }
 line(g,{x:left,y:top},{x:left,y:bottom},'#c8f3ee',3);
 g.fillStyle='#bbf4f53b';g.fillRect(b.x+b.w,top,2,b.h);
}
function boulder(g,s){cached(g,s,'boulder',960,540,paintBoulder);}
function rock(g,r,s){
 for(const p of r.trail)oval(g,p.x+4,p.y+6,r.r*.27,r.r*.15,'#6099b023');
 g.save();g.translate(r.x,r.y);oval(g,5,10,r.r*.94,r.r*.77,'#3c64736b');
 if(r.ownerId){g.beginPath();g.arc(0,0,r.r+3,0,TAU);g.strokeStyle=r.color;g.lineWidth=3;g.stroke();}
 g.rotate(r.angle);const image=asset('rock'+r.id%3,r.color),factor=r.r/52;
 if(ready(image))g.drawImage(image,-64*factor,-62*factor,128*factor,128*factor);
 else oval(g,0,0,r.r,r.r,r.color||'#84979c');g.restore();
}
window.FarmIceArt=Object.freeze({preload,viewport,beginScene,farm,chicken,heldChicken,sea,island,boulder,rock,assetSVG,chickenSVG,islandSVG,waterSVG,rockSVG,iceBlockSVG});
})();
