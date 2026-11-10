/* DYNAMITE art — top-down gold mine painted as cached SVG layers.
   BG  : floor, sand, rock walls, rails, decor (always below trams and avatars).
   FG  : cliff lips and timber tunnel mouths drawn ABOVE trams so carts emerge
         from darkness. Both layers are rasterised once per arena size.
   Decor is purely visual: it never changes the walkable rectangle. */
(() => {
'use strict';
const TAU=Math.PI*2;
const cache=new Map();
const noise=i=>{const n=Math.sin(i*127.1+63.7)*43758.5453;return n-Math.floor(n);};
const f1=v=>Math.round(v*10)/10;
const ready=im=>!!(im&&im.complete&&im.naturalWidth>0);

/* ---------- path maths (shared with the engine through window.DynamiteArt) ---------- */
function bezier(p,t){
 const u=1-t,a=u*u*u,b=3*u*u*t,c=3*u*t*t,d=t*t*t;
 return {x:a*p[0].x+b*p[1].x+c*p[2].x+d*p[3].x,y:a*p[0].y+b*p[1].y+c*p[2].y+d*p[3].y};
}
function buildPath(ctrl){
 const pts=[];
 for(let i=0;i<=240;i++)pts.push(bezier(ctrl,i/240));
 // Re-sample at a constant 3 px so s -> position is uniform in arc length.
 const out=[{x:pts[0].x,y:pts[0].y,s:0}];let acc=0,carry=0;
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],seg=Math.hypot(b.x-a.x,b.y-a.y);
  acc+=seg;
  while(acc-out[out.length-1].s>=3){
   const target=out[out.length-1].s+3,over=acc-target,t=seg?1-over/seg:1;
   out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,s:target});
  }
 }
 out.push({x:pts[pts.length-1].x,y:pts[pts.length-1].y,s:acc});
 return {points:out,length:acc};
}
function pointAt(path,s){
 const P=path.points,n=P.length;
 if(s<=0){const a=P[0],b=P[1],d=Math.hypot(b.x-a.x,b.y-a.y)||1;
  return {x:a.x+(b.x-a.x)/d*s,y:a.y+(b.y-a.y)/d*s};}
 if(s>=path.length){const a=P[n-2],b=P[n-1],d=Math.hypot(b.x-a.x,b.y-a.y)||1,e=s-path.length;
  return {x:b.x+(b.x-a.x)/d*e,y:b.y+(b.y-a.y)/d*e};}
 const i=Math.min(n-2,Math.floor(s/3)),a=P[i],b=P[i+1],span=b.s-a.s||1,t=(s-a.s)/span;
 return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}
function distanceToPath(path,x,y){
 let best=Infinity;const P=path.points;
 for(let i=0;i<P.length;i+=2){const d=Math.hypot(P[i].x-x,P[i].y-y);if(d<best)best=d;}
 return best;
}

