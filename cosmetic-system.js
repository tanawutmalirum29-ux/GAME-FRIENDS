/* GAME-FRIENDS outfit overlays: one canonical projection per accessory.
 * Costumes are visual-only and never alter hitboxes, movement, or timing.
 * Pre-rendered twelve-color SVGs preserve fixed whites, golds and black inks. */
(() => {
'use strict';
const IDS=Object.freeze([
 'none','white-rope-wrap','pirate-hat','golden-crown',
 'shades-white-beard','pharaoh-nemes','plumed-turban',
 'viking-helmet','wizard-hat','samurai-kabuto','chef-hat','cowboy-hat','knight-helmet','devil-hat','astronaut-helmet','mining-helmet','jester-hat','paper-bag-mask'
]);
const PALETTE=new Set([
 'c62222','36d9e5','215a94','d7b000','f53695','f57a00',
 '36d595','000094','009400','b800f5','008484','94004a'
]);
const ASSETS=Object.freeze({
 'white-rope-wrap': {prefix:'hat',color:true,top:[-26,-26,52,52],front:[-48,-48,96,96]},
 'pirate-hat': {prefix:'hat',color:true,top:[-32.5,-32.5,65,65],front:[-60,-68,120,116]},
 'golden-crown': {prefix:'hat',color:true,top:[-26,-26,52,52],front:[-48,-68,96,116]},
 'shades-white-beard': {prefix:'accessory',color:false,top:[-32.5,-39,65,65],front:[-48,-48,96,116]},
 'pharaoh-nemes': {prefix:'hat',color:true,top:[-32.5,-32.5,65,65],front:[-72,-88,144,144]},
 'plumed-turban': {prefix:'hat',color:true,top:[-32.5,-32.5,65,78],front:[-60,-112,120,168]},
 /* NEW: canonical SVG masters load lazily and inherit only player-color details. */
 'viking-helmet': {prefix:'hat',color:true,dynamic:true,top:[-32.5,-32.5,65,65],front:[-60,-84,120,132]},
 'wizard-hat': {prefix:'hat',color:true,dynamic:true,top:[-32.5,-32.5,65,65],front:[-60,-138,120,186]},
 'samurai-kabuto': {prefix:'hat',color:true,dynamic:true,top:[-32.5,-32.5,65,65],front:[-60,-110,120,158]},
 'chef-hat': {prefix:'hat',color:true,dynamic:true,top:[-32.5,-32.5,65,65],front:[-60,-132,120,180]},
 'cowboy-hat': {prefix:'hat',color:true,dynamic:true,top:[-32.5,-32.5,65,65],front:[-60,-76,120,124]},
 'knight-helmet': {prefix:'hat',color:true,dynamic:true,top:[-32.5,-32.5,65,65],front:[-60,-116,120,164]},
 'devil-hat': {prefix:'hat',color:true,dynamic:true,top:[-32.5,-32.5,65,65],front:[-60,-100,120,148]},
 'astronaut-helmet': {prefix:'hat',color:true,dynamic:true,top:[-32.5,-32.5,65,65],front:[-60,-68,120,116]},
 'mining-helmet': {prefix:'hat',color:true,dynamic:true,top:[-32.5,-32.5,65,65],front:[-60,-68,120,116]},
 'jester-hat': {prefix:'hat',color:true,dynamic:true,top:[-45.5,-32.5,91,65],front:[-72,-88,144,120]},
 'paper-bag-mask': {prefix:'mask',color:false,top:[-26,-26,52,52],front:[-48,-52,96,104]}
});
const cache=new Map(),fallbackSources=new Map();
const normalize=id=>IDS.includes(id)?id:'none';
const next=id=>IDS[(Math.max(0,IDS.indexOf(normalize(id)))+1)%IDS.length];
function randomBot(random=Math.random){
 const value=Number(random());
 return IDS[1+Math.min(IDS.length-2,Math.max(0,Math.floor((Number.isFinite(value)?value:0)*(IDS.length-1))))];
}
const safeColor=value=>/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value).slice(1).toLowerCase():'c62222';
function assetPath(id,view,color){
 const spec=ASSETS[id],prefix='./assets/cosmetics/'+id+'/';
 if(spec.dynamic)return prefix+spec.prefix+'-'+(view==='top'?'top':'front')+'.svg';
 if(spec.color&&PALETTE.has(color))return prefix+'colors/'+view+'-'+color+'.svg';
 return prefix+spec.prefix+'-'+(view==='top'?'top':'front')+'.svg';
}
function imageFor(player,view){
 const id=normalize(player?.cosmetic),spec=ASSETS[id];
 if(!spec||typeof Image==='undefined')return null;
 const color=spec.color?safeColor(player?.color):'fixed';
 const key=id+'/'+view+'/'+color;
 if(cache.has(key))return cache.get(key);
 const img=new Image();img.decoding='async';cache.set(key,img);
 const url=assetPath(id,view,color);
 // Current twelve-player palette uses authored, color-correct files directly.
 // For future custom colors, recolor only the SVG root color (currentColor).
 if(spec.color&&(spec.dynamic||!PALETTE.has(color))&&typeof fetch==='function'){
  const sourceKey=id+'/'+view;
  let source=fallbackSources.get(sourceKey);
  if(!source){
   source=fetch(url,{cache:'force-cache'}).then(r=>{
    if(!r.ok)throw Error('Missing cosmetic SVG '+id);
    return r.text();
   });
   fallbackSources.set(sourceKey,source);
  }
  source.then(svg=>{
   const colored=svg.replace(/(<svg\b[^>]*\bcolor=")#[0-9a-f]{6}(")/i,'$1#'+color+'$2');
   img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(colored);
  }).catch(()=>{img.src=url;});
 }else img.src=url;
 return img;
}
function preload(player){
 imageFor(player,'top');imageFor(player,'front');
}
function drawTop(ctx,player){
 const spec=ASSETS[normalize(player?.cosmetic)],img=imageFor(player,'top');
 if(!spec||!img?.complete||!img.naturalWidth)return false;
 ctx.drawImage(img,...spec.top);
 return true;
}
function drawFront(ctx,player,x,y,size=60){
 const spec=ASSETS[normalize(player?.cosmetic)],img=imageFor(player,'front');
 if(!spec||!img?.complete||!img.naturalWidth)return false;
 const scale=size/96,[dx,dy,w,h]=spec.front;
 ctx.drawImage(img,x+dx*scale,y+dy*scale,w*scale,h*scale);
 return true;
}
window.PartyCosmetics=Object.freeze({IDS,ASSETS,normalize,next,randomBot,preload,drawTop,drawFront,imageFor});
})();
