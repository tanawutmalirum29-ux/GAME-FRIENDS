/* DINO PANIC — renderer. Draws the long side-scrolling world on the 960×540 host canvas.
   World units == canvas units (scale 1); only the camera translation is applied, so physics and drawing share one frame.
   Off-screen obstacles are skipped through the track's spatial index; nothing needed by the simulation is ever deleted here. */
import {C,TAU,STEP,clamp,lerp} from './config.js';
import {svgImage,bodySVG,headSVG,footSVG,dirtSVG,forestSVG,crateSVG,rockSVG} from './dino-art.js';
import {dinoEdge} from './map.js';

const VW=960,VH=540,TILE=512;
const A={
 body:()=>svgImage('body',bodySVG),head:()=>svgImage('head',headSVG),foot:()=>svgImage('foot',footSVG),
 dirt:h=>svgImage('dirt'+h,()=>dirtSVG(h)),forest:(h,k)=>svgImage('forest'+h+'_'+k,()=>forestSVG(h,k)),
 crate:v=>svgImage('crate'+v,()=>crateSVG(v)),rock:v=>svgImage('rock'+v,()=>rockSVG(v))
};
const LOG=new Map(),QR=[],RB=[];   // baked log/fence sprites, scratch lists
export function preloadArt(track){
 LOG.clear();
 A.body();A.head();A.foot();for(let v=0;v<3;v++){A.crate(v);A.rock(v);}A.crate(3);
 if(track){A.dirt(track.H);A.forest(track.top,11);A.forest(VH-track.bottom,23);}
}

/* ───────── ground ───────── */
function drawGround(g,s,cam){
 const tr=s.track,x0=Math.floor(cam/TILE)*TILE,x1=cam+VW,TW=TILE+1; // +1px overlap hides hairline seams at fractional camera positions
 const ft=A.forest(tr.top,11),fb=A.forest(VH-tr.bottom,23),dirt=A.dirt(tr.H);
 for(let x=x0;x<x1;x+=TILE){
  if(ft)g.drawImage(ft,x,0,TW,ft.lh||ft.height);else{g.fillStyle='#3d7a2b';g.fillRect(x,0,TILE,tr.top);}
  if(fb){g.save();g.translate(x,VH);g.scale(1,-1);g.drawImage(fb,0,0,TW,fb.lh||fb.height);g.restore();}
  else{g.fillStyle='#3d7a2b';g.fillRect(x,tr.bottom,TILE,VH-tr.bottom);}
  if(dirt)g.drawImage(dirt,x,tr.top,TW,tr.H);else{g.fillStyle='#d6a169';g.fillRect(x,tr.top,TILE,tr.H);}
 }
 // the corridor ends in dense jungle behind the finish area
 if(x1>tr.endX){g.save();g.beginPath();g.rect(tr.endX,tr.top-2,VW,tr.H+4);g.clip();
  g.fillStyle='#2f6a24';g.fillRect(tr.endX,tr.top,VW,tr.H);
  if(ft){const fh=ft.lh||ft.height;for(let y=tr.top-fh*.2;y<tr.bottom;y+=fh*.8)for(let x=Math.floor(tr.endX/TILE)*TILE;x<x1;x+=TILE)g.drawImage(ft,x,y,TW,fh);}
  g.restore();}
}
function drawFinish(g,s,cam){
 const tr=s.track,fx=tr.finishX;if(fx>cam+VW+40||tr.endX<cam-40)return;
 g.fillStyle='rgba(255,243,200,.10)';g.fillRect(fx,tr.top,tr.endX-fx,tr.H);
 const sq=11;g.save();g.beginPath();g.rect(fx-2,tr.top,sq*2,tr.H);g.clip();
 for(let y=tr.top,r=0;y<tr.bottom;y+=sq,r++)for(let c=0;c<2;c++){g.fillStyle=(r+c)%2?'#fff':'#1a1a1a';g.fillRect(fx-2+c*sq,y,sq,sq);}
 g.restore();
 for(const y of[tr.top,tr.bottom]){ // posts and flags on the forest edge
  g.fillStyle='#5a3a1c';g.fillRect(fx-4,y-5,8,10);g.fillStyle='#3d2610';g.fillRect(fx-4,y+(y===tr.top?-5:3),8,2);
  for(let i=0;i<3;i++){const fy=y+(y===tr.top?-14:14)+(i-1)*0;g.fillStyle=['#ff4d4d','#ffd23a','#4da6ff'][i];
   g.beginPath();g.moveTo(fx+10+i*26,fy-5);g.lineTo(fx+30+i*26,fy);g.lineTo(fx+10+i*26,fy+5);g.fill();}}
 g.save();g.globalAlpha=.4;g.fillStyle='#fff';g.font='bold 38px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';
 g.translate(fx+120,tr.cy);g.fillText('FINISH',0,0);g.restore();
}

