/* Canonical GAME-FRIENDS unmasked-color superhero avatar.
   One shared identity, two real camera projections, no decorative hats.
   Art is independent of physics radius and retains the 52px world sprite. */
(() => {
'use strict';
const TAU=Math.PI*2,cache=new Map();
const COSTUMES=Object.freeze(['standard']);
const POSES=Object.freeze(['idle','walk','walk2','hold','attack']);
const safeColor=value=>/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):'#8bd9ec';
const poseKey=v=>POSES.includes(v)?v:'idle';
// Legacy callers may supply a costume; it is deliberately ignored everywhere.
const costumeFor=()=> 'standard';
function svgForFront(color){
 const body=safeColor(color);
 return '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" data-view="front" data-costume="standard">'+
 '<defs><radialGradient id="head" cx="29%" cy="17%" r="90%"><stop stop-color="#ffffff" stop-opacity=".18"/><stop offset=".35" stop-color="'+body+'"/><stop offset="1" stop-color="'+body+'"/></radialGradient>'+
 '<linearGradient id="torso" x1="0" x2="1" y2="1"><stop stop-color="'+body+'"/><stop offset="1" stop-color="#17233e" stop-opacity=".36"/></linearGradient></defs>'+
 '<path d="M9 96 Q10 70 30 64 L66 64 Q86 70 87 96Z" fill="url(#torso)"/>'+
 '<circle cx="48" cy="43" r="36" fill="url(#head)" stroke="#18223c" stroke-opacity=".24" stroke-width="1.4"/>'+
 '<path d="M15 41 Q24 41 30 48 Q37 54 43 55 Q42 64 35 64 Q24 64 15 52Z" fill="#151b2f" stroke="#151b2f" stroke-width="2.3"/>'+
 '<path d="M81 41 Q72 41 66 48 Q59 54 53 55 Q54 64 61 64 Q72 64 81 52Z" fill="#151b2f" stroke="#151b2f" stroke-width="2.3"/>'+
 '<path d="M19 42 Q31 43 41 55 Q39 60 35 60 Q27 60 19 49Z" fill="#fff" stroke="#141c30" stroke-width="2.2" stroke-linejoin="round"/>'+
 '<path d="M77 42 Q65 43 55 55 Q57 60 61 60 Q69 60 77 49Z" fill="#fff" stroke="#141c30" stroke-width="2.2" stroke-linejoin="round"/>'+
 '</svg>';
}
function svgFor(color,pose='idle'){
 const body=safeColor(color),action=poseKey(pose),stride=action==='walk'?3:action==='walk2'?-3:0;
 const left=action==='hold'?[15,20]:action==='attack'?[13,29]:[15,37+stride];
 const right=action==='hold'?[49,20]:action==='attack'?[49,12]:[49,37-stride];
 return '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" data-view="top-down" data-pose="'+action+'" data-costume="standard">'+
 '<defs><radialGradient id="head" cx="30%" cy="18%" r="75%"><stop stop-color="#fff" stop-opacity=".29"/><stop offset=".35" stop-color="'+body+'"/><stop offset="1" stop-color="'+body+'"/></radialGradient></defs>'+
 '<ellipse cx="32" cy="43" rx="17" ry="15" fill="'+body+'" stroke="#142039" stroke-opacity=".22" stroke-width="1.2"/>'+
 '<path d="M19 38 L'+left.join(' ')+' M45 38 L'+right.join(' ')+'" stroke="'+body+'" stroke-width="9" stroke-linecap="round"/>'+
 '<circle cx="'+left[0]+'" cy="'+left[1]+'" r="5" fill="'+body+'"/><circle cx="'+right[0]+'" cy="'+right[1]+'" r="5" fill="'+body+'"/>'+
 '<circle cx="32" cy="27" r="21" fill="url(#head)" stroke="#142039" stroke-opacity=".3" stroke-width="1.4"/>'+
 // The shallow arcs are on the FORWARD rim, not a flat front-view face.
 '<path d="M17 25 Q22 24 29 30 L28 32 Q23 33 17 28Z" fill="#fff" stroke="#18213c" stroke-width="2"/>'+
 '<path d="M47 25 Q42 24 35 30 L36 32 Q41 33 47 28Z" fill="#fff" stroke="#18213c" stroke-width="2"/>'+
 '<path d="M20 15 Q29 8 40 15" stroke="#fff" stroke-opacity=".22" stroke-width="3" fill="none" stroke-linecap="round"/>'+
 '</svg>';
}
function svgImage(svg,key){
 if(cache.has(key))return cache.get(key);
 if(typeof Image==='undefined')return null;
 const img=new Image();img.decoding='async';
 img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
 cache.set(key,img);return img;
}
function imageFor(color,pose='idle'){
 return svgImage(svgFor(color,pose),safeColor(color)+'/top/'+poseKey(pose));
}
function imageForFront(color){
 return svgImage(svgForFront(color),safeColor(color)+'/front');
}
function preload(players){
 for(const p of players||[]){imageForFront(p.color);for(const pose of POSES)imageFor(p.color,pose);}
}
function drawFallback(ctx,color){
 ctx.fillStyle=safeColor(color);ctx.strokeStyle='#24324c';ctx.lineWidth=2;
 ctx.beginPath();ctx.ellipse(0,4,16,16,0,0,TAU);ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.arc(0,-4,20,20,0,0,TAU);ctx.fill();ctx.stroke();
 ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(-8,-2,5,3,.4,0,TAU);ctx.ellipse(8,-2,5,3,-.4,0,TAU);ctx.fill();
}
function heading(p){
 const d=p.dir||{x:0,y:-1},x=Number(d.x),y=Number(d.y);
 if(!Number.isFinite(x)||!Number.isFinite(y)||Math.hypot(x,y)<.001)return 0;
 return Math.atan2(y,x)+Math.PI/2;
}
function draw(ctx,p,opts={}){
 const x=opts.local?0:(p.x||0),y=opts.local?0:(p.y||0),t=opts.time||0;
 const moving=Math.hypot(p.vx||0,p.vy||0)>15;
 const pose=opts.holding?'hold':opts.attacking?'attack':moving?(Math.sin(t*12)>0?'walk':'walk2'):'idle';
 const color=opts.color||p.color,scale=opts.scale===undefined?1:opts.scale;
 ctx.save();
 ctx.globalAlpha=(typeof ctx.globalAlpha==='number'?ctx.globalAlpha:1)*(opts.alpha===undefined?1:opts.alpha);
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 ctx.fillStyle='#06142255';ctx.beginPath();ctx.ellipse(0,0,19,16,0,0,TAU);ctx.fill();
 ctx.save();ctx.rotate(heading(p));
 const img=imageFor(color,pose);
 if(img&&img.complete&&img.naturalWidth)ctx.drawImage(img,-26,-26,52,52);
 else drawFallback(ctx,color);
 ctx.restore();ctx.restore();
 if(opts.label!==false){
  ctx.font='bold 12px sans-serif';ctx.textAlign='center';
  ctx.lineWidth=3;ctx.strokeStyle='#061627';ctx.strokeText(p.name||'',x,y-30);
  ctx.fillStyle='#fff';ctx.fillText(p.name||'',x,y-30);
 }
 ctx.restore();
}
function drawFront(ctx,p,x,y,size=60){
 const color=typeof p==='string'?p:p?.color,im=imageForFront(color);
 ctx.save();
 if(im&&im.complete&&im.naturalWidth)ctx.drawImage(im,x-size/2,y-size/2,size,size);
 else{
  ctx.translate(x,y);ctx.scale(size/96,size/96);
  ctx.fillStyle=safeColor(color);ctx.beginPath();ctx.arc(0,0,36,0,TAU);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(-15,7,9,5,.35,0,TAU);ctx.ellipse(15,7,9,5,-.35,0,TAU);ctx.fill();
 }
 ctx.restore();
}
window.PartyPlayerAvatar=Object.freeze({draw,drawFront,imageFor,imageForFront,svgFor,svgForFront,heading,costumeFor,COSTUMES,preload});
})();
