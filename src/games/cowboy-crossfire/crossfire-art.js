/* COWBOY CROSSFIRE — art helpers (canvas, world units). Pure drawing; no game rules here. */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function lcg(seed){let x=(seed>>>0)||1;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}

/* ---------------- obstacle catalogue (radius in world units, HP 1–3) ---------------- */
export const KINDS=Object.freeze({
 crate:{ro:13,hp:3,weight:3},
 barrel:{ro:10.5,hp:2,weight:3},
 fence:{ro:12,hp:1,weight:2},
 cactus:{ro:9,hp:1,weight:1.5}
});

/* ---------------- static backdrop: Wild West gold-rush town, top-down ---------------- */
function plankRoof(g,x,y,w,h,base,rnd){
 g.save();
 g.fillStyle='rgba(40,20,8,.32)';g.fillRect(x+7,y+9,w,h); // cast shadow
 g.fillStyle=base;g.fillRect(x,y,w,h);
 const horiz=w>=h,step=9;
 g.lineWidth=1;
 for(let i=step;i<(horiz?h:w);i+=step){
  g.strokeStyle='rgba(30,14,6,.45)';g.beginPath();
  if(horiz){g.moveTo(x,y+i);g.lineTo(x+w,y+i);}else{g.moveTo(x+i,y);g.lineTo(x+i,y+h);}
  g.stroke();
  g.strokeStyle='rgba(255,226,170,.12)';g.beginPath();
  if(horiz){g.moveTo(x,y+i+1);g.lineTo(x+w,y+i+1);}else{g.moveTo(x+i+1,y);g.lineTo(x+i+1,y+h);}
  g.stroke();
 }
 for(let i=0;i<w*h/380;i++){ // weathered grain
  g.fillStyle=rnd()<.5?'rgba(255,220,160,.07)':'rgba(30,12,4,.10)';
  g.fillRect(x+rnd()*w,y+rnd()*h,2+rnd()*8,1);
 }
 g.strokeStyle='rgba(28,12,4,.85)';g.lineWidth=3;g.strokeRect(x+1.5,y+1.5,w-3,h-3);
 g.strokeStyle='rgba(20,8,2,.9)';g.lineWidth=4; // roof ridge
 g.beginPath();if(horiz){g.moveTo(x,y+h/2);g.lineTo(x+w,y+h/2);}else{g.moveTo(x+w/2,y);g.lineTo(x+w/2,y+h);}g.stroke();
 g.restore();
}
function house(g,x,y,w,h,pal,rnd,side){
 plankRoof(g,x,y,w,h,pal,rnd);
 // porch with posts on the side that faces the plaza
 g.save();
 g.fillStyle='#a9763f';
 const pw=Math.min(18,h*.16);
 if(side==='r')g.fillRect(x+w,y+h*.2,pw,h*.6);
 else if(side==='l')g.fillRect(x-pw,y+h*.2,pw,h*.6);
 else if(side==='b')g.fillRect(x+w*.2,y+h,w*.6,pw);
 else g.fillRect(x+w*.2,y-pw,w*.6,pw);
 g.fillStyle='#4a2a14';
 for(let i=0;i<4;i++){
  const t=.2+.6*i/3;
  const px=side==='r'?x+w+pw-3:side==='l'?x-pw+1:x+w*t,py=side==='b'?y+h+pw-3:side==='t'?y-pw+1:y+h*t;
  g.beginPath();g.arc(px,py,2.6,0,TAU);g.fill();
 }
 // chimney + sign board
 g.fillStyle='#5b5148';g.fillRect(x+w*.7,y+h*.18,14,14);
 g.fillStyle='#2b2520';g.fillRect(x+w*.7+3,y+h*.18+3,8,8);
 g.fillStyle='#d9b36a';g.fillRect(x+w*.12,y+h*.62,w*.34,h*.12);
 g.strokeStyle='#3a2210';g.lineWidth=1.5;g.strokeRect(x+w*.12,y+h*.62,w*.34,h*.12);
 g.restore();
}
function cactusDecor(g,x,y,s,rnd){
 g.save();g.translate(x,y);g.scale(s,s);
 g.fillStyle='rgba(40,20,8,.3)';g.beginPath();g.ellipse(4,6,13,8,0,0,TAU);g.fill();
 g.fillStyle='#4f8a3c';g.strokeStyle='#2f5a26';g.lineWidth=2;
 g.beginPath();g.arc(0,0,8,0,TAU);g.fill();g.stroke();
 for(let a=0;a<2;a++){
  const ang=rnd()*TAU;g.save();g.rotate(ang);
  g.fillStyle='#5b9a45';g.beginPath();g.arc(10,0,4.6,0,TAU);g.fill();g.stroke();g.restore();
 }
 g.strokeStyle='rgba(240,255,210,.5)';g.lineWidth=1;
 for(let i=0;i<8;i++){const a=i*TAU/8;g.beginPath();g.moveTo(Math.cos(a)*3,Math.sin(a)*3);g.lineTo(Math.cos(a)*8,Math.sin(a)*8);g.stroke();}
 g.fillStyle='#f4a9c4';g.beginPath();g.arc(0,0,2,0,TAU);g.fill();
 g.restore();
}
function goldPile(g,x,y,s,rnd){
 g.save();g.translate(x,y);g.scale(s,s);
 g.fillStyle='rgba(40,20,8,.3)';g.beginPath();g.ellipse(2,5,12,6,0,0,TAU);g.fill();
 for(let i=0;i<9;i++){
  const a=rnd()*TAU,d=rnd()*8;
  g.fillStyle=rnd()<.5?'#f6c93a':'#e0a81c';g.strokeStyle='#8a5a08';g.lineWidth=1;
  g.beginPath();g.ellipse(Math.cos(a)*d,Math.sin(a)*d*.7,3.6,2.8,rnd()*3,0,TAU);g.fill();g.stroke();
 }
 g.fillStyle='#fff4b0';g.fillRect(-1,-1,3,1);g.fillRect(4,2,2,1);
 g.restore();
}
function wheel(g,x,y,s){
 g.save();g.translate(x,y);g.scale(s,s);
 g.strokeStyle='#5a3418';g.lineWidth=3;g.beginPath();g.arc(0,0,11,0,TAU);g.stroke();
 g.lineWidth=2;for(let i=0;i<6;i++){const a=i*TAU/6;g.beginPath();g.moveTo(0,0);g.lineTo(Math.cos(a)*11,Math.sin(a)*11);g.stroke();}
 g.fillStyle='#3b2410';g.beginPath();g.arc(0,0,3,0,TAU);g.fill();g.restore();
}
function fenceLine(g,x,y,len,ang){
 g.save();g.translate(x,y);g.rotate(ang);
 g.fillStyle='rgba(40,20,8,.28)';g.fillRect(3,5,len,7);
 g.fillStyle='#a6733d';g.strokeStyle='#4a2a14';g.lineWidth=1.2;
 g.fillRect(0,-3,len,6);g.strokeRect(0,-3,len,6);
 for(let px=0;px<=len;px+=Math.max(14,len/4)){g.fillStyle='#6a4020';g.fillRect(px-2.5,-5,5,10);g.strokeRect(px-2.5,-5,5,10);}
 g.restore();
}
export function drawBarrel(g,x,y,r){
 g.save();g.translate(x,y);
 g.fillStyle='rgba(40,20,8,.3)';g.beginPath();g.ellipse(3,4,r+1,r*.9,0,0,TAU);g.fill();
 const gr=g.createRadialGradient(-r*.3,-r*.3,1,0,0,r);gr.addColorStop(0,'#c58a4c');gr.addColorStop(1,'#8a5528');
 g.fillStyle=gr;g.strokeStyle='#3d2210';g.lineWidth=1.6;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();g.stroke();
 g.strokeStyle='#4b4540';g.lineWidth=1.6;g.beginPath();g.arc(0,0,r*.66,0,TAU);g.stroke();
 g.strokeStyle='rgba(60,30,12,.55)';g.lineWidth=1;
 for(let i=0;i<5;i++){const a=i*TAU/5+.3;g.beginPath();g.moveTo(Math.cos(a)*r*.2,Math.sin(a)*r*.2);g.lineTo(Math.cos(a)*r*.95,Math.sin(a)*r*.95);g.stroke();}
 g.restore();
}
export function drawCrate(g,x,y,r,ang=0){
 g.save();g.translate(x,y);g.rotate(ang);
 const s=r*1.5;
 g.fillStyle='rgba(40,20,8,.3)';g.fillRect(-s/2+3,-s/2+4,s,s);
 g.fillStyle='#b9814a';g.strokeStyle='#4a2812';g.lineWidth=1.8;g.fillRect(-s/2,-s/2,s,s);g.strokeRect(-s/2,-s/2,s,s);
 g.fillStyle='#8f5e32';g.fillRect(-s/2+3,-s/2+3,s-6,s-6);
 g.strokeStyle='#d7a56c';g.lineWidth=2;g.beginPath();g.moveTo(-s/2+3,-s/2+3);g.lineTo(s/2-3,s/2-3);g.moveTo(s/2-3,-s/2+3);g.lineTo(-s/2+3,s/2-3);g.stroke();
 g.restore();
}
export function buildBackdrop(world,cx,cy,R0,seed=7){
 const SS=1.4,w=world.w,h=world.h,rnd=lcg(seed*2654435761);
 if(typeof document==='undefined')return null;
 const cv=document.createElement('canvas');cv.width=Math.ceil(w*SS);cv.height=Math.ceil(h*SS);
 const g=cv.getContext('2d');if(!g)return null;
 g.scale(SS,SS);
 // desert ground
 const gr=g.createLinearGradient(0,0,w,h);gr.addColorStop(0,'#e0974f');gr.addColorStop(.5,'#d88a43');gr.addColorStop(1,'#c97a38');
 g.fillStyle=gr;g.fillRect(0,0,w,h);
 for(let i=0;i<Math.round(w*h/260);i++){
  g.fillStyle=rnd()<.5?'rgba(255,214,150,.10)':'rgba(120,60,20,.10)';
  g.beginPath();g.ellipse(rnd()*w,rnd()*h,3+rnd()*16,1.5+rnd()*6,rnd()*3,0,TAU);g.fill();
 }
 for(let i=0;i<Math.round(w*h/1900);i++){ // pebbles
  const px=rnd()*w,py=rnd()*h;g.fillStyle='rgba(95,52,24,.5)';g.beginPath();g.ellipse(px,py,2+rnd()*2.4,1.4+rnd()*1.5,rnd()*3,0,TAU);g.fill();
  g.fillStyle='rgba(255,226,180,.35)';g.fillRect(px-1,py-2,2,1);
 }
 // wagon ruts + dust roads out of the plaza
 g.strokeStyle='rgba(130,70,30,.35)';g.lineWidth=5;g.lineCap='round';
 for(const a of [.35,Math.PI*.95,Math.PI*1.45,Math.PI*1.9]){
  g.beginPath();g.moveTo(cx+Math.cos(a)*(R0+20),cy+Math.sin(a)*(R0+20));
  g.quadraticCurveTo(cx+Math.cos(a+.2)*(R0+130),cy+Math.sin(a+.2)*(R0+130),cx+Math.cos(a)*(R0+420),cy+Math.sin(a)*(R0+420));g.stroke();
 }
 // footprints
 g.fillStyle='rgba(110,56,22,.42)';
 for(let k=0;k<Math.round(w/16);k++){
  let a=rnd()*TAU,d=R0+30+rnd()*120;
  let px=cx+Math.cos(a)*d,py=cy+Math.sin(a)*d,dir=rnd()*TAU;
  for(let i=0;i<6;i++){
   const side=i%2?1:-1;
   g.beginPath();g.ellipse(px+Math.cos(dir+1.57)*side*3,py+Math.sin(dir+1.57)*side*3,2.4,1.5,dir,0,TAU);g.fill();
   px+=Math.cos(dir)*7;py+=Math.sin(dir)*7;
  }
 }
 // buildings (corners + mid-sides), kept clear of the plaza skirt
 const k=w/960,skirt=R0+36,pal=['#7e4b28','#8d5a31','#6c4027','#85502a','#74442a','#93603a'];
 const hs=[];
 const hw=Math.min(cx-skirt+110*k,210*k),hh=Math.min(130*k,cy-18);
 const add=(x,y,ww,hh2,side)=>{
  const nx=clamp(cx,x,x+ww),ny=clamp(cy,y,y+hh2);
  if(Math.hypot(nx-cx,ny-cy)<skirt+16)return; // never intrude on the duel plaza
  hs.push({x,y,w:ww,h:hh2,side});
 };
 add(6,6,hw,hh,'r');add(w-6-hw,6,hw,hh,'l');add(6,h-6-hh,hw,hh,'r');add(w-6-hw,h-6-hh,hw,hh,'l');
 const mw=Math.max(60,cx-skirt-14),mh=108*k;
 add(6,cy-mh/2,mw,mh,'r');add(w-6-mw,cy-mh/2,mw,mh,'l');
 hs.forEach((b,i)=>house(g,b.x,b.y,b.w,b.h,pal[i%pal.length],rnd,b.side));
 const inHouse=(x,y,m)=>hs.some(b=>x>b.x-m&&x<b.x+b.w+m&&y>b.y-m&&y<b.y+b.h+m);
 // town dressing
 const place=(fn,n,minD)=>{for(let i=0,t=0;i<n&&t<n*30;t++){
  const x=14+rnd()*(w-28),y=14+rnd()*(h-28);
  if(Math.hypot(x-cx,y-cy)<R0+minD||inHouse(x,y,16))continue;fn(x,y);i++;}};
 const dens=w*h/518400;
 place((x,y)=>fenceLine(g,x,y,34+rnd()*30,(rnd()<.5?0:Math.PI/2)+(rnd()-.5)*.2),Math.round(7*dens),48);
 place((x,y)=>drawBarrel(g,x,y,10),Math.round(8*dens),42);
 place((x,y)=>drawCrate(g,x,y,12,(rnd()-.5)*.5),Math.round(8*dens),42);
 place((x,y)=>cactusDecor(g,x,y,1+rnd()*.5,rnd),Math.round(7*dens),44);
 place((x,y)=>goldPile(g,x,y,1+rnd()*.3,rnd),Math.round(5*dens),44);
 place((x,y)=>wheel(g,x,y,1),Math.round(2*dens),44);
 // faint chalk scar marking the starting duel ring
 g.strokeStyle='rgba(255,236,200,.22)';g.lineWidth=2;g.setLineDash([3,7]);
 g.beginPath();g.arc(cx,cy,R0+16,0,TAU);g.stroke();g.setLineDash([]);
 return cv;
}

