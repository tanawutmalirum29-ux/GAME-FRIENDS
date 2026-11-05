/* Shared overhead characters. The 52px sprite, shadow and physics origin stay
   centred on (p.x,p.y); costumes never change a player's collision radius. */
(() => {
'use strict';
const TAU=Math.PI*2,cache=new Map();
const COSTUMES=Object.freeze(['scout','chicken','pharaoh','fox']);
const POSES=['idle','walk','walk2','hold','attack'];
const safeColor=v=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v):'#8bd9ec';
const poseKey=v=>POSES.includes(v)?v:'idle';
const costumeKey=v=>COSTUMES.includes(v)?v:'scout';
function costumeFor(p){
 if(COSTUMES.includes(p.costume))return p.costume;
 // Stable across games, transformations and hit-flash colors; no network field
 // or random draw-time choice is needed. Restored players keep the same ID.
 const id=String(p.id||safeColor(p.color));
 const seat=/^p(\d+)$/.exec(id);
 let hash=0;for(const ch of id)hash=(hash*31+ch.charCodeAt(0))>>>0;
 return COSTUMES[seat?Math.max(0,Number(seat[1])-1)%4:hash%4];
}
function svgFor(color,pose='idle',costume='scout'){
 const body=safeColor(color),action=poseKey(pose),skin=costumeKey(costume);
 const stride=action==='walk'?3:action==='walk2'?-3:0;
 const left=action==='hold'?[15,14]:action==='attack'?[13,30]:[13,34+stride];
 const right=action==='hold'?[49,14]:action==='attack'?[47,7]:[51,34-stride];
 let crown='';
 if(skin==='pharaoh'){
   crown='<path d="M17 36 L8 42 L9 22 Q13 8 32 7 Q51 8 55 22 L56 42 L47 36" fill="#26365e" stroke="#172743" stroke-width="2"/>'+
    '<path d="M12 20 L22 24 M10 27 L21 29 M10 34 L21 34 M11 40 L22 38 M52 20 L42 24 M54 27 L43 29 M54 34 L43 34 M53 40 L42 38" stroke="#f8d475" stroke-width="3"/>';
 }else if(skin==='fox'){
   crown='<path d="M14 22 L12 5 L27 14 M37 14 L52 5 L50 23" fill="'+body+'" stroke="#24324c" stroke-width="2"/>'+
    '<path d="M16 10 L23 16 L17 19 M48 10 L41 16 L47 19" fill="#fff0cb"/>';
 }else if(skin==='chicken'){
   crown='<path d="M20 17 Q14 3 23 7 Q27 -1 32 7 Q39 0 40 10 L43 18" fill="#ef586c" stroke="#79384c" stroke-width="2"/>';
 }
 const face=skin==='chicken'?'#fff9df':skin==='pharaoh'?'#f9d786':'#fff0d2';
 const fan=skin==='pharaoh'?'<path d="M13 28 Q13 47 32 47 Q51 47 51 28 L32 24Z" fill="#2e4369"/>'+
   Array.from({length:9},(_,i)=>{
    const a=(i+.25)*Math.PI/9,b=a+.12;
    return '<path d="M32 26 L'+(32+19*Math.cos(a)).toFixed(2)+' '+(27+19*Math.sin(a)).toFixed(2)+
      ' L'+(32+19*Math.cos(b)).toFixed(2)+' '+(27+19*Math.sin(b)).toFixed(2)+'Z" fill="#f9d880" stroke="none"/>';
   }).join(''):'';
 const trim=skin==='pharaoh'?
   '<path d="M23 17 Q32 10 41 17 M25 11 L26 17 M32 9 V16 M39 11 L38 17" fill="none" stroke="#ffe397" stroke-width="2"/>':
   skin==='scout'?'<path d="M28 11 L32 6 L36 11 L32 15Z" fill="#fff2a8" stroke="#334261" stroke-width="1.3"/>':'';
 return '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" data-view="top-down" data-pose="'+action+'" data-costume="'+skin+'">'+
  '<defs><radialGradient id="suit" cx=".3" cy=".2" r=".85"><stop stop-color="#fff" stop-opacity=".65"/><stop offset=".42" stop-color="'+body+'"/><stop offset="1" stop-color="'+body+'"/></radialGradient>'+
  '<linearGradient id="shade" x2=".7" y2="1"><stop stop-color="#11233b" stop-opacity="0"/><stop offset="1" stop-color="#11233b" stop-opacity=".38"/></linearGradient></defs>'+
  '<g stroke="#24324c" stroke-width="2" stroke-linejoin="round">'+
  '<g fill="#293954"><ellipse cx="24" cy="'+(49+stride)+'" rx="5.5" ry="6"/><ellipse cx="40" cy="'+(49-stride)+'" rx="5.5" ry="6"/></g>'+
  '<ellipse cx="32" cy="36" rx="18" ry="16" fill="url(#suit)"/>'+
  '<path d="M21 44 Q32 51 43 44" fill="none" stroke="#fff" opacity=".45"/>'+
  '<path d="M20 33 L'+left.join(' ')+' M44 33 L'+right.join(' ')+'" fill="none" stroke="'+body+'" stroke-width="9" stroke-linecap="round"/>'+
  '<circle cx="'+left[0]+'" cy="'+left[1]+'" r="5.5" fill="'+face+'"/><circle cx="'+right[0]+'" cy="'+right[1]+'" r="5.5" fill="'+face+'"/>'+
  crown+'<circle cx="32" cy="27" r="20" fill="url(#suit)"/>'+
  '<circle cx="32" cy="27" r="19" fill="url(#shade)" stroke="none"/>'+fan+
  // The face is at the forward rim; the crown and shoulders dominate the view.
  '<path d="M20 21 Q32 14 44 21 L42 28 Q32 33 22 28Z" fill="'+face+'" stroke-width="1.5"/>'+
  '<g fill="#24324c" stroke="none"><ellipse cx="26" cy="23" rx="1.7" ry="2.2"/><ellipse cx="38" cy="23" rx="1.7" ry="2.2"/></g>'+
  (skin==='chicken'?'<path d="M29 27 L32 22 L35 27 L32 30Z" fill="#ffb443" stroke="#b97430" stroke-width="1"/>':
    '<path d="M30 27 Q32 29 34 27" fill="none" stroke="#b17f68" stroke-width="1.2"/>')+
  '<path d="M19 34 Q18 39 25 42" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>'+trim+
  '</g></svg>';
}
function imageFor(color,pose='idle',costume='scout'){
 const key=safeColor(color)+'/'+poseKey(pose)+'/'+costumeKey(costume);
 if(cache.has(key))return cache.get(key);
 if(typeof Image==='undefined')return null;
 const img=new Image();img.decoding='async';
 img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgFor(color,pose,costume));
 cache.set(key,img);return img;
}
function preload(players){
 for(const p of players)for(const pose of POSES)imageFor(p.color,pose,costumeFor(p));
}
function drawFallback(ctx,color){
 ctx.fillStyle=safeColor(color);ctx.strokeStyle='#24324c';ctx.lineWidth=2;
 ctx.beginPath();ctx.ellipse(0,4,16,16,0,0,TAU);ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.arc(-16,1,4,0,TAU);ctx.arc(16,1,4,0,TAU);ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.arc(0,-4,16,0,TAU);ctx.fill();ctx.stroke();
 ctx.fillStyle='#fff0d2';ctx.beginPath();ctx.ellipse(0,-9,9,5,0,0,TAU);ctx.fill();
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
 const img=imageFor(color,pose,costumeFor(p));
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
window.PartyPlayerAvatar=Object.freeze({draw,imageFor,svgFor,heading,costumeFor,COSTUMES,preload});
})();
