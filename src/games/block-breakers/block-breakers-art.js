/* BLOCK BREAKERS art — desert-temple tile arena (top-down).
   Static scenery, the intact floor and the pit layer are pre-rendered once into
   off-screen canvases; only breaking tiles are drawn per frame. */
(() => {
'use strict';
const TAU=Math.PI*2,TILE=42,FRAME=18,W=960,H=540;
const SC=()=>Math.min(2,Math.max(1,(typeof window!=='undefined'&&window.devicePixelRatio)||1.5));
function mulberry(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;
 t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function canvas(w,h){const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c;}
// Same tile size for both arenas: only the number of cells changes.
function layout(big){
 const cols=big?16:12,rows=big?10:8,w=cols*TILE,h=rows*TILE;
 return{big,cols,rows,tile:TILE,w,h,frame:FRAME,W,H,x:Math.round((W-w)/2),y:big?88:Math.round(298-h/2)};
}
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);
 g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
/* ---------- scenery ---------- */
function frond(g,x,y,a,len,s){
 g.save();g.translate(x,y);g.rotate(a);
 g.beginPath();g.moveTo(0,0);g.bezierCurveTo(len*.25,-11*s,len*.7,-13*s,len,0);
 g.bezierCurveTo(len*.7,12*s,len*.25,10*s,0,0);
 const lg=g.createLinearGradient(0,-10*s,0,10*s);lg.addColorStop(0,'#7ec43f');lg.addColorStop(1,'#2e8a2e');
 g.fillStyle=lg;g.fill();g.strokeStyle='#1f6a22';g.lineWidth=1;g.stroke();
 g.strokeStyle='#d8ea8c';g.lineWidth=1.4*s;g.beginPath();g.moveTo(0,0);g.lineTo(len*.95,0);g.stroke();
 g.strokeStyle='rgba(25,95,30,.55)';g.lineWidth=1;g.beginPath();
 for(let k=1;k<6;k++){const px=len*k/6,w=9*s*(1-k/7);g.moveTo(px,0);g.lineTo(px+4*s,-w);g.moveTo(px,0);g.lineTo(px+4*s,w);}
 g.stroke();g.restore();
}
function palm(g,x,y,s,r){
 g.fillStyle='rgba(120,70,10,.25)';g.beginPath();g.ellipse(x+16*s,y+20*s,54*s,34*s,.5,0,TAU);g.fill();
 g.lineCap='round';g.strokeStyle='#7d4d22';g.lineWidth=12*s;
 g.beginPath();g.moveTo(x-26*s,y+38*s);g.quadraticCurveTo(x-12*s,y+16*s,x,y);g.stroke();
 g.strokeStyle='rgba(50,25,5,.55)';g.lineWidth=1.4;
 for(let k=0;k<4;k++){const t=.2+k*.2,px=x-26*s*(1-t)-12*s*0+(-12*s+0)*0;g.beginPath();
  g.moveTo(x-26*s+26*s*t-5*s,y+38*s-38*s*t+3*s);g.lineTo(x-26*s+26*s*t+5*s,y+38*s-38*s*t-3*s);g.stroke();}
 const n=9,a0=r()*TAU;
 for(let i=0;i<n;i++)frond(g,x,y,a0+i/n*TAU+(r()-.5)*.25,(48+r()*16)*s,s);
 g.fillStyle='#6b3f17';[[-4,-3],[4,-2],[0,4]].forEach(([dx,dy])=>{g.beginPath();g.arc(x+dx*s,y+dy*s,4*s,0,TAU);g.fill();});
}
function rock(g,x,y,s,r){
 const n=9,pts=[];for(let i=0;i<n;i++){const a=i/n*TAU,d=(.75+r()*.35)*22*s;pts.push([x+Math.cos(a)*d*1.2,y+Math.sin(a)*d*.9]);}
 g.fillStyle='rgba(90,55,15,.25)';g.beginPath();g.ellipse(x+8*s,y+12*s,30*s,14*s,0,0,TAU);g.fill();
 g.beginPath();pts.forEach(([px,py],i)=>i?g.lineTo(px,py):g.moveTo(px,py));g.closePath();
 const gr=g.createLinearGradient(x-20*s,y-20*s,x+20*s,y+20*s);gr.addColorStop(0,'#b9a98c');gr.addColorStop(1,'#6d5f4c');
 g.fillStyle=gr;g.fill();g.strokeStyle='#4e4435';g.lineWidth=1.4;g.stroke();
 g.fillStyle='rgba(255,245,215,.35)';g.beginPath();g.moveTo(pts[0][0],pts[0][1]);g.lineTo(pts[1][0],pts[1][1]);g.lineTo(x,y-2*s);g.closePath();g.fill();
 g.strokeStyle='rgba(60,50,35,.5)';g.beginPath();g.moveTo(x-8*s,y);g.lineTo(x+4*s,y+8*s);g.stroke();
}
function pot(g,x,y,s){
 g.fillStyle='rgba(100,55,10,.28)';g.beginPath();g.ellipse(x+5*s,y+7*s,18*s,11*s,0,0,TAU);g.fill();
 const gr=g.createRadialGradient(x-4*s,y-4*s,2,x,y,17*s);gr.addColorStop(0,'#e7835a');gr.addColorStop(1,'#a8472a');
 g.fillStyle=gr;g.beginPath();g.arc(x,y,16*s,0,TAU);g.fill();g.strokeStyle='#6f2c17';g.lineWidth=1.5;g.stroke();
 g.fillStyle='#3a1a0c';g.beginPath();g.arc(x,y,10*s,0,TAU);g.fill();
 g.fillStyle='#f4e0b0';g.beginPath();g.arc(x,y,7.5*s,0,TAU);g.fill();
 g.strokeStyle='#f1b46a';g.lineWidth=2;g.beginPath();g.arc(x,y,13*s,.4,2.6);g.stroke();
}
function pillar(g,cx,cy,s){
 const w=46*s,h=46*s;g.save();g.translate(cx,cy);
 g.fillStyle='rgba(110,60,10,.3)';g.beginPath();g.ellipse(6*s,24*s,30*s,12*s,0,0,TAU);g.fill();
 const gr=g.createLinearGradient(-w/2,-h/2,w/2,h/2);gr.addColorStop(0,'#ffdb62');gr.addColorStop(.55,'#f0b92c');gr.addColorStop(1,'#c78a16');
 g.fillStyle=gr;rr(g,-w/2,-h/2,w,h,7*s);g.fill();g.strokeStyle='#8c5a0c';g.lineWidth=1.6;g.stroke();
 g.fillStyle='#3cb4c8';rr(g,-w/2+3*s,h*.06,w-6*s,h*.27,3*s);g.fill();g.strokeStyle='#1f7f93';g.lineWidth=1;g.stroke();
 g.fillStyle='rgba(255,255,255,.7)';for(let k=0;k<4;k++){const px=-w/2+9*s+k*9.5*s;
  g.beginPath();g.moveTo(px,h*.195);g.lineTo(px+3*s,h*.14);g.lineTo(px+6*s,h*.195);g.lineTo(px+3*s,h*.25);g.closePath();g.fill();}
 g.fillStyle='#ffe99a';rr(g,-w/2+5*s,-h/2+4*s,w-10*s,h*.4,5*s);g.fill();
 g.strokeStyle='#b57f12';g.lineWidth=1.2;rr(g,-w/2+10*s,-h/2+9*s,w-20*s,h*.3,3*s);g.stroke();
 g.fillStyle='#b57f12';g.beginPath();g.arc(0,-h/2+h*.2,3.2*s,0,TAU);g.fill();
 g.restore();
}
function brickFrame(g,L,r){
 const f=L.frame,X=L.x-f,Y=L.y-f,Wd=L.w+2*f,Ht=L.h+2*f;
 g.fillStyle='rgba(110,60,10,.28)';g.fillRect(X+5,Y+7,Wd,Ht);
 const cols=['#ef7b42','#e86a35','#f48c52','#dc6030'];
 const brick=(x,y,w,h)=>{g.fillStyle=r()<.12?'#f2b44f':cols[(r()*4)|0];g.fillRect(x,y,w-1,h-1);
  g.fillStyle='rgba(255,232,190,.38)';g.fillRect(x,y,w-1,1.5);
  g.fillStyle='rgba(120,40,10,.32)';g.fillRect(x,y+h-2.5,w-1,1.5);};
 for(let x=X;x<X+Wd;x+=36){const w=Math.min(36,X+Wd-x);brick(x,Y,w,f);brick(x,L.y+L.h,w,f);}
 for(let y=L.y;y<L.y+L.h;y+=30){const h=Math.min(30,L.y+L.h-y);brick(X,y,f,h);brick(L.x+L.w,y,f,h);}
 g.strokeStyle='rgba(70,30,5,.6)';g.lineWidth=2;g.strokeRect(L.x-1,L.y-1,L.w+2,L.h+2);
 g.strokeStyle='rgba(120,50,10,.7)';g.lineWidth=1.5;g.strokeRect(X+.75,Y+.75,Wd-1.5,Ht-1.5);
}
function buildBackdrop(L,seed){
 const sc=SC(),c=canvas(W*sc,H*sc),g=c.getContext('2d');g.scale(sc,sc);const r=mulberry(seed^0xBEEF);
 const gr=g.createLinearGradient(0,0,0,H);gr.addColorStop(0,'#f7d97c');gr.addColorStop(1,'#e8b753');g.fillStyle=gr;g.fillRect(0,0,W,H);
 g.lineCap='round';
 for(let i=0;i<54;i++){const x=r()*W,y=r()*H,len=40+r()*110;
  g.strokeStyle=r()<.5?'rgba(255,242,185,.30)':'rgba(190,130,40,.16)';g.lineWidth=1.5+r()*2;
  g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+len/2,y-6-r()*8,x+len,y+r()*6-3);g.stroke();}
 for(let i=0;i<190;i++){g.fillStyle=r()<.5?'rgba(160,105,30,.22)':'rgba(255,245,200,.35)';g.fillRect(r()*W,r()*H,1.6,1.6);}
 const f=L.frame,leftMid=(L.x-f)/2,rightMid=W-leftMid,k=Math.max(.8,Math.min(1.25,leftMid/70));
 // Decorations are drawn before the frame, so they can never cover the playfield.
 palm(g,leftMid,160,1.05*k,r);palm(g,leftMid+4,392,.85*k,r);
 palm(g,rightMid,176,1.05*k,r);palm(g,rightMid-2,318,.8*k,r);
 rock(g,leftMid-6,286,.9*k,r);rock(g,rightMid+2,436,1.15*k,r);rock(g,rightMid-26,470,.6*k,r);rock(g,leftMid+30,458,.55*k,r);
 pot(g,leftMid+14,330,.9*k);pot(g,rightMid-8,252,.75*k);
 g.fillStyle='#1a0e06';g.fillRect(L.x,L.y,L.w,L.h);
 brickFrame(g,L,r);
 [[L.x-f-6,L.y-f-6],[L.x+L.w+f+6,L.y-f-6],[L.x-f-6,L.y+L.h+f+6],[L.x+L.w+f+6,L.y+L.h+f+6]]
  .forEach(([x,y])=>pillar(g,x,y,.95));
 return c;
}
/* ---------- floor ---------- */
const TILE_BASE=['#f1c862','#edc05a','#f5d273','#e9b957'];
function tileSprite(T,variant){
 const sc=SC(),c=canvas(T*sc,T*sc),g=c.getContext('2d');g.scale(sc,sc);const r=mulberry(7000+variant*31);
 g.fillStyle=TILE_BASE[variant%4];g.fillRect(0,0,T,T);
 const sh=g.createLinearGradient(0,0,T,T);sh.addColorStop(0,'rgba(255,245,200,.22)');sh.addColorStop(1,'rgba(150,95,20,.18)');
 g.fillStyle=sh;g.fillRect(0,0,T,T);
 g.fillStyle='rgba(255,246,196,.65)';g.fillRect(0,0,T,2);g.fillRect(0,0,2,T);
 g.fillStyle='rgba(150,100,25,.5)';g.fillRect(0,T-2.5,T,2.5);g.fillRect(T-2.5,0,2.5,T);
 g.strokeStyle='rgba(120,80,20,.6)';g.lineWidth=1;g.strokeRect(.5,.5,T-1,T-1);
 g.strokeStyle='rgba(150,100,25,.30)';g.lineWidth=1;rr(g,T*.22,T*.22,T*.56,T*.56,3);g.stroke();
 for(let i=0;i<9;i++){g.fillStyle=r()<.5?'rgba(150,100,25,.28)':'rgba(255,245,200,.4)';g.fillRect(3+r()*(T-6),3+r()*(T-6),1.5,1.5);}
 return c;
}
function buildFloor(L,sprites,variants){
 const sc=SC(),c=canvas(L.w*sc,L.h*sc),g=c.getContext('2d');g.scale(sc,sc);
 for(let r=0;r<L.rows;r++)for(let q=0;q<L.cols;q++)g.drawImage(sprites[variants[r*L.cols+q]],q*L.tile,r*L.tile,L.tile,L.tile);
 return c;
}
/* ---------- cracks ---------- */
function makeCrack(seed){
 const r=mulberry(seed),cx=.5+(r()-.5)*.3,cy=.5+(r()-.5)*.3,a0=r()*TAU,rays=[],br=[];
 for(let i=0;i<6;i++){const a=a0+i*TAU/6+(r()-.5)*.7,L=.55+r()*.4,pts=[[cx,cy]];let x=cx,y=cy;
  for(let k=1;k<=4;k++){const aa=a+(r()-.5)*.55;x+=Math.cos(aa)*L/4;y+=Math.sin(aa)*L/4;pts.push([x,y]);}rays.push(pts);}
 for(let i=0;i<5;i++){const ray=rays[i%6],k=1+Math.floor(r()*2),p=ray[k],a=a0+i*1.9+r(),l=.2+r()*.22;
  br.push([[p[0],p[1]],[p[0]+Math.cos(a)*l*.5,p[1]+Math.sin(a)*l*.5],[p[0]+Math.cos(a+.4)*l,p[1]+Math.sin(a+.4)*l]]);}
 return{cx,cy,rays,br,a:.3+r()*.4,b:.3+r()*.4,d:.3+r()*.4,e:.3+r()*.4};
}
function partial(g,pts,frac,x,y,T){
 let total=0;const seg=[];for(let k=1;k<pts.length;k++){const l=Math.hypot(pts[k][0]-pts[k-1][0],pts[k][1]-pts[k-1][1]);seg.push(l);total+=l;}
 let rem=total*frac;g.moveTo(x+pts[0][0]*T,y+pts[0][1]*T);
 for(let k=1;k<pts.length;k++){const l=seg[k-1];
  if(rem>=l){g.lineTo(x+pts[k][0]*T,y+pts[k][1]*T);rem-=l;}
  else{const t=rem/l;g.lineTo(x+(pts[k-1][0]+(pts[k][0]-pts[k-1][0])*t)*T,y+(pts[k-1][1]+(pts[k][1]-pts[k-1][1])*t)*T);break;}}
}
function strokeCracks(g,cr,x,y,T,rayCount,frac,brFrac,width,color){
 g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.lineJoin='round';g.beginPath();
 for(let i=0;i<rayCount;i++)partial(g,cr.rays[i],frac,x,y,T);
 if(brFrac>0)for(let i=0;i<cr.br.length;i++)partial(g,cr.br[i],brFrac,x,y,T);
 g.stroke();
}
/* ---------- breaking tile (stage 1..3) ---------- */
function drawBreaking(g,L,cache,i,state,p,time){
 const T=L.tile,col=i%L.cols,row=(i/L.cols)|0,x=L.x+col*T,y=L.y+row*T;
 const sprite=cache.sprites[cache.variants[i]],cr=cache.crack(i);
 g.save();g.beginPath();g.rect(x-3,y-3,T+6,T+6);g.clip();
 if(state===1){
  g.drawImage(sprite,x,y,T,T);g.fillStyle='rgba(120,70,20,'+(.08+.12*p).toFixed(3)+')';g.fillRect(x,y,T,T);
  strokeCracks(g,cr,x,y,T,3,.15+.4*p,0,1.1,'rgba(70,40,10,.8)');
 }else if(state===2){
  // First tile layer has dropped away; show a distinct inset lower floor.
  g.fillStyle='#4a3020';g.fillRect(x,y,T,T);
  g.fillStyle='#a0784b';g.fillRect(x+3,y+3,T-6,T-6);
  g.drawImage(sprite,x+5,y+5,T-10,T-10);
  g.fillStyle='rgba(36,22,13,.3)';g.fillRect(x+5,y+5,T-10,T-10);
  g.strokeStyle='rgba(251,212,136,.7)';g.lineWidth=1;
  g.strokeRect(x+5.5,y+5.5,T-11,T-11);
 }else if(state===3&&p<.78){
  // The bottom layer starts as a solid surface; cracks grow before it breaks.
  const q=p/.78,j=Math.sin(time*39+i)*q*.4;
  g.fillStyle='#4a3020';g.fillRect(x,y,T,T);
  g.drawImage(sprite,x+5+j,y+5,T-10,T-10);
  g.fillStyle='rgba(59,30,15,'+(.24+.3*q).toFixed(3)+')';g.fillRect(x+5+j,y+5,T-10,T-10);
  strokeCracks(g,cr,x+j,y,T,6,.18+.82*q,.2+.75*q,1.4+q,
   'rgba(37,20,10,.95)');
 }else{
  g.fillStyle='#120a04';g.fillRect(x,y,T,T);
  const A=.8+1.7*p,cx=cr.cx,cy=cr.cy;
  const polys=[[[cx,cy],[cr.a,0],[1,0],[1,cr.b]],[[cx,cy],[1,cr.b],[1,1],[cr.d,1]],
   [[cx,cy],[cr.d,1],[0,1],[0,cr.e]],[[cx,cy],[0,cr.e],[0,0],[cr.a,0]]];
  for(let k=0;k<4;k++){
   const mx=polys[k].reduce((a,q)=>a+q[0],0)/4-.5,my=polys[k].reduce((a,q)=>a+q[1],0)/4-.5;
   const dx=Math.sin(time*55+k*2.1+i)*A+mx*p*5,dy=Math.cos(time*47+k*1.7+i)*A+my*p*5+p*1.6,sk=1-.07*p;
   g.save();g.translate(x+T/2+dx,y+T/2+dy);g.scale(sk,sk);g.translate(-T/2,-T/2);
   g.beginPath();polys[k].forEach(([px,py],n)=>n?g.lineTo(px*T,py*T):g.moveTo(px*T,py*T));g.closePath();g.clip();
   g.drawImage(sprite,0,0,T,T);g.fillStyle='rgba(70,36,10,'+(.5+.2*p).toFixed(3)+')';g.fillRect(0,0,T,T);
   strokeCracks(g,cr,0,0,T,6,1,1,2.2,'rgba(30,14,3,.95)');g.restore();
  }
 }
 g.restore();
}
/* ---------- pit (state 4) ---------- */
function pit(g,x,y,T,nb){
 const gr=g.createLinearGradient(x,y,x,y+T);gr.addColorStop(0,'#2d190b');gr.addColorStop(1,'#0e0603');g.fillStyle=gr;g.fillRect(x,y,T,T);
 const deep=nb.u&&nb.d&&nb.l&&nb.r?.85:.6;
 const rg=g.createRadialGradient(x+T/2,y+T/2,2,x+T/2,y+T/2,T*.78);rg.addColorStop(0,'rgba(0,0,0,'+deep+')');rg.addColorStop(1,'rgba(0,0,0,0)');
 g.fillStyle=rg;g.fillRect(x,y,T,T);
 const band=9,side=(x0,y0,x1,y1,rx,ry,rw,rh,a)=>{const lg=g.createLinearGradient(x0,y0,x1,y1);
  lg.addColorStop(0,'rgba(0,0,0,'+a+')');lg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=lg;g.fillRect(rx,ry,rw,rh);};
 if(!nb.u)side(x,y,x,y+band,x,y,T,band,.78);
 if(!nb.l)side(x,y,x+band,y,x,y,band,T,.6);
 if(!nb.r)side(x+T,y,x+T-band,y,x+T-band,y,band,T,.38);
 if(!nb.d)side(x,y+T,x,y+T-band,x,y+T-band,T,band,.3);
 g.fillStyle='#5e3a14';if(!nb.u)g.fillRect(x,y,T,1.5);if(!nb.l)g.fillRect(x,y,1.5,T);
 g.fillStyle='#c48d3a';if(!nb.d)g.fillRect(x,y+T-1.5,T,1.5);if(!nb.r)g.fillRect(x+T-1.5,y,1.5,T);
 g.fillStyle='rgba(120,80,30,.35)';for(let k=0;k<3;k++)g.fillRect(x+6+((k*17+x)%(T-12)),y+8+((k*11+y)%(T-16)),2,2);
}
function updateHoleCell(cache,s,i){
 const L=s.layout,T=L.tile,g=cache.holeCtx,c=i%L.cols,r=(i/L.cols)|0;
 g.clearRect(c*T,r*T,T,T);if(s.st[i]!==4)return;
 const h=(cc,rr2)=>cc>=0&&rr2>=0&&cc<L.cols&&rr2<L.rows&&s.st[rr2*L.cols+cc]===4;
 pit(g,c*T,r*T,T,{u:h(c,r-1),d:h(c,r+1),l:h(c-1,r),r:h(c+1,r)});
}
function flushHoles(cache,s){
 if(!s.dirty.length)return;const L=s.layout,seen=new Set();
 for(const i of s.dirty){const c=i%L.cols,r=(i/L.cols)|0;
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const cc=c+dc,rr2=r+dr;
   if(cc<0||rr2<0||cc>=L.cols||rr2>=L.rows)continue;const j=rr2*L.cols+cc;if(seen.has(j))continue;seen.add(j);updateHoleCell(cache,s,j);}}
 s.dirty.length=0;
}
/* ---------- build ---------- */
function build(L,seed){
 const sc=SC(),total=L.cols*L.rows,r=mulberry(seed^0x77),variants=new Uint8Array(total);
 for(let i=0;i<total;i++)variants[i]=Math.floor(r()*4);
 const sprites=[0,1,2,3].map(v=>tileSprite(L.tile,v));
 const holes=canvas(L.w*sc,L.h*sc),holeCtx=holes.getContext('2d');holeCtx.scale(sc,sc);
 const cracks=new Array(total);
 return{backdrop:buildBackdrop(L,seed),floor:buildFloor(L,sprites,variants),holes,holeCtx,sprites,variants,
  crack:i=>cracks[i]||(cracks[i]=makeCrack((seed^0x3C6EF372)+i*7919))};
}
window.BlockBreakersArt=Object.freeze({layout,build,drawBreaking,flushHoles,TILE,FRAME});
})();
