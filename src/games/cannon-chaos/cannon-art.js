/* CANNON CHAOS — drawing helpers (canvas, no external resources, no cached surfaces).
   Everything is drawn in WORLD units; the engine applies the world->960x540 transform. */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ------------------------------ island shape ------------------------------ */
export function islandRadius(isl,a){
 const k=1+.045*Math.sin(3*a+1.3)+.03*Math.sin(5*a+.4)+.02*Math.sin(7*a+2.1);
 return k;
}
export function buildIsland(cx,cy,rx,ry){
 const pts=[];
 for(let i=0;i<96;i++){
  const a=i/96*TAU,k=islandRadius(null,a);
  pts.push({x:cx+Math.cos(a)*rx*k,y:cy+Math.sin(a)*ry*k});
 }
 return {cx,cy,rx,ry,pts};
}
function blobPath(g,isl,grow){
 g.beginPath();
 isl.pts.forEach((q,i)=>{
  const x=isl.cx+(q.x-isl.cx)*grow,y=isl.cy+(q.y-isl.cy)*grow;
  if(i)g.lineTo(x,y);else g.moveTo(x,y);
 });
 g.closePath();
}

/* ------------------------------ scenery ------------------------------ */
function lcg(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
export function buildDecor(s){
 const r=lcg(20241110),u=s.u,isl=s.island,tur=s.turrets,out={palms:[],rocks:[],stars:[],shells:[],specks:[],waves:[]};
 const farFromTurrets=(x,y,d)=>tur.every(t=>Math.hypot(t.x-x,t.y-y)>d*u);
 const spot=(rmin,rmax,d,tries=60)=>{
  for(let i=0;i<tries;i++){
   const a=r()*TAU,k=rmin+r()*(rmax-rmin),m=islandRadius(null,a);
   const x=isl.cx+Math.cos(a)*isl.rx*m*k,y=isl.cy+Math.sin(a)*isl.ry*m*k;
   if(farFromTurrets(x,y,d))return {x,y,a};
  }
  return null;
 };
 const large=s.world.large;
 // palms hug the left / right shore like the reference picture
 const palmAngles=large?[Math.PI,0,Math.PI*.5]:[Math.PI*.93,Math.PI*.07];
 for(const a0 of palmAngles){
  for(let tries=0;tries<30;tries++){
   const a=a0+(r()-.5)*.5,m=islandRadius(null,a),k=.82-tries*.01;
   const x=isl.cx+Math.cos(a)*isl.rx*m*k,y=isl.cy+Math.sin(a)*isl.ry*m*k;
   if(farFromTurrets(x,y,96)){out.palms.push({x,y,rot:r()*TAU,sz:1+r()*.15});break;}
  }
 }
 const nR=large?9:6,nS=large?9:6,nSh=large?9:6;
 for(let i=0;i<nR;i++){const q=spot(.62,.93,62);if(q)out.rocks.push({x:q.x,y:q.y,sz:.8+r()*.7,rot:r()*TAU,n:1+(r()*3|0)});}
 for(let i=0;i<nS;i++){const q=spot(.3,.9,52);if(q)out.stars.push({x:q.x,y:q.y,sz:.7+r()*.5,rot:r()*TAU,c:i%3===0?'#ff8a3c':'#ff5a4d'});}
 for(let i=0;i<nSh;i++){const q=spot(.25,.92,48);if(q)out.shells.push({x:q.x,y:q.y,sz:.6+r()*.5,rot:r()*TAU});}
 for(let i=0;i<70;i++){const q=spot(.05,.95,30,4);if(q)out.specks.push({x:q.x,y:q.y,r:(.8+r()*1.6)*u});}
 for(let i=0;i<(large?34:24);i++){
  const a=r()*TAU,m=islandRadius(null,a),k=1.12+r()*.55;
  const x=isl.cx+Math.cos(a)*isl.rx*m*k,y=isl.cy+Math.sin(a)*isl.ry*m*k;
  if(x>10&&x<s.world.w-10&&y>10&&y<s.world.h-10)out.waves.push({x,y,ph:r()*TAU,sz:(10+r()*14)*u,rot:(r()-.5)*.5});
 }
 return out;
}
function star(g,x,y,rad,rot,color,u){
 g.save();g.translate(x,y);g.rotate(rot);
 g.beginPath();
 for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?rad*.42:rad;g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}
 g.closePath();g.fillStyle=color;g.fill();g.strokeStyle='rgba(120,30,20,.55)';g.lineWidth=1.2*u;g.stroke();
 g.fillStyle='rgba(255,255,255,.55)';
 for(let i=0;i<5;i++){const a=i*TAU/5-Math.PI/2;g.beginPath();g.arc(Math.cos(a)*rad*.5,Math.sin(a)*rad*.5,rad*.07,0,TAU);g.fill();}
 g.restore();
}
function rock(g,x,y,sz,rot,n,u){
 g.save();g.translate(x,y);g.rotate(rot);g.scale(sz*u,sz*u);
 const bits=[[0,0,13,9],[15,6,8,6],[-12,8,7,5]].slice(0,n);
 for(const [dx,dy,rx,ry] of bits){
  g.fillStyle='rgba(60,40,20,.25)';g.beginPath();g.ellipse(dx+3,dy+4,rx,ry,0,0,TAU);g.fill();
  const gr=g.createLinearGradient(dx-rx,dy-ry,dx+rx,dy+ry);gr.addColorStop(0,'#b9b3a6');gr.addColorStop(1,'#6f6a61');
  g.fillStyle=gr;g.beginPath();g.ellipse(dx,dy,rx,ry,0,0,TAU);g.fill();
  g.strokeStyle='#4f4b44';g.lineWidth=1.2;g.stroke();
  g.fillStyle='rgba(255,255,255,.28)';g.beginPath();g.ellipse(dx-rx*.28,dy-ry*.35,rx*.4,ry*.25,0,0,TAU);g.fill();
 }
 g.restore();
}
function palm(g,x,y,rot,sz,u,t){
 g.save();g.translate(x,y);g.scale(sz*u,sz*u);
 g.fillStyle='rgba(40,70,30,.28)';g.beginPath();g.ellipse(8,12,36,26,.3,0,TAU);g.fill();
 g.fillStyle='#5b3a1c';g.beginPath();g.arc(0,0,9,0,TAU);g.fill();
 g.fillStyle='#2f1c0b';g.beginPath();g.arc(-3,3,4,0,TAU);g.arc(4,4,4,0,TAU);g.fill();
 const sway=Math.sin(t*1.4+x*.01)*.04;
 for(let i=0;i<8;i++){
  const a=rot+i*TAU/8+sway*(i%2?1:-1);
  g.save();g.rotate(a);
  const gr=g.createLinearGradient(0,0,46,0);gr.addColorStop(0,'#4aa532');gr.addColorStop(1,'#a6e04a');
  g.fillStyle=gr;g.beginPath();g.moveTo(2,0);g.bezierCurveTo(12,-16,36,-17,48,0);g.bezierCurveTo(36,13,12,12,2,0);g.fill();
  g.strokeStyle='#2f7a24';g.lineWidth=1.4;g.beginPath();g.moveTo(4,0);g.lineTo(44,0);g.stroke();
  g.restore();
 }
 g.fillStyle='#7a4b22';g.beginPath();g.arc(0,0,6,0,TAU);g.fill();
 g.fillStyle='#a8743c';g.beginPath();g.arc(-1.5,-1.5,2.4,0,TAU);g.fill();
 g.restore();
}
function skull(g,cx,cy,sz){
 g.save();g.translate(cx,cy);g.scale(sz,sz);g.globalAlpha=.3;g.fillStyle='#d9a63f';
 g.beginPath();g.ellipse(0,-6,46,40,0,0,TAU);g.fill();
 g.beginPath();g.roundRect?g.roundRect(-26,22,52,32,8):g.rect(-26,22,52,32);g.fill();
 g.globalAlpha=.42;g.fillStyle='#e8c46a';
 g.beginPath();g.ellipse(-17,-6,12,14,0,0,TAU);g.ellipse(17,-6,12,14,0,0,TAU);g.fill();
 g.beginPath();g.moveTo(0,8);g.lineTo(-6,20);g.lineTo(6,20);g.closePath();g.fill();
 g.restore();
}