/* ---------- SVG helpers ---------- */
function offsetLine(path,off,from=0,to=path.length){
 const P=path.points;let d='';
 for(let i=0;i<P.length;i++){
  if(P[i].s<from||P[i].s>to)continue;
  const a=P[Math.max(0,i-1)],b=P[Math.min(P.length-1,i+1)];
  const l=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/l,ny=(b.x-a.x)/l;
  d+=(d?'L':'M')+f1(P[i].x+nx*off)+' '+f1(P[i].y+ny*off);
 }
 return d;
}
function ties(path,gauge){
 const P=path.points;let out='',shadow='';
 for(let i=2;i<P.length-2;i+=5){
  const a=P[i-1],b=P[i+1],l=Math.hypot(b.x-a.x,b.y-a.y)||1,tx=(b.x-a.x)/l,ty=(b.y-a.y)/l;
  const nx=-ty,ny=tx,w=gauge/2+9,x=P[i].x,y=P[i].y;
  const x1=x-nx*w,y1=y-ny*w,x2=x+nx*w,y2=y+ny*w;
  shadow+='M'+f1(x1+2)+' '+f1(y1+3)+'L'+f1(x2+2)+' '+f1(y2+3);
  out+='M'+f1(x1)+' '+f1(y1)+'L'+f1(x2)+' '+f1(y2);
 }
 return {out,shadow};
}
function rockWall(side,b,W,H,seed){
 // side -1 = left, +1 = right. Edge only ever bulges OUTWARD from the walk limit.
 const edgeX=side<0?b.x:b.x+b.w,pts=[];
 for(let y=-10;y<=H+10;y+=18){
  const wob=noise(y*.31+seed)*10+Math.sin(y*.05+seed)*3.5;
  pts.push([edgeX-side*(wob+2),y]);
 }
 const far=side<0?-30:W+30;
 let d='M'+far+' -20';
 pts.forEach(p=>d+='L'+f1(p[0])+' '+f1(p[1]));
 d+='L'+far+' '+(H+20)+'Z';
 return {d,pts};
}
function decor(b,W,H,pathList){
 let g='';
 const rockBand=(x,y,w,h,c)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+c+'"/>';
 // sand ripples
 let ripple='';
 for(let i=0;i<46;i++){
  const x=b.x+noise(i*3.1)*b.w,y=b.y+noise(i*7.7)*b.h,l=40+noise(i*1.7)*70;
  ripple+='M'+f1(x)+' '+f1(y)+'q'+f1(l*.25)+' -5 '+f1(l*.5)+' 0t'+f1(l*.5)+' 0';
 }
 g+='<path d="'+ripple+'" fill="none" stroke="#b6764c" stroke-width="2.2" opacity=".32" stroke-linecap="round"/>';
 g+='<path d="'+ripple+'" fill="none" stroke="#f1b57f" stroke-width="1" opacity=".18" transform="translate(0 -2)"/>';
 // wall-base gold crystals (outside / on the very edge of the walkable box)
 const crystal=(x,y,s,k)=>{
  const hue=k%3?'#ffd45a':'#ffbe2e';
  return '<g transform="translate('+f1(x)+' '+f1(y)+') scale('+s+')">'+
   '<circle r="30" fill="url(#glow)" opacity=".75"/>'+
   '<path d="M-10 6L-14-8-5-16-1-3Z" fill="'+hue+'" stroke="#a8641c" stroke-width="1.4"/>'+
   '<path d="M-2 8L-3-14 8-20 14-6 9 8Z" fill="#ffe27a" stroke="#a8641c" stroke-width="1.4"/>'+
   '<path d="M2-12L8-17 11-8Z" fill="#fff6c4" opacity=".9"/></g>';
 };
 const wallL=b.x,wallR=b.x+b.w;
 const spots=[
  [wallL-24,b.y+b.h*.18,1],[wallL-16,b.y+b.h*.62,.8],[wallR+22,b.y+b.h*.30,1.05],
  [wallR+14,b.y+b.h*.78,.85],[wallL-28,b.y+b.h*.9,.7],[wallR+30,b.y+b.h*.08,.7]];
 spots.forEach((s,i)=>g+=crystal(s[0],s[1],s[2],i));
 // cacti hugging the walls
 const cactus=(x,y,flip,s)=>'<g transform="translate('+f1(x)+' '+f1(y)+') scale('+(flip*s)+' '+s+')">'+
  '<ellipse cx="2" cy="14" rx="15" ry="6" fill="#3b2412" opacity=".3"/>'+
  '<path d="M0 12C-5 0-4-20 0-26 5-20 5 0 0 12Z" fill="#5f9a3e" stroke="#2f5a22" stroke-width="2"/>'+
  '<path d="M-2 6C-14 4-17-6-14-14" fill="none" stroke="#5f9a3e" stroke-width="7" stroke-linecap="round"/>'+
  '<path d="M2 0C13 -2 16-10 13-18" fill="none" stroke="#6fae48" stroke-width="7" stroke-linecap="round"/>'+
  '<path d="M0 8L0-22" stroke="#9bd06c" stroke-width="1.4" opacity=".7"/></g>';
 g+=cactus(wallL+4,b.y+b.h*.38,1,1.15)+cactus(wallL+2,b.y+b.h*.47,1,.8)+
    cactus(wallR-6,b.y+b.h*.52,-1,1.2)+cactus(wallR-2,b.y+b.h*.60,-1,.75)+
    cactus(wallL+6,b.y+b.h*.86,1,.8);
 // bones + skull near the upper-left wall (flat on the ground)
 g+='<g transform="translate('+f1(wallL+58)+' '+f1(b.y+b.h*.14)+') rotate(-12)" opacity=".92">'+
  '<path d="M0 0L30 6" stroke="#eadfc6" stroke-width="5" stroke-linecap="round"/>'+
  '<circle cx="-2" cy="-1" r="4" fill="#eadfc6"/><circle cx="31" cy="8" r="4" fill="#eadfc6"/>'+
  '<path d="M18 -18C26 -26 44 -22 48 -12 52 -2 40 4 30 2Z" fill="#e7dcc4" stroke="#9c8a68" stroke-width="1.6"/>'+
  '<circle cx="38" cy="-14" r="3" fill="#4a3a28"/><circle cx="44" cy="-8" r="2.6" fill="#4a3a28"/></g>';
 // loose ore chips / pebbles on the floor (tiny, flat)
 for(let i=0;i<26;i++){
  const x=b.x+10+noise(i*5.3+2)*(b.w-20),y=b.y+10+noise(i*9.1+4)*(b.h-20);
  if(pathList.some(p=>distanceToPath(p,x,y)<44))continue;
  const gold=i%4===0;
  g+='<ellipse cx="'+f1(x)+'" cy="'+f1(y)+'" rx="'+f1(2.4+noise(i)*2.6)+'" ry="'+f1(1.6+noise(i+9)*1.6)+
   '" fill="'+(gold?'#ffcf4a':'#8a5a3c')+'" opacity="'+(gold?.8:.55)+'"/>';
 }
 return g;
}
function tunnelMouth(x,yEdge,dir,width,H){
 // dir=+1 -> cliff band above the floor (opening faces down); -1 -> band below.
 const w=width/2,top=dir>0?yEdge-12:yEdge+12;
 return {x,w,top};
}

