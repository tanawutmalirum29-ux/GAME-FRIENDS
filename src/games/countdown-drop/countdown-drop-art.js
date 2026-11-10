/* COUNTDOWN DROP — art helpers. Static scenery is built as SVG and rasterised once
   (background + foreground layers); tiles, numbers, pits and effects are drawn live. */
(() => {
'use strict';
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const images=new Map();
function image(key,build){
 if(images.has(key))return images.get(key);
 if(typeof Image==='undefined')return null;
 const im=new Image();im.decoding='async';
 im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(build());
 images.set(key,im);return im;
}
const ready=im=>!!im&&im.complete&&im.naturalWidth>0;
function hash(i){let x=(i+1)*2654435761>>>0;x^=x>>>15;x=Math.imul(x,2246822519)>>>0;return(x>>>0)/4294967296;}

/* ---------- SVG scenery ---------- */
function cone(x,y,s){
 return '<g transform="translate('+x+' '+y+') scale('+s+')"><ellipse cx="0" cy="14" rx="15" ry="5" fill="#000" opacity=".3"/>'+
 '<rect x="-14" y="8" width="28" height="6" rx="2" fill="#2b2f36"/><path d="M-9 8L-3-16H3L9 8Z" fill="#ff7a1a" stroke="#5a2a08" stroke-width="1.6"/>'+
 '<path d="M-6 -2H6L7.4 3H-7.4Z" fill="#fff"/><path d="M-3.4-12H3.4L4.6-8H-4.6Z" fill="#fff"/></g>';
}
function sign(x,y,s,kind){
 const body=kind===0?'<path d="M0-22L22 14H-22Z" fill="#ffd23a" stroke="#2b2f36" stroke-width="3" stroke-linejoin="round"/><rect x="-2.6" y="-8" width="5.2" height="13" rx="2" fill="#2b2f36"/><circle cy="9.5" r="2.8" fill="#2b2f36"/>'
  :'<rect x="-24" y="-16" width="48" height="30" rx="4" fill="#ffd23a" stroke="#2b2f36" stroke-width="3"/><path d="M-22 12L-4-14H8L-10 12ZM2 12L20-14" stroke="#2b2f36" stroke-width="7" fill="none" opacity=".9"/>';
 return '<g transform="translate('+x+' '+y+') scale('+s+')"><rect x="-2.5" y="12" width="5" height="26" fill="#6b7078"/>'+body+'</g>';
}
function barrier(x,y,w,rot){
 let s='<g transform="translate('+x+' '+y+') rotate('+rot+')"><rect x="'+(-w/2)+'" y="-9" width="'+w+'" height="18" rx="3" fill="#f5f5f5" stroke="#2b2f36" stroke-width="2.4"/>';
 for(let i=-w/2+4;i<w/2-10;i+=18)s+='<path d="M'+i+' 9L'+(i+10)+' -9h8L'+(i+8)+' 9Z" fill="#e8482c"/>';
 return s+'<rect x="'+(-w/2+4)+'" y="9" width="5" height="9" fill="#444"/><rect x="'+(w/2-9)+'" y="9" width="5" height="9" fill="#444"/></g>';
}
function container(x,y,w,h,color,seed){
 let s='<g transform="translate('+x+' '+y+')"><rect width="'+w+'" height="'+h+'" rx="3" fill="'+color+'" stroke="#1f232a" stroke-width="3"/>';
 for(let i=8;i<w-6;i+=12)s+='<rect x="'+i+'" y="5" width="5" height="'+(h-10)+'" rx="2" fill="#000" opacity=".16"/>';
 s+='<rect x="0" y="0" width="'+w+'" height="7" fill="#fff" opacity=".14"/>';
 s+='<rect x="'+(w*.1)+'" y="'+(h*.38)+'" width="'+(w*.34)+'" height="'+(h*.2)+'" rx="2" fill="#fff" opacity=".78"/>';
 return s+'</g>';
}
// Decorations avoid the board rectangle (+margin) so nothing hides a tile.
function scenery(world,board){
 const W=world.w,H=world.h,u=W/960,m=26*u;
 const bx=board.x-m,by=board.y-m,bw=board.w+m*2,bh=board.h+m*2;
 const free=(x,y,r)=>!(x+r>bx&&x-r<bx+bw&&y+r>by&&y-r<by+bh);
 let s='';
 const place=(arr,fn)=>{arr.forEach((a,i)=>{if(free(a[0]*W,a[1]*H,a[2]*u))s+=fn(a,i);});};
 place([[.05,.12,26],[.95,.88,26],[.06,.86,26],[.94,.14,26],[.5,.045,24],[.5,.955,24],[.2,.06,22],[.8,.94,22],[.8,.07,22],[.2,.94,22]],(a)=>cone(a[0]*W,a[1]*H,u*1.2));
 place([[.07,.5,40],[.93,.5,40],[.11,.2,40],[.89,.8,40]],(a,i)=>sign(a[0]*W,a[1]*H,u*1.25,i%2));
 place([[.1,.72,60],[.9,.28,60],[.18,.45,50],[.82,.55,50],[.33,.05,50],[.67,.95,50]],(a,i)=>barrier(a[0]*W,a[1]*H,a[2]*u*1.2,i%2?90:0));
 const boxes=[[.0,.0,.13,.17,'#2f7fd1'],[.87,.83,.13,.17,'#d2553a'],[.0,.83,.13,.17,'#2ea36b'],[.87,.0,.13,.17,'#e2a62a']];
 for(const b of boxes){
  const x=b[0]*W,y=b[1]*H,w=b[2]*W,h=b[3]*H;
  if(free(x+w/2,y+h/2,Math.max(w,h)/2))s+=container(x,y,w,h,b[4],0);
 }
 return s;
}
function layerBG(world,board){
 const W=world.w,H=world.h;
 let s='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'"><defs>'+
 '<linearGradient id="cdf" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#5b616b"/><stop offset="1" stop-color="#3b4047"/></linearGradient>'+
 '<pattern id="cdh" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M0 0H64V64H0Z" fill="none" stroke="#000" stroke-opacity=".14" stroke-width="2"/><path d="M-4 68L68-4" stroke="#fff" stroke-opacity=".05" stroke-width="6"/></pattern>'+
 '<pattern id="cdz" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="24" height="48" fill="#ffd23a"/><rect x="24" width="24" height="48" fill="#262a30"/></pattern></defs>'+
 '<rect width="'+W+'" height="'+H+'" fill="url(#cdf)"/><rect width="'+W+'" height="'+H+'" fill="url(#cdh)"/>';
 for(let i=0;i<90;i++)s+='<circle cx="'+(hash(i)*W).toFixed(0)+'" cy="'+(hash(i+300)*H).toFixed(0)+'" r="'+(1+hash(i+600)*2.4).toFixed(1)+'" fill="#000" opacity=".12"/>';
 s+=scenery(world,board);
 // hazard-striped ring and yellow steel frame around the board
 const pad=24,fr=14;
 s+='<rect x="'+(board.x-pad-fr)+'" y="'+(board.y-pad-fr)+'" width="'+(board.w+(pad+fr)*2)+'" height="'+(board.h+(pad+fr)*2)+'" rx="10" fill="url(#cdz)" stroke="#1f232a" stroke-width="4"/>';
 s+='<rect x="'+(board.x-pad)+'" y="'+(board.y-pad)+'" width="'+(board.w+pad*2)+'" height="'+(board.h+pad*2)+'" rx="6" fill="#2a2e35"/>';
 s+='<rect x="'+(board.x-10)+'" y="'+(board.y-10)+'" width="'+(board.w+20)+'" height="'+(board.h+20)+'" rx="5" fill="#f2b820" stroke="#7a560a" stroke-width="3"/>';
 s+='<rect x="'+(board.x-4)+'" y="'+(board.y-4)+'" width="'+(board.w+8)+'" height="'+(board.h+8)+'" fill="#17191e"/>';
 for(const [cx,cy] of [[board.x-10,board.y-10],[board.x+board.w+10,board.y-10],[board.x-10,board.y+board.h+10],[board.x+board.w+10,board.y+board.h+10]])
  s+='<circle cx="'+cx+'" cy="'+cy+'" r="7" fill="#c9cdd3" stroke="#2b2f36" stroke-width="2.4"/><path d="M'+(cx-4)+' '+cy+'H'+(cx+4)+'" stroke="#2b2f36" stroke-width="2"/>';
 return s+'</svg>';
}
function layerFG(world,board){
 // thin lip over the pit edges so the board reads as raised steel
 const W=world.w,H=world.h;
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'+
 '<rect x="'+(board.x-3)+'" y="'+(board.y-3)+'" width="'+(board.w+6)+'" height="'+(board.h+6)+'" fill="none" stroke="#f2b820" stroke-width="3"/></svg>';
}
function preload(world,board){
 const k=world.w+'x'+world.h+':'+board.x+','+board.y;
 return {bg:image('bg'+k,()=>layerBG(world,board)),fg:image('fg'+k,()=>layerFG(world,board))};
}
function drawBackdrop(g,world,layers){
 if(ready(layers?.bg)){g.drawImage(layers.bg,0,0,world.w,world.h);return;}
 g.fillStyle='#4a4f58';g.fillRect(0,0,world.w,world.h);
}
function drawForeground(g,world,layers){if(ready(layers?.fg))g.drawImage(layers.fg,0,0,world.w,world.h);}

/* ---------- tiles ---------- */
const PALETTE={ // by danger level
 safe:['#3f8fd8','#2e6fb0'],warn:['#e6c42e','#b39610'],orange:['#ee8a1e','#b9600a'],red:['#e23a2e','#a1211a']
};
function level(n){return n>=5?'safe':n>=3?'warn':n===2?'orange':'red';}
const NUM_COLOR={safe:'#ffffff',warn:'#fff3a0',orange:'#fff0d8',red:'#ffffff'};
function drawTile(g,t,x,y,w,h,time,unit){
 const open=t.open; // 0 closed .. 1 fully open
 const pad=3,ix=x+pad,iy=y+pad,iw=w-pad*2,ih=h-pad*2;
 // pit below
 if(open>0){
  const gw=iw*open,gx=ix+(iw-gw)/2;
  g.save();g.beginPath();g.rect(gx,iy,gw,ih);g.clip();
  const gr=g.createRadialGradient(x+w/2,y+h/2,4,x+w/2,y+h/2,Math.max(w,h)*.62);
  gr.addColorStop(0,'#000');gr.addColorStop(.6,'#0a0a10');gr.addColorStop(1,'#241a1a');
  g.fillStyle=gr;g.fillRect(gx,iy,gw,ih);
  g.strokeStyle='rgba(255,255,255,.07)';g.lineWidth=2;
  for(let i=1;i<4;i++){g.beginPath();g.rect(x+w/2-iw*.5*(1-i*.2),y+h/2-ih*.5*(1-i*.2),iw*(1-i*.2),ih*(1-i*.2));g.stroke();}
  g.restore();
 }
 // two door plates sliding to each side
 const dw=iw/2,shift=dw*open;
 const lv=t.state==='counting'||t.open===0?level(t.display):'red';
 const [c1,c2]=PALETTE[lv];
 const drawPlate=(px,side)=>{
  if(px+dw<=ix-.5&&side<0||px>=ix+iw+.5&&side>0)return;
  g.save();g.beginPath();g.rect(ix,iy,iw,ih);g.clip();
  const gr=g.createLinearGradient(0,iy,0,iy+ih);gr.addColorStop(0,c1);gr.addColorStop(1,c2);
  g.fillStyle=gr;g.fillRect(px,iy,dw,ih);
  g.strokeStyle='rgba(0,0,0,.55)';g.lineWidth=3;g.strokeRect(px+1.5,iy+1.5,dw-3,ih-3);
  g.fillStyle='rgba(255,255,255,.16)';g.fillRect(px+3,iy+3,dw-6,5);
  // rivets
  g.fillStyle='rgba(0,0,0,.35)';
  for(const [rx,ry] of [[8,8],[dw-8,8],[8,ih-8],[dw-8,ih-8]]){g.beginPath();g.arc(px+rx,iy+ry,2.6,0,TAU);g.fill();}
  g.restore();
 };
 drawPlate(ix-shift,-1);drawPlate(ix+dw+shift,1);
 // centre seam
 if(open<.02){g.strokeStyle='rgba(0,0,0,.4)';g.lineWidth=2;g.beginPath();g.moveTo(x+w/2,iy+3);g.lineTo(x+w/2,iy+ih-3);g.stroke();}
 // danger glow / flash on the plates (kept transparent so the number stays readable)
 if(t.state==='counting'&&t.display<=2){
  const f=t.display===1?.18+.14*Math.sin(time*22):.08;
  g.fillStyle='rgba(255,40,20,'+f.toFixed(3)+')';g.fillRect(ix,iy,iw,ih);
 }
}
function drawNumber(g,t,x,y,w,h,time){
 if(t.open>.55)return; // numbers hide with the pit
 const lv=level(t.display),sz=Math.min(w,h)*.62;
 let scale=1;
 if(t.pulse>0)scale=1+.22*Math.sin(clamp(t.pulse/.25,0,1)*Math.PI);
 if(t.display===1)scale*=1+.05*Math.sin(time*22);
 g.save();g.translate(x+w/2,y+h/2+sz*.03);g.scale(scale,scale);
 g.globalAlpha=1-clamp(t.open/.55,0,1);
 g.font='900 '+sz+'px "Arial Black",Impact,system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';
 g.lineJoin='round';g.lineWidth=sz*.16;g.strokeStyle='#14161b';g.strokeText(String(t.display),0,0);
 g.fillStyle=NUM_COLOR[lv];
 if(lv==='red'&&Math.sin(time*22)>0)g.fillStyle='#ffe0dc';
 g.fillText(String(t.display),0,0);
 g.restore();
}
function drawStun(g,p,time,unit){
 g.save();g.translate(p.x,p.y-24*unit);
 for(let i=0;i<3;i++){
  const a=time*7+i*TAU/3,sx=Math.cos(a)*14*unit,sy=Math.sin(a)*4*unit;
  star(g,sx,sy,5*unit,'#ffe45a');
 }
 g.restore();
}
function star(g,x,y,r,color){
 g.save();g.translate(x,y);g.fillStyle=color;g.strokeStyle='#8a5a00';g.lineWidth=1.2;
 g.beginPath();for(let i=0;i<10;i++){const rr=i%2?r*.45:r,a=-Math.PI/2+i*Math.PI/5;g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}
 g.closePath();g.fill();g.stroke();g.restore();
}
function drawFist(g,p,prog,unit,R){
 // prog 0..1 extends the fist along p.dir
 const d=p.dir||{x:1,y:0},reach=(R*.55+R*1.25*prog)*1;
 const fx=p.x+d.x*(R+reach*.55),fy=p.y+d.y*(R+reach*.55);
 g.save();g.translate(fx,fy);
 g.fillStyle='#ffd9a0';g.strokeStyle='#5a3414';g.lineWidth=2*unit;
 g.beginPath();g.arc(0,0,7.5*unit,0,TAU);g.fill();g.stroke();
 g.restore();
}
function drawFall(g,p,k,unit){
 // k 0..1: shrinks and sinks into the pit
 g.save();g.translate(p.x,p.y+k*18*unit);
 const s=1-.8*k;g.scale(s,s);g.globalAlpha=1-k*.85;g.rotate(k*2.2);g.translate(-p.x,-p.y);
 if(window.PartyCharacters?.draw)window.PartyCharacters.draw(g,p,{time:k*3,label:false});
 else{g.fillStyle=p.color||'#eee';g.beginPath();g.arc(p.x,p.y,15*unit,0,TAU);g.fill();}
 g.restore();
}
function drawPuff(g,e){
 const k=1-e.life/e.max;g.save();g.globalAlpha=Math.max(0,(1-k)*(e.alpha??.4));g.fillStyle=e.color||'#9aa0a8';
 g.beginPath();g.arc(e.x,e.y,(e.r0||4)+(e.grow||10)*k,0,TAU);g.fill();g.restore();
}
function drawSpark(g,e){
 g.save();g.globalAlpha=Math.max(0,e.life/e.max);g.fillStyle=e.color||'#fff3a0';
 g.beginPath();g.arc(e.x,e.y,e.r||3,0,TAU);g.fill();g.restore();
}
function drawRing(g,e){
 const k=1-e.life/e.max;g.save();g.globalAlpha=Math.max(0,1-k);g.strokeStyle=e.color||'#fff';g.lineWidth=3;
 g.beginPath();g.arc(e.x,e.y,(e.r0||6)+(e.grow||26)*k,0,TAU);g.stroke();g.restore();
}
function release(){images.clear();}
window.CountdownDropArt=Object.freeze({release,preload,drawBackdrop,drawForeground,drawTile,drawNumber,drawStun,drawFist,drawFall,drawPuff,drawSpark,drawRing,level});
})();