export function drawBackground(g,s,time){
 const w=s.world,u=s.u,isl=s.island,d=s.decor;
 const sea=g.createRadialGradient(w.w/2,w.h/2,w.h*.2,w.w/2,w.h/2,w.w*.62);
 sea.addColorStop(0,'#2aa0ff');sea.addColorStop(.55,'#1a78ff');sea.addColorStop(1,'#0d4fe0');
 g.fillStyle=sea;g.fillRect(0,0,w.w,w.h);
 // drifting wave marks in the open water
 g.lineCap='round';
 for(const q of d.waves){
  const ph=Math.sin(time*1.2+q.ph),al=.14+.1*ph;
  g.save();g.translate(q.x,q.y+ph*2*u);g.rotate(q.rot);
  g.strokeStyle='rgba(8,40,150,'+(al+.12)+')';g.lineWidth=3.2*u;
  g.beginPath();g.moveTo(-q.sz,0);g.quadraticCurveTo(-q.sz*.4,-q.sz*.3,0,0);g.quadraticCurveTo(q.sz*.4,q.sz*.3,q.sz,0);g.stroke();
  g.strokeStyle='rgba(190,235,255,'+al+')';g.lineWidth=1.6*u;g.translate(0,-3*u);
  g.beginPath();g.moveTo(-q.sz*.7,0);g.quadraticCurveTo(-q.sz*.3,-q.sz*.25,0,0);g.stroke();
  g.restore();
 }
 // shallow water halo + breathing foam
 const br=Math.sin(time*1.6)*.012;
 blobPath(g,isl,1.16+br);g.fillStyle='rgba(90,210,255,.35)';g.fill();
 blobPath(g,isl,1.09+br);g.fillStyle='rgba(140,232,255,.55)';g.fill();
 g.save();blobPath(g,isl,1.05+br);g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=3.2*u;
 g.setLineDash([14*u,10*u]);g.lineDashOffset=-time*18*u;g.stroke();g.restore();
 // sand
 blobPath(g,isl,1.015);g.fillStyle='#e7c377';g.fill();
 blobPath(g,isl,.985);
 const sand=g.createRadialGradient(isl.cx,isl.cy-isl.ry*.2,isl.ry*.1,isl.cx,isl.cy,isl.rx*1.05);
 sand.addColorStop(0,'#ffe9a3');sand.addColorStop(.7,'#f6d889');sand.addColorStop(1,'#ecc872');
 g.fillStyle=sand;g.fill();
 g.fillStyle='rgba(176,132,60,.35)';
 for(const q of d.specks){g.beginPath();g.arc(q.x,q.y,q.r,0,TAU);g.fill();}
 skull(g,isl.cx,isl.cy+isl.ry*.05,(s.world.large?1.25:1)*Math.min(1,isl.ry/190));
 for(const q of d.shells){
  g.save();g.translate(q.x,q.y);g.rotate(q.rot);g.scale(q.sz*u,q.sz*u);
  g.fillStyle='#ffd3b8';g.beginPath();g.ellipse(0,0,7,5,0,0,TAU);g.fill();g.strokeStyle='#d9926a';g.lineWidth=1;g.stroke();g.restore();
 }
 for(const q of d.stars)star(g,q.x,q.y,13*q.sz*u,q.rot,q.c,u);
 for(const q of d.rocks)rock(g,q.x,q.y,q.sz,q.rot,q.n,u);
 for(const q of d.palms)palm(g,q.x,q.y,q.rot,q.sz,u,time);
}