/* ---------- full-layer builders ---------- */
function layerBG(g){
 const {W,H,b,paths,gauge}=g;
 let s='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">';
 s+='<defs>'+
  '<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98957"/><stop offset=".55" stop-color="#b87647"/><stop offset="1" stop-color="#9a5e3b"/></linearGradient>'+
  '<radialGradient id="spot" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".38"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>'+
  '<radialGradient id="glow"><stop offset="0" stop-color="#ffe27a" stop-opacity=".95"/><stop offset=".45" stop-color="#ffc23a" stop-opacity=".35"/><stop offset="1" stop-color="#ffc23a" stop-opacity="0"/></radialGradient>'+
  '<linearGradient id="rockL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4e2c20"/><stop offset=".7" stop-color="#8d5436"/><stop offset="1" stop-color="#b3704a"/></linearGradient>'+
  '<linearGradient id="rockR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#4e2c20"/><stop offset=".7" stop-color="#8d5436"/><stop offset="1" stop-color="#b3704a"/></linearGradient>'+
  '<filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3"/></filter>'+
  '</defs>';
 s+='<rect width="'+W+'" height="'+H+'" fill="#6d3b27"/>';
 s+='<rect x="'+(b.x-20)+'" y="0" width="'+(b.w+40)+'" height="'+H+'" fill="url(#floor)"/>';
 s+='<ellipse cx="'+(b.x+b.w/2)+'" cy="'+(H*.5)+'" rx="'+(b.w*.55)+'" ry="'+(H*.42)+'" fill="url(#spot)"/>';
 // strata / dirt layers on the rock walls
 [-1,1].forEach((side,idx)=>{
  const wall=rockWall(side,b,W,H,idx*17+3);
  s+='<path d="'+wall.d+'" fill="url(#'+(side<0?'rockL':'rockR')+')"/>';
  let strata='';
  for(let k=0;k<9;k++){
   const y0=20+k*(H/9)+noise(k+idx*5)*14,xw=(side<0?b.x-28:b.x+b.w+28),dir=-side;
   strata+='M'+f1(xw)+' '+f1(y0)+'q'+f1(dir*50)+' '+f1(14+noise(k)*10)+' '+f1(dir*110)+' '+f1(noise(k+3)*18-6);
  }
  s+='<path d="'+strata+'" fill="none" stroke="#5d3322" stroke-width="3" opacity=".55" stroke-linecap="round"/>';
  s+='<path d="'+strata+'" fill="none" stroke="#d58c5a" stroke-width="1.4" opacity=".35" transform="translate(0 -3)" stroke-linecap="round"/>';
  // rim light on the wall edge and a soft contact shadow on the floor
  let rim='';wall.pts.forEach((p,i)=>rim+=(i?'L':'M')+f1(p[0])+' '+f1(p[1]));
  s+='<path d="'+rim+'" fill="none" stroke="#e1a371" stroke-width="3" opacity=".6"/>';
  s+='<path d="'+rim+'" fill="none" stroke="#3a1c10" stroke-width="14" opacity=".28" filter="url(#soft)" transform="translate('+(-side*-9)+' 0)"/>';
 });
 // cracks carved in the walls
 let cracks='';
 for(let i=0;i<7;i++){
  const left=i%2===0,x=left?b.x-60-noise(i)*50:b.x+b.w+55+noise(i)*50,y=60+noise(i*4)*(H-120);
  cracks+='M'+f1(x)+' '+f1(y)+'l'+f1((left?1:-1)*14)+' 18 '+f1((left?-1:1)*8)+' 16 '+f1((left?1:-1)*12)+' 20';
 }
 s+='<path d="'+cracks+'" fill="none" stroke="#2f170d" stroke-width="3" opacity=".6" stroke-linejoin="round"/>';
 // rails: ties first, then two steel rails with highlight
 paths.forEach(path=>{
  const t=ties(path,gauge);
  s+='<path d="'+t.shadow+'" stroke="#3a1d10" stroke-width="6" opacity=".35" stroke-linecap="round"/>';
  s+='<path d="'+t.out+'" stroke="#6b3d22" stroke-width="6" stroke-linecap="round"/>';
  s+='<path d="'+t.out+'" stroke="#a96d3f" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>';
  [-1,1].forEach(side=>{
   const d=offsetLine(path,side*gauge/2);
   s+='<path d="'+d+'" fill="none" stroke="#3b2a22" stroke-width="5.2" stroke-linejoin="round" transform="translate(1.6 2.6)" opacity=".5"/>';
   s+='<path d="'+d+'" fill="none" stroke="#6d717a" stroke-width="4.2" stroke-linejoin="round"/>';
   s+='<path d="'+d+'" fill="none" stroke="#d2d6dc" stroke-width="1.5" stroke-linejoin="round" transform="translate(-.6 -.6)"/>';
  });
 });
 s+=decor(b,W,H,paths);
 s+='</svg>';
 return s;
}
function layerFG(g){
 const {W,H,b,paths,gauge}=g;
 const topY=b.y,botY=b.y+b.h,mouth=gauge+46;
 // collect the track crossings of the top and bottom band
 const gates=[];
 paths.forEach(path=>{
  const P=path.points;
  for(let i=1;i<P.length;i++){
   const a=P[i-1],c=P[i];
   if((a.y<topY&&c.y>=topY)||(a.y>=topY&&c.y<topY))gates.push({x:(a.x+c.x)/2,y:topY,dir:1});
   if((a.y<botY&&c.y>=botY)||(a.y>=botY&&c.y<botY))gates.push({x:(a.x+c.x)/2,y:botY,dir:-1});
  }
 });
 let s='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">';
 s+='<defs>'+
  '<linearGradient id="bandT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d150d"/><stop offset=".6" stop-color="#6e3d27"/><stop offset="1" stop-color="#9c5c3b"/></linearGradient>'+
  '<linearGradient id="bandB" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2d150d"/><stop offset=".6" stop-color="#6e3d27"/><stop offset="1" stop-color="#9c5c3b"/></linearGradient>'+
  '<linearGradient id="dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0604" stop-opacity=".96"/><stop offset="1" stop-color="#0d0604" stop-opacity="0"/></linearGradient>'+
  '<linearGradient id="darkB" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0d0604" stop-opacity=".96"/><stop offset="1" stop-color="#0d0604" stop-opacity="0"/></linearGradient>'+
  '<linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6a4326"/><stop offset=".5" stop-color="#a77446"/><stop offset="1" stop-color="#5a381f"/></linearGradient>'+
  '</defs>';
 const band=(y0,y1,grad)=>{
  // rock band with real holes (evenodd) at every gate so carts show through
  let d='M-20 '+y0+'L'+(W+20)+' '+y0+'L'+(W+20)+' '+y1+'L-20 '+y1+'Z';
  gates.filter(q=>grad==='bandT'?q.dir>0:q.dir<0).forEach(q=>{
   const x0=q.x-mouth/2,x1=q.x+mouth/2,yy=grad==='bandT'?y1:y0,r=mouth/2;
   const yEdge=grad==='bandT'?y1:y0,yDeep=grad==='bandT'?y0+4:y1-4;
   d+='M'+f1(x0)+' '+f1(yEdge)+'L'+f1(x0)+' '+f1(yDeep+(grad==='bandT'?r*.6:-r*.6))+
      'Q'+f1(q.x)+' '+f1(yDeep-(grad==='bandT'?r*.5:-r*.5))+' '+f1(x1)+' '+f1(yDeep+(grad==='bandT'?r*.6:-r*.6))+
      'L'+f1(x1)+' '+f1(yEdge)+'Z';
  });
  return '<path d="'+d+'" fill="url(#'+grad+')" fill-rule="evenodd"/>';
 };
 s+=band(-20,topY,'bandT');
 s+=band(botY,H+20,'bandB');
 // strata + lip highlights
 s+='<path d="M-20 '+topY+'L'+(W+20)+' '+topY+'" stroke="#e1a371" stroke-width="3" opacity=".7"/>';
 s+='<path d="M-20 '+botY+'L'+(W+20)+' '+botY+'" stroke="#e1a371" stroke-width="3" opacity=".7"/>';
 let strata='';
 for(let k=0;k<6;k++){
  const y=topY*(.2+k*.14);
  strata+='M0 '+f1(y)+'q'+f1(W*.25)+' '+(k%2?8:-8)+' '+f1(W*.5)+' 0t'+f1(W*.5)+' 0';
  const y2=botY+(H-botY)*(.2+k*.14);
  strata+='M0 '+f1(y2)+'q'+f1(W*.25)+' '+(k%2?-8:8)+' '+f1(W*.5)+' 0t'+f1(W*.5)+' 0';
 }
 s+='<path d="'+strata+'" fill="none" stroke="#3a1c10" stroke-width="3" opacity=".4"/>';
 // dark tunnel interiors, timber frames
 gates.forEach(q=>{
  const top=q.dir>0,y0=top?q.y-(topY*.82):q.y,hh=topY*.82,x0=q.x-mouth/2;
  s+='<rect x="'+f1(x0)+'" y="'+f1(top?q.y-hh:q.y)+'" width="'+mouth+'" height="'+f1(hh)+'" fill="url(#'+(top?'dark':'darkB')+')"/>';
  const edge=q.y;
  s+='<rect x="'+f1(x0-9)+'" y="'+f1(top?edge-30:edge-4)+'" width="10" height="34" rx="2" fill="url(#beam)" stroke="#2f1a0d" stroke-width="1.6"/>';
  s+='<rect x="'+f1(x0+mouth-1)+'" y="'+f1(top?edge-30:edge-4)+'" width="10" height="34" rx="2" fill="url(#beam)" stroke="#2f1a0d" stroke-width="1.6"/>';
  s+='<rect x="'+f1(x0-12)+'" y="'+f1(top?edge-4:edge-8)+'" width="'+(mouth+24)+'" height="12" rx="3" fill="url(#beam)" stroke="#2f1a0d" stroke-width="1.6"/>';
  s+='<path d="M'+f1(x0-8)+' '+f1(top?edge+2:edge-2)+'h'+(mouth+16)+'" stroke="#d3a06a" stroke-width="1.4" opacity=".6"/>';
  s+='<circle cx="'+f1(q.x)+'" cy="'+f1(top?edge-9:edge+9)+'" r="3" fill="#ffd45a" opacity=".85"/>';
 });
 s+='</svg>';
 return s;
}

