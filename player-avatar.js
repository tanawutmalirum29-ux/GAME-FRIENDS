/* Shared SVG avatar for every human player in GAME-FRIENDS.
   Role-specific supernatural NPC / ghost skins can still use themed art. */
(() => {
'use strict';
const TAU=Math.PI*2;
const cache=new Map();
const safeColor=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:'#8bd9ec';
function svgFor(color,pose='idle'){
 const body=safeColor(color);
 const holding=pose==='hold',attacking=pose==='attack';
 const arms=holding?'<path d="M21 39 11 29 15 22M43 39 53 29 49 22"/>':
   attacking?'<path d="M21 38 7 32 4 23M43 38 56 34"/>':
   '<path d="M22 40 13 49M42 40 51 49"/>';
 return '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="74" viewBox="0 0 64 74">'+
  '<ellipse cx="32" cy="61" rx="21" ry="7" fill="#061521" opacity=".28"/>'+
  '<g stroke="#11253a" stroke-width="6" stroke-linecap="round" fill="none">'+
  '<path d="M25 44 23 62M39 44 41 62"/>'+arms+'</g>'+
  '<circle cx="32" cy="36" r="19" fill="'+body+'" stroke="#11243b" stroke-width="3.5"/>'+
  '<ellipse cx="25" cy="30" rx="3.4" ry="3.8" fill="#fff"/>'+
  '<ellipse cx="39" cy="30" rx="3.4" ry="3.8" fill="#fff"/>'+
  '<path d="M24 47 Q32 52 40 47" fill="none" stroke="#122b40" stroke-width="1.5" opacity=".24"/>'+
  '</svg>';
}
function imageFor(color,pose='idle'){
 const key=safeColor(color)+'/'+pose;
 if(cache.has(key))return cache.get(key);
 if(typeof Image==='undefined')return null;
 const img=new Image();
 img.decoding='async';
 img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgFor(color,pose));
 cache.set(key,img);return img;
}
function drawFallback(ctx,color,pose){
 ctx.strokeStyle='#11253a';ctx.lineWidth=5;ctx.lineCap='round';
 ctx.beginPath();ctx.moveTo(-7,7);ctx.lineTo(-9,23);
 ctx.moveTo(7,7);ctx.lineTo(9,23);
 ctx.moveTo(-11,2);ctx.lineTo(-19,12);ctx.moveTo(11,2);ctx.lineTo(19,12);ctx.stroke();
 ctx.fillStyle=safeColor(color);ctx.strokeStyle='#11243b';ctx.lineWidth=3;
 ctx.beginPath();ctx.arc(0,0,18,0,TAU);ctx.fill();ctx.stroke();
 ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-7,-5,3.2,0,TAU);
 ctx.arc(7,-5,3.2,0,TAU);ctx.fill();
}
function draw(ctx,p,opts={}){
 const x=opts.local?0:(p.x||0),y=opts.local?0:(p.y||0);
 const speed=Math.hypot(p.vx||0,p.vy||0),t=opts.time||0;
 const stride=speed>15?Math.abs(Math.sin(t*11))*1.3:0;
 const footLift=opts.footAnchor?20:0; // Align SVG feet with logical p.x,p.y.
 const pose=opts.holding?'hold':opts.attacking?'attack':'idle';
 const color=opts.color||p.color;
 ctx.save();ctx.translate(x,y-stride-footLift);
 ctx.globalAlpha*=opts.alpha===undefined?1:opts.alpha;
 const scale=opts.scale===undefined?1:opts.scale;ctx.scale(scale,scale);
 ctx.fillStyle='#06142266';ctx.beginPath();ctx.ellipse(1,15,16,5,0,0,TAU);ctx.fill();
 const img=imageFor(color,pose);
 if(img&&img.complete&&img.naturalWidth)ctx.drawImage(img,-27,-32,54,62);
 else drawFallback(ctx,color,pose);
 if(opts.label!==false){
   ctx.font='bold 12px sans-serif';ctx.textAlign='center';
   ctx.lineWidth=3;ctx.strokeStyle='#061627';ctx.strokeText(p.name||'',0,-34);
   ctx.fillStyle='#fff';ctx.fillText(p.name||'',0,-34);
 }
 ctx.restore();
}
window.PartyPlayerAvatar=Object.freeze({draw,imageFor,svgFor});
})();