/* ------------------------------ turrets ------------------------------ */
function heartPath(g,x,y,r){
 g.beginPath();g.moveTo(x,y+r*.9);
 g.bezierCurveTo(x-r*1.5,y-r*.1,x-r*.8,y-r*1.2,x,y-r*.45);
 g.bezierCurveTo(x+r*.8,y-r*1.2,x+r*1.5,y-r*.1,x,y+r*.9);g.closePath();
}
export function drawBase(g,t,color,u,dead){
 g.save();g.translate(t.x,t.y);
 g.fillStyle='rgba(30,20,10,.3)';g.beginPath();g.ellipse(5*u,7*u,41*u,38*u,0,0,TAU);g.fill();
 const R=38*u;
 const wood=g.createRadialGradient(-8*u,-8*u,4*u,0,0,R);
 wood.addColorStop(0,dead?'#6b5a48':'#b27a3e');wood.addColorStop(1,dead?'#3f352a':'#7a4a22');
 g.fillStyle=wood;g.beginPath();g.arc(0,0,R,0,TAU);g.fill();
 g.strokeStyle='rgba(50,28,10,.55)';g.lineWidth=1.4*u;
 for(let i=0;i<14;i++){const a=i*TAU/14;g.beginPath();g.moveTo(Math.cos(a)*R*.62,Math.sin(a)*R*.62);g.lineTo(Math.cos(a)*R,Math.sin(a)*R);g.stroke();}
 g.strokeStyle=dead?'#555':color;g.lineWidth=5*u;g.beginPath();g.arc(0,0,R-2.5*u,0,TAU);g.stroke();
 g.strokeStyle='#3b2410';g.lineWidth=2*u;g.beginPath();g.arc(0,0,R+.5*u,0,TAU);g.stroke();
 g.fillStyle=dead?'#2e2720':'#5d3a19';g.beginPath();g.arc(0,0,R*.66,0,TAU);g.fill();
 g.restore();
}
export function drawBarrel(g,t,angle,recoil,color,u,glow,dead){
 g.save();g.translate(t.x,t.y);g.rotate(angle);
 const back=-recoil*11*u,L=56*u;
 g.translate(back,0);
 g.fillStyle='rgba(0,0,0,.25)';g.fillRect(-10*u+3*u,-8.5*u+4*u,L+10*u,17*u);
 const gr=g.createLinearGradient(0,-9*u,0,9*u);
 gr.addColorStop(0,'#5a5f68');gr.addColorStop(.35,'#2a2d33');gr.addColorStop(1,'#0e0f12');
 g.fillStyle=gr;
 g.beginPath();g.moveTo(-10*u,-7*u);g.lineTo(L-4*u,-8.5*u);g.lineTo(L,-9.5*u);g.lineTo(L,9.5*u);g.lineTo(L-4*u,8.5*u);g.lineTo(-10*u,7*u);g.closePath();g.fill();
 g.beginPath();g.arc(-10*u,0,7*u,Math.PI/2,Math.PI*1.5);g.fill();
 g.fillStyle=dead?'#555':color;g.fillRect(L-17*u,-9*u,5*u,18*u);
 g.fillStyle='#08090b';g.fillRect(L-3*u,-9.5*u,3*u,19*u);
 g.fillStyle='rgba(255,255,255,.22)';g.fillRect(-4*u,-5.5*u,L-14*u,2.2*u);
 if(glow>0&&!dead){
  const gg=g.createRadialGradient(L+2*u,0,0,L+2*u,0,12*u);
  gg.addColorStop(0,'rgba(255,255,255,'+.85*glow+')');gg.addColorStop(.4,color);gg.addColorStop(1,'rgba(255,255,255,0)');
  g.globalAlpha=.8*glow;g.fillStyle=gg;g.beginPath();g.arc(L+2*u,0,12*u,0,TAU);g.fill();
 }
 g.restore();
}
export function drawReload(g,t,color,u,frac,ready,time){
 g.save();g.translate(t.x,t.y);g.lineCap='round';
 const R=45*u;
 g.strokeStyle='rgba(10,20,60,.45)';g.lineWidth=4.5*u;g.beginPath();g.arc(0,0,R,0,TAU);g.stroke();
 if(ready){
  const p=.6+.4*Math.sin(time*9);
  g.strokeStyle='rgba(255,255,255,'+(.55+.4*p)+')';g.lineWidth=3.4*u;g.beginPath();g.arc(0,0,R,0,TAU);g.stroke();
 }else if(frac>0){
  g.strokeStyle='#ffe066';g.lineWidth=4*u;g.beginPath();g.arc(0,0,R,-Math.PI/2,-Math.PI/2+TAU*clamp(frac,0,1));g.stroke();
 }
 g.restore();
}
export function drawHearts(g,s,t,color,u,hearts,max,flash,dead){
 const dx=t.x-s.island.cx,dy=t.y-s.island.cy,m=Math.hypot(dx,dy)||1;
 const off=(dead?0:64)*u;
 let x=t.x+dx/m*off,y=t.y+dy/m*off;
 const gap=19*u;
 x=clamp(x,gap*1.5+6*u,s.world.w-gap*1.5-6*u);y=clamp(y,14*u,s.world.h-14*u);
 for(let i=0;i<max;i++){
  const hx=x+(i-(max-1)/2)*gap;
  heartPath(g,hx,y,7.5*u);
  if(i<hearts){
   g.fillStyle=color;g.fill();g.strokeStyle='rgba(0,0,0,.55)';g.lineWidth=1.6*u;g.stroke();
   g.fillStyle='rgba(255,255,255,.45)';g.beginPath();g.arc(hx-3*u,y-2.5*u,1.7*u,0,TAU);g.fill();
  }else{
   g.globalAlpha=(i===hearts&&flash>0)?.9:.4;g.strokeStyle=(i===hearts&&flash>0)?'#fff':'rgba(0,0,0,.65)';
   g.lineWidth=1.6*u;g.stroke();g.globalAlpha=1;
  }
 }
}