/* ---------------- dynamic plaza & track (radius animates when the ring shrinks) ---------------- */
export function drawPlaza(g,cx,cy,R,R0,clock,shrinking){
 g.save();
 // dust skirt
 const sk=g.createRadialGradient(cx,cy,R*.9,cx,cy,R+34);
 sk.addColorStop(0,'rgba(120,62,24,0)');sk.addColorStop(.6,'rgba(120,62,24,.30)');sk.addColorStop(1,'rgba(120,62,24,0)');
 g.fillStyle=sk;g.beginPath();g.arc(cx,cy,R+34,0,TAU);g.fill();
 // packed dirt arena
 const pl=g.createRadialGradient(cx,cy,R*.1,cx,cy,R+6);
 pl.addColorStop(0,'#efc88a');pl.addColorStop(.7,'#e5b574');pl.addColorStop(1,'#d79f5d');
 g.fillStyle=pl;g.beginPath();g.arc(cx,cy,R+6,0,TAU);g.fill();
 g.strokeStyle='rgba(110,58,22,.35)';g.lineWidth=1.2;
 for(let i=1;i<=3;i++){g.beginPath();g.arc(cx,cy,R*i/4,0,TAU);g.stroke();} // wagon-wheel ripple marks
 // star-shaped duel mark at the centre
 g.fillStyle='rgba(120,60,24,.28)';g.beginPath();
 for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?5:12;g.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);}
 g.closePath();g.fill();
 // runner track
 g.lineWidth=8;g.strokeStyle='rgba(120,64,26,.55)';g.beginPath();g.arc(cx,cy,R,0,TAU);g.stroke();
 g.lineWidth=2;g.setLineDash([9,7]);g.lineDashOffset=-clock*14;g.strokeStyle='rgba(255,236,190,.75)';
 g.beginPath();g.arc(cx,cy,R,0,TAU);g.stroke();g.setLineDash([]);
 // little wooden stakes around the edge
 const n=Math.max(18,Math.round(R/9));
 for(let i=0;i<n;i++){
  const a=i*TAU/n,x=cx+Math.cos(a)*(R+14),y=cy+Math.sin(a)*(R+14);
  g.fillStyle='rgba(40,20,8,.3)';g.beginPath();g.arc(x+2,y+2,2.8,0,TAU);g.fill();
  g.fillStyle='#8a5a2e';g.strokeStyle='#3e2412';g.lineWidth=1;g.beginPath();g.arc(x,y,2.6,0,TAU);g.fill();g.stroke();
 }
 if(shrinking){g.strokeStyle='rgba(255,90,60,.35)';g.lineWidth=3;g.beginPath();g.arc(cx,cy,R+14,0,TAU);g.stroke();}
 g.restore();
}

