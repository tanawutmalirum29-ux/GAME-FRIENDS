/* CANDY CHAOS art: SVG candy-land scenery (rendered once to an Image per arena size)
   plus cheap canvas drawing for candies, bombs, warning rings and stun stars. */
import {C,TAU} from './config.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const f1=n=>Math.round(n*10)/10;
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/* ------------------------------ SVG scenery ------------------------------ */
function spiral(cx,cy,r,turns,steps){
 let d='';
 for(let i=0;i<=steps;i++){
  const t=i/steps,a=t*turns*TAU,rr=r*t;
  d+=(i?'L':'M')+f1(cx+Math.cos(a)*rr)+' '+f1(cy+Math.sin(a)*rr);
 }
 return d;
}
function lollipop(cx,cy,r,c1,c2){
 const sh=r*2.6;
 return '<rect x="'+f1(cx-r*.09)+'" y="'+f1(cy)+'" width="'+f1(r*.18)+'" height="'+f1(sh)+'" rx="'+f1(r*.09)+'" fill="url(#cane)" stroke="#6a2f8f" stroke-width="2"/>'+
 '<ellipse cx="'+f1(cx+r*.15)+'" cy="'+f1(cy+r*.2)+'" rx="'+f1(r*1.02)+'" ry="'+f1(r*.95)+'" fill="#4a1d6b" opacity=".25"/>'+
 '<circle cx="'+f1(cx)+'" cy="'+f1(cy)+'" r="'+f1(r)+'" fill="'+c1+'" stroke="#6a2f8f" stroke-width="3"/>'+
 '<path d="'+spiral(cx,cy,r*.86,3.2,56)+'" fill="none" stroke="'+c2+'" stroke-width="'+f1(r*.2)+'" stroke-linecap="round" stroke-linejoin="round"/>'+
 '<ellipse cx="'+f1(cx-r*.38)+'" cy="'+f1(cy-r*.45)+'" rx="'+f1(r*.22)+'" ry="'+f1(r*.12)+'" fill="#fff" opacity=".75" transform="rotate(-35 '+f1(cx-r*.38)+' '+f1(cy-r*.45)+')"/>';
}
function cane(x,y,h,hook,flip){
 const sx=flip?-1:1;
 const d='M'+f1(x)+' '+f1(y)+'V'+f1(y-h)+'a'+f1(hook)+' '+f1(hook)+' 0 0 '+(flip?0:1)+' '+f1(hook*2*sx)+' 0';
 return '<path d="'+d+'" fill="none" stroke="#6a2f8f" stroke-width="17" stroke-linecap="round"/>'+
 '<path d="'+d+'" fill="none" stroke="url(#cane)" stroke-width="12" stroke-linecap="round"/>';
}
function mound(x,y,w,h,c1,c2,seed){
 const rnd=mulberry(seed);
 let s='<path d="M'+f1(x-w/2)+' '+f1(y)+'Q'+f1(x-w*.38)+' '+f1(y-h*1.5)+' '+f1(x)+' '+f1(y-h*1.3)+'Q'+f1(x+w*.38)+' '+f1(y-h*1.5)+' '+f1(x+w/2)+' '+f1(y)+'Z" fill="'+c1+'" stroke="#6a2f8f" stroke-width="3"/>';
 // frosting drips
 s+='<path d="M'+f1(x-w*.3)+' '+f1(y-h*.82)+'Q'+f1(x)+' '+f1(y-h*1.55)+' '+f1(x+w*.3)+' '+f1(y-h*.82)+'q'+f1(-w*.05)+' '+f1(h*.28)+' '+f1(-w*.1)+' 0q'+f1(-w*.04)+' '+f1(h*.4)+' '+f1(-w*.1)+' 0q'+f1(-w*.05)+' '+f1(h*.25)+' '+f1(-w*.1)+' 0q'+f1(-w*.04)+' '+f1(h*.35)+' '+f1(-w*.12)+' 0Z" fill="'+c2+'" stroke="#6a2f8f" stroke-width="2"/>';
 s+='<circle cx="'+f1(x)+'" cy="'+f1(y-h*1.36)+'" r="'+f1(w*.07)+'" fill="#ff3b6b" stroke="#6a2f8f" stroke-width="2"/>';
 for(let i=0;i<7;i++){
  const sx=x+(rnd()-.5)*w*.6,sy=y-h*(.15+rnd()*.5);
  s+='<rect x="'+f1(sx)+'" y="'+f1(sy)+'" width="9" height="3.4" rx="1.7" fill="'+['#fff','#ffe14a','#5ad7ff','#ff6ab5'][i%4]+'" transform="rotate('+f1(rnd()*180)+' '+f1(sx)+' '+f1(sy)+')"/>';
 }
 return s;
}
function jelly(x,y,sc,seed){
 const rnd=mulberry(seed),cols=['#ff5fa2','#57d6ff','#ffd23a','#7ee05a','#b27cff'];
 let s='';
 for(let i=0;i<6;i++){
  const jx=x+(rnd()-.5)*34*sc,jy=y+(rnd()-.5)*18*sc,r=(7+rnd()*5)*sc,c=cols[(i+seed)%5];
  s+='<ellipse cx="'+f1(jx)+'" cy="'+f1(jy)+'" rx="'+f1(r*1.15)+'" ry="'+f1(r)+'" fill="'+c+'" stroke="#6a2f8f" stroke-width="2"/>'+
   '<ellipse cx="'+f1(jx-r*.3)+'" cy="'+f1(jy-r*.35)+'" rx="'+f1(r*.35)+'" ry="'+f1(r*.2)+'" fill="#fff" opacity=".8"/>';
 }
 return s;
}
export function buildScene(world){
 const w=world.w,h=world.h,b=world.bounds,rnd=mulberry(w*7+3);
 const lmx=b.x/2,rmx=b.x+b.w+(w-b.x-b.w)/2,lr=Math.min(34,b.x*.27);
 let back='',front='';
 const defs='<defs>'+
  '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9a4ff"/><stop offset="1" stop-color="#ffb6dc"/></linearGradient>'+
  '<pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="6" cy="7" r="2.2" fill="#fff" opacity=".35"/><circle cx="19" cy="19" r="1.6" fill="#fff" opacity=".3"/></pattern>'+
  '<pattern id="tile" width="112" height="112" patternUnits="userSpaceOnUse" x="'+b.x+'" y="'+b.y+'">'+
  '<rect width="56" height="56" fill="#ffd9ec"/><rect x="56" width="56" height="56" fill="#d9efff"/>'+
  '<rect y="56" width="56" height="56" fill="#fff0d2"/><rect x="56" y="56" width="56" height="56" fill="#e6dcff"/></pattern>'+
  '<pattern id="cane" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="18" fill="#fff"/><rect x="9" width="9" height="18" fill="#ff4f7a"/></pattern>'+
  '<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#8a5bd0" stop-opacity=".28"/></radialGradient>'+
  '<radialGradient id="ball" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#ffe3f1"/><stop offset="1" stop-color="#ff9cc9"/></radialGradient>'+
  '</defs>';
 front=defs;
 back+=defs+'<rect width="'+w+'" height="'+h+'" fill="url(#sky)"/><rect width="'+w+'" height="'+h+'" fill="url(#dots)"/>';
 // cotton-candy clouds
 for(const [cx,cy,rx] of[[w*.12,h*.1,70],[w*.88,h*.92,80],[w*.9,h*.08,56],[w*.1,h*.93,60]])
  back+='<ellipse cx="'+f1(cx)+'" cy="'+f1(cy)+'" rx="'+rx+'" ry="'+f1(rx*.38)+'" fill="#fff" opacity=".45"/>';
 // sweet mountains + jelly piles + canes in the margins
 back+=mound(lmx,b.y+b.h*.96,b.x*.86,b.y+56,'#ffb74d','#fff5e6',11);
 back+=mound(rmx,b.y+b.h*.9,(w-b.x-b.w)*.8,b.y+48,'#7ad7ff','#fff5e6',23);
 back+=jelly(lmx,b.y+b.h*.5,1.1,4)+jelly(rmx,b.y+b.h*.46,1.1,9);
 back+=cane(lmx+lr*1.0,b.y+b.h*.84,48,13,false)+cane(rmx-lr*1.2,b.y+b.h*.82,44,12,true);
 back+=jelly(w*.5,h-b.y*.45,.8,15)+jelly(w*.32,b.y*.45,.7,19)+jelly(w*.7,b.y*.42,.7,29);
 // arena floor
 back+='<rect x="'+(b.x-6)+'" y="'+(b.y-6)+'" width="'+(b.w+12)+'" height="'+(b.h+12)+'" rx="22" fill="#6a2f8f" opacity=".35"/>';
 back+='<rect x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" rx="16" fill="url(#tile)"/>';
 for(const [fx,fy,fr,col] of[[.22,.3,.17,'#ff7ab8'],[.76,.68,.2,'#4fb8ff'],[.5,.5,.13,'#b27cff'],[.84,.22,.1,'#ffb74d'],[.16,.78,.11,'#7ee05a']]){
  const cx=b.x+b.w*fx,cy=b.y+b.h*fy,r=b.h*fr;
  back+='<path d="'+spiral(cx,cy,r,2.6,44)+'" fill="none" stroke="'+col+'" stroke-width="'+f1(r*.14)+'" stroke-linecap="round" opacity=".2"/>';
 }
 // sugar crystals + sprinkles
 const cols=['#ff4f9a','#35c6ff','#ffd23a','#7ee05a','#a66bff','#ff8a3a'];
 for(let i=0;i<Math.round(b.w*b.h/4200);i++){
  const x=b.x+14+rnd()*(b.w-28),y=b.y+14+rnd()*(b.h-28);
  if(i%3===0)back+='<circle cx="'+f1(x)+'" cy="'+f1(y)+'" r="'+f1(1.2+rnd()*1.6)+'" fill="#fff" opacity=".85"/>';
  else back+='<rect x="'+f1(x)+'" y="'+f1(y)+'" width="8" height="3" rx="1.5" fill="'+cols[i%6]+'" opacity=".75" transform="rotate('+f1(rnd()*180)+' '+f1(x)+' '+f1(y)+')"/>';
 }
 back+='<rect x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" rx="16" fill="url(#vig)"/>';
 // candy-cane rim with gumdrops
 back+='<rect x="'+(b.x-9)+'" y="'+(b.y-9)+'" width="'+(b.w+18)+'" height="'+(b.h+18)+'" rx="22" fill="none" stroke="#6a2f8f" stroke-width="21"/>';
 back+='<rect x="'+(b.x-9)+'" y="'+(b.y-9)+'" width="'+(b.w+18)+'" height="'+(b.h+18)+'" rx="22" fill="none" stroke="url(#cane)" stroke-width="15"/>';
 let bead=0;
 const drop=(x,y)=>{back+='<circle cx="'+f1(x)+'" cy="'+f1(y)+'" r="8" fill="'+cols[bead++%6]+'" stroke="#6a2f8f" stroke-width="2"/><circle cx="'+f1(x-2.5)+'" cy="'+f1(y-2.8)+'" r="2.2" fill="#fff" opacity=".85"/>';};
 for(let x=b.x+34;x<b.x+b.w-20;x+=46){drop(x,b.y-9);drop(x,b.y+b.h+9);}
 for(let y=b.y+34;y<b.y+b.h-20;y+=46){drop(b.x-9,y);drop(b.x+b.w+9,y);}
 for(const [x,y] of[[b.x-9,b.y-9],[b.x+b.w+9,b.y-9],[b.x-9,b.y+b.h+9],[b.x+b.w+9,b.y+b.h+9]])
  back+='<circle cx="'+x+'" cy="'+y+'" r="19" fill="url(#ball)" stroke="#6a2f8f" stroke-width="3"/><ellipse cx="'+(x-6)+'" cy="'+(y-7)+'" rx="5" ry="3" fill="#fff" opacity=".9"/>';
 // big lollipop trees stand in front of the scenery (outside the playfield)
 front+=lollipop(lmx,b.y+b.h*.2,lr,'#ff5fa2','#fff')+lollipop(lmx+4,b.y+b.h*.64,lr*.8,'#57d6ff','#fff');
 front+=lollipop(rmx,b.y+b.h*.24,lr*.9,'#ffd23a','#ff7a3a')+lollipop(rmx-4,b.y+b.h*.7,lr,'#b27cff','#fff');
 const open='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">';
 return{back:open+back+'</svg>',front:open+front+'</svg>'};
}