/* ------------------------------ bullets & effects ------------------------------ */
export function drawBullet(g,b,u){
 g.save();g.translate(b.x,b.y);
 g.fillStyle='rgba(0,0,30,.28)';g.beginPath();g.ellipse(3.5*u,5*u,7*u,5.5*u,0,0,TAU);g.fill();
 const gr=g.createRadialGradient(-2.5*u,-2.5*u,.5*u,0,0,7.5*u);
 gr.addColorStop(0,'#7b8088');gr.addColorStop(.35,'#25282d');gr.addColorStop(1,'#050506');
 g.fillStyle=gr;g.beginPath();g.arc(0,0,7*u,0,TAU);g.fill();
 g.restore();
}
export function drawFx(g,e,u){
 const k=1-e.life/e.max;
 g.save();
 switch(e.k){
  case 'flash':{
   g.globalAlpha=1-k;g.translate(e.x,e.y);g.rotate(e.a);
   const gg=g.createRadialGradient(0,0,0,0,0,26*u);gg.addColorStop(0,'#fff8c8');gg.addColorStop(.45,'#ffb43a');gg.addColorStop(1,'rgba(255,90,20,0)');
   g.fillStyle=gg;g.beginPath();g.moveTo(34*u*(1-k*.3),0);g.lineTo(8*u,-10*u);g.lineTo(-6*u,0);g.lineTo(8*u,10*u);g.closePath();g.fill();
   g.beginPath();g.arc(0,0,14*u*(1+k),0,TAU);g.fill();break;}
  case 'puff':{
   g.globalAlpha=e.alpha*(1-k);g.fillStyle=e.color;g.beginPath();g.arc(e.x,e.y,(e.r0+e.grow*k)*u,0,TAU);g.fill();break;}
  case 'spark':{
   g.globalAlpha=1-k;g.fillStyle=e.color;g.beginPath();g.arc(e.x,e.y,e.r*(1-k*.6)*u,0,TAU);g.fill();break;}
  case 'blast':{
   g.translate(e.x,e.y);
   const r=(14+60*k)*u*e.sz;
   const gg=g.createRadialGradient(0,0,r*.1,0,0,r);gg.addColorStop(0,'rgba(255,250,200,'+(1-k)+')');gg.addColorStop(.45,'rgba(255,150,40,'+(.9*(1-k))+')');gg.addColorStop(1,'rgba(200,40,10,0)');
   g.fillStyle=gg;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
   g.strokeStyle='rgba(255,230,160,'+(.8*(1-k))+')';g.lineWidth=3*u*(1-k);g.beginPath();g.arc(0,0,r*1.05,0,TAU);g.stroke();break;}
  case 'splash':{
   g.translate(e.x,e.y);
   g.strokeStyle='rgba(255,255,255,'+(.9*(1-k))+')';g.lineWidth=3*u*(1-k)+.5;
   g.beginPath();g.ellipse(0,0,(6+26*k)*u,(4+18*k)*u,0,0,TAU);g.stroke();
   g.strokeStyle='rgba(200,240,255,'+(.6*(1-k))+')';g.beginPath();g.ellipse(0,0,(3+14*k)*u,(2+9*k)*u,0,0,TAU);g.stroke();break;}
  case 'drop':{
   g.globalAlpha=1-k;g.fillStyle='#e8f8ff';g.beginPath();g.arc(e.x,e.y,e.r*(1-k*.5)*u,0,TAU);g.fill();break;}
  case 'ring':{
   g.translate(e.x,e.y);g.strokeStyle=e.color;g.globalAlpha=1-k;g.lineWidth=2.5*u;
   g.beginPath();g.arc(0,0,(14+22*k)*u,0,TAU);g.stroke();break;}
 }
 g.restore();
}
export function drawX(g,t,u){
 g.save();g.translate(t.x,t.y);g.strokeStyle='rgba(20,10,5,.7)';g.lineWidth=5*u;g.lineCap='round';
 g.beginPath();g.moveTo(-14*u,-14*u);g.lineTo(14*u,14*u);g.moveTo(14*u,-14*u);g.lineTo(-14*u,14*u);g.stroke();g.restore();
}