/* ---------------- obstacles ---------------- */
export function drawObstacle(g,o,clock){
 const frac=o.hp/o.maxHp,r=o.ro;
 g.save();
 if(o.hitFlash>0)g.globalAlpha=1;
 if(o.kind==='crate')drawCrate(g,o.x,o.y,r,o.ang);
 else if(o.kind==='barrel')drawBarrel(g,o.x,o.y,r);
 else if(o.kind==='fence'){
  g.translate(o.x,o.y);g.rotate(o.ang);
  g.fillStyle='rgba(40,20,8,.3)';g.fillRect(-r+3,-3+4,r*2,8);
  g.fillStyle='#b27a40';g.strokeStyle='#40240f';g.lineWidth=1.4;
  g.fillRect(-r,-4,r*2,8);g.strokeRect(-r,-4,r*2,8);
  g.fillStyle='#7a4a22';
  for(const px of [-r,0,r]){g.fillRect(px-2.5,-7,5,14);g.strokeRect(px-2.5,-7,5,14);}
 }else{
  g.translate(o.x,o.y);
  g.fillStyle='rgba(40,20,8,.3)';g.beginPath();g.ellipse(3,5,r+2,r*.8,0,0,TAU);g.fill();
  g.fillStyle='#4f8a3c';g.strokeStyle='#2c5624';g.lineWidth=1.8;
  g.beginPath();g.arc(0,0,r*.8,0,TAU);g.fill();g.stroke();
  g.fillStyle='#5f9f48';
  for(const a of [.6,2.5,4.4]){g.beginPath();g.arc(Math.cos(a)*r*.9,Math.sin(a)*r*.9,r*.38,0,TAU);g.fill();g.stroke();}
  g.fillStyle='#f4a9c4';g.beginPath();g.arc(0,0,2,0,TAU);g.fill();
 }
 g.restore();
 if(frac<1){ // cracks grow as HP drops
  g.save();g.translate(o.x,o.y);g.strokeStyle='rgba(30,12,4,.8)';g.lineWidth=1.3;
  const n=frac<=.34?5:3;
  for(let i=0;i<n;i++){const a=o.crack+i*TAU/n;g.beginPath();g.moveTo(Math.cos(a)*2,Math.sin(a)*2);
   g.lineTo(Math.cos(a+.25)*r*.55,Math.sin(a+.25)*r*.55);g.lineTo(Math.cos(a-.1)*r*.95,Math.sin(a-.1)*r*.95);g.stroke();}
  g.restore();
 }
 if(o.hitFlash>0){g.save();g.globalAlpha=Math.min(.7,o.hitFlash*4);g.fillStyle='#fff';g.beginPath();g.arc(o.x,o.y,r*.9,0,TAU);g.fill();g.restore();}
}