/* ------------------------------ image cache ------------------------------ */
const cache=Object.create(null);
function toImage(svg){
 if(typeof Image==='undefined')return null;
 const img=new Image();
 img.decoding='async';
 img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
 return img;
}
export function preload(world){
 const c=cache[world.key]||(cache[world.key]=(()=>{const sc=buildScene(world);return{back:toImage(sc.back),front:toImage(sc.front)};})());
 return c;
}
export function releaseLayers(){for(const k of Object.keys(cache))delete cache[k];}
const ready=i=>!!i&&i.complete&&i.naturalWidth>0;
export function drawBackdrop(g,world,layers){
 if(ready(layers?.back))g.drawImage(layers.back,0,0,world.w,world.h);
 else{
  g.fillStyle='#d9b8ff';g.fillRect(0,0,world.w,world.h);
  const b=world.bounds;g.fillStyle='#ffe3f1';g.fillRect(b.x,b.y,b.w,b.h);
  g.strokeStyle='#ff4f7a';g.lineWidth=12;g.strokeRect(b.x,b.y,b.w,b.h);
 }
}
export function drawForeground(g,world,layers){
 if(ready(layers?.front))g.drawImage(layers.front,0,0,world.w,world.h);
}

/* ------------------------------ canvas sprites ------------------------------ */
const PAL=[['#ff4f9a','#ffd1e6'],['#35c6ff','#d6f4ff'],['#ffd23a','#fff3b0'],['#6fdc4a','#e3ffd0'],['#a66bff','#eadcff'],['#ff8a3a','#ffe1c2']];
const OUT='#4a1d6b';
function easeBack(t){const c=1.70158;t=clamp(t,0,1);return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);}
function capsule(g,w,h){
 const r=h/2;
 g.beginPath();g.moveTo(-w/2+r,-r);g.lineTo(w/2-r,-r);g.arc(w/2-r,0,r,-Math.PI/2,Math.PI/2);
 g.lineTo(-w/2+r,r);g.arc(-w/2+r,0,r,Math.PI/2,Math.PI*1.5);g.closePath();
}
export function drawCandy(g,c,t){
 const pop=easeBack((t-c.born)/.28),sc=c.born<0?1:Math.max(.05,pop);
 const bob=Math.sin(t*4+c.ph)*2.4,tilt=Math.sin(t*2.3+c.ph)*.28;
 const [base,light]=PAL[c.color%PAL.length];
 g.save();
 g.globalAlpha=.28;g.fillStyle='#4a1d6b';
 g.beginPath();g.ellipse(c.x,c.y+9,9*sc,3.5*sc,0,0,TAU);g.fill();
 g.globalAlpha=1;
 g.translate(c.x,c.y-4+bob);g.rotate(tilt);g.scale(sc,sc);
 // white halo so candies stay readable on every floor colour
 g.fillStyle='rgba(255,255,255,.55)';g.beginPath();g.arc(0,0,15,0,TAU);g.fill();
 g.lineWidth=2.2;g.strokeStyle=OUT;g.lineJoin='round';
 switch(c.kind){
  case 0:
   g.fillStyle=base;g.beginPath();g.arc(0,0,10,0,TAU);g.fill();g.stroke();
   break;
  case 1:
   g.fillStyle=light;
   g.beginPath();g.moveTo(-7,0);g.lineTo(-15,-6);g.lineTo(-15,6);g.closePath();g.fill();g.stroke();
   g.beginPath();g.moveTo(7,0);g.lineTo(15,-6);g.lineTo(15,6);g.closePath();g.fill();g.stroke();
   g.fillStyle=base;g.beginPath();g.ellipse(0,0,9,7.5,0,0,TAU);g.fill();g.stroke();
   break;
  case 2:{
   g.fillStyle=light;g.beginPath();g.arc(0,0,11,0,TAU);g.fill();
   g.save();g.beginPath();g.arc(0,0,11,0,TAU);g.clip();
   g.strokeStyle=base;g.lineWidth=3.4;g.lineCap='round';g.beginPath();
   for(let i=0;i<=40;i++){const a=i/40*TAU*2.4,r=i/40*10;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?g.lineTo(x,y):g.moveTo(x,y);}
   g.stroke();g.restore();
   g.lineWidth=2.2;g.strokeStyle=OUT;g.beginPath();g.arc(0,0,11,0,TAU);g.stroke();
   break;}
  case 3:
   g.fillStyle=base;g.beginPath();
   for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?5.6:12.5;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?g.lineTo(x,y):g.moveTo(x,y);}
   g.closePath();g.fill();g.stroke();
   break;
  default:
   g.rotate(-.6);
   capsule(g,26,14);g.fillStyle=light;g.fill();
   g.save();capsule(g,26,14);g.clip();g.fillStyle=base;
   for(let x=-16;x<16;x+=8){g.beginPath();g.moveTo(x,-8);g.lineTo(x+4,-8);g.lineTo(x+1,8);g.lineTo(x-3,8);g.closePath();g.fill();}
   g.restore();capsule(g,26,14);g.stroke();
   g.rotate(.6);
 }
 g.fillStyle='rgba(255,255,255,.9)';g.beginPath();g.ellipse(-3.5,-4,3,1.8,-.6,0,TAU);g.fill();
 g.restore();
}
export function drawWarn(g,b,t){
 const k=clamp(b.t/C.warnTime,0,1),R=C.warnDraw,pulse=.5+.5*Math.sin(t*28);
 g.save();g.translate(b.x,b.y);
 g.fillStyle='rgba(255,40,50,'+(.1+.3*k)+')';g.beginPath();g.arc(0,0,R,0,TAU);g.fill();
 g.fillStyle='rgba(255,40,50,'+(.25+.4*k)+')';g.beginPath();g.arc(0,0,R*k,0,TAU);g.fill();
 g.lineWidth=3;g.strokeStyle='rgba(255,70,70,'+(.5+.4*pulse)+')';g.setLineDash([7,5]);
 g.lineDashOffset=-t*30;g.beginPath();g.arc(0,0,R,0,TAU);g.stroke();
 g.setLineDash([]);
 g.fillStyle='rgba(255,255,255,'+(.55+.4*pulse)+')';g.font='900 18px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';
 g.fillText('!',0,1);
 g.restore();
}
export function drawBomb(g,b,t){
 const appear=easeBack(b.age/.22),sc=Math.max(.05,appear)*(1+Math.sin(t*10+b.id)*.04);
 const blink=b.life<C.bombFade&&Math.floor(t*14)%2===0;
 g.save();
 if(blink)g.globalAlpha=.35;
 g.fillStyle='rgba(40,12,70,.3)';g.beginPath();g.ellipse(b.x,b.y+11,12*sc,4*sc,0,0,TAU);g.fill();
 g.translate(b.x,b.y-2);g.scale(sc,sc);
 // fuse
 g.strokeStyle='#8a5a2b';g.lineWidth=3.2;g.lineCap='round';
 g.beginPath();g.moveTo(3,-11);g.quadraticCurveTo(9,-18,4,-22);g.stroke();
 // body
 const gr=g.createRadialGradient(-4,-5,2,0,0,15);gr.addColorStop(0,'#59608e');gr.addColorStop(1,'#14172f');
 g.fillStyle=gr;g.strokeStyle='#07071a';g.lineWidth=2.4;
 g.beginPath();g.arc(0,0,13,0,TAU);g.fill();g.stroke();
 // skull
 g.fillStyle='#fff';g.beginPath();g.arc(0,-1,6,0,TAU);g.fill();
 g.fillRect(-3,3,6,4);
 g.fillStyle='#14172f';g.beginPath();g.arc(-2.4,-1.4,1.6,0,TAU);g.arc(2.4,-1.4,1.6,0,TAU);g.fill();
 g.fillRect(-.5,1,1,1.8);
 g.fillStyle='rgba(255,255,255,.5)';g.beginPath();g.ellipse(-6,-8,3.2,1.8,-.7,0,TAU);g.fill();
 // lit spark
 const fl=.6+.4*Math.sin(t*40+b.id);
 g.fillStyle='#ffb43a';g.beginPath();g.arc(4,-22,4*fl+1.5,0,TAU);g.fill();
 g.fillStyle='#fff3a8';g.beginPath();g.arc(4,-22,2*fl+.6,0,TAU);g.fill();
 g.restore();
}
export function drawStars(g,p,t){
 g.save();g.translate(p.x,p.y-C.radius-14);
 for(let i=0;i<3;i++){
  const a=t*7+i*TAU/3,x=Math.cos(a)*16,y=Math.sin(a)*5;
  g.save();g.translate(x,y);g.rotate(t*6+i);g.fillStyle='#ffe14a';g.strokeStyle='#8a5a00';g.lineWidth=1.4;
  g.beginPath();
  for(let k=0;k<10;k++){const aa=-Math.PI/2+k*Math.PI/5,r=k%2?2.8:6.4;const px=Math.cos(aa)*r,py=Math.sin(aa)*r;k?g.lineTo(px,py):g.moveTo(px,py);}
  g.closePath();g.fill();g.stroke();g.restore();
 }
 g.restore();
}
