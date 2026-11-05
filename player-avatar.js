/* Shared top-down SVG avatar for every playable human in GAME-FRIENDS.
   The visual center and collision/footprint center are always p.x, p.y. */
(() => {
'use strict';
const TAU=Math.PI*2,cache=new Map();
const safeColor=v=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v):'#8bd9ec';
const poseKey=v=>['idle','walk','hold','attack'].includes(v)?v:'idle';
function svgFor(color,pose='idle'){
 const body=safeColor(color),action=poseKey(pose);
 const left=action==='hold'?[19,16]:action==='attack'?[18,27]:[16,34];
 const right=action==='hold'?[45,16]:action==='attack'?[45,10]:[48,34];
 const shoes=action==='walk'?'<ellipse cx="24" cy="50" rx="5" ry="8"/><ellipse cx="41" cy="46" rx="5" ry="8"/>':
   '<ellipse cx="25" cy="49" rx="5" ry="7"/><ellipse cx="39" cy="49" rx="5" ry="7"/>';
 return '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" data-view="top-down" data-pose="'+action+'">'+
  '<g stroke="#12243b" stroke-width="2.7" stroke-linejoin="round">'+
  '<g fill="#213b50">'+shoes+'</g>'+
  '<ellipse cx="32" cy="35" rx="18" ry="16" fill="'+body+'"/>'+
  '<path d="M24 35 Q19 33 '+left[0]+' '+left[1]+' M40 35 Q45 33 '+right[0]+' '+right[1]+'" fill="none" stroke="'+body+'" stroke-width="8" stroke-linecap="round"/>'+
  '<circle cx="'+left[0]+'" cy="'+left[1]+'" r="5" fill="'+body+'"/>'+
  '<circle cx="'+right[0]+'" cy="'+right[1]+'" r="5" fill="'+body+'"/>'+
  '<circle cx="32" cy="27" r="14" fill="'+body+'"/>'+
  '<path d="M23 23 Q30 14 39 22" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity=".62" fill="none"/>'+
  '<ellipse cx="32" cy="27" rx="10" ry="11" fill="#ffffff" opacity=".08" stroke="none"/>'+
  '</g></svg>';
}
function imageFor(color,pose='idle'){
 const key=safeColor(color)+'/'+poseKey(pose);
 if(cache.has(key))return cache.get(key);
 if(typeof Image==='undefined')return null;
 const img=new Image();img.decoding='async';
 img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgFor(color,pose));
 cache.set(key,img);return img;
}
function drawFallback(ctx,color){
 ctx.lineWidth=2.5;ctx.strokeStyle='#12243b';
 ctx.fillStyle='#203a50';
 for(const sx of [-8,8]){
   ctx.beginPath();ctx.ellipse(sx,14,4.5,6,0,0,TAU);ctx.fill();ctx.stroke();
 }
 ctx.fillStyle=safeColor(color);ctx.beginPath();ctx.ellipse(0,3,17,15,0,0,TAU);ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.arc(-16,2,5,0,TAU);ctx.arc(16,2,5,0,TAU);ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.arc(0,-5,13,0,TAU);ctx.fill();ctx.stroke();
 ctx.strokeStyle='#ffffff99';ctx.lineWidth=2.5;ctx.beginPath();
 ctx.arc(-2,-8,8,Math.PI*1.16,Math.PI*1.85);ctx.stroke();
}
function heading(p){
 const d=p.dir||{x:0,y:-1},x=Number(d.x),y=Number(d.y);
 if(!Number.isFinite(x)||!Number.isFinite(y)||Math.hypot(x,y)<.001)return 0;
 return Math.atan2(y,x)+Math.PI/2;
}
function draw(ctx,p,opts={}){
 const x=opts.local?0:(p.x||0),y=opts.local?0:(p.y||0),t=opts.time||0;
 const moving=Math.hypot(p.vx||0,p.vy||0)>15;
 const pose=opts.holding?'hold':opts.attacking?'attack':moving&&Math.sin(t*12)>0?'walk':'idle';
 const color=opts.color||p.color,scale=opts.scale===undefined?1:opts.scale;
 ctx.save();ctx.translate(x,y);
 ctx.globalAlpha=(typeof ctx.globalAlpha==='number'?ctx.globalAlpha:1)*
   (opts.alpha===undefined?1:opts.alpha);
 ctx.scale(scale,scale);
 // Ground shadow is concentric with the physics contact origin.
 ctx.fillStyle='#06142270';ctx.beginPath();ctx.ellipse(0,0,17,14,0,0,TAU);ctx.fill();
 ctx.save();ctx.rotate(heading(p));
 const img=imageFor(color,pose);
 if(img&&img.complete&&img.naturalWidth)ctx.drawImage(img,-26,-26,52,52);
 else drawFallback(ctx,color);
 ctx.restore();ctx.restore();
 if(opts.label!==false){
   // Text remains horizontal when the player rotates.
   ctx.save();ctx.font='bold 12px sans-serif';ctx.textAlign='center';
   ctx.lineWidth=3;ctx.strokeStyle='#061627';ctx.strokeText(p.name||'',x,y-30);
   ctx.fillStyle='#fff';ctx.fillText(p.name||'',x,y-30);ctx.restore();
 }
}
window.PartyPlayerAvatar=Object.freeze({draw,imageFor,svgFor,heading});
})();