/* ───────── obstacles ───────── */
function drawLog(g,o,fence){
 const vert=o.hh>o.hw||(o.kind==='fence'&&o.hh>o.hw),L=vert?o.hh:o.hw,T=vert?o.hw:o.hh;
 g.save();g.translate(o.x,o.y);if(vert)g.rotate(Math.PI/2);
 if(fence){
  g.fillStyle='#b98a52';g.strokeStyle='#5d3d1d';g.lineWidth=2;
  for(const ry of[-T*.45,T*.45]){g.beginPath();g.rect(-L,ry-2.6,2*L,5.2);g.fill();g.stroke();}
  g.fillStyle='#7a5128';const n=Math.max(2,Math.round(L/20));
  for(let i=0;i<=n;i++){const px=-L+(2*L)*i/n;g.beginPath();g.rect(px-5,-T-1,10,2*T+2);g.fill();g.stroke();
   g.fillStyle='#9a6a38';g.fillRect(px-3,-T+1,6,3);g.fillStyle='#7a5128';}
 }else{
  const gr=g.createLinearGradient(0,-T,0,T);gr.addColorStop(0,'#6b4222');gr.addColorStop(.35,'#b27a43');gr.addColorStop(.6,'#9a6636');gr.addColorStop(1,'#5a3519');
  g.fillStyle=gr;g.strokeStyle='#3f2511';g.lineWidth=2.4;
  const r=T*.9;g.beginPath();g.moveTo(-L+r,-T);g.lineTo(L-r,-T);g.quadraticCurveTo(L,-T,L,0);g.quadraticCurveTo(L,T,L-r,T);g.lineTo(-L+r,T);g.quadraticCurveTo(-L,T,-L,0);g.quadraticCurveTo(-L,-T,-L+r,-T);g.fill();g.stroke();
  g.strokeStyle='rgba(50,28,10,.45)';g.lineWidth=1.4;
  for(let x=-L+14;x<L-8;x+=13+((x*7)%5)){g.beginPath();g.moveTo(x,-T*.7);g.lineTo(x+4,-T*.2);g.moveTo(x+6,T*.2);g.lineTo(x+2,T*.7);g.stroke();}
  for(const sx of[-1,1]){g.fillStyle='#d9b27a';g.strokeStyle='#6b4222';g.lineWidth=1.6;g.beginPath();g.ellipse(sx*(L-T*.55),0,T*.5,T*.8,0,0,TAU);g.fill();g.stroke();
   g.beginPath();g.ellipse(sx*(L-T*.55),0,T*.22,T*.38,0,0,TAU);g.stroke();}
 }
 g.restore();
}
/* log / fence sprites are painted once (same detail, 2x raster) and then blitted */
function drawLogAt(g,o,x,y){
 const key=o.kind+'|'+o.hw+'|'+o.hh;let sp=LOG.get(key);
 if(sp===undefined){
  sp=null;
  if(typeof document!=='undefined'){
   try{const w=Math.ceil(o.hw*2+24),h=Math.ceil(o.hh*2+24),c=document.createElement('canvas');c.width=w*2;c.height=h*2;
    const k=c.getContext('2d');k.scale(2,2);k.translate(w/2,h/2);
    drawLog(k,{x:0,y:0,hw:o.hw,hh:o.hh,kind:o.kind},o.kind==='fence');c.lw=w;c.lh=h;sp=c;}catch(err){sp=null;}
  }
  LOG.set(key,sp);
 }
 if(sp)g.drawImage(sp,x-sp.lw/2,y-sp.lh/2,sp.lw,sp.lh);
 else drawLog(g,{kind:o.kind,hw:o.hw,hh:o.hh,x,y},o.kind==='fence');
}
let IX=0,IY=0;
function ipos(o,s,a){ // shoved obstacles move inside a tick; blend like the runners so they don't jitter against them
 if(a<1&&o.mt===s.tick){IX=o.ox+(o.x-o.ox)*a;IY=o.oy+(o.y-o.oy)*a;}else{IX=o.x;IY=o.y;}
}
function drawObstacles(g,s,cam,a){
 const tr=s.track,list=tr.query(cam-120,cam+VW+120,QR);
 g.fillStyle='rgba(30,16,4,.28)';
 for(const o of list){ipos(o,s,a);g.beginPath();
  if(o.shape==='circle')g.ellipse(IX+4,IY+6,o.r*1.05,o.r*.95,0,0,TAU);
  else g.rect(IX-o.hw+4,IY-o.hh+6,o.hw*2,o.hh*2);g.fill();}
 for(const o of list){ipos(o,s,a);
  if(o.kind==='crate'){const im=A.crate(o.v),sz=C.crate*2+6;
   if(im)g.drawImage(im,IX-sz/2,IY-sz/2,sz,sz);else{g.fillStyle='#b97a3c';g.fillRect(IX-o.hw,IY-o.hh,o.hw*2,o.hh*2);g.strokeStyle='#3d6bb0';g.lineWidth=4;g.strokeRect(IX-o.hw,IY-o.hh,o.hw*2,o.hh*2);}
  }else if(o.kind==='rock'){const im=A.rock(o.v),sz=o.r*2.5;
   if(im)g.drawImage(im,IX-sz/2,IY-sz/2,sz,sz);else{g.fillStyle='#8a8077';g.beginPath();g.arc(IX,IY,o.r,0,TAU);g.fill();}
  }else drawLogAt(g,o,IX,IY);
 }
}

