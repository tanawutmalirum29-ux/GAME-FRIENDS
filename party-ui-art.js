/* Original vector interface symbols shared across GAME-FRIENDS mini-games.
   Pictograms are hand-drawn SVG; never rely on emoji/system glyph fonts. */
(() => {
'use strict';
const SHAPES=Object.freeze({
 potion:'<rect x="18" y="3" width="12" height="8" rx="2" fill="#caac85"/><path d="M17 11h14v8c7 7 11 15 5 22H12c-6-7-2-15 5-22Z" fill="#79d5a9" stroke="#3a846d" stroke-width="2.4"/><path d="M13 30h23" stroke="#e7ffea" stroke-width="3"/><path d="M24 24v14m-7-7h14" stroke="#fff" stroke-width="3"/>',
 ufo:'<ellipse cx="24" cy="28" rx="21" ry="10" fill="#8593b4" stroke="#455c7e" stroke-width="2"/><path d="M13 25c0-16 5-20 11-20s12 5 12 20Z" fill="#a5e9ff" stroke="#4d8cab" stroke-width="2"/><ellipse cx="24" cy="27" rx="16" ry="5" fill="#b9c2de"/><circle cx="12" cy="30" r="2" fill="#ffe698"/><circle cx="24" cy="32" r="2" fill="#ffe698"/><circle cx="36" cy="30" r="2" fill="#ffe698"/>',
 rocket:'<path d="M24 4C13 14 14 28 19 34h10C34 28 35 14 24 4Z" fill="#e7f7ff" stroke="#6889a9" stroke-width="2"/><circle cx="24" cy="21" r="5.5" fill="#59c2e5" stroke="#5b82a2" stroke-width="2"/><path d="M18 28 9 34l-1 10 12-7m10-9 9 6 1 10-12-7" fill="#ee708a" stroke="#ae445e" stroke-width="2"/><path d="M21 35 24 47l4-12Z" fill="#ffc05b"/>',
 bomber:'<path d="M24 3 29 19 45 29l-1 6-15-4-1 9 7 5H13l7-5-1-9-15 4-1-6 16-10Z" fill="#ebcf91" stroke="#94754e" stroke-width="2" stroke-linejoin="round"/><path d="M24 8v25" stroke="#fff2c8" stroke-width="3"/>',
 car:'<rect x="6" y="11" width="9" height="10" rx="3" fill="#35465d"/><rect x="33" y="11" width="9" height="10" rx="3" fill="#35465d"/><rect x="6" y="30" width="9" height="10" rx="3" fill="#35465d"/><rect x="33" y="30" width="9" height="10" rx="3" fill="#35465d"/><rect x="12" y="7" width="24" height="34" rx="7" fill="#e9899a" stroke="#a14469" stroke-width="2"/><rect x="17" y="13" width="14" height="11" rx="3" fill="#b8ecfa"/><circle cx="24" cy="32" r="5" fill="#334d62"/>',
 shield:'<path d="M24 3 42 10v15c0 9-8 17-18 21C14 42 6 34 6 25V10Z" fill="#7bd1ef" stroke="#2e80ab" stroke-width="2.5"/><path d="M24 9 36 14v12c0 6-5 11-12 14Z" fill="#4c9dc9"/><path d="m14 25 8 7 13-17" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
 close:'<circle cx="24" cy="24" r="19" fill="#ba5365" stroke="#ffcbd6" stroke-width="2.5"/><path d="M16 16 32 32M32 16 16 32" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>',
 bag:'<path d="M11 16h26l4 26H7l4-26Z" fill="#c18a5b" stroke="#6d453c" stroke-width="2.6" stroke-linejoin="round"/><path d="M17 16V13C17 3 31 3 31 13v3" fill="none" stroke="#ffe2aa" stroke-width="4" stroke-linecap="round"/><path d="M10 25h28M11 35h26" stroke="#f5c990" stroke-width="2" opacity=".85"/><path d="M24 24v12" stroke="#ffe1a1" stroke-width="3" stroke-linecap="round"/>',
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