/* ---------------- revolver equipment; headwear is owned by the shared avatar ---------------- */
export function drawRevolver(g,x,y,ang,recoil){
 g.save();g.translate(x,y);g.rotate(ang);g.translate(-recoil*5,0);
 g.fillStyle='#5a3418';g.strokeStyle='#1d1008';g.lineWidth=1.2;
 g.beginPath();g.moveTo(-3,0);g.lineTo(-8,5.5);g.lineTo(-3.5,6.5);g.lineTo(0,2);g.closePath();g.fill();g.stroke(); // grip
 g.fillStyle='#8d949c';g.fillRect(0,-2.2,17,4.4);g.strokeRect(0,-2.2,17,4.4); // barrel
 g.fillStyle='#b9c0c8';g.beginPath();g.arc(2,0,4,0,TAU);g.fill();g.stroke(); // cylinder
 g.fillStyle='#30363c';for(let i=0;i<4;i++){const a=i*TAU/4+.4;g.beginPath();g.arc(2+Math.cos(a)*2,Math.sin(a)*2,.8,0,TAU);g.fill();}
 g.fillStyle='#e9eef2';g.fillRect(16,-1.2,2,2);
 g.restore();
}
export function drawHeart(g,x,y,s,full){
 g.save();g.translate(x,y);g.scale(s,s);
 g.fillStyle=full?'#ff4c5b':'rgba(60,20,20,.35)';g.strokeStyle='rgba(60,10,10,.85)';g.lineWidth=.9;
 g.beginPath();g.moveTo(0,3);g.bezierCurveTo(-5,-.5,-3.5,-4.5,0,-2);g.bezierCurveTo(3.5,-4.5,5,-.5,0,3);g.fill();g.stroke();
 g.restore();
}