/* ───────── effects ───────── */
function drawFx(g,s,pass,a){
 for(const e of s.fx){
  const k=e.life/e.max,ex=e.x-e.vx*STEP*(1-a),ey=e.y-e.vy*STEP*(1-a);
  if(pass===0){
   if(e.t==='dust'){g.globalAlpha=clamp(k*.5,0,.5);g.fillStyle=e.color;g.beginPath();g.arc(ex,ey,e.size*(1+(1-k)*1.3),0,TAU);g.fill();}
   else if(e.t==='squash'){const u=1-k;g.save();g.translate(ex,ey);g.globalAlpha=clamp(k*1.2,0,1);
    g.fillStyle=e.color;g.beginPath();g.ellipse(0,2,18+u*14,9+u*6,0,0,TAU);g.fill();
    g.fillStyle='rgba(60,30,10,.55)';g.beginPath();g.ellipse(0,3,12+u*10,5+u*4,0,0,TAU);g.fill();
    g.strokeStyle='#fff';g.lineWidth=2.2;g.globalAlpha=clamp(k,0,1);
    for(let i=0;i<5;i++){const a=i*1.26+.3,r0=20+u*10,r1=r0+8;g.beginPath();g.moveTo(Math.cos(a)*r0,Math.sin(a)*r0*.6);g.lineTo(Math.cos(a)*r1,Math.sin(a)*r1*.6);g.stroke();}
    g.restore();}
  }else if(e.t==='debris'||e.t==='pebble'||e.t==='confetti'){
   g.save();g.globalAlpha=clamp(k*1.4,0,1);g.translate(ex,ey);g.rotate(e.rot);g.fillStyle=e.color;
   if(e.t==='confetti')g.fillRect(-e.size,-e.size*.5,e.size*2,e.size);else g.fillRect(-e.size*.6,-e.size*.4,e.size*1.2,e.size*.8);
   g.restore();}
 }
 g.globalAlpha=1;
}

