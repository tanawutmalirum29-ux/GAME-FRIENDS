/* Canonical GAME-FRIENDS unmasked-color superhero avatar.
   One shared identity, two real camera projections, no decorative hats.
   Art is independent of physics radius and retains the 52px world sprite. */
(() => {
'use strict';
const TAU=Math.PI*2,cache=new Map();

/* Punch-v2 atlas: 16 hand-authored SVG frames, one decoded image per player
   color. Timing is sampled from the authoritative PartyCombatMotion state,
   never from a rendering-side timer or a new hitbox. */
const PUNCH_FRAME_ENDS=Object.freeze([25,55,85,115,140,160,180,210,245,280,315,350,390,430,455,480]);
const PUNCH_PALETTE=Object.freeze({
 '#36d9e5':0,'#1c7177':1,'#279ca5':2,'#52dee9':3,
 '#32cad5':4,'#2698a0':5,'#2db6c0':6,'#4edee8':7
});
const punchImages=new Map(),punchDrawn=new WeakSet();
let punchAtlasSource=null,punchAtlasPromise=null,punchAtlasFailed=false;
// Visual sampler only: other games can map THEIR OWN authoritative attack
// phases to 0–480ms without changing stun, cooldown, physics or hit timing.
function punchFrameAtMs(elapsed){
 if(!Number.isFinite(elapsed)||elapsed<0||elapsed>=480)return -1;
 const ms=Math.round(elapsed*1000)/1000;
 return PUNCH_FRAME_ENDS.findIndex(end=>ms<end);
}
function punchFrameFor(p){
 if(!(p?.attackRemaining>0))return -1;
 const total=window.PartyCombatMotion?.TOTAL??.48;
 // Clamp rounding at the final positive attack tick.
 const elapsed=Math.max(0,Math.min(479.999,Math.round((total-p.attackRemaining)*1e6)/1000));
 return punchFrameAtMs(elapsed);
}
function punchHeading(p,facing){return heading({dir:facing||p.attackFacing||p.dir});}
function punchSvgFor(color){
 if(!punchAtlasSource)return null;
 const body=safeColor(color);
 const to=[body,shade(body,-.48),shade(body,-.28),shade(body,.14),
   shade(body,-.07),shade(body,-.3),shade(body,-.16),shade(body,.12)];
 return punchAtlasSource.replace(/#[0-9a-f]{6}/gi,hex=>{
  const i=PUNCH_PALETTE[hex.toLowerCase()];
  return i===undefined?hex:to[i];
 });
}
function loadPunchAtlas(){
 if(punchAtlasPromise||punchAtlasFailed||typeof fetch!=='function')return punchAtlasPromise;
 punchAtlasPromise=fetch('./assets/animations/punch-v2/punch-strip.svg',{cache:'force-cache'})
  .then(response=>{if(!response.ok)throw Error('punch atlas HTTP '+response.status);return response.text();})
  .then(source=>{
   if(!source.includes('viewBox="0 0 1536 112"'))throw Error('unexpected punch atlas');
   punchAtlasSource=source;
   return source;
  })
  .catch(()=>{punchAtlasFailed=true;return null;});
 return punchAtlasPromise;
}
function punchImageFor(color){
 const body=safeColor(color);
 if(typeof Image==='undefined')return null;
 if(punchImages.has(body))return punchImages.get(body);
 if(!punchAtlasSource){loadPunchAtlas();return null;}
 const img=svgImage(punchSvgFor(body),body+'/punch-atlas');
 punchImages.set(body,img);
 return img;
}
function consumePunchDrawn(entity){
 if(!entity||!punchDrawn.has(entity))return false;
 punchDrawn.delete(entity);
 return true;
}

const COSTUMES=Object.freeze(['standard']);
const POSES=Object.freeze(['idle','walk','walk2','hold','attack']);
const safeColor=value=>/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):'#8bd9ec';
const poseKey=v=>POSES.includes(v)?v:'idle';
// Legacy callers may supply a costume; it is deliberately ignored everywhere.
const costumeFor=()=> 'standard';
// Both projections are authored separately. The overhead eyes live on the
// forward rim (-Y); the large front eyes belong only to portrait cards.
const shape=(tag,attrs)=>({tag,attrs});
const curve=(d,fill,stroke=null,width=1)=>shape('path',{d,fill,...(stroke?{stroke,'stroke-width':width,'stroke-linejoin':'round','stroke-linecap':'round'}:{})});
const ellipse=(cx,cy,rx,ry,fill,stroke=null,width=1)=>shape('ellipse',{cx,cy,rx,ry,fill,...(stroke?{stroke,'stroke-width':width}:{})});
function shade(color,amount){
 const hex=safeColor(color).slice(1),target=amount>0?255:0,t=Math.abs(amount);
 return '#'+[0,2,4].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*(1-t)+target*t).toString(16).padStart(2,'0')).join('');
}
function artwork(color,pose='idle',front=false){
 const body=safeColor(color),dark=shade(body,-.48),rim=shade(body,-.28);
 const prefix='avatar-'+body.slice(1)+(front?'-front':'-top-'+poseKey(pose));
 const gradients=[{id:prefix+'-head',cx:front?35:25,cy:front?24:23,r:front?57:35,
  stops:[[0,shade(body,.14)],[.48,body],[.82,shade(body,-.07)],[1,shade(body,-.3)]]},
  {id:prefix+'-body',cx:front?35:26,cy:front?69:35,r:front?58:32,
  stops:[[0,body],[.6,shade(body,-.16)],[1,dark]]}];
 const head='url(#'+prefix+'-head)',torso='url(#'+prefix+'-body)';
 if(front){
  return {size:96,gradients,shapes:[
   curve([['M',15,96],['Q',15,77,33,70],['L',63,70],['Q',81,77,81,96],['Z']],torso),
   ellipse(48,44,36,37,head,rim,1.1),
   // Pointed inner corners and broad outer curves match the front reference.
   curve([['M',20,43],['Q',30,49,43,58],['Q',39,64,29,61],['Q',20,57,20,43],['Z']],'#fff','#21191c',1.7),
   curve([['M',76,43],['Q',66,49,53,58],['Q',57,64,67,61],['Q',76,57,76,43],['Z']],'#fff','#21191c',1.7),
   curve([['M',32,75],['Q',48,80,64,75]],'none',shade(body,-.17),1.2)
  ]};
 }
 const action=poseKey(pose),stride=action==='walk'?2:action==='walk2'?-2:0;
 const arms=action==='hold'?[[16,19],[48,19]]:action==='attack'?[[13,38],[48,13]]:[[13,37+stride],[51,37-stride]];
 const shapes=[
  // Back/shoulders barely peek from under the head: no upright torso or legs.
  ellipse(32,35,19,20,torso,dark,1.1)
 ];
 for(const [i,arm]of arms.entries()){
  const shoulder=[i?47:17,36];
  shapes.push(curve([['M',...shoulder],['Q',arm[0],35,...arm]],'none',rim,10));
  shapes.push(ellipse(arm[0],arm[1],6,7,torso,dark,1));
  shapes.push(curve([['M',arm[0]-2,arm[1]-4],['Q',arm[0],arm[1]-5,arm[0]+2,arm[1]-3]],'none',shade(body,.12),1.2));
 }
 shapes.push(ellipse(32,30,22,23,head,dark,1.2));
 shapes.push(curve([['M',15,20],['Q',19,11,28,10.5],['L',28,14],['Q',21,15.5,18,20],['Q',16,22,15,20],['Z']],'#fff','#281a22',1.25));
 shapes.push(curve([['M',49,20],['Q',45,11,36,10.5],['L',36,14],['Q',43,15.5,46,20],['Q',48,22,49,20],['Z']],'#fff','#281a22',1.25));
 // A quiet curved crown highlight, never a second face or a decorative hat.
 shapes.push(curve([['M',17,30],['Q',17,42,28,46]],'none',shade(body,.12),1.4));
 return {size:64,gradients,shapes};
}
function svgArtwork(color,pose,front){
 const art=artwork(color,pose,front),size=art.size;
 const defs=art.gradients.map(q=>'<radialGradient id="'+q.id+'" gradientUnits="userSpaceOnUse" cx="'+q.cx+'" cy="'+q.cy+'" r="'+q.r+'">'+q.stops.map(([offset,color])=>'<stop offset="'+offset+'" stop-color="'+color+'"/>').join('')+'</radialGradient>').join('');
 const shapes=art.shapes.map(({tag,attrs})=>'<'+tag+' '+Object.entries(attrs).map(([k,v])=>k+'="'+(k==='d'?v.map(c=>c.join(' ')).join(' '):v)+'"').join(' ')+'/>').join('');
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" data-view="'+(front?'front':'top-down')+'"'+(front?'':' data-pose="'+poseKey(pose)+'"')+' data-costume="standard"><defs>'+defs+'</defs>'+shapes+'</svg>';
}
function svgForFront(color){return svgArtwork(color,'idle',true);}
function svgFor(color,pose='idle'){return svgArtwork(color,poseKey(pose),false);}
// Loading/failure fallback uses the exact same geometry, palette and poses as
// the SVG image so the first frame cannot briefly show a front-facing figure.
function paintArtwork(ctx,color,pose,front){
 const art=artwork(color,pose,front),fills={};
 for(const q of art.gradients){
  const grad=ctx.createRadialGradient?.(q.cx,q.cy,0,q.cx,q.cy,q.r);
  if(grad?.addColorStop){for(const [offset,c]of q.stops)grad.addColorStop(offset,c);fills['url(#'+q.id+')']=grad;}
  else fills['url(#'+q.id+')']=safeColor(color);
 }
 for(const {tag,attrs:a}of art.shapes){
  ctx.beginPath();
  if(tag==='ellipse')ctx.ellipse(a.cx,a.cy,a.rx,a.ry,0,0,TAU);
  else for(const [op,...v]of a.d){
   if(op==='M')ctx.moveTo(...v);else if(op==='L')ctx.lineTo(...v);
   else if(op==='Q')ctx.quadraticCurveTo(...v);else if(op==='C')ctx.bezierCurveTo(...v);else ctx.closePath();
  }
  if(a.fill!=='none'){ctx.fillStyle=fills[a.fill]||a.fill;ctx.fill();}
  if(a.stroke){ctx.strokeStyle=a.stroke;ctx.lineWidth=a['stroke-width'];ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();}
 }
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
 // Preload idle/walk/portrait synchronously only. Deferred punch images would
 // race other games' SVG decode barriers and consume memory for unused actions.
 // The punch atlas itself is fetched once and each tinted variant is decoded
 // lazily on first real attack, with an unchanged canonical fallback meanwhile.
 for(const p of players||[]){imageForFront(p.color);for(const pose of POSES)imageFor(p.color,pose);window.PartyCosmetics?.preload?.(p);}
}
function drawFallback(ctx,color,pose){
 ctx.save();ctx.scale(52/64,52/64);ctx.translate(-32,-32);
 paintArtwork(ctx,color,pose,false);ctx.restore();
}
function heading(p){
 const d=p.dir||{x:0,y:-1},x=Number(d.x),y=Number(d.y);
 if(!Number.isFinite(x)||!Number.isFinite(y)||Math.hypot(x,y)<.001)return 0;
 return Math.atan2(y,x)+Math.PI/2;
}
function draw(ctx,p,opts={}){
 const x=opts.local?0:(p.x||0),y=opts.local?0:(p.y||0),t=opts.time||0;
 const moving=Math.hypot(p.vx||0,p.vy||0)>15;
 const pose=opts.attacking?'attack':opts.holding?'hold':moving?(Math.sin(t*12)>0?'walk':'walk2'):'idle';
 const color=opts.color||p.color,scale=opts.scale===undefined?1:opts.scale;
 ctx.save();
 ctx.globalAlpha=(typeof ctx.globalAlpha==='number'?ctx.globalAlpha:1)*(opts.alpha===undefined?1:opts.alpha);
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 // Mounts own their ground shadow. Their caller may already have rotated the
 // canvas, so accept a local heading without rewriting the player's direction.
 if(opts.shadow!==false){
  ctx.fillStyle='#06142255';ctx.beginPath();ctx.ellipse(0,0,19,16,0,0,TAU);ctx.fill();
 }
 const punchFrame=opts.attacking===false?-1:
  Number.isFinite(opts.punchElapsedMs)?punchFrameAtMs(opts.punchElapsedMs):punchFrameFor(p);
 if(punchFrame<0)punchDrawn.delete(p); // a different round must not inherit a previous draw marker
 const angle=Number.isFinite(opts.heading)?opts.heading:
  punchFrame>=0?punchHeading(p,opts.punchFacing):heading(p);
 ctx.save();ctx.rotate(angle);
 const atlas=punchFrame>=0?punchImageFor(color):null;
 if(atlas&&atlas.complete&&atlas.naturalWidth){
  // Padded SVG viewBox is not an actor scale or physics origin change.
  ctx.drawImage(atlas,punchFrame*96,0,96,112,-39,-52,78,91);
  punchDrawn.add(p);
 }else{
  const img=imageFor(color,pose);
  if(img&&img.complete&&img.naturalWidth)ctx.drawImage(img,-26,-26,52,52);
  else drawFallback(ctx,color,pose);
  // Never draw the old line from the face on top of the fallback arm.
  if(punchFrame>=0)punchDrawn.add(p);
 }
 // A single head-aligned accessory follows the same transform as the face,
 // including the punch atlas and game-specific rider scale/heading.
 window.PartyCosmetics?.drawTop?.(ctx,p);
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
  // The body fallback uses portrait-local coordinates; restore them before
  // drawing accessories, whose anchors are expressed in screen coordinates.
  ctx.save();ctx.translate(x-size/2,y-size/2);ctx.scale(size/96,size/96);
  paintArtwork(ctx,color,'idle',true);ctx.restore();
 }
 // Portrait assets have their own viewBoxes; preserve the authored anchor.
 if(p&&typeof p==='object')window.PartyCosmetics?.drawFront?.(ctx,p,x,y,size);
 ctx.restore();
}
window.PartyPlayerAvatar=Object.freeze({draw,drawFront,imageFor,imageForFront,svgFor,svgForFront,heading,costumeFor,COSTUMES,preload,
 punchFrameFor,punchFrameAtMs,punchImageFor,punchSvgFor,punchHeading,consumePunchDrawn,loadPunchAtlas});
 // Fetch atlas text early on HTTP hosts (no Image decoding until actually punching).
 if(typeof location!=='undefined'&&/^https?:$/.test(location.protocol))loadPunchAtlas();
})();