/* ---------------- projectiles & particles ---------------- */
export function drawBullet(g,b){
 const m=Math.hypot(b.vx,b.vy)||1,ux=b.vx/m,uy=b.vy/m;
 g.save();
 const tr=g.createLinearGradient(b.x,b.y,b.x-ux*26,b.y-uy*26);
 tr.addColorStop(0,'rgba(255,240,170,.9)');tr.addColorStop(1,'rgba(255,200,80,0)');
 g.strokeStyle=tr;g.lineWidth=3.4;g.lineCap='round';g.beginPath();g.moveTo(b.x,b.y);g.lineTo(b.x-ux*26,b.y-uy*26);g.stroke();
 g.fillStyle='#fff7d0';g.strokeStyle='#8a5a10';g.lineWidth=1.2;g.beginPath();g.arc(b.x,b.y,3.6,0,TAU);g.fill();g.stroke();
 g.restore();
}
export function drawFx(g,e){
 const t=clamp(e.life/e.max,0,1);
 g.save();
 if(e.k==='puff'){g.globalAlpha=(e.alpha??.4)*t;g.fillStyle=e.color||'#e6c79a';g.beginPath();g.arc(e.x,e.y,e.r0+(1-t)*(e.grow||8),0,TAU);g.fill();}
 else if(e.k==='flash'){
  g.globalAlpha=t;g.translate(e.x,e.y);g.rotate(e.ang);
  g.fillStyle='#fff3b0';g.beginPath();g.moveTo(0,0);g.lineTo(16*t+4,-6*t);g.lineTo(26*t+6,0);g.lineTo(16*t+4,6*t);g.closePath();g.fill();
  g.fillStyle='#ff9a2e';g.beginPath();g.arc(0,0,6*t,0,TAU);g.fill();
 }else if(e.k==='spark'){g.globalAlpha=t;g.fillStyle=e.color||'#ffd27a';g.beginPath();g.arc(e.x,e.y,e.r*t+.4,0,TAU);g.fill();}
 else if(e.k==='splinter'){g.globalAlpha=Math.min(1,t*1.6);g.translate(e.x,e.y);g.rotate(e.rot+(1-t)*e.spin);g.fillStyle=e.color||'#9a6434';g.fillRect(-e.len/2,-1.3,e.len,2.6);}
 else if(e.k==='ring'){g.globalAlpha=t*.8;g.strokeStyle=e.color||'#fff0c0';g.lineWidth=2.2;g.beginPath();g.arc(e.x,e.y,e.r0+(1-t)*e.grow,0,TAU);g.stroke();}
 g.restore();
}
