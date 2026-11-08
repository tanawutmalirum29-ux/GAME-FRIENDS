/* Original SVG scenery and vehicle artwork for the four reference arenas.
 * All drawing receives the engine's world, field, track and physical anchors.
 * Ownership, laps, cutting, chains and collision geometry remain engine data. */
(() => {
'use strict';
const TAU=Math.PI*2,assets=new Map(),scenes=new WeakMap(),territories=new WeakMap();
let grassRevision=0;
const colour=c=>/^#[\da-f]{6}$/i.test(c||'')?c:'#62bdda';
const noise=i=>{const v=Math.sin(i*127.1+41.7)*43758.5453;return v-Math.floor(v);};
const num=n=>Number(n.toFixed(2));
const svg=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const ready=i=>!!(i?.complete&&i.naturalWidth);
function picture(body,onload){
 if(typeof Image==='undefined')return null;
 const i=new Image();i.decoding='async';if(onload)i.onload=onload;
 i.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(body);return i;
}
function asset(key,make){
 if(!assets.has(key))assets.set(key,picture(make(),key==='grass-atlas'?()=>grassRevision++:null));
 return assets.get(key);
}
function scene(s,key,make){
 let cache=scenes.get(s);if(!cache){cache=new Map();scenes.set(s,cache);}
 if(!cache.has(key))cache.set(key,picture(make()));return cache.get(key);
}
function stamp(g,i,x,y,w,h,angle=0){
 if(!ready(i))return false;
 g.save();g.translate(x,y);g.rotate(angle);g.drawImage(i,-w/2,-h/2,w,h);g.restore();return true;
}
function dots(w,h,n,fill,seed=0){
 return Array.from({length:n},(_,i)=>`<ellipse cx="${num(noise(i+seed)*w)}" cy="${num(noise(i+seed+77)*h)}" rx="${num(1+noise(i+12)*2)}" ry=".8" fill="${fill}"/>`).join('');
}
function helmet(mark='#e94d30'){
 return `<path d="M-15-8Q-16-24 0-26Q17-23 16-7L12 15 4 22H-5L-13 13Z" fill="${mark}" stroke="#5a392f" stroke-width="2"/><path d="M-16-5-3 0 0 11 3 0 16-5 13-13 0-8-13-13Z" fill="#fff1b6"/><path d="m-12-7 9 4-2 5-6-3m23-6-9 4 2 5 6-3" fill="#263d45"/><path d="M0-25V21" stroke="#f6b153" stroke-width="3"/><path d="M-3-25-5-34 4-36 6-25" fill="#ae343a"/>`;
}
function tree(x,y,r){
 let leaves='';
 for(let k=0;k<9;k++){const a=k*TAU/9;leaves+=`<ellipse cx="${num(Math.cos(a)*r*.44)}" cy="${num(Math.sin(a)*r*.4)}" rx="${num(r*.52)}" ry="${num(r*.45)}" fill="${['#3a882c','#55a630','#6cb637'][k%3]}" stroke="#39752a" stroke-width="2"/>`;}
 return `<g transform="translate(${x} ${y})"><ellipse cy="12" rx="${r}" ry="${r*.82}" fill="#244b2440"/>${leaves}<ellipse cx="-7" cy="-9" rx="${r*.55}" ry="${r*.43}" fill="#8fc741"/><path d="M${-r*.3} ${-r*.25}Q0 ${-r*.5} ${r*.24} ${-r*.28}" fill="none" stroke="#c0df66" stroke-width="4" stroke-linecap="round"/></g>`;
}
function claimSceneSVG(s,overlay=false){
 const f=s.field,u=s.w/960;
 if(overlay){
  let speakers='';
  for(const [x,y,a] of [[f.x-9*u,f.y-9*u,-.7],[f.x+f.w+9*u,f.y-9*u,.7],[f.x-9*u,f.y+f.h+9*u,.7],[f.x+f.w+9*u,f.y+f.h+9*u,-.7]]){
   speakers+=`<g transform="translate(${x} ${y}) rotate(${a*180/Math.PI}) scale(${u})"><rect x="-18" y="-21" width="36" height="42" rx="12" fill="#272344" stroke="#a09ab8" stroke-width="2"/><ellipse rx="13" ry="17" fill="#15172e" stroke="#6e7b9b" stroke-width="2"/><ellipse rx="8" ry="12" fill="#647b9d"/><ellipse rx="4" ry="7" fill="#bceafa"/><path d="M-12-14 7-17M-14 10 2 16" stroke="#f5f0cd" stroke-width="2"/></g>`;
  }
  return svg(s.w,s.h,`<defs><pattern id="grid" width="${32*u}" height="${32*u}" patternUnits="userSpaceOnUse" x="${f.x}" y="${f.y}"><path d="M${32*u} 0H0V${32*u}" fill="none" stroke="#aed9ff" stroke-opacity=".19" stroke-width="${1.2*u}"/></pattern></defs><rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="url(#grid)"/><rect x="${f.x-6*u}" y="${f.y-6*u}" width="${f.w+12*u}" height="${f.h+12*u}" rx="${13*u}" fill="none" stroke="#fa2a9c" stroke-width="${12*u}" opacity=".18"/><rect x="${f.x-5*u}" y="${f.y-5*u}" width="${f.w+10*u}" height="${f.h+10*u}" rx="${10*u}" fill="none" stroke="#fa278c" stroke-width="${5*u}"/><path d="M${f.x+20*u} ${f.y-7*u}H${f.x+f.w-20*u}M${f.x+20*u} ${f.y+f.h+7*u}H${f.x+f.w-20*u}" stroke="#ff94cb" stroke-width="${u}"/>${speakers}`);
 }
 let lights='';
 for(let i=0;i<12;i++){const x=(i+.5)*s.w/12;lights+=`<path d="M${x} 0  ${x+28*u} ${f.y} ${x-28*u} ${f.y}Z" fill="${i%2?'#5259e5':'#b326b4'}" opacity=".14"/>`;}
 return svg(s.w,s.h,`<defs><radialGradient id="night"><stop stop-color="#40327a"/><stop offset="1" stop-color="#1c1746"/></radialGradient><linearGradient id="floor" x2=".7" y2="1"><stop stop-color="#242552"/><stop offset=".55" stop-color="#191c47"/><stop offset="1" stop-color="#29244e"/></linearGradient></defs><path d="M0 0H${s.w}V${s.h}H0Z" fill="url(#night)"/>${lights}<rect x="${f.x-13*u}" y="${f.y-13*u}" width="${f.w+26*u}" height="${f.h+26*u}" rx="${18*u}" fill="#4c2656" stroke="#181932" stroke-width="${5*u}"/><rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="url(#floor)"/>`);
}
function territoryPath(s,loop,cell){
 // A bounded subdivision removes staircase corners without changing the
 // authoritative mask. Every point moves less than half a scoring cell.
 let points=loop.map(p=>({x:s.field.x+p.x*cell,y:s.field.y+p.y*cell}));
 for(let pass=0;pass<2;pass++)points=points.map((p,i)=>{
  const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];
  return {x:(a.x+6*p.x+b.x)/8,y:(a.y+6*p.y+b.y)/8};
 });
 if(points.length<3)return '';
 const last=points.at(-1),first=points[0];let d=`M${num((last.x+first.x)/2)} ${num((last.y+first.y)/2)}`;
 points.forEach((p,i)=>{const n=points[(i+1)%points.length];d+=`Q${num(p.x)} ${num(p.y)} ${num((p.x+n.x)/2)} ${num((p.y+n.y)/2)}`;});
 return d+'Z';
}
function claim(g,s,cell){
 const base=scene(s,'claim-base',()=>claimSceneSVG(s)),top=scene(s,'claim-top',()=>claimSceneSVG(s,true));
 if(!ready(base)||!ready(top)||typeof Path2D==='undefined')return false;
 let cache=territories.get(s);
 if(!cache||cache.groups!==s.contours){
  cache={groups:s.contours,paths:s.contours.map(loops=>new Path2D(loops.map(p=>territoryPath(s,p,cell)).join('')))};
  territories.set(s,cache);
 }
 g.drawImage(base,0,0,s.w,s.h);g.save();g.beginPath();g.rect(s.field.x,s.field.y,s.field.w,s.field.h);g.clip();
 for(let i=0;i<cache.paths.length;i++){
  g.fillStyle=colour(s.roster[i]?.color);g.globalAlpha=.88;g.fill(cache.paths[i],'evenodd');
 }
 g.restore();g.drawImage(top,0,0,s.w,s.h);return true;
}
function claimCarSVG(c){
 return svg(64,64,`<defs><linearGradient id="car" x2=".2" y2="1"><stop stop-color="#ffffff"/><stop offset=".18" stop-color="${c}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><ellipse cx="32" cy="36" rx="22" ry="19" fill="#090d2955"/><path d="M12 25Q14 13 33 13Q49 14 54 26V39Q50 51 33 51Q16 51 11 40Z" fill="#172337" stroke="#a7bdd4" stroke-width="2"/><path d="M16 24Q22 16 37 17L49 23 51 38 42 46 24 46 15 38Z" fill="url(#car)" stroke="#f8f5d5" stroke-width="1.3"/><path d="M37 19 46 23 48 39 39 44 36 38Z" fill="#e9f1d5"/><path d="M18 27Q30 22 35 28V39Q28 45 20 38Z" fill="#152638"/><circle cx="26" cy="32" r="9" fill="${c}" stroke="#f3f5b4" stroke-width="1.2"/><path d="M21 26Q27 23 31 27" stroke="#ffffff" stroke-width="2" fill="none"/><circle cx="33" cy="32" r="3.5" fill="none" stroke="#a9b7c7" stroke-width="1.8"/><path d="M46 25v5m0 5v5" stroke="#ffffd0" stroke-width="3"/><path d="M15 28v9" stroke="#ff83d5" stroke-width="2"/>`);
}
function claimCar(g,p,radius){
 const c=colour(p.color),i=asset('claim-car/'+c,()=>claimCarSVG(c));
 // The bumper is 44 units wide inside the padded 64-unit SVG.
 const size=64*(radius*2)/44,d=p.dir||{x:1,y:0};
 return stamp(g,i,p.x,p.y,size,size,Math.atan2(d.y,d.x));
}
function iceSceneSVG(s){
 const u=s.w/960,path='M'+s.path.map(p=>`${num(p.x)} ${num(p.y)}`).join('L')+'Z',width=s.halfWidth*2;
 let floes='',arrows='',markers='',cracks='';
 for(const [i,f] of s.floes.entries()){
  const pts=Array.from({length:f.points},(_,j)=>{const a=j*TAU/f.points,r=f.r*(j%2?.81:1);return `${num(Math.cos(a)*r)},${num(Math.sin(a)*r)}`;}).join(' ');
  floes+=`<polygon transform="translate(${f.x} ${f.y}) rotate(${f.rotation*180/Math.PI})" points="${pts}" fill="${i%3?'#30c9f1':'#8eeaf3'}" opacity="${i%3?'.22':'.3'}"/>`;
 }
 for(let i=0;i<s.path.length;i+=17){
  const p=s.path[i],angle=Math.atan2(p.ty,p.tx)*180/Math.PI;
  if(i%34===0)arrows+=`<path transform="translate(${p.x} ${p.y}) rotate(${angle}) scale(${u})" d="M-11-4H0V-10L12 0 0 10V4H-11Z" fill="#557d94" opacity=".72"/>`;
  const side=i%2?1:-1,x=p.x-p.ty*side*(s.halfWidth-3*u),y=p.y+p.tx*side*(s.halfWidth-3*u);
  cracks+=`<path transform="translate(${x} ${y}) rotate(${angle}) scale(${u})" d="M0 0-3-8 1-15-2-22m-1 14-6-4" fill="none" stroke="#79afc3" stroke-opacity=".7" stroke-width="1.3"/>`;
 }
 for(const cp of s.checkpoints){
  markers+=`<g transform="translate(${cp.x} ${cp.y}) rotate(${Math.atan2(cp.ty,cp.tx)*180/Math.PI})"><path d="M0 ${-s.halfWidth+2*u}V${s.halfWidth-2*u}" stroke="${cp.id===0?'#607e90':'#6b8b9f'}" stroke-width="${4*u}"/><path d="M${3*u} ${-s.halfWidth+4*u}V${s.halfWidth-4*u}" stroke="#ffffff" stroke-width="${1.5*u}"/></g>`;
 }
 return svg(s.w,s.h,`<defs><radialGradient id="water" cx=".52" cy=".47" r=".7"><stop stop-color="#087de8"/><stop offset=".6" stop-color="#0063fa"/><stop offset="1" stop-color="#0735cc"/></radialGradient><linearGradient id="snow" x2=".2" y2="1"><stop stop-color="#ffffff"/><stop offset=".52" stop-color="#ecfff9"/><stop offset="1" stop-color="#cff4f3"/></linearGradient><mask id="road"><path d="${path}" fill="none" stroke="#fff" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/></mask></defs><path d="M0 0H${s.w}V${s.h}H0Z" fill="url(#water)"/>${floes}<g fill="none" stroke-linejoin="round" stroke-linecap="round"><path d="${path}" transform="translate(${5*u} ${24*u})" stroke="#073c906b" stroke-width="${width+13*u}"/><path d="${path}" transform="translate(0 ${17*u})" stroke="#037ab4" stroke-width="${width+7*u}"/><path d="${path}" transform="translate(0 ${9*u})" stroke="#16b9d5" stroke-width="${width+5*u}"/><path d="${path}" stroke="#72e0e4" stroke-width="${width+2*u}"/><path d="${path}" stroke="url(#snow)" stroke-width="${width}"/></g><g mask="url(#road)">${dots(s.w,s.h,170,'#659db91a',33)}${cracks}${markers}${arrows}</g>`);
}
function ice(g,s){
 const i=scene(s,'ice',()=>iceSceneSVG(s));if(!ready(i))return false;
 g.drawImage(i,0,0,s.w,s.h);return true;
}
function sledSVG(c){
 // Native artwork units match the 48 x 36 physical sled hull. The padded
 // 64 x 56 SVG is not used as a collision rectangle or a full-size avatar.
 return svg(64,56,`<defs><linearGradient id="hull" x2=".3" y2="1"><stop stop-color="#eefcff"/><stop offset=".28" stop-color="${c}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><g transform="translate(32 28)"><ellipse cy="5" rx="24" ry="17" fill="#164c8355"/><path d="M-23-16H18Q24-16 23-12M-23 16H18Q24 16 23 12" fill="none" stroke="#478291" stroke-width="4" stroke-linecap="round"/><path d="M-22-17H18M-22 17H18" stroke="#f5ffff" stroke-width="1.8"/><path d="M-20-12Q-23 0-20 12L13 13Q23 9 24 0Q23-9 13-13Z" fill="url(#hull)" stroke="#245477" stroke-width="1.4"/><path d="M13-10Q21-6 21 0Q21 6 13 10L10 6V-6Z" fill="#f1fcfc"/><path d="M-18-8H4V8H-18Z" fill="#214859"/><circle cx="-5" r="12" fill="${c}" stroke="#23566e" stroke-width="1.4"/><path d="M-14-5Q-8-12-1-8" fill="none" stroke="#efffff" stroke-width="2.2" stroke-linecap="round"/><path d="M3-6Q8 0 3 6" fill="#e7faff" stroke="#266a84" stroke-width="1"/><path d="M7-7V7" stroke="#536c79" stroke-width="2.2"/><circle cx="-21" cy="0" r="4" fill="#304b5f"/><path d="m-23-2-5-2v8l5-2Z" fill="#b8d9e1"/></g>`);
}
function sled(g,p,t){
 const w=p.ice,c=colour(p.color),i=asset('sled/'+c,()=>sledSVG(c));if(!ready(i))return false;
 if(w.state==='falling'&&w.fallLeft>.65)return true;
 const falling=w.state==='falling',scale=falling?Math.max(.25,1-w.fallLeft*1.3):1;
 g.save();g.globalAlpha=falling?Math.max(.12,1-w.fallLeft*1.7):1;
 stamp(g,i,p.x,p.y+(falling?w.fallLeft*22:0),64*scale,56*scale,w.heading+(falling?w.fallLeft*1.7:0));
 if(w.invulnerable>0){g.strokeStyle='#d2ffff';g.lineWidth=1.5;g.setLineDash([4,5]);g.beginPath();g.arc(p.x,p.y,25,0,TAU);g.stroke();}
 g.restore();return true;
}
function grassAtlasSVG(){
 let body='';
 for(let row=0;row<2;row++)for(let v=0;v<5;v++){
  const tones=row?['#88b840','#aed054','#6b9e35']:['#438e12','#64ac15','#86c422','#4f9e0b','#9bcc25'];
  let blades='';
  for(let j=0;j<(row?5:8);j++){
   const a=(j*TAU/(row?5:8)+v*.23)*180/Math.PI,len=9+(j*3+v)%6;
   blades+=`<path transform="rotate(${a})" d="M0 3Q-5-3-3-${len}Q3-6 0 3Z" fill="${tones[(j+v)%tones.length]}"/><path transform="rotate(${a})" d="M0 2-2-${len-2}" stroke="${row?'#bdd762':'#acd950'}" stroke-opacity=".36" stroke-width=".6"/>`;
  }
  body+=`<g transform="translate(${v*32+16} ${row*32+16})">${blades}</g>`;
 }
 return svg(160,64,body);
}
function grass(g,tuft,short){
 const i=asset('grass-atlas',grassAtlasSVG);if(!ready(i))return false;
 const size=tuft.size*(short ? .28 : 1)*2.4;
 g.save();g.translate(tuft.x,tuft.y);g.rotate(tuft.rotation);
 g.drawImage(i,(tuft.variant%5)*32,short?32:0,32,32,-size/2,-size/2,size,size);g.restore();return true;
}
function lawnSceneSVG(s,foreground=false){
 const w=s.w,h=s.h,f=s.field,u=w/960,houseRight=f.x-38*u,stoneX=f.x+f.w+5*u,stoneW=57*u,roadX=stoneX+stoneW;
 if(foreground){
  const x=f.x-60*u,y=f.y+f.h+9*u,r=56*u;
  let canopy='',flowers='';
  for(let i=0;i<8;i++){
   const a=i*TAU/8,b=(i+1)*TAU/8;
   canopy+=`<path d="M${x} ${y}L${x+Math.cos(a)*r} ${y+Math.sin(a)*r}A${r} ${r} 0 0 1 ${x+Math.cos(b)*r} ${y+Math.sin(b)*r}Z" fill="${i%2?'#fff0d0':'#f04b40'}" stroke="#ca6650" stroke-width="${u}"/>`;
  }
  for(let i=0;i<18;i++){
   const px=f.x+12*u+noise(i+10)*(f.w-24*u),py=i%2?f.y-12*u:f.y+f.h+12*u;
   flowers+=`<g transform="translate(${px} ${py}) scale(${u})"><path d="M0 3-6 0-5-4 0-2 3-6 7-4 5 1Z" fill="#578827"/><path d="M0-6Q7-8 5-2Q10 2 4 5Q2 11-2 5Q-9 6-6 0Q-9-6-2-4Z" fill="#ffe66f"/><circle r="2.6" fill="#df9d2f"/></g>`;
  }
  return svg(w,h,`<ellipse cx="${x+6*u}" cy="${y+8*u}" rx="${r}" ry="${r*.86}" fill="#28482244"/>${canopy}<circle cx="${x}" cy="${y}" r="${4*u}" fill="#fff9db"/>${flowers}`);
 }
 let paving='',roof='',plants='',boxes='';
 for(let row=0;row<Math.ceil((h-60*u)/(35*u));row++){
  const y=30*u+row*35*u;
  paving+=`<path d="M${houseRight+4*u} ${y}h${33*u}v${34*u}h${-33*u}Z" fill="${row%2?'#d6c8a0':'#e9dfbb'}" stroke="#998f72" stroke-width="${u}"/><path d="M${houseRight+13*u} ${y+5*u}l${12*u} ${2*u} ${5*u} ${14*u}-${7*u} ${7*u}-${17*u}-${4*u}Z" fill="#f3eacb" stroke="#c1b496" stroke-width="${u}"/>`;
  roof+=`<path d="M${8*u} ${y}H${houseRight-7*u}" stroke="#472d2f" stroke-width="${2*u}"/>`;
  for(let col=0;col<5;col++){
   const x=10*u+(col+(row%2)*.5)*(houseRight-20*u)/5;
   roof+=`<path d="M${x} ${y}v${32*u}" stroke="#9e6850" stroke-width="${1.5*u}"/>`;
  }
 }
 for(let row=0;row<7;row++){
  const y=f.y+row*f.h/7;
  paving+=`<rect x="${stoneX}" y="${y}" width="${stoneW}" height="${f.h/7}" fill="${row%2?'#ddd9bc':'#eeebd3'}" stroke="#aaa68b" stroke-width="${1.6*u}"/><path d="M${stoneX+8*u} ${y+17*u}l${11*u}-${9*u} ${13*u} ${4*u} ${6*u} ${14*u}-${12*u} ${9*u}-${15*u}-${3*u}Z" fill="#fff9e1" stroke="#cac5aa" stroke-width="${u}"/>`;
  if(row%3===0)boxes+=`<g transform="translate(${stoneX+stoneW*.66} ${y+18*u}) rotate(-12) scale(${u})"><rect x="-10" y="-12" width="22" height="25" rx="3" fill="#a84e33"/><rect x="-10" y="-15" width="21" height="24" rx="3" fill="#e95636" stroke="#ffc090" stroke-width="1.5"/><path d="M-4-9V2H4V-4H0" fill="none" stroke="#fff0c9" stroke-width="3"/></g>`;
 }
 for(let i=0;i<15;i++){
  const x=f.x+noise(i+22)*f.w,y=i%2?f.y-22*u:f.y+f.h+23*u;
  plants+=`<g transform="translate(${x} ${y}) scale(${u})"><path d="M0 7-16-7-9-11-1-2-3-21 5-20 5-3 15-13 20-8 8 6Z" fill="${i%2?'#6f9f27':'#4b8021'}"/></g>`;
 }
 return svg(w,h,`<defs><linearGradient id="garden" x2=".3" y2="1"><stop stop-color="#77af21"/><stop offset="1" stop-color="#4c941b"/></linearGradient><linearGradient id="roof" x2="1" y2=".2"><stop stop-color="#4e3b48"/><stop offset=".5" stop-color="#966451"/><stop offset="1" stop-color="#563b37"/></linearGradient><linearGradient id="street" x2="1"><stop stop-color="#d9d9c5"/><stop offset="1" stop-color="#a9b8ac"/></linearGradient></defs><path d="M0 0H${w}V${h}H0Z" fill="url(#garden)"/><rect x="${f.x-10*u}" y="${f.y-14*u}" width="${f.w+20*u}" height="${f.h+28*u}" rx="${6*u}" fill="#8a713d"/><path d="M0 ${32*u} ${houseRight} ${40*u}V${h-40*u}L0 ${h-20*u}Z" fill="#eee0ac" stroke="#a19072" stroke-width="${4*u}"/><path d="M0 ${45*u} ${houseRight-12*u} ${51*u}V${h-55*u}L0 ${h-35*u}Z" fill="url(#roof)"/>${roof}<path d="M${houseRight-29*u} ${h*.3}h${27*u}v${h*.37}h${-27*u}Z" fill="#d7b47f" stroke="#6c422d" stroke-width="${4*u}"/><path d="M${houseRight-26*u} ${h*.32}h${20*u}v${h*.32}h${-20*u}Z" fill="#855334"/>${paving}<path d="M${roadX} 0H${w}V${h}H${roadX}Z" fill="url(#street)"/><path d="M${roadX+12*u} 0V${h}M${w-22*u} 0V${h}" stroke="#f0eed8" stroke-width="${3*u}"/><path d="M${roadX+36*u} 0V${h}M${roadX+59*u} 0V${h}" stroke="#92a79c" stroke-opacity=".35" stroke-width="${u}"/><path d="M${w-6*u} 0V${h}" stroke="#fff4d9" stroke-width="${12*u}"/><path d="M${w-6*u} 0V${h}" stroke="#e96555" stroke-width="${12*u}" stroke-dasharray="${42*u} ${42*u}"/>${plants}${tree(houseRight-20*u,24*u,49*u)}${tree(f.x+f.w-4*u,h-5*u,31*u)}${boxes}`);
}
function lawn(g,s,foreground=false){
 asset('grass-atlas',grassAtlasSVG);
 const i=scene(s,foreground?'garden-front':'garden',()=>lawnSceneSVG(s,foreground));
 if(!ready(i))return false;g.drawImage(i,0,0,s.w,s.h);return true;
}
function mowerSVG(c){
 return svg(64,80,`<defs><linearGradient id="paint" x2=".8" y2="1"><stop stop-color="#fbffd3"/><stop offset=".22" stop-color="${c}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><g transform="translate(32 40)"><ellipse cy="4" rx="22" ry="30" fill="#254a1a50"/><g fill="#243b2a" stroke="#5c7158" stroke-width="1.5"><rect x="-22" y="-24" width="9" height="16" rx="3"/><rect x="13" y="-24" width="9" height="16" rx="3"/><rect x="-22" y="13" width="9" height="16" rx="3"/><rect x="13" y="13" width="9" height="16" rx="3"/></g><rect x="-17" y="-30" width="34" height="55" rx="7" fill="#2b4931"/><rect x="-16" y="-28" width="32" height="30" rx="5" fill="url(#paint)" stroke="#f4f5b2" stroke-width="1.4"/><path d="M-11-22H11M-11-18H11M-10-14H10" stroke="#3f5830" stroke-width="2.5"/><circle cy="-8" r="6" fill="#adc28a" stroke="#3d5b34" stroke-width="2"/><path d="M-14 3-15 27H15L14 3" fill="none" stroke="#344834" stroke-width="3.5"/><rect x="-11" y="2" width="22" height="16" rx="6" fill="${c}"/><circle cy="13" r="12" fill="${c}" stroke="#34602d" stroke-width="1.5"/><path d="M-9 9Q-7 2 2 2" stroke="#fff8c4" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M-8 6Q0 1 8 6" stroke="#cce5a2" stroke-width="2" fill="none"/><path d="M-10 20Q0 27 10 20" fill="none" stroke="#dbeaad" stroke-width="2"/><circle cx="-14" cy="9" r="3" fill="#efc98f"/><circle cx="14" cy="9" r="3" fill="#efc98f"/></g>`);
}
function mower(g,p){
 const c=colour(p.color);return stamp(g,asset('mower/'+c,()=>mowerSVG(c)),p.x,p.y,64,80,p.mower.heading+Math.PI/2);
}
function sunSVG(){
 let rays='';for(let i=0;i<10;i++)rays+=`<path transform="rotate(${i*36} 20 20)" d="m20 2 2.5 6h-5Z" fill="#ffdb4d"/>`;
 return svg(40,40,`<defs><radialGradient id="gold" cx=".35" cy=".3"><stop stop-color="#ffffbf"/><stop offset=".5" stop-color="#ffe345"/><stop offset="1" stop-color="#f2a71c"/></radialGradient></defs>${rays}<circle cx="20" cy="20" r="11" fill="url(#gold)" stroke="#dba420" stroke-width="1.5"/><path d="M13 18q2-5 7-5" fill="none" stroke="#ffffcf" stroke-width="2.4" stroke-linecap="round"/>`);
}
function sun(g,x,y,r){return stamp(g,asset('sun',sunSVG),x,y,(r+6)*2,(r+6)*2);}
function colosseumSVG(s){
 const b=s.bounds,w=b.w,h=b.h,u=w/960,fw=b.right-b.x,fh=b.bottom-b.y,cx=(b.x+b.right)/2,cy=(b.y+b.bottom)/2;
 let tiles='',stands='',cracks='',banners='',corners='';
 for(let row=0;row<Math.ceil(h/(32*u));row++)for(let col=0;col<Math.ceil(w/(42*u));col++){
  const x=col*42*u,y=row*32*u;
  tiles+=`<rect x="${x}" y="${y}" width="${42*u}" height="${32*u}" fill="${['#dfaa67','#e9b875','#dba063'][(row+col)%3]}" stroke="#ab7c4c" stroke-width="${u}"/>`;
 }
 for(const side of [-1,1]){
  const x=side<0?0:b.right+19*u,sw=side<0?b.x-19*u:w-x;
  for(let row=0;row<3;row++){
   const y=78*u+row*(h-156*u)/3,bay=(h-156*u)/3-12*u;
   stands+=`<path d="M${x} ${y}H${x+sw}V${y+bay}H${x}Z" fill="#593a31"/><path d="M${x+8*u} ${y+18*u}Q${x+sw/2} ${y-15*u} ${x+sw-8*u} ${y+18*u}V${y+bay-8*u}H${x+8*u}Z" fill="#25252b" stroke="#f1c18a" stroke-width="${5*u}"/><path d="M${x} ${y+bay}H${x+sw}" stroke="#93603d" stroke-width="${9*u}"/>`;
   for(let j=0;j<3;j++){
    const px=side<0?x+sw-12*u:x+12*u,py=y+12*u+j*bay/3;
    stands+=`<g transform="translate(${px} ${py}) scale(${u})"><ellipse cy="4" rx="10" ry="11" fill="#663b2c"/><circle r="9" fill="#d85d3c" stroke="#e4b882" stroke-width="1.5"/><path d="M-6-6Q4-11 7-2L3 6-5 3Z" fill="#d9d49b"/><path d="M-6-5 6 4" stroke="#7b8e4f" stroke-width="2"/></g>`;
   }
  }
 }
 for(const y of [22*u,h-52*u]){
  stands+=`<rect x="${cx-69*u}" y="${y}" width="${138*u}" height="${31*u}" fill="#794b35" stroke="#edc293" stroke-width="${4*u}"/>`;
  for(let i=0;i<5;i++)stands+=`<path d="M${cx-58*u+i*25*u} ${y+4*u}h${16*u}v${23*u}h${-16*u}Z" fill="#28272a"/>`;
 }
 for(let i=0;i<18;i++){
  const x=b.x+noise(i+23)*fw,y=b.y+noise(i+91)*fh;
  cracks+=`<path transform="translate(${x} ${y}) scale(${u}) rotate(${i*37})" d="M-20-10-6-5 0 3 12 5 23 17M-6-5-4-15M12 5 16-6M0 3-9 13" fill="none" stroke="#927444" stroke-width="1.2" opacity=".34"/>`;
 }
 for(const [x,y,c,a] of [[b.x-15*u,b.y-18*u,'#b7cc3e',-.35],[b.right+15*u,b.y-18*u,'#328fc1',.35],[b.x-15*u,b.bottom+18*u,'#7553bd',.35],[b.right+15*u,b.bottom+18*u,'#e99734',-.35]]){
  banners+=`<g transform="translate(${x} ${y}) rotate(${a*180/Math.PI}) scale(${u})"><path d="M-38-52H38V36L0 58-38 36Z" fill="${c}" stroke="#e8c37b" stroke-width="2"/><path d="M-35-49H-21V39L-35 32Z" fill="#ffffff25"/><path d="M21-49H35V32L21 39Z" fill="#102b4930"/><path d="M-43-54H43" stroke="#70482f" stroke-width="6"/><g transform="scale(.75)">${helmet('#71836f')}</g></g>`;
 }
 for(const x of [b.x-8*u,b.right+8*u])for(const y of [b.y-8*u,b.bottom+8*u])corners+=`<g transform="translate(${x} ${y})"><circle cy="${4*u}" r="${16*u}" fill="#73533b"/><circle r="${14*u}" fill="#d4b57d" stroke="#f4d59b" stroke-width="${3*u}"/><circle r="${8*u}" fill="#efd6a4" stroke="#b89c6c" stroke-width="${u}"/></g>`;
 const r=Math.min(fw,fh)*.205;
 return svg(w,h,`<defs><linearGradient id="sand" x2=".4" y2="1"><stop stop-color="#ffe3a0"/><stop offset="1" stop-color="#ebc47a"/></linearGradient><pattern id="key" width="${20*u}" height="${16*u}" patternUnits="userSpaceOnUse"><rect width="${20*u}" height="${16*u}" fill="#86a7a1"/><path d="M2 14V2H18V12H7V6H13V9" fill="none" stroke="#f9e8bb" stroke-width="${1.5*u}"/></pattern><clipPath id="outside"><path d="M0 0H${w}V${h}H0ZM${b.x} ${b.y}V${b.bottom}H${b.right}V${b.y}Z" clip-rule="evenodd"/></clipPath><clipPath id="floor"><rect x="${b.x}" y="${b.y}" width="${fw}" height="${fh}"/></clipPath></defs><path d="M0 0H${w}V${h}H0Z" fill="#744c39"/>${tiles}<g clip-path="url(#outside)">${stands}${banners}</g><rect x="${b.x-16*u}" y="${b.y-16*u}" width="${fw+32*u}" height="${fh+32*u}" fill="#7e704e" stroke="#fae1b0" stroke-width="${4*u}"/><rect x="${b.x-12*u}" y="${b.y-12*u}" width="${fw+24*u}" height="${fh+24*u}" fill="url(#key)"/><rect x="${b.x}" y="${b.y}" width="${fw}" height="${fh}" fill="url(#sand)" stroke="#f9e1a2" stroke-width="${2*u}"/><g clip-path="url(#floor)">${cracks}${dots(w,h,160,'#8b6a3c24',51)}</g><g transform="translate(${cx} ${cy})"><circle cy="${4*u}" r="${r+6*u}" fill="#96703d40"/><circle r="${r+7*u}" fill="#eeb74e" stroke="#b88337" stroke-width="${2*u}"/><circle r="${r+1*u}" fill="url(#key)"/><circle r="${r-8*u}" fill="#56b8b0" stroke="#fff0a0" stroke-width="${2*u}"/><circle r="${r-17*u}" fill="#c44a35"/><g transform="scale(${r/44})">${helmet('#e95c33')}</g></g>${corners}`);
}
function gladiators(g,s){
 const i=scene(s,'colosseum',()=>colosseumSVG(s));if(!ready(i))return false;
 g.drawImage(i,0,0,s.bounds.w,s.bounds.h);return true;
}
function maceSVG(c){
 let spikes='';for(let j=0;j<12;j++)spikes+=`<path transform="rotate(${j*30} 40 40)" d="m35 23 5-8 5 8Z" fill="#d8e0cc" stroke="#59655e" stroke-width="1"/>`;
 return svg(80,80,`<defs><radialGradient id="metal" cx=".3" cy=".25"><stop stop-color="#faffdf"/><stop offset=".3" stop-color="${c}"/><stop offset="1" stop-color="#3a5365"/></radialGradient></defs><ellipse cx="44" cy="47" rx="27" ry="19" fill="#67482d36"/>${spikes}<circle cx="40" cy="40" r="21" fill="url(#metal)" stroke="#4d635d" stroke-width="1.5"/><path d="M27 33q4-9 13-9" fill="none" stroke="#fffbd3" stroke-width="3" stroke-linecap="round"/><g fill="#40575b" stroke="#c6e5ce" stroke-width="1"><circle cx="48" cy="33" r="3"/><circle cx="33" cy="45" r="3"/><circle cx="47" cy="49" r="3"/></g>`);
}
function chainSVG(){return svg(20,12,'<ellipse cx="10" cy="7" rx="7.5" ry="3.6" fill="none" stroke="#513d344d" stroke-width="3"/><ellipse cx="10" cy="6" rx="7" ry="3.4" fill="none" stroke="#45515a" stroke-width="2.5"/><path d="M4 5q6-5 12 0" fill="none" stroke="#d7ddc9" stroke-width="1.4"/>');}
function chainMace(g,p,joints,metrics){
 const c=colour(p.color),ball=asset('mace/'+c,()=>maceSVG(c)),link=asset('chain',chainSVG);
 if(!ready(ball)||!ready(link))return false;
 for(let i=1;i<joints.length;i++){
  const a=joints[i-1],b=joints[i],d=Math.hypot(b.x-a.x,b.y-a.y);
  stamp(g,link,(a.x+b.x)/2,(a.y+b.y)/2,d*20/14,8,Math.atan2(b.y-a.y,b.x-a.x));
 }
 const b=p.gladiator.ball,scale=metrics.ball/21;
 stamp(g,ball,b.x,b.y,80*scale,80*scale,Math.atan2(b.vy||0,b.vx||0)*.2);return true;
}
window.ReferenceArenaArt=Object.freeze({claim,claimCar,ice,sled,lawn,grass,mower,sun,gladiators,chainMace,
 claimSceneSVG,territoryPath,claimCarSVG,iceSceneSVG,sledSVG,grassAtlasSVG,lawnSceneSVG,mowerSVG,sunSVG,colosseumSVG,maceSVG,chainSVG,
 get grassRevision(){return grassRevision;}});
})();