/* ---------- raster cache ---------- */
function geometry(world,pathCtrls){
 const paths=pathCtrls.map(buildPath);
 return {W:world.w,H:world.h,b:world.bounds,paths,gauge:30};
}
function image(key,build){
 if(cache.has(key))return cache.get(key);
 if(typeof Image==='undefined')return null;
 const im=new Image();im.decoding='async';
 im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(build());
 cache.set(key,im);return im;
}
function preload(world,paths){
 const geo={W:world.w,H:world.h,b:world.bounds,paths,gauge:30};
 return {bg:image('bg'+world.w,()=>layerBG(geo)),fg:image('fg'+world.w,()=>layerFG(geo))};
}

/* ---------- canvas painters ---------- */
function drawBackdrop(g,world,paths,layers){
 const {w,h,bounds:b}=world;
 if(ready(layers?.bg))g.drawImage(layers.bg,0,0,w,h);
 else{
  g.fillStyle='#6d3b27';g.fillRect(0,0,w,h);
  g.fillStyle='#b87647';g.fillRect(b.x,0,b.w,h);
  g.strokeStyle='#777c84';g.lineWidth=4;
  for(const p of paths)for(const off of[-15,15]){
   g.beginPath();p.points.forEach((q,i)=>i?g.lineTo(q.x+off,q.y):g.moveTo(q.x+off,q.y));g.stroke();}
 }
}
function drawForeground(g,world,layers){
 const {w,h,bounds:b}=world;
 if(ready(layers?.fg)){g.drawImage(layers.fg,0,0,w,h);return;}
 g.fillStyle='#4a2517';g.fillRect(0,0,w,b.y);g.fillRect(0,b.y+b.h,w,h-b.y-b.h);
}
function drawCart(g,t,time,quality){
 const L=t.length,Wd=t.width,hl=L/2,hw=Wd/2;
 g.save();g.translate(t.x,t.y);g.rotate(t.heading);
 // ground shadow
 g.fillStyle='rgba(40,18,8,.32)';g.beginPath();g.roundRect?.(-hl+3,-hw+5,L,Wd,8);
 if(!g.roundRect)g.rect(-hl+3,-hw+5,L,Wd);g.fill();
 // wheels peeking out
 g.fillStyle='#262223';
 for(const sx of[-hl*.58,hl*.58])for(const sy of[-hw-2.5,hw-1.5]){g.fillRect(sx-6,sy,12,4.5);}
 // coupling bars
 g.fillStyle='#53575e';g.fillRect(hl-1,-2,7,4);g.fillRect(-hl-6,-2,7,4);
 // wooden body
 const body=g.createLinearGradient(0,-hw,0,hw);
 body.addColorStop(0,'#a8683a');body.addColorStop(.5,'#7d4a29');body.addColorStop(1,'#5b3419');
 g.fillStyle=body;g.strokeStyle='#2e170a';g.lineWidth=2.4;
 g.beginPath();if(g.roundRect)g.roundRect(-hl,-hw,L,Wd,6);else g.rect(-hl,-hw,L,Wd);g.fill();g.stroke();
 // metal bands
 g.fillStyle='#6e737b';
 for(const bx of[-hl*.62,0,hl*.62])g.fillRect(bx-2.2,-hw+.8,4.4,Wd-1.6);
 g.fillStyle='rgba(255,255,255,.28)';
 for(const bx of[-hl*.62,0,hl*.62])g.fillRect(bx-2.2,-hw+.8,1.4,Wd-1.6);
 // inner cavity
 const ix=-hl+7,iy=-hw+6,iw=L-14,ih=Wd-12;
 g.fillStyle=t.kind==='crate'?'#c9964f':'#2d1a0e';
 g.beginPath();if(g.roundRect)g.roundRect(ix,iy,iw,ih,4);else g.rect(ix,iy,iw,ih);g.fill();
 if(t.kind==='gold'){
  const glow=g.createRadialGradient(0,0,2,0,0,hl);glow.addColorStop(0,'rgba(255,214,90,.55)');glow.addColorStop(1,'rgba(255,214,90,0)');
  g.fillStyle=glow;g.fillRect(ix-4,iy-4,iw+8,ih+8);
  for(let i=0;i<14;i++){
   const nx=ix+4+noise(i*3+t.seed)*(iw-8),ny=iy+3+noise(i*7+t.seed)*(ih-6),r=3.2+noise(i+t.seed)*3;
   g.fillStyle=i%3?'#ffd447':'#ffe98a';g.strokeStyle='#a8641c';g.lineWidth=1;
   g.beginPath();g.ellipse(nx,ny,r*1.15,r,noise(i)*3,0,TAU);g.fill();g.stroke();
   g.fillStyle='rgba(255,255,255,.7)';g.beginPath();g.arc(nx-r*.3,ny-r*.35,r*.28,0,TAU);g.fill();
  }
 }else if(t.kind==='ore'){
  for(let i=0;i<12;i++){
   const nx=ix+4+noise(i*5+t.seed)*(iw-8),ny=iy+3+noise(i*2+t.seed)*(ih-6),r=3+noise(i+t.seed)*3.2;
   g.fillStyle=i%2?'#6e6a70':'#8a8590';g.strokeStyle='#2e2a30';g.lineWidth=1;
   g.beginPath();g.ellipse(nx,ny,r,r*.85,noise(i)*3,0,TAU);g.fill();g.stroke();
   if(i%5===0){g.fillStyle='#ffd447';g.beginPath();g.arc(nx+1,ny,1.6,0,TAU);g.fill();}
  }
 }else{
  g.strokeStyle='#8f6330';g.lineWidth=1.6;
  for(let k=1;k<4;k++){g.beginPath();g.moveTo(ix+iw*k/4,iy);g.lineTo(ix+iw*k/4,iy+ih);g.stroke();}
 }
 // rim highlight
 g.strokeStyle='rgba(255,226,170,.5)';g.lineWidth=1.4;
 g.beginPath();g.moveTo(-hl+6,-hw+1.2);g.lineTo(hl-6,-hw+1.2);g.stroke();
 g.restore();
}
function drawDynamite(g,p,state,time){
 // state: {ratio 0..1 of fuse left, pass:0..1 recently received}
 const dir=p.dir||{x:1,y:0},m=Math.hypot(dir.x,dir.y)||1,dx=dir.x/m,dy=dir.y/m;
 const nx=-dy,ny=dx,urgency=1-state.ratio;
 const rate=2.2+urgency*13,flash=Math.sin(time*rate*Math.PI)>0.15&&state.ratio<.55;
 const wobble=Math.sin(time*(8+urgency*30))*urgency*.5;
 const hx=p.x+nx*13+dx*5,hy=p.y+ny*13+dy*5;
 g.save();g.translate(hx,hy);g.rotate(Math.atan2(dy,dx)+Math.PI/2+wobble);
 const pop=state.pass>0?1+state.pass*.35:1;g.scale(pop,pop);
 // sticks (three tied together, kept small so the avatar stays readable)
 for(const ox of[-3.6,0,3.6]){
  g.fillStyle=flash?'#ff7a58':'#d4262a';g.strokeStyle='#5a0d10';g.lineWidth=1.3;
  g.beginPath();if(g.roundRect)g.roundRect(ox-2.5,-9.5,5,19,2);else g.rect(ox-2.5,-9.5,5,19);g.fill();g.stroke();
  g.fillStyle='rgba(255,255,255,.35)';g.fillRect(ox-1.6,-8,1.1,16);
 }
 g.fillStyle='#d8c08a';g.fillRect(-6.6,-2,13.2,3.6);
 g.strokeStyle='#6a5028';g.lineWidth=.9;g.strokeRect(-6.6,-2,13.2,3.6);
 // fuse + spark
 g.strokeStyle='#3b2c1a';g.lineWidth=1.6;g.beginPath();g.moveTo(0,-9.5);
 g.quadraticCurveTo(3,-14,-1,-17);g.stroke();
 const sparkSize=2.2+urgency*2.6+Math.sin(time*40)*.7;
 g.fillStyle='rgba(255,170,40,.95)';g.beginPath();g.arc(-1,-17,sparkSize,0,TAU);g.fill();
 g.fillStyle='#fff3b0';g.beginPath();g.arc(-1,-17,sparkSize*.5,0,TAU);g.fill();
 for(let i=0;i<4;i++){
  const a=time*9+i*1.7,r=3+((time*5+i*.37)%1)*7;
  g.fillStyle='rgba(255,'+(150+i*25)+',60,'+(1-((time*5+i*.37)%1))+')';
  g.beginPath();g.arc(-1+Math.cos(a)*r*.5,-17+Math.sin(a)*r-((time*5+i*.37)%1)*6,1.2,0,TAU);g.fill();
 }
 g.restore();
}
function drawHolderMarker(g,p,state,time){
 const urgent=state.remaining<=3;
 const bob=Math.sin(time*6)*2.2,y=p.y-34+bob;
 g.save();
 if(urgent){
  const pulse=.5+.5*Math.sin(time*18);
  g.strokeStyle='rgba(255,60,40,'+(.35+.4*pulse)+')';g.lineWidth=3;
  g.beginPath();g.arc(p.x,p.y,22+pulse*5,0,TAU);g.stroke();
 }
 g.fillStyle=urgent?'#ff3b2f':'#ff6a2a';g.strokeStyle='#4a0d08';g.lineWidth=2.2;
 g.beginPath();g.moveTo(p.x-7,y-8);g.lineTo(p.x+7,y-8);g.lineTo(p.x,y+1);g.closePath();g.fill();g.stroke();
 g.font='900 17px system-ui,sans-serif';g.textAlign='center';g.textBaseline='bottom';
 const label=Math.max(0,Math.ceil(state.remaining)).toString();
 g.lineWidth=4.5;g.strokeStyle='#3a0b06';g.strokeText(label,p.x,y-9);
 g.fillStyle=urgent?'#ffe3d8':'#fff0c8';g.fillText(label,p.x,y-9);
 g.restore();
}
function drawStun(g,p,time){
 g.save();
 for(let i=0;i<3;i++){
  const a=time*7+i*TAU/3,sx=p.x+Math.cos(a)*11,sy=p.y-19+Math.sin(a)*4;
  g.fillStyle='#ffe35a';g.strokeStyle='#8a5a00';g.lineWidth=1;g.beginPath();
  for(let k=0;k<10;k++){const r=k%2?2.3:5,ang=-Math.PI/2+k*Math.PI/5;
   g.lineTo(sx+Math.cos(ang)*r,sy+Math.sin(ang)*r*.9);}
  g.closePath();g.fill();g.stroke();
 }
 g.restore();
}
function drawBlast(g,e){
 const k=1-e.life/e.max,a=Math.max(0,e.life/e.max);
 g.save();
 const r=20+k*95;
 const grad=g.createRadialGradient(e.x,e.y,2,e.x,e.y,r);
 grad.addColorStop(0,'rgba(255,248,200,'+(.95*a)+')');grad.addColorStop(.35,'rgba(255,170,50,'+(.85*a)+')');
 grad.addColorStop(.75,'rgba(190,60,20,'+(.45*a)+')');grad.addColorStop(1,'rgba(90,30,10,0)');
 g.fillStyle=grad;g.beginPath();g.arc(e.x,e.y,r,0,TAU);g.fill();
 g.strokeStyle='rgba(255,230,160,'+(.8*a)+')';g.lineWidth=5*a+1;g.beginPath();g.arc(e.x,e.y,15+k*120,0,TAU);g.stroke();
 g.restore();
}
function drawPuff(g,e){
 const a=Math.max(0,e.life/e.max),r=e.r0+(1-a)*e.grow;
 g.save();g.globalAlpha=a*e.alpha;g.fillStyle=e.color;
 g.beginPath();g.arc(e.x,e.y,r,0,TAU);g.fill();g.restore();
}
function drawSpark(g,e){
 const a=Math.max(0,e.life/e.max);
 g.save();g.globalAlpha=a;g.fillStyle=e.color;g.beginPath();g.arc(e.x,e.y,e.r*a+.4,0,TAU);g.fill();g.restore();
}

window.DynamiteArt=Object.freeze({buildPath,pointAt,distanceToPath,preload,drawBackdrop,drawForeground,drawCart,
 drawDynamite,drawHolderMarker,drawStun,drawBlast,drawPuff,drawSpark,layerBG,layerFG,geometry});
})();