/* ───────── runners ───────── */
function drawRunners(g,s,time,a){
 const pc=typeof window!=='undefined'?window.PartyCharacters:undefined;
 RB.length=0;for(const p of s.roster)if(p.dino.state!=='dead')RB.push(p);
 RB.sort((p,q)=>p.y-q.y);
 const ct=s.clock?s.clock-STEP*(1-a):time;
 for(const p of RB){
  const d=p.dino,done=d.state==='done',rx=p.x,ry=p.y;
  if(a<1&&Number.isFinite(d.px)){p.x=d.px+(rx-d.px)*a;p.y=d.py+(ry-d.py)*a;}   // draw between the previous and current tick
  try{
   g.fillStyle='rgba(30,16,4,.3)';g.beginPath();g.ellipse(p.x+2,p.y+14,15,6,0,0,TAU);g.fill();
   g.save();if(done){g.globalAlpha=.9;g.translate(0,-Math.abs(Math.sin(time*7+p.id))*3);}
   if(pc?.draw)pc.draw(g,p,{time:ct,label:false});
   else{g.fillStyle=p.color||'#f5c87a';g.beginPath();g.arc(p.x,p.y,C.R,0,TAU);g.fill();}
   g.restore();
  }finally{p.x=rx;p.y=ry;}
 }
}

/* ───────── the dinosaur ───────── */
function drawDino(g,s,time,front,a){
 const tr=s.track,k=(tr.H+70)/380,t=s.clock>0?s.clock-STEP*(1-a):time*.6,ph=t*TAU/.64;
 const bodyI=A.body(),headI=A.head(),footI=A.foot();
 g.save();g.translate(front,tr.cy);g.scale(k,k);
 // No full-scene shadow plates: the dinosaur SVG carries its own local shading.
 // World-space shadows stay attached to individual obstacles and runners.
 // feet: diagonal pairs, planted foot gets bigger (stomp)
 const feet=[[-310,-176,0],[-310,176,Math.PI],[-520,-176,Math.PI],[-520,176,0]];
 for(const[fx0,fy,off]of feet){
  const a=ph+off,dx=Math.sin(a)*34,lift=Math.max(0,Math.cos(a)),sc=1+.22*lift;
  g.save();g.translate(fx0+dx,fy);g.scale(sc,sc*(fy<0?-1:1));g.rotate(-Math.PI*.02);
  if(footI)g.drawImage(footI,-40,-45,90,100);else{g.fillStyle='#3f5c66';g.beginPath();g.ellipse(0,0,34,38,0,0,TAU);g.fill();}
  g.restore();}
 // body + head with tiny bob/sway (no camera shake)
 const bob=Math.sin(ph*2)*3;
 g.save();g.translate(0,bob);g.rotate(Math.sin(ph)*.008);
 if(bodyI)g.drawImage(bodyI,-690,-190,600,380);else{g.fillStyle='#3f86cc';g.fillRect(-690,-190,600,380);}
 g.restore();
 g.save();g.translate(0,Math.sin(ph*2+1.2)*2.5);
 if(headI)g.drawImage(headI,-230,-105,230,210);else{g.fillStyle='#b863b9';g.beginPath();g.ellipse(-115,0,115,100,0,0,TAU);g.fill();}
 g.restore();
 g.restore();
}

export function drawWorld(g,time,s,a=1){
 const tr=s.track;
 // camera and dinosaur are blended between the previous and current simulation tick
 const cam=(a<1&&s.prevCam!==undefined)?lerp(s.prevCam,s.camX,a):s.camX,
  front=(a<1&&s.prevFront!==undefined)?lerp(s.prevFront,s.front,a):s.front;
 g.save();
 g.fillStyle='#2f6a24';g.fillRect(0,0,VW,VH);
 g.translate(-cam,0);
 drawGround(g,s,cam);
 drawFinish(g,s,cam);
 drawObstacles(g,s,cam,a);
 drawFx(g,s,0,a);
 drawRunners(g,s,time,a);
 drawFx(g,s,1,a);
 drawDino(g,s,time,front,a);
 g.restore();
}
