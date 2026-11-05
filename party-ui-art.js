/* Original vector interface symbols shared across GAME-FRIENDS mini-games.
   Pictograms are hand-drawn SVG; never rely on emoji/system glyph fonts. */
(() => {
'use strict';
const SHAPES=Object.freeze({
 star:'<path d="m24 4 6.1 12.7 14 2-10.2 9.8 2.5 14-12.4-6.6-12.5 6.6 2.5-14L3.8 18.7l14-2Z" fill="#fbe178" stroke="#c89032" stroke-width="2.1" stroke-linejoin="round"/><path d="m24 10 4.4 9" stroke="#fff9d1" stroke-width="2.5" stroke-linecap="round"/>',
 sparkle:'<path d="M24 2 29 18 46 24 29 29 24 46 19 29 2 24 19 18Z" fill="#fff2ad" stroke="#d39b45" stroke-width="2" stroke-linejoin="round"/><circle cx="39" cy="8" r="3" fill="#fffae0"/><circle cx="9" cy="39" r="2.5" fill="#fff3bf"/>',
 check:'<circle cx="24" cy="24" r="20" fill="#299b67" stroke="#e7ffee" stroke-width="2"/><path d="m12 24 8.5 8L37 15" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'
});
const cache=new Map();
function svg(id){
 if(!Object.prototype.hasOwnProperty.call(SHAPES,id))return '';
 return '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">'+SHAPES[id]+'</svg>';
}
function imageFor(id){
 if(!SHAPES[id]||typeof Image==='undefined')return null;
 if(cache.has(id))return cache.get(id);
 const pic=new Image();pic.decoding='async';
 pic.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(id));
 cache.set(id,pic);
 return pic;
}
function draw(ctx,id,x,y,size=18){
 const pic=imageFor(id);
 if(!pic?.complete||!pic.naturalWidth||!ctx?.drawImage)return false;
 ctx.drawImage(pic,x-size/2,y-size/2,size,size);return true;
}
for(const id of Object.keys(SHAPES))imageFor(id);
window.PartyUiArt=Object.freeze({svg,draw,ids:Object.freeze(Object.keys(SHAPES))});
})();